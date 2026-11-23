import { SPORTS, type SportId } from "@/lib/sports";
import { formatShortDayTime, formatTime } from "@/lib/time";

export interface AppNotification {
  id: number;
  user_id: string;
  type: string;
  payload: {
    lobby_id?: string;
    post_id?: string;
    sport?: SportId;
    start_time?: string;
    location?: string;
    actor?: string;
    actor_avatar?: string | null;
    message?: string | null;
    text?: string;
    changes?: string[];
  };
  read: boolean;
  created_at: string;
}

export interface RenderedNotification {
  title: string;
  body: string;
  href: string;
  emoji: string;
}

const CHANGE_LABELS: Record<string, string> = { time: "время", place: "место", price: "стоимость", details: "описание" };

/** Текст уведомления — один и тот же для списка в приложении и для push. */
export function renderNotification(n: Pick<AppNotification, "type" | "payload">): RenderedNotification {
  const p = n.payload;
  const sport = p.sport ? SPORTS[p.sport] : null;
  const game = sport ? sport.label.toLowerCase() : "игру";
  const when = p.start_time ? formatShortDayTime(p.start_time) : "";
  const lobbyHref = p.lobby_id ? `/lobby/${p.lobby_id}` : "/games";
  const postHref = p.post_id ? `/p/${p.post_id}` : "/";
  const actor = p.actor ? `@${p.actor}` : "Кто-то";

  switch (n.type) {
    case "application_new":
      return {
        emoji: "🙋",
        title: "Новая заявка",
        body: `${actor} хочет сыграть: ${game}, ${when}${p.message ? ` — «${p.message}»` : ""}`,
        href: lobbyHref,
      };
    case "application_accepted":
      return { emoji: "✅", title: "Вы в игре!", body: `${actor} принял заявку: ${game}, ${when}`, href: lobbyHref };
    case "application_rejected":
      return { emoji: "🙅", title: "Заявка отклонена", body: `Организатор не принял заявку на ${game}, ${when}. Поищите другую игру!`, href: "/search" };
    case "player_left":
      return { emoji: "🚪", title: "Игрок отказался", body: `${actor} не сможет прийти на ${game}, ${when}. Место снова свободно.`, href: lobbyHref };
    case "player_removed":
      return { emoji: "🚫", title: "Вас убрали из игры", body: `Организатор убрал вас из игры: ${game}, ${when}. Поищите другую игру!`, href: "/search" };
    case "chat_message":
      return { emoji: "💬", title: `Чат: ${sport?.label ?? "игра"}, ${when}`, body: `${actor}: ${p.text ?? ""}`, href: p.lobby_id ? `/lobby/${p.lobby_id}/chat` : "/games" };
    case "lobby_cancelled":
      return { emoji: "❌", title: "Игра отменена", body: `Организатор отменил ${game}, ${when}`, href: lobbyHref };
    case "lobby_updated": {
      const what = (p.changes ?? []).map((c) => CHANGE_LABELS[c] ?? c).join(", ");
      return { emoji: "✏️", title: "Игра изменена", body: `${sport?.label ?? "Игра"}, ${when}: изменено ${what || "описание"}`, href: lobbyHref };
    }
    case "reminder_2h": {
      const deadline = p.start_time ? formatTime(new Date(new Date(p.start_time).getTime() - 30 * 60_000)) : "";
      return {
        emoji: "⏰",
        title: "Игра через 2 часа",
        body: `${sport?.label ?? "Игра"} в ${p.start_time ? formatTime(p.start_time) : ""}${p.location ? `, ${p.location}` : ""}. Скоро нельзя будет отменить участие — до ${deadline}.`,
        href: lobbyHref,
      };
    }
    case "reminder_30m":
      return {
        emoji: "🔥",
        title: "Через 30 минут начало!",
        body: `${sport?.label ?? "Игра"}${p.location ? `, ${p.location}` : ""}. Отменить участие уже нельзя — до встречи на поле!`,
        href: lobbyHref,
      };
    case "follow":
      return { emoji: "👋", title: "Новый подписчик", body: `${actor} подписался на вас`, href: p.actor ? `/u/${p.actor}` : "/" };
    case "like":
      return { emoji: "❤️", title: "Нравится", body: `${actor} оценил ваш пост`, href: postHref };
    case "comment":
      return { emoji: "💬", title: "Новый комментарий", body: `${actor}: ${p.text ?? ""}`, href: `${postHref}#comments` };
    default:
      return { emoji: "🔔", title: "Match&Play", body: "У вас новое уведомление", href: "/notifications" };
  }
}
