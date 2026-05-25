
-- Respondent: upload to own interview folder
create policy "Respondent uploads own interview videos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'interview-videos'
  and exists (
    select 1 from public.interviews i
    where i.id::text = (storage.foldername(name))[1]
      and i.respondent_id = auth.uid()
  )
);

create policy "Respondent reads own interview videos"
on storage.objects for select to authenticated
using (
  bucket_id = 'interview-videos'
  and exists (
    select 1 from public.interviews i
    where i.id::text = (storage.foldername(name))[1]
      and i.respondent_id = auth.uid()
  )
);

create policy "Respondent updates own interview videos"
on storage.objects for update to authenticated
using (
  bucket_id = 'interview-videos'
  and exists (
    select 1 from public.interviews i
    where i.id::text = (storage.foldername(name))[1]
      and i.respondent_id = auth.uid()
  )
);

create policy "Study owner reads interview videos"
on storage.objects for select to authenticated
using (
  bucket_id = 'interview-videos'
  and exists (
    select 1
    from public.interviews i
    join public.studies s on s.id = i.study_id
    where i.id::text = (storage.foldername(name))[1]
      and s.owner_id = auth.uid()
  )
);
