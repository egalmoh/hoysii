-- ==========================================
-- Run this script in your Supabase SQL Editor
-- ==========================================

-- 1. Make clerk_id optional since we are taking users from Supabase Auth
ALTER TABLE public.users ALTER COLUMN clerk_id DROP NOT NULL;

-- 2. Create a function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, phone_number, role)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    'user' -- default role
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    phone_number = COALESCE(EXCLUDED.phone_number, public.users.phone_number);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger on auth.users
-- Drop if exists to avoid errors on potential re-runs
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Grant permissions to ensure the app can read the users
GRANT SELECT, INSERT, UPDATE ON TABLE public.users TO service_role;
GRANT SELECT ON TABLE public.users TO anon;
GRANT SELECT ON TABLE public.users TO authenticated;
