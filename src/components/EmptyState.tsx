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
    <div className="flex animate-fade-up flex-col items-center gap-3 px-8 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-3xl bg-surface-2">
        <Icon className="size-7 text-muted" />
      </div>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-muted">{text}</p>
      {action && (
        <Link href={action.href} className="btn-primary mt-2">
          {action.label}
        </Link>
      )}
    </div>
  );
}
