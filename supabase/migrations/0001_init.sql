-- Match&Play — этап 1: города, профили, подписки, аватары
-- Запускать в Supabase → SQL Editor (целиком), затем 0002_cities.sql

-- ───────────── Города ─────────────
create table public.cities (
  id          smallint primary key,
  slug        text not null unique,
  name_ru     text not null,
  name_kz     text not null,
  aliases     text[] not null default '{}',
  lat         double precision not null,
  lng         double precision not null,
  sort_order  smallint not null default 0
);

alter table public.cities enable row level security;
create policy "cities: читают все" on public.cities for select using (true);

-- ───────────── Профили ─────────────
create type public.skill_level as enum ('beginner', 'amateur', 'advanced');

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text not null,
  full_name     text check (char_length(full_name) <= 50),
  avatar_url    text,
  bio           text check (char_length(bio) <= 160),
  city_id       smallint not null references public.cities (id),
  sports        text[] not null default '{}',
  level         public.skill_level not null default 'amateur',
  games_played  integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_.]{3,20}$')
);

create unique index profiles_username_key on public.profiles (lower(username));
create index profiles_city_idx on public.profiles (city_id);

alter table public.profiles enable row level security;
create policy "profiles: читают все" on public.profiles for select using (true);
create policy "profiles: создать свой" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "profiles: менять свой" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Пользователь не может сам накрутить счётчик сыгранных игр.
-- Серверные функции следующих этапов включают флаг app.bypass_counters.
create or replace function public.protect_profile_counters()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'authenticated'
     and coalesce(current_setting('app.bypass_counters', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.games_played := 0;
    else
      new.games_played := old.games_played;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_protect_counters
  before insert or update on public.profiles
  for each row execute function public.protect_profile_counters();

-- ───────────── Подписки ─────────────
create table public.follows (
  follower_id   uuid not null references public.profiles (id) on delete cascade,
  following_id  uuid not null references public.profiles (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_not_self check (follower_id <> following_id)
);

create index follows_following_idx on public.follows (following_id);

alter table public.follows enable row level security;
create policy "follows: читают все" on public.follows for select using (true);
create policy "follows: подписаться самому" on public.follows
  for insert to authenticated with check (auth.uid() = follower_id);
create policy "follows: отписаться самому" on public.follows
  for delete to authenticated using (auth.uid() = follower_id);

-- ───────────── Хранилище аватаров ─────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 307200, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "avatars: читают все" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars: загрузка в свою папку" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: замена своих" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: удаление своих" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
