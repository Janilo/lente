
-- ENUMS
create type public.app_role as enum ('researcher', 'respondent');
create type public.study_status as enum ('draft', 'published', 'closed');
create type public.interview_status as enum ('in_progress', 'completed', 'abandoned');
create type public.answer_status as enum ('uploading', 'transcribing', 'ready', 'failed');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "Users can insert their own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "Users can update their own profile" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- USER ROLES (separate table)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users can view their own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

-- Auto-create profile + default researcher role on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  insert into public.user_roles (user_id, role)
  values (new.id, 'researcher')
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- STUDIES
create table public.studies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  business_goal text,
  context text,
  target_audience text,
  status public.study_status not null default 'draft',
  public_slug text not null unique default lower(replace(gen_random_uuid()::text, '-', '')),
  max_followups int not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.studies enable row level security;
create index on public.studies(owner_id);
create index on public.studies(public_slug);
create trigger studies_updated_at before update on public.studies
  for each row execute function public.set_updated_at();

create policy "Owners can view their studies" on public.studies
  for select to authenticated using (auth.uid() = owner_id);
create policy "Anyone can view published studies by slug" on public.studies
  for select to anon, authenticated using (status = 'published');
create policy "Owners can insert studies" on public.studies
  for insert to authenticated with check (auth.uid() = owner_id);
create policy "Owners can update their studies" on public.studies
  for update to authenticated using (auth.uid() = owner_id);
create policy "Owners can delete their studies" on public.studies
  for delete to authenticated using (auth.uid() = owner_id);

-- QUESTIONS
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  position int not null,
  text text not null,
  intent text,
  created_at timestamptz not null default now()
);
alter table public.questions enable row level security;
create index on public.questions(study_id);

create policy "View questions of own studies" on public.questions
  for select to authenticated using (
    exists (select 1 from public.studies s where s.id = study_id and s.owner_id = auth.uid())
  );
create policy "View questions of published studies" on public.questions
  for select to anon, authenticated using (
    exists (select 1 from public.studies s where s.id = study_id and s.status = 'published')
  );
create policy "Owners manage questions" on public.questions
  for all to authenticated
  using (exists (select 1 from public.studies s where s.id = study_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.studies s where s.id = study_id and s.owner_id = auth.uid()));

-- INTERVIEWS
create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  respondent_id uuid not null references auth.users(id) on delete cascade,
  status public.interview_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.interviews enable row level security;
create index on public.interviews(study_id);
create index on public.interviews(respondent_id);

create policy "Respondent can view own interviews" on public.interviews
  for select to authenticated using (auth.uid() = respondent_id);
create policy "Study owner can view interviews" on public.interviews
  for select to authenticated using (
    exists (select 1 from public.studies s where s.id = study_id and s.owner_id = auth.uid())
  );
create policy "Respondent can insert own interview" on public.interviews
  for insert to authenticated with check (auth.uid() = respondent_id);
create policy "Respondent can update own interview" on public.interviews
  for update to authenticated using (auth.uid() = respondent_id);

-- ANSWERS
create table public.answers (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  parent_answer_id uuid references public.answers(id) on delete set null,
  is_followup boolean not null default false,
  question_text text not null,
  video_path text,
  duration_seconds numeric,
  transcript text,
  words_json jsonb,
  status public.answer_status not null default 'uploading',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.answers enable row level security;
create index on public.answers(interview_id);
create trigger answers_updated_at before update on public.answers
  for each row execute function public.set_updated_at();

create policy "Respondent can view own answers" on public.answers
  for select to authenticated using (
    exists (select 1 from public.interviews i where i.id = interview_id and i.respondent_id = auth.uid())
  );
create policy "Study owner can view answers" on public.answers
  for select to authenticated using (
    exists (
      select 1 from public.interviews i
      join public.studies s on s.id = i.study_id
      where i.id = interview_id and s.owner_id = auth.uid()
    )
  );
create policy "Respondent can insert answers" on public.answers
  for insert to authenticated with check (
    exists (select 1 from public.interviews i where i.id = interview_id and i.respondent_id = auth.uid())
  );
create policy "Respondent can update own answers" on public.answers
  for update to authenticated using (
    exists (select 1 from public.interviews i where i.id = interview_id and i.respondent_id = auth.uid())
  );

-- INSIGHTS
create table public.insights (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  theme text not null,
  summary text not null,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.insights enable row level security;
create index on public.insights(study_id);

create policy "Owner manages insights" on public.insights
  for all to authenticated
  using (exists (select 1 from public.studies s where s.id = study_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.studies s where s.id = study_id and s.owner_id = auth.uid()));

-- RECOMMENDATIONS
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  title text not null,
  rationale text not null,
  supporting_insight_ids uuid[] not null default '{}',
  priority int,
  created_at timestamptz not null default now()
);
alter table public.recommendations enable row level security;
create index on public.recommendations(study_id);

create policy "Owner manages recommendations" on public.recommendations
  for all to authenticated
  using (exists (select 1 from public.studies s where s.id = study_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.studies s where s.id = study_id and s.owner_id = auth.uid()));

-- STORAGE BUCKET
insert into storage.buckets (id, name, public)
values ('interview-videos', 'interview-videos', false)
on conflict (id) do nothing;

-- Storage RLS: respondent can manage own files (path = interview_id/...)
create policy "Respondent can upload own interview videos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'interview-videos'
  and exists (
    select 1 from public.interviews i
    where i.id::text = (storage.foldername(name))[1]
      and i.respondent_id = auth.uid()
  )
);

create policy "Respondent can read own interview videos"
on storage.objects for select to authenticated
using (
  bucket_id = 'interview-videos'
  and exists (
    select 1 from public.interviews i
    where i.id::text = (storage.foldername(name))[1]
      and i.respondent_id = auth.uid()
  )
);

create policy "Study owner can read interview videos"
on storage.objects for select to authenticated
using (
  bucket_id = 'interview-videos'
  and exists (
    select 1 from public.interviews i
    join public.studies s on s.id = i.study_id
    where i.id::text = (storage.foldername(name))[1]
      and s.owner_id = auth.uid()
  )
);
