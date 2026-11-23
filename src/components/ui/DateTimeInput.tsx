"use client";

import { useState } from "react";

const DATE_FORMAT = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function label(type: "date" | "time", value: string) {
  if (!value) return null;
  if (type === "time") return value.slice(0, 5);
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : DATE_FORMAT.format(date);
}

/**
 * Поле даты или времени. iOS рисует такие поля по-своему и сбивает выравнивание,
 * поэтому значение показываем сами, а системный выбор открывает прозрачное поле сверху.
 */
export function DateTimeInput({
  type,
  name,
  id,
  defaultValue = "",
  min,
  step,
  required,
}: {
  type: "date" | "time";
  name: string;
  id?: string;
  defaultValue?: string;
  min?: string;
  step?: number;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const text = label(type, value);

  return (
    <span className="input relative flex items-center overflow-hidden focus-within:border-accent">
      <span className={text ? "truncate" : "truncate text-muted"} aria-hidden>
        {text ?? "Выбрать"}
      </span>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        min={min}
        step={step}
        required={required}
        onChange={(e) => setValue(e.target.value)}
        onClick={(e) => {
          if (!window.matchMedia("(pointer: fine)").matches) return;
          try {
            e.currentTarget.showPicker();
          } catch {
            // Браузер без showPicker откроет выбор сам
          }
        }}
        className="absolute inset-0 h-full w-full cursor-pointer text-[16px] opacity-0"
      />
    </span>
  );
}
