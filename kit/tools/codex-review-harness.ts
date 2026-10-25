#!/usr/bin/env bun
// Trusted commands run with developer privileges. This prevents accidental spillover,
// not hostile repository code. The reviewer itself must remain read-only and offline.
import * as fs from "node:fs";
import * as p from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { parseArgs } from "node:util";
import { MUTATION, PROBE, REPORT_ENV, STATUS, safeRelative, validateTesting } from "./constants/codex-review.ts";
import type { TestEntry } from "./constants/codex-review.ts";

type Result = { status: string; names: string[]; output: string; exitCode: number | null };
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
export function inside(root: string, file: string): boolean {
  const rel = p.relative(root, file);
  return !p.isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${p.sep}`);
}
function physical(file: string, links = 0): string {
  if (links > 40) throw new Error("too many symbolic links");
  if (!p.isAbsolute(file)) file = `${process.cwd()}/${file}`;
  let current = p.parse(file).root;
  // Resolve each link before consuming a later '..'; path.resolve/realpathSync
  // can lexically collapse that sequence first on some runtimes.
  for (const part of file.split(p.sep)) {
    if (!part || part === ".") continue;
    if (part === "..") { current = p.dirname(current); continue; }
    const candidate = p.join(current, part);
    try {
      if (fs.lstatSync(candidate).isSymbolicLink()) {
        const target = fs.readlinkSync(candidate);
        current = physical(p.isAbsolute(target) ? target : `${current}/${target}`, links + 1);
      } else current = candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      current = candidate;
    }
  }
  return current;
}
function run(command: string[], cwd: string, extra: Record<string, string> = {}, timeout = 1_800_000, input = "") {
  const env = { ...process.env, CI: "1", PYTHONDONTWRITEBYTECODE: "1", ...extra };
  for (const key of ["VIRTUAL_ENV", "NODE_PATH", "PYTHONPATH"]) delete env[key];
  return spawnSync(command[0]!, command.slice(1), { cwd, env, encoding: "utf8", timeout, maxBuffer: 32 * 1024 * 1024, input });
}
function git(root: string, ...args: string[]): string {
  const result = run(["git", ...args], root, {}, 300_000);
  if (result.error || result.signal || result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr || result.error || result.signal}`);
  return result.stdout;
}
function shell(command: string, args: string[], cwd: string, env: Record<string, string> = {}) {
  // A declared shell command is trusted; each forwarded selection stays a separate argv.
  return run(["sh", "-c", `${command}${args.length ? ' "$@"' : ""}`, "review-runner", ...args], cwd, env);
}
export function route(root: string, input: string): string {
  const givenRoot = p.resolve(root);
  root = fs.realpathSync(root);
  const [file, ...node] = input.split("::");
  const absolute = p.isAbsolute(file!) ? file! : `${root}/${file}`;
  const lexicalRoot = p.isAbsolute(file!) && inside(givenRoot, p.resolve(absolute)) ? givenRoot : root;
  if (!inside(root, physical(absolute)) || !inside(lexicalRoot, p.resolve(absolute))) throw new Error(`selection outside clone: ${input}`);
  const rel = p.relative(lexicalRoot, p.resolve(absolute)) || ".";
  if (!inside(root, physical(p.join(root, rel)))) throw new Error(`normalized selection outside clone: ${input}`);
  return rel + (node.length ? `::${node.join("::")}` : "");
}
export function groups(root: string, entries: TestEntry[], paths: string[]): Map<TestEntry, string[]> {
  const result = new Map<TestEntry, string[]>();
  const whole = new Set<TestEntry>();
  for (const input of paths) {
    const selection = route(root, input);
    const file = selection.split("::")[0]!;
    const entry = entries.filter(entry => entry.path === "." || file === entry.path || file.startsWith(`${entry.path}/`))
      .sort((a, b) => (b.path === "." ? -1 : b.path.length) - (a.path === "." ? -1 : a.path.length))[0];
    if (!entry) throw new Error(`no configured test command for ${input}`);
    if (selection.includes("::") && entry.testRunner.format !== "pytest") throw new Error(`only pytest supports node IDs (::); ${entry.testRunner.format} requires a file or component selection`);
    const selected = result.get(entry) ?? [];
    result.set(entry, selected);
    if (file === entry.path && !selection.includes("::")) { selected.length = 0; whole.add(entry); }
    else if (!whole.has(entry)) {
      let argument = p.relative(entry.testRunner.cwd, file) || ".";
      if (selection.includes("::")) argument += selection.slice(selection.indexOf("::"));
      if (/^[-@]/.test(argument)) argument = `./${argument}`;
      selected.push(argument);
    }
  }
  return result;
}
function cwdFor(root: string, entry: TestEntry): string {
  const cwd = p.join(root, entry.testRunner.cwd);
  if (!inside(root, fs.realpathSync(cwd)) || fs.lstatSync(cwd).isSymbolicLink() || !fs.statSync(cwd).isDirectory()) throw new Error(`unsafe runner cwd: ${entry.testRunner.cwd}`);
  return cwd;
}
export function stateHash(root: string): string {
  root = fs.realpathSync(root);
  const gitBytes = (args: string[]): Buffer => {
    const result = spawnSync("git", args, { cwd: root, timeout: 300_000, maxBuffer: 32 * 1024 * 1024 });
    if (result.error || result.signal || result.status !== 0) throw new Error(`cannot read snapshot state: ${result.error ?? result.stderr}`);
    return result.stdout;
  };
  const raw = gitBytes(["ls-files", "-co", "--exclude-standard", "-z"]);
  const listing: Buffer[] = [];
  for (let start = 0, end = raw.indexOf(0); end !== -1; start = end + 1, end = raw.indexOf(0, start)) {
    if (end > start) listing.push(raw.subarray(start, end));
  }
  listing.sort(Buffer.compare);
  const rows: unknown[] = [["INDEX", hash(gitBytes(["ls-files", "-v", "--stage", "-z"]))]];
  const ancestors = new Map<string, Buffer>([["", Buffer.alloc(0)]]);
  for (const rel of listing) {
    for (let slash = rel.indexOf(47); slash !== -1; slash = rel.indexOf(47, slash + 1)) {
      const ancestor = rel.subarray(0, slash);
      ancestors.set(ancestor.toString("base64"), ancestor);
    }
  }
  const prefix = Buffer.from(`${root}/`);
  for (const [encoded, dir] of [...ancestors].sort(([a], [b]) => a.localeCompare(b))) {
    rows.push(["ANCESTOR", encoded, fs.lstatSync(Buffer.concat([prefix, dir])).mode & 0o7777]);
  }
  for (const rel of listing) {
    const file = Buffer.concat([prefix, rel]), encoded = rel.toString("base64");
    let stat: fs.Stats;
    try { stat = fs.lstatSync(file); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      rows.push([encoded, "MISSING"]); continue;
    }
    rows.push(stat.isSymbolicLink() ? [encoded, "L", hash(fs.readlinkSync(file, { encoding: "buffer" }))]
      : stat.isFile() ? [encoded, "F", stat.mode & 0o7777, stat.nlink, hash(fs.readFileSync(file))]
      : stat.isDirectory() ? [encoded, "D", stat.mode & 0o7777] : [encoded, "SPECIAL"]);
  }
  return hash(JSON.stringify(rows));
}

