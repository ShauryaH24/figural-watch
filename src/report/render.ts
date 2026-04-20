import type { Conflict } from "../detect/conflicts.js";
import type { TestProgress } from "../detect/progress.js";

export type ReportModel = {
  base: string;
  head: string;
  changedFiles: { path: string; status: string }[];
  inferred: string[];
  conflicts: Conflict[];
  progress: TestProgress[];
};

export function renderMarkdown(m: ReportModel): string {
  const fail = m.conflicts.filter((c) => c.level === "fail").length;
  const warn = m.conflicts.filter((c) => c.level === "warn").length;
  const info = m.conflicts.filter((c) => c.level === "info").length;

  const lines: string[] = [];

  lines.push(`# figural-watch report\n`);
  lines.push(`**Base**: \`${m.base}\``);
  lines.push(`**Head**: \`${m.head}\``);
  lines.push("");

  lines.push(`## Summary`);
  lines.push(`- Changed files: **${m.changedFiles.length}**`);
  lines.push(`- Inferred decisions: **${m.inferred.length}**`);
  lines.push(`- Conflicts: **${fail} fail**, **${warn} warn**, **${info} info**`);
  lines.push("");

  lines.push(`## Changed files`);
  if (m.changedFiles.length === 0) {
    lines.push(`- (none)`);
  } else {
    for (const f of m.changedFiles) lines.push(`- \`${f.status}\` \`${f.path}\``);
  }
  lines.push("");

  lines.push(`## Decisions inferred (best-effort)`);
  if (m.inferred.length === 0) {
    lines.push(`- (none detected)`);
  } else {
    for (const d of m.inferred) lines.push(`- ${d}`);
  }
  lines.push("");

  lines.push(`## Conflicts vs specpack.json`);
  if (m.conflicts.length === 0) {
    lines.push(`- (none detected)`);
  } else {
    for (const c of m.conflicts) {
      lines.push(`- **${c.level.toUpperCase()}**: ${c.title}`);
      lines.push(`  - ${c.detail}`);
    }
  }
  lines.push("");

  lines.push(`## Progress vs acceptance tests`);
  if (m.progress.length === 0) {
    lines.push(`- (no tests in specpack.json)`);
  } else {
    for (const p of m.progress) {
      const label = p.status === "likely_done" ? "likely done" : "unknown";
      lines.push(`- **${label}**`);
      lines.push(`  - Given: ${p.test.given}`);
      lines.push(`  - When: ${p.test.when}`);
      lines.push(`  - Then: ${p.test.then}`);
      if (p.reason) lines.push(`  - Reason: ${p.reason}`);
    }
  }
  lines.push("");

  lines.push(`## Suggestions`);
  lines.push(`- (v0) This tool never auto-commits. Fix conflicts manually, then re-run \`figural-watch report\`.`);
  lines.push("");

  return lines.join("\n");
}

