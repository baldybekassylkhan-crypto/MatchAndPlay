import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Прогоняет все миграции и seed во встроенном Postgres (PGlite) с заглушками схем Supabase
// и проверяет правила базы: заявки, правило 30 минут, счётчики, уведомления, push.
const dir = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "../../supabase");
let failures = 0;
const realLog = console.log;
console.log = (...args) => {
  if (String(args[0]).startsWith("FAIL")) failures++;
  realLog(...args);
};
const db = new PGlite();

const stubs = `
create role anon; create role authenticated;
create schema auth;
create table auth.users(instance_id uuid, id uuid primary key, aud text, role text, email text, encrypted_password text,
  email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role', true),'') $$;
create schema storage;
create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;
create schema cron;
create function cron.schedule(a text, b text, c text) returns bigint language sql as $$ select 1::bigint $$;
create schema net;
create table net.calls(url text, body jsonb, headers jsonb);
create function net.http_post(url text, body jsonb, headers jsonb, timeout_milliseconds int) returns bigint
  language sql as $$ insert into net.calls values (url, body, headers); select 1::bigint $$;
`;
await db.exec(stubs);

for (const f of ["migrations/0001_init.sql", "migrations/0002_cities.sql", "migrations/0003_lobbies.sql", "migrations/0004_swipes_saved.sql", "migrations/0005_ai_quota.sql", "migrations/0006_posts.sql", "migrations/0007_chat_notifications.sql", "migrations/0008_safety_and_flow.sql", "migrations/0009_checkin_feed.sql", "migrations/0010_crews_messages.sql", "migrations/0011_tournaments.sql", "migrations/0012_private_block_check.sql", "seed.sql"]) {
  let sql = readFileSync(path.join(dir, f), "utf8");
  sql = sql
    .replace(/create extension if not exists pg_cron[^;]*;/, "")
    .replace(/create extension if not exists pg_net;/, "")
    .replace(/alter publication supabase_realtime[^;]*;/, "");
  try {
    await db.exec(sql);
    console.log("OK  ", f);
  } catch (e) {
    console.log("FAIL", f, "→", e.message);
    process.exit(1);
  }
}

const q = async (sql, params) => (await db.query(sql, params)).rows;
const as = async (uid) => {
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid ?? ""}', false), set_config('request.jwt.claim.role', '${uid ? "authenticated" : ""}', false)`);
};
const expectErr = async (label, fn, code) => {
  try {
    await fn();
    console.log("FAIL", label, "— ошибки не было");
  } catch (e) {
    console.log(e.message.includes(code) ? "OK  " : "FAIL", label, "→", e.message);
  }
};

console.log("\nseed:", (await q("select count(*)::int n from lobbies"))[0].n, "лобби,",
  (await q("select count(*)::int n from lobby_applications"))[0].n, "заявок,",
  (await q("select count(*)::int n from follows"))[0].n, "подписок");

// Реальный пользователь + организатор
const ORG = "d0000000-0000-4000-8000-000000000001";
const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
await as(null);
for (const [id, name] of [[ME, "tester"], [OTHER, "other"]]) {
  await db.exec(`insert into auth.users(id, email) values ('${id}', '${name}@x.kz')`);
}
await as(ME);
await db.exec(`insert into profiles(id, username, city_id, sports, level, games_played) values ('${ME}', 'tester', 1, '{football}', 'amateur', 99)`);
console.log((await q(`select games_played from profiles where id = '${ME}'`))[0].games_played === 0 ? "OK  " : "FAIL", "games_played нельзя накрутить при создании");
await as(OTHER);
await db.exec(`insert into profiles(id, username, city_id, sports, level) values ('${OTHER}', 'other', 1, '{football}', 'amateur')`);

// Организатор создаёт игру: через 3 часа, нужно 1 игрока
await as(ORG);
const [{ id: L1 }] = await q(`insert into lobbies(organizer_id, sport, description, players_current, players_needed, start_time, city_id, location_name, accepted_count, status)
  values ('${ORG}', 'football', 'Тестовая игра', 3, 1, now() + interval '3 hours', 1, 'Поле', 5, 'cancelled') returning id`);
const l1 = (await q(`select accepted_count, status from lobbies where id = $1`, [L1]))[0];
console.log(l1.accepted_count === 0 && l1.status === "active" ? "OK  " : "FAIL", "клиент не может задать счётчик/статус при создании", l1);

await as(ME);
const [{ apply_to_lobby: A1 }] = await q(`select apply_to_lobby($1, 'Привет')`, [L1]);
await expectErr("повторная заявка", () => q(`select apply_to_lobby($1, null)`, [L1]), "already_applied");
await expectErr("чужой не может принять заявку", () => q(`select decide_application($1, true)`, [A1]), "not_organizer");

await as(ORG);
await expectErr("организатор не может подать заявку в своё лобби", () => q(`select apply_to_lobby($1, null)`, [L1]), "own_lobby");
await q(`select decide_application($1, true)`, [A1]);
const l1b = (await q(`select accepted_count, status from lobbies where id = $1`, [L1]))[0];
console.log(l1b.accepted_count === 1 && l1b.status === "full" ? "OK  " : "FAIL", "принятие заявки → лобби заполнено", l1b);

await as(OTHER);
await expectErr("в заполненное лобби заявку не подать", () => q(`select apply_to_lobby($1, null)`, [L1]), "lobby_full");

await as(ORG);
await q(`update lobbies set players_needed = 2, accepted_count = 0, status = 'cancelled' where id = $1`, [L1]);
const l1c = (await q(`select accepted_count, status, players_needed from lobbies where id = $1`, [L1]))[0];
console.log(l1c.accepted_count === 1 && l1c.status === "active" && l1c.players_needed === 2 ? "OK  " : "FAIL", "редактирование: счётчик защищён, статус пересчитан", l1c);
await expectErr("нельзя искать меньше игроков, чем принято", () => q(`update lobbies set players_needed = 0 where id = $1`, [L1]), "needed_below_accepted");

// Отказ за 3 часа — можно
await as(ME);
await q(`select cancel_application($1)`, [A1]);
const l1d = (await q(`select accepted_count, status from lobbies where id = $1`, [L1]))[0];
console.log(l1d.accepted_count === 0 ? "OK  " : "FAIL", "отказ за 3 часа до игры разрешён, место освободилось", l1d);
// Повторная заявка после отмены — можно
await q(`select apply_to_lobby($1, null)`, [L1]);
console.log("OK   повторная заявка после отмены");

// Правило 30 минут
await as(null);
const [{ id: L2 }] = await q(`insert into lobbies(organizer_id, sport, description, players_current, players_needed, start_time, city_id, location_name)
  values ('${ORG}', 'football', 'Скоро', 3, 2, now() + interval '20 minutes', 1, 'Поле') returning id`);
