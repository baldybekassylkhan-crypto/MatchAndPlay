import { ImageResponse } from "next/og";

/** Значок приложения: лаймовая надпись M&P на тёмном фоне. */
export function renderAppIcon(size: number, { padded = false }: { padded?: boolean } = {}) {
  const inner = padded ? size * 0.62 : size;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0c0b",
        }}
      >
        <div
          style={{
            width: inner,
            height: inner,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: padded ? inner / 2 : size * 0.22,
            background: "#b8f400",
            color: "#0a0c0b",
            fontSize: inner * 0.34,
            fontWeight: 800,
            letterSpacing: -inner * 0.02,
          }}
        >
          M&P
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
