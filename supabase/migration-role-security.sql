-- =====================================================
-- BeecHage: Role Security Hardening
-- Run this in Supabase SQL Editor AFTER the multi-tenant migration
-- =====================================================

-- ═══════════════════════════════════════════════════════
-- 1. Role hierarchy ranking function
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.role_rank(p_role TEXT)
RETURNS INT AS $$
  SELECT CASE p_role
    WHEN 'OWNER'     THEN 100
    WHEN 'ADMIN'     THEN 50
    WHEN 'RECEPTION' THEN 10
    WHEN 'LAUNDRY'   THEN 10
    ELSE 0
  END;
$$ LANGUAGE sql IMMUTABLE;

-- ═══════════════════════════════════════════════════════
-- 2. Guard trigger on tenant_memberships INSERT
--    Blocks OWNER unless bypass flag is set
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.guard_membership_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'OWNER'
     AND COALESCE(current_setting('app.allow_owner_creation', true), 'false') <> 'true'
  THEN
    RAISE EXCEPTION 'ROLE_ESCALATION_BLOCKED: OWNER cannot be assigned via application';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_guard_membership_insert ON public.tenant_memberships;
CREATE TRIGGER trg_guard_membership_insert
  BEFORE INSERT ON public.tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION public.guard_membership_insert();

-- ═══════════════════════════════════════════════════════
-- 3. Guard trigger on tenant_memberships UPDATE
--    Blocks OWNER promotion/demotion unless bypass flag is set
--    Validates caller rank for non-OWNER changes
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.guard_membership_update()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_bypass BOOLEAN;
BEGIN
  IF OLD.role = NEW.role THEN RETURN NEW; END IF;

  v_bypass := COALESCE(current_setting('app.allow_owner_creation', true), 'false') = 'true';

  -- OWNER changes require bypass flag
  IF (NEW.role = 'OWNER' OR OLD.role = 'OWNER') AND NOT v_bypass THEN
    RAISE EXCEPTION 'ROLE_ESCALATION_BLOCKED: OWNER role changes require elevated access';
  END IF;

  -- If bypass is active, allow (seed script / secure RPC)
  IF v_bypass THEN RETURN NEW; END IF;

  -- Read caller context
  BEGIN
    v_caller_id := current_setting('app.caller_user_id', true)::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_caller_id := NULL;
  END;

  -- No caller context = direct SQL, allow
  IF v_caller_id IS NULL THEN RETURN NEW; END IF;

  -- Look up caller's role
  SELECT role INTO v_caller_role
  FROM public.tenant_memberships
  WHERE user_id = v_caller_id AND tenant_id = NEW.tenant_id AND is_active = true;

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'ROLE_ESCALATION_BLOCKED: caller has no active membership';
  END IF;

  -- Caller can only assign roles below their own rank
  IF public.role_rank(NEW.role) >= public.role_rank(v_caller_role) THEN
    RAISE EXCEPTION 'ROLE_ESCALATION_BLOCKED: % cannot assign role %', v_caller_role, NEW.role;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_guard_membership_update ON public.tenant_memberships;
CREATE TRIGGER trg_guard_membership_update
  BEFORE UPDATE ON public.tenant_memberships
  FOR EACH ROW EXECUTE FUNCTION public.guard_membership_update();

-- ═══════════════════════════════════════════════════════
-- 4. Guard trigger on public.users role UPDATE
--    Blocks OWNER changes unless bypass flag is set
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.guard_user_role_update()
RETURNS TRIGGER AS $$
DECLARE
  v_bypass BOOLEAN;
BEGIN
  IF OLD.role IS NOT DISTINCT FROM NEW.role THEN RETURN NEW; END IF;

  v_bypass := COALESCE(current_setting('app.allow_owner_creation', true), 'false') = 'true';

  IF (NEW.role = 'OWNER' OR OLD.role = 'OWNER') AND NOT v_bypass THEN
    RAISE EXCEPTION 'ROLE_ESCALATION_BLOCKED: OWNER role changes require elevated access';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_guard_user_role_update ON public.users;