await as(ME);
const [{ apply_to_lobby: A2 }] = await q(`select apply_to_lobby($1, null)`, [L2]);
await as(ORG);
await q(`select decide_application($1, true)`, [A2]);
await as(ME);
await expectErr("за 20 минут до начала отказаться нельзя", () => q(`select cancel_application($1)`, [A2]), "too_late_to_leave");

// Отклонение и запрет повторной заявки
await as(OTHER);
const [{ apply_to_lobby: A3 }] = await q(`select apply_to_lobby($1, null)`, [L2]);
await as(ORG);
await q(`select decide_application($1, false)`, [A3]);
await as(OTHER);
await expectErr("после отклонения повторно не подать", () => q(`select apply_to_lobby($1, null)`, [L2]), "was_rejected");

// Отмена лобби организатором
await as(ME);
await expectErr("чужой не может отменить игру", () => q(`select cancel_lobby($1)`, [L1]), "not_organizer");
await as(ORG);
await q(`select cancel_lobby($1)`, [L1]);
console.log((await q(`select status from lobbies where id = $1`, [L1]))[0].status === "cancelled" ? "OK  " : "FAIL", "организатор отменил игру");

// Завершение прошедших игр и счётчик
await as(null);
await q(`update lobbies set start_time = now() - interval '3 hours' where id = $1`, [L2]);
const before = (await q(`select games_played from profiles where id in ($1, $2) order by id`, [ORG, ME])).map((r) => r.games_played);
await q(`select finish_past_lobbies()`);
const after = (await q(`select games_played from profiles where id in ($1, $2) order by id`, [ORG, ME])).map((r) => r.games_played);
const st = (await q(`select status from lobbies where id = $1`, [L2]))[0].status;
console.log(st === "finished" && after[0] === before[0] + 1 && after[1] === before[1] + 1 ? "OK  " : "FAIL",
  "finish_past_lobbies: игра завершена, +1 игра организатору и игроку", { before, after, st });

// Пользователь не может сам поменять games_played
await as(ME);
await q(`update profiles set games_played = 500 where id = $1`, [ME]);
console.log((await q(`select games_played from profiles where id = $1`, [ME]))[0].games_played === after[1] ? "OK  " : "FAIL", "games_played нельзя изменить вручную");

// Этап 3: сохранённые и свайпы
await as(ME);
const [{ id: L3 }] = await q(`select id from lobbies where status = 'active' and start_time > now() + interval '1 hour' and organizer_id <> $1 limit 1`, [ME]);
await q(`insert into swipes(user_id, lobby_id, direction) values ($1, $2, 'right')`, [ME, L3]);
await q(`insert into saved_lobbies(user_id, lobby_id) values ($1, $2)`, [ME, L3]);
await q(`insert into saved_lobbies(user_id, lobby_id) values ($1, $2)`, [ME, L1]); // L1 отменено ранее
await as(null);
await q(`select cleanup_saved_and_swipes()`);
const savedLeft = (await q(`select lobby_id from saved_lobbies where user_id = $1`, [ME])).map((r) => r.lobby_id);
console.log(savedLeft.length === 1 && savedLeft[0] === L3 ? "OK  " : "FAIL", "очистка: отменённое удалено из сохранённых, будущее осталось", savedLeft);
await q(`update lobbies set start_time = now() - interval '1 minute' where id = $1`, [L3]);
await q(`select cleanup_saved_and_swipes()`);
console.log((await q(`select count(*)::int n from saved_lobbies where user_id = $1`, [ME]))[0].n === 0 ? "OK  " : "FAIL", "очистка: начавшаяся игра исчезла из сохранённых");

// Этап 4: лимит умного поиска
await as(ME);
const res = [];
for (let i = 0; i < 10; i++) res.push((await q(`select consume_ai_quota() as ok`))[0].ok);
console.log(res.filter(Boolean).length === 8 && res[8] === false ? "OK  " : "FAIL", "лимит: 8 запросов в минуту, дальше отказ", res.join(","));
await as(null);
console.log((await q(`select consume_ai_quota() as ok`))[0].ok === false ? "OK  " : "FAIL", "без входа умный поиск не тратит лимит");

// Этап 5: посты
console.log("\nseed posts:", (await q(`select count(*)::int n, sum(like_count)::int likes, sum(comment_count)::int comments from posts`))[0]);
const realLikes = (await q(`select count(*)::int n from likes`))[0].n;
const sumLikes = (await q(`select sum(like_count)::int n from posts`))[0].n;
console.log(realLikes === sumLikes ? "OK  " : "FAIL", "счётчик лайков совпадает с таблицей likes", realLikes, sumLikes);

await as(ME);
const [{ id: P1 }] = await q(`insert into posts(author_id, caption, media, like_count) values ($1, 'тест', '[{"type":"image","path":"x/y.webp","w":1,"h":1}]', 1000) returning id`, [ME]);
console.log((await q(`select like_count from posts where id = $1`, [P1]))[0].like_count === 0 ? "OK  " : "FAIL", "нельзя накрутить лайки при создании поста");
await q(`insert into likes(post_id, user_id) values ($1, $2)`, [P1, ME]);
await q(`insert into comments(post_id, user_id, text) values ($1, $2, 'круто')`, [P1, ME]);
let c = (await q(`select like_count, comment_count from posts where id = $1`, [P1]))[0];
console.log(c.like_count === 1 && c.comment_count === 1 ? "OK  " : "FAIL", "лайк и комментарий увеличили счётчики", c);
await q(`update posts set like_count = 999, caption = 'новая подпись' where id = $1`, [P1]);
c = (await q(`select like_count, caption from posts where id = $1`, [P1]))[0];
console.log(c.like_count === 1 && c.caption === "новая подпись" ? "OK  " : "FAIL", "подпись менять можно, счётчик — нет", c);
await q(`delete from likes where post_id = $1 and user_id = $2`, [P1, ME]);
console.log((await q(`select like_count from posts where id = $1`, [P1]))[0].like_count === 0 ? "OK  " : "FAIL", "снятие лайка уменьшило счётчик");

// Хайлайт: только к своей прошедшей игре
await expectErr("нельзя привязать хайлайт к чужой игре", () =>
  q(`insert into posts(author_id, media, lobby_id) values ($1, '[{"type":"image","path":"x/y.webp","w":1,"h":1}]', 'e0000000-0000-4000-8000-000000000001')`, [ME]), "not_your_game");
