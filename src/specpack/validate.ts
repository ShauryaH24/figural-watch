import fs from "node:fs";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import type { ErrorObject } from "ajv";

import type { SpecPack } from "./load.js";

// Important: when bundled, `import.meta.url` points at `dist/cli.js`.
// The schema is shipped at `<packageRoot>/schemas/specpack.schema.json`.
const SCHEMA_PATH = new URL("../schemas/specpack.schema.json", import.meta.url);

export async function validateSpecPackOrThrow(specpack: SpecPack): Promise<void> {
  const schemaText = fs.readFileSync(fileURLToPath(SCHEMA_PATH), "utf8");
  const schema = JSON.parse(schemaText) as object;

  const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
  const validate = ajv.compile(schema);
  const ok = validate(specpack);
  if (ok) return;

  const formatted = formatAjvErrors(validate.errors ?? []);
  throw new Error(
    `specpack.json failed schema validation:\n${formatted}`.trimEnd()
  );
}

function formatAjvErrors(errors: ErrorObject[]): string {
  if (errors.length === 0) return "  (no details)\n";

  return errors
    .map((e) => {
      const where = e.instancePath && e.instancePath.length > 0 ? e.instancePath : "/";
      const message = e.message ?? "invalid";
      const extra =
        e.keyword === "additionalProperties" &&
        typeof (e.params as any)?.additionalProperty === "string"
          ? ` (unexpected: ${(e.params as any).additionalProperty})`
          : "";
      return `  - ${where}: ${message}${extra}`;
    })
    .join("\n") +
    "\n";
}

