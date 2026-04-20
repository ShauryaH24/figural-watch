import { Command } from "commander";
import path from "node:path";

import { loadSpecPack } from "../specpack/load.js";
import { validateSpecPackOrThrow } from "../specpack/validate.js";
import { diffTextForFile, listChangedFiles, showFileAtRef } from "../git/diff.js";
import { parsePackageJsonDeps, diffDepAdditions } from "../detect/dependencies.js";
import { detectSystemsFromDeps, detectSsrFromFiles, summarizeSystems } from "../detect/systems.js";
import { detectScopeOutConflicts, type Conflict } from "../detect/conflicts.js";

export function explainCommand() {
  return new Command("explain")
    .description("Explain why conflicts were flagged (with evidence).")
    .requiredOption("--base <ref>", "base git ref (e.g. origin/main)")
    .requiredOption("--head <ref>", "head git ref (e.g. HEAD)")
    .option("--id <conflict_id>", "explain only a single conflict id")
    .action(async (opts: { base: string; head: string; id?: string }) => {
      try {
        const { base, head } = opts;
        const { inferred, conflicts } = await computeConflicts(base, head);

        const filtered = opts.id ? conflicts.filter((c) => c.id === opts.id) : conflicts;
        if (opts.id && filtered.length === 0) {
          process.stderr.write(`No conflict found with id: ${opts.id}\n`);
          process.exitCode = 1;
          return;
        }

        process.stdout.write(`Inferred decisions:\n`);
        if (inferred.length === 0) process.stdout.write(`- (none)\n`);
        else for (const i of inferred) process.stdout.write(`- ${i}\n`);
        process.stdout.write("\n");

        process.stdout.write(`Conflicts:\n`);
        if (filtered.length === 0) {
          process.stdout.write(`- (none)\n`);
          return;
        }

        for (const c of filtered) {
          process.stdout.write(`- [${c.level.toUpperCase()}] ${c.title}\n`);
          process.stdout.write(`  id: ${c.id}\n`);
          process.stdout.write(`  why: ${c.detail}\n`);
          if (c.evidence && c.evidence.length > 0) {
            process.stdout.write(`  evidence:\n`);
            for (const e of c.evidence) {
              const where = e.path ? ` (${e.path})` : "";
              process.stdout.write(`    - ${e.kind}: ${e.value}${where}\n`);
            }
          }
          process.stdout.write("\n");
        }
      } catch (err) {
        process.stderr.write(err instanceof Error ? `${err.message}\n` : `${String(err)}\n`);
        process.exitCode = 1;
      }
    });
}

async function computeConflicts(base: string, head: string): Promise<{ inferred: string[]; conflicts: Conflict[] }> {
  const specpack = await loadSpecPack();
  await validateSpecPackOrThrow(specpack);

  const changed = listChangedFiles(base, head);

  const basePkgText = showFileAtRef(base, "package.json");
  const headPkgText = showFileAtRef(head, "package.json");
  const baseDeps = basePkgText ? parsePackageJsonDeps(basePkgText) : null;
  const headDeps = headPkgText ? parsePackageJsonDeps(headPkgText) : null;
  const depAdds = diffDepAdditions(baseDeps, headDeps);

  const diffTextByPath = new Map<string, string>();
  for (const f of changed) {
    const ext = path.extname(f.path).toLowerCase();
    if (![".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) continue;
    const t = diffTextForFile(base, head, f.path);
    if (t) diffTextByPath.set(f.path, t);
  }

  const systemsFromDeps = detectSystemsFromDeps(depAdds.added);
  const ssrFromFiles = detectSsrFromFiles(changed, diffTextByPath);
  for (const s of ssrFromFiles) systemsFromDeps.ssr.add(s);

  const inferred = summarizeSystems(systemsFromDeps);

  const multipleConflicts = detectMultipleSystemsConflicts(baseDeps, systemsFromDeps);

  const scopeOut = Array.isArray((specpack as any).scope_out) ? ((specpack as any).scope_out as string[]) : [];
  const scopeOutConflicts = detectScopeOutConflicts(scopeOut, inferred);

  return { inferred, conflicts: [...multipleConflicts, ...scopeOutConflicts] };
}

function detectMultipleSystemsConflicts(
  baseDeps: ReturnType<typeof parsePackageJsonDeps> | null,
  systemsFromHeadAdds: ReturnType<typeof detectSystemsFromDeps>
): Conflict[] {
  const conflicts: Conflict[] = [];
  if (!baseDeps) return conflicts;

  const baseAll = new Set<string>([
    ...Object.keys(baseDeps.dependencies),
    ...Object.keys(baseDeps.devDependencies),
    ...Object.keys(baseDeps.peerDependencies),
    ...Object.keys(baseDeps.optionalDependencies),
  ]);

  const ormPkgs = ["prisma", "@prisma/client", "drizzle-orm", "sequelize", "typeorm", "knex", "mongoose"];
  const authPkgs = ["next-auth", "@auth/core", "@clerk/nextjs", "lucia", "passport", "supertokens-node"];

  const baseOrm = [...baseAll].filter((d) => ormPkgs.includes(d));
  const baseAuth = [...baseAll].filter((d) => authPkgs.includes(d));

  if (baseOrm.length > 0 && systemsFromHeadAdds.orm.size > 0) {
    conflicts.push({
      id: "multi.orm",
      level: "fail",
      title: "Multiple ORM systems detected",
      detail: `Base already contains ORM-related deps (${baseOrm.join(", ")}) and this diff adds (${[
        ...systemsFromHeadAdds.orm,
      ]
        .sort()
        .join(", ")}).`,
      evidence: [
        ...baseOrm.sort().map((d) => ({ kind: "base_dependency" as const, value: d })),
        ...[...systemsFromHeadAdds.orm].sort().map((d) => ({ kind: "dependency" as const, value: d })),
      ],
    });
  }

  if (baseAuth.length > 0 && systemsFromHeadAdds.auth.size > 0) {
    conflicts.push({
      id: "multi.auth",
      level: "fail",
      title: "Multiple auth systems detected",
      detail: `Base already contains auth-related deps (${baseAuth.join(", ")}) and this diff adds (${[
        ...systemsFromHeadAdds.auth,
      ]
        .sort()
        .join(", ")}).`,
      evidence: [
        ...baseAuth.sort().map((d) => ({ kind: "base_dependency" as const, value: d })),
        ...[...systemsFromHeadAdds.auth].sort().map((d) => ({ kind: "dependency" as const, value: d })),
      ],
    });
  }

  return conflicts;
}

