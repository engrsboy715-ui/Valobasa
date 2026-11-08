/*
# Store tutorial videos in Supabase Storage

## Summary
Tutorial videos were being saved as long text strings inside the tutorials table,
which made publishing slow enough to hit the database statement timeout and made
every tutorial list load download every video. Videos now live in a dedicated
storage bucket and the table only keeps a link to each file.

## Changes
1. New storage bucket `tutorial-videos`
   - Public read, so video links play directly in the app.
   - Maximum file size 50 MB per video.
2. Storage write rules
   - Only admins (profiles.is_admin = true) can upload, replace, or delete videos.
3. Tutorials table
   - New nullable column `storage_path` storing the file's location in the bucket,
     used to remove the file when a tutorial is deleted.
   - Index on `created_at` so the list loads in newest-first order quickly.

## Security
- Anonymous visitors can view videos through the bucket's public link only.
- Non-admin signed-in users cannot write to the bucket.

## Notes
- Existing tutorial rows are unaffected; the table was empty when this migration was written.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('tutorial-videos', 'tutorial-videos', true, 52428800)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "admin_insert_tutorial_videos" ON storage.objects;
CREATE POLICY "admin_insert_tutorial_videos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tutorial-videos'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  );

DROP POLICY IF EXISTS "admin_update_tutorial_videos" ON storage.objects;
CREATE POLICY "admin_update_tutorial_videos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'tutorial-videos'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  )
  WITH CHECK (
    bucket_id = 'tutorial-videos'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  );

DROP POLICY IF EXISTS "admin_delete_tutorial_videos" ON storage.objects;
CREATE POLICY "admin_delete_tutorial_videos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'tutorial-videos'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  );

ALTER TABLE tutorials ADD COLUMN IF NOT EXISTS storage_path text;

CREATE INDEX IF NOT EXISTS tutorials_created_at_idx ON tutorials (created_at DESC);
