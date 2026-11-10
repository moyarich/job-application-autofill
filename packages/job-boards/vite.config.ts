import { builtinModules } from "node:module";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node22",
    minify: false,
    sourcemap: true,
    lib: {
      entry: Object.fromEntries(
        ["index", "automation", "employer-account", "screening-policy"].map(
          (name) => [name, resolve(import.meta.dirname, `${name}.ts`)],
        ),
      ),
      formats: ["es"],
      fileName: (_format, name) => `${name}.js`,
    },
    rollupOptions: {
      external: (id) =>
        id.startsWith("node:") ||
        builtinModules.includes(id) ||
        id === "playwright" ||
        id.startsWith("@moyarich/"),
    },
  },
});
