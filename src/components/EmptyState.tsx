import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex animate-fade-up flex-col items-center px-10 py-20 text-center">
      <Icon className="size-11 text-muted" strokeWidth={1.4} aria-hidden />
      <h2 className="mt-4 text-[20px] font-semibold">{title}</h2>
      <p className="mt-1 text-[15px] leading-snug text-muted">{text}</p>
      {action && (
        <Link href={action.href} className="mt-3 inline-flex h-11 items-center px-3 text-[17px] text-accent active:opacity-60">
          {action.label}
        </Link>
      )}
    </div>
  );
}
