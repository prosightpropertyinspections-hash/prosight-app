-- Property snapshot facts, plus a manual override for the overall grade.
-- Shape of snapshot: { "year_built":"1968", "sqft":"1840", "roof_type":"Asphalt shingle" }
alter table public.reports
  add column if not exists snapshot jsonb not null default '{}'::jsonb;

-- Empty means "use the calculated grade"; a letter overrides it.
alter table public.reports
  add column if not exists grade_override text not null default '';
