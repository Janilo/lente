-- 1) Attach protect_can_publish trigger to prevent self-escalation
DROP TRIGGER IF EXISTS profiles_protect_can_publish ON public.profiles;
CREATE TRIGGER profiles_protect_can_publish
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_can_publish();

-- 2) Restrict interview inserts to published studies
DROP POLICY IF EXISTS "Respondent can insert own interview" ON public.interviews;
CREATE POLICY "Respondent can insert own interview"
ON public.interviews
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = respondent_id
  AND EXISTS (
    SELECT 1 FROM public.studies s
    WHERE s.id = interviews.study_id
      AND s.status = 'published'::study_status
  )
);