"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { redeemRewardCode } from "@/app/actions/rewards";

const TEXT = {
  ok: ["Код действителен — награда выдана", "bg-accent text-accent-ink"],
  used: ["Этот код уже использован", "bg-danger/10 text-danger"],
  not_found: ["Такого кода нет", "bg-danger/10 text-danger"],
} as const;

export function RedeemForm() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<keyof typeof TEXT | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          setResult(null);
          const res = await redeemRewardCode(code);
          if (res.ok) setResult(res.status);
          else setError(res.error);
        });
      }}
    >
      <label className="label" htmlFor="code">
        Код с телефона игрока
      </label>
      <input
        id="code"
        className="input text-center text-xl font-bold tracking-[0.15em] uppercase"
        placeholder="MP-XXXX-XXXX"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        autoComplete="off"
      />
      <button className="btn-primary w-full" disabled={pending || code.trim().length < 6}>
        {pending && <Loader2 className="size-4 animate-spin" />} Проверить и погасить
      </button>
      {result && <p className={`rounded-2xl p-4 text-center font-semibold ${TEXT[result][1]}`}>{TEXT[result][0]}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
