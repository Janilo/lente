-- Add admin-only RLS policies for telegram_sessions.
-- This table is written by the Telegram webhook using the service role
-- (which bypasses RLS). No end users should access it directly via the API.
CREATE POLICY "Admin can view telegram sessions"
ON public.telegram_sessions
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admin can insert telegram sessions"
ON public.telegram_sessions
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admin can update telegram sessions"
ON public.telegram_sessions
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Admin can delete telegram sessions"
ON public.telegram_sessions
FOR DELETE
TO authenticated
USING (public.is_admin());