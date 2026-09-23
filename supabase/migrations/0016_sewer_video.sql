-- Link to the sewer camera recording, shown in the Sewer Scope section.
alter table public.reports
  add column if not exists sewer_video_url text;
