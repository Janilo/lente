-- ============================================================================
-- ESPELHO FIEL DA PRODUÇÃO (projeto Supabase nuolncddavudliabqsdx)
-- ============================================================================
-- A produção registra exatamente UMA migration ("20260628151355_lente_initial_schema",
-- criada quando o projeto foi recriado em 28/06/2026). Este arquivo usa a MESMA
-- version, então o CLI o considera já aplicado no remoto — ele NUNCA roda contra
-- a produção. Ele existe para `supabase start` / `db reset` reproduzirem o banco
-- real em stack local e no CI (job `rls`).
--
-- Conteúdo reconstruído do catálogo da produção (pg_catalog/pg_policies) em
-- 05/07/2026: tabelas, enums, funções, view, constraints, RLS, policies,
-- triggers, índices e o bucket de storage — na íntegra e sem edições.
-- Substitui as 18 migrations da era Lovable (24–29/05/2026), que descreviam o
-- projeto ANTERIOR (kropjhloiqsphnnhwyuv) e divergiam do banco atual.
--
-- Se a produção mudar, regenere este espelho e ajuste a suíte supabase/tests/.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensões (instaladas na produção; as demais são gerenciadas pela plataforma)
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('researcher', 'respondent');
create type public.study_status as enum ('draft', 'published', 'closed');
create type public.interview_status as enum ('in_progress', 'completed', 'abandoned');
create type public.answer_status as enum ('uploading', 'transcribing', 'ready', 'failed');
create type public.screener_question_type as enum ('single_choice', 'multi_choice', 'short_text');

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.answers (
  id uuid not null default gen_random_uuid(),
  interview_id uuid not null,
  question_id uuid,
  parent_answer_id uuid,
  is_followup boolean not null default false,
  question_text text not null,
  video_path text,
  duration_seconds numeric,
  transcript text,
  words_json jsonb,
  status answer_status not null default 'uploading'::answer_status,
  error_message text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  quality_score integer,
  quality_reasoning text,
  start_seconds numeric,
  end_seconds numeric
);

create table public.app_settings (
  id boolean not null default true,
  stt_provider text not null default 'elevenlabs'::text,
  updated_at timestamp with time zone not null default now()
);

