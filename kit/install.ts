#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { chmod, lstat, mkdir, readFile, readdir, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { BUNDLE_FILES, DIAGRAMS_ROOT, DRAWIO_PACKAGE, safeRoot, safeDiagramsRoot, diagramPathKey } from "./tools/constants/diagrams.ts";
import { realpathWithinRoot } from "./tools/root-containment.ts";
import { headingAnchors } from "./tools/specialists.ts";
import { validateRunner, validateTesting } from "./tools/constants/codex-review.ts";
import type { Runner, TestEntry } from "./tools/constants/codex-review.ts";
import { BUNDLE_FILES as ERD_FILES, validateErd } from "./tools/constants/erd.ts";
import type { Erd } from "./tools/constants/erd.ts";

type Member = { name: string; path: string; stack: string; testCommand: string; coverageNote: string; testRunner?: Runner };
type Tracking = { mode: "none" | "local" | "mcp"; mcp?: { server: string; team?: string; queue?: string } };
type Landing = { mode: "direct"; host?: never; closeOut?: never } | { mode: "pull-request"; host: "github"; closeOut?: "two-commit" };
type Standard = { name: "excluded-data" | "no-magic-strings" | "shared-first" | "testing" | "pr-evidence"; paths: string[]; dir?: string; designSystem?: string };
const standardNames = ["excluded-data", "no-magic-strings", "shared-first", "testing", "pr-evidence"];
type Specialist = { agent: string; paths: string[]; context?: string };
type Review = { specialists: Specialist[]; frontend?: { displayName?: string; collisions?: "named" | "codeowners-and-me" } };
type Manifest = {
  project: { name: string; summary: string };
  topology: "multi-repo" | "monorepo";
  git: { defaultBranch: string };
  tracking: Tracking;
  landing: Landing;
  diagrams?: { mode: "none" | "drawio"; root?: string; erd?: Erd };
  remotes: { link: string; members: Record<string, string> };
  members: Member[];
  components: Member[];
  standards?: Standard[];
  review?: Review;
  rootTest?: { testCommand: string; testRunner: Runner };
};
type Entry = { kind: "directory"; mode: number } | { kind: "file"; mode: number; content: Buffer }
  | { kind: "symlink"; target: string };
