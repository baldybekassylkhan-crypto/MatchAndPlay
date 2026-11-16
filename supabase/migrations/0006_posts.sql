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
