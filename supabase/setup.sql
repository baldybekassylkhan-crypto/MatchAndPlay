-- Match&Play — все миграции (0001–0007) одним файлом для Supabase SQL Editor.
-- Собрано из supabase/migrations. Запускать один раз на чистом проекте.

-- ════════════════════════ migrations/0001_init.sql ════════════════════════
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

-- ════════════════════════ migrations/0002_cities.sql ════════════════════════
-- 21 город Казахстана (координаты центра города)
insert into public.cities (id, slug, name_ru, name_kz, aliases, lat, lng, sort_order) values
  (1,  'astana',          'Астана',            'Астана',       array['Нур-Султан','Нурсултан','Целиноград','Акмола','Astana'],          51.1694, 71.4491, 1),
  (2,  'almaty',          'Алматы',            'Алматы',       array['Алма-Ата','Алмата','Almaty'],                                     43.2389, 76.8897, 2),
  (3,  'shymkent',        'Шымкент',           'Шымкент',      array['Чимкент','Shymkent'],                                              42.3417, 69.5901, 3),
  (4,  'karaganda',       'Караганда',         'Қарағанды',    array['Караганды','Karaganda'],49.8047, 73.1094, 4),
  (5,  'aktobe',          'Актобе',            'Ақтөбе',       array['Актюбинск','Aktobe'],                                              50.2839, 57.1670, 5),
  (6,  'taraz',           'Тараз',             'Тараз',        array['Джамбул','Жамбыл','Taraz'],                                        42.9000, 71.3667, 6),
  (7,  'pavlodar',        'Павлодар',          'Павлодар',     array['Pavlodar'],                                                        52.2873, 76.9674, 7),
  (8,  'oskemen',         'Усть-Каменогорск',  'Өскемен',      array['Оскемен','Усть-Каман','Ust-Kamenogorsk','Oskemen'],                49.9483, 82.6275, 8),
  (9,  'semey',           'Семей',             'Семей',        array['Семипалатинск','Semey'],                                           50.4111, 80.2275, 9),
  (10, 'atyrau',          'Атырау',            'Атырау',       array['Гурьев','Atyrau'],                                                 47.1167, 51.8833, 10),
  (11, 'kostanay',        'Костанай',          'Қостанай',     array['Кустанай','Kostanay'],                                             53.2144, 63.6246, 11),
  (12, 'kyzylorda',       'Кызылорда',         'Қызылорда',    array['Кзыл-Орда','Kyzylorda'],                                           44.8488, 65.4823, 12),
  (13, 'oral',            'Уральск',           'Орал',         array['Орал','Uralsk','Oral'],                                            51.2333, 51.3667, 13),
  (14, 'petropavl',       'Петропавловск',     'Петропавл',    array['Петропавл','Petropavl','Petropavlovsk'],                           54.8667, 69.1500, 14),
  (15, 'aktau',           'Актау',             'Ақтау',        array['Шевченко','Aktau'],                                                43.6500, 51.1667, 15),
  (16, 'turkistan',       'Туркестан',         'Түркістан',    array['Туркистан','Turkistan'],                                           43.2973, 68.2518, 16),
  (17, 'kokshetau',       'Кокшетау',          'Көкшетау',     array['Кокчетав','Kokshetau'],                                            53.2833, 69.4000, 17),
  (18, 'taldykorgan',     'Талдыкорган',       'Талдықорған',  array['Талды-Курган','Taldykorgan'],                                      45.0156, 78.3739, 18),
  (19, 'temirtau',        'Темиртау',          'Теміртау',     array['Temirtau'],                                                        50.0549, 72.9646, 19),
  (20, 'zhezkazgan',      'Жезказган',         'Жезқазған',    array['Джезказган','Zhezkazgan'],                                         47.7833, 67.7667, 20),
  (21, 'konaev',          'Конаев',            'Қонаев',       array['Капчагай','Капшагай','Qonaev','Konaev'],                           43.8667, 77.0667, 21)
on conflict (id) do update set
  slug = excluded.slug, name_ru = excluded.name_ru, name_kz = excluded.name_kz,
  aliases = excluded.aliases, lat = excluded.lat, lng = excluded.lng, sort_order = excluded.sort_order;

