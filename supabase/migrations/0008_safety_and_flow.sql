-- Match&Play — этап 8: блокировки, жалобы, удаление игрока и аккаунта, чат-уведомления, исправления правил игры

-- ═════════════ Блокировки ═════════════

create table public.blocks (
  blocker_id  uuid not null references public.profiles (id) on delete cascade,
  blocked_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id, blocker_id);

alter table public.blocks enable row level security;
create policy "blocks: видеть свои" on public.blocks
  for select to authenticated using (auth.uid() = blocker_id);
create policy "blocks: снимать свои" on public.blocks
  for delete to authenticated using (auth.uid() = blocker_id);
-- Создаются только через block_user: функция заодно убирает подписки и заявки.

create or replace function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks b
     where (b.blocker_id = p_a and b.blocked_id = p_b)
        or (b.blocker_id = p_b and b.blocked_id = p_a)
  );
$$;

-- Заблокированные не видят посты, комментарии и сообщения друг друга
create policy "posts: скрыть при блокировке" on public.posts
  as restrictive for select
  using (auth.uid() is null or not public.is_blocked_between(auth.uid(), author_id));
create policy "comments: скрыть при блокировке" on public.comments
  as restrictive for select
  using (auth.uid() is null or not public.is_blocked_between(auth.uid(), user_id));
create policy "chat: скрыть при блокировке" on public.lobby_messages
  as restrictive for select to authenticated
  using (not public.is_blocked_between(auth.uid(), user_id));

-- Запрет взаимодействий между заблокированными (заявка, подписка, лайк, комментарий)
create or replace function public.guard_blocked_interaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_target uuid;
begin
  if tg_table_name = 'lobby_applications' then
    if new.status <> 'pending' then return new; end if;
    v_actor := new.user_id;
    select organizer_id into v_target from public.lobbies where id = new.lobby_id;
  elsif tg_table_name = 'follows' then
    v_actor := new.follower_id;
    v_target := new.following_id;
  else
    v_actor := new.user_id;
    select author_id into v_target from public.posts where id = new.post_id;
  end if;

  if public.is_blocked_between(v_actor, v_target) then
    raise exception 'user_blocked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger applications_block_guard before insert or update of status on public.lobby_applications
  for each row execute function public.guard_blocked_interaction();
create trigger follows_block_guard before insert on public.follows
  for each row execute function public.guard_blocked_interaction();
create trigger likes_block_guard before insert on public.likes
  for each row execute function public.guard_blocked_interaction();
create trigger comments_block_guard before insert on public.comments
  for each row execute function public.guard_blocked_interaction();

-- Освободить место в игре (только из функций ниже)
create or replace function public.release_lobby_slot(p_lobby_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.bypass_counters', 'on', true);
  update public.lobbies
     set accepted_count = greatest(accepted_count - 1, 0),
         status = case when status = 'full' then 'active'::public.lobby_status else status end
   where id = p_lobby_id;
  perform set_config('app.bypass_counters', 'off', true);
end;
$$;
revoke all on function public.release_lobby_slot(uuid) from public, anon, authenticated;

-- Заблокировать: убираем подписки, заявки в мои будущие игры и свои ожидающие заявки к этому человеку.
-- Уведомления при этом не отправляются, чтобы блокировка оставалась незаметной.
create or replace function public.block_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  r record;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if v_uid = p_user_id then raise exception 'cannot_block_self' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'user_not_found' using errcode = 'P0001';
  end if;

  insert into public.blocks (blocker_id, blocked_id) values (v_uid, p_user_id) on conflict do nothing;
  delete from public.follows
   where (follower_id = v_uid and following_id = p_user_id)
      or (follower_id = p_user_id and following_id = v_uid);

  perform set_config('app.silent_applications', 'on', true);
  for r in
    select a.id, a.lobby_id, a.status
      from public.lobby_applications a
      join public.lobbies l on l.id = a.lobby_id
     where a.user_id = p_user_id and l.organizer_id = v_uid
       and a.status in ('pending', 'accepted')
       and l.status in ('active', 'full') and l.start_time > now()
     for update of a
  loop
    update public.lobby_applications
       set status = 'rejected', decided_at = now(), updated_at = now()
     where id = r.id;
    if r.status = 'accepted' then perform public.release_lobby_slot(r.lobby_id); end if;
  end loop;

  update public.lobby_applications a
     set status = 'cancelled', updated_at = now()
    from public.lobbies l
   where l.id = a.lobby_id and a.user_id = v_uid and l.organizer_id = p_user_id and a.status = 'pending';
  perform set_config('app.silent_applications', 'off', true);
end;
$$;

revoke all on function public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;

-- ═════════════ Жалобы ═════════════
-- Читать жалобы может только владелец проекта: Supabase → Table Editor → reports.

create table public.reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid references public.profiles (id) on delete set null,
  target_user_id  uuid references public.profiles (id) on delete set null,
  lobby_id        uuid references public.lobbies (id) on delete set null,
  reason          text not null check (reason in ('harassment','spam','fake','dangerous','inappropriate','other')),
  details         text check (char_length(details) <= 500),
  status          text not null default 'open' check (status in ('open','reviewed','closed')),
  created_at      timestamptz not null default now(),
  constraint reports_not_self check (reporter_id <> target_user_id)
);

