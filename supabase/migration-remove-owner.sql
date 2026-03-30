-- =====================================================
-- BeecHage: Remove OWNER role, simplify to ADMIN/RECEPTION/LAUNDRY
-- Run this in Supabase SQL Editor
-- =====================================================

-- ═══════════════════════════════════════════════════════
-- 1. Convert all OWNER users to ADMIN
-- ═══════════════════════════════════════════════════════

-- Bypass guard triggers
SET LOCAL app.allow_owner_creation = 'true';

UPDATE public.users SET role = 'ADMIN' WHERE role = 'OWNER';
UPDATE public.tenant_memberships SET role = 'ADMIN' WHERE role = 'OWNER';
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
  || '{"role": "ADMIN"}'::jsonb
WHERE raw_app_meta_data->>'role' = 'OWNER';

-- ═══════════════════════════════════════════════════════
-- 2. Make sure admin@beechage.com is ADMIN
-- ═══════════════════════════════════════════════════════

UPDATE public.users SET role = 'ADMIN' WHERE email = 'admin@beechage.com';
UPDATE public.tenant_memberships SET role = 'ADMIN'
WHERE user_id = (SELECT id FROM public.users WHERE email = 'admin@beechage.com');
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
  || '{"role": "ADMIN"}'::jsonb
WHERE email = 'admin@beechage.com';

-- ═══════════════════════════════════════════════════════
-- 3. Remove guard triggers (no OWNER to protect anymore)
-- ═══════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS trg_guard_membership_insert ON public.tenant_memberships;
DROP TRIGGER IF EXISTS trg_guard_membership_update ON public.tenant_memberships;
DROP TRIGGER IF EXISTS trg_guard_user_role_update ON public.users;

DROP FUNCTION IF EXISTS public.guard_membership_insert();
DROP FUNCTION IF EXISTS public.guard_membership_update();
DROP FUNCTION IF EXISTS public.guard_user_role_update();
DROP FUNCTION IF EXISTS public.role_rank(TEXT);
DROP FUNCTION IF EXISTS public.safe_update_member_role(UUID, UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.seed_set_owner(UUID, UUID);

-- ═══════════════════════════════════════════════════════
-- 4. Simplified handle_new_user trigger (no OWNER cap needed)
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_role TEXT;
BEGIN
  v_tenant_id := (NEW.raw_app_meta_data ->> 'tenant_id')::UUID;
  v_role := COALESCE(NEW.raw_app_meta_data ->> 'role', 'RECEPTION');

  -- Only allow valid roles
  IF v_role NOT IN ('ADMIN', 'RECEPTION', 'LAUNDRY') THEN
    v_role := 'RECEPTION';
  END IF;

  INSERT INTO public.users (id, email, name, tenant_id, role, "isActive")
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NULL),
    v_tenant_id, v_role, true
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
-- 5. Fix RLS: tenant_memberships should be SELECT-only for authenticated
-- ═══════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Tenant isolation" ON public.tenant_memberships;
DROP POLICY IF EXISTS "Tenant members read" ON public.tenant_memberships;
CREATE POLICY "Tenant members read" ON public.tenant_memberships
  FOR SELECT TO authenticated
  USING (tenant_id = public.requesting_tenant_id());

DROP POLICY IF EXISTS "Service role full memberships" ON public.tenant_memberships;
CREATE POLICY "Service role full memberships" ON public.tenant_memberships
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════
-- 6. Verify everything
-- ═══════════════════════════════════════════════════════

SELECT u.email, u.role AS users_role, tm.role AS membership_role,
       au.raw_app_meta_data->>'role' AS jwt_role
FROM public.users u
LEFT JOIN public.tenant_memberships tm ON tm.user_id = u.id
LEFT JOIN auth.users au ON au.id = u.id
ORDER BY u."createdAt";
