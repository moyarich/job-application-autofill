import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { conditions: ["node"] },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/*.spec.*",
      "**/*.specs.*",
    ],
    environment: "node",
  },
});
