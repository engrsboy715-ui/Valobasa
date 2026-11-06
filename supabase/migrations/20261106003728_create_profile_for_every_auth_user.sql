/*
# Create a profile row for every auth account

1. Problem
- Profiles were created only from the browser right after sign-up. When that call ran
  without a session, it failed silently, leaving accounts with no profile row.
- Deposits reference profiles(id), so those users hit the deposits_user_id_fkey error.

2. Changes
- New function `handle_new_auth_user()` that inserts a profile row for each new auth user,
  using the name supplied at sign-up (falling back to the email prefix).
- New trigger `on_auth_user_created` on auth.users that runs the function after each insert.
- One-time backfill that creates profile rows for existing auth users that lack one.

3. Security
- The function is SECURITY DEFINER with a fixed search_path.
- EXECUTE is revoked from PUBLIC, anon and authenticated; only the trigger runs it.

4. Notes
- ON CONFLICT DO NOTHING keeps the migration safe to re-run and never overwrites existing profiles.
- The existing profile triggers (referral code, admin role) still run on each insert.
*/

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(COALESCE(NEW.email, ''), '@', 1)),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

INSERT INTO public.profiles (id, full_name, email)
SELECT
  u.id,
  COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), split_part(COALESCE(u.email, ''), '@', 1)),
  COALESCE(u.email, '')
FROM auth.users u
ON CONFLICT (id) DO NOTHING;
