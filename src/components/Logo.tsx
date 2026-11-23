import clsx from "clsx";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("font-bold tracking-[-0.03em]", className)}>
      Match<span className="px-px font-normal text-muted">&amp;</span>Play
    </span>
  );
}
