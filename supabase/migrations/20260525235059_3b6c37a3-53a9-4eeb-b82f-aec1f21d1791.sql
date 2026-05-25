
CREATE TABLE public.cta_click_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cta_id TEXT NOT NULL,
  href TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cta_click_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can insert click events"
  ON public.cta_click_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "researchers can read click events"
  ON public.cta_click_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'researcher'));

CREATE INDEX cta_click_events_cta_id_created_at_idx
  ON public.cta_click_events (cta_id, created_at DESC);
