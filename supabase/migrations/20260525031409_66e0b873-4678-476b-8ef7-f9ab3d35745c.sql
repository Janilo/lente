
-- Consents table for LGPD compliance
CREATE TABLE public.consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL,
  user_id uuid NOT NULL,
  study_id uuid NOT NULL,
  consent_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (interview_id, user_id)
);

ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Respondent can insert own consent"
  ON public.consents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Respondent can view own consents"
  ON public.consents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Study owner can view consents"
  ON public.consents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.studies s WHERE s.id = consents.study_id AND s.owner_id = auth.uid()));

-- Quality scoring columns on answers
ALTER TABLE public.answers
  ADD COLUMN IF NOT EXISTS quality_score integer,
  ADD COLUMN IF NOT EXISTS quality_reasoning text;

ALTER TABLE public.answers
  ADD CONSTRAINT answers_quality_score_range CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100));

-- Allow respondent and study owner to delete answers (LGPD right to erasure)
CREATE POLICY "Respondent can delete own answers"
  ON public.answers FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.interviews i WHERE i.id = answers.interview_id AND i.respondent_id = auth.uid()));

CREATE POLICY "Study owner can delete answers"
  ON public.answers FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.interviews i JOIN public.studies s ON s.id = i.study_id WHERE i.id = answers.interview_id AND s.owner_id = auth.uid()));

CREATE POLICY "Respondent can delete own interview"
  ON public.interviews FOR DELETE TO authenticated
  USING (auth.uid() = respondent_id);

CREATE POLICY "Study owner can delete interviews"
  ON public.interviews FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.studies s WHERE s.id = interviews.study_id AND s.owner_id = auth.uid()));

-- Cascade delete function for LGPD right to erasure
CREATE OR REPLACE FUNCTION public.delete_respondent_data(p_interview_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_respondent uuid;
  v_owner uuid;
BEGIN
  SELECT i.respondent_id, s.owner_id
    INTO v_respondent, v_owner
    FROM interviews i
    JOIN studies s ON s.id = i.study_id
   WHERE i.id = p_interview_id;

  IF v_respondent IS NULL THEN
    RAISE EXCEPTION 'Entrevista não encontrada';
  END IF;

  IF auth.uid() <> v_respondent AND auth.uid() <> v_owner THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  DELETE FROM public.answers WHERE interview_id = p_interview_id;
  DELETE FROM public.consents WHERE interview_id = p_interview_id;
  DELETE FROM public.interviews WHERE id = p_interview_id;
END;
$$;