await as("d0000000-0000-4000-8000-000000000005");
await q(`insert into posts(author_id, media, lobby_id) values ($1, '[{"type":"image","path":"x/y.webp","w":1,"h":1}]', 'e0000000-0000-4000-8000-000000000001')`, ["d0000000-0000-4000-8000-000000000005"]);
console.log("OK   принятый игрок может выложить хайлайт с прошедшей игры");
const future = (await q(`select id from lobbies where organizer_id = $1 and start_time > now() limit 1`, ["d0000000-0000-4000-8000-000000000005"]))[0].id;
await expectErr("нельзя привязать хайлайт к игре, которая ещё не началась", () =>
  q(`insert into posts(author_id, media, lobby_id) values ($1, '[{"type":"image","path":"x/y.webp","w":1,"h":1}]', $2)`, ["d0000000-0000-4000-8000-000000000005", future]), "not_your_game");
await expectErr("пустой пост без медиа отклоняется", () => q(`insert into posts(author_id, media) values ($1, '[]')`, ["d0000000-0000-4000-8000-000000000005"]), "posts_media_check");

// Этап 6: уведомления, напоминания, чат, push
const notes = async (uid, type) => (await q(`select payload from notifications where user_id = $1 and type = $2 order by id`, [uid, type])).map((r) => r.payload);
await as(null);
await q(`delete from notifications`);
const [{ id: L9 }] = await q(`insert into lobbies(organizer_id, sport, description, players_current, players_needed, start_time, city_id, location_name)
  values ('${ORG}', 'basketball', 'Уведомления', 3, 3, now() + interval '5 hours', 1, 'Зал') returning id`);
await as(ME);
const [{ apply_to_lobby: A9 }] = await q(`select apply_to_lobby($1, 'Привет!')`, [L9]);
let n = await notes(ORG, "application_new");
console.log(n.length === 1 && n[0].actor === "tester" && n[0].message === "Привет!" ? "OK  " : "FAIL", "новая заявка → уведомление организатору", n[0]?.actor);
await as(ORG);
await q(`select decide_application($1, true)`, [A9]);
console.log((await notes(ME, "application_accepted")).length === 1 ? "OK  " : "FAIL", "заявку приняли → уведомление игроку");
await as(OTHER);
const [{ apply_to_lobby: A10 }] = await q(`select apply_to_lobby($1, null)`, [L9]);
await as(ORG);
await q(`select decide_application($1, false)`, [A10]);
console.log((await notes(OTHER, "application_rejected")).length === 1 ? "OK  " : "FAIL", "заявку отклонили → уведомление игроку");

await q(`update lobbies set start_time = start_time + interval '1 hour', location_name = 'Другой зал' where id = $1`, [L9]);
n = await notes(ME, "lobby_updated");
console.log(n.length === 1 && JSON.stringify(n[0].changes) === '["time","place"]' ? "OK  " : "FAIL", "игру изменили → участникам, с перечнем изменений", n[0]?.changes);
console.log((await notes(OTHER, "lobby_updated")).length === 0 ? "OK  " : "FAIL", "отклонённый игрок не получает изменений");

// Напоминания
await as(null);
await q(`update lobbies set start_time = now() + interval '90 minutes' where id = $1`, [L9]);
await q(`delete from notifications`);
await q(`select send_game_reminders()`);
await q(`select send_game_reminders()`);
console.log((await notes(ME, "reminder_2h")).length === 1 && (await notes(ORG, "reminder_2h")).length === 1 ? "OK  " : "FAIL", "напоминание за 2 часа: игроку и организатору, без дублей");
await q(`update lobbies set start_time = now() + interval '20 minutes' where id = $1`, [L9]);
await q(`select send_game_reminders()`);
console.log((await notes(ME, "reminder_30m")).length === 1 ? "OK  " : "FAIL", "напоминание за 30 минут");

// Игрок отказался (за 5 часов) → организатору
const [{ id: L10 }] = await q(`insert into lobbies(organizer_id, sport, description, players_current, players_needed, start_time, city_id, location_name)
  values ('${ORG}', 'football', 'Отказ', 3, 2, now() + interval '5 hours', 1, 'Поле') returning id`);
await as(ME);
const [{ apply_to_lobby: A11 }] = await q(`select apply_to_lobby($1, null)`, [L10]);
await as(ORG);
await q(`select decide_application($1, true)`, [A11]);
await as(ME);
await q(`select cancel_application($1)`, [A11]);
console.log((await notes(ORG, "player_left")).length === 1 ? "OK  " : "FAIL", "игрок отказался → уведомление организатору");
await q(`select apply_to_lobby($1, null)`, [L10]);
await as(ORG);
await q(`select cancel_lobby($1)`, [L10]);
console.log((await notes(ME, "lobby_cancelled")).length === 1 ? "OK  " : "FAIL", "игру отменили → уведомление (в т. ч. ожидающим заявки)");

// Соцсеть
await as(ME);
await q(`insert into follows(follower_id, following_id) values ($1, $2)`, [ME, OTHER]);
console.log((await notes(OTHER, "follow"))[0]?.actor === "tester" ? "OK  " : "FAIL", "подписка → уведомление");
const [{ id: P9 }] = await q(`insert into posts(author_id, media) values ($1, '[{"type":"image","path":"x/y.webp","w":1,"h":1}]') returning id`, [OTHER]);
await q(`insert into likes(post_id, user_id) values ($1, $2)`, [P9, ME]);
await q(`delete from likes where post_id = $1 and user_id = $2`, [P9, ME]);
await q(`insert into likes(post_id, user_id) values ($1, $2)`, [P9, ME]);
console.log((await notes(OTHER, "like")).length === 1 ? "OK  " : "FAIL", "лайк → одно уведомление даже после повторного лайка");
await q(`insert into comments(post_id, user_id, text) values ($1, $2, 'Класс!')`, [P9, ME]);
console.log((await notes(OTHER, "comment"))[0]?.text === "Класс!" ? "OK  " : "FAIL", "комментарий → уведомление с текстом");
await as(OTHER);
await q(`insert into likes(post_id, user_id) values ($1, $2)`, [P9, OTHER]);
console.log((await notes(OTHER, "like")).length === 1 ? "OK  " : "FAIL", "свой лайк не создаёт уведомление");

// Чат: кто участник
const mem = async (lobby, uid) => (await q(`select is_lobby_member($1, $2) as m`, [lobby, uid]))[0].m;
console.log((await mem(L9, ORG)) && (await mem(L9, ME)) && !(await mem(L9, OTHER)) ? "OK  " : "FAIL", "чат: организатор и принятый — участники, отклонённый — нет");