-- ════════════════════════ migrations/0003_lobbies.sql ════════════════════════
-- Match&Play — этап 2: лобби, заявки с ручным одобрением, правило 30 минут
-- Все изменения статусов идут через функции (RPC), чтобы правила нельзя было обойти с клиента.

create type public.lobby_status as enum ('active', 'full', 'cancelled', 'finished');
create type public.application_status as enum ('pending', 'accepted', 'rejected', 'cancelled');

-- ───────────── Лобби ─────────────
create table public.lobbies (
  id               uuid primary key default gen_random_uuid(),
  organizer_id     uuid not null references public.profiles (id) on delete cascade,
  sport            text not null check (sport in ('football','basketball','volleyball','tennis','padel','hockey','table_tennis','badminton','running','other')),
  description      text not null check (char_length(description) between 3 and 300),
  -- Сколько человек уже есть у организатора (включая его самого)
  players_current  smallint not null check (players_current between 1 and 50),
  -- Сколько игроков ещё нужно найти
  players_needed   smallint not null check (players_needed between 1 and 50),
  -- Сколько заявок принято (меняют только функции ниже)
  accepted_count   smallint not null default 0 check (accepted_count >= 0),
  start_time       timestamptz not null,
  duration_min     smallint not null default 90 check (duration_min between 15 and 600),
  city_id          smallint not null references public.cities (id),
  location_name    text not null check (char_length(location_name) between 2 and 120),
  lat              double precision check (lat between -90 and 90),
  lng              double precision check (lng between -180 and 180),
  level            public.skill_level,
  price_kzt        integer check (price_kzt between 0 and 100000),
  status           public.lobby_status not null default 'active',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint lobbies_accepted_le_needed check (accepted_count <= players_needed)
);

create index lobbies_search_idx on public.lobbies (city_id, status, start_time);
create index lobbies_organizer_idx on public.lobbies (organizer_id, start_time desc);

alter table public.lobbies enable row level security;

create policy "lobbies: читают все" on public.lobbies for select using (true);
create policy "lobbies: создать своё" on public.lobbies
  for insert to authenticated
  with check (auth.uid() = organizer_id and start_time > now());
create policy "lobbies: менять своё" on public.lobbies
  for update to authenticated
  using (auth.uid() = organizer_id) with check (auth.uid() = organizer_id);

-- Клиент не может сам менять счётчик, статус и организатора; редактировать можно только будущую активную игру.
create or replace function public.guard_lobby_write()
returns trigger
language plpgsql
as $$
declare
  bypass boolean := coalesce(current_setting('app.bypass_counters', true), '') = 'on';
begin
  new.updated_at := now();
  if bypass or auth.role() is distinct from 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.accepted_count := 0;
    new.status := 'active';
    return new;
  end if;

  if old.status not in ('active', 'full') or old.start_time <= now() then
    raise exception 'lobby_locked' using errcode = 'P0001';
  end if;
  if new.start_time <= now() then
    raise exception 'start_in_past' using errcode = 'P0001';
  end if;
  if new.players_needed < old.accepted_count then
    raise exception 'needed_below_accepted' using errcode = 'P0001';
  end if;

  new.organizer_id := old.organizer_id;
  new.accepted_count := old.accepted_count;
  new.status := case when new.players_needed <= old.accepted_count then 'full' else 'active' end;
  return new;
end;
$$;

create trigger lobbies_guard
  before insert or update on public.lobbies
  for each row execute function public.guard_lobby_write();

