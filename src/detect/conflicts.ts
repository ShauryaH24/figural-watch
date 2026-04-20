export type ConflictLevel = "fail" | "warn" | "info";

export type ConflictEvidence = {
  kind:
    | "matched_scope_out"
    | "inferred_signal"
    | "dependency"
    | "base_dependency"
    | "file"
    | "ref";
  value: string;
  path?: string;
};

export type Conflict = {
  id: string;
  level: ConflictLevel;
  title: string;
  detail: string;
  evidence?: ConflictEvidence[];
};

export function detectScopeOutConflicts(scopeOut: string[], inferred: string[]): Conflict[] {
  const scopeTokens = normalizeTokens(scopeOut);
  const inferredTokens = inferred.map((s) => s.toLowerCase());

  const conflicts: Conflict[] = [];

  // ORM / Prisma / Auth / Next / SSR keyword checks (simple v0 rules).
  if (containsAny(scopeTokens, ["no orm", "no orms", "no database orm"])) {
    if (inferredTokens.some((x) => x.includes("orm:"))) {
      const matched = findMatchingLine(scopeOut, ["no orm", "no orms", "no database orm"]);
      conflicts.push({
        id: "scope_out.no_orm",
        level: "fail",
        title: "SpecPack scope_out forbids ORM introduction",
        detail: "Detected ORM-related additions but scope_out includes a 'no ORM' constraint.",
        evidence: compactEvidence([
          matched ? { kind: "matched_scope_out", value: matched } : null,
          { kind: "inferred_signal", value: inferred.find((x) => x.toLowerCase().includes("orm:")) ?? "ORM signal" }
        ]),
      });
    }
  }

  if (containsAny(scopeTokens, ["no prisma"])) {
    if (inferredTokens.some((x) => x.includes("prisma"))) {
      const matched = findMatchingLine(scopeOut, ["no prisma"]);
      const inferredLine = inferred.find((x) => x.toLowerCase().includes("prisma")) ?? "prisma";
      conflicts.push({
        id: "scope_out.no_prisma",
        level: "fail",
        title: "SpecPack scope_out forbids Prisma",
        detail: "Detected Prisma packages but scope_out contains 'no prisma'.",
        evidence: compactEvidence([
          matched ? { kind: "matched_scope_out", value: matched } : null,
          { kind: "inferred_signal", value: inferredLine }
        ]),
      });
    }
  }

  if (containsAny(scopeTokens, ["no auth", "no authentication"])) {
    if (inferredTokens.some((x) => x.includes("auth:"))) {
      const matched = findMatchingLine(scopeOut, ["no auth", "no authentication"]);
      conflicts.push({
        id: "scope_out.no_auth",
        level: "fail",
        title: "SpecPack scope_out forbids adding auth systems",
        detail: "Detected auth-library additions but scope_out forbids auth changes.",
        evidence: compactEvidence([
          matched ? { kind: "matched_scope_out", value: matched } : null,
          { kind: "inferred_signal", value: inferred.find((x) => x.toLowerCase().includes("auth:")) ?? "Auth signal" }
        ]),
      });
    }
  }

  if (containsAny(scopeTokens, ["no next", "no nextjs", "no next.js"])) {
    if (inferredTokens.some((x) => x.includes("ssr:") && x.includes("next"))) {
      const matched = findMatchingLine(scopeOut, ["no next", "no nextjs", "no next.js"]);
      conflicts.push({
        id: "scope_out.no_next",
        level: "fail",
        title: "SpecPack scope_out forbids Next.js",
        detail: "Detected Next.js/SSR signals but scope_out contains 'no next'.",
        evidence: compactEvidence([
          matched ? { kind: "matched_scope_out", value: matched } : null,
          { kind: "inferred_signal", value: inferred.find((x) => x.toLowerCase().includes("ssr:")) ?? "SSR signal" }
        ]),
      });
    }
  }

  if (containsAny(scopeTokens, ["no ssr", "no server rendering", "no server-side rendering"])) {
    if (inferredTokens.some((x) => x.includes("ssr:"))) {
      const matched = findMatchingLine(scopeOut, ["no ssr", "no server rendering", "no server-side rendering"]);
      conflicts.push({
        id: "scope_out.no_ssr",
        level: "fail",
        title: "SpecPack scope_out forbids SSR",
        detail: "Detected SSR/Next signals but scope_out contains 'no ssr'.",
        evidence: compactEvidence([
          matched ? { kind: "matched_scope_out", value: matched } : null,
          { kind: "inferred_signal", value: inferred.find((x) => x.toLowerCase().includes("ssr:")) ?? "SSR signal" }
        ]),
      });
    }
  }

  return conflicts;
}

function normalizeTokens(lines: string[]): string[] {
  return lines
    .map((s) => s.toLowerCase())
    .map((s) => s.replace(/[^\p{L}\p{N}]+/gu, " ").trim())
    .filter(Boolean);
}

function containsAny(haystack: string[], needles: string[]): boolean {
  return needles.some((n) => haystack.some((h) => h.includes(n)));
}

function findMatchingLine(lines: string[], needles: string[]): string | null {
  const lower = lines.map((l) => l.toLowerCase());
  for (let i = 0; i < lower.length; i++) {
    const l = lower[i]!;
    if (needles.some((n) => l.includes(n))) return lines[i] ?? null;
  }
  return null;
}

function compactEvidence(items: Array<ConflictEvidence | null>): ConflictEvidence[] | undefined {
  const out = items.filter((x): x is ConflictEvidence => x != null);
  return out.length > 0 ? out : undefined;
}

