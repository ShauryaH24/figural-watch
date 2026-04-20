export type DependencySnapshot = {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  optionalDependencies: Record<string, string>;
};

export type DependencyAdditions = {
  added: string[];
  addedBySection: Partial<Record<keyof DependencySnapshot, string[]>>;
};

export function parsePackageJsonDeps(jsonText: string): DependencySnapshot {
  const raw = JSON.parse(jsonText) as any;

  return {
    dependencies: safeRecord(raw?.dependencies),
    devDependencies: safeRecord(raw?.devDependencies),
    peerDependencies: safeRecord(raw?.peerDependencies),
    optionalDependencies: safeRecord(raw?.optionalDependencies),
  };
}

export function diffDepAdditions(
  base: DependencySnapshot | null,
  head: DependencySnapshot | null
): DependencyAdditions {
  const baseAll = flatten(base);
  const headAll = flatten(head);

  const added = [...headAll].filter((d) => !baseAll.has(d)).sort();

  const addedBySection: DependencyAdditions["addedBySection"] = {};
  if (base && head) {
    (Object.keys(head) as (keyof DependencySnapshot)[]).forEach((k) => {
      const baseSec = base[k] ?? {};
      const headSec = head[k] ?? {};
      const secAdded = Object.keys(headSec).filter((d) => !(d in baseSec)).sort();
      if (secAdded.length > 0) addedBySection[k] = secAdded;
    });
  }

  return { added, addedBySection };
}

function safeRecord(x: unknown): Record<string, string> {
  if (!x || typeof x !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(x as any)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function flatten(s: DependencySnapshot | null): Set<string> {
  const set = new Set<string>();
  if (!s) return set;
  for (const sec of Object.values(s)) {
    for (const k of Object.keys(sec)) set.add(k);
  }
  return set;
}

