-- Business and inspector details, one row per user, applied across every report.
create table if not exists public.profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  updated_at     timestamptz not null default now(),

  company_name   text not null default 'ProSight Property Inspections',
  legal_name     text not null default '',
  address        text not null default '',
  phone          text not null default '',
  email          text not null default '',
  website        text not null default '',

  inspector_name text not null default '',
  internachi_id  text not null default '',
  license_no     text not null default '',

  default_theme  text not null default 'estate',
  standards_note text not null default ''
);

alter table public.profiles enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
