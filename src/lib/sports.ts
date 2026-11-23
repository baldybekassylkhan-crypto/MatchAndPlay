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

export const SPORTS: Record<SportId, { label: string }> = {
  football: { label: "Футбол" },
  basketball: { label: "Баскетбол" },
  volleyball: { label: "Волейбол" },
  tennis: { label: "Теннис" },
  padel: { label: "Падел" },
  hockey: { label: "Хоккей" },
  table_tennis: { label: "Настольный теннис" },
  badminton: { label: "Бадминтон" },
  running: { label: "Бег" },
  other: { label: "Другое" },
};
