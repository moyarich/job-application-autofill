import { realpathSync } from "node:fs";
import { Command } from "commander";
import { readFile, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  decodeUpload,
  extractResumeText,
  extractProfile,
  MAX_RESUME,
} from "./index.js";

const { version } = JSON.parse(
  await readFile(resolve(import.meta.dirname, "../package.json"), "utf8"),
);

export function createCommand() {
  return new Command()
    .name("extract-resume")
    .description("Extract a local PDF or DOCX resume as structured JSON.")
    .version(version)
    .argument("<file>", "path to a PDF or DOCX resume")
    .option("-o, --output <file>", "write JSON to a new file instead of stdout")
    .option("--text", "output extracted plain text instead of JSON")
    .action(
      async (file: string, options: { output?: string; text?: boolean }) => {
        const info = await stat(file);
        if (!info.isFile()) throw new Error("Resume must be a regular file.");
        if (info.size > MAX_RESUME) throw new Error("Resume exceeds 10 MB.");
        const buffer = await readFile(file);
        const upload = decodeUpload({
          fileName: basename(file),
          base64: buffer.toString("base64"),
        });
        const text = await extractResumeText(upload.buffer, upload.extension);
        const profile = options.text
          ? null
          : { ...extractProfile(text), source: { fileName: basename(file) } };
        const result = options.text
          ? text + "\n"
          : JSON.stringify(profile, null, 2) + "\n";
        if (options.output)
          await writeFile(options.output, result, { flag: "wx", mode: 0o600 });
        else process.stdout.write(result);
      },
    );
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    await createCommand().parseAsync(process.argv);
  } catch (error) {
    console.error(
      "extract-resume: " +
        (error instanceof Error ? error.message : String(error)),
    );
    process.exitCode = 1;
  }
}