// Push через pg_net
await as(null);
await q(`delete from net.calls`);
await q(`insert into notifications(user_id, type) values ($1, 'follow')`, [ME]);
console.log((await q(`select count(*)::int n from net.calls`))[0].n === 0 ? "OK  " : "FAIL", "push: без настроек запрос не отправляется");
await q(`insert into private.settings values ('push_url', 'https://app.example/api/push'), ('push_secret', 's3cret')`);
await q(`insert into notifications(user_id, type) values ($1, 'follow')`, [ME]);
console.log((await q(`select count(*)::int n from net.calls`))[0].n === 0 ? "OK  " : "FAIL", "push: без подписки устройства запрос не отправляется");
await as(ME);
await q(`select save_push_subscription('https://push.example/abc', 'p256dh-key-123', 'auth-key-1', 'test')`);
await as(OTHER);
await q(`select save_push_subscription('https://push.example/abc', 'p256dh-key-456', 'auth-key-2', 'test')`);
const owner = (await q(`select user_id from push_subscriptions where endpoint = 'https://push.example/abc'`))[0].user_id;
console.log(owner === OTHER ? "OK  " : "FAIL", "подписка устройства переходит новому аккаунту");
await as(null);
await q(`insert into notifications(user_id, type) values ($1, 'follow')`, [OTHER]);
const call = (await q(`select * from net.calls`))[0];
console.log(call?.url === "https://app.example/api/push" && call?.headers["x-push-secret"] === "s3cret" && call?.body.id ? "OK  " : "FAIL", "push: новое уведомление → POST на /api/push с секретом");

// Этап 8: безопасность и правила игры
const check = (ok, label, extra) => console.log(ok ? "OK  " : "FAIL", label, extra ?? "");
const newLobby = async (needed = 2, start = "5 hours") => {
  await as(null);
  const [{ id }] = await q(`insert into lobbies(organizer_id, sport, description, players_current, players_needed, start_time, city_id, location_name)
    values ('${ORG}', 'football', 'Этап 8', 2, ${needed}, now() + interval '${start}', 1, 'Поле') returning id`);
  return id;
};
const join = async (lobby, uid) => {
  await as(uid);
  const [{ apply_to_lobby: app }] = await q(`select apply_to_lobby($1, null)`, [lobby]);
  await as(ORG);
  await q(`select decide_application($1, true)`, [app]);
  return app;
};
const lobbyRow = async (id) => (await q(`select accepted_count, status from lobbies where id = $1`, [id]))[0];
const appStatus = async (id) => (await q(`select status from lobby_applications where id = $1`, [id]))[0].status;

// Удаление игрока
const L20 = await newLobby(1);
const A20 = await join(L20, ME);
await as(OTHER);
await expectErr("чужой не может убрать игрока", () => q(`select remove_player($1)`, [A20]), "not_organizer");
await as(ORG);
await q(`select remove_player($1)`, [A20]);
let row = await lobbyRow(L20);
check(row.accepted_count === 0 && row.status === "active", "организатор убрал игрока, место освободилось", row);
check((await notes(ME, "player_removed")).length === 1, "убранный игрок получил уведомление");
await as(ME);
await expectErr("убранный игрок не может подать заявку снова", () => q(`select apply_to_lobby($1, null)`, [L20]), "was_rejected");
check(!(await mem(L20, ME)), "убранный игрок потерял доступ к чату");

// Блокировка
const L21 = await newLobby(2);
const A21 = await join(L21, ME);
await as(null);
await q(`insert into follows(follower_id, following_id) values ($1, $2), ($2, $1) on conflict do nothing`, [ME, ORG]);
await q(`delete from notifications where user_id = $1`, [ME]);
const [{ id: P21 }] = await q(`insert into posts(author_id, media) values ($1, '[{"type":"image","path":"x/y.webp","w":1,"h":1}]') returning id`, [ME]);
await as(ORG);
await q(`select block_user($1)`, [ME]);
row = await lobbyRow(L21);
check(row.accepted_count === 0 && (await appStatus(A21)) === "rejected", "блокировка убрала игрока из будущей игры организатора", row);
check((await q(`select count(*)::int n from notifications where user_id = $1`, [ME]))[0].n === 0, "блокировка не отправляет уведомление");
check((await q(`select count(*)::int n from follows where (follower_id = $1 and following_id = $2) or (follower_id = $2 and following_id = $1)`, [ME, ORG]))[0].n === 0, "блокировка убрала подписки в обе стороны");
const L22 = await newLobby(2);
await as(ME);
await expectErr("заблокированный не может подать заявку", () => q(`select apply_to_lobby($1, null)`, [L22]), "user_blocked");
await expectErr("заблокированный не может подписаться", () => q(`insert into follows(follower_id, following_id) values ($1, $2)`, [ME, ORG]), "user_blocked");
await as(ORG);
await expectErr("нельзя лайкнуть пост заблокированного", () => q(`insert into likes(post_id, user_id) values ($1, $2)`, [P21, ORG]), "user_blocked");
await expectErr("нельзя прокомментировать пост заблокированного", () => q(`insert into comments(post_id, user_id, text) values ($1, $2, 'x')`, [P21, ORG]), "user_blocked");
await expectErr("нельзя заблокировать себя", () => q(`select block_user($1)`, [ORG]), "cannot_block_self");
await q(`delete from blocks where blocker_id = $1 and blocked_id = $2`, [ORG, ME]);
check(!(await q(`select is_blocked_between($1, $2) as b`, [ORG, ME]))[0].b, "блокировку можно снять");

// Сообщения в чате
const L23 = await newLobby(2);
await join(L23, ME);
await as(null);
await q(`delete from notifications where type = 'chat_message'`);
await as(ME);
await q(`insert into lobby_messages(lobby_id, user_id, text) values ($1, $2, 'Первое')`, [L23, ME]);
await q(`insert into lobby_messages(lobby_id, user_id, text) values ($1, $2, 'Второе')`, [L23, ME]);
check((await notes(ORG, "chat_message")).length === 1, "чат: одно уведомление на серию сообщений");
check((await notes(ME, "chat_message")).length === 0, "чат: автору уведомление не приходит");
await as(null);
await q(`update notifications set read = true where user_id = $1 and type = 'chat_message'`, [ORG]);
await as(ME);
await q(`insert into lobby_messages(lobby_id, user_id, text) values ($1, $2, 'Третье')`, [L23, ME]);
check((await notes(ORG, "chat_message")).length === 2, "чат: после прочтения новое сообщение снова уведомляет");

// Перенос игры
const L24 = await newLobby(2, "90 minutes");
await join(L24, ME);
await as(null);
await q(`delete from notifications where type = 'reminder_2h'`);
await q(`select send_game_reminders()`);
check((await notes(ME, "reminder_2h")).length === 1, "перенос: первое напоминание отправлено");
await q(`update lobbies set start_time = now() + interval '100 minutes' where id = $1`, [L24]);
await q(`select send_game_reminders()`);
check((await notes(ME, "reminder_2h")).length === 2, "перенос: напоминание приходит заново");
await as(ORG);
await expectErr("игру с игроками нельзя перенести на время меньше чем за 30 минут", () =>
  q(`update lobbies set start_time = now() + interval '20 minutes' where id = $1`, [L24]), "too_soon_with_players");
