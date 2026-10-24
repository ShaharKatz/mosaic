import { isAbsolute } from "node:path";

export const FORMATS = ["pytest", "jest", "vitest", "exit-code"] as const;
export type Runner = { format: typeof FORMATS[number]; setup: string[]; argsPrefix: string[]; cwd: string; env?: Record<string, string>; verifyCommand?: string };
export type TestEntry = { repository: string; path: string; testCommand: string; testRunner: Runner };
export const STATUS = { pass: "PASS", failed: "FAILED", error: "ERROR" } as const;
export const MUTATION = { caught: "caught by", survived: "SURVIVED", notApplied: "NOT APPLIED", inconclusive: "INCONCLUSIVE", refused: "REFUSED" } as const;
export const REPORT_ENV = "CODEX_REVIEW_RUN_REPORT";
export const PROBE = { writeOK: "CX_WRITE_BLOCKED", netOK: "CX_NET_BLOCKED", writeBad: "CX_WRITE_ALLOWED", netBad: "CX_NET_ALLOWED" } as const;
export function safeRelative(value: unknown): value is string {
  return typeof value === "string" && !!value.trim() && !isAbsolute(value) && !/[\\\r\n\0]/.test(value)
    && !value.split("/").includes("..") && !value.includes("\u007b\u007b");
}
function line(value: unknown): value is string {
  return typeof value === "string" && !!value.trim() && !/[\r\n\0]/.test(value) && !value.includes("\u007b\u007b");
}
export function validateRunner(value: unknown, fallback: string): Runner {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("testRunner must be an object");
  const runner = value as Runner;
  if (!FORMATS.includes(runner.format)) throw new Error("testRunner.format must be pytest, jest, vitest, or exit-code");
  for (const key of ["setup", "argsPrefix"] as const) {
    if (!Array.isArray(runner[key]) || runner[key].some(item => !line(item))) throw new Error(`testRunner.${key} must be an array of nonempty single-line strings`);
  }
  const cwd = runner.cwd === undefined ? fallback : runner.cwd;
  if (!safeRelative(cwd)) throw new Error("testRunner.cwd must be a safe repository-relative directory");
  if (runner.verifyCommand !== undefined && !line(runner.verifyCommand)) throw new Error("testRunner.verifyCommand must be nonempty");
  if (runner.env !== undefined && (!runner.env || typeof runner.env !== "object" || Array.isArray(runner.env)
    || Object.entries(runner.env).some(([key, value]) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || typeof value !== "string" || /[\r\n\0]/.test(value)))) throw new Error("testRunner.env must contain non-secret single-line settings");
  return { ...runner, cwd };
}
export function validateTesting(value: unknown): TestEntry[] {
  if (!Array.isArray(value) || !value.length) throw new Error("testing must be a nonempty array");
  const keys = new Set<string>();
  return value.map(entry => {
    if (!entry || !safeRelative(entry.repository) || !safeRelative(entry.path) || !line(entry.testCommand)) throw new Error("testing entries require safe repository/path and nonempty testCommand");
    const key = JSON.stringify([entry.repository, entry.path]);
    if (keys.has(key)) throw new Error("duplicate testing entry");
    keys.add(key);
    return { ...entry, testRunner: validateRunner(entry.testRunner, entry.path) };
  });
}
