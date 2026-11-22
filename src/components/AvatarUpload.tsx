"use client";

import { Camera, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { compressImage, imageExt } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";

const MAX_AVATAR_BYTES = 300 * 1024;

export function AvatarUpload({
  userId,
  value,
  name,
  onChange,
  size = 96,
}: {
  userId: string;
  value: string | null;
  name: string;
  onChange: (url: string) => void;
  size?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const blob = await compressImage(file, { maxSide: 400, maxBytes: MAX_AVATAR_BYTES, square: true });
      const path = `${userId}/${Date.now()}.${imageExt(blob)}`;
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: blob.type || "image/jpeg", cacheControl: "31536000" });
      if (error) throw error;
      onChange(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить фото");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative rounded-full ring-4 ring-surface"
        aria-label="Загрузить аватар"
      >
        <Avatar src={value} name={name} size={size} placeholder="icon" />
        <span
          className="glass-accent absolute right-0 bottom-0 flex items-center justify-center rounded-full text-accent-ink"
          style={{ width: Math.max(36, size * 0.3), height: Math.max(36, size * 0.3) }}
        >

          {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
        </span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
