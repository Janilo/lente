
-- Admin helper function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND lower(email) = 'janilo@pereirasaraiva.com'
  );
$$;

-- App settings (single-row global config)
CREATE TABLE public.app_settings (
  id boolean PRIMARY KEY DEFAULT true,
  stt_provider text NOT NULL DEFAULT 'elevenlabs',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_settings_singleton CHECK (id = true),
  CONSTRAINT app_settings_stt_provider_valid CHECK (stt_provider IN ('elevenlabs','assemblyai'))
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read settings"
  ON public.app_settings FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin can insert settings"
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin can update settings"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

INSERT INTO public.app_settings (id, stt_provider) VALUES (true, 'elevenlabs');

-- can_publish + respondent profile fields
ALTER TABLE public.profiles
  ADD COLUMN can_publish boolean NOT NULL DEFAULT false,
  ADD COLUMN city text,
  ADD COLUMN state text,
  ADD COLUMN age_range text,
  ADD COLUMN occupation text,
  ADD COLUMN industry text,
  ADD COLUMN research_interests text[];

-- Allow admin to read & update all profiles (for user management)
CREATE POLICY "Admin can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin can update all profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Prevent non-admin users from setting their own profile.can_publish.
-- Enforced via trigger because column-level RLS is awkward for UPDATE.
CREATE OR REPLACE FUNCTION public.protect_can_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.can_publish IS DISTINCT FROM OLD.can_publish AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar can_publish';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_protect_can_publish
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_can_publish();

-- Restrict publishing studies to users with can_publish=true or admin
CREATE OR REPLACE FUNCTION public.enforce_study_publish_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can boolean;
BEGIN
  IF NEW.status = 'published'::study_status
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF public.is_admin() THEN
      RETURN NEW;
    END IF;
    SELECT can_publish INTO v_can FROM public.profiles WHERE id = auth.uid();
    IF COALESCE(v_can, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'Publicação não liberada para este usuário. Solicite ao administrador.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER studies_enforce_publish_permission
  BEFORE INSERT OR UPDATE ON public.studies
  FOR EACH ROW EXECUTE FUNCTION public.enforce_study_publish_permission();
