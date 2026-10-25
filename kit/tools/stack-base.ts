#!/usr/bin/env bun
// Fetch and evaluate only. stdout is an atomic ordered protocol, never a progress log.
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import * as c from "./constants/stack-base.ts";

class EvaluationError extends Error {
  constructor(message: string, readonly code = c.CANNOT_EVALUATE) { super(message); }
}
function stop(number: number): never { throw new EvaluationError(c.STOP_REASONS[number]!, c.STOP); }
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function within(root: string, file: string): boolean {
  const suffix = relative(root, file);
  return !isAbsolute(suffix) && suffix !== ".." && !suffix.startsWith(`..${sep}`);
}
type Repository = { name: string; path: string; remote: string };
function remoteIdentity(remote: string): string {
  let host: string;
  let repository: string;
  if (remote.includes("://")) {
    try {
      const url = new URL(remote);
      if (url.protocol === "file:") return remote;
      host = url.hostname;
      repository = url.pathname;
    } catch { return remote; }
  } else {
    const scp = /^(?:[^@/]+@)?([^:/]+):(.+)$/.exec(remote);
    if (!scp) return remote;
    host = scp[1]!;
    repository = scp[2]!;
  }
  const parts = repository.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "").split("/");
  return parts.length === 2 && parts.every(Boolean) ? `${host}/${parts.join("/")}`.toLowerCase() : remote;
}
function evaluate(repoName: string, planArgument?: string): Record<string, string> {
  const root = realpathSync(process.cwd());
  const config: unknown = JSON.parse(readFileSync(join(root, c.CONFIG_PATH), "utf8"));
  if (!record(config) || !record(config.landing) || config.landing.mode !== "pull-request" || config.landing.host !== "github") throw new EvaluationError("stack resolution requires pull-request mode on GitHub");
  const defaultBranch = config.defaultBranch;
  if (typeof defaultBranch !== "string" || !defaultBranch.trim() || /[\r\n\0]/.test(defaultBranch)) throw new EvaluationError("invalid defaultBranch");
  if (!Array.isArray(config.repositories) || !config.repositories.length) throw new EvaluationError("missing repositories metadata");
  const repositories: Repository[] = [];
  const names = new Set<string>();
  const paths = new Set<string>();
  for (const repo of config.repositories as unknown[]) {
    if (!record(repo) || typeof repo.name !== "string" || !repo.name || names.has(repo.name)
      || typeof repo.path !== "string" || isAbsolute(repo.path) || repo.path.includes("\\")
      || repo.path.split("/").includes("..") || paths.has(repo.path)
      || typeof repo.remote !== "string" || !repo.remote.trim() || /[\r\n\0]/.test(repo.remote)) throw new EvaluationError("invalid repositories metadata");
    names.add(repo.name); paths.add(repo.path);
    repositories.push({ name: repo.name, path: repo.path, remote: repo.remote });
  }
  const link = repositories.find(repo => repo.name === c.LINK_REPO);
  if (link?.path !== "." || (config.topology === "monorepo" && repositories.length !== 1)) throw new EvaluationError("invalid repository topology");
  const selected = repositories.find(repo => repo.name === repoName);
  if (!selected) throw new EvaluationError(`unknown repository: ${repoName}`);
  const cwd = realpathSync(resolve(root, selected.path));
  if (!within(root, cwd)) throw new EvaluationError("repository is outside the link root");
  function run(program: string, ...args: string[]) {
    const result = spawnSync(program, args, { cwd, encoding: "utf8", timeout: c.COMMAND_TIMEOUT });
    if (result.error) throw new EvaluationError(result.error.message);
    if (result.signal || result.status === null) throw new EvaluationError(`${program} did not complete`);
    return { code: result.status, out: result.stdout, err: result.stderr };
  }
  function git(...args: string[]): string {
    const result = run("git", ...args);
    if (result.code) throw new EvaluationError(result.err.trim());
    return result.out.trim();
  }
  function lines(...args: string[]): string[] {
    const result = run("git", ...args);
    if (result.code) throw new EvaluationError(result.err.trim());
    return result.out === "" ? [] : result.out.replace(/\n$/, "").split("\n");
  }
  function ancestor(ref: string, tip = c.HEAD): boolean {
    const result = run("git", "merge-base", "--is-ancestor", ref, tip);
    if (result.code !== 0 && result.code !== 1) throw new EvaluationError(result.err.trim());
    return result.code === 0;
  }
  function fetch(branch: string): void {
    if (run("git", "fetch", c.ORIGIN, branch).code) stop(3);
  }
  function gh(args: string[], reason: number): unknown {
    const result = run("gh", ...args, "--repo", selected!.remote);
    if (result.code) stop(reason);
    try { return JSON.parse(result.out); } catch { stop(reason); }
  }
  function sameHeadRepository(pr: Record<string, unknown>): boolean {
    if (pr.isCrossRepository !== false || !record(pr.headRepository) || !record(pr.headRepositoryOwner)) return false;
    const owner = pr.headRepositoryOwner.login, repo = pr.headRepository;
    // Some gh releases (2.83.2 among them) return `nameWithOwner: ""` from `pr list`; the owner login and the
    // repository name then identify the head.
    const name = typeof repo.nameWithOwner === "string" && repo.nameWithOwner !== "" ? repo.nameWithOwner
      : typeof owner === "string" && typeof repo.name === "string" ? `${owner}/${repo.name}` : undefined;
    if (typeof name !== "string" || typeof owner !== "string" || !/^[^/]+\/[^/]+$/.test(name)) return false;
    return name.split("/")[0]!.toLowerCase() === owner.toLowerCase()
      && configuredIdentity.slice(configuredIdentity.indexOf("/") + 1) === name.toLowerCase()
      && /^[^/]+\/[^/]+\/[^/]+$/.test(configuredIdentity);
  }
  if (git("rev-parse", "--is-inside-work-tree") !== "true" || realpathSync(git("rev-parse", "--show-toplevel")) !== cwd) throw new EvaluationError("selected path is not a repository root");
  const configuredIdentity = remoteIdentity(selected.remote);
  // Fetch uses only the first stored URL; later values cannot authorize it.
  // Accept that URL's stored identity or its insteadOf-expanded form.
  const originConfig = run("git", "config", "--get-all", `remote.${c.ORIGIN}.url`);
  if (originConfig.code || !originConfig.out.split("\n")[0]) throw new EvaluationError("origin remote is not configured");
  const firstOriginUrl = originConfig.out.split("\n")[0]!;
  const originUrls = [firstOriginUrl, git("remote", "get-url", c.ORIGIN)];
  if (!originUrls.some(url => remoteIdentity(url) === configuredIdentity)) throw new EvaluationError("origin does not match configured repository remote");
  if (run("git", "check-ref-format", "--branch", defaultBranch).code) throw new EvaluationError("invalid defaultBranch");
  const branch = git("branch", "--show-current");
  if (!branch) stop(1);
  const match = c.PLAN_BRANCH_PATTERN.exec(branch);
  const kind = match ? c.PLAN : c.LIGHT;
  let archived = false;
  let declared = defaultBranch;
  let number: string | undefined;
  let planPath: string | undefined;
  if (match) {
    // Only the legal home(s) are searched. No recursive member scans or copies.
    const homes = [root, ...repositories.filter(repo => repo.name !== c.LINK_REPO).map(repo => resolve(root, repo.path))];
    const candidates: string[] = [];
    for (const home of homes) for (const directory of [join(home, c.PLAN_DIRECTORY), join(home, c.PLAN_DIRECTORY, c.ARCHIVED_DIRECTORY)]) {
      try {
        for (const file of readdirSync(directory)) if (file.startsWith(`${match[1]}-`) && file.endsWith(".md")) candidates.push(join(directory, file));
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
    if (candidates.length !== 1) stop(2);
    planPath = candidates[0]!;
    if (planArgument && realpathSync(resolve(root, planArgument)) !== realpathSync(planPath)) throw new EvaluationError("plan path does not match the branch's unique plan");
    archived = dirname(planPath).endsWith(`${sep}${c.ARCHIVED_DIRECTORY}`);
  } else if (planArgument) throw new EvaluationError("--plan requires a plan branch");
  if (run("gh", ...c.AUTH_ARGS).code) throw new EvaluationError("gh is unauthenticated");
  fetch(defaultBranch);
  const defaultRef = c.remoteRef(defaultBranch);
  const defaultSha = git("rev-parse", "--verify", defaultRef);
  const span = `${defaultSha}..HEAD`;
  const ownData = gh(["pr", "list", "--head", branch, ...c.OWN_PR_SUFFIX], 4);
  if (!Array.isArray(ownData) || ownData.length > 1) stop(4);
  const own = (ownData as unknown[]).map(pr => {
    if (!record(pr) || typeof pr.number !== "number" || !Number.isInteger(pr.number) || typeof pr.baseRefName !== "string" || !sameHeadRepository(pr)) stop(4);
    return { number: pr.number, baseRefName: pr.baseRefName };
  });
  if (planPath) {
    try {
      const content = readFileSync(planPath, "utf8").split(/\r?\n/);
      if (content[0] !== "---") throw new Error("missing frontmatter");
      const end = content.indexOf("---", 1);
      if (end < 0) throw new Error("missing frontmatter terminator");
      const parsed = Bun.YAML.parse(content.slice(1, end).join("\n"));
      const data = parsed === null ? {} : parsed;
      if (!record(data)) throw new Error(c.FRONTMATTER_NOT_MAPPING);
      // Empty legacy frontmatter remains an unstacked declaration.
      if (Object.keys(data).length) {
        const targets = typeof data.repo === "string" ? data.repo.split(",").map(target => target.trim()).filter(Boolean) : data.repo;
        if (!Array.isArray(targets) || !targets.length || targets.some(target => typeof target !== "string" || !names.has(target)) || new Set(targets).size !== targets.length) throw new Error("invalid plan targets");
        const branched = new Set<string>(targets);
        if (targets.length > 1) branched.add(c.LINK_REPO);
        if (!branched.has(repoName)) throw new Error("selected repository is not targeted by the plan");
        const home = targets.length === 1 && targets[0] !== c.LINK_REPO ? resolve(root, repositories.find(repo => repo.name === targets[0])!.path) : root;
        const legalDirectory = join(home, c.PLAN_DIRECTORY, ...(archived ? [c.ARCHIVED_DIRECTORY] : []));
        if (dirname(planPath) !== legalDirectory) throw new Error("plan is not in its declared home");
        if (String(data.plan).padStart(4, "0") !== match[1] || data.branch !== branch) throw new Error("plan number or branch does not match");
        if ("base" in data || "base-pr" in data) throw new Error("use bases, not scalar declarations");
        if ("bases" in data) {
          if (!record(data.bases) || Object.keys(data.bases).length !== branched.size || Object.keys(data.bases).some(name => !branched.has(name))) throw new Error("bases must cover exactly the branched repositories");
          for (const name of branched) {
            const entry = data.bases[name];
            if (!record(entry)) throw new Error("missing repository base entry");
            const base = entry.base;
            const pr = entry["base-pr"];
            if ((base !== null && base !== undefined && typeof base !== "string") || typeof pr === "boolean"
              || (pr !== null && pr !== undefined && typeof pr !== "string" && !Number.isInteger(pr))) throw new Error(c.DECLARATION_TYPE_INVALID);
            if (name === repoName) {
              declared = typeof base === "string" && base ? base : defaultBranch;
              number = pr === null || pr === undefined ? undefined : String(pr);
            }
          }
        }
      }
    } catch (error) { throw new EvaluationError(c.FRONTMATTER_ERROR + (error instanceof Error ? error.message : String(error))); }
  } else {
    const trailers = lines("log", "--format=%(trailers:key=Base,valueonly)", span).filter(line => line.trim()).map(line => line.trim().split(/\s+/));
    const owned = trailers.find(words => words.at(-2) === "for" && words.at(-1) === branch)?.slice(0, -2);
    if (!owned && trailers.length) stop(5);
    if (owned) { declared = owned[0] ?? ""; number = owned[1]?.replace(/^#/, ""); }
  }
  if (declared !== defaultBranch && !number) stop(6);
  if (run("git", "check-ref-format", "--branch", declared).code || (number && !/^[1-9]\d*$/.test(number))) throw new EvaluationError(c.DECLARATION_TYPE_INVALID);
  let parent: string = c.NONE;
  let base = defaultBranch;
  let parentData: Record<string, unknown> | undefined;
  if (number) {
    const response = gh(["pr", "view", number, ...c.PARENT_PR_SUFFIX], 7);
    if (!record(response) || response.headRefName !== declared || !sameHeadRepository(response)) stop(7);
    parentData = response;
    if (parentData.state === "OPEN") { parent = c.OPEN; base = declared; }
    else if (parentData.state === "MERGED" && parentData.baseRefName === defaultBranch) parent = c.MERGED;
    else stop(7);
  }
  if (parent === c.OPEN) fetch(base);
  const ref = c.remoteRef(base);
  const sha = base === defaultBranch ? defaultSha : git("rev-parse", "--verify", ref);
  const ownBase = own[0]?.baseRefName;
  if (own.length && ownBase !== base && !(parent === c.MERGED && ownBase === declared)) stop(8);
  let tip: string | undefined;
  const parentMatch = c.PLAN_BRANCH_PATTERN.exec(declared);
  const subjectSearch = kind === c.PLAN && parentMatch !== null;
  if (number) {
    if (subjectSearch) {
      const pattern = c.parentSubjectPattern(parentMatch![1]!);
      for (const line of lines("log", "--format=%H %s", span)) {
        const space = line.indexOf(" ");
        if (pattern.test(line.slice(space + 1))) { tip = line.slice(0, space); break; }
      }
    } else {
      const fork = run("git", "merge-base", "--fork-point", c.remoteRef(declared), c.HEAD);
      if (fork.code === 0) tip = fork.out.trim() || undefined;
    }
  }
  const contained = ancestor(sha);
  const pending: string[] = [];
  let action: string = c.NONE;
  let command = "";
  if (subjectSearch && tip && (parent === c.MERGED || !contained)) {
    if (lines("log", "--format=%s", `${defaultSha}..${tip}`).some(subject => c.subjectPattern(match![1]!).test(subject))) stop(9);
  }
  if ((parent === c.MERGED || (parent === c.OPEN && !contained)) && git("rev-list", "--merges", span)) stop(9);
  if (parent === c.OPEN && !contained) {
    if (!tip) stop(9);
    action = c.RESTACK;
    command = c.ontoCommand(ref, tip, branch);
  } else if (parent === c.MERGED) {
    if (!tip && !subjectSearch) {
      const merge = parentData?.mergeCommit;
      const landing = record(merge) && typeof merge.oid === "string" ? merge.oid : undefined;
      if (!landing || !ancestor(landing)) {
        const head = parentData?.headRefOid;
        if (kind === c.LIGHT && typeof head === "string" && head && run("git", "cat-file", "-e", `${head}^{commit}`).code === 0 && ancestor(head)) throw new EvaluationError(c.recoveryMessage(declared, head), c.STOP);
        stop(9);
      }
    }
    let history = Boolean(tip && !ancestor(tip, defaultSha));
    const metadata: string[] = [];
    if (!archived) metadata.push(c.DECLARATION);
    if (ownBase === declared) metadata.push(c.RETARGET);
    if (history) command = c.ontoCommand(defaultRef, tip!, branch);
    else if (metadata.length && !contained) { history = true; command = `git rebase ${c.quote(defaultRef)}`; }
    if (history) pending.push(c.HISTORY);
    pending.push(...metadata);
    if (pending.length) action = c.LAND;
  }
  if (match && (action === c.RESTACK || pending.includes(c.HISTORY))) {
    const ownPattern = c.subjectPattern(match[1]!);
    const parentPattern = parentMatch ? c.parentSubjectPattern(parentMatch[1]!) : undefined;
    // S1 inheritance evidence only: these reads do not select a history boundary.
    const parentRef = c.remoteRef(declared);
    const parentRefResult = run("git", "rev-parse", "--verify", parentRef);
    const parentSha = parentRefResult.code === 0 ? parentRefResult.out.trim() : undefined;
    const head = parentData?.headRefOid;
    const parentHead = typeof head === "string" && /^[0-9a-f]{40,64}$/i.test(head)
      && run("git", "cat-file", "-e", `${head}^{commit}`).code === 0 ? head : undefined;
    const reflog = run("git", "reflog", "show", "--format=%H", parentRef);
    const inheritedTips = [...new Set([parentSha, parentHead, ...(reflog.code === 0 ? reflog.out.trim().split("\n") : [])].filter((value): value is string => Boolean(value)))];
    for (const line of lines("log", "--format=%H %s", span)) {
      const space = line.indexOf(" "), oid = line.slice(0, space), subject = line.slice(space + 1);
      if (ownPattern.test(subject)) continue;
      if (subjectSearch && tip && parentPattern?.test(subject) && ancestor(oid, tip)) continue;
      if (inheritedTips.some(parentTip => ancestor(oid, parentTip))) continue;
      stop(10);
    }
  }
  if (match && action !== c.RESTACK && !pending.includes(c.HISTORY)) {
    const pattern = c.subjectPattern(match[1]!);
    if (lines("log", "--format=%s", `${sha}..HEAD`).some(subject => !pattern.test(subject))) stop(10);
  }
  for (const [capturedRef, capturedSha] of [[defaultRef, defaultSha], [ref, sha]]) {
    if (git("rev-parse", "--verify", capturedRef!) !== capturedSha) throw new EvaluationError(`${capturedRef} moved during evaluation; run again`);
  }
  const values = [branch, kind, number ? `${declared} #${number}` : declared, parent, base, ref, sha,
    own.length ? String(own[0].number) : c.NONE, tip || c.NONE, pending.join(",") || c.NONE, action, command];
  return Object.fromEntries(c.OUTPUT_KEYS.map((key, index) => [key, values[index]!]));
}
try {
  const { values } = parseArgs({ args: Bun.argv.slice(2), strict: true, options: { repo: { type: "string" }, plan: { type: "string" } } });
  if (!values.repo) throw new EvaluationError("usage: bun tools/stack-base.ts --repo <name> [--plan <path>]");
  const result = evaluate(values.repo, values.plan);
  process.stdout.write(c.OUTPUT_KEYS.map(key => `${key}=${result[key]}`).join("\n") + "\n");
} catch (error) {
  const code = error instanceof EvaluationError ? error.code : c.CANNOT_EVALUATE;
  const message = error instanceof Error ? error.message : String(error);
  console.error((code === c.STOP ? c.STOP_PREFIX : c.ERROR_PREFIX) + message.replace(/[\r\n]+/g, " "));
  process.exitCode = code;
}
