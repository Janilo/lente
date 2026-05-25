
CREATE TYPE public.screener_question_type AS ENUM ('single_choice', 'multi_choice', 'short_text');

CREATE TABLE public.screener_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  study_id uuid NOT NULL,
  position integer NOT NULL,
  text text NOT NULL,
  type public.screener_question_type NOT NULL DEFAULT 'single_choice',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  qualifies boolean NOT NULL DEFAULT false,
  qualifying_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_screener_questions_study ON public.screener_questions(study_id, position);

ALTER TABLE public.screener_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage screener questions"
ON public.screener_questions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.studies s WHERE s.id = screener_questions.study_id AND s.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.studies s WHERE s.id = screener_questions.study_id AND s.owner_id = auth.uid()));

CREATE POLICY "View screener of published studies"
ON public.screener_questions FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.studies s WHERE s.id = screener_questions.study_id AND s.status = 'published'));

CREATE TRIGGER trg_screener_questions_updated
BEFORE UPDATE ON public.screener_questions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.screener_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  study_id uuid NOT NULL,
  user_id uuid NOT NULL,
  responses jsonb NOT NULL DEFAULT '[]'::jsonb,
  qualified boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (study_id, user_id)
);

CREATE INDEX idx_screener_submissions_study ON public.screener_submissions(study_id);

ALTER TABLE public.screener_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Respondent can insert own submission"
ON public.screener_submissions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Respondent can view own submission"
ON public.screener_submissions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Study owner can view submissions"
ON public.screener_submissions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.studies s WHERE s.id = screener_submissions.study_id AND s.owner_id = auth.uid()));
