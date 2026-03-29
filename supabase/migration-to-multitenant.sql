-- =====================================================
-- BeecHage: Migration to Multi-Tenant
-- Run this in Supabase SQL Editor IN ORDER
-- =====================================================
-- This script:
--   1. Creates new tables (tenants, branches, memberships)
--   2. Adds tenant_id to all business tables
--   3. Creates a default tenant and backfills data
--   4. Replaces RLS policies with tenant-aware ones
--   5. Updates the user creation trigger
-- =====================================================

-- ═══════════════════════════════════════════════════════
-- STEP 1: RLS helper function
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.requesting_tenant_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID,
    NULL
  );
$$ LANGUAGE sql STABLE;

-- ═══════════════════════════════════════════════════════
-- STEP 2: Create tenants table
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','starter','pro','enterprise')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  settings    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own tenant" ON public.tenants
  FOR SELECT TO authenticated USING (id = public.requesting_tenant_id());
CREATE POLICY "Service role full tenants" ON public.tenants
  FOR ALL TO service_role USING (true);

-- ═══════════════════════════════════════════════════════
-- STEP 3: Create branches table
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.branches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_branch_tenant ON public.branches(tenant_id);
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.branches
  FOR ALL TO authenticated
  USING (tenant_id = public.requesting_tenant_id())
  WITH CHECK (tenant_id = public.requesting_tenant_id());
CREATE POLICY "Service role full branches" ON public.branches
  FOR ALL TO service_role USING (true);

-- ═══════════════════════════════════════════════════════
-- STEP 4: Insert the default tenant + branch
-- ═══════════════════════════════════════════════════════
INSERT INTO public.tenants (id, name, slug, plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'BeecHage', 'bh', 'pro')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.branches (tenant_id, name, is_default)
VALUES ('00000000-0000-0000-0000-000000000001', 'Main Branch', true)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- STEP 5: Add tenant_id to users table
-- ═══════════════════════════════════════════════════════
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

-- Update role constraint to include OWNER
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('OWNER','ADMIN','RECEPTION','LAUNDRY'));

-- Backfill: assign all existing users to the default tenant
UPDATE public.users SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- Make the first ADMIN user an OWNER
UPDATE public.users SET role = 'OWNER'
WHERE role = 'ADMIN'
  AND id = (SELECT id FROM public.users WHERE role = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1);

