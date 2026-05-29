
-- 1. respondent_profile ------------------------------------------------------
CREATE TABLE public.respondent_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text,
  email text,
  phone text,
  city text,
  state text,
  country text NOT NULL DEFAULT 'BR',
  age_range text,
  gender text,
  education text,
  income_range text,
  occupation text,
  company text,
  company_size text,
  linkedin_url text,
  source text,
  notes text,
  consent_marketing boolean NOT NULL DEFAULT false,
  consent_research boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_respondent_profile_user_id ON public.respondent_profile(user_id);
CREATE INDEX idx_respondent_profile_active ON public.respondent_profile(active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.respondent_profile TO authenticated;
GRANT ALL ON public.respondent_profile TO service_role;

ALTER TABLE public.respondent_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Respondent can view own profile"
  ON public.respondent_profile FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Researcher can view all respondent profiles"
  ON public.respondent_profile FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'researcher'));

CREATE POLICY "Admin can view all respondent profiles"
  ON public.respondent_profile FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Respondent can insert own profile"
  ON public.respondent_profile FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can insert any respondent profile"
  ON public.respondent_profile FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Respondent can update own profile"
  ON public.respondent_profile FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can update any respondent profile"
  ON public.respondent_profile FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin can delete respondent profile"
  ON public.respondent_profile FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE TRIGGER trg_respondent_profile_updated_at
  BEFORE UPDATE ON public.respondent_profile
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. tag_dimensions ---------------------------------------------------------
CREATE TABLE public.tag_dimensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tag_dimensions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tag_dimensions TO authenticated;
GRANT ALL ON public.tag_dimensions TO service_role;

ALTER TABLE public.tag_dimensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read dimensions"
  ON public.tag_dimensions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert dimensions"
  ON public.tag_dimensions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin can update dimensions"
  ON public.tag_dimensions FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin can delete dimensions"
  ON public.tag_dimensions FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE TRIGGER trg_tag_dimensions_updated_at
  BEFORE UPDATE ON public.tag_dimensions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. tag_values -------------------------------------------------------------
CREATE TABLE public.tag_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension_id uuid NOT NULL REFERENCES public.tag_dimensions(id) ON DELETE CASCADE,
  slug text NOT NULL,
  label text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dimension_id, slug)
);

CREATE INDEX idx_tag_values_dimension ON public.tag_values(dimension_id);

GRANT SELECT ON public.tag_values TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tag_values TO authenticated;
GRANT ALL ON public.tag_values TO service_role;

ALTER TABLE public.tag_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read tag values"
  ON public.tag_values FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can insert tag values"
  ON public.tag_values FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin can update tag values"
  ON public.tag_values FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admin can delete tag values"
  ON public.tag_values FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE TRIGGER trg_tag_values_updated_at
  BEFORE UPDATE ON public.tag_values
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. respondent_tags --------------------------------------------------------
CREATE TABLE public.respondent_tags (
  respondent_id uuid NOT NULL REFERENCES public.respondent_profile(id) ON DELETE CASCADE,
  tag_value_id uuid NOT NULL REFERENCES public.tag_values(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid,
  PRIMARY KEY (respondent_id, tag_value_id)
);

CREATE INDEX idx_respondent_tags_tag_value ON public.respondent_tags(tag_value_id);

GRANT SELECT, INSERT, DELETE ON public.respondent_tags TO authenticated;
GRANT ALL ON public.respondent_tags TO service_role;

ALTER TABLE public.respondent_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Respondent can view own tags"
  ON public.respondent_tags FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.respondent_profile rp
    WHERE rp.id = respondent_tags.respondent_id AND rp.user_id = auth.uid()
  ));

CREATE POLICY "Researcher can view all respondent tags"
  ON public.respondent_tags FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'researcher'));

CREATE POLICY "Admin can view all respondent tags"
  ON public.respondent_tags FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admin can insert respondent tags"
  ON public.respondent_tags FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admin can delete respondent tags"
  ON public.respondent_tags FOR DELETE TO authenticated
  USING (public.is_admin());

-- 5. respondent_stats view --------------------------------------------------
CREATE VIEW public.respondent_stats
WITH (security_invoker = true)
AS
SELECT
  rp.id AS respondent_id,
  rp.user_id,
  COUNT(DISTINCT i.study_id) AS studies_count,
  COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'completed') AS completed_count,
  COUNT(DISTINCT i.id) AS interviews_count,
  MAX(i.finished_at) AS last_participation_at,
  AVG(a.quality_score)::numeric(4,2) AS avg_quality_score
FROM public.respondent_profile rp
LEFT JOIN public.interviews i ON i.respondent_id = rp.user_id
LEFT JOIN public.answers a ON a.interview_id = i.id
GROUP BY rp.id, rp.user_id;

GRANT SELECT ON public.respondent_stats TO authenticated;
GRANT SELECT ON public.respondent_stats TO service_role;

-- 6. Backfill: criar respondent_profile pra quem já participou -------------
INSERT INTO public.respondent_profile (
  user_id, full_name, city, state, age_range, occupation, source
)
SELECT DISTINCT
  i.respondent_id,
  p.full_name,
  p.city,
  p.state,
  p.age_range,
  p.occupation,
  'backfill'
FROM public.interviews i
LEFT JOIN public.profiles p ON p.id = i.respondent_id
WHERE i.respondent_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- 7. Seed das dimensões fixas ----------------------------------------------
INSERT INTO public.tag_dimensions (slug, label, description, position) VALUES
  ('setor',         'Setor',              'Setor de atuação da empresa do respondente',      1),
  ('funcao',        'Função',             'Área funcional / departamento',                    2),
  ('senioridade',   'Senioridade',        'Nível hierárquico',                                3),
  ('porte_empresa', 'Porte da empresa',   'Tamanho da empresa onde trabalha',                 4),
  ('papel_compra',  'Papel na compra',    'Influência no processo de decisão de compra B2B',  5)
ON CONFLICT (slug) DO NOTHING;
