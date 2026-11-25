"use client";

import { useT } from "@/components/I18nProvider";
import { Check, Share2 } from "lucide-react";
import { useState } from "react";

export function ShareGameButton({ lobbyId, text }: { lobbyId: string; text: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/g/${lobbyId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Match&Play", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Пользователь закрыл системное меню — это не ошибка.
    }
  }

  return (
    <button type="button" onClick={share} className="btn-secondary w-full">
      {copied ? <Check className="size-5" /> : <Share2 className="size-5" />}
      {copied ? t("Ссылка скопирована") : t("Позвать друзей")}
    </button>
  );
}
