import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";

import { loadSpecPack } from "../specpack/load.js";
import { validateSpecPackOrThrow } from "../specpack/validate.js";
import { diffTextForFile, listChangedFiles, showFileAtRef } from "../git/diff.js";
import { parsePackageJsonDeps, diffDepAdditions } from "../detect/dependencies.js";
import { detectSystemsFromDeps, detectSsrFromFiles, summarizeSystems } from "../detect/systems.js";
import { detectScopeOutConflicts } from "../detect/conflicts.js";
import { mapProgress, type TestItem } from "../detect/progress.js";
import { renderMarkdown } from "../report/render.js";

export function reportCommand() {
  return new Command("report")
    .description("Generate a Markdown report comparing a git diff to specpack.json")
    .requiredOption("--base <ref>", "base git ref (e.g. origin/main)")
    .requiredOption("--head <ref>", "head git ref (e.g. HEAD)")
    .action(async (opts: { base: string; head: string }) => {
      try {
        const base = opts.base;
        const head = opts.head;

        const specpack = await loadSpecPack();
        await validateSpecPackOrThrow(specpack);

        const changed = listChangedFiles(base, head);

        // Load package.json at both refs (if present) and infer dependency additions.
        const basePkgText = showFileAtRef(base, "package.json");
        const headPkgText = showFileAtRef(head, "package.json");
        const baseDeps = basePkgText ? parsePackageJsonDeps(basePkgText) : null;
        const headDeps = headPkgText ? parsePackageJsonDeps(headPkgText) : null;
        const depAdds = diffDepAdditions(baseDeps, headDeps);

        // For a small set of SSR file heuristics, we want diff text for changed JS/TS files.
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

        // Multiple-systems conflicts (v0).
        const multipleConflicts = detectMultipleSystemsConflicts(baseDeps, systemsFromDeps);

        const scopeOut = Array.isArray((specpack as any).scope_out)
          ? ((specpack as any).scope_out as string[])
          : [];
        const scopeOutConflicts = detectScopeOutConflicts(scopeOut, inferred);

        const tests = Array.isArray((specpack as any).tests) ? ((specpack as any).tests as TestItem[]) : [];
        const progress = mapProgress(tests);

        const conflicts = [...multipleConflicts, ...scopeOutConflicts];

        const reportPath = path.resolve(process.cwd(), "figural-watch-report.md");
        const md = renderMarkdown({
          base,
          head,
          changedFiles: changed.map((c) => ({ path: c.path, status: c.status })),
          inferred,
          conflicts,
          progress,
        });
        fs.writeFileSync(reportPath, md, "utf8");

        const failCount = conflicts.filter((c) => c.level === "fail").length;
        const warnCount = conflicts.filter((c) => c.level === "warn").length;

        process.stdout.write(
          `Report written: ${reportPath}\n` +
            `Conflicts: ${failCount} fail, ${warnCount} warn\n`
        );

        if (failCount > 0) process.exitCode = 2;
      } catch (err) {
        process.stderr.write(err instanceof Error ? `${err.message}\n` : `${String(err)}\n`);
        process.exitCode = 1;
      }
    });
}

function detectMultipleSystemsConflicts(
  baseDeps: ReturnType<typeof parsePackageJsonDeps> | null,
  systemsFromHeadAdds: ReturnType<typeof detectSystemsFromDeps>
) {
  const conflicts: import("../detect/conflicts.js").Conflict[] = [];
  if (!baseDeps) return conflicts;

  const baseAll = new Set<string>([
    ...Object.keys(baseDeps.dependencies),
    ...Object.keys(baseDeps.devDependencies),
    ...Object.keys(baseDeps.peerDependencies),
    ...Object.keys(baseDeps.optionalDependencies),
  ]);

  const baseOrm = [...baseAll].filter((d) =>
    ["prisma", "@prisma/client", "drizzle-orm", "sequelize", "typeorm", "knex", "mongoose"].includes(d)
  );
  const baseAuth = [...baseAll].filter((d) =>
    ["next-auth", "@auth/core", "@clerk/nextjs", "lucia", "passport", "supertokens-node"].includes(d)
  );

  if (baseOrm.length > 0 && systemsFromHeadAdds.orm.size > 0) {
    const added = [...systemsFromHeadAdds.orm].sort().join(", ");
    conflicts.push({
      level: "fail",
      title: "Multiple ORM systems detected",
      detail: `Base already contains ORM-related deps (${baseOrm.join(
        ", "
      )}) and this diff adds (${added}).`,
    });
  }

  if (baseAuth.length > 0 && systemsFromHeadAdds.auth.size > 0) {
    const added = [...systemsFromHeadAdds.auth].sort().join(", ");
    conflicts.push({
      level: "fail",
      title: "Multiple auth systems detected",
      detail: `Base already contains auth-related deps (${baseAuth.join(
        ", "
      )}) and this diff adds (${added}).`,
    });
  }

  return conflicts;
}

