"use client";

import { Minus, Plus } from "lucide-react";

export function Stepper({
  name,
  value,
  onChange,
  min,
  max,
}: {
  name: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex h-12 items-center justify-between rounded-2xl border border-line bg-surface px-1.5">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="flex size-9 items-center justify-center rounded-xl bg-surface-2 disabled:opacity-40"
        aria-label="Меньше"
      >
        <Minus className="size-4" />
      </button>
      <span className="text-lg font-bold tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="flex size-9 items-center justify-center rounded-xl bg-surface-2 disabled:opacity-40"
        aria-label="Больше"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
