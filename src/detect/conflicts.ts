export type ConflictLevel = "fail" | "warn" | "info";

export type Conflict = {
  level: ConflictLevel;
  title: string;
  detail: string;
};

export function detectScopeOutConflicts(scopeOut: string[], inferred: string[]): Conflict[] {
  const scopeTokens = normalizeTokens(scopeOut);
  const inferredTokens = inferred.map((s) => s.toLowerCase());

  const conflicts: Conflict[] = [];

  // ORM / Prisma / Auth / Next / SSR keyword checks (simple v0 rules).
  if (containsAny(scopeTokens, ["no orm", "no orms", "no database orm"])) {
    if (inferredTokens.some((x) => x.includes("orm:"))) {
      conflicts.push({
        level: "fail",
        title: "SpecPack scope_out forbids ORM introduction",
        detail: "Detected ORM-related additions but scope_out includes a 'no ORM' constraint.",
      });
    }
  }

  if (containsAny(scopeTokens, ["no prisma"])) {
    if (inferredTokens.some((x) => x.includes("prisma"))) {
      conflicts.push({
        level: "fail",
        title: "SpecPack scope_out forbids Prisma",
        detail: "Detected Prisma packages but scope_out contains 'no prisma'.",
      });
    }
  }

  if (containsAny(scopeTokens, ["no auth", "no authentication"])) {
    if (inferredTokens.some((x) => x.includes("auth:"))) {
      conflicts.push({
        level: "fail",
        title: "SpecPack scope_out forbids adding auth systems",
        detail: "Detected auth-library additions but scope_out forbids auth changes.",
      });
    }
  }

  if (containsAny(scopeTokens, ["no next", "no nextjs", "no next.js"])) {
    if (inferredTokens.some((x) => x.includes("ssr:") && x.includes("next"))) {
      conflicts.push({
        level: "fail",
        title: "SpecPack scope_out forbids Next.js",
        detail: "Detected Next.js/SSR signals but scope_out contains 'no next'.",
      });
    }
  }

  if (containsAny(scopeTokens, ["no ssr", "no server rendering", "no server-side rendering"])) {
    if (inferredTokens.some((x) => x.includes("ssr:"))) {
      conflicts.push({
        level: "fail",
        title: "SpecPack scope_out forbids SSR",
        detail: "Detected SSR/Next signals but scope_out contains 'no ssr'.",
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

