import clsx from "clsx";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

/**
 * Шапка как в iOS: на главных экранах крупный заголовок слева,
 * на вложенных — кнопка «назад» и заголовок по центру.
 */
export function PageHeader({
  title,
  back,
  right,
}: {
  title: React.ReactNode;
  back?: string;
  right?: React.ReactNode;
}) {
  return (
    <header
      className={clsx(
        "glass-bar sticky top-0 z-30 h-[calc(3.25rem+env(safe-area-inset-top))] px-4 pt-[env(safe-area-inset-top)]",
        back ? "grid grid-cols-[minmax(2.75rem,1fr)_minmax(0,auto)_minmax(2.75rem,1fr)] items-center gap-1" : "flex items-center gap-2",
      )}
    >
      {back && (
        <Link href={back} className="-ml-2.5 flex size-11 items-center justify-center text-accent" aria-label="Назад">
          <ChevronLeft className="size-7" strokeWidth={2.2} />
        </Link>
      )}
      <h1 className={clsx("min-w-0 truncate", back ? "text-center text-[17px] font-semibold" : "flex-1 text-[28px] font-bold tracking-[-0.025em]")}>{title}</h1>
      {back ? <div className="flex items-center justify-end text-accent">{right}</div> : right}
    </header>
  );
}
