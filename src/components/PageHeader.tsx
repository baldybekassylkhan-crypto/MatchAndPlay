import { ChevronLeft } from "lucide-react";
import Link from "next/link";

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
    <header className="glass-bar sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line/60 px-4 pt-[env(safe-area-inset-top)]">
      {back && (
        <Link href={back} className="-ml-2 flex size-10 items-center justify-center" aria-label="Назад">
          <ChevronLeft className="size-6" />
        </Link>
      )}
      <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{title}</h1>
      {right}
    </header>
  );
}
