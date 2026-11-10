import { relative, resolve, sep } from "node:path";
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/build/**",
    ],
  },
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["packages/**/*.{ts,tsx}", "apps/**/*.{ts,tsx}"],
    plugins: {
      boundaries: {
        rules: {
          "public-imports": {
            meta: {
              type: "problem",
              schema: [],
              messages: {
                privateImport:
                  "Import sibling packages through their public package exports.",
              },
            },
            create(context) {
              const filename = context.filename;
              const packageRoot = (filename: string) => {
                const parts = relative(import.meta.dirname, filename).split(
                  sep,
                );
                return ["packages", "apps"].includes(parts[0])
                  ? parts.slice(0, 2).join("/")
                  : null;
              };
              const owner = packageRoot(filename);
              const check = (node: { value?: unknown }) => {
                if (typeof node.value !== "string") return;
                const specifier = node.value;
                if (!specifier.startsWith(".")) return;
                const target = packageRoot(resolve(filename, "..", specifier));
                if (owner && owner !== target)
                  context.report({
                    node: node as never,
                    messageId: "privateImport",
                  });
              };
              return {
                ImportDeclaration: (node) => check(node.source),
                ExportNamedDeclaration: (node) => {
                  if (node.source) check(node.source);
                },
                ExportAllDeclaration: (node) => check(node.source),
                ImportExpression: (node) => check(node.source),
                TSImportType: (node) => {
                  if (node.argument.type === "TSLiteralType")
                    check(node.argument.literal);
                },
              };
            },
          },
        },
      },
    },
    rules: { "boundaries/public-imports": "error" },
  },
  prettier,
);