await q(`update lobbies set start_time = now() + interval '45 minutes' where id = $1`, [L24]);
check(true, "перенос за 45 минут до начала разрешён");

// Счётчик игр организатора
const L25 = await newLobby(2);
await as(null);
await q(`update lobbies set start_time = now() - interval '3 hours' where id = $1`, [L25]);
const orgBefore = (await q(`select games_played from profiles where id = $1`, [ORG]))[0].games_played;
await q(`update lobbies set status = 'cancelled' where status in ('active', 'full') and id <> $1 and organizer_id = $2`, [L25, ORG]);
await q(`select finish_past_lobbies()`);
check((await q(`select games_played from profiles where id = $1`, [ORG]))[0].games_played === orgBefore, "игра без принятых игроков не даёт +1 организатору");

// Жалобы
await as(ME);
await q(`insert into reports(reporter_id, target_user_id, reason) values ($1, $2, 'spam')`, [ME, OTHER]);
await expectErr("повторная открытая жалоба отклоняется", () => q(`insert into reports(reporter_id, target_user_id, reason) values ($1, $2, 'spam')`, [ME, OTHER]), "reports_one_open_idx");
await expectErr("нельзя пожаловаться на себя", () => q(`insert into reports(reporter_id, target_user_id, reason) values ($1, $1, 'spam')`, [ME]), "reports_not_self");

// Подготовка к удалению аккаунта
const L26 = await newLobby(1);
const A26 = await join(L26, OTHER);
await as(OTHER);
const [{ id: L27 }] = await q(`insert into lobbies(organizer_id, sport, description, players_current, players_needed, start_time, city_id, location_name)
  values ($1, 'football', 'Моя игра', 2, 2, now() + interval '6 hours', 1, 'Поле') returning id`, [OTHER]);
await q(`select prepare_account_deletion()`);
row = await lobbyRow(L26);
check(row.accepted_count === 0 && row.status === "active" && (await appStatus(A26)) === "cancelled", "удаление аккаунта освобождает место в чужой игре", row);
check((await lobbyRow(L27)).status === "cancelled", "удаление аккаунта отменяет свои будущие игры");

// Этап 9: QR-отметка и лента
const THIRD = "33333333-3333-4333-8333-333333333333";
await as(null);
await db.exec(`insert into auth.users(id, email) values ('${THIRD}', 'third@x.kz')`);
await as(THIRD);
await db.exec(`insert into profiles(id, username, city_id, sports, level) values ('${THIRD}', 'third', 1, '{football}', 'amateur')`);
const L30 = await newLobby(3, "20 minutes");
await join(L30, ME);
await join(L30, THIRD);
await as(ME);
await expectErr("игрок не может получить код", () => q(`select get_checkin_code($1)`, [L30]), "not_organizer");
const checkIn = async (lobby, code) => (await q(`select check_in($1, $2) as r`, [lobby, code]))[0].r;
check((await checkIn(L30, "000000")) === "bad_code", "до показа кода отметиться нельзя");
await as(ORG);
const codeInfo = (await q(`select get_checkin_code($1) as c`, [L30]))[0].c;
check(/^\d{6}$/.test(codeInfo.code) && codeInfo.count === 1, "организатор получил код и отмечен автоматически", codeInfo.count);
await as(OTHER);
check((await checkIn(L30, codeInfo.code)) === "not_member", "посторонний не может отметиться даже с верным кодом");
await as(ME);
check((await checkIn(L30, codeInfo.code)) === "ok", "принятый игрок отметился по коду");
check((await checkIn(L30, codeInfo.code)) === "already", "повторная отметка не создаёт дубль");
check((await q(`select verified_games_count($1) as n`, [ME]))[0].n === 1, "игра с двумя отметками считается подтверждённой");
await as(THIRD);
const wrong = codeInfo.code === "000000" ? "000001" : "000000";
const tries = [];
for (let i = 0; i < 6; i++) tries.push(await checkIn(L30, wrong));
check(tries[4] === "bad_code" && tries[5] === "too_many", "после 5 неверных кодов за минуту попытки блокируются", tries.join(","));
await expectErr("секрет недоступен обычному пользователю", async () => {
  await db.exec("set role authenticated");
  try { await q(`select * from private.lobby_checkin_secrets`); } finally { await db.exec("reset role"); }
}, "permission denied");
const L31 = await newLobby(2, "3 hours");
await as(ORG);
await expectErr("код нельзя получить раньше чем за 30 минут", () => q(`select get_checkin_code($1)`, [L31]), "checkin_closed");

// С кем играли: при отметках считаются только пришедшие
await as(null);
await q(`update lobbies set start_time = now() - interval '3 hours', status = 'finished' where id = $1`, [L30]);
const playedWith = async (uid) => { await as(uid); return (await q(`select get_played_with_ids() as id`)).map((r) => r.id); };
let pw = await playedWith(ME);
check(pw.includes(ORG) && !pw.includes(THIRD), "лента: неотметившийся игрок не считается сыгравшим");
pw = await playedWith(THIRD);
check(!pw.includes(ME), "лента: связь не появляется и у неотметившегося");
await as(ORG);
await q(`select block_user($1)`, [ME]);
pw = await playedWith(ME);
check(!pw.includes(ORG), "лента: заблокированный исключён");
await as(ORG);
await q(`delete from blocks where blocker_id = $1 and blocked_id = $2`, [ORG, ME]);

// Игры в конце ленты
const L32 = await newLobby(2, "6 hours");
await as(ME);
let feedGames = (await q(`select get_feed_game_ids(10) as id`)).map((r) => r.id);
const inFeed = (await q(`select count(*)::int n from lobbies l join profiles p on p.id = $1 where l.id = any($2::uuid[]) and l.city_id = p.city_id and l.status = 'active'`, [ME, feedGames]))[0].n;
check(feedGames.length > 0 && inFeed === feedGames.length, "конец ленты: только открытые игры моего города", feedGames.length);
await q(`select apply_to_lobby($1, null)`, [L32]);
feedGames = (await q(`select get_feed_game_ids(10) as id`)).map((r) => r.id);
check(!feedGames.includes(L32), "конец ленты: игра с моей заявкой скрыта");

// Этап 10: команды, чаты, вызовы
const one1 = async (sql, params) => Object.values((await q(sql, params))[0])[0];
const makeCrew = (name, open = true) =>
  one1(`select create_crew($1, 'Описание', 'football', 1::smallint, $2)`, [name, open]);
const memberStatus = async (crew, uid) => (await q(`select status from crew_members where crew_id = $1 and user_id = $2`, [crew, uid]))[0]?.status;
const crewConv = async (crew) => (await q(`select id from conversations where crew_id = $1`, [crew]))[0].id;
const inConv = async (conv, uid) => (await q(`select is_conversation_member($1, $2) as m`, [conv, uid]))[0].m;
const say = (conv, uid, text) => q(`insert into chat_messages(conversation_id, user_id, text) values ($1, $2, $3)`, [conv, uid, text]);

