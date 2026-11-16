import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  // Почти все страницы доступны только после входа — индексировать есть смысл только страницу входа.
  return {
    rules: { userAgent: "*", allow: ["/login"], disallow: ["/api/", "/auth/"] },
  };
}