CREATE TRIGGER trg_guard_user_role_update
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_role_update();

-- ═══════════════════════════════════════════════════════
-- 5. Updated handle_new_user trigger: caps role at ADMIN
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_role TEXT;
BEGIN
  v_tenant_id := (NEW.raw_app_meta_data ->> 'tenant_id')::UUID;
  v_role := COALESCE(NEW.raw_app_meta_data ->> 'role', 'RECEPTION');

  -- CAP: OWNER cannot be created via auth trigger — max is ADMIN
  IF v_role = 'OWNER' THEN
    v_role := 'ADMIN';
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
-- 6. Secure RPC: update a user's role (app-facing)
--    Called by application with caller validation
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.safe_update_member_role(
  p_caller_id UUID,
  p_target_user_id UUID,
  p_tenant_id UUID,
  p_new_role TEXT
)
RETURNS VOID AS $$
DECLARE
  v_caller_role TEXT;
  v_target_role TEXT;
BEGIN
  -- Validate: only valid non-OWNER roles
  IF p_new_role NOT IN ('ADMIN', 'RECEPTION', 'LAUNDRY') THEN
    RAISE EXCEPTION 'Invalid role: %', p_new_role;
  END IF;

  -- Cannot change own role
  IF p_caller_id = p_target_user_id THEN
    RAISE EXCEPTION 'Cannot change your own role';
  END IF;

  -- Get caller's role
  SELECT role INTO v_caller_role
  FROM public.tenant_memberships
  WHERE user_id = p_caller_id AND tenant_id = p_tenant_id AND is_active = true;

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('OWNER', 'ADMIN') THEN
    RAISE EXCEPTION 'Only OWNER or ADMIN can change user roles';
  END IF;

  -- ADMIN cannot assign ADMIN
  IF v_caller_role = 'ADMIN' AND p_new_role = 'ADMIN' THEN
    RAISE EXCEPTION 'ROLE_ESCALATION_BLOCKED: ADMIN cannot assign ADMIN role';
  END IF;

  -- Get target's current role
  SELECT role INTO v_target_role
  FROM public.tenant_memberships
  WHERE user_id = p_target_user_id AND tenant_id = p_tenant_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Target user not found in this tenant';
  END IF;

  -- Cannot change OWNER
  IF v_target_role = 'OWNER' THEN
    RAISE EXCEPTION 'Cannot change OWNER role';
  END IF;

  -- ADMIN cannot change another ADMIN
  IF v_caller_role = 'ADMIN' AND v_target_role = 'ADMIN' THEN
    RAISE EXCEPTION 'ADMIN cannot change another ADMIN';
  END IF;

  -- Set caller context for triggers + apply changes
  PERFORM set_config('app.caller_user_id', p_caller_id::text, true);

  UPDATE public.tenant_memberships SET role = p_new_role
  WHERE user_id = p_target_user_id AND tenant_id = p_tenant_id;

  UPDATE public.users SET role = p_new_role WHERE id = p_target_user_id;

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', p_new_role)
  WHERE id = p_target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════
-- 7. Seed-only RPC: promote a user to OWNER
--    Sets bypass flag so triggers allow OWNER changes.
--    Only callable via service_role (no authenticated access).
-- ═══════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.seed_set_owner(
  p_user_id UUID,
  p_tenant_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- Set bypass flag within this transaction
  PERFORM set_config('app.allow_owner_creation', 'true', true);

  UPDATE public.users SET role = 'OWNER' WHERE id = p_user_id;

  INSERT INTO public.tenant_memberships (user_id, tenant_id, role, is_active)
  VALUES (p_user_id, p_tenant_id, 'OWNER', true)
  ON CONFLICT (user_id, tenant_id)
  DO UPDATE SET role = 'OWNER', is_active = true;

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'OWNER', 'tenant_id', p_tenant_id::text)
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Block authenticated users from calling seed_set_owner
REVOKE ALL ON FUNCTION public.seed_set_owner(UUID, UUID) FROM authenticated;
REVOKE ALL ON FUNCTION public.seed_set_owner(UUID, UUID) FROM anon;
