-- Match&Play — этап 12: погода для игр на улице, рейтинг команд города, отметка встряхиванием
-- Запускать после 0012_private_block_check.sql

-- ═════════════ Погода ═════════════

-- true — на улице, false — в зале, null — не указано (тогда предупреждений нет)
alter table public.lobbies add column if not exists is_outdoor boolean;

alter table public.lobby_reminders drop constraint if exists lobby_reminders_kind_check;
alter table public.lobby_reminders add constraint lobby_reminders_kind_check check (kind in ('2h', '30m', 'weather'));

-- Предупреждение о погоде: вызывает /api/weather (service role) после проверки прогноза.
-- Один раз на игру: повторный вызов ничего не делает. Возвращает true, если уведомления отправлены.
create or replace function public.send_weather_alert(p_lobby_id uuid, p_forecast jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lobby public.lobbies;
begin
  select * into v_lobby from public.lobbies where id = p_lobby_id;
  if not found or v_lobby.status not in ('active', 'full') or v_lobby.start_time <= now() then
    return false;
  end if;
  insert into public.lobby_reminders (lobby_id, kind) values (p_lobby_id, 'weather') on conflict do nothing;
  if not found then return false; end if;
  -- Прогноз хороший — только помечаем игру проверенной
  if p_forecast is null then return false; end if;

  perform public.notify(u.user_id, 'weather_alert',
           jsonb_build_object('lobby_id', v_lobby.id, 'sport', v_lobby.sport, 'start_time', v_lobby.start_time,
                              'location', v_lobby.location_name, 'weather', p_forecast))
     from (select v_lobby.organizer_id as user_id
           union
           select a.user_id from public.lobby_applications a where a.lobby_id = v_lobby.id and a.status = 'accepted') u;
  return true;
end;
$$;

revoke all on function public.send_weather_alert(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.send_weather_alert(uuid, jsonb) to service_role;

-- Каждые 15 минут база просит приложение проверить прогноз (адрес и секрет — те же, что для push)
create or replace function private.request_weather_check()
returns void
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
  if v_url is null or v_secret is null then return; end if;
  -- Нет игр на улице в ближайшие 3,5 часа — запрос не нужен
  if not exists (
    select 1 from public.lobbies l
     where l.is_outdoor and l.status in ('active', 'full')
       and l.start_time > now() and l.start_time <= now() + interval '3 hours 30 minutes'
       and not exists (select 1 from public.lobby_reminders r where r.lobby_id = l.id and r.kind = 'weather')
  ) then
    return;
  end if;
  perform net.http_post(
    url := regexp_replace(v_url, '/api/push$', '/api/weather'),
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function private.request_weather_check() from public, anon, authenticated;
select cron.schedule('weather-alerts', '*/15 * * * *', $$select private.request_weather_check()$$);

-- ═════════════ Рейтинг команд города ═════════════

alter table public.tournaments add column if not exists finished_at timestamptz;
update public.tournaments set finished_at = updated_at where status = 'finished' and finished_at is null;

create or replace function public.stamp_tournament_finished()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'finished' and (tg_op = 'INSERT' or old.status is distinct from 'finished') then
    new.finished_at := coalesce(new.finished_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists tournaments_finished_at on public.tournaments;
create trigger tournaments_finished_at
  before insert or update on public.tournaments
  for each row execute function public.stamp_tournament_finished();

create index if not exists tournaments_finished_idx on public.tournaments (sport, finished_at) where status = 'finished';
create index if not exists tournament_teams_crew_idx on public.tournament_teams (crew_id) where crew_id is not null;

-- Очки команды за один завершённый турнир:
--   место: победитель 100, финал 60, полуфинал 35, четвертьфинал 20, 1/8 — 10, раньше — 5;
--   × размер турнира: до 4 команд ×1, 8 — ×1,25, 16 — ×1,5, 32 — ×2;
--   + 5 за каждый выигранный матч (проход без игры не считается).
create or replace function public.crew_tournament_results(p_from timestamptz, p_to timestamptz)
returns table (crew_id uuid, tournament_id uuid, points integer, wins integer, title boolean)
language sql
stable
security definer
set search_path = public
as $$
  with t as (
    select t.id, t.sport, t.winner_team_id, t.max_teams,
           (select max(m.round) from public.tournament_matches m where m.tournament_id = t.id) as rounds
      from public.tournaments t
     where t.status = 'finished'
       and t.sport in ('football', 'basketball')
       and t.finished_at >= p_from and t.finished_at < p_to
  ),
  teams as (
    select tm.id as team_id, tm.crew_id, t.id as tournament_id, t.winner_team_id, t.max_teams, t.rounds
      from public.tournament_teams tm
      join t on t.id = tm.tournament_id
      join public.crews c on c.id = tm.crew_id and c.sport = t.sport
  ),
  scored as (
    select tm.*,
           (select min(m.round) from public.tournament_matches m
             where m.tournament_id = tm.tournament_id and m.status = 'finished'
               and tm.team_id in (m.team_a_id, m.team_b_id) and m.winner_id <> tm.team_id) as lost_round,
           (select count(*) from public.tournament_matches m
             where m.tournament_id = tm.tournament_id and m.status = 'finished' and m.winner_id = tm.team_id)::int as wins
      from teams tm
  )
  select s.crew_id, s.tournament_id,
         (round(
            (case
               when s.winner_team_id = s.team_id then 100
               when s.lost_round is null then 5
               else case s.rounds - s.lost_round when 0 then 60 when 1 then 35 when 2 then 20 when 3 then 10 else 5 end
             end)
            * case when s.max_teams >= 32 then 2.0 when s.max_teams >= 16 then 1.5 when s.max_teams >= 8 then 1.25 else 1.0 end
          ) + 5 * s.wins)::int as points,
         s.wins,
         s.winner_team_id = s.team_id as title
    from scored s;
$$;

-- Начало месяца по времени Казахстана (UTC+5); p_shift — сдвиг в месяцах (-1 — прошлый, 1 — следующий)
create or replace function public.kz_month_start(p_month date default null, p_shift integer default 0)
returns timestamptz
language sql
stable
as $$
  select (date_trunc('month', coalesce(p_month::timestamp, (now() at time zone 'UTC') + interval '5 hours'))
          + make_interval(months => coalesce(p_shift, 0)) - interval '5 hours') at time zone 'UTC';
$$;

-- Рейтинг команд города за месяц (по умолчанию — текущий). Каждый месяц рейтинг начинается с нуля.
-- prev_rank — место в прошлом месяце (null, если команда тогда не набирала очков).
create or replace function public.get_crew_ranking(p_city_id smallint, p_sport text, p_month date default null)
returns table (
  rank integer, crew_id uuid, name text, member_count smallint, is_open boolean,
  points integer, tournaments integer, wins integer, titles integer, prev_rank integer
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select public.kz_month_start(p_month) as cur_from,
           public.kz_month_start(p_month, 1) as cur_to,
           public.kz_month_start(p_month, -1) as prev_from
  ),
  crews as (
    select c.* from public.crews c where c.city_id = p_city_id and c.sport = p_sport and p_sport in ('football', 'basketball')
  ),
  cur as (
    select r.crew_id, sum(r.points)::int as points, count(*)::int as tournaments,
           sum(r.wins)::int as wins, count(*) filter (where r.title)::int as titles
      from bounds b, public.crew_tournament_results(b.cur_from, b.cur_to) r
     where r.crew_id in (select id from crews)
     group by r.crew_id
  ),
  prev as (
    select r.crew_id, rank() over (order by sum(r.points) desc, count(*) filter (where r.title) desc, sum(r.wins) desc)::int as rnk
      from bounds b, public.crew_tournament_results(b.prev_from, b.cur_from) r
     where r.crew_id in (select id from crews)
     group by r.crew_id
  )
  select (rank() over (order by cur.points desc, cur.titles desc, cur.wins desc))::int,
         c.id, c.name, c.member_count, c.is_open,
         cur.points, cur.tournaments, cur.wins, cur.titles, prev.rnk
    from cur
    join crews c on c.id = cur.crew_id
    left join prev on prev.crew_id = cur.crew_id
   order by cur.points desc, cur.titles desc, cur.wins desc, c.name
   limit 50;
$$;

revoke all on function public.crew_tournament_results(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.get_crew_ranking(smallint, text, date) from public, anon;
grant execute on function public.get_crew_ranking(smallint, text, date) to authenticated;

-- ═════════════ Отметка встряхиванием ═════════════
-- Вместо QR: игрок встряхивает телефон, приложение берёт точные координаты, а база проверяет,
-- что он в 15 метрах от точки игры или от организатора (плюс поправка на погрешность GPS, не больше 20 м).
-- Координаты игроков не сохраняются: в отметке остаётся только способ и расстояние.

drop function if exists public.get_checkin_code(uuid);
drop function if exists public.check_in(uuid, text);
drop function if exists private.checkin_code(text, bigint);
drop table if exists private.lobby_checkin_secrets;

alter table public.lobby_checkins add column if not exists method text not null default 'qr'
  check (method in ('qr', 'place', 'organizer', 'host'));
alter table public.lobby_checkins add column if not exists distance_m smallint;

-- Последняя точка организатора во время отметки. Не видна через API, удаляется через сутки.
create table if not exists private.organizer_positions (
  lobby_id    uuid primary key references public.lobbies (id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  accuracy_m  real not null,
  updated_at  timestamptz not null default now()
);
alter table private.organizer_positions enable row level security;

create or replace function private.distance_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- Ответ: { status: ok | already | closed | not_member | too_many | weak_gps | too_far | no_anchor, method, distance }
create or replace function public.shake_check_in(p_lobby_id uuid, p_lat double precision, p_lng double precision, p_accuracy double precision)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  c_radius constant double precision := 15;     -- метров
  c_slack  constant double precision := 20;     -- максимум поправки на погрешность GPS
  c_max_accuracy constant double precision := 50;
  v_uid uuid := auth.uid();
  v_lobby public.lobbies;
  v_is_org boolean;
  v_acc double precision := coalesce(p_accuracy, 9999);
  v_place double precision;
  v_org private.organizer_positions;
  v_org_dist double precision;
begin
  if v_uid is null then return jsonb_build_object('status', 'not_member'); end if;
  select * into v_lobby from public.lobbies where id = p_lobby_id;
  if not found then return jsonb_build_object('status', 'not_member'); end if;
  v_is_org := v_lobby.organizer_id = v_uid;
  if not v_is_org and not exists (
    select 1 from public.lobby_applications a
     where a.lobby_id = p_lobby_id and a.user_id = v_uid and a.status = 'accepted'
  ) then
    return jsonb_build_object('status', 'not_member');
  end if;
  if not private.checkin_is_open(v_lobby) then return jsonb_build_object('status', 'closed'); end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    return jsonb_build_object('status', 'weak_gps', 'accuracy', null);
  end if;

  delete from private.checkin_attempts where created_at < now() - interval '1 hour';
  if (select count(*) from private.checkin_attempts a
       where a.lobby_id = p_lobby_id and a.user_id = v_uid and a.created_at > now() - interval '1 minute') >= 6 then
    return jsonb_build_object('status', 'too_many');
  end if;
  insert into private.checkin_attempts (lobby_id, user_id) values (p_lobby_id, v_uid);

  if v_acc > c_max_accuracy then
    return jsonb_build_object('status', 'weak_gps', 'accuracy', round(v_acc));
  end if;

  if v_lobby.lat is not null and v_lobby.lng is not null then
    v_place := private.distance_m(p_lat, p_lng, v_lobby.lat, v_lobby.lng);
  end if;

  -- Организатор: его точка становится «маяком» для игроков, даже если точка игры на карте неточная
  if v_is_org then
    delete from private.organizer_positions where updated_at < now() - interval '1 day';
    insert into private.organizer_positions (lobby_id, lat, lng, accuracy_m, updated_at)
    values (p_lobby_id, p_lat, p_lng, v_acc, now())
    on conflict (lobby_id) do update set lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m, updated_at = now();

    if exists (select 1 from public.lobby_checkins c where c.lobby_id = p_lobby_id and c.user_id = v_uid) then
      return jsonb_build_object('status', 'already');
    end if;
    if v_place is null or v_place <= c_radius + least(v_acc, c_slack) then
      insert into public.lobby_checkins (lobby_id, user_id, method, distance_m)
      values (p_lobby_id, v_uid, 'place', case when v_place is null then null else least(round(v_place), 32000) end)
      on conflict do nothing;
      return jsonb_build_object('status', 'ok', 'method', 'place', 'distance', round(v_place));
    end if;
    -- Организатор далеко от своей точки: отметится автоматически, когда рядом с ним отметится игрок
    return jsonb_build_object('status', 'too_far', 'distance', round(v_place), 'host', true);
  end if;

  if exists (select 1 from public.lobby_checkins c where c.lobby_id = p_lobby_id and c.user_id = v_uid) then
    return jsonb_build_object('status', 'already');
  end if;

  if v_place is not null and v_place <= c_radius + least(v_acc, c_slack) then
    insert into public.lobby_checkins (lobby_id, user_id, method, distance_m)
    values (p_lobby_id, v_uid, 'place', round(v_place)) on conflict do nothing;
    return jsonb_build_object('status', 'ok', 'method', 'place', 'distance', round(v_place));
  end if;

  select * into v_org from private.organizer_positions
   where lobby_id = p_lobby_id and updated_at > now() - interval '5 minutes';
  if found then
    v_org_dist := private.distance_m(p_lat, p_lng, v_org.lat, v_org.lng);
    if v_org_dist <= c_radius + least(greatest(v_acc, v_org.accuracy_m), c_slack) then
      insert into public.lobby_checkins (lobby_id, user_id, method, distance_m)
      values (p_lobby_id, v_uid, 'organizer', round(v_org_dist)) on conflict do nothing;
      -- Игрок рядом с организатором — значит, организатор тоже на месте
      insert into public.lobby_checkins (lobby_id, user_id, method, distance_m)
      values (p_lobby_id, v_lobby.organizer_id, 'host', round(v_org_dist)) on conflict do nothing;
      return jsonb_build_object('status', 'ok', 'method', 'organizer', 'distance', round(v_org_dist));
    end if;
  end if;

  if v_place is null and v_org_dist is null then
    return jsonb_build_object('status', 'no_anchor');
  end if;
  return jsonb_build_object('status', 'too_far', 'distance', round(least(coalesce(v_place, v_org_dist), coalesce(v_org_dist, v_place))));
end;
$$;

-- Организатор держит открытым режим отметки: его точка обновляется, игроки видят счётчик
create or replace function public.update_organizer_position(p_lobby_id uuid, p_lat double precision, p_lng double precision, p_accuracy double precision)
returns integer
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_lobby public.lobbies;
begin
  select * into v_lobby from public.lobbies where id = p_lobby_id;
  if not found or v_lobby.organizer_id is distinct from auth.uid() then
    raise exception 'not_organizer' using errcode = 'P0001';
  end if;
  if not private.checkin_is_open(v_lobby) then raise exception 'checkin_closed' using errcode = 'P0001'; end if;
  if p_lat between -90 and 90 and p_lng between -180 and 180 and coalesce(p_accuracy, 9999) <= 50 then
    insert into private.organizer_positions (lobby_id, lat, lng, accuracy_m, updated_at)
    values (p_lobby_id, p_lat, p_lng, p_accuracy, now())
    on conflict (lobby_id) do update set lat = excluded.lat, lng = excluded.lng, accuracy_m = excluded.accuracy_m, updated_at = now();
  end if;
  return (select count(*)::int from public.lobby_checkins c where c.lobby_id = p_lobby_id);
end;
$$;

revoke all on function public.shake_check_in(uuid, double precision, double precision, double precision) from public, anon;
revoke all on function public.update_organizer_position(uuid, double precision, double precision, double precision) from public, anon;
grant execute on function public.shake_check_in(uuid, double precision, double precision, double precision) to authenticated;
grant execute on function public.update_organizer_position(uuid, double precision, double precision, double precision) to authenticated;
