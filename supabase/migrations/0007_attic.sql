-- Attic condition ratings, stored per report.
-- Shape: { "framing":"good", "insulation":"fair", "ventilation":"poor",
--          "moisture":"na", "note":"", "source":"ai"|"manual" }
alter table public.reports
  add column if not exists attic jsonb not null default '{}'::jsonb;
