-- Review link, and a record of the client confirming they received the report.
alter table public.profiles
  add column if not exists review_url text not null default '';

-- Acknowledgement is the evidence that matters in a later dispute: who
-- confirmed, and exactly when.
alter table public.report_shares
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_name text not null default '';
