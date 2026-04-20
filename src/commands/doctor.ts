import { Command } from "commander";
import { execGit } from "../git/exec.js";
import { loadSpecPack } from "../specpack/load.js";
import { validateSpecPackOrThrow } from "../specpack/validate.js";

type CheckStatus = "PASS" | "WARN" | "FAIL";

type Check = {
  label: string;
  status: CheckStatus;
  detail?: string;
};

export function doctorCommand() {
  return new Command("doctor")
    .description("Check your environment and SpecPack setup (recommended for CI troubleshooting).")
    .option("--base <ref>", "base git ref to verify (e.g. origin/main)")
    .option("--head <ref>", "head git ref to verify (e.g. HEAD)")
    .action(async (opts: { base?: string; head?: string }) => {
      const checks: Check[] = [];

      // 1) git available
      const gitVersion = execGit(["--version"]);
      if (gitVersion.exitCode === 0) {
        checks.push({ label: "git available", status: "PASS", detail: gitVersion.stdout.trim() });
      } else {
        checks.push({
          label: "git available",
          status: "FAIL",
          detail: "git was not found. Install Git and ensure it's on PATH.",
        });
      }

      // 2) in git repo
      const inside = execGit(["rev-parse", "--is-inside-work-tree"]);
      if (inside.exitCode === 0 && inside.stdout.trim() === "true") {
        checks.push({ label: "inside a git repo", status: "PASS" });
      } else if (gitVersion.exitCode === 0) {
        checks.push({
          label: "inside a git repo",
          status: "FAIL",
          detail: "Not inside a git work tree. Run this from your repo root.",
        });
      }

      // 3) specpack exists + parses + validates
      try {
        const specpack = await loadSpecPack();
        checks.push({ label: "specpack.json exists", status: "PASS" });

        await validateSpecPackOrThrow(specpack);
        checks.push({ label: "specpack.json schema-valid", status: "PASS" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes("missing specpack.json")) {
          checks.push({
            label: "specpack.json exists",
            status: "FAIL",
            detail: "Missing specpack.json. Run: figural-watch init",
          });
        } else if (msg.toLowerCase().includes("not valid json")) {
          checks.push({
            label: "specpack.json parses",
            status: "FAIL",
            detail: msg,
          });
        } else {
          checks.push({
            label: "specpack.json schema-valid",
            status: "FAIL",
            detail: msg,
          });
        }
      }

      // 4) optional: verify refs exist
      if (opts.base) checks.push(verifyRef("base ref exists", opts.base));
      else checks.push({ label: "base ref exists", status: "WARN", detail: "Pass --base to verify (e.g. origin/main)." });

      if (opts.head) checks.push(verifyRef("head ref exists", opts.head));
      else checks.push({ label: "head ref exists", status: "WARN", detail: "Pass --head to verify (e.g. HEAD)." });

      // Print checklist
      for (const c of checks) {
        const line = `[${c.status}] ${c.label}${c.detail ? ` — ${c.detail}` : ""}\n`;
        if (c.status === "FAIL") process.stderr.write(line);
        else process.stdout.write(line);
      }

      const hasFail = checks.some((c) => c.status === "FAIL");
      process.exitCode = hasFail ? 1 : 0;
    });
}

function verifyRef(label: string, ref: string): Check {
  const res = execGit(["rev-parse", "--verify", ref]);
  if (res.exitCode === 0) return { label, status: "PASS", detail: ref };
  return {
    label,
    status: "FAIL",
    detail: `Ref not found: ${ref}. (In CI, make sure checkout fetch-depth is 0; locally, run: git fetch origin)`,
  };
}

