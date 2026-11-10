import { Command } from "commander";
import { readFile, writeFile, access } from "node:fs/promises";
import { resolve, parse, join } from "node:path";
import { renderResumePdf } from "../resume-schema/create-pdf.ts";
import { parseResumeJson } from "../resume-schema/validate.ts";

const command = new Command()
  .name("create-resume")
  .description("Create an ATS-oriented PDF from structured resume JSON.")
  .version("0.1.0")
  .argument("<file>", "path to structured resume JSON")
  .option(
    "-o, --output <file>",
    "PDF output path (default: input basename with .pdf)",
  )
  .action(async (file: string, options: { output?: string }) => {
    const input = resolve(file);
    const name = parse(input);
    const output = resolve(
      options.output || join(name.dir, name.name + ".pdf"),
    );
    if (input === output)
      throw new Error("Output must differ from the input JSON file.");
    try {
      await access(output);
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "ENOENT"
      )
        throw error;
      const profile = parseResumeJson(await readFile(input, "utf8"));
      const bytes = await renderResumePdf(profile);
      await writeFile(output, bytes, { flag: "wx", mode: 0o600 });
      console.log("Created " + output);
      return;
    }
    throw new Error(
      "Output already exists; choose a new filename with --output.",
    );
  });

try {
  await command.parseAsync(process.argv);
} catch (error) {
  console.error(
    "create-resume: " +
      (error instanceof Error ? error.message : String(error)),
  );
  process.exitCode = 1;
}