// Node has no dir_fd rename API. Use libc openat/renameat with a held parent FD,
// including kernel-object containment (F_GETPATH on macOS, /proc/self/fd on Linux).
export async function safeReplace(root: string, rel: string, bytes: Buffer, mode: number, afterOpen?: () => void, beforeOpen?: () => void): Promise<void> {
  root = fs.realpathSync(root);
  if (!safeRelative(rel)) throw new Error(`${MUTATION.refused}: unsafe mutation path`);
  const parent = p.dirname(p.join(root, rel));
  if (!inside(root, fs.realpathSync(parent))) throw new Error(`${MUTATION.refused}: parent escaped`);
  // Platform-specific FFI stays optional. C wrappers preserve the variadic ABI
  // of openat/fcntl (calling either as a fixed-signature FFI function is unsafe).
  const { cc, FFIType, ptr } = await import("bun:ffi");
  const library = process.platform === "darwin" ? "/usr/lib/libSystem.B.dylib" : process.platform === "linux" ? "libc.so.6" : undefined;
  if (!library) throw new Error("directory-descriptor restoration unsupported on this platform");
  const nativeDirectory = fs.mkdtempSync(p.join(p.dirname(root), "review-native-"));
  const nativeSource = p.join(nativeDirectory, "restoration.c");
  fs.writeFileSync(nativeSource, `
extern int openat(int, const char*, int, ...);
extern int renameat(int, const char*, int, const char*);
extern int unlinkat(int, const char*, int);
extern int fcntl(int, int, ...);
int review_openat(int fd, const char* path, int flags, int mode) { return openat(fd, path, flags, mode); }
int review_renameat(int fd, const char* from, int tofd, const char* to) { return renameat(fd, from, tofd, to); }
int review_unlinkat(int fd, const char* path, int flags) { return unlinkat(fd, path, flags); }
int review_getpath(int fd, char* path) { return fcntl(fd, 50, path); }
`);
  let libc;
  try {
    libc = cc({ source: nativeSource, symbols: {
      review_openat: { args: [FFIType.i32, FFIType.ptr, FFIType.i32, FFIType.i32], returns: FFIType.i32 },
      review_renameat: { args: [FFIType.i32, FFIType.ptr, FFIType.i32, FFIType.ptr], returns: FFIType.i32 },
      review_unlinkat: { args: [FFIType.i32, FFIType.ptr, FFIType.i32], returns: FFIType.i32 },
      review_getpath: { args: [FFIType.i32, FFIType.ptr], returns: FFIType.i32 },
    } });
  } finally { fs.rmSync(nativeDirectory, { recursive: true, force: true }); }
  beforeOpen?.();
  const descriptor = fs.openSync(parent, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
  const stage = Buffer.from(`.harness-stage-${randomBytes(16).toString("hex")}\0`);
  const name = Buffer.from(`${p.basename(rel)}\0`);
  let staged = false;
  try {
    let held: string;
    if (process.platform === "darwin") {
      const buffer = Buffer.alloc(4096);
      if (libc.symbols.review_getpath(descriptor, ptr(buffer)) !== 0) throw new Error("cannot resolve directory descriptor");
      held = buffer.subarray(0, buffer.indexOf(0)).toString();
    } else held = fs.readlinkSync(`/proc/self/fd/${descriptor}`);
    if (!inside(root, held)) throw new Error(`${MUTATION.refused}: held directory outside clone`);
    afterOpen?.();
    const fd = libc.symbols.review_openat(descriptor, ptr(stage), fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
    if (fd < 0) throw new Error("cannot stage descriptor-relative replacement");
    staged = true;
    try { fs.writeFileSync(fd, bytes); fs.fchmodSync(fd, mode); } finally { fs.closeSync(fd); }
    if (libc.symbols.review_renameat(descriptor, ptr(stage), descriptor, ptr(name)) !== 0) throw new Error("cannot rename descriptor-relative replacement");
    staged = false;
  } finally {
    if (staged) libc.symbols.review_unlinkat(descriptor, ptr(stage), 0);
    fs.closeSync(descriptor);
    libc.close();
  }
}

export function parseReport(format: string, text: string, exitCode: number | null, supplemental?: string): { status: string; names: string[] } {
  const error = { status: STATUS.error, names: [] as string[] };
  if (format === "exit-code") return { status: exitCode === null ? STATUS.error : exitCode === 0 ? STATUS.pass : STATUS.failed, names: [] };
  if (exitCode !== 0 && exitCode !== 1) return error;
  try {
    if (format === "pytest") {
      // Bun's HTML parser is deliberately not used for XML: malformed reports fail closed.
      // JUnit is parsed by the project's Python toolchain, without third-party modules.
      const parsed = spawnSync("python3", ["-I", "-c", "import json,sys\nfrom xml.etree import ElementTree as E\nr=E.fromstring(sys.stdin.read())\nassert r.tag in ('testsuites','testsuite')\nc=list(r.iter('testcase'))\nprint(json.dumps({'executed':sum(x.find('skipped') is None for x in c),'errors':sum(x.find('error') is not None for x in c),'failed':[x.get('name','') for x in c if x.find('failure') is not None]}))"], { input: text, encoding: "utf8" });
      if (parsed.status !== 0) return error;
      const data = JSON.parse(parsed.stdout);
      if (!data.executed || data.errors || data.failed.some((name: string) => !name.trim()) || (exitCode === 1 && !data.failed.length) || (exitCode === 0 && data.failed.length)) return error;
      return { status: data.failed.length ? STATUS.failed : STATUS.pass, names: data.failed };
    }
    const data = JSON.parse(text);
    if (!data || Array.isArray(data) || !Array.isArray(data.testResults)) return error;
    if (data.wasInterrupted || data.numRuntimeErrorTestSuites > 0) return error;
    if (format === "vitest") {
      const run = JSON.parse(supplemental!);
      if (!run || typeof run.unhandledErrors !== "number" || run.unhandledErrors !== 0 || !["passed", "failed"].includes(run.reason)) return error;
    }
    const names: string[] = [];
    let executed = 0;
    for (const suite of data.testResults) {
      if (!Array.isArray(suite.assertionResults)) return error;
      let failed = 0;
      for (const test of suite.assertionResults) {
        if (test.status === "passed" || test.status === "failed") executed++;
        if (test.status === "failed") {
          if (typeof test.fullName !== "string" || !test.fullName.trim()) return error;
          names.push(test.fullName); failed++;
        }
      }
      if (suite.status === "failed" && !failed) return error;
    }
    if (!executed || data.numPassedTests + data.numFailedTests !== executed || data.numFailedTests !== names.length
      || (exitCode === 0 && names.length) || (exitCode === 1 && !names.length)) return error;
    return { status: names.length ? STATUS.failed : STATUS.pass, names };
  } catch { return error; }
}
export function runTests(root: string, entries: TestEntry[], paths: string[]): Result {
  root = fs.realpathSync(root);
  const reports = fs.mkdtempSync(p.join(p.dirname(root), "review-reports-"));
  const results: Result[] = [];
  try {
    const safePaths: string[] = [];
    for (const selection of paths) {
      try { groups(root, entries, [selection]); safePaths.push(selection); }
      catch (error) { results.push({ status: STATUS.error, names: [], output: String(error), exitCode: null }); }
    }
    for (const [entry, selected] of groups(root, entries, safePaths)) {
      try {
      const runner = entry.testRunner;
      const report = p.join(reports, `result-${results.length}.${runner.format === "pytest" ? "xml" : "json"}`);
      const supplemental = `${report}.run.json`;
      const reporter = `${report}.reporter.mjs`;
      let args: string[] = [];
      if (runner.format === "pytest") args = [...selected, "-q", "-p", "no:cacheprovider", `--junitxml=${report}`];
      if (runner.format === "jest") args = ["--ci", "--runInBand", "--runTestsByPath", ...selected, "--json", "--outputFile", report];
      if (runner.format === "vitest") {
        fs.writeFileSync(reporter, `import {writeFileSync} from 'node:fs';\nexport default class { onTestRunEnd(modules, errors, reason) { writeFileSync(process.env.${REPORT_ENV},JSON.stringify({unhandledErrors:errors.length,messages:errors.map(e=>e.stack||e.message||String(e)),reason})); } }\n`);
        args = ["run", ...selected, "--reporter=json", `--outputFile.json=${report}`, `--reporter=${reporter}`];
      }
      const proc = shell(entry.testCommand, args.length ? [...runner.argsPrefix, ...args] : [], cwdFor(root, entry), { ...runner.env, [REPORT_ENV]: supplemental });
      const reportText = fs.existsSync(report) ? fs.readFileSync(report, "utf8") : "";
      const extra = fs.existsSync(supplemental) ? fs.readFileSync(supplemental, "utf8") : "";
      const verdict = proc.error || proc.signal || proc.status === 126 || proc.status === 127 ? { status: STATUS.error, names: [] }
        : parseReport(runner.format, reportText, proc.status, extra);
      results.push({ ...verdict, exitCode: proc.status, output: `${entry.path} (${runner.format}, exit ${proc.status})\n${proc.stdout}${proc.stderr}\n${reportText}\n${extra}` });
      } catch (error) { results.push({ status: STATUS.error, names: [], output: String(error), exitCode: null }); }
    }
    return { status: results.some(r => r.status === STATUS.error) ? STATUS.error : results.some(r => r.status === STATUS.failed) ? STATUS.failed : results.length ? STATUS.pass : STATUS.error,
      names: results.flatMap(r => r.names), output: results.map(r => r.output).join("\n"), exitCode: null };
  } finally { fs.rmSync(reports, { recursive: true, force: true }); }
}

export async function mutate(root: string, entries: TestEntry[], specs: unknown[], paths: string[], out: string): Promise<number> {
  const matrix: unknown[] = [];
  let contaminated = false;
  let baseline: string;
  try {
    root = fs.realpathSync(root);
    baseline = stateHash(root);
    for (const [index, value] of specs.entries()) {
      const spec = value as { file: string; old: string; new: string; label?: string; test_paths?: string[] };
      let result = MUTATION.inconclusive as string;
      let original: Buffer | undefined;
      let mode = 0;
      const details: Result[] = [];
      try {
        if (contaminated) throw new Error("clone contaminated; later mutation skipped");
        if (!spec || typeof spec !== "object") { result = MUTATION.notApplied; throw new Error("spec must be an object"); }
        if (!safeRelative(spec.file) || typeof spec.old !== "string" || !spec.old || typeof spec.new !== "string") { result = MUTATION.refused; throw new Error("invalid mutation fields"); }
        if (spec.test_paths !== undefined && (!Array.isArray(spec.test_paths) || spec.test_paths.some(file => typeof file !== "string"))) { result = MUTATION.refused; throw new Error("test_paths must be an array of paths"); }
        const selected = spec.test_paths?.length ? spec.test_paths : paths;
        if (!selected.length || selected.some(file => !safeRelative(file) || file.startsWith("-")) || groups(root, entries, selected).size !== 1) { result = MUTATION.refused; throw new Error("test_paths must select one component without options or traversal"); }
        const target = p.join(root, spec.file);
        let stat: fs.Stats;
        try { stat = fs.lstatSync(target); }
        catch (error) { result = MUTATION.notApplied; throw error; }
        if (!inside(root, fs.realpathSync(target)) || stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1) { result = MUTATION.refused; throw new Error("unsafe mutation target"); }
        try { git(root, "ls-files", "--error-unmatch", "--", spec.file); }
        catch (error) { result = MUTATION.refused; throw error; }
        try { original = fs.readFileSync(target); mode = stat.mode & 0o7777; }
        catch (error) { result = MUTATION.notApplied; throw error; }
        const before = runTests(root, entries, selected); details.push(before);
        const baselineChanged = stateHash(root) !== baseline;
        if (baselineChanged) contaminated = true;
        if (before.status !== STATUS.pass || baselineChanged) throw new Error("baseline failed or changed the clone");
        let text: string;
        try { text = new TextDecoder("utf-8", { fatal: true }).decode(original); }
        catch (error) { result = MUTATION.notApplied; throw error; }
        const count = text.split(spec.old).length - 1;
        if (count !== 1) { result = MUTATION.notApplied; throw new Error(`old matched ${count} times; need exactly 1`); }
        try { await safeReplace(root, spec.file, Buffer.from(text.replace(spec.old, () => spec.new)), mode); }
        catch (error) { result = MUTATION.notApplied; throw error; }
        const after = runTests(root, entries, selected); details.push(after);
        result = after.status === STATUS.pass ? MUTATION.survived : after.status === STATUS.failed && after.names.length ? `${MUTATION.caught} ${after.names.join(", ")}` : MUTATION.inconclusive;
      } catch (error) { result += ` — ${String(error)}`; }
      finally {
        if (original) {
          try { await safeReplace(root, spec.file, original, mode); } catch (error) { contaminated = true; result += `; restoration failed: ${error}`; }
        }
        try { if (stateHash(root) !== baseline) contaminated = true; } catch { contaminated = true; }
        if (contaminated && !result.startsWith(MUTATION.inconclusive)) result = `${MUTATION.inconclusive}; observed outcome: ${result}`;
        matrix.push({ label: spec?.label ?? `mutation-${index + 1}`, result, contaminated, details });
      }
    }
  } catch (error) { matrix.push({ result: MUTATION.inconclusive, error: String(error) }); contaminated = true; }
  finally { fs.writeFileSync(out, JSON.stringify(matrix, null, 2) + "\n"); }
  return contaminated ? 1 : 0;
}

export function provision(root: string, entries: TestEntry[], paths: string[]): void {
  root = fs.realpathSync(root);
  git(root, "rev-parse", "--show-toplevel");
  const selected = [...groups(root, entries, paths).keys()];
  // Validate every selection/cwd before any setup can execute.
  for (const entry of selected) cwdFor(root, entry);
  for (const entry of selected) {
    for (const command of [...entry.testRunner.setup, ...(entry.testRunner.verifyCommand ? [entry.testRunner.verifyCommand] : [])]) {
      const result = shell(command, [], cwdFor(root, entry), entry.testRunner.env);
      if (result.error || result.signal || result.status !== 0) throw new Error(`declared setup/provenance failed: ${result.stderr || result.error}`);
    }
    // Editable installs, when present, must point only into this snapshot.
    for (const file of new Bun.Glob(".venv/lib/python*/site-packages/*editable*.pth").scanSync({ cwd: cwdFor(root, entry), dot: true })) {
      for (const line of fs.readFileSync(p.join(cwdFor(root, entry), file), "utf8").split("\n").map(line => line.trim())) {
        if (!line || /^import\s/.test(line)) continue;
        if (!inside(root, physical(p.resolve(cwdFor(root, entry), p.dirname(file), line)))) throw new Error("editable import root outside review clone");
      }
    }
  }
}
export function probeSandbox(cwd: string): void {
  const marker = p.join(tmpdir(), `review-probe-${randomBytes(16).toString("hex")}`);
  const script = `touch '${marker}' 2>/dev/null && echo ${PROBE.writeBad} || echo ${PROBE.writeOK}; command -v curl >/dev/null || exit 90; curl -fsS -m 5 -o /dev/null https://example.com 2>/dev/null && echo ${PROBE.netBad} || echo ${PROBE.netOK}`;
  const result = run(["codex", "sandbox", "--", "sh", "-c", script], cwd, {}, 120_000);
  const output = `${result.stdout}${result.stderr}`;
  if (result.error || result.status !== 0 || output.includes(PROBE.writeBad) || output.includes(PROBE.netBad)
    || !output.includes(PROBE.writeOK) || !output.includes(PROBE.netOK)) throw new Error(`sandbox posture UNVERIFIED: ${output}`);
}

type ReviewSchema = { type: string; enum?: string[]; items: ReviewSchema; properties: Record<string, ReviewSchema>; required: string[] };
function schemaValid(value: unknown, schema: ReviewSchema): boolean {
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.type === "string") return typeof value === "string";
  if (schema.type === "array") return Array.isArray(value) && value.every(item => schemaValid(item, schema.items));
  if (schema.type !== "object" || !value || typeof value !== "object" || Array.isArray(value)) return false;
  const object = value as Record<string, unknown>;
  return Object.keys(object).every(key => Object.hasOwn(schema.properties, key))
    && schema.required.every((key: string) => Object.hasOwn(object, key))
    && Object.entries(schema.properties).every(([key, child]) => schemaValid(object[key], child));
}
export function review(root: string, prompt: string, out: string, repository: string): void {
  // Codex runs with cwd = clone, so every path it receives must already be absolute.
  const output = p.resolve(out), instructions = p.resolve(prompt);
  if (fs.lstatSync(output, { throwIfNoEntry: false })) throw new Error("review output already exists; refusing stale artifact");
  const resolvedOutput = physical(output);
  if ([fs.realpathSync(root), fs.realpathSync(repository)].some(directory => inside(directory, output) || inside(directory, resolvedOutput))) {
    throw new Error("review output must be outside the source repository and clone");
  }
  const before = stateHash(root);
  const source = p.dirname(fs.realpathSync(import.meta.path));
  const schema = p.join(source, "codex-review-schema.json");
  if (!inside(source, fs.realpathSync(schema))) throw new Error("review schema escaped tool directory");
  for (const args of [["--version"], ["login", "status"], ["exec", "--help"]]) {
    const preflight = run(["codex", ...args], root, {}, 120_000);
    if (preflight.error || preflight.status !== 0) throw new Error(`Codex prerequisite unavailable: ${preflight.stderr || preflight.error}`);
    if (args[0] === "exec" && !["--sandbox", "--output-schema", "--output-last-message"].every(flag => preflight.stdout.includes(flag))) throw new Error("Codex CLI lacks required read-only/structured-output capabilities");
  }
  probeSandbox(root);
  const result = run(["codex", "exec", "--skip-git-repo-check", "-s", "read-only", "-C", root, "--output-schema", schema,
    "-o", output, "-"], root, {}, undefined, fs.readFileSync(instructions, "utf8"));
  if (stateHash(root) !== before) throw new Error("review changed snapshot; retain it for inspection");
  if (result.error || result.signal || result.status !== 0 || !fs.existsSync(output)) throw new Error(`Codex review failed: ${result.stderr || result.error}`);
  if (!schemaValid(JSON.parse(fs.readFileSync(output, "utf8")), JSON.parse(fs.readFileSync(schema, "utf8")))) throw new Error("Codex output is not a valid review; never approval");
}

if (import.meta.main) {
  try {
    const command = Bun.argv[2];
    const { values, positionals } = parseArgs({ args: Bun.argv.slice(3), allowPositionals: true, options: {
      clone: { type: "string" }, repo: { type: "string" }, out: { type: "string" }, spec: { type: "string" },
      repository: { type: "string" }, prompt: { type: "string" },
      base: { type: "string" }, head: { type: "string" }, config: { type: "string" }, "expect-state": { type: "string" },
      for: { type: "string", multiple: true },
    } });
    const root = fs.realpathSync(values.clone ?? values.repo ?? process.cwd());
    if (command === "snapshot-state") console.log(stateHash(root));
    else if (command === "assert-isolation") {
      if (!values.repo || !values["expect-state"] || inside(fs.realpathSync(values.repo), root) || stateHash(root) !== values["expect-state"]) throw new Error("isolation failed; retain snapshot for inspection");
      console.log("isolation: outside source and unchanged");
    } else if (command === "probe-sandbox") probeSandbox(root);
    else if (command === "run") {
      if (!values.prompt || !values.out || !values.repo || inside(fs.realpathSync(values.repo), root)) throw new Error("run requires outside --clone, source --repo, --prompt and fresh --out");
      review(root, values.prompt, values.out, values.repo);
    }
    else if (command === "gather") {
      if (!values.base || !values.head || !values.out) throw new Error("gather requires --repo --base --head --out; caller pins both commits");
      const base = git(root, "rev-parse", "--verify", `${values.base}^{commit}`).trim();
      const head = git(root, "rev-parse", "--verify", `${values.head}^{commit}`).trim();
      if (base === head) throw new Error("base equals head; committed review scope would be empty");
      const destination = p.resolve(values.out);
      if (inside(root, destination) || inside(root, physical(`${p.dirname(destination)}/${p.basename(destination)}`))) throw new Error("snapshot must be outside source checkout");
      const cloned = run(["git", "clone", "--local", "--no-hardlinks", "--", root, destination], p.dirname(root));
      if (cloned.status !== 0) throw new Error(`snapshot clone failed: ${cloned.stderr}`);
      git(destination, "checkout", "--detach", head);
      fs.writeFileSync(`${destination}.diff`, git(destination, "diff", "--no-renames", `${base}...${head}`));
      console.log(JSON.stringify({ clone: destination, base, head, uncommittedCopied: false }));
    } else {
      const config = JSON.parse(fs.readFileSync(values.config ?? p.join(root, ".omp/mosaic.json"), "utf8"));
      const entries = validateTesting(config.testing).filter(entry => entry.repository === (values.repository ?? "."));
      if (command === "provision") provision(root, entries, values.for ?? positionals);
      else if (command === "test") {
        if (!values.out) throw new Error("test requires --out");
        const result = runTests(root, entries, positionals);
        fs.writeFileSync(values.out, JSON.stringify(result, null, 2) + "\n"); console.log(result.status);
      } else if (command === "mutate") {
        if (!values.spec || !values.out) throw new Error("mutate requires --spec and --out");
        const spec = JSON.parse(fs.readFileSync(values.spec, "utf8"));
        process.exitCode = await mutate(root, entries, Array.isArray(spec) ? spec : spec.proposed_mutations, positionals, values.out);
      } else throw new Error("usage: codex-review-harness.ts gather|provision|test|run|mutate|snapshot-state|assert-isolation|probe-sandbox");
    }
  } catch (error) { console.error(String(error)); process.exitCode = 1; }
}