create unique index reports_one_open_idx on public.reports (reporter_id, target_user_id) where status = 'open';
create index reports_status_idx on public.reports (status, created_at desc);

alter table public.reports enable row level security;
create policy "reports: отправить свою" on public.reports
  for insert to authenticated with check (auth.uid() = reporter_id);

revoke all on public.reports from anon, authenticated;
grant insert (reporter_id, target_user_id, lobby_id, reason, details) on public.reports to authenticated;

-- ═════════════ Удаление игрока организатором ═════════════

create or replace function public.remove_player(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.lobby_applications;
  v_lobby public.lobbies;
begin
  select * into v_app from public.lobby_applications where id = p_application_id for update;
  if not found then raise exception 'application_not_found' using errcode = 'P0001'; end if;

  select * into v_lobby from public.lobbies where id = v_app.lobby_id for update;
  if v_lobby.organizer_id is distinct from auth.uid() then raise exception 'not_organizer' using errcode = 'P0001'; end if;
  if v_app.status <> 'accepted' then raise exception 'already_decided' using errcode = 'P0001'; end if;
  if v_lobby.status not in ('active', 'full') or v_lobby.start_time <= now() then
    raise exception 'lobby_started' using errcode = 'P0001';
  end if;

  -- Статус rejected не даёт подать заявку в эту игру повторно
  update public.lobby_applications set status = 'rejected', decided_at = now(), updated_at = now() where id = v_app.id;
  perform public.release_lobby_slot(v_lobby.id);
end;
$$;

revoke all on function public.remove_player(uuid) from public, anon;
grant execute on function public.remove_player(uuid) to authenticated;

-- Уведомления о заявках: добавлено «вас убрали из игры» и тихий режим для блокировок
create or replace function public.on_application_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lobby public.lobbies;
begin
  if coalesce(current_setting('app.silent_applications', true), '') = 'on' then return null; end if;

  select * into v_lobby from public.lobbies where id = new.lobby_id;

  if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending') then
    perform public.notify(v_lobby.organizer_id, 'application_new',
      public.lobby_payload(v_lobby, new.user_id) || jsonb_build_object('message', new.message));
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform public.notify(new.user_id, 'application_accepted', public.lobby_payload(v_lobby, v_lobby.organizer_id));
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'rejected' then
    perform public.notify(new.user_id, 'application_rejected', public.lobby_payload(v_lobby, v_lobby.organizer_id));
  elsif tg_op = 'UPDATE' and old.status = 'accepted' and new.status = 'rejected' then
    perform public.notify(new.user_id, 'player_removed', public.lobby_payload(v_lobby, v_lobby.organizer_id));
  elsif tg_op = 'UPDATE' and old.status = 'accepted' and new.status = 'cancelled' and v_lobby.status <> 'cancelled' then
    perform public.notify(v_lobby.organizer_id, 'player_left', public.lobby_payload(v_lobby, new.user_id));
  end if;
  return null;
end;
$$;

-- ═════════════ Удаление аккаунта ═════════════
-- Вызывается сервером перед удалением пользователя: участники узнают об отмене, места освобождаются.

create or replace function public.prepare_account_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  r record;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;

  perform set_config('app.bypass_counters', 'on', true);
  update public.lobbies
     set status = 'cancelled'
   where organizer_id = v_uid and status in ('active', 'full') and start_time > now();
  perform set_config('app.bypass_counters', 'off', true);

  for r in
    select a.id, a.lobby_id, a.status
      from public.lobby_applications a
      join public.lobbies l on l.id = a.lobby_id
     where a.user_id = v_uid and a.status in ('pending', 'accepted')
       and l.status in ('active', 'full') and l.start_time > now()
     for update of a
  loop
    update public.lobby_applications set status = 'cancelled', updated_at = now() where id = r.id;
    if r.status = 'accepted' then perform public.release_lobby_slot(r.lobby_id); end if;
  end loop;
end;
$$;

revoke all on function public.prepare_account_deletion() from public, anon;
grant execute on function public.prepare_account_deletion() to authenticated;

-- ═════════════ Уведомления о сообщениях в чате ═════════════
-- Одно непрочитанное уведомление на чат за 15 минут, чтобы активный чат не засыпал телефон push-ами.

create or replace function public.on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lobby public.lobbies;
  v_payload jsonb;
  v_member uuid;
begin
  select * into v_lobby from public.lobbies where id = new.lobby_id;
  v_payload := public.lobby_payload(v_lobby, new.user_id) || jsonb_build_object('text', left(new.text, 120));

  for v_member in
    select v_lobby.organizer_id
    union
    select a.user_id from public.lobby_applications a where a.lobby_id = new.lobby_id and a.status = 'accepted'
  loop
    continue when v_member = new.user_id;
    continue when public.is_blocked_between(v_member, new.user_id);
    continue when exists (
      select 1 from public.notifications n
       where n.user_id = v_member and n.type = 'chat_message' and not n.read
         and n.payload->>'lobby_id' = new.lobby_id::text
         and n.created_at > now() - interval '15 minutes'
    );
    perform public.notify(v_member, 'chat_message', v_payload);
  end loop;
  return null;
end;
$$;

create trigger lobby_messages_notify
  after insert on public.lobby_messages
  for each row execute function public.on_chat_message();

-- ═════════════ Исправления правил игры ═════════════

-- Игру с принятыми игроками нельзя перенести раньше, на время меньше чем за 30 минут до начала:
-- иначе игроки теряют право отказаться.
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
  if old.accepted_count > 0 and new.start_time < old.start_time
     and new.start_time < now() + interval '30 minutes' then
    raise exception 'too_soon_with_players' using errcode = 'P0001';
  end if;

  new.organizer_id := old.organizer_id;
  new.accepted_count := old.accepted_count;
  new.status := case when new.players_needed <= old.accepted_count then 'full' else 'active' end;
  return new;
end;
$$;

-- Игру перенесли — напоминания должны прийти заново, уже к новому времени
create or replace function public.reset_lobby_reminders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.start_time is distinct from old.start_time then
    delete from public.lobby_reminders where lobby_id = new.id;
  end if;
  return null;
end;
$$;

create trigger lobbies_reset_reminders
  after update of start_time on public.lobbies
  for each row execute function public.reset_lobby_reminders();

-- Организатор получает +1 к сыгранным, только если в игре был хотя бы один принятый игрок
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
    returning id, organizer_id, accepted_count
  ),
  players as (
    select organizer_id as user_id from done where accepted_count > 0
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
