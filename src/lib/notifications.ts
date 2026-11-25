import { SPORTS, type SportId } from "@/lib/sports";
import { formatShortDayTime, formatTime } from "@/lib/time";
import { COURT_ISSUES, type CourtIssue } from "@/lib/courts";
import { describeWeather, type WeatherReason } from "@/lib/weather";

export interface AppNotification {
  id: number;
  user_id: string;
  type: string;
  payload: {
    lobby_id?: string;
    post_id?: string;
    conversation_id?: string;
    crew_id?: string;
    crew_name?: string;
    tournament_id?: string;
    tournament_name?: string;
    sport?: SportId;
    start_time?: string;
    location?: string;
    actor?: string;
    actor_avatar?: string | null;
    message?: string | null;
    text?: string;
    changes?: string[];
    venue?: string;
    kind?: string;
    note?: string | null;
    weather?: { reasons: WeatherReason[]; precip_prob: number; wind_ms: number; temp_min: number; temp_max: number };
  };
  read: boolean;
  created_at: string;
}

export type NotificationIconName =
  | "ban" | "bell" | "check" | "clock" | "cloud" | "landmark" | "gift" | "crown" | "flag" | "heart" | "leave" | "mail"
  | "message" | "pencil" | "shield" | "swords" | "trophy" | "userPlus" | "users" | "x";

export interface RenderedNotification {
  title: string;
  body: string;
  href: string;
  icon: NotificationIconName;
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
  const crewHref = p.crew_id ? `/crews/${p.crew_id}` : "/crews";
  const crewName = p.crew_name ?? "команда";
  const chatHref = p.conversation_id ? `/messages/${p.conversation_id}` : "/crews?tab=chats";
  const tournamentHref = p.tournament_id ? `/tournaments/${p.tournament_id}` : "/tournaments";
  const tournament = p.tournament_name ? `«${p.tournament_name}»` : "Турнир";

