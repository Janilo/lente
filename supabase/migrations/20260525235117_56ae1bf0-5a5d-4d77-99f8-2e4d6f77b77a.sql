
DROP POLICY "anyone can insert click events" ON public.cta_click_events;

CREATE POLICY "anyone can insert known cta clicks"
  ON public.cta_click_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    cta_id IN ('footer_respondents_signup')
    AND href LIKE 'https://%'
    AND length(href) <= 500
    AND (referrer IS NULL OR length(referrer) <= 1000)
    AND (user_agent IS NULL OR length(user_agent) <= 500)
  );
