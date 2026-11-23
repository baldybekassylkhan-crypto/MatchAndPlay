"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Поле «Площадка или адрес» вместе с точкой на карте.
 * Адрес подставляется, пока поле пустое или заполнено автоматически: написанное вручную не трогаем.
 */
export function useMapAddress(initial: string) {
  const [place, setPlace] = useState(initial);
  const [loading, setLoading] = useState(false);
  const isAuto = useRef(initial.trim() === "");
  const lastRequest = useRef(0);

  const typePlace = useCallback((value: string) => {
    lastRequest.current += 1;
    isAuto.current = value.trim() === "";
    setLoading(false);
    setPlace(value);
  }, []);

  const lookup = useCallback(async ({ lat, lng }: { lat: number; lng: number }) => {
    if (!isAuto.current) return;
    const id = ++lastRequest.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      const { address } = (await res.json()) as { address: string | null };
      if (id === lastRequest.current && address) setPlace(address);
    } catch {
      // Без адреса форма работает: его можно ввести вручную
    } finally {
      if (id === lastRequest.current) setLoading(false);
    }
  }, []);

  /** Точку убрали: автоматический адрес больше не относится к месту. */
  const clearAuto = useCallback(() => {
    lastRequest.current += 1;
    setLoading(false);
    if (isAuto.current) setPlace("");
  }, []);

  return { place, loading, typePlace, lookup, clearAuto };
}
