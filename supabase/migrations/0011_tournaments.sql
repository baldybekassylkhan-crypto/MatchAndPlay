-- Match&Play — этап 11: турниры с модерацией и турнирной сеткой
-- Запускать после 0010_crews_messages.sql
--
-- Администратор назначается только вручную в Supabase SQL Editor (через приложение это сделать нельзя):
--   insert into public.app_admins (user_id)
--   select id from public.profiles where username = 'ваш_ник';

-- ═════════════ Администраторы ═════════════

create table public.app_admins (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.app_admins enable row level security;
create policy "app_admins: видеть себя" on public.app_admins
  for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.app_admins from anon, authenticated;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins a where a.user_id = auth.uid());
$$;

-- ═════════════ Таблицы ═════════════

create table public.tournaments (
  id                    uuid primary key default gen_random_uuid(),
  organizer_id          uuid not null references public.profiles (id) on delete cascade,
  name                  text not null check (char_length(btrim(name)) between 3 and 60),
  description           text not null check (char_length(btrim(description)) between 10 and 1000),
  rules                 text check (char_length(rules) <= 1000),
  sport                 text not null check (sport in ('football','basketball','volleyball','tennis','padel','hockey','table_tennis','badminton','running','other')),
  city_id               smallint not null references public.cities (id),
  location_name         text not null check (char_length(btrim(location_name)) between 2 and 120),
  lat                   double precision check (lat between -90 and 90),
  lng                   double precision check (lng between -180 and 180),
  starts_at             timestamptz not null,
  registration_ends_at  timestamptz not null,
  max_teams             smallint not null check (max_teams in (4, 8, 16, 32)),
  team_size             smallint not null check (team_size between 1 and 25),
  entry_fee_kzt         integer not null default 0 check (entry_fee_kzt between 0 and 1000000),
  prize                 text check (char_length(prize) <= 200),
  status                text not null default 'pending'
                        check (status in ('pending', 'rejected', 'registration', 'in_progress', 'finished', 'cancelled')),
  rejection_reason      text check (char_length(rejection_reason) <= 300),
  reviewed_by           uuid references public.profiles (id) on delete set null,
  reviewed_at           timestamptz,
  winner_team_id        uuid,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint tournaments_dates check (registration_ends_at <= starts_at)
);

create index tournaments_list_idx on public.tournaments (status, city_id, starts_at);
create index tournaments_organizer_idx on public.tournaments (organizer_id, created_at desc);

-- Контакт организатора видят только он сам и модератор
create table public.tournament_contacts (
  tournament_id  uuid primary key references public.tournaments (id) on delete cascade,
  contact        text not null check (char_length(btrim(contact)) between 3 and 100)
);

create table public.tournament_teams (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references public.tournaments (id) on delete cascade,
  name           text not null check (char_length(btrim(name)) between 2 and 40),
  captain_id     uuid not null references public.profiles (id) on delete cascade,
  crew_id        uuid references public.crews (id) on delete set null,
  seed           smallint,
  created_at     timestamptz not null default now(),
  unique (tournament_id, captain_id)
);

create unique index tournament_teams_name_key on public.tournament_teams (tournament_id, lower(btrim(name)));
create index tournament_teams_captain_idx on public.tournament_teams (captain_id);

alter table public.tournaments
  add constraint tournaments_winner_fkey foreign key (winner_team_id) references public.tournament_teams (id) on delete set null;

create table public.tournament_matches (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references public.tournaments (id) on delete cascade,
  round          smallint not null check (round >= 1),
  position       smallint not null check (position >= 0),
  team_a_id      uuid references public.tournament_teams (id) on delete set null,
  team_b_id      uuid references public.tournament_teams (id) on delete set null,
  score_a        smallint check (score_a between 0 and 999),
  score_b        smallint check (score_b between 0 and 999),
  winner_id      uuid references public.tournament_teams (id) on delete set null,
  -- waiting: ждёт соперников, ready: можно играть, finished: сыгран, bye: проход без игры
  status         text not null default 'waiting' check (status in ('waiting', 'ready', 'finished', 'bye')),
  updated_at     timestamptz not null default now(),
  unique (tournament_id, round, position)
);

-- ═════════════ Доступ ═════════════

create or replace function public.can_view_tournament(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tournaments t
     where t.id = p_id
       and (t.status in ('registration', 'in_progress', 'finished', 'cancelled')
            or t.organizer_id = auth.uid()
            or public.is_app_admin())
  );