  switch (n.type) {
    case "tournament_review":
      return { icon: "shield", title: "Турнир на модерации", body: `${actor} отправил ${tournament}`, href: "/admin/tournaments" };
    case "tournament_approved":
      return { icon: "trophy", title: "Турнир одобрен!", body: `${tournament} открыт для записи команд`, href: tournamentHref };
    case "tournament_rejected":
      return { icon: "pencil", title: "Турнир отклонён", body: `${tournament}${p.text ? `: ${p.text}` : ""}`, href: tournamentHref };
    case "tournament_team":
      return { icon: "userPlus", title: "Новая команда", body: `${p.text ?? "Команда"} записалась на ${tournament}`, href: tournamentHref };
    case "tournament_team_removed":
      return { icon: "ban", title: "Команда снята", body: `Организатор снял вашу команду с турнира ${tournament}`, href: tournamentHref };
    case "tournament_started":
      return { icon: "clock", title: "Турнир начался!", body: `Сетка ${tournament} готова. Посмотрите соперника`, href: tournamentHref };
    case "tournament_finished":
      return { icon: "flag", title: "Турнир завершён", body: `Посмотрите итоги: ${tournament}`, href: tournamentHref };
    case "tournament_cancelled":
      return { icon: "x", title: "Турнир отменён", body: `Организатор отменил ${tournament}`, href: tournamentHref };
    case "direct_message":
      return { icon: "mail", title: actor, body: p.text ?? "Новое сообщение", href: chatHref };
    case "crew_message":
      return { icon: "users", title: crewName, body: `${actor}: ${p.text ?? ""}`, href: chatHref };
    case "crew_join_request":
      return { icon: "userPlus", title: "Заявка в команду", body: `${actor} хочет вступить в «${crewName}»`, href: crewHref };
    case "crew_member_joined":
      return { icon: "userPlus", title: "Новый игрок", body: `${actor} вступил в «${crewName}»`, href: crewHref };
    case "crew_accepted":
      return { icon: "check", title: "Вы в команде!", body: `Капитан принял вас в «${crewName}»`, href: crewHref };
    case "crew_rejected":
      return { icon: "x", title: "Заявка отклонена", body: `Капитан «${crewName}» не принял заявку`, href: "/crews" };
    case "crew_removed":
      return { icon: "ban", title: "Вас убрали из команды", body: `Вы больше не в «${crewName}»`, href: "/crews" };
    case "crew_captain":
      return { icon: "crown", title: "Вы теперь капитан", body: `Вы стали капитаном «${crewName}»`, href: crewHref };
    case "crew_challenge":
      return { icon: "swords", title: "Вам бросили вызов!", body: `«${crewName}» вызывает вас: ${game}, ${when}${p.location ? `, ${p.location}` : ""}`, href: crewHref };
    case "crew_challenge_declined":
      return { icon: "flag", title: "Вызов отклонён", body: `«${crewName}» не принимает вызов на ${when}`, href: crewHref };
    case "crew_match":
      return { icon: "clock", title: "Матч команд!", body: `${crewName}: ${game}, ${when}. Подтвердите участие`, href: lobbyHref };
    case "application_new":
      return {
        icon: "userPlus",
        title: "Новая заявка",
        body: `${actor} хочет сыграть: ${game}, ${when}${p.message ? ` — «${p.message}»` : ""}`,
        href: lobbyHref,
      };
    case "application_accepted":
      return { icon: "check", title: "Вы в игре!", body: `${actor} принял заявку: ${game}, ${when}`, href: lobbyHref };
    case "application_rejected":
      return { icon: "x", title: "Заявка отклонена", body: `Организатор не принял заявку на ${game}, ${when}. Поищите другую игру!`, href: "/search" };
    case "player_left":
      return { icon: "leave", title: "Игрок отказался", body: `${actor} не сможет прийти на ${game}, ${when}. Место снова свободно.`, href: lobbyHref };
    case "player_removed":
      return { icon: "ban", title: "Вас убрали из игры", body: `Организатор убрал вас из игры: ${game}, ${when}. Поищите другую игру!`, href: "/search" };
    case "chat_message":
      return { icon: "message", title: `Чат: ${sport?.label ?? "игра"}, ${when}`, body: `${actor}: ${p.text ?? ""}`, href: p.lobby_id ? `/lobby/${p.lobby_id}/chat` : "/games" };
    case "lobby_cancelled":
      return { icon: "x", title: "Игра отменена", body: `Организатор отменил ${game}, ${when}`, href: lobbyHref };
    case "lobby_updated": {
      const what = (p.changes ?? []).map((c) => CHANGE_LABELS[c] ?? c).join(", ");
      return { icon: "pencil", title: "Игра изменена", body: `${sport?.label ?? "Игра"}, ${when}: изменено ${what || "описание"}`, href: lobbyHref };
    }
    case "reminder_2h": {
      const deadline = p.start_time ? formatTime(new Date(new Date(p.start_time).getTime() - 30 * 60_000)) : "";
      return {
        icon: "clock",
        title: "Игра через 2 часа",
        body: `${sport?.label ?? "Игра"} в ${p.start_time ? formatTime(p.start_time) : ""}${p.location ? `, ${p.location}` : ""}. Скоро нельзя будет отменить участие — до ${deadline}.`,
        href: lobbyHref,
      };
    }
    case "weather_alert": {
      const w = p.weather;
      const forecast = w
        ? describeWeather({ reasons: w.reasons, precipProb: w.precip_prob, windMs: w.wind_ms, tempMin: w.temp_min, tempMax: w.temp_max })
        : "плохая погода";
      return {
        icon: "cloud",
        title: "Погода на игру",
        body: `${sport?.label ?? "Игра"} в ${p.start_time ? formatTime(p.start_time) : ""}: ожидается ${forecast}. Договоритесь в чате, играете ли.`,
        href: lobbyHref,
      };
    }
    case "court_report_sent":
    case "court_report_in_progress":
    case "court_report_fixed":
    case "court_report_rejected": {
      const status = {
        court_report_sent: ["Обращение передано в акимат", "landmark"],
        court_report_in_progress: ["Акимат взял в работу", "landmark"],
        court_report_fixed: ["Площадку исправили! 🎉", "check"],
        court_report_rejected: ["Обращение отклонено", "x"],
      }[n.type]!;
      const issue = p.kind && p.kind in COURT_ISSUES ? COURT_ISSUES[p.kind as CourtIssue].label : "Проблема";
      return {
        icon: status[1] as NotificationIconName,
        title: status[0],
        body: `${issue}: ${p.venue ?? "площадка"}${p.note ? `. ${p.note}` : ""}`,
        href: "/courts",
      };
    }
    case "reminder_30m":
      return {
        icon: "clock",
        title: "Через 30 минут начало!",
        body: `${sport?.label ?? "Игра"}${p.location ? `, ${p.location}` : ""}. Отменить участие уже нельзя — до встречи на поле!`,
        href: lobbyHref,
      };
    case "follow":
      return { icon: "userPlus", title: "Новый подписчик", body: `${actor} подписался на вас`, href: p.actor ? `/u/${p.actor}` : "/" };
    case "like":
      return { icon: "heart", title: "Нравится", body: `${actor} оценил ваш пост`, href: postHref };
    case "comment":
      return { icon: "message", title: "Новый комментарий", body: `${actor}: ${p.text ?? ""}`, href: `${postHref}#comments` };
    default:
      return { icon: "bell", title: "Match&Play", body: "У вас новое уведомление", href: "/notifications" };
  }
}
