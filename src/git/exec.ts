import { execFileSync } from "node:child_process";

export type ExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export function execGit(args: string[], cwd = process.cwd()): ExecResult {
  try {
    const stdout = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: any) {
    const stdout = typeof err?.stdout === "string" ? err.stdout : String(err?.stdout ?? "");
    const stderr = typeof err?.stderr === "string" ? err.stderr : String(err?.stderr ?? "");
    const exitCode = typeof err?.status === "number" ? err.status : 1;
    return { stdout, stderr, exitCode };
  }
}

