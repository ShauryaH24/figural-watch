import type { ChangedFile } from "../git/diff.js";

export type SystemDetection = {
  orm: Set<string>;
  auth: Set<string>;
  ssr: Set<string>;
};

const ORM_PKGS = new Set([
  "prisma",
  "@prisma/client",
  "drizzle-orm",
  "sequelize",
  "typeorm",
  "knex",
  "mongoose",
]);

const AUTH_PKGS = new Set([
  "next-auth",
  "@auth/core",
  "@clerk/nextjs",
  "@clerk/clerk-sdk-node",
  "clerk",
  "lucia",
  "passport",
  "supertokens-node",
  "supertokens-auth-react",
]);

export function detectSystemsFromDeps(addedDeps: string[]): SystemDetection {
  const out: SystemDetection = { orm: new Set(), auth: new Set(), ssr: new Set() };

  for (const d of addedDeps) {
    if (ORM_PKGS.has(d)) out.orm.add(d);
    if (AUTH_PKGS.has(d)) out.auth.add(d);
    if (d === "next") out.ssr.add("next");
  }

  return out;
}

export function detectSsrFromFiles(changed: ChangedFile[], diffTextByPath: Map<string, string>) {
  // Lightweight, conservative heuristics.
  // We only flag SSR/Next if there's a strong signal.
  const out = new Set<string>();

  for (const f of changed) {
    const p = f.path.replace(/\\/g, "/");
    if (/^next\.config\.(js|mjs|cjs|ts)$/i.test(p)) out.add("next.config");
    if (/^pages\//i.test(p)) {
      const diff = diffTextByPath.get(f.path) ?? "";
      if (diff.includes("getServerSideProps") || diff.includes("getStaticProps")) out.add("pages-datafetch");
    }
    if (/^app\//i.test(p)) {
      const diff = diffTextByPath.get(f.path) ?? "";
      if (diff.includes("\"use server\"") || diff.includes("next/server")) out.add("app-router");
    }
  }

  return out;
}

export function summarizeSystems(s: SystemDetection): string[] {
  const lines: string[] = [];
  if (s.orm.size > 0) lines.push(`ORM: ${[...s.orm].sort().join(", ")}`);
  if (s.auth.size > 0) lines.push(`Auth: ${[...s.auth].sort().join(", ")}`);
  if (s.ssr.size > 0) lines.push(`SSR: ${[...s.ssr].sort().join(", ")}`);
  return lines;
}

