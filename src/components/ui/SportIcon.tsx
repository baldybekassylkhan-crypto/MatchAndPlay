import clsx from "clsx";
import { GLYPHS, sportGlyph, VENUE_GLYPHS } from "@/lib/sport-icons";
import type { SportId } from "@/lib/sports";
import type { VenueKind } from "@/lib/venues";

export function SportIcon({
  sport,
  venue,
  className,
  strokeWidth = 1.7,
}: {
  sport?: SportId | null;
  venue?: VenueKind;
  className?: string;
  strokeWidth?: number;
}) {
  const glyph = venue ? VENUE_GLYPHS[venue] : sportGlyph(sport);
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={clsx("shrink-0", className ?? "size-5")}
      aria-hidden
    >
      {GLYPHS[glyph].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