$$;

alter table public.tournaments enable row level security;
alter table public.tournament_contacts enable row level security;
alter table public.tournament_teams enable row level security;
alter table public.tournament_matches enable row level security;

-- На модерации и отклонённые турниры видят только организатор и модератор
create policy "tournaments: опубликованные и свои" on public.tournaments
  for select to authenticated using (public.can_view_tournament(id));
create policy "tournament_contacts: организатор и модератор" on public.tournament_contacts
  for select to authenticated using (
    public.is_app_admin()
    or exists (select 1 from public.tournaments t where t.id = tournament_id and t.organizer_id = auth.uid())
  );
create policy "tournament_teams: как у турнира" on public.tournament_teams
  for select to authenticated using (public.can_view_tournament(tournament_id));
create policy "tournament_matches: как у турнира" on public.tournament_matches
  for select to authenticated using (public.can_view_tournament(tournament_id));
-- Прямых изменений нет: всё проходит через функции ниже.

-- ═════════════ Создание и модерация ═════════════

create or replace function public.notify_tournament_captains(p_tournament public.tournaments, p_type text)
returns void
language sql
security definer
set search_path = public
as $$
  select public.notify(tm.captain_id, p_type, jsonb_build_object(
           'tournament_id', p_tournament.id, 'tournament_name', p_tournament.name, 'sport', p_tournament.sport))
    from public.tournament_teams tm
   where tm.tournament_id = p_tournament.id;
$$;

