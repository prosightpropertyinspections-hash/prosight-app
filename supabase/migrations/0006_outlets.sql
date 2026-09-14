-- Receptacle testing tally, stored per report.
-- Shape: { "rows": [ { "id": "...", "room": "Kitchen", "total": 6,
--                      "defective": 1, "open_ground": 2, "notes": "" } ] }
alter table public.reports
  add column if not exists outlets jsonb not null default '{}'::jsonb;
