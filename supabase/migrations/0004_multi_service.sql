-- A booking can be more than one job (inspection + sewer scope + radon),
-- so services becomes a list. The old single `service` column is kept in
-- sync with the first entry so nothing that reads it breaks.

alter table public.appointments
  add column if not exists services text[] not null default '{}';

update public.appointments
  set services = array[service]
  where cardinality(services) = 0 and coalesce(service,'') <> '';
