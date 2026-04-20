import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";

export function initCommand() {
  return new Command("init")
    .description("Create a minimal SpecPack v1 at ./specpack.json")
    .option("--force", "overwrite existing specpack.json")
    .option("--interactive", "ask a few questions (decision, scope_out picks, confidence)")
    .action(async (opts: { force?: boolean; interactive?: boolean }) => {
      const targetPath = path.resolve(process.cwd(), "specpack.json");
      const exists = fs.existsSync(targetPath);

      if (exists && !opts.force) {
        process.stderr.write(
          `specpack.json already exists at ${targetPath}\n` +
            `Re-run with --force to overwrite.\n`
        );
        process.exitCode = 1;
        return;
      }

      let decision = "Describe the single core decision this change set enforces.";
      let confidence = 0.7;
      let scope_out: string[] = ["What is explicitly out of scope / forbidden"];

      if (opts.interactive) {
        const { input, checkbox } = await import("@inquirer/prompts");

        decision = await input({
          message: "Decision (one sentence)",
          default: decision,
          validate: (v) => (v && v.trim().length > 0 ? true : "Decision is required."),
        });

        const picks = await checkbox({
          message: "Scope-out quick picks (optional)",
          choices: [
            { name: "No ORM (database ORM additions)", value: "no orm" },
            { name: "No Auth (authentication system additions)", value: "no auth" },
            { name: "No SSR/Next.js", value: "no ssr" },
          ],
        });

        const confStr = await input({
          message: "Confidence (0..1)",
          default: String(confidence),
          validate: (v) => {
            const n = Number(v);
            if (Number.isNaN(n)) return "Enter a number (0..1).";
            if (n < 0 || n > 1) return "Confidence must be between 0 and 1.";
            return true;
          },
        });
        confidence = Number(confStr);

        scope_out = picks.length > 0 ? picks : scope_out;
      }

      const template = {
        specpack_version: 1,
        decision,
        rationale: "Why this decision is the right trade-off.",
        confidence,
        scope_in: ["What is explicitly in scope"],
        scope_out,
        edge_cases: [],
        tests: [],
        success: [],
        agent_brief:
          "A short brief for agents: what to do, what not to do, and constraints to respect.",
      };

      fs.writeFileSync(targetPath, JSON.stringify(template, null, 2) + "\n", "utf8");

      process.stdout.write(
        `Created specpack.json at ${targetPath}\n\n` +
          `Next steps:\n` +
          `  - npx -y figural-watch validate\n` +
          `  - npx -y figural-watch report --base origin/main --head HEAD\n`
      );
    });
}

