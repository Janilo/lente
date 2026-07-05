-- ============================================================================
-- F-RLS-2: policies "de estudo publicado" — conserta a de insert, remove as mortas
-- ============================================================================
-- Subquery de policy respeita a RLS de `studies` DE QUEM CONSULTA. Anon e
-- respondente não têm policy de select em studies, então o `EXISTS (... from
-- studies where status = 'published')` nunca encontrava nada e as três
-- policies "de estudo publicado" não concediam o que aparentavam
-- (provado por supabase/tests/*.rls.ts).
--
-- Destinos diferentes, guiados pelo código:
--
-- 1. "Respondent can insert own interview" — CONSERTADA. O runner web
--    (interview.functions.ts, startInterview) cria a entrevista com o client
--    DO USUÁRIO e dependia desta policy: o fluxo estava quebrado para
--    qualquer respondente real (só o dono do estudo, que enxerga o próprio
--    estudo, passava). Agora o teste de "publicado" usa study_is_published()
--    (SECURITY DEFINER) e a policy funciona como o código sempre esperou.
--
-- 2. "View questions/screener of published studies" — REMOVIDAS. Nada as usa:
--    o runner lê perguntas via serverFn com service-role, e o caminho público
--    pré-login (slug) idem. Consertá-las só ampliaria a superfície anônima da
--    API sem consumidor. Se um dia o runner ler perguntas com o client do
--    usuário, a policy volta usando study_is_published().

create or replace function public.study_is_published(p_study_id uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from public.studies s
    where s.id = p_study_id and s.status = 'published'
  );
$function$;

drop policy "Respondent can insert own interview" on public.interviews;
create policy "Respondent can insert own interview" on public.interviews
  for insert to authenticated
  with check ((auth.uid() = respondent_id) and public.study_is_published(study_id));

drop policy "View questions of published studies" on public.questions;
drop policy "View screener of published studies" on public.screener_questions;
