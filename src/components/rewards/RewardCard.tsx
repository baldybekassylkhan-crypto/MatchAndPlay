"use client";

import { useT } from "@/components/I18nProvider";
import clsx from "clsx";
import { Coffee, Dumbbell, Gift, Loader2, MapPin, ShoppingBag, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { claimReward } from "@/app/actions/rewards";
import type { RewardOffer } from "@/lib/rewards";
import { SPORTS } from "@/lib/sports";
import { plural } from "@/lib/time";

const KIND_ICON = { store: ShoppingBag, cafe: Coffee, gym: Dumbbell, services: Sparkles, other: Gift };

export function RewardCard({ offer: o }: { offer: RewardOffer }) {
  const t = useT();
  const [code, setCode] = useState(o.code);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const Icon = KIND_ICON[o.sponsor_kind] ?? Gift;
  const done = Math.min(o.progress, o.games_required);
  const ready = o.progress >= o.games_required;
  const left = o.games_required - done;

  return (
    <article className="card overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: o.sponsor_color }} aria-hidden>
          <Icon className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">{o.sponsor_name}</p>
          <h3 className="font-semibold leading-tight">{o.title}</h3>
        </div>
      </div>
      {o.description && <p className="px-4 text-sm text-muted">{o.description}</p>}
      {o.sponsor_address && (
        <p className="flex items-center gap-1 px-4 pt-1 text-sm text-muted">
          <MapPin className="size-3.5 shrink-0" /> {o.sponsor_address}
        </p>
      )}

      <div className="space-y-3 p-4">
        {code ? (
          <div className={clsx("rounded-2xl border-2 border-dashed p-3 text-center", o.redeemed_at ? "border-line opacity-60" : "border-accent")}>
            <p className="text-xs text-muted">{o.redeemed_at ? t("Код использован") : t("Покажите код на кассе")}</p>
            <p className="text-2xl font-extrabold tracking-[0.15em] tabular-nums">{code}</p>
          </div>
        ) : (
          <>
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-semibold">
                  {done} из {o.games_required} {o.sport ? `игр · ${SPORTS[o.sport]?.label.toLowerCase()}` : t("игр")}
                </span>
                <span className="text-muted">{ready ? t("Готово!") : `ещё ${left} ${plural(left, ["игра", "игры", "игр"])}`}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={o.games_required} aria-valuenow={done}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(done / o.games_required) * 100}%`, backgroundColor: o.sponsor_color }} />
              </div>
            </div>
            <button
              type="button"
              className="btn-primary w-full"
              disabled={!ready || o.sold_out || pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const res = await claimReward(o.offer_id);
                  if (res.ok) setCode(res.code);
                  else setError(res.error);
                })
              }
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Gift className="size-5" />}
              {o.sold_out ? t("Закончились в этом месяце") : ready ? t("Получить награду") : t("Играйте и отмечайтесь")}
            </button>
          </>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </article>
  );
}
