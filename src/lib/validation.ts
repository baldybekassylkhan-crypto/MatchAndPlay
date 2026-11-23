import { z } from "zod";
import { SPORT_IDS } from "@/lib/sports";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === "" ? null : v));

export const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_.]{3,20}$/, "3–20 символов: латиница, цифры, «_» и «.»"),
  full_name: optionalText(50, "Не больше 50 символов"),
  bio: optionalText(160, "Не больше 160 символов"),
  city_id: z.coerce.number().int().min(1, "Выберите город"),
  sports: z.array(z.enum(SPORT_IDS)).min(1, "Выберите хотя бы один вид спорта").max(SPORT_IDS.length),
  level: z.enum(["beginner", "amateur", "advanced"], { message: "Выберите уровень" }),
  avatar_url: z.url().nullable(),
});

export type ProfileInput = z.infer<typeof profileSchema>;

const MAX_DAYS_AHEAD = 60;

export const lobbySchema = z
  .object({
    sport: z.enum(SPORT_IDS, { message: "Выберите вид спорта" }),
    description: z.string().trim().min(3, "Напишите пару слов об игре").max(300, "Не больше 300 символов"),
    players_current: z.coerce.number().int().min(1, "Минимум 1 (вы сами)").max(50, "Не больше 50"),
    players_needed: z.coerce.number().int().min(1, "Нужен хотя бы 1 игрок").max(50, "Не больше 50"),
    start_time: z.date({ message: "Укажите дату и время" }),
    duration_min: z.coerce.number().int().min(15).max(600),
    city_id: z.coerce.number().int().min(1, "Выберите город"),
    location_name: z.string().trim().min(2, "Укажите площадку или адрес").max(120, "Не больше 120 символов"),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    level: z.enum(["beginner", "amateur", "advanced"]).nullable(),
    price_kzt: z.number().int().min(0, "Не может быть меньше 0").max(100000, "Слишком большая сумма").nullable(),
  })
  .superRefine((v, ctx) => {
    const now = Date.now();
    if (v.start_time.getTime() < now + 15 * 60_000) {
      ctx.addIssue({ code: "custom", path: ["start_time"], message: "Игра должна начинаться минимум через 15 минут" });
    }
    if (v.start_time.getTime() > now + MAX_DAYS_AHEAD * 86_400_000) {
      ctx.addIssue({ code: "custom", path: ["start_time"], message: `Не дальше чем на ${MAX_DAYS_AHEAD} дней вперёд` });
    }
  });

export type LobbyInput = z.infer<typeof lobbySchema>;

/** Ошибки zod → { поле: сообщение } для показа под полями формы. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

/** Разрешаем редирект только на внутренние пути. */
export function safeNext(next: string | null | undefined, fallback = "/") {
  // Браузер считает «/\example.com» адресом другого сайта, как и «//example.com»
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
