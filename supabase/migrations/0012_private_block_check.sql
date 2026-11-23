-- Match&Play — этап 12: чужие блокировки нельзя узнать через API
-- Запускать после 0011_tournaments.sql
--
-- Раньше любой клиент мог вызвать is_blocked_between для двух посторонних игроков.
-- Теперь прямой вызов отвечает только участнику пары. Правила базы, триггеры
-- и функции с правами владельца продолжают видеть настоящий результат.

-- Отдельная схема не публикуется через API
create schema if not exists safety;
revoke all on schema safety from public;
grant usage on schema safety to anon, authenticated;

create or replace function safety.blocked_between(p_a uuid, p_b uuid)
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

revoke all on function safety.blocked_between(uuid, uuid) from public;
-- Нужно политикам RLS, которые выполняются с ролью запроса
grant execute on function safety.blocked_between(uuid, uuid) to anon, authenticated;

create or replace function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when current_user in ('anon', 'authenticated')
         and pg_trigger_depth() = 0
         and auth.uid() is distinct from p_a
         and auth.uid() is distinct from p_b
      then false
    else safety.blocked_between(p_a, p_b)
  end;
$$;
