import { chmodSync } from "node:fs";
import { builtinModules } from "node:module";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "executable-cli",
      closeBundle() {
        chmodSync(resolve(import.meta.dirname, "dist/cli.js"), 0o755);
      },
    },
  ],
  build: {
    target: "node24",
    minify: false,
    sourcemap: true,
    lib: {
      entry: {
        index: resolve(import.meta.dirname, "src/index.ts"),
        cli: resolve(import.meta.dirname, "src/cli.ts"),
      },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: [
        ...builtinModules,
        ...builtinModules.map((name) => `node:${name}`),
        "commander",
      ],
      output: {
        banner: (chunk) => (chunk.name === "cli" ? "#!/usr/bin/env node" : ""),
      },
    },
  },
});