// Тесты идут от суперпользователя, который обходит RLS; для проверки политик переключаемся на роль приложения
await db.exec(`grant usage on schema public, auth to authenticated;
  grant select, insert on chat_messages to authenticated;
  grant select on conversations, conversation_members, blocks, crews, crew_members, crew_challenges to authenticated;`);
const rls = async (fn) => {
  await db.exec("set role authenticated");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
};

await as(ME);
const C1 = await makeCrew("Тестовая команда");
await expectErr("название команды уникально", () => makeCrew("тестовая КОМАНДА"), "crew_name_taken");
const C1conv = await crewConv(C1);
check(await inConv(C1conv, ME), "создатель команды сразу в групповом чате");
await as(THIRD);
check((await one1(`select join_crew($1)`, [C1])) === "active", "в открытую команду вступают сразу");
check(await inConv(C1conv, THIRD), "новый участник попал в групповой чат");
await as(null);
check((await q(`select member_count from crews where id = $1`, [C1]))[0].member_count === 2, "счётчик участников считается базой");
await as(OTHER);
await expectErr("чужой не может писать в чат команды", () => rls(() => say(C1conv, OTHER, "Привет")), "row-level security");
await expectErr("нельзя писать от чужого имени", () => rls(() => say(C1conv, ME, "Подделка")), "row-level security");
await expectErr("не капитан не может убрать игрока", () => q(`select remove_crew_member($1, $2)`, [C1, THIRD]), "not_captain");

// Закрытая команда
await as(ORG);
const C2 = await makeCrew("Закрытая команда", false);
await as(OTHER);
check((await one1(`select join_crew($1)`, [C2])) === "pending", "в закрытую команду — по заявке");
check(!(await inConv(await (async () => { await as(null); const id = await crewConv(C2); await as(OTHER); return id; })(), OTHER)), "заявка не даёт доступа к чату");
await as(ORG);
await q(`select decide_crew_member($1, $2, true)`, [C2, OTHER]);
check((await memberStatus(C2, OTHER)) === "active", "капитан принял заявку");
await q(`select remove_crew_member($1, $2)`, [C2, OTHER]);
check((await memberStatus(C2, OTHER)) === "removed", "капитан убрал игрока");
await as(OTHER);
await expectErr("убранный игрок не может вернуться сам", () => q(`select join_crew($1)`, [C2]), "crew_removed");

// Групповой чат
await as(null);
await q(`delete from notifications where type in ('crew_message', 'direct_message')`);
await as(ME);
await say(C1conv, ME, "Всем привет");
await say(C1conv, ME, "Кто завтра?");
const crewNotes = await notes(THIRD, "crew_message");
check(crewNotes.length === 1 && crewNotes[0].crew_name === "Тестовая команда", "групповой чат: одно уведомление на серию");
await as(THIRD);
check((await one1(`select unread_chat_count()`)) === 1, "счётчик непрочитанных чатов");
await q(`select mark_conversation_read($1)`, [C1conv]);
check((await one1(`select unread_chat_count()`)) === 0, "чат прочитан");
check((await notes(THIRD, "crew_message")).length === 1 && (await q(`select count(*)::int n from notifications where user_id = $1 and type = 'crew_message' and not read`, [THIRD]))[0].n === 0, "прочитанный чат гасит уведомление");

// Личные сообщения
const FOURTH = "44444444-4444-4444-8444-444444444444";
await as(null);
await db.exec(`insert into auth.users(id, email) values ('${FOURTH}', 'fourth@x.kz')`);
await as(FOURTH);
await db.exec(`insert into profiles(id, username, city_id, sports, level) values ('${FOURTH}', 'fourth', 1, '{football}', 'amateur')`);
await expectErr("незнакомцу написать нельзя", () => q(`select start_direct_chat($1)`, [ME]), "cannot_message");
await as(ME);
await q(`insert into follows(follower_id, following_id) values ($1, $2) on conflict do nothing`, [ME, FOURTH]);
await as(FOURTH);
const D1 = await one1(`select start_direct_chat($1)`, [ME]);
check((await one1(`select start_direct_chat($1)`, [ME])) === D1, "у пары только один личный чат");
await say(D1, FOURTH, "Привет, сыграем?");
check((await notes(ME, "direct_message")).length === 1, "личное сообщение → уведомление");
await as(ME);
await say(D1, ME, "Давай");
const myChats = (await q(`select get_my_conversations() as c`)).map((r) => r.c);
const dm = myChats.find((c) => c.id === D1);
check(dm?.other?.username === "fourth" && dm?.last_text === "Давай", "список чатов показывает собеседника и последнее сообщение");
await as(THIRD);
const leaked = await rls(async () => (await q(`select count(*)::int n from chat_messages where conversation_id = $1`, [D1]))[0].n);
check(leaked === 0, "посторонний не видит личные сообщения", leaked);
await as(ME);
const visible = await rls(async () => (await q(`select count(*)::int n from chat_messages where conversation_id = $1`, [D1]))[0].n);
check(visible === 2, "участник видит свой личный чат", visible);
await as(ME);
await q(`select block_user($1)`, [FOURTH]);
await expectErr("заблокированному нельзя написать", () => say(D1, ME, "Эй"), "user_blocked");
await as(FOURTH);
await expectErr("заблокированный не может написать", () => say(D1, FOURTH, "Эй"), "user_blocked");
check(!(await q(`select get_my_conversations() as c`)).some((r) => r.c.id === D1), "заблокированный диалог скрыт из списка");
await as(ME);
await q(`delete from blocks where blocker_id = $1 and blocked_id = $2`, [ME, FOURTH]);

