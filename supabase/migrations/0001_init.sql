-- CreatorCut initial schema: profiles + projects, RLS, and a private videos
-- bucket. Apply in the Supabase SQL editor (or `supabase db push`).

-- ── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are viewable by owner"
  on public.profiles for select using (auth.uid() = id);
create policy "profiles are updatable by owner"
  on public.profiles for update using (auth.uid() = id);

-- auto-create a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── projects ────────────────────────────────────────────────────────────────
-- A project stores the full edit (EDL + look/captions/aspect) as JSON plus a
-- pointer to the source video in Storage. The EDL is the single source of truth
-- (PLAN.md §4a), so persisting it captures the whole edit.
create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null default 'Untitled project',
  video_path   text,                       -- storage object path in the `videos` bucket
  video_meta   jsonb not null default '{}',-- { fileName, duration, width, height, fileSize }
  edl          jsonb,                       -- the EDL (segments, captions, tracks, filter, ...)
  thumbnail    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "projects are selectable by owner"
  on public.projects for select using (auth.uid() = user_id);
create policy "projects are insertable by owner"
  on public.projects for insert with check (auth.uid() = user_id);
create policy "projects are updatable by owner"
  on public.projects for update using (auth.uid() = user_id);
create policy "projects are deletable by owner"
  on public.projects for delete using (auth.uid() = user_id);

create index if not exists projects_user_id_updated_idx
  on public.projects (user_id, updated_at desc);

-- ── storage: private `videos` bucket ────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('videos', 'videos', false)
on conflict (id) do nothing;

-- users may manage only files under their own `<uid>/...` prefix
create policy "videos: owner can read"
  on storage.objects for select
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "videos: owner can insert"
  on storage.objects for insert
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "videos: owner can delete"
  on storage.objects for delete
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
