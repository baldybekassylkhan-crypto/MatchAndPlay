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
