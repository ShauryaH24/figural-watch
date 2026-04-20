import { execGit } from "./exec.js";

export type ChangedFile = {
  path: string;
  status: "A" | "M" | "D" | "R" | "C" | "U" | "?";
  oldPath?: string;
};

export function listChangedFiles(base: string, head: string): ChangedFile[] {
  const res = execGit(["diff", "--name-status", `${base}..${head}`]);
  if (res.exitCode !== 0) {
    throw new Error(
      `Failed to run git diff for ${base}..${head}.\n${res.stderr || res.stdout}`.trimEnd()
    );
  }

  return res.stdout
    .split(/\r?\n/g)
    .filter(Boolean)
    .map((line) => parseNameStatusLine(line))
    .filter((x): x is ChangedFile => x != null);
}

function parseNameStatusLine(line: string): ChangedFile | null {
  // Examples:
  // M\tpackage.json
  // A\tnew/file.txt
  // R100\told/path\tnew/path
  const parts = line.split("\t");
  if (parts.length < 2) return null;

  const statusToken = parts[0]!;
  const status = statusToken[0] as ChangedFile["status"];

  if (status === "R" || status === "C") {
    const oldPath = parts[1];
    const path = parts[2];
    if (!oldPath || !path) return null;
    return { status, oldPath, path };
  }

  const path = parts[1]!;
  return { status, path };
}

export function showFileAtRef(ref: string, filePath: string): string | null {
  const res = execGit(["show", `${ref}:${filePath}`]);
  if (res.exitCode !== 0) return null;
  return res.stdout;
}

export function diffTextForFile(base: string, head: string, filePath: string): string | null {
  const res = execGit(["diff", "-U0", `${base}..${head}`, "--", filePath]);
  if (res.exitCode !== 0) return null;
  return res.stdout;
}

