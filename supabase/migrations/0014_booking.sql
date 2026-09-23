-- Public booking requests.
-- A request is not a confirmed appointment: it arrives from a stranger on the
-- website and has to be accepted before it becomes real work, so it gets its own
-- status rather than landing among the scheduled jobs.
alter table public.appointments
  add column if not exists status text not null default 'scheduled',
  add column if not exists source text not null default 'manual',
  add column if not exists sms_consent boolean not null default false,
  add column if not exists sms_consent_at timestamptz;

-- The owner of a booking taken from the public form, since no one is signed in
-- when it is created.
alter table public.appointments
  add column if not exists owner uuid;
