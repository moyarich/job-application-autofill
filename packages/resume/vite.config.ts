import { chmodSync } from "node:fs";
import { builtinModules } from "node:module";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "executable-cli",
      writeBundle() {
        for (const file of ["extract-resume", "create-resume"]) chmodSync(resolve(import.meta.dirname, `dist/${file}.js`), 0o755);
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
        "extract-resume": resolve(import.meta.dirname, "src/extract-resume/cli.ts"),
        "create-resume": resolve(import.meta.dirname, "src/create-resume/cli.ts"),
        "create-pdf": resolve(import.meta.dirname, "src/resume-schema/create-pdf.ts"),
        "render-html": resolve(import.meta.dirname, "src/resume-schema/render-html.ts"),
        validate: resolve(import.meta.dirname, "src/resume-schema/validate.ts"),
      },
      formats: ["es"],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: [
        ...builtinModules,
        ...builtinModules.map((name) => `node:${name}`),
        "commander", "playwright",
      ],
      output: {
        banner: (chunk) => (["extract-resume", "create-resume"].includes(chunk.name) ? "#!/usr/bin/env node" : ""),
      },
    },
  },
});
