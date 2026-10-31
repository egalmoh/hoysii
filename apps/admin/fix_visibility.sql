-- =========================================================
-- Run this in Supabase SQL Editor to Fix Visibility
-- =========================================================

-- 1. Enable RLS on public.users (good practice, making sure it's defined)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. Create Policy to allow 'authenticated' users (like the admin) to READ user data
-- dropping first to avoid conflicts
DROP POLICY IF EXISTS "Enable read access for all" ON public.users;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.users;

CREATE POLICY "Allow read access for authenticated users"
ON public.users FOR SELECT
TO authenticated
USING (true);

-- 3. BACKFILL script: Copy ALL existing Auth users to public.users
-- This fixes the issue where users created BEFORE the trigger was added were missing.
INSERT INTO public.users (id, email, full_name, role)
SELECT
    id,
    email,
    raw_user_meta_data->>'full_name',
    'user'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 4. Verify count
SELECT count(*) as "Public Users Count" FROM public.users;
