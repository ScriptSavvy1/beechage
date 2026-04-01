-- =====================================================
-- BeecHage Multi-Tenant SaaS Schema
-- =====================================================

-- ─── Helper: extract tenant_id from the user's JWT app_metadata ──
CREATE OR REPLACE FUNCTION public.requesting_tenant_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID,
    NULL
  );
$$ LANGUAGE sql STABLE;

-- ─── Tenants ──
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
  FOR SELECT TO authenticated
  USING (id = public.requesting_tenant_id());
CREATE POLICY "Service role full tenants" ON public.tenants
  FOR ALL TO service_role USING (true);

-- ─── Branches ──
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

-- ─── Public users table (synced from auth.users via trigger) ──
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  tenant_id   UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  role        TEXT NOT NULL DEFAULT 'RECEPTION'
              CHECK (role IN ('OWNER','ADMIN','RECEPTION','LAUNDRY')),
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- Users can read other users in their tenant (needed for createdBy joins)
CREATE POLICY "Tenant users read" ON public.users
  FOR SELECT TO authenticated
  USING (tenant_id = public.requesting_tenant_id());
CREATE POLICY "Service role full users" ON public.users
  FOR ALL TO service_role USING (true);

-- ─── Tenant Memberships (user ↔ tenant with role) ──
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

-- ─── Trigger: auto-create public.users row when auth.users is created ──
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

  -- Also create membership if tenant_id is set
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

