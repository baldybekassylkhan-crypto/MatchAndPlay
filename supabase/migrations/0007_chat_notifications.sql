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
