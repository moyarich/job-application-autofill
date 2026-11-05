import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.{ts,tsx,js,jsx,mjs}"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/*.spec.*",
      "**/*.specs.*",
    ],
    environment: "node",
  },
});
