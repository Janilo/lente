-- ============================================================================
-- F-SEC-1: o cadastro deixa de conceder a role 'researcher'
-- ============================================================================
-- Antes, handle_new_user dava 'researcher' a TODO usuário novo — inclusive a
-- quem se cadastrava como respondente — e a policy "Researcher can view all
-- respondent profiles" deixava qualquer conta recém-criada ler a PII inteira
-- de respondent_profile (provado por supabase/tests/pii-roles.rls.ts).
--
-- Agora o cadastro só cria o profile. Role é privilégio concedido:
--   pesquisador → pelo admin:
--       insert into public.user_roles (user_id, role)
--       values ('<user_id>', 'researcher');
--   respondente → nada a conceder (nenhuma policy depende da role 'respondent').

create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end;
$function$;

-- Revoga o 'researcher' concedido indevidamente pelo comportamento antigo:
-- mantém apenas donos de estudo e o admin. Na stack local roda sobre banco
-- ainda vazio (no-op); na produção é a limpeza do F-SEC-1.
delete from public.user_roles ur
where ur.role = 'researcher'
  and not exists (select 1 from public.studies s where s.owner_id = ur.user_id)
  and not exists (
    select 1 from auth.users u
    where u.id = ur.user_id and lower(u.email) = 'janilo@pereirasaraiva.com'
  );
