-- Persist a project's background music + image/logo overlays. Files go to the
-- same private `videos` bucket under the user's folder; this column stores their
-- storage paths + metadata.
alter table public.projects
  add column if not exists media jsonb not null default '{}'::jsonb;
