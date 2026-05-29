CREATE TABLE public.study_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  study_id UUID NOT NULL,
  respondent_id UUID NOT NULL,
  invited_by UUID NOT NULL,
  channel TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'queued',
  message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT study_invitations_channel_check CHECK (channel IN ('manual','whatsapp','email','link')),
  CONSTRAINT study_invitations_status_check CHECK (status IN ('queued','sent','failed','accepted','declined')),
  CONSTRAINT study_invitations_unique UNIQUE (study_id, respondent_id)
);

CREATE INDEX idx_study_invitations_study ON public.study_invitations(study_id);
CREATE INDEX idx_study_invitations_respondent ON public.study_invitations(respondent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_invitations TO authenticated;
GRANT ALL ON public.study_invitations TO service_role;

ALTER TABLE public.study_invitations ENABLE ROW LEVEL SECURITY;

-- Admin manages all invitations
CREATE POLICY "Admin can view all invitations"
  ON public.study_invitations FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin can insert invitations"
  ON public.study_invitations FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin can update invitations"
  ON public.study_invitations FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin can delete invitations"
  ON public.study_invitations FOR DELETE TO authenticated
  USING (public.is_admin());

-- Study owners can also see invitations of their studies
CREATE POLICY "Study owner can view invitations"
  ON public.study_invitations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.studies s WHERE s.id = study_invitations.study_id AND s.owner_id = auth.uid()));

-- Respondents can see invitations addressed to them
CREATE POLICY "Respondent can view own invitations"
  ON public.study_invitations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.respondent_profile rp WHERE rp.id = study_invitations.respondent_id AND rp.user_id = auth.uid()));

CREATE TRIGGER set_updated_at_study_invitations
  BEFORE UPDATE ON public.study_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();