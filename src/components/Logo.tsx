import clsx from "clsx";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("font-extrabold tracking-tight", className)}>
      Match
      <span className="bg-(image:--story-gradient) bg-clip-text px-0.5 text-transparent">&amp;</span>
      Play
    </span>
  );
}
