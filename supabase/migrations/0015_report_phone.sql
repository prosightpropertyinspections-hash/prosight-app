-- The client's mobile, kept on the report so the report can be texted to them.
alter table public.reports
  add column if not exists client_phone text;