-- ───────────── Заявки ─────────────
create table public.lobby_applications (
  id          uuid primary key default gen_random_uuid(),
  lobby_id    uuid not null references public.lobbies (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  message     text check (char_length(message) <= 200),
  status      public.application_status not null default 'pending',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  decided_at  timestamptz,
  unique (lobby_id, user_id)
);

create index applications_user_idx on public.lobby_applications (user_id, status);
create index applications_lobby_idx on public.lobby_applications (lobby_id, status);

alter table public.lobby_applications enable row level security;

-- Принятых участников видят все (список игроков на странице лобби);
-- остальные заявки — только сам заявитель и организатор.
create policy "applications: видимость" on public.lobby_applications
  for select using (
    status = 'accepted'
    or user_id = auth.uid()
    or exists (select 1 from public.lobbies l where l.id = lobby_id and l.organizer_id = auth.uid())
  );
-- Прямых insert/update/delete нет: только через функции ниже.

-- ───────────── Функции (RPC) ─────────────

-- Подать заявку
create or replace function public.apply_to_lobby(p_lobby_id uuid, p_message text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lobby public.lobbies;
  v_app public.lobby_applications;
  v_msg text := nullif(btrim(coalesce(p_message, '')), '');
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_msg is not null and char_length(v_msg) > 200 then raise exception 'message_too_long' using errcode = 'P0001'; end if;

  select * into v_lobby from public.lobbies where id = p_lobby_id for update;
  if not found then raise exception 'lobby_not_found' using errcode = 'P0001'; end if;
  if v_lobby.organizer_id = v_uid then raise exception 'own_lobby' using errcode = 'P0001'; end if;
  if v_lobby.status = 'cancelled' then raise exception 'lobby_cancelled' using errcode = 'P0001'; end if;
  if v_lobby.start_time <= now() or v_lobby.status = 'finished' then raise exception 'lobby_started' using errcode = 'P0001'; end if;
  if v_lobby.status = 'full' then raise exception 'lobby_full' using errcode = 'P0001'; end if;

  select * into v_app from public.lobby_applications where lobby_id = p_lobby_id and user_id = v_uid;
  if found then
    if v_app.status in ('pending', 'accepted') then raise exception 'already_applied' using errcode = 'P0001'; end if;
    if v_app.status = 'rejected' then raise exception 'was_rejected' using errcode = 'P0001'; end if;
    update public.lobby_applications
       set status = 'pending', message = v_msg, updated_at = now(), decided_at = null
     where id = v_app.id;
    return v_app.id;
  end if;

  insert into public.lobby_applications (lobby_id, user_id, message)
  values (p_lobby_id, v_uid, v_msg)
  returning id into v_app.id;
  return v_app.id;
end;
$$;

-- Организатор принимает или отклоняет заявку
create or replace function public.decide_application(p_application_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.lobby_applications;
  v_lobby public.lobbies;
begin
  select * into v_app from public.lobby_applications where id = p_application_id for update;
  if not found then raise exception 'application_not_found' using errcode = 'P0001'; end if;

  select * into v_lobby from public.lobbies where id = v_app.lobby_id for update;
  if v_lobby.organizer_id is distinct from v_uid then raise exception 'not_organizer' using errcode = 'P0001'; end if;
  if v_app.status <> 'pending' then raise exception 'already_decided' using errcode = 'P0001'; end if;
  if v_lobby.status in ('cancelled', 'finished') or v_lobby.start_time <= now() then
    raise exception 'lobby_started' using errcode = 'P0001';
  end if;

  if p_accept then
    if v_lobby.accepted_count >= v_lobby.players_needed then raise exception 'lobby_full' using errcode = 'P0001'; end if;
    update public.lobby_applications set status = 'accepted', decided_at = now(), updated_at = now() where id = v_app.id;

    perform set_config('app.bypass_counters', 'on', true);
    update public.lobbies
       set accepted_count = accepted_count + 1,
           status = case when accepted_count + 1 >= players_needed then 'full'::public.lobby_status else 'active'::public.lobby_status end
     where id = v_lobby.id;
    perform set_config('app.bypass_counters', 'off', true);
  else
    update public.lobby_applications set status = 'rejected', decided_at = now(), updated_at = now() where id = v_app.id;
  end if;
end;
$$;

-- Игрок отменяет заявку или отказывается от игры.
-- Принятый игрок может отказаться не позднее чем за 30 минут до начала.
create or replace function public.cancel_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_app public.lobby_applications;
  v_lobby public.lobbies;
begin
  select * into v_app from public.lobby_applications where id = p_application_id for update;
  if not found or v_app.user_id is distinct from v_uid then raise exception 'application_not_found' using errcode = 'P0001'; end if;
  if v_app.status not in ('pending', 'accepted') then raise exception 'already_decided' using errcode = 'P0001'; end if;

  select * into v_lobby from public.lobbies where id = v_app.lobby_id for update;
  if v_lobby.start_time <= now() then raise exception 'lobby_started' using errcode = 'P0001'; end if;

  if v_app.status = 'accepted' then
    if v_lobby.status <> 'cancelled' and v_lobby.start_time - now() < interval '30 minutes' then
      raise exception 'too_late_to_leave' using errcode = 'P0001';
    end if;

    perform set_config('app.bypass_counters', 'on', true);
    update public.lobbies
       set accepted_count = greatest(accepted_count - 1, 0),
           status = case when status = 'full' then 'active'::public.lobby_status else status end
     where id = v_lobby.id;
    perform set_config('app.bypass_counters', 'off', true);
  end if;

  update public.lobby_applications set status = 'cancelled', updated_at = now() where id = v_app.id;
end;
$$;

-- Организатор отменяет игру
create or replace function public.cancel_lobby(p_lobby_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lobby public.lobbies;
begin
  select * into v_lobby from public.lobbies where id = p_lobby_id for update;
  if not found or v_lobby.organizer_id is distinct from auth.uid() then raise exception 'not_organizer' using errcode = 'P0001'; end if;
  if v_lobby.status not in ('active', 'full') or v_lobby.start_time <= now() then
    raise exception 'lobby_locked' using errcode = 'P0001';
  end if;

  perform set_config('app.bypass_counters', 'on', true);
  update public.lobbies set status = 'cancelled' where id = p_lobby_id;
  perform set_config('app.bypass_counters', 'off', true);
end;
$$;

-- Завершает прошедшие игры и начисляет «сыгранные игры» организатору и принятым игрокам.
-- Запускается по расписанию (pg_cron), вызывать с клиента нельзя.
create or replace function public.finish_past_lobbies()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  perform set_config('app.bypass_counters', 'on', true);

  with done as (
    update public.lobbies
       set status = 'finished'
     where status in ('active', 'full')
       and start_time + make_interval(mins => duration_min) < now()
    returning id, organizer_id
  ),
  players as (
    select organizer_id as user_id from done
    union all
    select a.user_id from public.lobby_applications a join done d on d.id = a.lobby_id where a.status = 'accepted'
  ),
  totals as (
    select user_id, count(*)::int as n from players group by user_id
  )
  update public.profiles p set games_played = p.games_played + t.n from totals t where p.id = t.user_id;

  get diagnostics v_count = row_count;
  perform set_config('app.bypass_counters', 'off', true);
  return v_count;
end;
$$;

revoke all on function public.finish_past_lobbies() from public, anon, authenticated;

grant execute on function public.apply_to_lobby(uuid, text) to authenticated;
grant execute on function public.decide_application(uuid, boolean) to authenticated;
grant execute on function public.cancel_application(uuid) to authenticated;
grant execute on function public.cancel_lobby(uuid) to authenticated;
revoke execute on function public.apply_to_lobby(uuid, text) from anon;
revoke execute on function public.decide_application(uuid, boolean) from anon;
revoke execute on function public.cancel_application(uuid) from anon;
revoke execute on function public.cancel_lobby(uuid) from anon;

-- ───────────── Расписание ─────────────
-- pg_cron входит в бесплатный тариф Supabase.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('finish-past-lobbies', '*/10 * * * *', $$select public.finish_past_lobbies()$$);

-- ════════════════════════ migrations/0004_swipes_saved.sql ════════════════════════
-- Match&Play — этап 3: свайпы и сохранённые лобби

-- ───────────── Свайпы ─────────────
-- Помним, какие карточки пользователь уже видел, чтобы не показывать их повторно.
create table public.swipes (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  lobby_id    uuid not null references public.lobbies (id) on delete cascade,
  direction   text not null check (direction in ('left', 'right')),
  created_at  timestamptz not null default now(),
  primary key (user_id, lobby_id)
);

alter table public.swipes enable row level security;
create policy "swipes: свои" on public.swipes
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ───────────── Сохранённые ─────────────
create table public.saved_lobbies (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  lobby_id    uuid not null references public.lobbies (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, lobby_id)
);

create index saved_lobbies_lobby_idx on public.saved_lobbies (lobby_id);

alter table public.saved_lobbies enable row level security;
create policy "saved: свои" on public.saved_lobbies
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ───────────── Автоочистка ─────────────
-- Сохранённое исчезает, когда игра началась, прошла или отменена.
-- Заполненные лобби просто скрываются в запросе: если место освободится, лобби вернётся.
-- Свайпы по прошедшим играм больше не нужны.
create or replace function public.cleanup_saved_and_swipes()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.saved_lobbies s
   using public.lobbies l
   where l.id = s.lobby_id
     and (l.start_time <= now() or l.status in ('cancelled', 'finished'));

  delete from public.swipes w
   using public.lobbies l
   where l.id = w.lobby_id
     and l.start_time <= now() - interval '1 day';
$$;

revoke all on function public.cleanup_saved_and_swipes() from public, anon, authenticated;

select cron.schedule('cleanup-saved-and-swipes', '*/15 * * * *', $$select public.cleanup_saved_and_swipes()$$);

-- ════════════════════════ migrations/0005_ai_quota.sql ════════════════════════
-- Match&Play — этап 4: лимит запросов к умному поиску (бесплатный тариф Gemini)

create table public.ai_search_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index ai_search_log_user_idx on public.ai_search_log (user_id, created_at desc);

alter table public.ai_search_log enable row level security;
-- Прямого доступа нет: только функция ниже.

-- Списывает один запрос и возвращает true, если лимит не превышен:
-- не больше 8 запросов в минуту и 100 в сутки на пользователя.
create or replace function public.consume_ai_quota()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_minute int;
  v_day int;
begin
  if v_uid is null then return false; end if;

  select count(*) filter (where created_at > now() - interval '1 minute'),
         count(*)
    into v_minute, v_day
    from public.ai_search_log
   where user_id = v_uid and created_at > now() - interval '1 day';

  if v_minute >= 8 or v_day >= 100 then return false; end if;

  insert into public.ai_search_log (user_id) values (v_uid);
  return true;
end;
$$;

revoke all on function public.consume_ai_quota() from public, anon;
grant execute on function public.consume_ai_quota() to authenticated;

-- Старые записи не нужны
select cron.schedule('cleanup-ai-search-log', '0 3 * * *', $$delete from public.ai_search_log where created_at < now() - interval '2 days'$$);

-- ════════════════════════ migrations/0006_posts.sql ════════════════════════
-- Match&Play — этап 5: посты, хайлайты, лайки, комментарии

-- ───────────── Посты ─────────────
-- media: [{ "type": "image" | "video", "path": "<user_id>/<file>", "w": 1080, "h": 1350, "duration": 12.3 }]
create table public.posts (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references public.profiles (id) on delete cascade,
  caption        text check (char_length(caption) <= 1000),
  sport          text check (sport in ('football','basketball','volleyball','tennis','padel','hockey','table_tennis','badminton','running','other')),
  -- Привязка к сыгранной игре делает пост «хайлайтом»
  lobby_id       uuid references public.lobbies (id) on delete set null,
  media          jsonb not null check (jsonb_typeof(media) = 'array' and jsonb_array_length(media) between 1 and 10),
  like_count     integer not null default 0 check (like_count >= 0),
  comment_count  integer not null default 0 check (comment_count >= 0),
  created_at     timestamptz not null default now()
);

create index posts_author_idx on public.posts (author_id, created_at desc);
create index posts_created_idx on public.posts (created_at desc);
create index posts_highlights_idx on public.posts (author_id, created_at desc) where lobby_id is not null;

alter table public.posts enable row level security;
create policy "posts: читают все" on public.posts for select using (true);
create policy "posts: публиковать свои" on public.posts
  for insert to authenticated with check (auth.uid() = author_id);
create policy "posts: менять свои" on public.posts
  for update to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "posts: удалять свои" on public.posts
  for delete to authenticated using (auth.uid() = author_id);

-- Счётчики меняют только триггеры; хайлайт можно привязать только к своей прошедшей игре.
create or replace function public.guard_post_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bypass boolean := coalesce(current_setting('app.bypass_counters', true), '') = 'on';
begin
  if not bypass and auth.role() = 'authenticated' then
    if tg_op = 'INSERT' then
      new.like_count := 0;
      new.comment_count := 0;
    else
      new.like_count := old.like_count;
      new.comment_count := old.comment_count;
      new.author_id := old.author_id;
      new.media := old.media;
      new.created_at := old.created_at;
    end if;
  end if;

  if new.lobby_id is not null and (tg_op = 'INSERT' or new.lobby_id is distinct from old.lobby_id) then
    if not exists (
      select 1 from public.lobbies l
       where l.id = new.lobby_id
         and l.status <> 'cancelled'
         and l.start_time <= now()
         and (l.organizer_id = new.author_id
              or exists (select 1 from public.lobby_applications a
                          where a.lobby_id = l.id and a.user_id = new.author_id and a.status = 'accepted'))
    ) then
      raise exception 'not_your_game' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger posts_guard
  before insert or update on public.posts
  for each row execute function public.guard_post_write();

-- ───────────── Лайки ─────────────
create table public.likes (
  post_id     uuid not null references public.posts (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index likes_user_idx on public.likes (user_id);

alter table public.likes enable row level security;
create policy "likes: читают все" on public.likes for select using (true);
create policy "likes: ставить свои" on public.likes
  for insert to authenticated with check (auth.uid() = user_id);
create policy "likes: убирать свои" on public.likes
  for delete to authenticated using (auth.uid() = user_id);

-- ───────────── Комментарии ─────────────
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  text        text not null check (char_length(btrim(text)) between 1 and 500),
  created_at  timestamptz not null default now()
);

create index comments_post_idx on public.comments (post_id, created_at);

alter table public.comments enable row level security;
create policy "comments: читают все" on public.comments for select using (true);
create policy "comments: писать свои" on public.comments
  for insert to authenticated with check (auth.uid() = user_id);
-- Удалить комментарий может его автор или автор поста
create policy "comments: удалять" on public.comments
  for delete to authenticated using (
    auth.uid() = user_id
    or exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid())
  );

-- ───────────── Счётчики ─────────────
create or replace function public.bump_post_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delta int := case when tg_op = 'INSERT' then 1 else -1 end;
  pid uuid := coalesce(new.post_id, old.post_id);
begin
  perform set_config('app.bypass_counters', 'on', true);
  if tg_table_name = 'likes' then
    update public.posts set like_count = greatest(like_count + delta, 0) where id = pid;
  else
    update public.posts set comment_count = greatest(comment_count + delta, 0) where id = pid;
  end if;
  perform set_config('app.bypass_counters', 'off', true);
  return null;
end;
$$;

create trigger likes_count after insert or delete on public.likes
  for each row execute function public.bump_post_counter();
create trigger comments_count after insert or delete on public.comments
  for each row execute function public.bump_post_counter();

-- ───────────── Хранилище фото и видео ─────────────
-- Лимиты бесплатного тарифа: фото сжимаются до ~1 МБ на устройстве, видео до 20 МБ и 30 секунд.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('posts', 'posts', true, 20971520,
        array['image/webp', 'image/jpeg', 'image/png', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;

create policy "posts media: читают все" on storage.objects
  for select using (bucket_id = 'posts');
create policy "posts media: загрузка в свою папку" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "posts media: удаление своих" on storage.objects
  for delete to authenticated
  using (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);

-- ════════════════════════ migrations/0007_chat_notifications.sql ════════════════════════
-- Match&Play — этап 6: чат лобби, уведомления, напоминания, Web Push

-- ═════════════ Чат лобби ═════════════

-- Участник лобби = организатор или принятый игрок.
create or replace function public.is_lobby_member(p_lobby_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.lobbies l where l.id = p_lobby_id and l.organizer_id = p_user_id)
      or exists (select 1 from public.lobby_applications a
                  where a.lobby_id = p_lobby_id and a.user_id = p_user_id and a.status = 'accepted');
$$;

create table public.lobby_messages (
  id          uuid primary key default gen_random_uuid(),
  lobby_id    uuid not null references public.lobbies (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  text        text not null check (char_length(btrim(text)) between 1 and 1000),
  created_at  timestamptz not null default now()
);

create index lobby_messages_lobby_idx on public.lobby_messages (lobby_id, created_at);

alter table public.lobby_messages enable row level security;
create policy "chat: читают участники" on public.lobby_messages
  for select to authenticated using (public.is_lobby_member(lobby_id, auth.uid()));
create policy "chat: пишут участники" on public.lobby_messages
  for insert to authenticated with check (
    auth.uid() = user_id
    and public.is_lobby_member(lobby_id, auth.uid())
    and exists (select 1 from public.lobbies l where l.id = lobby_id and l.status <> 'cancelled')
  );

-- ═════════════ Уведомления ═════════════

create table public.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null,
  payload     jsonb not null default '{}',
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where not read;

alter table public.notifications enable row level security;
create policy "notifications: свои" on public.notifications
  for select to authenticated using (auth.uid() = user_id);
create policy "notifications: отмечать свои" on public.notifications
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notifications: удалять свои" on public.notifications
  for delete to authenticated using (auth.uid() = user_id);

-- Клиент может менять только флаг «прочитано»
revoke insert, update on public.notifications from anon, authenticated;
grant update (read) on public.notifications to authenticated;

-- Создать уведомление (только из триггеров и функций ниже)
create or replace function public.notify(p_user_id uuid, p_type text, p_payload jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, type, payload)
  select p_user_id, p_type, coalesce(p_payload, '{}'::jsonb)
  where p_user_id is not null;
$$;

revoke all on function public.notify(uuid, text, jsonb) from public, anon, authenticated;

-- Краткая информация об игре для текста уведомления
create or replace function public.lobby_payload(p_lobby public.lobbies, p_actor_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'lobby_id', p_lobby.id,
    'sport', p_lobby.sport,
    'start_time', p_lobby.start_time,
    'location', p_lobby.location_name,
    'actor', (select username from public.profiles where id = p_actor_id),
    'actor_avatar', (select avatar_url from public.profiles where id = p_actor_id)
  );
$$;

-- Заявки: новая заявка → организатору; решение → игроку; игрок отказался → организатору
create or replace function public.on_application_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lobby public.lobbies;
begin
  select * into v_lobby from public.lobbies where id = new.lobby_id;

  if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending') then
    perform public.notify(v_lobby.organizer_id, 'application_new',
      public.lobby_payload(v_lobby, new.user_id) || jsonb_build_object('message', new.message));
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform public.notify(new.user_id, 'application_accepted', public.lobby_payload(v_lobby, v_lobby.organizer_id));
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'rejected' then
    perform public.notify(new.user_id, 'application_rejected', public.lobby_payload(v_lobby, v_lobby.organizer_id));
  elsif tg_op = 'UPDATE' and old.status = 'accepted' and new.status = 'cancelled' and v_lobby.status <> 'cancelled' then
    perform public.notify(v_lobby.organizer_id, 'player_left', public.lobby_payload(v_lobby, new.user_id));
  end if;
  return null;
end;
$$;

create trigger applications_notify
  after insert or update of status on public.lobby_applications
  for each row execute function public.on_application_change();

-- Лобби отменено или изменено → всем принятым и ожидающим
create or replace function public.on_lobby_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_changes jsonb := '[]'::jsonb;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    v_type := 'lobby_cancelled';
  elsif new.status in ('active', 'full') and old.status in ('active', 'full') then
    if new.start_time is distinct from old.start_time or new.duration_min is distinct from old.duration_min then
      v_changes := v_changes || '"time"';
    end if;
    if new.location_name is distinct from old.location_name or new.city_id is distinct from old.city_id
       or new.lat is distinct from old.lat or new.lng is distinct from old.lng then
      v_changes := v_changes || '"place"';
    end if;
    if new.price_kzt is distinct from old.price_kzt then v_changes := v_changes || '"price"'; end if;
    if new.description is distinct from old.description or new.level is distinct from old.level then
      v_changes := v_changes || '"details"';
    end if;
    if jsonb_array_length(v_changes) > 0 then v_type := 'lobby_updated'; end if;
  end if;

  if v_type is not null then
    perform public.notify(a.user_id, v_type, public.lobby_payload(new, new.organizer_id) || jsonb_build_object('changes', v_changes))
       from public.lobby_applications a
      where a.lobby_id = new.id and a.status in ('accepted', 'pending');
  end if;
  return null;
end;
$$;

create trigger lobbies_notify
  after update on public.lobbies
  for each row execute function public.on_lobby_change();

-- Подписки, лайки, комментарии
create or replace function public.on_social_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
  v_actor jsonb;
begin
  if tg_table_name = 'follows' then
    select jsonb_build_object('actor', username, 'actor_avatar', avatar_url) into v_actor from public.profiles where id = new.follower_id;
    perform public.notify(new.following_id, 'follow', v_actor);
    return null;
  end if;

  select author_id into v_author from public.posts where id = new.post_id;
  if v_author is null or v_author = new.user_id then return null; end if;
  select jsonb_build_object('actor', username, 'actor_avatar', avatar_url, 'post_id', new.post_id)
    into v_actor from public.profiles where id = new.user_id;

  if tg_table_name = 'likes' then
    -- Не спамим: один лайк от человека на пост — одно уведомление
    if not exists (select 1 from public.notifications n
                    where n.user_id = v_author and n.type = 'like'
                      and n.payload->>'post_id' = new.post_id::text and n.payload->>'actor' = v_actor->>'actor') then
      perform public.notify(v_author, 'like', v_actor);
    end if;
  else
    perform public.notify(v_author, 'comment', v_actor || jsonb_build_object('text', left(new.text, 120)));
  end if;
  return null;
end;
$$;

create trigger follows_notify after insert on public.follows for each row execute function public.on_social_event();
create trigger likes_notify after insert on public.likes for each row execute function public.on_social_event();
create trigger comments_notify after insert on public.comments for each row execute function public.on_social_event();

-- ═════════════ Напоминания перед игрой ═════════════

create table public.lobby_reminders (
  lobby_id  uuid not null references public.lobbies (id) on delete cascade,
  kind      text not null check (kind in ('2h', '30m')),
  sent_at   timestamptz not null default now(),
  primary key (lobby_id, kind)
);
alter table public.lobby_reminders enable row level security;

create or replace function public.send_game_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select l.*, k.kind
      from public.lobbies l
     cross join (values ('2h'), ('30m')) as k(kind)
     where l.status in ('active', 'full')
       and l.start_time > now()
       and ((k.kind = '2h' and l.start_time <= now() + interval '2 hours' and l.start_time > now() + interval '35 minutes')
         or (k.kind = '30m' and l.start_time <= now() + interval '30 minutes'))
       and not exists (select 1 from public.lobby_reminders x where x.lobby_id = l.id and x.kind = k.kind)
  loop
    insert into public.lobby_reminders (lobby_id, kind) values (r.id, r.kind) on conflict do nothing;
    perform public.notify(u.user_id, 'reminder_' || r.kind,
             jsonb_build_object('lobby_id', r.id, 'sport', r.sport, 'start_time', r.start_time, 'location', r.location_name))
       from (select r.organizer_id as user_id
             union
             select a.user_id from public.lobby_applications a where a.lobby_id = r.id and a.status = 'accepted') u;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.send_game_reminders() from public, anon, authenticated;
select cron.schedule('game-reminders', '*/5 * * * *', $$select public.send_game_reminders()$$);

-- Старые уведомления (старше 60 дней) удаляем
select cron.schedule('cleanup-notifications', '30 3 * * *', $$delete from public.notifications where created_at < now() - interval '60 days'$$);

-- ═════════════ Web Push ═════════════

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy "push: свои" on public.push_subscriptions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Сохранить подписку устройства. Если на этом устройстве раньше был другой аккаунт,
-- подписка переходит текущему, чтобы push не уходили прошлому пользователю.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000 then raise exception 'bad_endpoint' using errcode = 'P0001'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end;
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

-- Настройки отправки push: адрес API приложения и общий секрет.
-- Схема private не видна через API Supabase.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.settings (
  key    text primary key,
  value  text not null
);
-- Политик нет: читать может только владелец (функция dispatch_push ниже)
alter table private.settings enable row level security;

-- pg_net — HTTP-запросы из базы (входит в бесплатный тариф)
create extension if not exists pg_net;

-- Каждое новое уведомление → POST на /api/push приложения, оттуда — Web Push на устройства
create or replace function private.dispatch_push()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_url text;
  v_secret text;
begin
  select value into v_url from private.settings where key = 'push_url';
  select value into v_secret from private.settings where key = 'push_secret';
  if v_url is null or v_secret is null then return null; end if;
  if not exists (select 1 from public.push_subscriptions where user_id = new.user_id) then return null; end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    timeout_milliseconds := 5000
  );
  return null;
end;
$$;

create trigger notifications_push
  after insert on public.notifications
  for each row execute function private.dispatch_push();

-- ═════════════ Realtime ═════════════
-- Чат и счётчик уведомлений обновляются без перезагрузки страницы
alter publication supabase_realtime add table public.lobby_messages, public.notifications;
