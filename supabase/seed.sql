-- Тестовые данные для разработки. НЕ запускать на боевом проекте.
-- Запускать после всех миграций в SQL Editor. Можно запускать повторно:
-- старые демо-данные удаляются, время игр считается от текущего момента.
-- Демо-пользователи не могут войти в аккаунт (у них нет пароля): они нужны,
-- чтобы в поиске были игры от других людей.

begin;

delete from auth.users where email like '%@demo.matchandplay.kz';

-- ───────────── Демо-пользователи ─────────────
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, '', now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
from (values
  ('d0000000-0000-4000-8000-000000000001'::uuid, 'aidos@demo.matchandplay.kz'),
  ('d0000000-0000-4000-8000-000000000002'::uuid, 'dana@demo.matchandplay.kz'),
  ('d0000000-0000-4000-8000-000000000003'::uuid, 'timur@demo.matchandplay.kz'),
  ('d0000000-0000-4000-8000-000000000004'::uuid, 'aruzhan@demo.matchandplay.kz'),
  ('d0000000-0000-4000-8000-000000000005'::uuid, 'nursultan@demo.matchandplay.kz'),
  ('d0000000-0000-4000-8000-000000000006'::uuid, 'madina@demo.matchandplay.kz'),
  ('d0000000-0000-4000-8000-000000000007'::uuid, 'yerlan@demo.matchandplay.kz'),
  ('d0000000-0000-4000-8000-000000000008'::uuid, 'alina@demo.matchandplay.kz')
) as u(id, email);

insert into public.profiles (id, username, full_name, bio, city_id, sports, level) values
  ('d0000000-0000-4000-8000-000000000001', 'aidos_10',     'Айдос Серикулы',   'Футбол по выходным, играю в атаке',          1, array['football'],                        'amateur'),
  ('d0000000-0000-4000-8000-000000000002', 'dana.hoops',   'Дана Ахметова',    'Баскетбол — моя любовь 🏀',                   2, array['basketball','volleyball'],         'advanced'),
  ('d0000000-0000-4000-8000-000000000003', 'timur_k',      'Тимур Калиев',     'Собираю волейбол по средам',                  3, array['volleyball','football'],           'amateur'),
  ('d0000000-0000-4000-8000-000000000004', 'aruzhan.tennis','Аружан Бекова',   'Теннис и падел, ищу партнёров',               1, array['tennis','padel'],                  'advanced'),
  ('d0000000-0000-4000-8000-000000000005', 'nurs_fc',      'Нурсултан Жумабаев','Капитан любительской команды',               2, array['football'],                        'advanced'),
  ('d0000000-0000-4000-8000-000000000006', 'madina_run',   'Мадина Омарова',   'Бегаю по утрам, бадминтон вечером',           4, array['running','badminton'],             'beginner'),
  ('d0000000-0000-4000-8000-000000000007', 'yerlan.ice',   'Ерлан Сапаров',    'Хоккей зимой, футбол летом',                  7, array['hockey','football'],               'amateur'),
  ('d0000000-0000-4000-8000-000000000008', 'alina_tt',     'Алина Ким',        'Настольный теннис, уровень — любитель',       3, array['table_tennis','tennis'],           'amateur');

-- ───────────── Демо-лобби ─────────────
-- t0 — начало следующего часа; смещение в часах задаёт время игры.
with t0 as (select date_trunc('hour', now()) + interval '1 hour' as base)
insert into public.lobbies (organizer_id, sport, description, players_current, players_needed, start_time,
                            duration_min, city_id, location_name, lat, lng, level, price_kzt)
select o.organizer::uuid, o.sport, o.descr, o.cur, o.need, (select base from t0) + make_interval(hours => o.h),
       o.dur, o.city, o.place, o.lat, o.lng, o.lvl::public.skill_level, o.price
