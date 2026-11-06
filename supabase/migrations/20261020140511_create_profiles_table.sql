/*
# Create profiles table for authenticated users

1. New Tables
- `profiles`
  - `id` (uuid, primary key) — matches the user's auth.users id
  - `full_name` (text, not null) — the user's display name collected at signup
  - `email` (text, not null) — the user's email (mirror of auth.users email for convenience)
  - `created_at` (timestamptz, default now())

2. Security
- Row Level Security ENABLED on `profiles`.
- Each authenticated user can read and update only their own profile row (matched by auth.uid() = id).
- INSERT is allowed so a new user can create their own profile row right after signup.

3. Notes
- This app requires sign-in, so policies are scoped to `authenticated` only.
- Email confirmation stays OFF (Supabase default), so signup immediately yields a session.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);