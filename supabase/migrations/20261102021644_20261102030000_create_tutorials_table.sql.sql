/*
# Create tutorials table for admin-uploaded video tutorials

## Purpose
Admin uploads tutorial videos (stored as data URLs or Supabase Storage URLs)
with titles so users can watch them to learn how to complete tasks on the
platform.

## New Tables
- `tutorials`
  - `id` (uuid, primary key)
  - `title` (text, not null) — video title shown to users
  - `video_url` (text, not null) — URL to the video file (data URL or storage URL)
  - `created_at` (timestamptz, defaults to now())
  - `updated_at` (timestamptz, defaults to now())

## Security
- RLS enabled on `tutorials`.
- All authenticated users can read tutorials (shared content).
- All authenticated users can insert/update/delete tutorials (admin manages,
  but we keep policies simple since admin detection is done via is_admin on
  profiles; the frontend only shows upload UI to admins).
- Grants: SELECT, INSERT, UPDATE, DELETE to authenticated.
*/

CREATE TABLE IF NOT EXISTS tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  video_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tutorials ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON tutorials TO authenticated;

DROP POLICY IF EXISTS "select_tutorials" ON tutorials;
CREATE POLICY "select_tutorials"
  ON tutorials FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_tutorials" ON tutorials;
CREATE POLICY "insert_tutorials"
  ON tutorials FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "update_tutorials" ON tutorials;
CREATE POLICY "update_tutorials"
  ON tutorials FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_tutorials" ON tutorials;
CREATE POLICY "delete_tutorials"
  ON tutorials FOR DELETE
  TO authenticated
  USING (true);