import type { SportId } from "@/lib/sports";

export type SkillLevel = "beginner" | "amateur" | "advanced";

export interface City {
  id: number;
  slug: string;
  name_ru: string;
  name_kz: string;
  aliases: string[];
  lat: number;
  lng: number;
  sort_order: number;
}

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  city_id: number;
  sports: SportId[];
  level: SkillLevel;
  games_played: number;
  /** Указывается по желанию: нужен для игр «только для девушек» */
  gender?: "female" | "male" | null;
  locale?: "ru" | "kk";
  created_at: string;
  updated_at: string;
}

export type ProfileWithCity = Profile & { city: Pick<City, "name_ru"> | null };

export type MiniProfile = Pick<Profile, "id" | "username" | "full_name" | "avatar_url">;

export type LobbyStatus = "active" | "full" | "cancelled" | "finished";
export type ApplicationStatus = "pending" | "accepted" | "rejected" | "cancelled";

export interface Lobby {
  id: string;
  organizer_id: string;
  sport: SportId;
  description: string;
  players_current: number;
  players_needed: number;
  accepted_count: number;
  start_time: string;
  duration_min: number;
  city_id: number;
  location_name: string;
  lat: number | null;
  lng: number | null;
  level: SkillLevel | null;
  price_kzt: number | null;
  /** true — на улице, false — в зале, null — не указано */
  is_outdoor?: boolean | null;
  /** Вступить могут только девушки (пол указан в профиле) */
  women_only?: boolean;
  status: LobbyStatus;
  /** Матч между двумя командами: вступают только их игроки */
  crew_challenge_id?: string | null;
  created_at: string;
  updated_at: string;
}

/** Лобби вместе с организатором и городом — для карточек и страницы лобби. */
export type LobbyWithMeta = Lobby & {
  organizer: MiniProfile | null;
  city: (Pick<City, "name_ru"> & Partial<Pick<City, "lat" | "lng">>) | null;
};

export interface LobbyApplication {
  id: string;
  lobby_id: string;
  user_id: string;
  message: string | null;
  status: ApplicationStatus;
  created_at: string;
  decided_at: string | null;
}

export type ApplicationWithUser = LobbyApplication & { user: MiniProfile | null };
export type ApplicationWithLobby = LobbyApplication & { lobby: LobbyWithMeta | null };

export interface PostMedia {
  type: "image" | "video";
  /** Путь в бакете posts: "<user_id>/<файл>" */
  path: string;
  w: number;
  h: number;
  duration?: number;
}

export interface Post {
  id: string;
  author_id: string;
  caption: string | null;
  sport: SportId | null;
  lobby_id: string | null;
  media: PostMedia[];
  like_count: number;
  comment_count: number;
  created_at: string;
}

export type PostWithMeta = Post & {
  author: MiniProfile | null;
  lobby: Pick<Lobby, "id" | "sport" | "start_time"> | null;
  /** Лайкнул ли текущий пользователь */
  liked: boolean;
  /** Пост из рекомендаций (не из подписок) */
  recommended?: boolean;
};

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  text: string;
  created_at: string;
  user: MiniProfile | null;
}

/** Сколько всего игроков и мест в лобби. */
export function lobbySlots(l: Pick<Lobby, "players_current" | "players_needed" | "accepted_count">) {
  const total = l.players_current + l.players_needed;
  const joined = l.players_current + l.accepted_count;
  return { total, joined, free: Math.max(l.players_needed - l.accepted_count, 0) };
}

export const LEVELS: { id: SkillLevel; label: string; hint: string }[] = [
  { id: "beginner", label: "Новичок", hint: "Только начинаю" },
  { id: "amateur", label: "Любитель", hint: "Играю регулярно" },
  { id: "advanced", label: "Продвинутый", hint: "Сильный уровень" },
];
