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
