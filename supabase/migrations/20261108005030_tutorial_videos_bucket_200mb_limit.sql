/*
# Raise tutorial video upload limit to 200 MB

## Summary
The tutorial video storage bucket previously accepted files up to 50 MB. This
migration raises the per-file limit for that bucket to 200 MB so admins can
upload longer tutorial videos.

## Changes
1. Storage bucket `tutorial-videos`
   - Per-file size limit changed from 50 MB to 200 MB.

## Security
- No changes to who can read or upload videos. Admin-only write rules stay as they were.

## Notes
- The project-wide storage limit set in the Supabase dashboard must also be at least 200 MB, otherwise larger uploads are still rejected.
*/

UPDATE storage.buckets
SET file_size_limit = 209715200
WHERE id = 'tutorial-videos';
