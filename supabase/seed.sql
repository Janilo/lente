-- ============================================================================
-- Seed determinístico para a suíte de RLS (supabase/tests/*.rls.ts)
-- ============================================================================
-- Roda SÓ na stack local / CI (supabase start ou db reset). Nunca na produção.
-- Senha de todas as contas de teste: lente-rls-test
--
-- Personas (UUIDs fixos — os testes importam de supabase/tests/stack.ts).
-- Desde o F-SEC-1 (migration 20260705090500) o cadastro NÃO concede role
-- nenhuma; 'researcher' é concedida pelo admin, e é isso que este seed imita.
--   admin  janilo@pereirasaraiva.com  is_admin() = true (e-mail hardcoded na função)
--   ana    ana@lente.test             pesquisadora (role concedida), can_publish = true, dona do Estudo A
--   bruno  bruno@lente.test           pesquisador (role concedida), can_publish = false, dono dos Estudos B1/B2
--   rita   rita@lente.test            respondente COMO O CADASTRO DEIXA: nenhuma role.
--                                     Persona do teste F-SEC-1 (não pode ler PII alheia).
--   rafael rafael@lente.test          respondente com a role 'respondent' concedida —
--                                     nenhuma policy depende dela; existe para provar
--                                     que ela não abre nada indevido.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Usuários (o trigger on_auth_user_created cria profiles + role 'researcher')
-- ----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-00000000ad01',
   'authenticated', 'authenticated', 'janilo@pereirasaraiva.com',
   extensions.crypt('lente-rls-test', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Admin"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'a1a1a1a1-0000-4000-8000-000000000001',
   'authenticated', 'authenticated', 'ana@lente.test',
   extensions.crypt('lente-rls-test', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Ana Pesquisadora"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b2b2b2b2-0000-4000-8000-000000000002',
   'authenticated', 'authenticated', 'bruno@lente.test',
   extensions.crypt('lente-rls-test', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Bruno Pesquisador"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'c3c3c3c3-0000-4000-8000-000000000003',
   'authenticated', 'authenticated', 'rita@lente.test',
   extensions.crypt('lente-rls-test', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Rita Respondente"}',
   now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'd4d4d4d4-0000-4000-8000-000000000004',
   'authenticated', 'authenticated', 'rafael@lente.test',
   extensions.crypt('lente-rls-test', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"full_name":"Rafael Respondente"}',
   now(), now(), '', '', '', '');

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
  'email', now(), now(), now()
from auth.users u
where u.email in (
  'janilo@pereirasaraiva.com', 'ana@lente.test', 'bruno@lente.test',
  'rita@lente.test', 'rafael@lente.test'
);

-- ----------------------------------------------------------------------------
-- Roles e permissões
-- ----------------------------------------------------------------------------
-- O cadastro não dá role nenhuma (F-SEC-1); a concessão é explícita, como o
-- admin faz na produção. Rita fica de fora de propósito: cadastro cru.
insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-8000-00000000ad01', 'researcher'),
  ('a1a1a1a1-0000-4000-8000-000000000001', 'researcher'),
  ('b2b2b2b2-0000-4000-8000-000000000002', 'researcher'),
  ('d4d4d4d4-0000-4000-8000-000000000004', 'respondent');

-- can_publish de ana e admin: o trigger protect_can_publish exige is_admin()
-- (auth.uid() é null no seed), então desabilita-o em volta do update.
alter table public.profiles disable trigger profiles_protect_can_publish;
update public.profiles set can_publish = true
where id in ('00000000-0000-4000-8000-00000000ad01', 'a1a1a1a1-0000-4000-8000-000000000001');
alter table public.profiles enable trigger profiles_protect_can_publish;

-- ----------------------------------------------------------------------------
-- Estudos (enforce_study_publish_permission exige is_admin()/can_publish com
-- auth.uid() — null no seed; desabilita o trigger em volta dos inserts)
-- ----------------------------------------------------------------------------
alter table public.studies disable trigger studies_enforce_publish_permission;
insert into public.studies (id, owner_id, title, business_goal, status, public_slug) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001',
   'Estudo A — hábitos de compra online', 'Entender o que decide a compra', 'published', 'estudo-a-publico'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'b2b2b2b2-0000-4000-8000-000000000002',
   'Estudo B1 — rascunho interno', null, 'draft', 'estudo-b1-rascunho'),
  -- B2 publicado com dono sem can_publish: estado alcançável (a permissão pode
  -- ser revogada depois da publicação).
  ('bbbbbbbb-0000-4000-8000-000000000002', 'b2b2b2b2-0000-4000-8000-000000000002',
   'Estudo B2 — publicado', null, 'published', 'estudo-b2-publico');
alter table public.studies enable trigger studies_enforce_publish_permission;

insert into public.questions (id, study_id, "position", text, intent) values
  ('11111111-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 1, 'Como você decide onde comprar?', 'critérios de decisão'),
  ('11111111-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 2, 'Conte a última compra que se arrependeu.', 'fricções'),
  ('11111111-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000001', 1, 'Pergunta do rascunho B1', null),
  ('11111111-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000002', 1, 'Pergunta do estudo B2', null);

insert into public.screener_questions (id, study_id, "position", text, type, options, qualifies, qualifying_options) values
  ('66666666-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 1,
   'Você comprou online nos últimos 30 dias?', 'single_choice',
   '["Sim", "Não"]', true, '["Sim"]');

-- ----------------------------------------------------------------------------
-- Perfis de respondente (PII de teste — o vazamento disso é o F-SEC-1)
-- ----------------------------------------------------------------------------
insert into public.respondent_profile (
  id, user_id, full_name, email, phone, city, state, income_range, occupation
) values
  ('88888888-0000-4000-8000-000000000001', 'c3c3c3c3-0000-4000-8000-000000000003',
   'Rita Respondente', 'rita@lente.test', '+55 11 91234-0001', 'São Paulo', 'SP', '5k-10k', 'Analista'),
  ('88888888-0000-4000-8000-000000000002', 'd4d4d4d4-0000-4000-8000-000000000004',
   'Rafael Respondente', 'rafael@lente.test', '+55 21 91234-0002', 'Rio de Janeiro', 'RJ', '10k-20k', 'Designer');

-- ----------------------------------------------------------------------------
-- Entrevistas, respostas, análises
-- ----------------------------------------------------------------------------
insert into public.interviews (id, study_id, respondent_id, status, source, finished_at) values
  ('22222222-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'c3c3c3c3-0000-4000-8000-000000000003', 'completed', 'live', now()),
  ('22222222-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002',
   'd4d4d4d4-0000-4000-8000-000000000004', 'in_progress', 'live', null);

insert into public.answers (id, interview_id, question_id, is_followup, parent_answer_id, question_text, status, transcript, quality_score) values
  ('33333333-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001',
   '11111111-0000-4000-8000-000000000001', false, null,
   'Como você decide onde comprar?', 'ready', 'Comparo preço e prazo de entrega antes de tudo.', 82),
  ('33333333-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000001',
   null, true, '33333333-0000-4000-8000-000000000001',
   'E quando o preço empata?', 'ready', 'Aí decide a loja que já conheço.', 78),
  ('33333333-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000002',
   '11111111-0000-4000-8000-000000000004', false, null,
   'Pergunta do estudo B2', 'uploading', null, null);

insert into public.interview_insights (interview_id, quality, segments, tags, bullet_summary, tagline, model) values
  ('22222222-0000-4000-8000-000000000001', 'alta', '{consumidor-digital}', '{preço,confiança}',
   '{"Preço e prazo decidem","Marca conhecida desempata"}', 'Compradora pragmática', 'seed');

insert into public.insights (id, study_id, theme, summary) values
  ('44444444-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'Preço decide, confiança desempata', 'Respondentes comparam preço primeiro; marca conhecida ganha no empate.');

insert into public.recommendations (id, study_id, title, rationale, supporting_insight_ids, priority) values
  ('55555555-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'Destacar frete e prazo na página de produto', 'O prazo aparece como segundo critério em todas as entrevistas.',
   '{44444444-0000-4000-8000-000000000001}', 1);

insert into public.consents (id, interview_id, user_id, study_id, consent_version) values
  ('efefefef-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001',
   'c3c3c3c3-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'v1');

insert into public.screener_submissions (id, study_id, user_id, responses, qualified) values
  ('77777777-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   'c3c3c3c3-0000-4000-8000-000000000003', '[{"q":"66666666-0000-4000-8000-000000000001","a":"Sim"}]', true);

-- ----------------------------------------------------------------------------
-- Convites, tags, compensação, telegram, CTA, settings
-- ----------------------------------------------------------------------------
insert into public.study_invitations (id, study_id, respondent_id, invited_by, channel, status, sent_at) values
  ('abababab-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   '88888888-0000-4000-8000-000000000001', 'a1a1a1a1-0000-4000-8000-000000000001', 'manual', 'sent', now());

insert into public.tag_dimensions (id, slug, label, "position") values
  ('99999999-0000-4000-8000-000000000001', 'perfil', 'Perfil de consumo', 1);

insert into public.tag_values (id, dimension_id, slug, label, "position") values
  ('99999999-0000-4000-8000-000000000011', '99999999-0000-4000-8000-000000000001', 'consumidor-digital', 'Consumidor digital', 1),
  ('99999999-0000-4000-8000-000000000012', '99999999-0000-4000-8000-000000000001', 'profissional', 'Profissional', 2);

insert into public.respondent_tags (respondent_id, tag_value_id, assigned_by) values
  ('88888888-0000-4000-8000-000000000001', '99999999-0000-4000-8000-000000000011',
   '00000000-0000-4000-8000-00000000ad01');

insert into public.compensation_log (id, respondent_id, study_id, interview_id, amount, status, paid_at, created_by) values
  ('cdcdcdcd-0000-4000-8000-000000000001', '88888888-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001',
   50.00, 'paid', now(), '00000000-0000-4000-8000-00000000ad01');

insert into public.telegram_sessions (chat_id, user_id, state) values
  (111001, 'c3c3c3c3-0000-4000-8000-000000000003', 'idle');

insert into public.cta_click_events (cta_id, href) values
  ('footer_respondents_signup', 'https://lente.app/respondentes');

insert into public.app_settings (id, stt_provider) values (true, 'elevenlabs');
