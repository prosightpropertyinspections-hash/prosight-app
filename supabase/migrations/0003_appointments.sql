-- Scheduling: customers, appointments, service requested and fee.
-- Run this in the Supabase SQL editor.

create table if not exists public.appointments (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),

  client_name   text not null default '',
  phone         text not null default '',
  email         text not null default '',
  address       text not null default '',

  service       text not null default 'Full home inspection',
  fee           numeric(10,2) not null default 0,
  paid          boolean not null default false,

  starts_at     timestamptz not null,
  duration_min  integer not null default 180,

  status        text not null default 'scheduled',  -- scheduled | completed | canceled
  notes         text not null default '',

  report_id     uuid references public.reports(id) on delete set null
);

create index if not exists appointments_owner_starts_idx
  on public.appointments (owner, starts_at);

alter table public.appointments enable row level security;

drop policy if exists "own appointments" on public.appointments;
create policy "own appointments" on public.appointments
  for all
  using (auth.uid() = owner)
  with check (auth.uid() = owner);
