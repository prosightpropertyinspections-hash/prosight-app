-- Profile picture. Only the storage path is kept; the image itself lives in the
-- existing private bucket and is read through a signed URL.
alter table public.profiles
  add column if not exists avatar_path text not null default '';
