
-- 1) interviews: source + external_respondent
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS external_respondent jsonb;

ALTER TABLE public.interviews
  DROP CONSTRAINT IF EXISTS interviews_source_check;
ALTER TABLE public.interviews
  ADD CONSTRAINT interviews_source_check CHECK (source IN ('live','upload'));

-- 2) answers: faixa de tempo no vídeo (segmentação por IA)
ALTER TABLE public.answers
  ADD COLUMN IF NOT EXISTS start_seconds numeric,
  ADD COLUMN IF NOT EXISTS end_seconds numeric;

-- 3) interview_insights: 1-para-1 com interview
CREATE TABLE IF NOT EXISTS public.interview_insights (
  interview_id uuid PRIMARY KEY REFERENCES public.interviews(id) ON DELETE CASCADE,
  quality text,
  segments text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  bullet_summary text[] NOT NULL DEFAULT '{}',
  tagline text,
  answer_summaries jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.interview_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Study owner can view insights" ON public.interview_insights;
CREATE POLICY "Study owner can view insights"
ON public.interview_insights FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.interviews i
  JOIN public.studies s ON s.id = i.study_id
  WHERE i.id = interview_insights.interview_id AND s.owner_id = auth.uid()
));

DROP POLICY IF EXISTS "Study owner manages insights" ON public.interview_insights;
CREATE POLICY "Study owner manages insights"
ON public.interview_insights FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.interviews i
  JOIN public.studies s ON s.id = i.study_id
  WHERE i.id = interview_insights.interview_id AND s.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.interviews i
  JOIN public.studies s ON s.id = i.study_id
  WHERE i.id = interview_insights.interview_id AND s.owner_id = auth.uid()
));

CREATE TRIGGER set_interview_insights_updated_at
BEFORE UPDATE ON public.interview_insights
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Storage: permitir dono do estudo ler/inserir vídeos no bucket interview-videos
-- path: {interview_id}/...
DROP POLICY IF EXISTS "Study owner can read interview videos" ON storage.objects;
CREATE POLICY "Study owner can read interview videos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'interview-videos'
  AND EXISTS (
    SELECT 1 FROM public.interviews i
    JOIN public.studies s ON s.id = i.study_id
    WHERE i.id::text = (storage.foldername(name))[1]
      AND s.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Study owner can upload interview videos" ON storage.objects;
CREATE POLICY "Study owner can upload interview videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'interview-videos'
  AND EXISTS (
    SELECT 1 FROM public.interviews i
    JOIN public.studies s ON s.id = i.study_id
    WHERE i.id::text = (storage.foldername(name))[1]
      AND s.owner_id = auth.uid()
  )
);
