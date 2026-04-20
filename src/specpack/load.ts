import fs from "node:fs";
import path from "node:path";

export type SpecPack = Record<string, unknown>;

export async function loadSpecPack(): Promise<SpecPack> {
  const p = path.resolve(process.cwd(), "specpack.json");

  let raw: string;
  try {
    raw = fs.readFileSync(p, "utf8");
  } catch {
    throw new Error(`Missing specpack.json at ${p}. Run: figural-watch init`);
  }

  try {
    return JSON.parse(raw) as SpecPack;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`specpack.json is not valid JSON: ${msg}`);
  }
}