from (values
  -- Астана (1)
  ('d0000000-0000-4000-8000-000000000001','football',   'Нас 8, нужны ещё 2. Играем 5 на 5, дружеская игра.',          8, 2,   5,  90, 1, 'Манеж «Астана Арена», поле 2',      51.1083, 71.4026, 'amateur', 2000),
  ('d0000000-0000-4000-8000-000000000004','tennis',     'Ищу партнёра на корт, уровень средний и выше.',              1, 1,  20,  60, 1, 'Национальный теннисный центр',      51.1279, 71.4304, 'advanced', 6000),
  ('d0000000-0000-4000-8000-000000000004','padel',      'Нас трое, нужен четвёртый для пары.',                        3, 1,  29,  90, 1, 'Padel Club Astana',                  51.0913, 71.4183, null, 5000),
  ('d0000000-0000-4000-8000-000000000001','football',   'Вечерний футбол в субботу, нужны 4 человека.',                6, 4,  52, 120, 1, 'Стадион «Юность»',                   51.1585, 71.4390, null, 1500),
  ('d0000000-0000-4000-8000-000000000005','basketball', 'Стритбол 3 на 3, нужен один игрок.',                         5, 1,  27,  60, 1, 'Площадка в парке Влюблённых',        51.1260, 71.4440, 'amateur', null),
  ('d0000000-0000-4000-8000-000000000002','volleyball', 'Пляжный волейбол в зале, все уровни.',                       6, 6,  74, 120, 1, 'Beach Arena',                        51.1395, 71.4100, 'beginner', 2500),
  ('d0000000-0000-4000-8000-000000000006','running',    'Утренняя пробежка 10 км по набережной.',                     2, 8,  40,  60, 1, 'Набережная Есиль, у моста',          51.1330, 71.4270, null, null),
  ('d0000000-0000-4000-8000-000000000007','hockey',     'Любительский хоккей, нужен вратарь и 2 полевых.',           10, 3,  98, 90,  1, 'Ледовая арена «Барыс»',              51.0880, 71.4020, 'amateur', 4000),
  -- Алматы (2)
  ('d0000000-0000-4000-8000-000000000002','basketball', 'Нас 4, нужны ещё 2 — играем на всё поле.',                  4, 2,   7,  90, 2, 'Спорткомплекс «Балуан Шолак»',       43.2393, 76.9283, 'advanced', 2000),
  ('d0000000-0000-4000-8000-000000000005','football',   'Ищем 3 игроков на мини-футбол, без грубостей.',              7, 3,  26,  90, 2, 'Футбольный манеж Medeu Park',        43.2190, 76.9410, 'amateur', 2500),
  ('d0000000-0000-4000-8000-000000000005','football',   'Большой футбол 11×11, нужно 6 человек.',                    16, 6,  50, 120, 2, 'Центральный стадион',                43.2370, 76.9240, null, 3000),
  ('d0000000-0000-4000-8000-000000000002','volleyball', 'Волейбол в зале, смешанные команды.',                        8, 4,  31, 120, 2, 'Зал КазНУ',                          43.2250, 76.9220, null, 1500),
  ('d0000000-0000-4000-8000-000000000004','tennis',     'Парная игра, нужна пара.',                                   2, 2,  45,  90, 2, 'Теннисный центр «Алматы»',           43.2040, 76.9020, 'amateur', 7000),
  ('d0000000-0000-4000-8000-000000000008','table_tennis','Настольный теннис, турнир на вылет.',                       5, 3,  76, 120, 2, 'Клуб «Пинг-Понг», Абая 52',          43.2400, 76.9280, null, 1000),
  ('d0000000-0000-4000-8000-000000000006','badminton',  'Бадминтон после работы, ракетки есть.',                      2, 2,   9,  60, 2, 'ФОК «Ак Жайык»',                     43.2550, 76.9450, 'beginner', 1500),
  ('d0000000-0000-4000-8000-000000000007','hockey',     'Хоккей на открытом катке, нужно 4 игрока.',                  8, 4, 100,  90, 2, 'Каток «Медеу»',                      43.1575, 77.0590, 'advanced', 3000),
  -- Шымкент (3)
  ('d0000000-0000-4000-8000-000000000003','volleyball', 'Волейбол, нас 9, нужны ещё 3.',                              9, 3,   6, 120, 3, 'Спортзал школы №12',                 42.3200, 69.5950, 'amateur', 1000),
  ('d0000000-0000-4000-8000-000000000003','football',   'Вечерний футбол, ищем 2 защитников.',                        8, 2,  28,  90, 3, 'Стадион «Кажымукан»',                42.3150, 69.5880, null, 1500),
  ('d0000000-0000-4000-8000-000000000008','table_tennis','Ищу соперника по настольному теннису.',                     1, 1,  22,  60, 3, 'Дворец спорта',                      42.3420, 69.6000, 'amateur', null),
  ('d0000000-0000-4000-8000-000000000008','tennis',     'Теннис для новичков, научим.',                               2, 2,  54,  90, 3, 'Корты в парке Независимости',        42.3300, 69.5800, 'beginner', 3000),
  -- Другие города
  ('d0000000-0000-4000-8000-000000000006','running',    'Пробежка 5 км, темп спокойный.',                            3, 5,  15,  45, 4, 'Центральный парк Караганды',         49.8070, 73.0880, 'beginner', null),
  ('d0000000-0000-4000-8000-000000000006','badminton',  'Бадминтон пара на пару.',                                    2, 2,  49,  90, 4, 'СК «Шахтёр»',                        49.8100, 73.1000, null, 2000),
  ('d0000000-0000-4000-8000-000000000007','football',   'Мини-футбол, нужно 3 игрока.',                               7, 3,  24,  90, 7, 'Манеж «Иртыш»',                      52.2850, 76.9500, 'amateur', 1500),
  ('d0000000-0000-4000-8000-000000000007','hockey',     'Хоккей, вторая пятёрка ищет игроков.',                      12, 5,  73,  90, 7, 'Ледовый дворец спорта',              52.2800, 76.9700, null, 2500),
  ('d0000000-0000-4000-8000-000000000003','basketball', 'Баскетбол в Таразе, нас 6.',                                 6, 4,  30,  90, 6, 'Спорткомплекс «Тараз»',              42.9000, 71.3700, null, 1000),
  ('d0000000-0000-4000-8000-000000000005','football',   'Футбол на песке у моря!',                                   6, 4,  53,  90, 15, 'Пляж 7 мкр',                         43.6450, 51.1500, null, null)
) as o(organizer, sport, descr, cur, need, h, dur, city, place, lat, lng, lvl, price);