// Вызовы
await as(FOURTH);
const C3 = await makeCrew("Соперники");
await as(OTHER);
await expectErr("вызвать может только капитан", () => q(`select create_crew_challenge($1, $2, now() + interval '1 day', 'Поле', 5::smallint, null)`, [C1, C3]), "not_captain");
await as(ME);
await expectErr("вызов не раньше чем за час", () => q(`select create_crew_challenge($1, $2, now() + interval '10 minutes', 'Поле', 5::smallint, null)`, [C1, C3]), "bad_challenge_time");
const CH1 = await one1(`select create_crew_challenge($1, $2, now() + interval '1 day', 'Поле', 2::smallint, 'Сыграем?')`, [C1, C3]);
await expectErr("второй открытый вызов нельзя", () => q(`select create_crew_challenge($1, $2, now() + interval '2 days', 'Поле', 2::smallint, null)`, [C1, C3]), "challenge_exists");
check((await notes(FOURTH, "crew_challenge")).length === 1, "капитан соперников получил вызов");
await expectErr("свой вызов не принять", () => q(`select respond_crew_challenge($1, true)`, [CH1]), "not_captain");
await as(FOURTH);
const ML = await one1(`select respond_crew_challenge($1, true)`, [CH1]);
const matchRow = (await q(`select organizer_id, accepted_count, players_needed, crew_challenge_id, status from lobbies where id = $1`, [ML]))[0];
check(matchRow.organizer_id === ME && matchRow.accepted_count === 1 && matchRow.players_needed === 3 && matchRow.crew_challenge_id === CH1, "принятый вызов создал игру", matchRow);
check((await notes(THIRD, "crew_match")).length === 1, "участники команд узнали о матче");
await as(OTHER);
await expectErr("посторонний не может подать заявку на матч", () => q(`select apply_to_lobby($1, null)`, [ML]), "crew_match_only");
await expectErr("посторонний не может вступить в матч", () => q(`select join_crew_match($1)`, [ML]), "crew_match_only");
await as(THIRD);
await q(`select join_crew_match($1)`, [ML]);
await q(`select join_crew_match($1)`, [ML]);
check((await lobbyRow(ML)).accepted_count === 2, "игрок команды вступил в матч, повтор не считается дважды");
check(await mem(ML, THIRD), "участник матча получил доступ к чату игры");
await as(ME);
check(!(await q(`select get_feed_game_ids(10) as id`)).some((r) => r.id === ML), "матч команд не показывается среди открытых игр");
await q(`update lobbies set crew_challenge_id = null where id = $1`, [ML]);
check((await q(`select crew_challenge_id from lobbies where id = $1`, [ML]))[0].crew_challenge_id === CH1, "организатор не может открыть матч для всех");
const CH2 = await one1(`select create_crew_challenge($1, $2, now() + interval '2 days', 'Зал', 3::smallint, null)`, [C1, C3]);
await as(FOURTH);
await q(`select respond_crew_challenge($1, false)`, [CH2]);
check((await q(`select status from crew_challenges where id = $1`, [CH2]))[0].status === "declined", "вызов можно отклонить");

// Капитан уходит, удаление аккаунта
await as(ME);
await q(`select leave_crew($1)`, [C1]);
await as(null);
let crewRow = (await q(`select captain_id, member_count from crews where id = $1`, [C1]))[0];
check(crewRow.captain_id === THIRD && crewRow.member_count === 1, "капитан ушёл — капитаном стал следующий", crewRow);
await db.exec(`insert into crew_members(crew_id, user_id, status) values ('${C1}', '${OTHER}', 'active') on conflict (crew_id, user_id) do update set status = 'active'`);
await q(`delete from auth.users where id = $1`, [THIRD]);
crewRow = (await q(`select captain_id from crews where id = $1`, [C1]))[0];
check(crewRow?.captain_id === OTHER, "удаление аккаунта передаёт капитанство", crewRow);
await q(`delete from auth.users where id = $1`, [OTHER]);
check((await q(`select count(*)::int n from crews where id = $1`, [C1]))[0].n === 0, "команда без участников удаляется");

// Этап 11: турниры, модерация, сетка
await db.exec(`grant select on tournaments, tournament_teams, tournament_matches, tournament_contacts, app_admins to authenticated;`);
const ADMIN = "a0000000-0000-4000-8000-000000000001";
const HOST = "a0000000-0000-4000-8000-000000000002";
const CAPS = [3, 4, 5, 6, 7].map((n) => `a0000000-0000-4000-8000-00000000000${n}`);
await as(null);
for (const [i, id] of [ADMIN, HOST, ...CAPS].entries()) {
  await db.exec(`insert into auth.users(id, email) values ('${id}', 't${i}@x.kz');
    insert into profiles(id, username, city_id, sports, level) values ('${id}', 'tour_user${i}', 1, '{football}', 'amateur');`);
}
await db.exec(`insert into app_admins(user_id) values ('${ADMIN}')`);

const saveT = (id = null, name = "Кубок города") => one1(
  `select save_tournament($1, $2, 'Открытый турнир для любителей', 'Правила', 'football', 1::smallint, 'Стадион', 43.2, 76.9,
    now() + interval '5 days', now() + interval '3 days', 8::smallint, 5::smallint, 1000, 'Кубок', '+7 700 000 00 00')`, [id, name]);
const tStatus = async (id) => (await q(`select status from tournaments where id = $1`, [id]))[0].status;
const canSee = async (id) => rls(async () => (await q(`select count(*)::int n from tournaments where id = $1`, [id]))[0].n === 1);

await as(HOST);
const T1 = await saveT();
check((await tStatus(T1)) === "pending", "новый турнир уходит на модерацию");
check((await notes(ADMIN, "tournament_review")).length === 1, "модератор получил заявку");
await as(CAPS[0]);
check(!(await canSee(T1)), "турнир на модерации не виден другим");
await expectErr("на неодобренный турнир нельзя записаться", () => q(`select register_tournament_team($1, 'Рано', null)`, [T1]), "tournament_not_found");
await expectErr("обычный игрок не может одобрить", () => q(`select review_tournament($1, true, null)`, [T1]), "not_admin");
await expectErr("организатор не может одобрить свой турнир", async () => { await as(HOST); await q(`select review_tournament($1, true, null)`, [T1]); }, "not_admin");
await as(CAPS[0]);
await expectErr("нельзя назначить себя админом", () => rls(() => q(`insert into app_admins(user_id) values ($1)`, [CAPS[0]])), "permission denied");
check((await rls(async () => (await q(`select count(*)::int n from tournament_contacts where tournament_id = $1`, [T1]))[0].n)) === 0, "контакт организатора скрыт");
await as(ADMIN);
check(await canSee(T1), "модератор видит заявку");
check((await rls(async () => (await q(`select count(*)::int n from tournament_contacts where tournament_id = $1`, [T1]))[0].n)) === 1, "модератор видит контакт");
await expectErr("отказ требует причину", () => q(`select review_tournament($1, false, '  ')`, [T1]), "reason_required");
await q(`select review_tournament($1, false, 'Укажите точный адрес')`, [T1]);
check((await tStatus(T1)) === "rejected" && (await notes(HOST, "tournament_rejected"))[0]?.text === "Укажите точный адрес", "организатор получил причину отказа");
await as(HOST);
await saveT(T1, "Кубок города 2");
check((await tStatus(T1)) === "pending" && (await notes(ADMIN, "tournament_review")).length === 2, "исправленный турнир снова на модерации");
await as(CAPS[0]);
await expectErr("чужой турнир не исправить", () => saveT(T1), "not_organizer");
await as(ADMIN);
await q(`select review_tournament($1, true, null)`, [T1]);
check((await tStatus(T1)) === "registration" && (await notes(HOST, "tournament_approved")).length === 1, "турнир одобрен и открыта регистрация");
await as(HOST);
await expectErr("одобренный турнир нельзя тихо изменить", () => saveT(T1), "tournament_locked");
await expectErr("для старта нужно минимум 2 команды", () => q(`select start_tournament($1)`, [T1]), "not_enough_teams");