-- Создать заявку или исправить свою (после исправления турнир снова уходит на модерацию)
create or replace function public.save_tournament(
  p_id uuid, p_name text, p_description text, p_rules text, p_sport text, p_city_id smallint,
  p_location text, p_lat double precision, p_lng double precision,
  p_starts_at timestamptz, p_registration_ends_at timestamptz,
  p_max_teams smallint, p_team_size smallint, p_entry_fee integer, p_prize text, p_contact text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := p_id;
  v_existing public.tournaments;
  v_admin uuid;
  v_actor text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if p_registration_ends_at <= now() then raise exception 'registration_in_past' using errcode = 'P0001'; end if;
  if p_registration_ends_at > p_starts_at then raise exception 'registration_after_start' using errcode = 'P0001'; end if;
  if p_starts_at > now() + interval '180 days' then raise exception 'start_too_far' using errcode = 'P0001'; end if;

  if v_id is null then
    if (select count(*) from public.tournaments where organizer_id = v_uid and status = 'pending') >= 3 then
      raise exception 'too_many_pending' using errcode = 'P0001';
    end if;
    insert into public.tournaments (organizer_id, name, description, rules, sport, city_id, location_name, lat, lng,
                                    starts_at, registration_ends_at, max_teams, team_size, entry_fee_kzt, prize)
    values (v_uid, btrim(p_name), btrim(p_description), nullif(btrim(coalesce(p_rules, '')), ''), p_sport, p_city_id,
            btrim(p_location), p_lat, p_lng, p_starts_at, p_registration_ends_at, p_max_teams, p_team_size,
            coalesce(p_entry_fee, 0), nullif(btrim(coalesce(p_prize, '')), ''))
    returning id into v_id;
  else
    select * into v_existing from public.tournaments where id = v_id for update;
    if not found or v_existing.organizer_id <> v_uid then raise exception 'not_organizer' using errcode = 'P0001'; end if;
    if v_existing.status not in ('pending', 'rejected') then raise exception 'tournament_locked' using errcode = 'P0001'; end if;
    update public.tournaments
       set name = btrim(p_name), description = btrim(p_description), rules = nullif(btrim(coalesce(p_rules, '')), ''),
           sport = p_sport, city_id = p_city_id, location_name = btrim(p_location), lat = p_lat, lng = p_lng,
           starts_at = p_starts_at, registration_ends_at = p_registration_ends_at, max_teams = p_max_teams,
           team_size = p_team_size, entry_fee_kzt = coalesce(p_entry_fee, 0), prize = nullif(btrim(coalesce(p_prize, '')), ''),
           status = 'pending', rejection_reason = null, reviewed_by = null, reviewed_at = null, updated_at = now()
     where id = v_id;
  end if;

  insert into public.tournament_contacts (tournament_id, contact) values (v_id, btrim(p_contact))
  on conflict (tournament_id) do update set contact = excluded.contact;

  -- Новая заявка или повторная отправка после отказа — сообщаем модераторам
  if v_existing.id is null or v_existing.status = 'rejected' then
    select username into v_actor from public.profiles where id = v_uid;
    for v_admin in select user_id from public.app_admins loop
      perform public.notify(v_admin, 'tournament_review', jsonb_build_object(
        'tournament_id', v_id, 'tournament_name', btrim(p_name), 'sport', p_sport, 'actor', v_actor));
    end loop;
  end if;
  return v_id;
end;
$$;

create or replace function public.review_tournament(p_id uuid, p_approve boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t public.tournaments;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_app_admin() then raise exception 'not_admin' using errcode = 'P0001'; end if;
  select * into v_t from public.tournaments where id = p_id for update;
  if not found then raise exception 'tournament_not_found' using errcode = 'P0001'; end if;
  if v_t.status <> 'pending' then raise exception 'already_reviewed' using errcode = 'P0001'; end if;
  if not p_approve and v_reason is null then raise exception 'reason_required' using errcode = 'P0001'; end if;

  update public.tournaments
     set status = case when p_approve then 'registration' else 'rejected' end,
         rejection_reason = case when p_approve then null else left(v_reason, 300) end,
         reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
   where id = p_id;

  perform public.notify(v_t.organizer_id, case when p_approve then 'tournament_approved' else 'tournament_rejected' end,
    jsonb_build_object('tournament_id', v_t.id, 'tournament_name', v_t.name, 'sport', v_t.sport,
                       'text', case when p_approve then null else left(v_reason, 120) end));
end;
$$;

-- ═════════════ Регистрация команд ═════════════

create or replace function public.register_tournament_team(p_tournament_id uuid, p_name text, p_crew_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_t public.tournaments;
  v_id uuid;
  v_actor text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  select * into v_t from public.tournaments where id = p_tournament_id for update;
  if not found or not public.can_view_tournament(p_tournament_id) then raise exception 'tournament_not_found' using errcode = 'P0001'; end if;
  if v_t.status <> 'registration' or v_t.registration_ends_at <= now() then
    raise exception 'registration_closed' using errcode = 'P0001';
  end if;
  if public.is_blocked_between(v_uid, v_t.organizer_id) then raise exception 'user_blocked' using errcode = 'P0001'; end if;
  if exists (select 1 from public.tournament_teams where tournament_id = v_t.id and captain_id = v_uid) then
    raise exception 'already_registered' using errcode = 'P0001';
  end if;
  if (select count(*) from public.tournament_teams where tournament_id = v_t.id) >= v_t.max_teams then
    raise exception 'tournament_full' using errcode = 'P0001';
  end if;
  if p_crew_id is not null and not public.is_crew_captain(p_crew_id, v_uid) then
    raise exception 'not_captain' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.tournament_teams
              where tournament_id = v_t.id and lower(btrim(name)) = lower(btrim(p_name))) then
    raise exception 'team_name_taken' using errcode = 'P0001';
  end if;

  insert into public.tournament_teams (tournament_id, name, captain_id, crew_id)
  values (v_t.id, btrim(p_name), v_uid, p_crew_id)
  returning id into v_id;

  if v_t.organizer_id <> v_uid then
    select username into v_actor from public.profiles where id = v_uid;
    perform public.notify(v_t.organizer_id, 'tournament_team', jsonb_build_object(
      'tournament_id', v_t.id, 'tournament_name', v_t.name, 'sport', v_t.sport, 'actor', v_actor, 'text', btrim(p_name)));
  end if;
  return v_id;
end;
$$;

-- Снять команду до старта может её капитан или организатор
create or replace function public.withdraw_tournament_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_team public.tournament_teams;
  v_t public.tournaments;
begin
  select * into v_team from public.tournament_teams where id = p_team_id;
  if not found then raise exception 'team_not_found' using errcode = 'P0001'; end if;
  select * into v_t from public.tournaments where id = v_team.tournament_id for update;
  if v_uid is distinct from v_team.captain_id and v_uid is distinct from v_t.organizer_id then
    raise exception 'not_organizer' using errcode = 'P0001';
  end if;
  if v_t.status <> 'registration' then raise exception 'registration_closed' using errcode = 'P0001'; end if;
  delete from public.tournament_teams where id = p_team_id;
  if v_uid <> v_team.captain_id then
    perform public.notify(v_team.captain_id, 'tournament_team_removed', jsonb_build_object(
      'tournament_id', v_t.id, 'tournament_name', v_t.name, 'sport', v_t.sport));
  end if;
end;
$$;

-- ═════════════ Сетка ═════════════

-- Победитель уходит в матч следующего раунда; когда оба соперника известны, матч готов
create or replace function public.advance_tournament_winner(p_tournament uuid, p_round smallint, p_position smallint, p_winner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_position smallint := p_position / 2;
begin
  if p_position % 2 = 0 then
    update public.tournament_matches set team_a_id = p_winner, updated_at = now()
     where tournament_id = p_tournament and round = p_round + 1 and position = v_next_position;
  else
    update public.tournament_matches set team_b_id = p_winner, updated_at = now()
     where tournament_id = p_tournament and round = p_round + 1 and position = v_next_position;
  end if;
  update public.tournament_matches
     set status = case when team_a_id is not null and team_b_id is not null then 'ready' else 'waiting' end
   where tournament_id = p_tournament and round = p_round + 1 and position = v_next_position;
end;
$$;

-- Старт: жеребьёвка, стандартная расстановка, свободные проходы при неполной сетке
create or replace function public.start_tournament(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t public.tournaments;
  v_team_ids uuid[];
  v_count integer;
  v_size integer := 2;
  v_rounds integer := 1;
  v_slots integer[] := array[1];
  v_next integer[];
  v_s integer;
  v_round integer;
  v_position integer;
  v_a uuid;
  v_b uuid;
begin
  select * into v_t from public.tournaments where id = p_id for update;
  if not found then raise exception 'tournament_not_found' using errcode = 'P0001'; end if;
  if v_t.organizer_id is distinct from auth.uid() and not public.is_app_admin() then
    raise exception 'not_organizer' using errcode = 'P0001';
  end if;
  if v_t.status <> 'registration' then raise exception 'tournament_locked' using errcode = 'P0001'; end if;

  select array_agg(id order by random()) into v_team_ids from public.tournament_teams where tournament_id = p_id;
  v_count := coalesce(array_length(v_team_ids, 1), 0);
  if v_count < 2 then raise exception 'not_enough_teams' using errcode = 'P0001'; end if;

  while v_size < v_count loop
    v_size := v_size * 2;
    v_rounds := v_rounds + 1;
  end loop;

  -- 1 против последнего, 2 против предпоследнего, и сильные номера встречаются только в конце
  while coalesce(array_length(v_slots, 1), 0) < v_size loop
    v_next := array[]::integer[];
    foreach v_s in array v_slots loop
      v_next := v_next || v_s || (array_length(v_slots, 1) * 2 + 1 - v_s);
    end loop;
    v_slots := v_next;
  end loop;

  for v_position in 1..v_count loop
    update public.tournament_teams set seed = v_position where id = v_team_ids[v_position];
  end loop;

  for v_round in 1..v_rounds loop
    for v_position in 0..(v_size / (2 ^ v_round))::integer - 1 loop
      insert into public.tournament_matches (tournament_id, round, position)
      values (p_id, v_round, v_position);
    end loop;
  end loop;

  for v_position in 0..(v_size / 2 - 1) loop
    v_a := case when v_slots[v_position * 2 + 1] <= v_count then v_team_ids[v_slots[v_position * 2 + 1]] end;
    v_b := case when v_slots[v_position * 2 + 2] <= v_count then v_team_ids[v_slots[v_position * 2 + 2]] end;
    update public.tournament_matches
       set team_a_id = v_a, team_b_id = v_b,
           status = case when v_a is not null and v_b is not null then 'ready' else 'bye' end,
           winner_id = case when v_a is null then v_b when v_b is null then v_a end
     where tournament_id = p_id and round = 1 and position = v_position;
  end loop;

  for v_position in 0..(v_size / 2 - 1) loop
    select winner_id into v_a from public.tournament_matches
     where tournament_id = p_id and round = 1 and position = v_position and status = 'bye';
    if v_a is not null then
      perform public.advance_tournament_winner(p_id, 1::smallint, v_position::smallint, v_a);
    end if;
  end loop;

  update public.tournaments set status = 'in_progress', updated_at = now() where id = p_id;
  perform public.notify_tournament_captains(v_t, 'tournament_started');
end;
$$;

-- Результат матча. При ничьей организатор указывает победителя (пенальти, доп. время)
create or replace function public.report_tournament_match(p_match_id uuid, p_score_a smallint, p_score_b smallint, p_winner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m public.tournament_matches;
  v_t public.tournaments;
  v_winner uuid;
  v_last_round smallint;
  v_next public.tournament_matches;
begin
  select * into v_m from public.tournament_matches where id = p_match_id;
  if not found then raise exception 'match_not_found' using errcode = 'P0001'; end if;
  select * into v_t from public.tournaments where id = v_m.tournament_id for update;
  select * into v_m from public.tournament_matches where id = p_match_id for update;

  if v_t.organizer_id is distinct from auth.uid() and not public.is_app_admin() then
    raise exception 'not_organizer' using errcode = 'P0001';
  end if;
  if v_t.status not in ('in_progress', 'finished') then raise exception 'tournament_locked' using errcode = 'P0001'; end if;
  if v_m.status not in ('ready', 'finished') or v_m.team_a_id is null or v_m.team_b_id is null then
    raise exception 'match_not_ready' using errcode = 'P0001';
  end if;
  if p_score_a is null or p_score_b is null or p_score_a < 0 or p_score_b < 0 or p_score_a > 999 or p_score_b > 999 then
    raise exception 'bad_score' using errcode = 'P0001';
  end if;

  if p_score_a > p_score_b then
    v_winner := v_m.team_a_id;
  elsif p_score_b > p_score_a then
    v_winner := v_m.team_b_id;
  elsif p_winner in (v_m.team_a_id, v_m.team_b_id) then
    v_winner := p_winner;
  else
    raise exception 'winner_required' using errcode = 'P0001';
  end if;

  select max(round) into v_last_round from public.tournament_matches where tournament_id = v_t.id;

  -- Победителя можно исправить, только пока следующий матч не сыгран
  if v_m.status = 'finished' and v_m.winner_id is distinct from v_winner and v_m.round < v_last_round then
    select * into v_next from public.tournament_matches
     where tournament_id = v_t.id and round = v_m.round + 1 and position = v_m.position / 2;
    if v_next.status = 'finished' then raise exception 'next_match_played' using errcode = 'P0001'; end if;
  end if;

  update public.tournament_matches
     set score_a = p_score_a, score_b = p_score_b, winner_id = v_winner, status = 'finished', updated_at = now()
   where id = v_m.id;

  if v_m.round < v_last_round then
    perform public.advance_tournament_winner(v_t.id, v_m.round, v_m.position, v_winner);
  else
    update public.tournaments set status = 'finished', winner_team_id = v_winner, updated_at = now() where id = v_t.id;
    if v_t.status = 'in_progress' then perform public.notify_tournament_captains(v_t, 'tournament_finished'); end if;
  end if;
end;
$$;

create or replace function public.cancel_tournament(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t public.tournaments;
begin
  select * into v_t from public.tournaments where id = p_id for update;
  if not found then raise exception 'tournament_not_found' using errcode = 'P0001'; end if;
  if v_t.organizer_id is distinct from auth.uid() and not public.is_app_admin() then
    raise exception 'not_organizer' using errcode = 'P0001';
  end if;
  if v_t.status in ('finished', 'cancelled') then raise exception 'tournament_locked' using errcode = 'P0001'; end if;
  update public.tournaments set status = 'cancelled', updated_at = now() where id = p_id;
  perform public.notify_tournament_captains(v_t, 'tournament_cancelled');
end;
$$;

-- ═════════════ Права на функции ═════════════

revoke all on function public.notify_tournament_captains(public.tournaments, text) from public, anon, authenticated;
revoke all on function public.advance_tournament_winner(uuid, smallint, smallint, uuid) from public, anon, authenticated;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.is_app_admin()',
    'public.can_view_tournament(uuid)',
    'public.save_tournament(uuid, text, text, text, text, smallint, text, double precision, double precision, timestamptz, timestamptz, smallint, smallint, integer, text, text)',
    'public.review_tournament(uuid, boolean, text)',
    'public.register_tournament_team(uuid, text, uuid)',
    'public.withdraw_tournament_team(uuid)',
    'public.start_tournament(uuid)',
    'public.report_tournament_match(uuid, smallint, smallint, uuid)',
    'public.cancel_tournament(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- ═════════════ Realtime ═════════════
-- Сетка у зрителей обновляется сразу после ввода результата
alter publication supabase_realtime add table public.tournament_matches;
