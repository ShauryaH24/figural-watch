import { Command } from "commander";
import { loadSpecPack } from "../specpack/load.js";
import { validateSpecPackOrThrow } from "../specpack/validate.js";

export function validateCommand() {
  return new Command("validate")
    .description("Validate ./specpack.json against the SpecPack v1 schema")
    .action(async () => {
      try {
        const specpack = await loadSpecPack();
        await validateSpecPackOrThrow(specpack);
        process.stdout.write("OK: specpack.json is valid.\n");
      } catch (err) {
        process.stderr.write(formatValidateError(err));
        process.exitCode = 1;
      }
    });
}

function formatValidateError(err: unknown): string {
  if (err instanceof Error) return `${err.message}\n`;
  return `Validation failed: ${String(err)}\n`;
}

