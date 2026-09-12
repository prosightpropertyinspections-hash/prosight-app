-- ProSight Report Studio — initial schema
-- Run this in Supabase SQL Editor, or via `supabase db push`.

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";

-- ---------- reports ----------
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'draft',        -- draft | done
  -- property / cover
  client        text default '',
  address       text default '',
  inspection_date date,
  inspection_time text default '10:00',
  property_type text default 'Single-family dwelling',
  inspector     text default '',
  nachi_id      text default '',
  report_no     text default '',
  -- intake answers (kept for reference / re-generating skeleton)
  rooms         jsonb not null default '{}'::jsonb,
  systems       jsonb not null default '{}'::jsonb,
  garage        text default 'attached',
  extras        jsonb not null default '[]'::jsonb,
  -- presentation
  theme         text default 'midnight',
  cover_photo   text,                                  -- storage path
  overall_grade text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- sections (areas) ----------
create table if not exists public.sections (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.reports(id) on delete cascade,
  owner      uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  subtitle   text default '',
  grp        text default 'Interior',                 -- Exterior | Structure | Interior | Systems | Custom
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- findings ----------
create table if not exists public.findings (
  id          uuid primary key default gen_random_uuid(),
  section_id  uuid not null references public.sections(id) on delete cascade,
  report_id   uuid not null references public.reports(id) on delete cascade,
  owner       uuid not null references auth.users(id) on delete cascade,
  title       text default '',
  note        text default '',                         -- inspector's rough note
  ai_text     text default '',                         -- AI-polished report text
  severity    text default 'monitor',                  -- priority | monitor | satisfactory
  photo_path  text,                                    -- storage path (original)
  annotations jsonb not null default '[]'::jsonb,      -- [{x,y,rx,ry,color,label}]
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- indexes ----------
create index if not exists idx_reports_owner   on public.reports(owner, updated_at desc);
create index if not exists idx_sections_report on public.sections(report_id, sort_order);
create index if not exists idx_findings_section on public.findings(section_id, sort_order);

-- ---------- updated_at trigger ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_reports_touch on public.reports;
create trigger trg_reports_touch before update on public.reports
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_findings_touch on public.findings;
create trigger trg_findings_touch before update on public.findings
  for each row execute function public.touch_updated_at();

-- ---------- Row Level Security: each user sees only their own data ----------
alter table public.reports  enable row level security;
alter table public.sections enable row level security;
alter table public.findings enable row level security;

-- reports
drop policy if exists "own reports" on public.reports;
create policy "own reports" on public.reports
  for all using (auth.uid() = owner) with check (auth.uid() = owner);

-- sections
drop policy if exists "own sections" on public.sections;
create policy "own sections" on public.sections
  for all using (auth.uid() = owner) with check (auth.uid() = owner);

-- findings
drop policy if exists "own findings" on public.findings;
create policy "own findings" on public.findings
  for all using (auth.uid() = owner) with check (auth.uid() = owner);

-- ---------- Storage bucket policies ----------
-- Bucket 'inspection-photos' must be created in the Storage UI (Private).
-- These policies let a user read/write only files under their own user-id folder.
insert into storage.buckets (id, name, public)
  values ('inspection-photos', 'inspection-photos', false)
  on conflict (id) do nothing;

drop policy if exists "own photos read" on storage.objects;
create policy "own photos read" on storage.objects
  for select using (bucket_id = 'inspection-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own photos write" on storage.objects;
create policy "own photos write" on storage.objects
  for insert with check (bucket_id = 'inspection-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own photos update" on storage.objects;
create policy "own photos update" on storage.objects
  for update using (bucket_id = 'inspection-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own photos delete" on storage.objects;
create policy "own photos delete" on storage.objects
  for delete using (bucket_id = 'inspection-photos' and (storage.foldername(name))[1] = auth.uid()::text);
