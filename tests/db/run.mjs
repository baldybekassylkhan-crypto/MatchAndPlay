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

for (const f of ["migrations/0001_init.sql", "migrations/0002_cities.sql", "migrations/0003_lobbies.sql", "migrations/0004_swipes_saved.sql", "migrations/0005_ai_quota.sql", "migrations/0006_posts.sql", "migrations/0007_chat_notifications.sql", "seed.sql"]) {
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

realLog(failures ? `\n✗ Провалено проверок: ${failures}` : "\n✓ Все проверки базы данных прошли");
process.exit(failures ? 1 : 0);
