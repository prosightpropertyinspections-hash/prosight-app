-- Signed inspection agreements. One per appointment. The filled-in text is
-- stored with the signature, so the record shows exactly what was signed even
-- if the template changes later.
create table if not exists public.agreements (
  id             uuid primary key default gen_random_uuid(),
  owner          uuid not null default auth.uid(),
  appointment_id uuid unique references public.appointments(id) on delete cascade,
  token          text unique not null,
  client_name    text,
  address        text,
  fee            numeric,
  inspection_at  timestamptz,
  body           text not null,
  status         text not null default 'sent',   -- sent | signed
  created_at     timestamptz not null default now(),
  sent_at        timestamptz,
  viewed_at      timestamptz,
  signed_at      timestamptz,
  signer_name    text,
  signer_ip      text,
  signer_ua      text
);

alter table public.agreements enable row level security;

drop policy if exists "owner manages agreements" on public.agreements;
create policy "owner manages agreements" on public.agreements
  for all using (owner = auth.uid()) with check (owner = auth.uid());