-- ─── Expense Categories ──
CREATE TABLE IF NOT EXISTS public."ExpenseCategory" (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  "sortOrder" INT NOT NULL DEFAULT 0,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_expense_cat_tenant ON public."ExpenseCategory"(tenant_id);

ALTER TABLE public."ExpenseCategory" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public."ExpenseCategory"
  FOR ALL TO authenticated
  USING (tenant_id = public.requesting_tenant_id())
  WITH CHECK (tenant_id = public.requesting_tenant_id());
CREATE POLICY "Service role full" ON public."ExpenseCategory"
  FOR ALL TO service_role USING (true);

-- ─── Expenses ──
CREATE TABLE IF NOT EXISTS public."Expense" (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  "expenseCategoryId" UUID NOT NULL REFERENCES public."ExpenseCategory"(id),
  "categoryName"      TEXT NOT NULL,
  amount              NUMERIC(12,2) NOT NULL,
  "expenseDate"       DATE NOT NULL,
  description         TEXT,
  branch_id           UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  "createdById"       UUID NOT NULL REFERENCES public.users(id),
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_tenant ON public."Expense"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expense_date ON public."Expense"("expenseDate");
CREATE INDEX IF NOT EXISTS idx_expense_created_by ON public."Expense"("createdById");
CREATE INDEX IF NOT EXISTS idx_expense_category ON public."Expense"("expenseCategoryId");

ALTER TABLE public."Expense" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public."Expense"
  FOR ALL TO authenticated
  USING (tenant_id = public.requesting_tenant_id())
  WITH CHECK (tenant_id = public.requesting_tenant_id());
CREATE POLICY "Service role full" ON public."Expense"
  FOR ALL TO service_role USING (true);

-- ─── Service Categories ──
CREATE TABLE IF NOT EXISTS public."ServiceCategory" (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  "sortOrder"           INT NOT NULL DEFAULT 0,
  "isActive"            BOOLEAN NOT NULL DEFAULT true,
  "allowsCustomPricing" BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_service_cat_tenant ON public."ServiceCategory"(tenant_id);

ALTER TABLE public."ServiceCategory" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public."ServiceCategory"
  FOR ALL TO authenticated
  USING (tenant_id = public.requesting_tenant_id())
  WITH CHECK (tenant_id = public.requesting_tenant_id());
CREATE POLICY "Service role full" ON public."ServiceCategory"
  FOR ALL TO service_role USING (true);

-- ─── Service Items ──
CREATE TABLE IF NOT EXISTS public."ServiceItem" (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  "serviceCategoryId" UUID NOT NULL REFERENCES public."ServiceCategory"(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  "defaultPrice"      NUMERIC(12,2) NOT NULL,
  "pricingType"       TEXT NOT NULL DEFAULT 'FIXED' CHECK ("pricingType" IN ('FIXED', 'PER_KG')),
  "sortOrder"         INT NOT NULL DEFAULT 0,
  "isActive"          BOOLEAN NOT NULL DEFAULT true,
  UNIQUE("serviceCategoryId", name)
);

CREATE INDEX IF NOT EXISTS idx_service_item_tenant ON public."ServiceItem"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_item_category ON public."ServiceItem"("serviceCategoryId");

ALTER TABLE public."ServiceItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public."ServiceItem"
  FOR ALL TO authenticated
  USING (tenant_id = public.requesting_tenant_id())
  WITH CHECK (tenant_id = public.requesting_tenant_id());
CREATE POLICY "Service role full" ON public."ServiceItem"
  FOR ALL TO service_role USING (true);

-- ─── Orders ──
CREATE TABLE IF NOT EXISTS public."Order" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  "orderNumber"   TEXT NOT NULL,
  "createdById"   UUID NOT NULL REFERENCES public.users(id),
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes           TEXT,
  "customerName"  TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "totalAmount"   NUMERIC(12,2) NOT NULL,
  "paidAmount"    NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID'
                  CHECK ("paymentStatus" IN ('UNPAID', 'PARTIALLY_PAID', 'PAID')),
  "orderStatus"   TEXT NOT NULL DEFAULT 'IN_PROGRESS'
                  CHECK ("orderStatus" IN ('IN_PROGRESS', 'READY', 'PICKED_UP')),
  branch_id       UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  UNIQUE(tenant_id, "orderNumber")
);

CREATE INDEX IF NOT EXISTS idx_order_tenant ON public."Order"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_created_by ON public."Order"("createdById");
CREATE INDEX IF NOT EXISTS idx_order_created_at ON public."Order"("createdAt");

ALTER TABLE public."Order" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public."Order"
  FOR ALL TO authenticated
  USING (tenant_id = public.requesting_tenant_id())
  WITH CHECK (tenant_id = public.requesting_tenant_id());
CREATE POLICY "Service role full" ON public."Order"
  FOR ALL TO service_role USING (true);

-- ─── Order Items ──
CREATE TABLE IF NOT EXISTS public."OrderItem" (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  "orderId"           UUID NOT NULL REFERENCES public."Order"(id) ON DELETE CASCADE,
  "serviceCategoryId" UUID NOT NULL REFERENCES public."ServiceCategory"(id),
  "categoryName"      TEXT NOT NULL,
  "serviceItemId"     UUID REFERENCES public."ServiceItem"(id) ON DELETE SET NULL,
  "itemName"          TEXT NOT NULL,
  quantity            INT NOT NULL,
  "unitPrice"         NUMERIC(12,2) NOT NULL,
  "lineTotal"         NUMERIC(12,2) NOT NULL,
  "pricingType"       TEXT NOT NULL DEFAULT 'FIXED' CHECK ("pricingType" IN ('FIXED', 'PER_KG')),
  "weightKg"          NUMERIC(8,3),
  "sortOrder"         INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_order_item_tenant ON public."OrderItem"(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_item_order ON public."OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS idx_order_item_category ON public."OrderItem"("serviceCategoryId");
CREATE INDEX IF NOT EXISTS idx_order_item_service ON public."OrderItem"("serviceItemId");

ALTER TABLE public."OrderItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON public."OrderItem"
  FOR ALL TO authenticated
  USING (tenant_id = public.requesting_tenant_id())
  WITH CHECK (tenant_id = public.requesting_tenant_id());
CREATE POLICY "Service role full" ON public."OrderItem"
  FOR ALL TO service_role USING (true);
