-- AI Piano Examiner — initial database schema
-- Run this in the Supabase SQL Editor or via Supabase CLI migrations.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.sheet_music_file_type as enum ('pdf', 'jpeg');
create type public.examiner_mode as enum ('abrsm', 'trinity');
create type public.performance_status as enum ('pending', 'processing', 'completed', 'failed');

-- ---------------------------------------------------------------------------
-- Profiles (extends auth.users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Sheet music uploads
-- ---------------------------------------------------------------------------

create table public.sheet_music (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  file_path text not null,
  file_type public.sheet_music_file_type not null,
  file_size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sheet_music_user_id_idx on public.sheet_music (user_id);
create index sheet_music_created_at_idx on public.sheet_music (created_at desc);

-- ---------------------------------------------------------------------------
-- Performance recordings & evaluation results
-- ---------------------------------------------------------------------------

create table public.performances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sheet_music_id uuid not null references public.sheet_music (id) on delete cascade,
  audio_path text not null,
  examiner_mode public.examiner_mode not null,
  check_tempo boolean not null default true,
  check_dynamics boolean not null default true,
  check_note_accuracy boolean not null default true,
  check_expression boolean not null default true,
  status public.performance_status not null default 'pending',
  total_score numeric(5, 2),
  max_score numeric(5, 2),
  score_breakdown jsonb,
  feedback jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index performances_user_id_idx on public.performances (user_id);
create index performances_sheet_music_id_idx on public.performances (sheet_music_id);
create index performances_created_at_idx on public.performances (created_at desc);

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Updated-at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger sheet_music_updated_at
  before update on public.sheet_music
  for each row execute function public.set_updated_at();

create trigger performances_updated_at
  before update on public.performances
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.sheet_music enable row level security;
alter table public.performances enable row level security;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Sheet music: users manage their own uploads
create policy "Users can view own sheet music"
  on public.sheet_music for select
  using (auth.uid() = user_id);

create policy "Users can insert own sheet music"
  on public.sheet_music for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sheet music"
  on public.sheet_music for update
  using (auth.uid() = user_id);

create policy "Users can delete own sheet music"
  on public.sheet_music for delete
  using (auth.uid() = user_id);

-- Performances: users manage their own recordings
create policy "Users can view own performances"
  on public.performances for select
  using (auth.uid() = user_id);

create policy "Users can insert own performances"
  on public.performances for insert
  with check (auth.uid() = user_id);

create policy "Users can update own performances"
  on public.performances for update
  using (auth.uid() = user_id);

create policy "Users can delete own performances"
  on public.performances for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage buckets (run in Supabase Dashboard or via SQL)
-- ---------------------------------------------------------------------------
-- insert into storage.buckets (id, name, public) values ('sheet-music', 'sheet-music', false);
-- insert into storage.buckets (id, name, public) values ('performances', 'performances', false);

-- Storage policies (users access only their own folder: {user_id}/...)
-- create policy "Users can upload own sheet music"
--   on storage.objects for insert
--   with check (
--     bucket_id = 'sheet-music'
--     and auth.uid()::text = (storage.foldername(name))[1]
--   );
-- (Add matching select/update/delete policies for both buckets.)
