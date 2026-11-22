import clsx from "clsx";
import { UserRound } from "lucide-react";

export function Avatar({
  src,
  name,
  size = 40,
  className,
  placeholder = "initial",
}: {
  src: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
  /** Без фото: первая буква ника или иконка-силуэт */
  placeholder?: "initial" | "icon";
}) {
  const style = { width: size, height: size };
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- аватары с Supabase Storage, уже сжаты
      <img src={src} alt={name} style={style} className={clsx("shrink-0 rounded-full object-cover", className)} />
    );
  }

  const letter = name.trim().slice(0, 1);
  const showIcon = placeholder === "icon" || !letter || letter === "?";

  return (
    <div
      style={{ ...style, fontSize: size * 0.4 }}
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full font-bold uppercase",
        showIcon ? "bg-surface-2 text-muted" : "bg-surface-2 text-ink",
        className,
      )}
      aria-label={name || "Аватар"}
    >
      {showIcon ? <UserRound style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={1.75} /> : letter}
    </div>
  );
}