-- ───────────── Принятые заявки (для реалистичных «4/6 игроков») ─────────────
insert into public.lobby_applications (lobby_id, user_id, status, decided_at)
select l.id, u.id, 'accepted', now()
from public.lobbies l
join lateral (
  select p.id from public.profiles p
  where p.id::text like 'd0000000-%' and p.id <> l.organizer_id
  order by md5(p.id::text || l.id::text)
  limit least(l.players_needed - 1, 2)
) u on true
where l.organizer_id::text like 'd0000000-%';

-- Пара заявок «ожидает решения»
insert into public.lobby_applications (lobby_id, user_id, status, message)
select l.id, 'd0000000-0000-4000-8000-000000000008', 'pending', 'Можно с вами? Приду вовремя'
from public.lobbies l
where l.organizer_id = 'd0000000-0000-4000-8000-000000000005'
on conflict (lobby_id, user_id) do nothing;

update public.lobbies l
   set accepted_count = s.n,
       status = case when s.n >= l.players_needed then 'full'::public.lobby_status else 'active'::public.lobby_status end
  from (select lobby_id, count(*)::smallint as n from public.lobby_applications where status = 'accepted' group by lobby_id) s
 where s.lobby_id = l.id;

-- Немного подписок между демо-игроками
insert into public.follows (follower_id, following_id)
select a.id, b.id
from public.profiles a cross join public.profiles b
where a.id::text like 'd0000000-%' and b.id::text like 'd0000000-%' and a.id <> b.id
  and md5(a.id::text || b.id::text) < '8'
on conflict do nothing;

-- ───────────── Прошедшая игра для хайлайта (этап 5) ─────────────
insert into public.lobbies (id, organizer_id, sport, description, players_current, players_needed, accepted_count,
                            start_time, duration_min, city_id, location_name, status)
values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'football',
        'Субботний футбол 5×5', 8, 2, 2, date_trunc('hour', now()) - interval '2 days', 90, 1, 'Манеж «Астана Арена»', 'finished');
insert into public.lobby_applications (lobby_id, user_id, status, decided_at) values
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000005', 'accepted', now() - interval '3 days'),
  ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000007', 'accepted', now() - interval '3 days');

-- ───────────── Демо-посты (этап 5) ─────────────
-- Картинки лежат в public/seed (пути с «/» — локальные файлы, не Supabase Storage).
-- Для этого блока нужна миграция 0006_posts.sql — выполняйте seed после всех миграций.
insert into public.posts (id, author_id, caption, sport, lobby_id, media, created_at) values
  ('f0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
   'Отличная игра в субботу! Спасибо всем, кто пришёл 🔥 Следующая — в эти выходные, заходите в лобби.',
   'football', 'e0000000-0000-4000-8000-000000000001',
   '[{"type":"image","path":"/seed/football.svg","w":1080,"h":1350}]', now() - interval '1 day'),
  ('f0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002',
   'Стритбол на закате. Ищем ещё людей на вторник 🏀', 'basketball', null,
   '[{"type":"image","path":"/seed/basketball.svg","w":1080,"h":1350},{"type":"image","path":"/seed/volleyball.svg","w":1080,"h":1350}]',
   now() - interval '5 hours'),
  ('f0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000004',
   'Утренний корт — лучший способ начать день 🎾', 'tennis', null,
   '[{"type":"image","path":"/seed/tennis.svg","w":1080,"h":1350}]', now() - interval '2 days'),
  ('f0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000007',
   'Первая тренировка на льду в этом сезоне', 'hockey', null,
   '[{"type":"image","path":"/seed/hockey.svg","w":1080,"h":1350}]', now() - interval '3 days'),
  ('f0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000006',
   '10 км по набережной ✅ Кто со мной в субботу утром?', 'running', null,
   '[{"type":"image","path":"/seed/running.svg","w":1080,"h":1350}]', now() - interval '30 minutes'),
  ('f0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000003',
   'Волейбол по средам — приходите, всем рады 🏐', 'volleyball', null,
   '[{"type":"image","path":"/seed/volleyball.svg","w":1080,"h":1350}]', now() - interval '20 hours');

-- Лайки и комментарии (счётчики посчитают триггеры)
insert into public.likes (post_id, user_id)
select p.id, u.id
from public.posts p cross join public.profiles u
where p.id::text like 'f0000000-%' and u.id::text like 'd0000000-%' and u.id <> p.author_id
  and md5(p.id::text || u.id::text) < 'a'
on conflict do nothing;

insert into public.comments (post_id, user_id, text, created_at) values
  ('f0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000005', 'Было огонь! Я в деле на следующую', now() - interval '20 hours'),
  ('f0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000007', 'Второй гол — шедевр 😄', now() - interval '18 hours'),
  ('f0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000005', 'Во вторник буду!', now() - interval '3 hours'),
  ('f0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000004', 'Я с тобой 🏃‍♀️', now() - interval '10 minutes');

commit;