const roots = ["AGENTS.md", "CLAUDE.md", ".omp", ".claude", "docs", "tools"];

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function line(value: unknown, label: string, empty = false): asserts value is string {
  if (typeof value !== "string" || (!empty && !value.trim()) || /[\r\n\0]/.test(value) || value.includes("{{")) {
    throw new Error(`${label} must be ${empty ? "a" : "a nonempty"} single-line string without placeholders`);
  }
}
function manifestFrom(value: unknown): Manifest {
  if (!record(value)) throw new Error("manifest must be an object");
  if (!record(value.project)) throw new Error("project must be an object");
  if (!record(value.remotes)) throw new Error("remotes must be an object");
  const topology = value.topology === undefined ? "multi-repo" : value.topology;
  if (topology !== "multi-repo" && topology !== "monorepo") throw new Error("topology must be multi-repo or monorepo");
  if (value.git !== undefined && !record(value.git)) throw new Error("git must be an object");
  const git = value.git as Record<string, unknown> | undefined;
  const defaultBranch = git?.defaultBranch === undefined ? "main" : git.defaultBranch;
  line(defaultBranch, "git.defaultBranch");
  const tracking = value.tracking === undefined ? { mode: "none" } : value.tracking;
  if (!record(tracking) || (tracking.mode !== "none" && tracking.mode !== "local" && tracking.mode !== "mcp")) {
    throw new Error("tracking.mode must be none, local, or mcp");
  }
  if (tracking.mode === "mcp") {
    if (!record(tracking.mcp)) throw new Error("tracking.mcp must name a mounted server");
    line(tracking.mcp.server, "tracking.mcp.server");
    for (const field of ["team", "queue"]) {
      if (tracking.mcp[field] !== undefined) line(tracking.mcp[field], `tracking.mcp.${field}`);
    }
  } else if (tracking.mcp !== undefined) throw new Error("tracking.mcp is only valid in mcp mode");
  const landing = value.landing === undefined ? { mode: "direct" } : value.landing;
  if (!record(landing) || (landing.mode !== "direct" && landing.mode !== "pull-request")) {
    throw new Error("landing.mode must be direct or pull-request");
  }
  if (landing.mode === "pull-request") {
    if (landing.host !== "github") throw new Error("landing.host must be github in pull-request mode");
  } else if (landing.host !== undefined) throw new Error("landing.host is only valid in pull-request mode");
  if (landing.closeOut !== undefined) {
    if (landing.mode !== "pull-request") throw new Error("landing.closeOut is only valid in pull-request mode");
    if (landing.closeOut !== "two-commit") throw new Error("landing.closeOut must be two-commit");
  }
  let diagrams: Manifest["diagrams"];
  if (value.diagrams !== undefined) {
    if (!record(value.diagrams) || !["none", "drawio"].includes(value.diagrams.mode as string)) throw new Error("diagrams.mode must be none or drawio");
    if (value.diagrams.erd !== undefined && value.diagrams.mode !== "drawio") throw new Error("diagrams.erd requires drawio mode");
    if (value.diagrams.mode === "none") {
      if (value.diagrams.root !== undefined) throw new Error("diagrams.root requires drawio mode");
      diagrams = { mode: "none" };
    } else {
      const root = value.diagrams.root ?? DIAGRAMS_ROOT;
      if (!safeRoot(root)) throw new Error("diagrams.root must be a safe repo-relative directory");
      diagrams = { mode: "drawio", root, ...(value.diagrams.erd !== undefined ? { erd: value.diagrams.erd as Erd } : {}) };
    }
  }
  line(value.project.name, "project.name");
  line(value.project.summary, "project.summary");
  line(value.remotes.link, "remotes.link");
  const remotes = value.remotes.members === undefined && topology === "monorepo" ? {} : value.remotes.members;
  if (!record(remotes)) throw new Error("remotes.members must be an object");
  if (!Array.isArray(value.members) || (topology === "multi-repo" && !value.members.length)) {
    throw new Error(`members must be ${topology === "multi-repo" ? "a nonempty" : "an"} array`);
  }
  const components = value.components === undefined ? [] : value.components;
  if (!Array.isArray(components)) throw new Error("components must be an array");
  for (const [label, entries] of [["members", value.members], ["components", components]] as const) {
    const names = new Set<string>();
    const paths = new Set<string>();
    for (const [index, entry] of entries.entries()) {
      const field = `${label}[${index}]`;
      if (!record(entry)) throw new Error(`${field} must be an object`);
      for (const key of ["name", "path", "stack", "testCommand", "coverageNote"]) line(entry[key], `${field}.${key}`, key === "coverageNote");
      const name = entry.name as string;
      const entryPath = entry.path as string;
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) || names.has(name)) throw new Error(`${field}.name is invalid or duplicate: ${name}`);
      if (isAbsolute(entryPath) || entryPath.includes("\\") || entryPath.split("/").some(part => part === "." || part === "..")
        || !entryPath.replace(/\/+$/, "") || paths.has(entryPath.replace(/\/+$/, ""))) throw new Error(`${field}.path is invalid or duplicate: ${entryPath}`);
      if (diagrams?.mode === "drawio" && !safeRoot(entryPath.replace(/\/+$/, ""))) throw new Error(`${field}.path is an invalid diagram component binding: ${entryPath}`);
      names.add(name);
      paths.add(entryPath.replace(/\/+$/, ""));
      if (label === "members" && topology === "multi-repo") line(remotes[name], `remotes.members.${name}`);
      if (entry.testRunner !== undefined) {
        if ((label === "members" && topology === "monorepo") || (label === "components" && topology === "multi-repo")) {
          throw new Error(`${field}.testRunner is not used by topology ${topology}; configure the active entries instead`);
        }
        validateRunner(entry.testRunner, label === "members" ? "." : entryPath.replace(/\/+$/, ""));
      }
    }
  }
  if (diagrams?.erd !== undefined) validateErd(diagrams.erd, diagrams.root!, (topology === "monorepo" ? components : value.members).map((entry: Member) => entry.path.replace(/\/+$/, "")));
  if (value.standards !== undefined) {
    if (!Array.isArray(value.standards)) throw new Error("standards must be an array");
    const names = new Set<string>();
    for (const [index, entry] of value.standards.entries()) {
      const field = `standards[${index}]`;
      if (!record(entry) || !standardNames.includes(entry.name as string) || names.has(entry.name as string)) {
        throw new Error(`${field}.name must be a supported, unique standard`);
      }
      names.add(entry.name as string);
      if (entry.name === "pr-evidence" && (landing.mode !== "pull-request" || landing.host !== "github")) {
        throw new Error("pr-evidence requires landing.mode: pull-request with landing.host: github");
      }
      if (!Array.isArray(entry.paths) || !entry.paths.length) throw new Error(`${field}.paths must be a nonempty array`);
      for (const glob of entry.paths) {
        line(glob, `${field}.paths`);
        if (isAbsolute(glob) || glob.includes("\\") || glob.split("/").some(part => part === ".." || part === ".")
          || /[()]/.test(glob)) throw new Error(`${field}.paths must contain repository-relative globs without parentheses`);
      }
      if (entry.dir !== undefined) {
        if (entry.name !== "excluded-data") throw new Error(`${field}.dir is only valid for excluded-data`);
        line(entry.dir, `${field}.dir`);
        if (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(entry.dir)) throw new Error(`${field}.dir must be a repository-relative directory`);
      }
      if (entry.designSystem !== undefined) {
        if (entry.name !== "shared-first") throw new Error(`${field}.designSystem is only valid for shared-first`);
        line(entry.designSystem, `${field}.designSystem`);
      }
    }
  }
  let review: Review | undefined;
  if (value.review !== undefined) {
    if (!record(value.review) || !Array.isArray(value.review.specialists ?? [])) throw new Error("review.specialists must be an array");
    const specialists = (value.review.specialists ?? []) as unknown[];
    for (const entry of specialists) {
      if (!record(entry) || typeof entry.agent !== "string" || !/^[a-zA-Z0-9][\w-]*$/.test(entry.agent)) throw new Error("specialist agent must be a safe agent name");
      if (!Array.isArray(entry.paths) || !entry.paths.length) throw new Error("specialist paths must be a nonempty array");
      for (const glob of entry.paths) {
        line(glob, "specialist paths");
        if (isAbsolute(glob) || /[\\()|`]/.test(glob) || glob.split("/").some(part => !part || part === "." || part === "..")) throw new Error("specialist paths must be safe installation-relative globs");
        new Bun.Glob(glob);
      }
      if (entry.context !== undefined) {
        line(entry.context, "specialist context");
        if (!/^[^#]+#[\p{L}\p{N}_-]+$/u.test(entry.context) || isAbsolute(entry.context)
          || entry.context.split("#")[0]!.split("/").some(part => !part || part === "." || part === "..")
          || /[\\|`]/.test(entry.context)) throw new Error("specialist context must name a project-owned file#section");
      }
    }
    const frontend = value.review.frontend;
    if (frontend !== undefined) {
      if (!record(frontend) || Object.keys(frontend).some(key => !["displayName", "collisions"].includes(key))) throw new Error("review.frontend accepts only displayName and collisions");
      if (!specialists.some(entry => (entry as Specialist).agent === "frontend-reviewer")) throw new Error("review.frontend requires frontend-reviewer selection");
      if (frontend.displayName !== undefined) line(frontend.displayName, "review.frontend.displayName");
      if (frontend.collisions !== undefined && !["named", "codeowners-and-me"].includes(frontend.collisions as string)) throw new Error("invalid frontend collisions policy");
      if (frontend.collisions === "codeowners-and-me" && (landing.mode !== "pull-request" || landing.host !== "github")) throw new Error("codeowners-and-me requires GitHub pull-request landing");
    }
    review = { specialists: specialists as Specialist[], ...(frontend !== undefined ? { frontend: frontend as Review["frontend"] } : {}) };
  }
  if (value.rootTest !== undefined) {
    if (!record(value.rootTest)) throw new Error("rootTest must be an object");
    line(value.rootTest.testCommand, "rootTest.testCommand");
    validateRunner(value.rootTest.testRunner, ".");
  }
  return {
    project: value.project as Manifest["project"], topology, git: { defaultBranch }, tracking: tracking as Tracking,
    landing: landing as Landing, diagrams,
    remotes: { link: value.remotes.link, members: remotes as Record<string, string> },
    members: value.members as Member[], components: components as Member[],
    ...(value.standards !== undefined ? { standards: value.standards as Standard[] } : {}),
    ...(review?.specialists.length ? { review } : {}),
    ...(value.rootTest !== undefined ? { rootTest: value.rootTest as Manifest["rootTest"] } : {}),
  };
}
function testingFor(manifest: Manifest): TestEntry[] | undefined {
  if (!manifest.rootTest && ![...manifest.members, ...manifest.components].some(entry => entry.testRunner)) return undefined;
  return validateTesting([
    ...(manifest.rootTest ? [{ repository: ".", path: ".", ...manifest.rootTest,
      testRunner: validateRunner(manifest.rootTest.testRunner, ".") }] : []),
    ...(manifest.topology === "multi-repo" ? manifest.members : manifest.components).map(entry => ({
      repository: manifest.topology === "multi-repo" ? entry.path.replace(/\/+$/, "") : ".",
      path: manifest.topology === "multi-repo" ? "." : entry.path.replace(/\/+$/, ""),
      testCommand: entry.testCommand,
      testRunner: entry.testRunner ? validateRunner(entry.testRunner, manifest.topology === "multi-repo" ? "." : entry.path.replace(/\/+$/, ""))
        : { format: "exit-code", setup: [], argsPrefix: [], cwd: manifest.topology === "multi-repo" ? "." : entry.path.replace(/\/+$/, "") },
    })),
  ]);
}
function commandCwd(member: Member, manifest: Manifest): string {
  if (!member.testRunner) return memberPath(member);
  const cwd = validateRunner(member.testRunner, manifest.topology === "multi-repo" ? "." : member.path.replace(/\/+$/, "")).cwd;
  return manifest.topology === "multi-repo" ? `${memberPath(member)}${cwd === "." ? "" : `${cwd}/`}` : cwd;
}
function memberPath(member: Member): string { return `${member.path.replace(/\/+$/, "")}/`; }
function cell(value: string): string { return value.replace(/\|/g, "\\|"); }
function rootTestRow(manifest: Manifest): string {
  if (!manifest.rootTest) return "";
  const cwd = validateRunner(manifest.rootTest.testRunner, ".").cwd;
  return `| \`.\` | Project root | \`${cell(manifest.rootTest.testCommand)}\` from \`${cell(cwd)}\` |\n`;
}
function memberRemote(manifest: Manifest, token: string): string {
  const name = token.slice("MEMBER_REMOTE:".length);
  const remote = manifest.remotes.members[name];
  if (typeof remote !== "string") throw new Error(`No remote for member ${name}`);
  return remote;
}
function componentsFor(file: string, manifest: Manifest): string {
  const components = manifest.components;
  switch (file) {
    case "docs/process/stack.md":
      return rootTestRow(manifest) + components.map(component => `| \`${cell(memberPath(component))}\` | ${cell(component.stack)} | \`${cell(component.testCommand)}\` from \`${cell(commandCwd(component, manifest))}\`${component.coverageNote ? `; ${cell(component.coverageNote)}` : ""} |`).join("\n");
    case "docs/index.md":
      return components.map(component => `| \`${cell(memberPath(component))}\` | ${cell(component.stack)} |`).join("\n");
    case "docs/process/plan-home.md":
      return `${manifest.project.name} is a single repository; components live under their paths and every plan is link-homed (\`repo: link-repo\`); \`files:\` are repo-root-relative.`;
    case "docs/process/git-flow.md":
      return "components share this repository and remote";
    case "docs/process/tracker.md":
    case "docs/plans/TEMPLATE.md":
      return "link-repo";
    default: throw new Error(`No component rendering defined for ${file}`);
  }
}
function membersFor(file: string, manifest: Manifest): string {
  if (manifest.topology === "monorepo") return componentsFor(file, manifest);
  const members = manifest.members;
  switch (file) {
    case "docs/process/stack.md":
      return rootTestRow(manifest) + members.map(member => `| \`${member.name}\` | ${cell(member.stack)} | \`${cell(member.testCommand)}\` from \`${cell(commandCwd(member, manifest))}\`${member.coverageNote ? `; ${cell(member.coverageNote)}` : ""} |`).join("\n");
    case "docs/index.md":
      return members.map(member => `| \`${cell(memberPath(member))}\` | ${cell(member.stack)} |`).join("\n");
    case "docs/process/plan-home.md": {
      const locations = members.map(member => `\`${memberPath(member)}\``).join(", ");
      return `${manifest.project.name} is the link repo; its ${members.length === 1 ? "subdirectory" : "subdirectories"} ${locations} ${members.length === 1 ? "is an independent, gitignored member repo" : "are independent, gitignored member repos"}.`;
    }
    case "docs/process/git-flow.md":
      return members.map(member => `${members.length === 1 ? "the member" : `the ${member.name}`} remote is \`${memberRemote(manifest, `MEMBER_REMOTE:${member.name}`)}\``).join("; ");
    case "docs/process/tracker.md":
    case "docs/plans/TEMPLATE.md":
      return members[0]!.name;
    default: throw new Error(`No member rendering defined for ${file}`);
  }
}
function render(content: string, file: string, manifest: Manifest): string {
  const standard = manifest.standards?.find(entry => file.endsWith(`/${entry.name}.md`));
  // Resolve tracking, landing, close-out, topology, then values. Own-line tags consume their newline.
  const keep = (mode: string) => mode === `TRACKING_${manifest.tracking.mode.toUpperCase()}`;
  const landingToken = manifest.landing.mode === "direct" ? "LANDING_DIRECT" : "LANDING_PULL_REQUEST";
  const closeOutToken = manifest.landing.closeOut === "two-commit" ? "CLOSE_OUT_TWO_COMMIT" : "CLOSE_OUT_DEFAULT";
  const evidenceSelected = manifest.standards?.some(entry => entry.name === "pr-evidence");
  const selected = content.replace(/^\{\{REVIEW_ENGINE\}\}\n([\s\S]*?)^\{\{\/REVIEW_ENGINE\}\}\n?/gm,
    (_match, body: string) => testingFor(manifest) ? body : "")
    .replace(/\{\{REVIEW_ENGINE\}\}([\s\S]*?)\{\{\/REVIEW_ENGINE\}\}/g, (_match, body: string) => testingFor(manifest) ? body : "")
    .replace(/^\{\{(TRACKING_NONE|TRACKING_LOCAL|TRACKING_MCP)\}\}\n([\s\S]*?)^\{\{\/\1\}\}\n?/gm,
    (_match, mode: string, body: string) => keep(mode) ? body : "")
    .replace(/\{\{(TRACKING_NONE|TRACKING_LOCAL|TRACKING_MCP)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
      (_match, mode: string, body: string) => keep(mode) ? body : "")
    .replace(/^\{\{(LANDING_DIRECT|LANDING_PULL_REQUEST)\}\}\n([\s\S]*?)^\{\{\/\1\}\}\n?/gm,
      (_match, mode: string, body: string) => mode === landingToken ? body : "")
    .replace(/\{\{(LANDING_DIRECT|LANDING_PULL_REQUEST)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
      (_match, mode: string, body: string) => mode === landingToken ? body : "")
    .replace(/^\{\{(CLOSE_OUT_TWO_COMMIT|CLOSE_OUT_DEFAULT)\}\}\n([\s\S]*?)^\{\{\/\1\}\}\n?/gm,
      (_match, mode: string, body: string) => mode === closeOutToken ? body : "")
    .replace(/\{\{(CLOSE_OUT_TWO_COMMIT|CLOSE_OUT_DEFAULT)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
      (_match, mode: string, body: string) => mode === closeOutToken ? body : "")
    .replace(/^\{\{DIAGRAMS_DRAWIO\}\}\n([\s\S]*?)^\{\{\/DIAGRAMS_DRAWIO\}\}\n?/gm,
      (_match, body: string) => manifest.diagrams?.mode === "drawio" ? body : "")
    .replace(/\{\{DIAGRAMS_DRAWIO\}\}([\s\S]*?)\{\{\/DIAGRAMS_DRAWIO\}\}/g,
      (_match, body: string) => manifest.diagrams?.mode === "drawio" ? body : "")
    .replace(/^\{\{DIAGRAMS_ERD\}\}\n([\s\S]*?)^\{\{\/DIAGRAMS_ERD\}\}\n?/gm,
      (_match, body: string) => manifest.diagrams?.erd ? body : "")
    .replace(/\{\{DIAGRAMS_ERD\}\}([\s\S]*?)\{\{\/DIAGRAMS_ERD\}\}/g,
      (_match, body: string) => manifest.diagrams?.erd ? body : "")
    .replace(/\{\{(MULTI_REPO|MONOREPO)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
      (_match, topology: string, body: string) => topology === (manifest.topology === "monorepo" ? "MONOREPO" : "MULTI_REPO") ? body : "")
    .replace(/^\{\{(PR_EVIDENCE|SPECIALISTS|FRONTEND_REVIEW)\}\}\n([\s\S]*?)^\{\{\/\1\}\}\n?/gm,
      (_match, mode: string, body: string) => (mode === "PR_EVIDENCE" ? evidenceSelected
        : mode === "SPECIALISTS" ? manifest.review?.specialists.length
        : manifest.review?.specialists.some(entry => entry.agent === "frontend-reviewer")) ? body : "");
  const result = selected.replace(/\{\{([^{}]+)\}\}/g, (_match, token: string) => {
    switch (token) {
      case "PROJECT_NAME": return manifest.project.name;
      case "PROJECT_SUMMARY": return manifest.project.summary;
      case "LINK_REMOTE": return manifest.remotes.link;
      case "DEFAULT_BRANCH": return manifest.git.defaultBranch;
      case "DEFAULT_BRANCH_YAML": return JSON.stringify(manifest.git.defaultBranch);
      case "TRACKING": return manifest.tracking.mode;
      case "MCP_SERVER": return manifest.tracking.mcp?.server ?? "";
      case "MCP_TEAM": return manifest.tracking.mcp?.team ?? "not configured; resolve the target team before creating intent";
      case "MCP_QUEUE": return manifest.tracking.mcp?.queue ?? "not configured; obtain the H-tracking queue ruling before intake";
      case "DIAGRAMS_ROOT": return manifest.diagrams?.root ?? DIAGRAMS_ROOT;
      case "DRAWIO_PACKAGE": return DRAWIO_PACKAGE;
      case "MEMBERS": return membersFor(file, manifest);
      case "SPECIALIST_ROWS": return manifest.review!.specialists.map(entry =>
        `| \`${entry.agent}\` | ${entry.paths.map(glob => `\`${cell(glob)}\``).join(", ")} | ${entry.context ? `\`${cell(entry.context)}\`` : "none"} |`).join("\n");
      case "STANDARDS": return manifest.standards?.length
        ? `## Standards\n| Standard | Read when |\n|---|---|\n${manifest.standards.map(entry => `| [${entry.name}](standards/${entry.name}.md) | Editing files matching ${entry.paths.map(glob => `\`${cell(glob)}\``).join(", ")} |`).join("\n")}\n` : "";
      case "STANDARD_PATHS": return standard!.paths.map(glob => `  - ${JSON.stringify(glob)}`).join("\n");
      case "STANDARD_SCOPE": return JSON.stringify(standard!.paths.flatMap(glob => [`tool:edit(${glob})`, `tool:write(${glob})`]));
      case "EXCLUDED_DATA_DIR": return manifest.standards?.find(entry => entry.name === "excluded-data")?.dir ?? "excluded_data";
      case "DESIGN_SYSTEM": return manifest.standards?.find(entry => entry.name === "shared-first")?.designSystem
        ?? "the project's design system or shared component library, if any";
      default:
        if (token.startsWith("MEMBER_REMOTE:")) return memberRemote(manifest, token);
        throw new Error(`Unknown placeholder ${token} in ${file}`);
    }
  });
  if (result.includes("{{")) throw new Error(`Unresolved placeholder in ${file}`);
  return result;
}
async function collect(base: string, names: string[], entries: Map<string, Entry>, manifest?: Manifest): Promise<void> {
  for (const name of names) {
    const file = join(base, name);
    if (manifest) {
      const standardFile = /^(?:docs\/standards|\.omp\/rules|\.claude\/rules)\/([^/]+)\.md$/.exec(name);
      if (standardFile && standardNames.includes(standardFile[1]!) && !manifest.standards?.some(entry => entry.name === standardFile[1])) continue;
      if (name === "docs/standards" && !manifest.standards?.length) continue;
      if (/^(?:\.omp|\.claude)\/(?:agents\/frontend-reviewer\.md|skills\/frontend-review(?:\/|$))/.test(name)
        && !manifest.review?.specialists.some(entry => entry.agent === "frontend-reviewer")) continue;
    }
    const stat = await lstat(file);
    const previous = entries.get(name);
    if (!stat.isDirectory() && previous?.kind === "directory") {
      for (const key of entries.keys()) if (key.startsWith(`${name}/`)) entries.delete(key);
    }
    if (stat.isSymbolicLink()) entries.set(name, { kind: "symlink", target: await readlink(file) });
    else if (stat.isDirectory()) {
      entries.set(name, { kind: "directory", mode: stat.mode & 0o777 });
      const children = (await readdir(file)).sort().map(child => `${name}/${child}`);
      await collect(base, children, entries, manifest);
    } else if (stat.isFile()) {
      const content = await readFile(file);
      entries.set(name, { kind: "file", mode: stat.mode & 0o777, content: manifest && name.endsWith(".md")
        ? Buffer.from(render(content.toString("utf8"), name, manifest)) : content });
    } else throw new Error(`Unsupported source entry: ${file}`);
  }
}
async function existing(file: string) {
  try { return await lstat(file); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
}
function contains(parent: string, child: string): boolean {
  const suffix = relative(parent, child);
  return suffix === "" || (!suffix.startsWith(`..${sep}`) && suffix !== ".." && !isAbsolute(suffix));
}

export async function install(options: { manifest: string; target: string; kit?: string; kitCommit?: string; overlay?: string; force?: boolean }): Promise<void> {
  const manifest = manifestFrom(JSON.parse(await readFile(resolve(options.manifest), "utf8")));
  const source = options.kit ? resolve(options.kit) : import.meta.dir;
  const target = resolve(options.target);
  const overlay = options.overlay ? resolve(options.overlay) : undefined;
  for (const input of [source, ...(overlay ? [overlay] : [])]) {
    if (contains(input, target) || contains(target, input)) throw new Error(`Target and source must not overlap: ${input}`);
  }
  const entries = new Map<string, Entry>();
  const sourceNames = await readdir(source);
  await collect(source, roots.filter(name => sourceNames.includes(name)), entries, manifest);
  const evidenceSelected = manifest.standards?.some(entry => entry.name === "pr-evidence");
  if (evidenceSelected) await collect(source, [".github/pull_request_template.md"], entries, manifest);
  // Overlays remain complete replacements, but cannot enable files excluded by the selected mode.
  if (overlay) await collect(overlay, (await readdir(overlay)).sort(), entries);
  if (manifest.landing.mode !== "pull-request") {
    entries.delete("docs/process/final-review.md");
    entries.delete(".omp/rules/final-review.md");
  }
  if (manifest.diagrams?.mode !== "drawio") {
    const excluded = [...BUNDLE_FILES, "docs/architecture/diagrams"];
    for (const name of entries.keys()) if (excluded.some(p => name === p || name.startsWith(p + "/"))
      || name === ".omp/skills/diagrams" || name === ".claude/skills/diagrams" || (name === "tools/constants" && !testingFor(manifest))) entries.delete(name);
  } else if (manifest.diagrams.root !== DIAGRAMS_ROOT) {
    for (const [name, entry] of [...entries]) if (name === DIAGRAMS_ROOT || name.startsWith(DIAGRAMS_ROOT + "/")) {
      const destination = manifest.diagrams.root! + name.slice(DIAGRAMS_ROOT.length);
      if (entries.has(destination)) throw new Error(`diagrams.root collides with kit file ${destination}`);
      entries.delete(name); entries.set(destination, entry);
    }
  }
  if (manifest.diagrams?.mode === "drawio" && !safeDiagramsRoot(manifest.diagrams.root)) throw new Error(`diagrams.root is reserved: ${manifest.diagrams.root}`);
  const specialists = manifest.review?.specialists ?? [];
  for (const specialist of specialists) {
    if (specialist.context) {
      const [file, anchor] = specialist.context.split("#") as [string, string];
      const projectEntry = overlay ? await existing(join(overlay, file)) : undefined;
      const contextRoot = projectEntry ? overlay! : target;
      let real: string | null;
      try { real = realpathWithinRoot(contextRoot, join(contextRoot, file)); }
      catch { throw new Error(`Missing specialist context: ${specialist.context}`); }
      if (!real) throw new Error(`Specialist context escapes project root: ${specialist.context}`);
      if (!(await lstat(real)).isFile()) throw new Error(`Missing specialist context: ${specialist.context}`);
      const content = await readFile(real, "utf8");
      if (!headingAnchors(content).includes(anchor)) throw new Error(`Missing specialist context section: ${specialist.context}`);
      if (entries.has(file) && !projectEntry) throw new Error(`Specialist context must be project-owned, not a kit replacement: ${file}`);
    }
    for (const glob of specialist.paths) {
      const pattern = new Bun.Glob(glob);
      const candidates = (await existing(target))?.isDirectory()
        ? [...pattern.scanSync({ cwd: target, dot: true, onlyFiles: true, followSymlinks: false })] : [];
      if (overlay) candidates.push(...pattern.scanSync({ cwd: overlay, dot: true, onlyFiles: true, followSymlinks: false }));
      if (!candidates.some(file => !file.split("/").some(part => part === ".git" || part === "node_modules"))) throw new Error(`Specialist glob matches no project file: ${glob}`);
    }
  }
  if (!manifest.diagrams?.erd) for (const file of ERD_FILES) entries.delete(file);
  else {
    const outputKey = diagramPathKey(manifest.diagrams.erd.output);
    for (const [name, entry] of entries) {
      const key = diagramPathKey(name);
      if (key === outputKey || key.startsWith(outputKey + "/") || (entry.kind !== "directory" && outputKey.startsWith(key + "/"))) throw new Error(`diagrams.erd.output collides with kit file ${name}`);
    }
    // Preflight an existing output's ancestors too, even though no outputs are installed.
    for (let candidate = join(target, manifest.diagrams.erd.output); candidate !== target; candidate = dirname(candidate)) {
      const stat = await existing(candidate);
      if (stat && !stat.isDirectory()) throw new Error(`ERD output ancestor is not a real directory: ${candidate}`);
    }
  }
  if (manifest.tracking.mode !== "local") {
    for (const name of entries.keys()) {
      if (name === "tools/tracker.ts" || name === "docs/tracker" || name.startsWith("docs/tracker/")
        || name === ".omp/agents/tracker-scout.md" || name === ".claude/agents/tracker-scout.md") entries.delete(name);
    }
  }
  if (!testingFor(manifest)) {
    for (const name of entries.keys()) {
      if (/^(?:\.omp|\.claude)\/skills\/review-with-codex(?:\/|$)/.test(name)
        || name === "tools/codex-review-schema.json" || name === "tools/codex-review-harness.ts"
        || name === "tools/constants/codex-review.ts" || (name === "tools/constants" && manifest.diagrams?.mode !== "drawio")) entries.delete(name);
    }
  }
  for (const name of entries.keys()) {
    const standardFile = /^(?:docs\/standards|\.omp\/rules|\.claude\/rules)\/([^/]+)\.md$/.exec(name);
    if (standardFile && standardNames.includes(standardFile[1]!) && !manifest.standards?.some(entry => entry.name === standardFile[1])) entries.delete(name);
    if (name === "docs/standards" && !manifest.standards?.length) entries.delete(name);
    if (/^(?:\.omp|\.claude)\/(?:agents\/frontend-reviewer\.md|skills\/frontend-review(?:\/|$))/.test(name)
      && !specialists.some(entry => entry.agent === "frontend-reviewer")) entries.delete(name);
    if (name === "tools/specialists.ts" && !specialists.length) entries.delete(name);
  }
  async function agentFile(file: string, seen = new Set<string>()): Promise<boolean> {
    if (seen.has(file)) return false;
    seen.add(file);
    const destination = join(target, file);
    if (!contains(target, destination)) return false;
    const current = overlay && await existing(join(overlay, file)) ? undefined : await existing(destination);
    if (current) {
      try {
        const real = realpathWithinRoot(target, destination);
        return real !== null && (await lstat(real)).isFile();
      } catch { return false; }
    }
    const entry = entries.get(file);
    if (entry?.kind === "file") return true;
    if (entry?.kind !== "symlink") return false;
    const resolved = resolve(target, dirname(file), entry.target);
    return contains(target, resolved) && agentFile(relative(target, resolved), seen);
  }
  const preservedAgents = new Set<string>();
  for (const specialist of specialists) for (const port of [".omp", ".claude"]) {
    const file = `${port}/agents/${specialist.agent}.md`;
    if (!(await agentFile(file))) throw new Error(`Invalid or unavailable specialist agent in ${port}: ${specialist.agent}`);
    // An explicit project overlay wins; kit entries never replace project-owned reviewers.
    if (await existing(join(target, file)) && !(overlay && await existing(join(overlay, file)))) {
      entries.delete(file);
      preservedAgents.add(file);
    }
  }
  if (preservedAgents.size) console.log(`Preserving existing specialist agents: ${[...preservedAgents].join(", ")}; upgrade kit-owned twins through the scratch procedure`);
  if (evidenceSelected) {
    const templates: string[] = [];
    let hasDefault = false;
    for (const directory of [".github", "", "docs"]) {
      const base = join(target, directory);
      if (!(await existing(base))?.isDirectory()) continue;
      for (const entry of await readdir(base, { withFileTypes: true })) {
        if (/^pull_request_template(?:\..+)?$/i.test(entry.name) && !entry.isDirectory()) {
          templates.push(join(directory, entry.name));
          hasDefault = true;
        } else if (entry.name.toLowerCase() === "pull_request_template" && entry.isDirectory()) {
          for (const child of await readdir(join(base, entry.name), { withFileTypes: true })) {
            if (child.isFile() || child.isSymbolicLink()) templates.push(join(directory, entry.name, child.name));
          }
        }
      }
    }
    const incomingDefaults = [...entries].filter(([name, entry]) => entry.kind !== "directory"
      && [".github", ".", "docs"].includes(dirname(name))
      && /^pull_request_template(?:\.[^/]+)?$/i.test(basename(name)))
      .map(([name]) => name).sort((a, b) => {
        const aPriority = a.toLowerCase().startsWith(".github/") ? 0 : a.includes("/") ? 2 : 1;
        const bPriority = b.toLowerCase().startsWith(".github/") ? 0 : b.includes("/") ? 2 : 1;
        return aPriority - bPriority || a.localeCompare(b);
      });
    for (const name of incomingDefaults) {
      if (hasDefault || name !== incomingDefaults[0]) entries.delete(name);
    }
    const protectedTemplates = new Set(templates.map(file => file.toLowerCase()));
    for (const name of entries.keys()) {
      if (protectedTemplates.has(name.toLowerCase())) entries.delete(name);
    }
    if (templates.length) {
      console.log(`Preserving project-owned pull request templates: ${templates.join(", ")}. Merge the ## Evidence section from the kit template; --force never replaces project templates.`);
    }
  }
  if (manifest.landing.mode === "direct") {
    for (const name of ["docs/process/stacked-prs.md", ".omp/rules/stacked-prs.md", "tools/stack-base.ts", "tools/constants/stack-base.ts"]) entries.delete(name);
    if (manifest.diagrams?.mode !== "drawio") entries.delete("tools/constants");
  }
  const config = entries.get(".omp/mosaic.json");
  if (config?.kind === "file") {
    let commit = options.kitCommit;
    if (commit === undefined) {
      const revision = spawnSync("git", ["-C", source, "rev-parse", "HEAD"], { encoding: "utf8" });
      commit = revision.status === 0 ? revision.stdout.trim() || "unknown" : "unknown";
    }
    config.content = Buffer.from(`${JSON.stringify({
      defaultBranch: manifest.git.defaultBranch, topology: manifest.topology, tracking: manifest.tracking, landing: manifest.landing, kit: { commit },
      ...(specialists.length ? { review: manifest.review } : {}),
      ...(testingFor(manifest) ? { testing: testingFor(manifest) } : {}),
      ...(manifest.standards?.length ? { standards: manifest.standards } : {}),
      ...(manifest.landing.mode === "pull-request" || manifest.standards?.length || specialists.length ? { repositories: [
        { name: "link-repo", path: ".", remote: manifest.remotes.link },
        ...(manifest.topology === "multi-repo" ? manifest.members.map(member => ({ name: member.name, path: member.path.replace(/\/+$/, ""), remote: manifest.remotes.members[member.name] })) : []),
      ] } : {}),
      ...(manifest.diagrams?.mode === "drawio" ? { diagrams: { mode: "drawio", root: manifest.diagrams.root,
        components: (manifest.topology === "monorepo" ? manifest.components : manifest.members).map(member => member.path.replace(/\/+$/, "")),
        ...(manifest.diagrams.erd ? { erd: manifest.diagrams.erd } : {}) } } : {}),
    }, null, 2)}\n`);
  }
  const targetStat = await existing(target);
  if (targetStat && !targetStat.isDirectory()) throw new Error(`Target must be a real directory: ${target}`);
  const pending: [string, Entry][] = [];
  const conflicts: string[] = [];
  const plannedPaths = new Map<string, string>();
  for (const name of entries.keys()) {
    const key = diagramPathKey(name), previous = plannedPaths.get(key);
    if (previous !== undefined && previous !== name) throw new Error(`Ambiguous planned destinations: ${previous} and ${name}`);
    plannedPaths.set(key, name);
  }
  // Preflight every destination before writing anything; never traverse destination symlinks.
  for (const [name, entry] of entries) {
    const key = diagramPathKey(name);
    if (key === ".mcp.json" || key.startsWith(".mcp.json/")) throw new Error(`Refusing project-owned .mcp.json destination: ${name}`);
    const destination = join(target, name);
    for (let parent = dirname(destination); parent !== target; parent = dirname(parent)) {
      const parentName = relative(target, parent).split(sep).join("/"), plannedName = plannedPaths.get(diagramPathKey(parentName));
      if (plannedName !== undefined && plannedName !== parentName) throw new Error(`Ambiguous planned destination ancestor: ${parentName} aliases ${plannedName}`);
      const planned = plannedName === undefined ? undefined : entries.get(plannedName);
      if (planned && planned.kind !== "directory") throw new Error(`Refusing planned destination ancestor: ${relative(target, parent)} (${planned.kind})`);
      const stat = await existing(parent);
      if (stat && !stat.isDirectory()) throw new Error(`Destination parent is not a real directory: ${parent}`);
    }
    const stat = await existing(destination);
    if (entry.kind === "directory") {
      if (stat && !stat.isDirectory()) throw new Error(`Destination is not a real directory: ${destination}`);
      if (!stat) pending.push([name, entry]);
      continue;
    }
    if (stat?.isDirectory()) throw new Error(`Refusing to replace a directory with a file: ${destination}`);
    if (stat) {
      const same = entry.kind === "symlink" ? stat.isSymbolicLink() && await readlink(destination) === entry.target
        : stat.isFile() && (stat.mode & 0o777) === entry.mode && entry.content.equals(await readFile(destination));
      if (same) continue;
      if (!options.force) conflicts.push(name);
    }
    pending.push([name, entry]);
  }
  if (conflicts.length) throw new Error(`Refusing to overwrite existing files (use --force):\n${conflicts.join("\n")}`);
  await mkdir(target, { recursive: true });
  for (const [name, entry] of pending) {
    const destination = join(target, name);
    if (entry.kind === "directory") await mkdir(destination, { recursive: true, mode: entry.mode });
    else {
      await mkdir(dirname(destination), { recursive: true });
      await rm(destination, { force: true });
      if (entry.kind === "symlink") await symlink(entry.target, destination);
      else {
        await writeFile(destination, entry.content, { mode: entry.mode });
        await chmod(destination, entry.mode);
      }
    }
  }
}

if (import.meta.main) {
  try {
    const { values } = parseArgs({ args: Bun.argv.slice(2), strict: true, options: {
      manifest: { type: "string" }, target: { type: "string" }, kit: { type: "string" }, "kit-commit": { type: "string" },
      overlay: { type: "string" }, force: { type: "boolean" },
    } });
    if (!values.manifest || !values.target) throw new Error("Usage: bun kit/install.ts --manifest <json> --target <dir> [--kit <dir>] [--kit-commit <value>] [--overlay <dir>] [--force]");
    await install({ manifest: values.manifest, target: values.target, kit: values.kit, kitCommit: values["kit-commit"], overlay: values.overlay, force: values.force });
    console.log(`Installed harness into ${resolve(values.target)}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
