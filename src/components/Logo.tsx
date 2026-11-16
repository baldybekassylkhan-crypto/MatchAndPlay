import clsx from "clsx";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("font-extrabold tracking-tight", className)}>
      Match<span className="rounded-md bg-accent px-1 text-accent-ink">&amp;</span>Play
    </span>
  );
}
