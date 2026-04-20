import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";

export function initCommand() {
  return new Command("init")
    .description("Create a minimal SpecPack v1 at ./specpack.json")
    .option("--force", "overwrite existing specpack.json")
    .action(async (opts: { force?: boolean }) => {
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

      const template = {
        specpack_version: 1,
        decision: "Describe the single core decision this change set enforces.",
        rationale: "Why this decision is the right trade-off.",
        confidence: 0.7,
        scope_in: ["What is explicitly in scope"],
        scope_out: ["What is explicitly out of scope / forbidden"],
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

