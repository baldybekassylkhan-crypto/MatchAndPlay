"use client";

import clsx from "clsx";
import { Activity, AtSign, Camera, Check, ChevronLeft, Dumbbell, Loader2, MapPin, PenLine, Sprout, Trophy, UserRound, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useActionState, useEffect, useRef, useState } from "react";
import { saveProfile, type ProfileFormState } from "@/app/actions/profile";
import { AvatarUpload } from "@/components/AvatarUpload";
import { CityPicker } from "@/components/CityPicker";
import { Logo } from "@/components/Logo";
import { USERNAME_RE, useUsernameCheck } from "@/components/onboarding/useUsernameCheck";
import { SportGrid } from "@/components/ui/SportGrid";
import type { SportId } from "@/lib/sports";
import { LEVELS, type City, type SkillLevel } from "@/lib/types";

const STEPS = [
  { id: "username", icon: UserRound, title: "Как тебя называть?", subtitle: "Ник увидят другие игроки. Имя — по желанию." },
  { id: "avatar", icon: Camera, title: "Добавь фото", subtitle: "Так организаторам проще принять заявку. Можно позже.", optional: true },
  { id: "city", icon: MapPin, title: "Где играешь?", subtitle: "Будем показывать игры в твоём городе." },
  { id: "sports", icon: Dumbbell, title: "Во что играешь?", subtitle: "Выбери один или несколько видов спорта." },
  { id: "level", icon: Activity, title: "Какой у тебя уровень?", subtitle: "Поможет найти игру по силам." },
  { id: "bio", icon: PenLine, title: "Пара слов о себе", subtitle: "Например: «Играю в нападении, ищу команду по выходным».", optional: true },
] as const;
type StepId = (typeof STEPS)[number]["id"];

const initialState: ProfileFormState = { error: null };
const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
};