-- ═══════════════════════════════════════════════════════
-- STEP 6: Create tenant_memberships table
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id   UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  role        TEXT NOT NULL DEFAULT 'RECEPTION'
              CHECK (role IN ('OWNER','ADMIN','RECEPTION','LAUNDRY')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_membership_user ON public.tenant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_membership_tenant ON public.tenant_memberships(tenant_id);

ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public.tenant_memberships
  FOR ALL TO authenticated
  USING (tenant_id = public.requesting_tenant_id())
  WITH CHECK (tenant_id = public.requesting_tenant_id());
CREATE POLICY "Service role full memberships" ON public.tenant_memberships
  FOR ALL TO service_role USING (true);

-- Backfill memberships from existing users
INSERT INTO public.tenant_memberships (user_id, tenant_id, role, is_active)
SELECT id, tenant_id, role, "isActive"
FROM public.users
WHERE tenant_id IS NOT NULL
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════
-- STEP 7: Add tenant_id to all business tables
-- ═══════════════════════════════════════════════════════

-- ExpenseCategory
ALTER TABLE public."ExpenseCategory" ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public."ExpenseCategory" SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public."ExpenseCategory" ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expense_cat_tenant ON public."ExpenseCategory"(tenant_id);
-- Fix unique constraint: drop old, add tenant-scoped
ALTER TABLE public."ExpenseCategory" DROP CONSTRAINT IF EXISTS "ExpenseCategory_name_key";
ALTER TABLE public."ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_tenant_name_key" UNIQUE(tenant_id, name);

-- Expense
ALTER TABLE public."Expense" ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public."Expense" ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
UPDATE public."Expense" SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public."Expense" ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expense_tenant ON public."Expense"(tenant_id);

-- ServiceCategory
ALTER TABLE public."ServiceCategory" ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public."ServiceCategory" SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public."ServiceCategory" ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_cat_tenant ON public."ServiceCategory"(tenant_id);
ALTER TABLE public."ServiceCategory" DROP CONSTRAINT IF EXISTS "ServiceCategory_name_key";
ALTER TABLE public."ServiceCategory" ADD CONSTRAINT "ServiceCategory_tenant_name_key" UNIQUE(tenant_id, name);

-- ServiceItem
ALTER TABLE public."ServiceItem" ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public."ServiceItem" SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public."ServiceItem" ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_item_tenant ON public."ServiceItem"(tenant_id);

-- Order
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
ALTER TABLE public."Order" ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
UPDATE public."Order" SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public."Order" ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_tenant ON public."Order"(tenant_id);
-- Fix unique constraint on orderNumber: tenant-scoped
ALTER TABLE public."Order" DROP CONSTRAINT IF EXISTS "Order_orderNumber_key";
ALTER TABLE public."Order" ADD CONSTRAINT "Order_tenant_orderNumber_key" UNIQUE(tenant_id, "orderNumber");

-- OrderItem
ALTER TABLE public."OrderItem" ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;
UPDATE public."OrderItem" SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public."OrderItem" ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_item_tenant ON public."OrderItem"(tenant_id);

-- ═══════════════════════════════════════════════════════
-- STEP 8: Replace all RLS policies with tenant-aware ones
-- ═══════════════════════════════════════════════════════

-- Users
DROP POLICY IF EXISTS "Authenticated can read users" ON public.users;
DROP POLICY IF EXISTS "Service role full access" ON public.users;
CREATE POLICY "Tenant users read" ON public.users
  FOR SELECT TO authenticated USING (tenant_id = public.requesting_tenant_id());
CREATE POLICY "Service role full users" ON public.users
  FOR ALL TO service_role USING (true);

-- ExpenseCategory
DROP POLICY IF EXISTS "Authenticated can read ExpenseCategory" ON public."ExpenseCategory";
DROP POLICY IF EXISTS "Service role full ExpenseCategory" ON public."ExpenseCategory";
DROP POLICY IF EXISTS "Authenticated can manage ExpenseCategory" ON public."ExpenseCategory";
CREATE POLICY "Tenant isolation" ON public."ExpenseCategory"
  FOR ALL TO authenticated
  USING (tenant_id = public.requesting_tenant_id())
  WITH CHECK (tenant_id = public.requesting_tenant_id());
CREATE POLICY "Service role full" ON public."ExpenseCategory"
  FOR ALL TO service_role USING (true);

-- Expense
DROP POLICY IF EXISTS "Authenticated can manage Expense" ON public."Expense";
CREATE POLICY "Tenant isolation" ON public."Expense"
  FOR ALL TO authenticated
  USING (tenant_id = public.requesting_tenant_id())
  WITH CHECK (tenant_id = public.requesting_tenant_id());
CREATE POLICY "Service role full" ON public."Expense"
  FOR ALL TO service_role USING (true);

-- ServiceCategory
DROP POLICY IF EXISTS "Authenticated can read ServiceCategory" ON public."ServiceCategory";
DROP POLICY IF EXISTS "Authenticated can manage ServiceCategory" ON public."ServiceCategory";
CREATE POLICY "Tenant isolation" ON public."ServiceCategory"
  FOR ALL TO authenticated
  USING (tenant_id = public.requesting_tenant_id())
  WITH CHECK (tenant_id = public.requesting_tenant_id());
CREATE POLICY "Service role full" ON public."ServiceCategory"
  FOR ALL TO service_role USING (true);

-- ServiceItem
DROP POLICY IF EXISTS "Authenticated can read ServiceItem" ON public."ServiceItem";
DROP POLICY IF EXISTS "Authenticated can manage ServiceItem" ON public."ServiceItem";
CREATE POLICY "Tenant isolation" ON public."ServiceItem"
  FOR ALL TO authenticated
  USING (tenant_id = public.requesting_tenant_id())
  WITH CHECK (tenant_id = public.requesting_tenant_id());
CREATE POLICY "Service role full" ON public."ServiceItem"
  FOR ALL TO service_role USING (true);

-- Order
DROP POLICY IF EXISTS "Authenticated can manage Order" ON public."Order";
CREATE POLICY "Tenant isolation" ON public."Order"
  FOR ALL TO authenticated
  USING (tenant_id = public.requesting_tenant_id())
  WITH CHECK (tenant_id = public.requesting_tenant_id());
CREATE POLICY "Service role full" ON public."Order"
  FOR ALL TO service_role USING (true);

-- OrderItem
DROP POLICY IF EXISTS "Authenticated can manage OrderItem" ON public."OrderItem";
CREATE POLICY "Tenant isolation" ON public."OrderItem"
  FOR ALL TO authenticated
  USING (tenant_id = public.requesting_tenant_id())
  WITH CHECK (tenant_id = public.requesting_tenant_id());
CREATE POLICY "Service role full" ON public."OrderItem"
  FOR ALL TO service_role USING (true);

-- ═══════════════════════════════════════════════════════
-- STEP 9: Update the user creation trigger
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_role TEXT;
BEGIN
  v_tenant_id := (NEW.raw_app_meta_data ->> 'tenant_id')::UUID;
  v_role := COALESCE(NEW.raw_app_meta_data ->> 'role', 'RECEPTION');

  INSERT INTO public.users (id, email, name, tenant_id, role, "isActive")
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NULL),
    v_tenant_id,
    v_role,
    true
  );

  IF v_tenant_id IS NOT NULL THEN
    INSERT INTO public.tenant_memberships (user_id, tenant_id, role, is_active)
    VALUES (NEW.id, v_tenant_id, v_role, true);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════
-- STEP 10: Update existing admin user's app_metadata
-- (Run this manually, replacing USER_ID with actual admin UUID)
-- ═══════════════════════════════════════════════════════
-- UPDATE auth.users
-- SET raw_app_meta_data = raw_app_meta_data
--   || jsonb_build_object('tenant_id', '00000000-0000-0000-0000-000000000001', 'role', 'OWNER')
-- WHERE id = 'YOUR_ADMIN_USER_ID';
--
-- NOTE: The seed-admin.mjs script will handle this automatically for new setups.
-- For existing setups, run the above for each existing user.

-- Quick helper: update ALL existing users' app_metadata to include tenant_id
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, tenant_id, role FROM public.users WHERE tenant_id IS NOT NULL
  LOOP
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('tenant_id', r.tenant_id::text, 'role', r.role)
    WHERE id = r.id;
  END LOOP;
END $$;
