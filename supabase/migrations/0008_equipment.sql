-- Equipment makes, models and ages.
-- Shape: { "rows":[ { "id":"...", "name":"Furnace", "brand":"Carrier",
--                     "model":"59SC5A", "serial":"...", "year":2011,
--                     "notes":"", "plate_path":"..." } ] }
-- plate_path is the data-plate photograph. It is kept for the inspector's own
-- records and is deliberately never rendered in the report.
alter table public.reports
  add column if not exists equipment jsonb not null default '{}'::jsonb;
