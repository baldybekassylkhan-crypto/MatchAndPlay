import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Время Казахстана считается явно, но пусть тесты не зависят и от пояса компьютера
    env: { TZ: "America/New_York" },
  },
});
