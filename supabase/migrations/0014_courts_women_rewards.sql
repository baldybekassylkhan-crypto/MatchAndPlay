-- Match&Play — этап 13: обращения о бесплатных площадках для акимата, игры только для девушек,
-- награды от партнёров за подтверждённые игры, язык интерфейса
-- Запускать после 0013_weather_ranking_shake.sql

-- ═════════════ Площадки и обращения ═════════════

create table public.court_reports (
  id            uuid primary key default gen_random_uuid(),
  -- id площадки из OpenStreetMap (public/venues), например n10242167716
  venue_id      text not null check (char_length(venue_id) between 2 and 40),
  city_id       smallint not null references public.cities (id),
  venue_name    text not null check (char_length(btrim(venue_name)) between 2 and 120),
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  kind          text not null check (kind in ('hoop', 'net', 'goal', 'surface', 'lighting', 'fence', 'trash', 'other')),
  comment       text check (char_length(comment) <= 300),
  photo_path    text check (char_length(photo_path) <= 300),
  -- new — новое, sent — передано в акимат, in_progress — в работе, fixed — исправлено, rejected — отклонено
  status        text not null default 'new' check (status in ('new', 'sent', 'in_progress', 'fixed', 'rejected')),
  admin_note    text check (char_length(admin_note) <= 300),
  votes         integer not null default 1 check (votes >= 0),
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create index court_reports_city_idx on public.court_reports (city_id, status, created_at desc);
create index court_reports_venue_idx on public.court_reports (venue_id, status);
-- Одна открытая проблема одного вида на площадке: повторные обращения становятся голосами
create unique index court_reports_open_key on public.court_reports (venue_id, kind) where status in ('new', 'sent', 'in_progress');

create table public.court_report_votes (
  report_id   uuid not null references public.court_reports (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (report_id, user_id)
);

alter table public.court_reports enable row level security;
alter table public.court_report_votes enable row level security;
create policy "court_reports: читают все" on public.court_reports for select using (true);
create policy "court_report_votes: свои" on public.court_report_votes for select to authenticated using (user_id = auth.uid());
-- Менять можно только через функции ниже

-- Сообщить о проблеме. Если такая проблема уже открыта — голос «у меня тоже».
create or replace function public.report_court_issue(
  p_venue_id text, p_city_id smallint, p_venue_name text, p_lat double precision, p_lng double precision,
  p_kind text, p_comment text, p_photo_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if (select count(*) from public.court_reports where created_by = v_uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too_many_reports' using errcode = 'P0001';
  end if;
  if p_photo_path is not null and split_part(p_photo_path, '/', 1) <> v_uid::text then
    raise exception 'bad_photo' using errcode = 'P0001';
  end if;

  select id into v_id from public.court_reports
   where venue_id = p_venue_id and kind = p_kind and status in ('new', 'sent', 'in_progress');
  if v_id is not null then
    insert into public.court_report_votes (report_id, user_id) values (v_id, v_uid) on conflict do nothing;
    if found then update public.court_reports set votes = votes + 1, updated_at = now() where id = v_id; end if;
    return jsonb_build_object('id', v_id, 'existing', true);
  end if;

  insert into public.court_reports (venue_id, city_id, venue_name, lat, lng, kind, comment, photo_path, created_by)
  values (p_venue_id, p_city_id, btrim(p_venue_name), p_lat, p_lng, p_kind,
          nullif(btrim(coalesce(p_comment, '')), ''), p_photo_path, v_uid)
  returning id into v_id;
  insert into public.court_report_votes (report_id, user_id) values (v_id, v_uid);
  return jsonb_build_object('id', v_id, 'existing', false);
end;
$$;

create or replace function public.vote_court_report(p_report_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_votes integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.court_reports where id = p_report_id and status in ('new', 'sent', 'in_progress')) then
    raise exception 'report_closed' using errcode = 'P0001';
  end if;
  insert into public.court_report_votes (report_id, user_id) values (p_report_id, auth.uid()) on conflict do nothing;
  if found then
    update public.court_reports set votes = votes + 1, updated_at = now() where id = p_report_id returning votes into v_votes;
  else
    select votes into v_votes from public.court_reports where id = p_report_id;
  end if;
  return v_votes;
end;
$$;

-- Модератор меняет статус; автор и все, кто голосовал, получают уведомление
create or replace function public.set_court_report_status(p_report_id uuid, p_status text, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r public.court_reports;
begin
  if not public.is_app_admin() then raise exception 'not_admin' using errcode = 'P0001'; end if;
  if p_status not in ('new', 'sent', 'in_progress', 'fixed', 'rejected') then raise exception 'bad_status' using errcode = 'P0001'; end if;
  update public.court_reports
     set status = p_status,
         admin_note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), admin_note),
         updated_at = now(),
         resolved_at = case when p_status in ('fixed', 'rejected') then now() else null end
   where id = p_report_id
  returning * into v_r;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if p_status in ('sent', 'in_progress', 'fixed', 'rejected') then
    perform public.notify(v.user_id, 'court_report_' || p_status,
             jsonb_build_object('report_id', v_r.id, 'venue', v_r.venue_name, 'kind', v_r.kind, 'note', v_r.admin_note))
       from public.court_report_votes v where v.report_id = v_r.id;
  end if;
end;
$$;

revoke all on function public.report_court_issue(text, smallint, text, double precision, double precision, text, text, text) from public, anon;
revoke all on function public.vote_court_report(uuid) from public, anon;
revoke all on function public.set_court_report_status(uuid, text, text) from public, anon;
grant execute on function public.report_court_issue(text, smallint, text, double precision, double precision, text, text, text) to authenticated;
grant execute on function public.vote_court_report(uuid) to authenticated;
grant execute on function public.set_court_report_status(uuid, text, text) to authenticated;

-- ═════════════ Игры только для девушек ═════════════

-- Пол указывается по желанию; нужен, чтобы создавать игры «только для девушек» и вступать в них
alter table public.profiles add column if not exists gender text check (gender in ('female', 'male'));
alter table public.lobbies add column if not exists women_only boolean not null default false;

create or replace function public.guard_women_only_lobby()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.women_only and (tg_op = 'INSERT' or not old.women_only) and auth.role() = 'authenticated'
     and coalesce((select gender from public.profiles where id = new.organizer_id), '') <> 'female' then
    raise exception 'women_only_organizer' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists lobbies_women_only on public.lobbies;
create trigger lobbies_women_only
  before insert or update of women_only on public.lobbies
  for each row execute function public.guard_women_only_lobby();

create or replace function public.guard_women_only_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select l.women_only from public.lobbies l where l.id = new.lobby_id)
     and coalesce((select gender from public.profiles where id = new.user_id), '') <> 'female' then
    raise exception 'women_only' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists applications_women_only on public.lobby_applications;
create trigger applications_women_only
  before insert on public.lobby_applications
  for each row execute function public.guard_women_only_application();

-- ═════════════ Награды от партнёров ═════════════

create table public.sponsors (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 60),
  kind        text not null default 'store' check (kind in ('store', 'cafe', 'gym', 'services', 'other')),
  -- Цвет плашки партнёра, например #ff6b00
  color       text not null default '#0a84ff' check (color ~ '^#[0-9a-fA-F]{6}$'),
  logo_url    text check (char_length(logo_url) <= 300),
  website     text check (char_length(website) <= 200),
  address     text check (char_length(address) <= 200),
  city_id     smallint references public.cities (id),
  created_at  timestamptz not null default now()
);

create table public.reward_offers (
  id              uuid primary key default gen_random_uuid(),
  sponsor_id      uuid not null references public.sponsors (id) on delete cascade,
  title           text not null check (char_length(btrim(title)) between 3 and 80),
  description     text check (char_length(description) <= 300),
  -- Сколько подтверждённых игр нужно сыграть за календарный месяц
  games_required  smallint not null check (games_required between 1 and 60),
  sport           text check (sport in ('football','basketball','volleyball','tennis','padel','hockey','table_tennis','badminton','running','other')),
  city_id         smallint references public.cities (id),
  -- Сколько наград можно выдать за месяц (null — без ограничения)
  monthly_limit   integer check (monthly_limit > 0),
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table public.reward_claims (
  id           uuid primary key default gen_random_uuid(),
  offer_id     uuid not null references public.reward_offers (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  month        date not null,
  code         text not null unique,
  claimed_at   timestamptz not null default now(),
  redeemed_at  timestamptz,
  unique (offer_id, user_id, month)
);
create index reward_claims_user_idx on public.reward_claims (user_id, claimed_at desc);

alter table public.sponsors enable row level security;
alter table public.reward_offers enable row level security;
alter table public.reward_claims enable row level security;
create policy "sponsors: читают все" on public.sponsors for select using (true);
create policy "reward_offers: читают все" on public.reward_offers for select using (true);
create policy "reward_claims: свои" on public.reward_claims for select to authenticated using (user_id = auth.uid() or public.is_app_admin());

-- Подтверждённые игры за месяц: я отметился, и на игре отметились минимум двое
create or replace function public.verified_games_in_month(p_user_id uuid, p_month date default null, p_sport text default null)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public.lobby_checkins mine
    join public.lobbies l on l.id = mine.lobby_id
   where mine.user_id = p_user_id
     and l.start_time >= public.kz_month_start(p_month) and l.start_time < public.kz_month_start(p_month, 1)
     and (p_sport is null or l.sport = p_sport)
     and (select count(*) from public.lobby_checkins c where c.lobby_id = mine.lobby_id) >= 2;
$$;

-- Награды для меня: прогресс за текущий месяц и уже полученные коды
create or replace function public.get_my_rewards()
returns table (
  offer_id uuid, title text, description text, games_required smallint, sport text,
  sponsor_name text, sponsor_kind text, sponsor_color text, sponsor_address text,
  progress integer, code text, claimed_at timestamptz, redeemed_at timestamptz, sold_out boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select id, city_id from public.profiles where id = auth.uid()),
       m as (select (public.kz_month_start() + interval '5 hours')::date as month)
  select o.id, o.title, o.description, o.games_required, o.sport,
         s.name, s.kind, s.color, s.address,
         public.verified_games_in_month(me.id, null, o.sport),
         c.code, c.claimed_at, c.redeemed_at,
         (o.monthly_limit is not null and c.id is null and
          (select count(*) from public.reward_claims x, m where x.offer_id = o.id and x.month = m.month) >= o.monthly_limit)
    from me, m, public.reward_offers o
    join public.sponsors s on s.id = o.sponsor_id
    left join public.reward_claims c on c.offer_id = o.id and c.user_id = auth.uid() and c.month = (select month from m)
   where o.active and (o.city_id is null or o.city_id = me.city_id)
   order by (c.id is not null) desc, o.games_required;
$$;

create or replace function public.claim_reward(p_offer_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_o public.reward_offers;
  v_month date := (public.kz_month_start() + interval '5 hours')::date;
  v_code text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  select * into v_o from public.reward_offers where id = p_offer_id and active;
  if not found then raise exception 'offer_not_found' using errcode = 'P0001'; end if;
  if v_o.city_id is not null and v_o.city_id <> (select city_id from public.profiles where id = v_uid) then
    raise exception 'offer_not_found' using errcode = 'P0001';
  end if;
  select code into v_code from public.reward_claims where offer_id = p_offer_id and user_id = v_uid and month = v_month;
  if v_code is not null then return v_code; end if;
  if public.verified_games_in_month(v_uid, null, v_o.sport) < v_o.games_required then
    raise exception 'not_enough_games' using errcode = 'P0001';
  end if;
  -- Блокируем предложение, чтобы лимит на месяц не превысили одновременные запросы
  perform 1 from public.reward_offers where id = p_offer_id for update;
  if v_o.monthly_limit is not null
     and (select count(*) from public.reward_claims where offer_id = p_offer_id and month = v_month) >= v_o.monthly_limit then
    raise exception 'sold_out' using errcode = 'P0001';
  end if;
  loop
    v_code := 'MP-' || upper(substr(encode(sha256((gen_random_uuid()::text)::bytea), 'hex'), 1, 4)) || '-'
                    || upper(substr(encode(sha256((gen_random_uuid()::text)::bytea), 'hex'), 1, 4));
    exit when not exists (select 1 from public.reward_claims where code = v_code);
  end loop;
  insert into public.reward_claims (offer_id, user_id, month, code) values (p_offer_id, v_uid, v_month, v_code);
  return v_code;
end;
$$;

-- Партнёр проверяет код и отмечает его использованным (пока это делает модератор приложения)
create or replace function public.redeem_reward_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c public.reward_claims;
begin
  if not public.is_app_admin() then raise exception 'not_admin' using errcode = 'P0001'; end if;
  select * into v_c from public.reward_claims where code = upper(btrim(p_code));
  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if v_c.redeemed_at is not null then return jsonb_build_object('status', 'used', 'redeemed_at', v_c.redeemed_at); end if;
  update public.reward_claims set redeemed_at = now() where id = v_c.id;
  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function public.verified_games_in_month(uuid, date, text) from public, anon;
revoke all on function public.get_my_rewards() from public, anon;
revoke all on function public.claim_reward(uuid) from public, anon;
revoke all on function public.redeem_reward_code(text) from public, anon;
grant execute on function public.verified_games_in_month(uuid, date, text) to authenticated;
grant execute on function public.get_my_rewards() to authenticated;
grant execute on function public.claim_reward(uuid) to authenticated;
grant execute on function public.redeem_reward_code(text) to authenticated;

-- ═════════════ Язык интерфейса ═════════════
alter table public.profiles add column if not exists locale text not null default 'ru' check (locale in ('ru', 'kk'));