/** Знакомство по шагам, как сторис: полоски прогресса сверху, по одному вопросу на экран. */
export function OnboardingWizard({ userId, cities, nextPath = "/" }: { userId: string; cities: City[]; nextPath?: string }) {
  const [state, formAction, pending] = useActionState(saveProfile, initialState);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cityId, setCityId] = useState<number | null>(null);
  const [sports, setSports] = useState<SportId[]>([]);
  const [level, setLevel] = useState<SkillLevel | null>(null);
  const [bio, setBio] = useState("");

  const usernameStatus = useUsernameCheck(username);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const formRef = useRef<HTMLFormElement>(null);

  // Ошибка сервера (например, ник успели занять) — возвращаем на нужный шаг
  useEffect(() => {
    const field = state.fields ? Object.keys(state.fields)[0] : null;
    const map: Record<string, StepId> = { username: "username", full_name: "username", city_id: "city", sports: "sports", level: "level", bio: "bio" };
    const target = field ? STEPS.findIndex((s) => s.id === map[field]) : -1;
    if (target >= 0) {
      setDir(-1);
      setStep(target);
    }
  }, [state]);

  const canContinue: Record<StepId, boolean> = {
    username: USERNAME_RE.test(username) && usernameStatus !== "taken" && usernameStatus !== "checking",
    avatar: true,
    city: cityId !== null,
    sports: sports.length > 0,
    level: level !== null,
    bio: bio.length <= 160,
  };

  const go = (to: number) => {
    setDir(to > step ? 1 : -1);
    setStep(Math.max(0, Math.min(STEPS.length - 1, to)));
  };

  const next = () => {
    if (!canContinue[current.id]) return;
    if (isLast) formRef.current?.requestSubmit();
    else go(step + 1);
  };

  const toggleSport = (id: SportId) =>
    setSports((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(e) => {
        if (!isLast) e.preventDefault();
      }}
      className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]"
    >
      {/* Все ответы уходят одной отправкой на последнем шаге */}
      <input type="hidden" name="mode" value="onboarding" />
      <input type="hidden" name="next" value={nextPath} />
      <input type="hidden" name="username" value={username} />
      <input type="hidden" name="full_name" value={fullName} />
      <input type="hidden" name="avatar_url" value={avatarUrl ?? ""} />
      <input type="hidden" name="city_id" value={cityId ?? ""} />
      <input type="hidden" name="level" value={level ?? ""} />
      <input type="hidden" name="bio" value={bio} />
      {sports.map((s) => (
        <input key={s} type="hidden" name="sports" value={s} />
      ))}

      {/* Полоски как в сторис */}
      <div className="flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label={`Шаг ${step + 1} из ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => i < step && go(i)}
            disabled={i >= step}
            className="h-1 flex-1 overflow-hidden rounded-full bg-line disabled:cursor-default"
            aria-label={`К шагу ${i + 1}`}
          >
            <motion.span
              className="block h-full rounded-full bg-accent"
              initial={false}
              animate={{ width: i <= step ? "100%" : "0%" }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            />
          </button>
        ))}
      </div>

      <header className="mt-3 flex h-10 items-center justify-between">
        {step > 0 ? (
          <button type="button" onClick={() => go(step - 1)} className="-ml-2 flex size-10 items-center justify-center" aria-label="Назад">
            <ChevronLeft className="size-6" />
          </button>
        ) : (
          <Logo className="text-lg" />
        )}
        <span className="text-sm text-muted tabular-nums">
          {step + 1} / {STEPS.length}
        </span>
      </header>

      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.section
            key={current.id}
            custom={dir}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="pt-8"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-accent/12 text-accent" aria-hidden>
              <current.icon className="size-6" strokeWidth={1.8} />
            </span>
            <h1 className="mt-4 text-[28px] leading-tight font-bold tracking-[-0.025em]">{current.title}</h1>
            <p className="mt-2 text-muted">{current.subtitle}</p>

            <div className="mt-8">
              {current.id === "username" && (
                <div className="space-y-4">
                  <div>
                    <div className="relative">
                      <AtSign className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
                      <input
                        autoFocus
                        className="input pr-12 pl-11"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 20))}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), next())}
                        placeholder="aidos_10"
                        autoCapitalize="none"
                        autoCorrect="off"
                        aria-label="Ник"
                      />
                      <span className="absolute top-1/2 right-4 -translate-y-1/2">
                        {usernameStatus === "checking" && <Loader2 className="size-5 animate-spin text-muted" />}
                        {usernameStatus === "free" && (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex size-6 items-center justify-center rounded-full bg-accent text-accent-ink">
                            <Check className="size-4" strokeWidth={3} />
                          </motion.span>
                        )}
                        {usernameStatus === "taken" && (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex size-6 items-center justify-center rounded-full bg-danger text-white">
                            <X className="size-4" strokeWidth={3} />
                          </motion.span>
                        )}
                      </span>
                    </div>
                    <p className={clsx("mt-2 text-sm", usernameStatus === "taken" || state.fields?.username ? "text-danger" : "text-muted")}>
                      {state.fields?.username ??
                        (usernameStatus === "taken"
                          ? "Этот ник уже занят — попробуй другой"
                          : usernameStatus === "free"
                            ? "Отличный ник, свободен!"
                            : "3–20 символов: латиница, цифры, «_» и «.»")}
                    </p>
                  </div>
                  <input
                    className="input"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value.slice(0, 50))}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), next())}
                    placeholder="Имя (необязательно)"
                    aria-label="Имя"
                  />
                </div>
              )}

              {current.id === "avatar" && (
                <div className="flex justify-center pt-4">
                  <AvatarUpload userId={userId} value={avatarUrl} name={username} onChange={setAvatarUrl} size={160} />
                </div>
              )}

              {current.id === "city" && (
                <div>
                  <CityPicker cities={cities} value={cityId} onChange={setCityId} name="__city" />
                  <p className="mt-3 text-sm text-muted">Нажми на значок геолокации, чтобы определить город автоматически.</p>
                </div>
              )}

              {current.id === "sports" && (
                <SportGrid selected={sports} onToggle={toggleSport} animateIn />
              )}

              {current.id === "level" && (
                <div className="space-y-3">
                  {LEVELS.map((l, i) => (
                    <motion.button
                      key={l.id}
                      type="button"
                      onClick={() => {
                        setLevel(l.id);
                        // Один выбор — сразу дальше
                        setTimeout(() => go(step + 1), 250);
                      }}
                      aria-pressed={level === l.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 + i * 0.06 }}
                      className={clsx(
                        "flex w-full items-center gap-4 rounded-3xl p-4 text-left transition",
                        level === l.id ? "bg-accent/12 text-accent" : "bg-surface-2 text-ink",
                      )}
                    >
                      <span className="text-3xl" aria-hidden>
                        {[<Sprout key="a" className="size-6" />, <Activity key="b" className="size-6" />, <Trophy key="c" className="size-6" />][i]}
                      </span>
                      <span className="flex-1">
                        <span className="block text-lg font-bold">{l.label}</span>
                        <span className={clsx("text-sm", level === l.id ? "opacity-70" : "text-muted")}>{l.hint}</span>
                      </span>
                      {level === l.id && <Check className="size-5" />}
                    </motion.button>
                  ))}
                </div>
              )}

              {current.id === "bio" && (
                <div>
                  <textarea
                    autoFocus
                    className="input h-32 resize-none py-3"
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, 160))}
                    placeholder="Играю в футбол по выходным, ищу команду в Алматы"
                    aria-label="О себе"
                  />
                  <p className="mt-2 text-right text-sm text-muted tabular-nums">{bio.length} / 160</p>
                </div>
              )}
            </div>
          </motion.section>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {state.error && !state.fields && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-3 rounded-2xl bg-danger/10 p-3 text-sm text-danger"
          >
            {state.error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        <button
          type="button"
          onClick={next}
          disabled={!canContinue[current.id] || pending}
          className="btn-primary w-full"
        >
          {pending && <Loader2 className="size-5 animate-spin" />}
          {isLast ? "Готово" : "Дальше"}
        </button>
        {"optional" in current && current.optional && !isLast && (
          <button type="button" onClick={() => go(step + 1)} className="h-11 w-full text-sm font-semibold text-muted">
            Пропустить
          </button>
        )}
      </div>
    </form>
  );
}
