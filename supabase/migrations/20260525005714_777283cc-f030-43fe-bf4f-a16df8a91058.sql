
-- 1. Drop duplicate storage policies
DROP POLICY IF EXISTS "Respondent reads own interview videos" ON storage.objects;
DROP POLICY IF EXISTS "Respondent uploads own interview videos" ON storage.objects;
DROP POLICY IF EXISTS "Study owner reads interview videos" ON storage.objects;

-- 2. Add DELETE policy on interview-videos bucket (respondent or study owner)
CREATE POLICY "Respondent or owner can delete interview videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'interview-videos'
  AND (
    EXISTS (
      SELECT 1 FROM interviews i
      WHERE (i.id)::text = (storage.foldername(objects.name))[1]
        AND i.respondent_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM interviews i
      JOIN studies s ON s.id = i.study_id
      WHERE (i.id)::text = (storage.foldername(objects.name))[1]
        AND s.owner_id = auth.uid()
    )
  )
);

-- 3. Remove public exposure of studies; server functions use service role to serve safe fields
DROP POLICY IF EXISTS "Anyone can view published studies by slug" ON public.studies;
