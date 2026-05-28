-- ============================================================
-- Phase 2 : Storage buckets + company_settings
-- ============================================================

-- 1. Storage buckets
insert into storage.buckets (id, name, public) values
  ('quotes-pdf',       'quotes-pdf',       true),
  ('instagram-media',  'instagram-media',  true),
  ('voice-notes',      'voice-notes',      false)
on conflict (id) do nothing;

-- RLS: allow authenticated users to manage their company's files
create policy "quotes-pdf: company upload"
  on storage.objects for insert
  with check (
    bucket_id = 'quotes-pdf'
    and (storage.foldername(name))[1] = (
      select company_id::text from public.profiles where id = auth.uid()
    )
  );

create policy "quotes-pdf: company read"
  on storage.objects for select
  using (bucket_id = 'quotes-pdf');

create policy "instagram-media: company upload"
  on storage.objects for insert
  with check (
    bucket_id = 'instagram-media'
    and (storage.foldername(name))[1] = (
      select company_id::text from public.profiles where id = auth.uid()
    )
  );

create policy "instagram-media: public read"
  on storage.objects for select
  using (bucket_id = 'instagram-media');

create policy "voice-notes: company upload"
  on storage.objects for insert
  with check (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = (
      select company_id::text from public.profiles where id = auth.uid()
    )
  );

create policy "voice-notes: company read"
  on storage.objects for select
  using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = (
      select company_id::text from public.profiles where id = auth.uid()
    )
  );

-- 2. company_settings — stocke les tokens Instagram et autres config
create table if not exists public.company_settings (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  key         text not null,
  value       text,
  created_at  timestamptz not null default now(),
  unique (company_id, key)
);

alter table public.company_settings enable row level security;

create policy "company_settings: company access"
  on public.company_settings
  using (
    company_id = (select company_id from public.profiles where id = auth.uid())
  )
  with check (
    company_id = (select company_id from public.profiles where id = auth.uid())
  );
