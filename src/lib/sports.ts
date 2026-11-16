export const SPORT_IDS = [
  "football",
  "basketball",
  "volleyball",
  "tennis",
  "padel",
  "hockey",
  "table_tennis",
  "badminton",
  "running",
  "other",
] as const;

export type SportId = (typeof SPORT_IDS)[number];

export const SPORTS: Record<SportId, { label: string; emoji: string }> = {
  football: { label: "Футбол", emoji: "⚽" },
  basketball: { label: "Баскетбол", emoji: "🏀" },
  volleyball: { label: "Волейбол", emoji: "🏐" },
  tennis: { label: "Теннис", emoji: "🎾" },
  padel: { label: "Падел", emoji: "🥎" },
  hockey: { label: "Хоккей", emoji: "🏒" },
  table_tennis: { label: "Настольный теннис", emoji: "🏓" },
  badminton: { label: "Бадминтон", emoji: "🏸" },
  running: { label: "Бег", emoji: "🏃" },
  other: { label: "Другое", emoji: "🎯" },
};
