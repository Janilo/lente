CREATE TABLE public.compensation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  respondent_id uuid NOT NULL,
  study_id uuid,
  interview_id uuid,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BRL',
  method text NOT NULL DEFAULT 'pix',
  status text NOT NULL DEFAULT 'pending',
  reference text,
  receipt_url text,
  notes text,
  paid_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compensation_log TO authenticated;
GRANT ALL ON public.compensation_log TO service_role;

CREATE INDEX idx_compensation_log_respondent ON public.compensation_log(respondent_id);
CREATE INDEX idx_compensation_log_study ON public.compensation_log(study_id);
CREATE INDEX idx_compensation_log_status ON public.compensation_log(status);
CREATE INDEX idx_compensation_log_created_at ON public.compensation_log(created_at DESC);

ALTER TABLE public.compensation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view all compensation"
  ON public.compensation_log FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "Admin can insert compensation"
  ON public.compensation_log FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admin can update compensation"
  ON public.compensation_log FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Admin can delete compensation"
  ON public.compensation_log FOR DELETE TO authenticated
  USING (is_admin());

CREATE POLICY "Respondent views own compensation"
  ON public.compensation_log FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.respondent_profile rp
    WHERE rp.id = compensation_log.respondent_id AND rp.user_id = auth.uid()
  ));

CREATE POLICY "Study owner views study compensation"
  ON public.compensation_log FOR SELECT TO authenticated
  USING (study_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.studies s
    WHERE s.id = compensation_log.study_id AND s.owner_id = auth.uid()
  ));

CREATE TRIGGER trg_compensation_log_updated_at
  BEFORE UPDATE ON public.compensation_log
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();