create table public.compensation_log (
  id uuid not null default gen_random_uuid(),
  respondent_id uuid not null,
  study_id uuid,
  interview_id uuid,
  amount numeric(12,2) not null,
  currency text not null default 'BRL'::text,
  method text not null default 'pix'::text,
  status text not null default 'pending'::text,
  reference text,
  receipt_url text,
  notes text,
  paid_at timestamp with time zone,
  created_by uuid not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.consents (
  id uuid not null default gen_random_uuid(),
  interview_id uuid not null,
  user_id uuid not null,
  study_id uuid not null,
  consent_version text not null,
  accepted_at timestamp with time zone not null default now(),
  ip_address text,
  user_agent text,
  created_at timestamp with time zone not null default now()
);

create table public.cta_click_events (
  id uuid not null default gen_random_uuid(),
  cta_id text not null,
  href text not null,
  referrer text,
  user_agent text,
  created_at timestamp with time zone not null default now()
);

create table public.insights (
  id uuid not null default gen_random_uuid(),
  study_id uuid not null,
  theme text not null,
  summary text not null,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone not null default now()
);

create table public.interview_insights (
  interview_id uuid not null,
  quality text,
  segments text[] not null default '{}'::text[],
  tags text[] not null default '{}'::text[],
  bullet_summary text[] not null default '{}'::text[],
  tagline text,
  answer_summaries jsonb not null default '[]'::jsonb,
  model text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.interviews (
  id uuid not null default gen_random_uuid(),
  study_id uuid not null,
  respondent_id uuid,
  status interview_status not null default 'in_progress'::interview_status,
  started_at timestamp with time zone not null default now(),
  finished_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  source text not null default 'live'::text,
  external_respondent jsonb
);

create table public.profiles (
  id uuid not null,
  full_name text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  can_publish boolean not null default false,
  city text,
  state text,
  age_range text,
  occupation text,
  industry text,
  research_interests text[]
);

create table public.questions (
  id uuid not null default gen_random_uuid(),
  study_id uuid not null,
  "position" integer not null,
  text text not null,
  intent text,
  created_at timestamp with time zone not null default now()
);

create table public.recommendations (
  id uuid not null default gen_random_uuid(),
  study_id uuid not null,
  title text not null,
  rationale text not null,
  supporting_insight_ids uuid[] not null default '{}'::uuid[],
  priority integer,
  created_at timestamp with time zone not null default now()
);

create table public.respondent_profile (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  full_name text,
  email text,
  phone text,
  city text,
  state text,
  country text not null default 'BR'::text,
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
  consent_marketing boolean not null default false,
  consent_research boolean not null default true,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.respondent_tags (
  respondent_id uuid not null,
  tag_value_id uuid not null,
  assigned_at timestamp with time zone not null default now(),
  assigned_by uuid
);

create table public.screener_questions (
  id uuid not null default gen_random_uuid(),
  study_id uuid not null,
  "position" integer not null,
  text text not null,
  type screener_question_type not null default 'single_choice'::screener_question_type,
  options jsonb not null default '[]'::jsonb,
  qualifies boolean not null default false,
  qualifying_options jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.screener_submissions (
  id uuid not null default gen_random_uuid(),
  study_id uuid not null,
  user_id uuid not null,
  responses jsonb not null default '[]'::jsonb,
  qualified boolean not null,
  created_at timestamp with time zone not null default now()
);

create table public.studies (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  title text not null,
  business_goal text,
  context text,
  target_audience text,
  status study_status not null default 'draft'::study_status,
  public_slug text not null default lower(replace((gen_random_uuid())::text, '-'::text, ''::text)),
  max_followups integer not null default 2,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.study_invitations (
  id uuid not null default gen_random_uuid(),
  study_id uuid not null,
  respondent_id uuid not null,
  invited_by uuid not null,
  channel text not null default 'manual'::text,
  status text not null default 'queued'::text,
  message text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.tag_dimensions (
  id uuid not null default gen_random_uuid(),
  slug text not null,
  label text not null,
  description text,
  "position" integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.tag_values (
  id uuid not null default gen_random_uuid(),
  dimension_id uuid not null,
  slug text not null,
  label text not null,
  "position" integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.telegram_sessions (
  chat_id bigint not null,
  user_id uuid,
  interview_id uuid,
  study_id uuid,
  state text not null default 'idle'::text,
  pending_question_id uuid,
  pending_is_followup boolean not null default false,
  pending_parent_answer_id uuid,
  pending_question_text text,
  telegram_username text,
  telegram_first_name text,
  awaiting_consent boolean not null default false,
  last_update_id bigint,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.user_roles (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  created_at timestamp with time zone not null default now()
);

-- ---------------------------------------------------------------------------
-- View (security_invoker: respeita a RLS das tabelas de quem consulta)
-- ---------------------------------------------------------------------------
create view public.respondent_stats with (security_invoker = true) as
select
  rp.id as respondent_id,
  rp.user_id,
  count(distinct i.study_id) as studies_count,
  count(distinct i.id) filter (where i.status = 'completed'::interview_status) as completed_count,
  count(distinct i.id) as interviews_count,
  max(i.finished_at) as last_participation_at,
  avg(a.quality_score)::numeric(4,2) as avg_quality_score
from respondent_profile rp
  left join interviews i on i.respondent_id = rp.user_id
  left join answers a on a.interview_id = i.id
group by rp.id, rp.user_id;

-- ---------------------------------------------------------------------------
-- Funções
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$ begin new.updated_at = now(); return new; end; $function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND lower(email) = 'janilo@pereirasaraiva.com'
  );
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$function$;

-- ATENÇÃO (achado da auditoria, comportamento REAL da produção): todo usuário
-- novo — inclusive respondente que se cadastra sozinho — recebe a role
-- 'researcher'. Combinado com a policy "Researcher can view all respondent
-- profiles", qualquer conta recém-criada lê a tabela inteira de PII de
-- respondentes. A suíte supabase/tests/ prova esse comportamento.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  insert into public.user_roles (user_id, role)
  values (new.id, 'researcher')
  on conflict do nothing;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.protect_can_publish()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.can_publish IS DISTINCT FROM OLD.can_publish AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar can_publish';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_study_publish_permission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.delete_respondent_data(p_interview_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- ---------------------------------------------------------------------------
-- Constraints (PK → unique → check → FK, como na produção)
-- ---------------------------------------------------------------------------
alter table public.answers add constraint answers_pkey PRIMARY KEY (id);
alter table public.app_settings add constraint app_settings_pkey PRIMARY KEY (id);
alter table public.compensation_log add constraint compensation_log_pkey PRIMARY KEY (id);
alter table public.consents add constraint consents_pkey PRIMARY KEY (id);
alter table public.cta_click_events add constraint cta_click_events_pkey PRIMARY KEY (id);
alter table public.insights add constraint insights_pkey PRIMARY KEY (id);
alter table public.interview_insights add constraint interview_insights_pkey PRIMARY KEY (interview_id);
alter table public.interviews add constraint interviews_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.questions add constraint questions_pkey PRIMARY KEY (id);
alter table public.recommendations add constraint recommendations_pkey PRIMARY KEY (id);
alter table public.respondent_profile add constraint respondent_profile_pkey PRIMARY KEY (id);
alter table public.respondent_tags add constraint respondent_tags_pkey PRIMARY KEY (respondent_id, tag_value_id);
alter table public.screener_questions add constraint screener_questions_pkey PRIMARY KEY (id);
alter table public.screener_submissions add constraint screener_submissions_pkey PRIMARY KEY (id);
alter table public.studies add constraint studies_pkey PRIMARY KEY (id);
alter table public.study_invitations add constraint study_invitations_pkey PRIMARY KEY (id);
alter table public.tag_dimensions add constraint tag_dimensions_pkey PRIMARY KEY (id);
alter table public.tag_values add constraint tag_values_pkey PRIMARY KEY (id);
alter table public.telegram_sessions add constraint telegram_sessions_pkey PRIMARY KEY (chat_id);
alter table public.user_roles add constraint user_roles_pkey PRIMARY KEY (id);

alter table public.consents add constraint consents_interview_id_user_id_key UNIQUE (interview_id, user_id);
alter table public.respondent_profile add constraint respondent_profile_user_id_key UNIQUE (user_id);
alter table public.screener_submissions add constraint screener_submissions_study_id_user_id_key UNIQUE (study_id, user_id);
alter table public.studies add constraint studies_public_slug_key UNIQUE (public_slug);
alter table public.study_invitations add constraint study_invitations_unique UNIQUE (study_id, respondent_id);
alter table public.tag_dimensions add constraint tag_dimensions_slug_key UNIQUE (slug);
alter table public.tag_values add constraint tag_values_dimension_id_slug_key UNIQUE (dimension_id, slug);
alter table public.user_roles add constraint user_roles_user_id_role_key UNIQUE (user_id, role);

alter table public.answers add constraint answers_quality_score_range CHECK (((quality_score IS NULL) OR ((quality_score >= 0) AND (quality_score <= 100))));
alter table public.app_settings add constraint app_settings_singleton CHECK ((id = true));
alter table public.app_settings add constraint app_settings_stt_provider_valid CHECK ((stt_provider = ANY (ARRAY['elevenlabs'::text, 'assemblyai'::text])));
alter table public.interviews add constraint interviews_source_check CHECK ((source = ANY (ARRAY['live'::text, 'upload'::text])));
alter table public.study_invitations add constraint study_invitations_channel_check CHECK ((channel = ANY (ARRAY['manual'::text, 'whatsapp'::text, 'email'::text, 'link'::text])));
alter table public.study_invitations add constraint study_invitations_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'failed'::text, 'accepted'::text, 'declined'::text])));

alter table public.answers add constraint answers_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE;
alter table public.answers add constraint answers_parent_answer_id_fkey FOREIGN KEY (parent_answer_id) REFERENCES answers(id) ON DELETE SET NULL;
alter table public.answers add constraint answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE SET NULL;
alter table public.insights add constraint insights_study_id_fkey FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE;
alter table public.interview_insights add constraint interview_insights_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE;
alter table public.interviews add constraint interviews_respondent_id_fkey FOREIGN KEY (respondent_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.interviews add constraint interviews_study_id_fkey FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.questions add constraint questions_study_id_fkey FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE;
alter table public.recommendations add constraint recommendations_study_id_fkey FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE;
alter table public.respondent_tags add constraint respondent_tags_respondent_id_fkey FOREIGN KEY (respondent_id) REFERENCES respondent_profile(id) ON DELETE CASCADE;
alter table public.respondent_tags add constraint respondent_tags_tag_value_id_fkey FOREIGN KEY (tag_value_id) REFERENCES tag_values(id) ON DELETE CASCADE;
alter table public.studies add constraint studies_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.tag_values add constraint tag_values_dimension_id_fkey FOREIGN KEY (dimension_id) REFERENCES tag_dimensions(id) ON DELETE CASCADE;
alter table public.user_roles add constraint user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- RLS ligado em todas as tabelas
-- ---------------------------------------------------------------------------
alter table public.answers enable row level security;
alter table public.app_settings enable row level security;
alter table public.compensation_log enable row level security;
alter table public.consents enable row level security;
alter table public.cta_click_events enable row level security;
alter table public.insights enable row level security;
alter table public.interview_insights enable row level security;
alter table public.interviews enable row level security;
alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.recommendations enable row level security;
alter table public.respondent_profile enable row level security;
alter table public.respondent_tags enable row level security;
alter table public.screener_questions enable row level security;
alter table public.screener_submissions enable row level security;
alter table public.studies enable row level security;
alter table public.study_invitations enable row level security;
alter table public.tag_dimensions enable row level security;
alter table public.tag_values enable row level security;
alter table public.telegram_sessions enable row level security;
alter table public.user_roles enable row level security;

-- ---------------------------------------------------------------------------
-- Policies (verbatim da produção)
-- ---------------------------------------------------------------------------
-- answers
create policy "Respondent can delete own answers" on public.answers for delete to authenticated using ((EXISTS ( SELECT 1
   FROM interviews i
  WHERE ((i.id = answers.interview_id) AND (i.respondent_id = auth.uid())))));
create policy "Respondent can insert answers" on public.answers for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM interviews i
  WHERE ((i.id = answers.interview_id) AND (i.respondent_id = auth.uid())))));
create policy "Respondent can update own answers" on public.answers for update to authenticated using ((EXISTS ( SELECT 1
   FROM interviews i
  WHERE ((i.id = answers.interview_id) AND (i.respondent_id = auth.uid())))));
create policy "Respondent can view own answers" on public.answers for select to authenticated using ((EXISTS ( SELECT 1
   FROM interviews i
  WHERE ((i.id = answers.interview_id) AND (i.respondent_id = auth.uid())))));
create policy "Study owner can delete answers" on public.answers for delete to authenticated using ((EXISTS ( SELECT 1
   FROM (interviews i
     JOIN studies s ON ((s.id = i.study_id)))
  WHERE ((i.id = answers.interview_id) AND (s.owner_id = auth.uid())))));
create policy "Study owner can view answers" on public.answers for select to authenticated using ((EXISTS ( SELECT 1
   FROM (interviews i
     JOIN studies s ON ((s.id = i.study_id)))
  WHERE ((i.id = answers.interview_id) AND (s.owner_id = auth.uid())))));

-- app_settings
create policy "Admin can insert settings" on public.app_settings for insert to authenticated with check (is_admin());
create policy "Admin can read settings" on public.app_settings for select to authenticated using (is_admin());
create policy "Admin can update settings" on public.app_settings for update to authenticated using (is_admin()) with check (is_admin());

-- compensation_log
create policy "Admin can delete compensation" on public.compensation_log for delete to authenticated using (is_admin());
create policy "Admin can insert compensation" on public.compensation_log for insert to authenticated with check (is_admin());
create policy "Admin can update compensation" on public.compensation_log for update to authenticated using (is_admin()) with check (is_admin());
create policy "Admin can view all compensation" on public.compensation_log for select to authenticated using (is_admin());
create policy "Respondent views own compensation" on public.compensation_log for select to authenticated using ((EXISTS ( SELECT 1
   FROM respondent_profile rp
  WHERE ((rp.id = compensation_log.respondent_id) AND (rp.user_id = auth.uid())))));
create policy "Study owner views study compensation" on public.compensation_log for select to authenticated using (((study_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM studies s
  WHERE ((s.id = compensation_log.study_id) AND (s.owner_id = auth.uid()))))));

-- consents
create policy "Respondent can insert own consent" on public.consents for insert to authenticated with check ((auth.uid() = user_id));
create policy "Respondent can view own consents" on public.consents for select to authenticated using ((auth.uid() = user_id));
create policy "Study owner can view consents" on public.consents for select to authenticated using ((EXISTS ( SELECT 1
   FROM studies s
  WHERE ((s.id = consents.study_id) AND (s.owner_id = auth.uid())))));

-- cta_click_events
create policy "anyone can insert known cta clicks" on public.cta_click_events for insert to anon, authenticated with check (((cta_id = 'footer_respondents_signup'::text) AND (href ~~ 'https://%'::text) AND (length(href) <= 500) AND ((referrer IS NULL) OR (length(referrer) <= 1000)) AND ((user_agent IS NULL) OR (length(user_agent) <= 500))));
create policy "researchers can read click events" on public.cta_click_events for select to authenticated using (has_role(auth.uid(), 'researcher'::app_role));

-- insights
create policy "Owner manages insights" on public.insights for all to authenticated using ((EXISTS ( SELECT 1
   FROM studies s
  WHERE ((s.id = insights.study_id) AND (s.owner_id = auth.uid()))))) with check ((EXISTS ( SELECT 1
   FROM studies s
  WHERE ((s.id = insights.study_id) AND (s.owner_id = auth.uid())))));

-- interview_insights
create policy "Study owner can view insights" on public.interview_insights for select to authenticated using ((EXISTS ( SELECT 1
   FROM (interviews i
     JOIN studies s ON ((s.id = i.study_id)))
  WHERE ((i.id = interview_insights.interview_id) AND (s.owner_id = auth.uid())))));
create policy "Study owner manages insights" on public.interview_insights for all to authenticated using ((EXISTS ( SELECT 1
   FROM (interviews i
     JOIN studies s ON ((s.id = i.study_id)))
  WHERE ((i.id = interview_insights.interview_id) AND (s.owner_id = auth.uid()))))) with check ((EXISTS ( SELECT 1
   FROM (interviews i
     JOIN studies s ON ((s.id = i.study_id)))
  WHERE ((i.id = interview_insights.interview_id) AND (s.owner_id = auth.uid())))));

-- interviews
create policy "Respondent can delete own interview" on public.interviews for delete to authenticated using ((auth.uid() = respondent_id));
create policy "Respondent can insert own interview" on public.interviews for insert to authenticated with check (((auth.uid() = respondent_id) AND (EXISTS ( SELECT 1
   FROM studies s
  WHERE ((s.id = interviews.study_id) AND (s.status = 'published'::study_status))))));
create policy "Respondent can update own interview" on public.interviews for update to authenticated using ((auth.uid() = respondent_id));
create policy "Respondent can view own interviews" on public.interviews for select to authenticated using ((auth.uid() = respondent_id));
create policy "Study owner can delete interviews" on public.interviews for delete to authenticated using ((EXISTS ( SELECT 1
   FROM studies s
  WHERE ((s.id = interviews.study_id) AND (s.owner_id = auth.uid())))));
create policy "Study owner can view interviews" on public.interviews for select to authenticated using ((EXISTS ( SELECT 1
   FROM studies s
  WHERE ((s.id = interviews.study_id) AND (s.owner_id = auth.uid())))));

-- profiles
create policy "Admin can update all profiles" on public.profiles for update to authenticated using (is_admin()) with check (is_admin());
create policy "Admin can view all profiles" on public.profiles for select to authenticated using (is_admin());
create policy "Profiles are viewable by owner" on public.profiles for select to authenticated using ((auth.uid() = id));
create policy "Users can insert their own profile" on public.profiles for insert to authenticated with check ((auth.uid() = id));
create policy "Users can update their own profile" on public.profiles for update to authenticated using ((auth.uid() = id));

-- questions
create policy "Owners manage questions" on public.questions for all to authenticated using ((EXISTS ( SELECT 1
   FROM studies s
  WHERE ((s.id = questions.study_id) AND (s.owner_id = auth.uid()))))) with check ((EXISTS ( SELECT 1
   FROM studies s
  WHERE ((s.id = questions.study_id) AND (s.owner_id = auth.uid())))));
create policy "View questions of own studies" on public.questions for select to authenticated using ((EXISTS ( SELECT 1
   FROM studies s
  WHERE ((s.id = questions.study_id) AND (s.owner_id = auth.uid())))));
create policy "View questions of published studies" on public.questions for select to anon, authenticated using ((EXISTS ( SELECT 1
   FROM studies s
  WHERE ((s.id = questions.study_id) AND (s.status = 'published'::study_status)))));

-- recommendations
create policy "Owner manages recommendations" on public.recommendations for all to authenticated using ((EXISTS ( SELECT 1
   FROM studies s
  WHERE ((s.id = recommendations.study_id) AND (s.owner_id = auth.uid()))))) with check ((EXISTS ( SELECT 1
   FROM studies s
  WHERE ((s.id = recommendations.study_id) AND (s.owner_id = auth.uid())))));

-- respondent_profile
create policy "Admin can delete respondent profile" on public.respondent_profile for delete to authenticated using (is_admin());
create policy "Admin can insert any respondent profile" on public.respondent_profile for insert to authenticated with check (is_admin());
create policy "Admin can update any respondent profile" on public.respondent_profile for update to authenticated using (is_admin()) with check (is_admin());
create policy "Admin can view all respondent profiles" on public.respondent_profile for select to authenticated using (is_admin());
create policy "Researcher can view all respondent profiles" on public.respondent_profile for select to authenticated using (has_role(auth.uid(), 'researcher'::app_role));
create policy "Respondent can insert own profile" on public.respondent_profile for insert to authenticated with check ((auth.uid() = user_id));
create policy "Respondent can update own profile" on public.respondent_profile for update to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Respondent can view own profile" on public.respondent_profile for select to authenticated using ((auth.uid() = user_id));

-- respondent_tags
create policy "Admin can delete respondent tags" on public.respondent_tags for delete to authenticated using (is_admin());
create policy "Admin can insert respondent tags" on public.respondent_tags for insert to authenticated with check (is_admin());
create policy "Admin can view all respondent tags" on public.respondent_tags for select to authenticated using (is_admin());
create policy "Researcher can view all respondent tags" on public.respondent_tags for select to authenticated using (has_role(auth.uid(), 'researcher'::app_role));
create policy "Respondent can view own tags" on public.respondent_tags for select to authenticated using ((EXISTS ( SELECT 1
   FROM respondent_profile rp
  WHERE ((rp.id = respondent_tags.respondent_id) AND (rp.user_id = auth.uid())))));

-- screener_questions
create policy "Owners manage screener questions" on public.screener_questions for all to authenticated using ((EXISTS ( SELECT 1
   FROM studies s
  WHERE ((s.id = screener_questions.study_id) AND (s.owner_id = auth.uid()))))) with check ((EXISTS ( SELECT 1
   FROM studies s
  WHERE ((s.id = screener_questions.study_id) AND (s.owner_id = auth.uid())))));
create policy "View screener of published studies" on public.screener_questions for select to anon, authenticated using ((EXISTS ( SELECT 1
   FROM studies s
  WHERE ((s.id = screener_questions.study_id) AND (s.status = 'published'::study_status)))));

-- screener_submissions
create policy "Respondent can insert own submission" on public.screener_submissions for insert to authenticated with check ((auth.uid() = user_id));
create policy "Respondent can view own submission" on public.screener_submissions for select to authenticated using ((auth.uid() = user_id));
create policy "Study owner can view submissions" on public.screener_submissions for select to authenticated using ((EXISTS ( SELECT 1
   FROM studies s
  WHERE ((s.id = screener_submissions.study_id) AND (s.owner_id = auth.uid())))));

-- studies
create policy "Owners can delete their studies" on public.studies for delete to authenticated using ((auth.uid() = owner_id));
create policy "Owners can insert studies" on public.studies for insert to authenticated with check ((auth.uid() = owner_id));
create policy "Owners can update their studies" on public.studies for update to authenticated using ((auth.uid() = owner_id));
create policy "Owners can view their studies" on public.studies for select to authenticated using ((auth.uid() = owner_id));

-- study_invitations
create policy "Admin can delete invitations" on public.study_invitations for delete to authenticated using (is_admin());
create policy "Admin can insert invitations" on public.study_invitations for insert to authenticated with check (is_admin());
create policy "Admin can update invitations" on public.study_invitations for update to authenticated using (is_admin()) with check (is_admin());
create policy "Admin can view all invitations" on public.study_invitations for select to authenticated using (is_admin());
create policy "Respondent can view own invitations" on public.study_invitations for select to authenticated using ((EXISTS ( SELECT 1
   FROM respondent_profile rp
  WHERE ((rp.id = study_invitations.respondent_id) AND (rp.user_id = auth.uid())))));
create policy "Study owner can view invitations" on public.study_invitations for select to authenticated using ((EXISTS ( SELECT 1
   FROM studies s
  WHERE ((s.id = study_invitations.study_id) AND (s.owner_id = auth.uid())))));

-- tag_dimensions
create policy "Admin can delete dimensions" on public.tag_dimensions for delete to authenticated using (is_admin());
create policy "Admin can insert dimensions" on public.tag_dimensions for insert to authenticated with check (is_admin());
create policy "Admin can update dimensions" on public.tag_dimensions for update to authenticated using (is_admin()) with check (is_admin());
create policy "Anyone authenticated can read dimensions" on public.tag_dimensions for select to authenticated using (true);

-- tag_values
create policy "Admin can delete tag values" on public.tag_values for delete to authenticated using (is_admin());
create policy "Admin can insert tag values" on public.tag_values for insert to authenticated with check (is_admin());
create policy "Admin can update tag values" on public.tag_values for update to authenticated using (is_admin()) with check (is_admin());
create policy "Anyone authenticated can read tag values" on public.tag_values for select to authenticated using (true);

-- telegram_sessions
create policy "Admin can delete telegram sessions" on public.telegram_sessions for delete to authenticated using (is_admin());
create policy "Admin can insert telegram sessions" on public.telegram_sessions for insert to authenticated with check (is_admin());
create policy "Admin can update telegram sessions" on public.telegram_sessions for update to authenticated using (is_admin()) with check (is_admin());
create policy "Admin can view telegram sessions" on public.telegram_sessions for select to authenticated using (is_admin());

-- user_roles
create policy "Users can view their own roles" on public.user_roles for select to authenticated using ((auth.uid() = user_id));

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER answers_updated_at BEFORE UPDATE ON public.answers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_compensation_log_updated_at BEFORE UPDATE ON public.compensation_log FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_interview_insights_updated_at BEFORE UPDATE ON public.interview_insights FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER profiles_protect_can_publish BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION protect_can_publish();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_respondent_profile_updated_at BEFORE UPDATE ON public.respondent_profile FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_screener_questions_updated BEFORE UPDATE ON public.screener_questions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER studies_enforce_publish_permission BEFORE INSERT OR UPDATE ON public.studies FOR EACH ROW EXECUTE FUNCTION enforce_study_publish_permission();
CREATE TRIGGER studies_updated_at BEFORE UPDATE ON public.studies FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at_study_invitations BEFORE UPDATE ON public.study_invitations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tag_dimensions_updated_at BEFORE UPDATE ON public.tag_dimensions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tag_values_updated_at BEFORE UPDATE ON public.tag_values FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_telegram_sessions_updated_at BEFORE UPDATE ON public.telegram_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Índices (além dos que as constraints criam)
-- ---------------------------------------------------------------------------
CREATE INDEX answers_interview_id_idx ON public.answers USING btree (interview_id);
CREATE INDEX idx_compensation_log_created_at ON public.compensation_log USING btree (created_at DESC);
CREATE INDEX idx_compensation_log_respondent ON public.compensation_log USING btree (respondent_id);
CREATE INDEX idx_compensation_log_status ON public.compensation_log USING btree (status);
CREATE INDEX idx_compensation_log_study ON public.compensation_log USING btree (study_id);
CREATE INDEX cta_click_events_cta_id_created_at_idx ON public.cta_click_events USING btree (cta_id, created_at DESC);
CREATE INDEX insights_study_id_idx ON public.insights USING btree (study_id);
CREATE INDEX interviews_respondent_id_idx ON public.interviews USING btree (respondent_id);
CREATE INDEX interviews_study_id_idx ON public.interviews USING btree (study_id);
CREATE INDEX questions_study_id_idx ON public.questions USING btree (study_id);
CREATE INDEX recommendations_study_id_idx ON public.recommendations USING btree (study_id);
CREATE INDEX idx_respondent_profile_active ON public.respondent_profile USING btree (active);
CREATE INDEX idx_respondent_profile_user_id ON public.respondent_profile USING btree (user_id);
CREATE INDEX idx_respondent_tags_tag_value ON public.respondent_tags USING btree (tag_value_id);
CREATE INDEX idx_screener_questions_study ON public.screener_questions USING btree (study_id, "position");
CREATE INDEX idx_screener_submissions_study ON public.screener_submissions USING btree (study_id);
CREATE INDEX studies_owner_id_idx ON public.studies USING btree (owner_id);
CREATE INDEX studies_public_slug_idx ON public.studies USING btree (public_slug);
CREATE INDEX idx_study_invitations_respondent ON public.study_invitations USING btree (respondent_id);
CREATE INDEX idx_study_invitations_study ON public.study_invitations USING btree (study_id);
CREATE INDEX idx_tag_values_dimension ON public.tag_values USING btree (dimension_id);

-- ---------------------------------------------------------------------------
-- Storage: bucket privado de vídeos de entrevista + policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('interview-videos', 'interview-videos', false)
on conflict (id) do nothing;

create policy "Respondent can read own interview videos" on storage.objects for select to authenticated using (((bucket_id = 'interview-videos'::text) AND (EXISTS ( SELECT 1
   FROM interviews i
  WHERE (((i.id)::text = (storage.foldername(objects.name))[1]) AND (i.respondent_id = auth.uid()))))));
create policy "Respondent can upload own interview videos" on storage.objects for insert to authenticated with check (((bucket_id = 'interview-videos'::text) AND (EXISTS ( SELECT 1
   FROM interviews i
  WHERE (((i.id)::text = (storage.foldername(objects.name))[1]) AND (i.respondent_id = auth.uid()))))));
create policy "Respondent or owner can delete interview videos" on storage.objects for delete to authenticated using (((bucket_id = 'interview-videos'::text) AND ((EXISTS ( SELECT 1
   FROM interviews i
  WHERE (((i.id)::text = (storage.foldername(objects.name))[1]) AND (i.respondent_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM (interviews i
     JOIN studies s ON ((s.id = i.study_id)))
  WHERE (((i.id)::text = (storage.foldername(objects.name))[1]) AND (s.owner_id = auth.uid())))))));
create policy "Respondent updates own interview videos" on storage.objects for update to authenticated using (((bucket_id = 'interview-videos'::text) AND (EXISTS ( SELECT 1
   FROM interviews i
  WHERE (((i.id)::text = (storage.foldername(objects.name))[1]) AND (i.respondent_id = auth.uid()))))));
create policy "Study owner can read interview videos" on storage.objects for select to authenticated using (((bucket_id = 'interview-videos'::text) AND (EXISTS ( SELECT 1
   FROM (interviews i
     JOIN studies s ON ((s.id = i.study_id)))
  WHERE (((i.id)::text = (storage.foldername(objects.name))[1]) AND (s.owner_id = auth.uid()))))));
create policy "Study owner can upload interview videos" on storage.objects for insert to authenticated with check (((bucket_id = 'interview-videos'::text) AND (EXISTS ( SELECT 1
   FROM (interviews i
     JOIN studies s ON ((s.id = i.study_id)))
  WHERE (((i.id)::text = (storage.foldername(objects.name))[1]) AND (s.owner_id = auth.uid()))))));
