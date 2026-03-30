-- =====================================================
-- Fix user roles in public.users + tenant_memberships + auth
-- Run this in Supabase SQL Editor
-- =====================================================

-- Enable bypass for OWNER changes
SET LOCAL app.allow_owner_creation = 'true';

-- Fix owner@beechage.com → OWNER
UPDATE public.users SET role = 'OWNER'
WHERE email = 'owner@beechage.com';

UPDATE public.tenant_memberships SET role = 'OWNER'
WHERE user_id = (SELECT id FROM public.users WHERE email = 'owner@beechage.com');

UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
  || '{"role": "OWNER"}'::jsonb
WHERE email = 'owner@beechage.com';

-- Fix admin@beechage.com → ADMIN (if exists)
UPDATE public.users SET role = 'ADMIN'
WHERE email = 'admin@beechage.com';

UPDATE public.tenant_memberships SET role = 'ADMIN'
WHERE user_id = (SELECT id FROM public.users WHERE email = 'admin@beechage.com');

UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
  || '{"role": "ADMIN"}'::jsonb
WHERE email = 'admin@beechage.com';

-- Verify the fix
SELECT u.email, u.role AS users_role, tm.role AS membership_role,
       au.raw_app_meta_data->>'role' AS jwt_role
FROM public.users u
LEFT JOIN public.tenant_memberships tm ON tm.user_id = u.id
LEFT JOIN auth.users au ON au.id = u.id
ORDER BY u."createdAt";
