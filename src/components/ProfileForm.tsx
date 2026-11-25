"use client";

import { useT } from "@/components/I18nProvider";
import clsx from "clsx";
import { Loader2 } from "lucide-react";
import { useActionState, useState } from "react";
import { saveProfile, type ProfileFormState } from "@/app/actions/profile";
import { AvatarUpload } from "@/components/AvatarUpload";
import { CityPicker } from "@/components/CityPicker";
import { SportGrid } from "@/components/ui/SportGrid";
import type { SportId } from "@/lib/sports";
import { LEVELS, type City, type Profile, type SkillLevel } from "@/lib/types";

const initialState: ProfileFormState = { error: null };

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1.5 text-sm text-danger">{message}</p> : null;
}

export function ProfileForm({
  mode,
  userId,
  cities,
  profile,
}: {
  mode: "onboarding" | "edit";
  userId: string;
  cities: City[];
  profile?: Profile | null;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(saveProfile, initialState);
  const [username, setUsername] = useState(profile?.username ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);
  const [cityId, setCityId] = useState<number | null>(profile?.city_id ?? null);
  const [sports, setSports] = useState<SportId[]>(profile?.sports ?? []);
  const [level, setLevel] = useState<SkillLevel>(profile?.level ?? "amateur");
  const [gender, setGender] = useState<"female" | "male" | null>(profile?.gender ?? null);
  const f = state.fields ?? {};

  const toggleSport = (id: SportId) =>
    setSports((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="avatar_url" value={avatarUrl ?? ""} />
      <input type="hidden" name="level" value={level} />
      {mode !== "onboarding" && <input type="hidden" name="gender" value={gender ?? ""} />}
      {sports.map((s) => (
        <input key={s} type="hidden" name="sports" value={s} />
      ))}

      <AvatarUpload userId={userId} value={avatarUrl} name={username} onChange={setAvatarUrl} />

      <div>
        <label className="label" htmlFor="username">
          {t("Ник")}
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted">@</span>
          <input
            id="username"
            name="username"
            className="input pl-9"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
            placeholder="aidos_10"
            maxLength={20}
            autoCapitalize="none"
            autoCorrect="off"
            required
          />
        </div>
        <FieldError message={f.username} />
      </div>

      <div>
        <label className="label" htmlFor="full_name">
          Имя <span className="font-normal">{t("(необязательно)")}</span>
        </label>
        <input
          id="full_name"
          name="full_name"
          className="input"
          defaultValue={profile?.full_name ?? ""}
          placeholder={t("Айдос Сериков")}
          maxLength={50}
        />
        <FieldError message={f.full_name} />
      </div>

      <div>
        <span className="label">{t("Город")}</span>
        <CityPicker cities={cities} value={cityId} onChange={setCityId} />
        <FieldError message={f.city_id} />
      </div>

      <div>
        <span className="label">{t("Во что играете")}</span>
        <SportGrid selected={sports} onToggle={toggleSport} />
        <FieldError message={f.sports} />
      </div>

      <div>
        <span className="label">{t("Уровень игры")}</span>
        <div className="grid grid-cols-3 gap-2">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLevel(l.id)}
              aria-pressed={level === l.id}
              className={clsx(
                "rounded-2xl border p-3 text-left transition",
                level === l.id ? "border-accent bg-accent/12 text-accent" : "border-line bg-surface",
              )}
            >
              <div className="text-sm font-semibold">{t(l.label)}</div>
              <div className={clsx("text-xs", level === l.id ? "opacity-70" : "text-muted")}>{l.hint}</div>
            </button>
          ))}
        </div>
      </div>

      {mode !== "onboarding" && (
        <div>
          <span className="label">
            Пол <span className="font-normal">{t("(необязательно, другим не показывается)")}</span>
          </span>
          <div className="grid grid-cols-3 gap-2">
            {([["female", "Женский"], ["male", "Мужской"], [null, "Не указывать"]] as const).map(([v, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={gender === v}
                onClick={() => setGender(v)}
                className={clsx("chip justify-center", gender === v && "chip-active")}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-sm text-muted">{t("Нужен, чтобы создавать игры «только для девушек» и вступать в них.")}</p>
        </div>
      )}

      <div>
        <label className="label" htmlFor="bio">
          О себе <span className="font-normal">{t("(необязательно)")}</span>
        </label>
        <textarea
          id="bio"
          name="bio"
          className="input h-24 resize-none py-3"
          defaultValue={profile?.bio ?? ""}
          placeholder={t("Играю в футбол по выходным, ищу команду в Алматы")}
          maxLength={160}
        />
        <FieldError message={f.bio} />
      </div>

      {state.error && <p className="rounded-2xl bg-danger/10 p-3 text-sm text-danger">{state.error}</p>}

      <button className="btn-primary w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {mode === "onboarding" ? t("Готово, поехали!") : t("Сохранить")}
      </button>
    </form>
  );
}
