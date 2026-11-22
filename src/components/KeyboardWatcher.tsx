"use client";

import { useEffect } from "react";

const TEXT_INPUT = /^(text|search|email|password|tel|url|number|date|time|datetime-local)$/;

function isTyping(el: Element | null) {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLInputElement) return TEXT_INPUT.test(el.type || "text");
  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * Помечает <html data-keyboard>, пока фокус в поле ввода (на телефоне — открыта клавиатура).
 * CSS по этому атрибуту прячет нижнее меню, чтобы оно не закрывало поле.
 */
export function KeyboardWatcher() {
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      if (isTyping(document.activeElement)) root.setAttribute("data-keyboard", "");
      else root.removeAttribute("data-keyboard");
    };
    const onFocusIn = (e: FocusEvent) => {
      if (isTyping(e.target as Element)) root.setAttribute("data-keyboard", "");
    };
    // focusout срабатывает и при переходе между полями — проверяем после смены фокуса
    const onFocusOut = () => requestAnimationFrame(sync);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      root.removeAttribute("data-keyboard");
    };
  }, []);
  return null;
}
