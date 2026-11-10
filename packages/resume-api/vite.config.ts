import { cpSync } from "node:fs";
import { builtinModules } from "node:module";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "database-tables",
      writeBundle() {
        cpSync(
          resolve(import.meta.dirname, "src/database/tables"),
          resolve(import.meta.dirname, "dist/src/database/tables"),
          { recursive: true },
        );
      },
    },
  ],
  build: {
    target: "node22",
    minify: false,
    sourcemap: true,
    lib: {
      entry: resolve(import.meta.dirname, "index.ts"),
      formats: ["es"],
    },
    rollupOptions: {
      external: (id) =>
        id.startsWith("node:") ||
        builtinModules.includes(id) ||
        (!id.startsWith(".") && !id.startsWith("/")),
      output: {
        preserveModules: true,
        preserveModulesRoot: import.meta.dirname,
        entryFileNames: "[name].js",
      },
    },
  },
});
