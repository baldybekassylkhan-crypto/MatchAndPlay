-- Удаляет демо-данные, загруженные из seed.sql. Настоящие аккаунты и их данные не трогает.
-- Демо-аккаунты: почта @demo.matchandplay.kz, id вида d0000000-…
-- Вместе с аккаунтами каскадом удаляются их профили, игры (и все заявки, свайпы,
-- сохранения, напоминания, чаты этих игр), посты (с лайками и комментариями),
-- их лайки, комментарии, подписки и уведомления.

begin;

-- Уведомления настоящих пользователей о демо-событиях (лайк от демо-игрока, заявка в демо-игру и т. п.)
delete from public.notifications n
 where n.payload->>'actor' in (select username from public.profiles where id::text like 'd0000000-%')
    or n.payload->>'lobby_id' in (select id::text from public.lobbies where organizer_id::text like 'd0000000-%')
    or n.payload->>'post_id' in (select id::text from public.posts where author_id::text like 'd0000000-%');

-- Демо-аккаунты (всё остальное удалится каскадом)
delete from auth.users where email like '%@demo.matchandplay.kz';

commit;

-- Что осталось
select
  (select count(*) from public.profiles)            as profiles,
  (select count(*) from public.lobbies)             as lobbies,
  (select count(*) from public.lobby_applications)  as applications,
  (select count(*) from public.posts)               as posts,
  (select count(*) from public.comments)            as comments,
  (select count(*) from public.likes)               as likes,
  (select count(*) from public.follows)             as follows;