// Регистрация: 5 команд → сетка на 8 с 3 свободными проходами
const teamIds = [];
for (const [i, cap] of CAPS.entries()) {
  await as(cap);
  teamIds.push(await one1(`select register_tournament_team($1, $2, null)`, [T1, `Команда ${i + 1}`]));
}
await expectErr("капитан записывается один раз", () => q(`select register_tournament_team($1, 'Ещё', null)`, [T1]), "already_registered");
await as(ADMIN);
await expectErr("название команды уникально", () => q(`select register_tournament_team($1, 'команда 1', null)`, [T1]), "team_name_taken");
await as(CAPS[0]);
await expectErr("капитан не может запустить турнир", () => q(`select start_tournament($1)`, [T1]), "not_organizer");
await as(HOST);
await q(`select start_tournament($1)`, [T1]);
const matches = async () => q(`select * from tournament_matches where tournament_id = $1 order by round, position`, [T1]);
let ms = await matches();
check(ms.length === 7 && ms.filter((m) => m.round === 1).length === 4 && ms.filter((m) => m.round === 3).length === 1, "сетка на 5 команд: 4+2+1 матч", ms.length);
check(ms.filter((m) => m.status === "bye").length === 3, "3 свободных прохода");
const placed = ms.filter((m) => m.round === 1).flatMap((m) => [m.team_a_id, m.team_b_id]).filter(Boolean);
check(new Set(placed).size === 5, "каждая команда в сетке ровно один раз");
check(ms.filter((m) => m.round === 2).flatMap((m) => [m.team_a_id, m.team_b_id]).filter(Boolean).length === 3, "свободные проходы сразу во втором раунде");
await as(CAPS[0]);
await expectErr("после старта не записаться", () => q(`select register_tournament_team($1, 'Поздно', null)`, [T1]), "registration_closed");
await as(CAPS[1]);
await expectErr("капитан не вводит результат", () => q(`select report_tournament_match($1, 1::smallint, 0::smallint, null)`, [ms.find((m) => m.status === "ready").id]), "not_organizer");

await as(HOST);
const ready = ms.find((m) => m.round === 1 && m.status === "ready");
await expectErr("при ничьей нужен победитель", () => q(`select report_tournament_match($1, 2::smallint, 2::smallint, null)`, [ready.id]), "winner_required");
await expectErr("победитель должен быть из этого матча", () => q(`select report_tournament_match($1, 2::smallint, 2::smallint, $2)`, [ready.id, teamIds.find((t) => t !== ready.team_a_id && t !== ready.team_b_id)]), "winner_required");
await q(`select report_tournament_match($1, 2::smallint, 2::smallint, $2)`, [ready.id, ready.team_b_id]);
ms = await matches();
const nextOf = (m) => ms.find((x) => x.round === m.round + 1 && x.position === Math.floor(m.position / 2));
check([nextOf(ready).team_a_id, nextOf(ready).team_b_id].includes(ready.team_b_id), "победитель по пенальти прошёл дальше");
await q(`select report_tournament_match($1, 3::smallint, 1::smallint, null)`, [ready.id]);
ms = await matches();
const fixedNext = nextOf(ready);
check([fixedNext.team_a_id, fixedNext.team_b_id].includes(ready.team_a_id) && ![fixedNext.team_a_id, fixedNext.team_b_id].includes(ready.team_b_id), "исправленный результат меняет соперника в следующем раунде");

for (const round of [2, 3]) {
  ms = await matches();
  for (const m of ms.filter((x) => x.round === round)) {
    await q(`select report_tournament_match($1, 1::smallint, 0::smallint, null)`, [m.id]);
  }
}
ms = await matches();
const finalM = ms.find((m) => m.round === 3);
const tRow = (await q(`select status, winner_team_id from tournaments where id = $1`, [T1]))[0];
check(tRow.status === "finished" && tRow.winner_team_id === finalM.team_a_id, "финал завершает турнир и определяет чемпиона");
check((await notes(CAPS[0], "tournament_finished")).length === 1, "капитаны узнали о завершении");
const semi = ms.find((m) => m.round === 2 && m.team_b_id !== finalM.team_a_id && m.winner_id === finalM.team_a_id);
if (semi) await expectErr("нельзя сменить победителя, если следующий матч сыгран", () => q(`select report_tournament_match($1, 0::smallint, 1::smallint, null)`, [semi.id]), "next_match_played");

// Отмена
const T2 = await saveT(null, "Отменяемый кубок");
await as(CAPS[0]);
await expectErr("чужой турнир не отменить", () => q(`select cancel_tournament($1)`, [T2]), "not_organizer");
await as(HOST);
await q(`select cancel_tournament($1)`, [T2]);
check((await tStatus(T2)) === "cancelled", "организатор отменил турнир");

// Чужие блокировки не видны через API
await as(ME);
await q(`select block_user($1)`, [ORG]);
const blockedFor = async (uid) => {
  await as(uid);
  return rls(async () => (await q(`select public.is_blocked_between($1, $2) as b`, [ME, ORG]))[0].b);
};
check((await blockedFor(OTHER)) === false, "посторонний не узнает о чужой блокировке");
check((await blockedFor(null)) === false, "гость не узнает о чужой блокировке");
check((await blockedFor(ME)) === true, "заблокировавший видит блокировку");
check((await blockedFor(ORG)) === true, "заблокированный участник пары видит блокировку");
await as(OTHER);
check((await rls(async () => (await q(`select count(*)::int n from blocks where blocker_id = $1`, [ME]))[0].n)) === 0, "таблица чужих блокировок скрыта");
await db.exec(`grant select on posts to authenticated`);
await as(ME);
await q(`insert into posts(author_id, media) values ($1, $2::jsonb)`, [ME, JSON.stringify([{ type: "image", path: `${ME}/block-check.jpg`, w: 100, h: 100 }])]);
await as(ORG);
const hiddenPosts = await rls(async () => (await q(`select count(*)::int n from posts where author_id = $1`, [ME]))[0].n);
check(hiddenPosts === 0, "RLS по-прежнему скрывает посты при блокировке");
await as(ME);
await q(`delete from blocks where blocker_id = $1 and blocked_id = $2`, [ME, ORG]);

realLog(failures ? `\n✗ Провалено проверок: ${failures}` : "\n✓ Все проверки базы данных прошли");
process.exit(failures ? 1 : 0);
