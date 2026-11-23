import { ImageResponse } from "next/og";

/** Значок приложения: белые буквы M&P на чёрном, без декора. */
export function renderAppIcon(size: number, { padded = false }: { padded?: boolean } = {}) {
  // maskable: система может обрезать края, поэтому текст мельче, а фон на всю площадь
  const fontSize = size * (padded ? 0.24 : 0.32);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#000000",
          borderRadius: padded ? 0 : size * 0.22,
          color: "#ffffff",
          fontSize,
          fontWeight: 800,
          letterSpacing: -fontSize * 0.04,
        }}
      >
        M&P
      </div>
    ),
    { width: size, height: size },
  );
}
