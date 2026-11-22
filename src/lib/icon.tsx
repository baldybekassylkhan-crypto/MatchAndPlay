import { ImageResponse } from "next/og";

const STORY_GRADIENT = "linear-gradient(45deg, #feda75 0%, #fa7e1e 25%, #d62976 50%, #962fbf 75%, #4f5bd5 100%)";

/** Значок приложения: белые буквы M&P на закатном градиенте (как у Instagram). */
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
          backgroundImage: STORY_GRADIENT,
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
