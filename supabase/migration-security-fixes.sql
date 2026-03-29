-- =====================================================
-- BeecHage: Security Audit Fixes
-- Run AFTER migration-role-security.sql
-- Fixes V1 (RPC caller spoofing), V2 (membership RLS),
-- V3 (guard trigger default-allow)
-- =====================================================

-- ═══════════════════════════════════════════════════════
-- FIX V1: Lock down safe_update_member_role
-- Revoke from authenticated + validate auth.uid() inside
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
  v_auth_uid UUID;
BEGIN
  -- SECURITY: verify caller identity
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NOT NULL AND v_auth_uid <> p_caller_id THEN
    RAISE EXCEPTION 'SECURITY_VIOLATION: caller_id does not match authenticated user';
  END IF;

  IF p_new_role NOT IN ('ADMIN', 'RECEPTION', 'LAUNDRY') THEN
    RAISE EXCEPTION 'Invalid role: %', p_new_role;
  END IF;

  IF p_caller_id = p_target_user_id THEN
    RAISE EXCEPTION 'Cannot change your own role';
  END IF;

  SELECT role INTO v_caller_role
  FROM public.tenant_memberships
  WHERE user_id = p_caller_id AND tenant_id = p_tenant_id AND is_active = true;

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('OWNER', 'ADMIN') THEN
    RAISE EXCEPTION 'Only OWNER or ADMIN can change user roles';
  END IF;

  IF v_caller_role = 'ADMIN' AND p_new_role = 'ADMIN' THEN
    RAISE EXCEPTION 'ROLE_ESCALATION_BLOCKED: ADMIN cannot assign ADMIN role';
  END IF;

  SELECT role INTO v_target_role
  FROM public.tenant_memberships
  WHERE user_id = p_target_user_id AND tenant_id = p_tenant_id;

  IF v_target_role IS NULL THEN
    RAISE EXCEPTION 'Target user not found in this tenant';
  END IF;

  IF v_target_role = 'OWNER' THEN
    RAISE EXCEPTION 'Cannot change OWNER role';
  END IF;

  IF v_caller_role = 'ADMIN' AND v_target_role = 'ADMIN' THEN
    RAISE EXCEPTION 'ADMIN cannot change another ADMIN';
  END IF;

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

-- Revoke direct access (CREATE OR REPLACE resets grants)
REVOKE ALL ON FUNCTION public.safe_update_member_role(UUID, UUID, UUID, TEXT)
  FROM authenticated;
REVOKE ALL ON FUNCTION public.safe_update_member_role(UUID, UUID, UUID, TEXT)
  FROM anon;

-- ═══════════════════════════════════════════════════════
-- FIX V2: tenant_memberships — SELECT only for authenticated
-- ═══════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Tenant isolation" ON public.tenant_memberships;

CREATE POLICY "Tenant members read"
  ON public.tenant_memberships
  FOR SELECT TO authenticated
  USING (tenant_id = public.requesting_tenant_id());

DROP POLICY IF EXISTS "Service role full memberships" ON public.tenant_memberships;
CREATE POLICY "Service role full memberships"
  ON public.tenant_memberships
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════
-- FIX V3: guard_membership_update — DENY when no caller context
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

  IF (NEW.role = 'OWNER' OR OLD.role = 'OWNER') AND NOT v_bypass THEN
    RAISE EXCEPTION 'ROLE_ESCALATION_BLOCKED: OWNER role changes require elevated access';
  END IF;

  IF v_bypass THEN RETURN NEW; END IF;

  BEGIN
    v_caller_id := current_setting('app.caller_user_id', true)::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_caller_id := NULL;
  END;

  -- DENY when no caller context (was: allow — security hole)
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'ROLE_ESCALATION_BLOCKED: no caller context — unauthorized role change';
  END IF;

  SELECT role INTO v_caller_role
  FROM public.tenant_memberships
  WHERE user_id = v_caller_id AND tenant_id = NEW.tenant_id AND is_active = true;

  IF v_caller_role IS NULL THEN
    RAISE EXCEPTION 'ROLE_ESCALATION_BLOCKED: caller has no active membership';
  END IF;

  IF public.role_rank(NEW.role) >= public.role_rank(v_caller_role) THEN
    RAISE EXCEPTION 'ROLE_ESCALATION_BLOCKED: % cannot assign role %', v_caller_role, NEW.role;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
