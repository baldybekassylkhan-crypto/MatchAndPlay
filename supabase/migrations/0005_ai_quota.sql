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
