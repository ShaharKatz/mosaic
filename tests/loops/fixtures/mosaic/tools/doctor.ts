#!/usr/bin/env bun
// Run from the installed project root, or pass --root <dir>. No packages or model calls.
// Exit 0: all hard checks pass; 1: failed checks; 2: a check cannot evaluate.
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { realpathWithinRoot } from "./root-containment.ts";
import { fileURLToPath, pathToFileURL } from "node:url";

type Outcome = "FAIL" | "WARN" | "CANNOT-EVALUATE";
const counts = { FAIL: 0, WARN: 0, "CANNOT-EVALUATE": 0 };
const reported = new Set<string>();
const maintenanceChecks: Record<string, true> = {
	budgets: true, "read-before-mutate": true, "mosaic-config": true, "guard-config": true,
	"single-home": true, "port-parity": true, symlinks: true, "governed-guard": true, placeholders: true, standards: true,
};
function finding(outcome: Outcome, check: string, file: string, detail: string): void {
	if (maintenanceChecks[check]) detail = `/mosaic-kit: ${detail}`;
	const line = `${outcome} ${check} ${file}: ${detail.replace(/[\r\n]+/g, " ")}`;
	if (reported.has(line)) return;
	reported.add(line);
	counts[outcome]++;
	console.log(line);
}
function finish(): never {
	console.log(`doctor: ${counts.FAIL} fail, ${counts.WARN} warn, ${counts["CANNOT-EVALUATE"]} cannot-evaluate`);
	process.exit(counts["CANNOT-EVALUATE"] ? 2 : counts.FAIL ? 1 : 0);
}
const args = process.argv.slice(2);
if (args.length !== 0 && (args.length !== 2 || args[0] !== "--root" || !args[1] || args[1].startsWith("--"))) {
	finding("CANNOT-EVALUATE", "usage", ".", "usage: bun tools/doctor.ts [--root <dir>]");
	finish();
}
let root = path.resolve(args[1] ?? process.cwd());
try {
	if (!fs.statSync(root).isDirectory()) throw new Error("not a directory");
	root = fs.realpathSync(root);
} catch (error) {
	finding("CANNOT-EVALUATE", "root", root, String(error));
	finish();
}
const texts = new Map<string, string>();
const standardFiles = new Set<string>();
const unsafeBundleFiles = new Set<string>();
function text(check: string, file: string): string | undefined {
	if (unsafeBundleFiles.has(file)) return undefined;
	const cached = texts.get(file);
	if (cached !== undefined) return cached;
	try {
		const content = fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
		texts.set(file, content);
		return content;
	} catch (error) {
		if (standardFiles.has(file) && (error as NodeJS.ErrnoException).code === "ENOENT") {
			finding("FAIL", "standards", file, "installed standard file is missing");
		} else finding("CANNOT-EVALUATE", check, file, `cannot read: ${String(error)}`);
		return undefined;
	}
}
const listings = new Map<string, string[]>();
function files(check: string, dir: string, recursive = true): string[] {
	const key = `${dir}:${recursive}`;
	const cached = listings.get(key);
	if (cached) return cached;
	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true });
	} catch (error) {
		finding("CANNOT-EVALUATE", check, dir, `cannot list: ${String(error)}`);
		return [];
	}
	const result: string[] = [];
	for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
		const file = `${dir}/${entry.name}`;
		// Historical sources are frozen (rule://records Archive class: docs/archived, plans/archived, architecture
		// source records); active links into them still resolve normally.
		if (/(?:^|\/)docs\/(?:(?:plans\/)?archived|architecture\/(?:archived|source))(?:\/|$)/.test(file)) continue;
		if (entry.isDirectory()) {
			if (recursive && entry.name !== ".git" && entry.name !== "node_modules"
				&& !fs.existsSync(path.join(root, file, ".git"))) result.push(...files(check, file));
		} else if (entry.isFile() || entry.isSymbolicLink()) result.push(file);
	}
	listings.set(key, result);
	return result;
}
function body(content: string): string {
	return content.replace(/^---\n(?:[\s\S]*?\n)?---(?:\n|$)/, "");
}
function lines(content: string): string[] {
	return content === "" ? [] : content.replace(/\n$/, "").split("\n");
}
const configPath = ".omp/mosaic.json";
let defaultBranch = "main";
let trackingMode = "none";
type Standard = { name: string; paths: string[]; dir?: string; designSystem?: string };
let standards: Standard[] = [];
let repositories: { name: string; path: string; remote: string }[] = [];
let pullRequestMode = false;
let diagramsOn = false;
let diagramsRoot = "";
if (fs.existsSync(path.join(root, configPath))) {
	const content = text("mosaic-config", configPath);
	if (content !== undefined) {
		try {
			const config = JSON.parse(content);
			if (typeof config.defaultBranch !== "string" || !config.defaultBranch.trim() || /[\r\n\0]/.test(config.defaultBranch)) {
				throw new Error("defaultBranch must be a nonempty single-line string");
			}
			if (config.topology !== "multi-repo" && config.topology !== "monorepo") throw new Error("topology must be multi-repo or monorepo");
			const tracking = config.tracking === undefined ? { mode: "none" } : config.tracking;
			if (!tracking || (tracking.mode !== "none" && tracking.mode !== "local" && tracking.mode !== "mcp")) throw new Error("tracking.mode must be none, local, or mcp");
			if (tracking.mode === "mcp") {
				for (const field of ["server", "team", "queue"]) {
					const value = tracking.mcp?.[field];
					if (field !== "server" && value === undefined) continue;
					if (typeof value !== "string" || !value.trim() || /[\r\n\0]/.test(value)) {
						throw new Error(`tracking.mcp.${field} must be a nonempty single-line string`);
					}
				}
			} else if (tracking.mcp !== undefined) throw new Error("tracking.mcp is only valid in mcp mode");
			const landing = config.landing === undefined ? { mode: "direct" } : config.landing;
			if (!landing || (landing.mode !== "direct" && landing.mode !== "pull-request")) throw new Error("landing.mode must be direct or pull-request");
			if (landing.mode === "pull-request") {
				if (landing.host !== "github") throw new Error("landing.host must be github in pull-request mode");
			} else if (landing.host !== undefined) throw new Error("landing.host is only valid in pull-request mode");
			if (landing.closeOut !== undefined) {
				if (landing.mode !== "pull-request") throw new Error("landing.closeOut is only valid in pull-request mode");
				if (landing.closeOut !== "two-commit") throw new Error("landing.closeOut must be two-commit");
			}
			if (config.standards !== undefined) {
				if (!Array.isArray(config.standards)) throw new Error("standards must be an array");
				const names = new Set<string>();
				for (const standard of config.standards) {
					if (!standard || !["excluded-data", "no-magic-strings", "shared-first", "testing", "pr-evidence"].includes(standard.name)
						|| names.has(standard.name)) throw new Error("standards must have supported, unique names");
					names.add(standard.name);
					if (standard.name === "pr-evidence" && (landing.mode !== "pull-request" || landing.host !== "github")) {
						throw new Error("pr-evidence requires landing.mode: pull-request with landing.host: github");
					}
					if (!Array.isArray(standard.paths) || !standard.paths.length || standard.paths.some((glob: unknown) =>
						typeof glob !== "string" || !glob.trim() || /[\r\n\0\\()]/.test(glob) || glob.includes("\u007b\u007b")
						|| path.isAbsolute(glob) || glob.split("/").some(part => part === "." || part === ".."))) {
						throw new Error("standards paths must be nonempty repository-relative globs without parentheses");
					}
					if (standard.dir !== undefined && (standard.name !== "excluded-data" || typeof standard.dir !== "string"
						|| !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(standard.dir))) throw new Error("dir is only valid as an excluded-data repository-relative directory");
					if (standard.designSystem !== undefined && (standard.name !== "shared-first" || typeof standard.designSystem !== "string"
						|| !standard.designSystem.trim() || /[\r\n\0]/.test(standard.designSystem) || standard.designSystem.includes("\u007b\u007b"))) {
						throw new Error("designSystem is only valid as a shared-first single-line string");
					}
				}
				standards = config.standards;
			}
			const diagrams = config.diagrams;
			if (diagrams !== undefined) {
				if (!diagrams || !["none", "drawio"].includes(diagrams.mode)) throw new Error("diagrams.mode must be none or drawio");
				if (diagrams.mode === "none" && (diagrams.root !== undefined || diagrams.components !== undefined)) throw new Error("diagrams settings require drawio mode");
				if (diagrams.mode === "drawio") {
					// Execute only this doctor's contained sibling; inspected bundle contracts remain data.
					const ownDirectory = path.dirname(fs.realpathSync(fileURLToPath(import.meta.url)));
					let ownConstants: string;
					try {
						const candidate = fileURLToPath(new URL("./constants/diagrams.ts", import.meta.url));
						const contained = realpathWithinRoot(ownDirectory, candidate);
						if (!contained) throw new Error("unavailable");
						const stat = fs.statSync(contained);
						if (!stat.isFile() || !(stat.mode & 0o444)) throw new Error("unavailable");
						fs.accessSync(contained, fs.constants.R_OK); ownConstants = contained;
					} catch { throw new Error("diagrams bundle constants unavailable next to doctor"); }
					const contract = await import(pathToFileURL(ownConstants).href);
					if (!contract.safeDiagramsRoot(diagrams.root) || !Array.isArray(diagrams.components)
						|| diagrams.components.some((component: unknown) => !contract.safeRoot(component))) throw new Error("invalid diagrams root or component bindings");
					diagramsOn = true;
					diagramsRoot = diagrams.root;
					for (const directory of [diagrams.root, ...diagrams.components]) {
						const candidate = path.join(root, directory);
						// Components can be absent until the project checkout is populated; existing paths cannot escape.
						if (fs.existsSync(candidate) && realpathWithinRoot(root, candidate) === null) throw new Error(`diagram path outside repository: ${directory}`);
					}
					for (const file of [...contract.BUNDLE_FILES, `${diagrams.root}/README.md`]) {
						try {
							const candidate = path.join(root, file), contained = realpathWithinRoot(root, candidate);
							if (!contained) throw new Error("unavailable");
							const stat = fs.statSync(contained);
							if (!stat.isFile() || !(stat.mode & 0o444)) throw new Error("unavailable");
							fs.accessSync(contained, fs.constants.R_OK);
							if (file === "tools/constants/diagrams.ts" && !fs.readFileSync(contained).equals(fs.readFileSync(ownConstants))) throw new Error("differs from doctor's trusted sibling");
						} catch {
							unsafeBundleFiles.add(file);
							finding("FAIL", "diagrams", file, "required bundle file missing, unreadable, outside repository, or differs from trusted constants");
						}
					}
					try {
						const mount = JSON.parse(fs.readFileSync(path.join(root, ".mcp.json"), "utf8")).mcpServers?.drawio;
						if (mount?.command !== contract.DRAWIO_MOUNT.command || JSON.stringify(mount?.args) !== JSON.stringify(contract.DRAWIO_MOUNT.args)) throw new Error("missing or mismatched drawio entry");
					} catch {
						finding("FAIL", "diagrams", ".mcp.json", `declare drawio using ${contract.DRAWIO_PACKAGE}; configuration is not running-server proof`);
					}
				}
			}
			pullRequestMode = landing.mode === "pull-request";
			if ((pullRequestMode || standards.length) && (!Array.isArray(config.repositories) || !config.repositories.length)) {
				throw new Error(pullRequestMode ? "repositories must be a nonempty list in pull-request mode" : "repositories must be a nonempty list when standards are selected");
			}
			if (config.repositories !== undefined) {
				if (!Array.isArray(config.repositories)) throw new Error("repositories must be an array");
				const names = new Set<string>();
				const paths = new Set<string>();
				for (const repo of config.repositories) {
					if (!repo || typeof repo.name !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(repo.name) || names.has(repo.name)
						|| typeof repo.path !== "string" || !repo.path || /[\r\n\0\\]/.test(repo.path) || path.isAbsolute(repo.path) || repo.path.split("/").includes("..") || paths.has(repo.path)
						|| typeof repo.remote !== "string" || !repo.remote.trim() || /[\r\n\0]/.test(repo.remote)) throw new Error("invalid repositories metadata");
					names.add(repo.name); paths.add(repo.path);
				}
				if (!config.repositories.length || config.repositories[0].name !== "link-repo" || config.repositories[0].path !== "."
					|| (config.topology === "monorepo" && config.repositories.length !== 1)) throw new Error("repositories do not match topology");
				repositories = config.repositories;
			}
			defaultBranch = config.defaultBranch;
			trackingMode = tracking.mode;
		} catch (error) {
			finding("FAIL", "mosaic-config", configPath, String(error));
		}
	}
}
for (const standard of standards) {
	standardFiles.add(`docs/standards/${standard.name}.md`);
	for (const port of [".omp", ".claude"]) standardFiles.add(`${port}/rules/${standard.name}.md`);
}
if (standards.some(standard => standard.name === "pr-evidence") && typeof Bun.markdown?.render === "function") {
	let effective: string | undefined;
	for (const directory of [".github", "", "docs"]) {
		const base = path.join(root, directory);
		if (!fs.existsSync(base) || !fs.lstatSync(base).isDirectory()) continue;
		const entry = fs.readdirSync(base, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
			.find(entry => !entry.isDirectory() && /^pull_request_template(?:\..+)?$/i.test(entry.name));
		if (entry) { effective = path.join(directory, entry.name); break; }
	}
	let hasEvidence = false;
	if (effective) {
		const content = text("standards", effective);
		if (content !== undefined) {
			Bun.markdown.render(content, { heading: (children, { level }) => {
				if (level === 2 && children.trim() === "Evidence") hasEvidence = true;
				return "";
			} });
		}
	}
	if (!hasEvidence) finding("FAIL", "standards", effective ?? ".github/pull_request_template.md",
		"pr-evidence requires a GitHub-honoured pull request template as the effective default containing an ## Evidence heading; merge the kit Evidence section into that project-owned default");
}
const processNames = [
	"mosaic-core", "map", "plan-triage", "git-flow", "dispatch", "review-loop", "verification",
	"records", "registries", "plan-home", "stack", "human-gates", "writing-for-the-reader",
	"targeted-tests", "records-guard", "model-notes", "intake", "tracker",
];
if (pullRequestMode) processNames.push("final-review", "stacked-prs");
for (const file of ["docs/process/stacked-prs.md", ".omp/rules/stacked-prs.md", "tools/stack-base.ts", "tools/constants/stack-base.ts"]) {
	const present = fs.existsSync(path.join(root, file));
	if (present !== pullRequestMode) finding(pullRequestMode ? "FAIL" : "WARN", "mosaic-config", file, pullRequestMode ? "required in pull-request mode" : "not installed by direct mode; preserve project-owned content");
}
if (diagramsOn) processNames.push("diagrams");
const skillNames = ["mosaic-plan", "mosaic-execute", "mosaic-gap-audit", "mosaic-intake", "mosaic-checkup", "mosaic-kit"];
if (diagramsOn) skillNames.push("diagrams");
const agentPairs = [
	["executor", "executor"], ["plan-adversary", "plan-adversary"], ["registry-scout", "registry-scout"],
	["context-scout", "context-scout"], ["claude-reviewer", "reviewer"], ["gpt-reviewer", "reviewer"],
	["tracker-scout", "tracker-scout"], ["librarian", "librarian"], ["ticket-investigator", "ticket-investigator"],
];
const installedAgentPairs = agentPairs.filter(([name]) => name !== "tracker-scout" || trackingMode === "local");
if (diagramsOn) installedAgentPairs.push(["diagram-keeper", "diagram-keeper"]);
// Structural contracts belong to the kit, not unrelated project harness entries.
const processFiles = processNames.map(name => `docs/process/${name}.md`).sort();
const ompRules = processNames.map(name => `.omp/rules/${name}.md`);
function skillFiles(port: ".omp" | ".claude"): string[] {
	return skillNames.map(name => `${port}/skills/${name}/SKILL.md`);
}
function agentFiles(port: ".omp" | ".claude"): string[] {
	return [...new Set(installedAgentPairs.map(pair => `${port}/agents/${pair[port === ".omp" ? 0 : 1]}.md`))];
}
const harnessFiles = [
	...ompRules, ...([".omp", ".claude"] as const).flatMap(port => [...skillFiles(port), ...agentFiles(port)]),
	".omp/config.yml", ".omp/hooks/pre/guard-main.ts", ".omp/hooks/post/lint-ledgers.ts",
	".claude/settings.json", ".claude/rules/mosaic-core.md", ".claude/rules/records-guard.md",
	".claude/hooks/guard-main.sh", ".claude/hooks/lint-ledgers.sh", ".claude/hooks/records-guard.sh",
];
if (fs.existsSync(path.join(root, ".omp/mosaic.json"))) harnessFiles.push(".omp/mosaic.json");
for (const standard of standards) {
	harnessFiles.push(`.omp/rules/${standard.name}.md`, `.claude/rules/${standard.name}.md`);
}

// Budgets count physical body lines, including blanks, excluding the final newline.
const budgets = new Map<string, number>([["AGENTS.md", 30], ["CLAUDE.md", 30], [".claude/rules/mosaic-core.md", 30]]);
for (const file of processFiles) {
	budgets.set(file, file.endsWith("/mosaic-core.md") ? 30 : file.endsWith("/intake.md") ? 40
		: file.endsWith("/map.md") ? 60 : 80);
}
for (const port of [".omp", ".claude"] as const) {
	for (const file of skillFiles(port)) budgets.set(file, /\/mosaic-(?:intake|checkup)\/SKILL\.md$/.test(file) ? 80 : 120);
	for (const file of agentFiles(port)) budgets.set(file, 60);
}
budgets.set("docs/kit/maintenance.md", 120);
for (const standard of standards) {
	budgets.set(`docs/standards/${standard.name}.md`, 80);
	for (const port of [".omp", ".claude"]) {
		const file = `${port}/rules/${standard.name}.md`;
		if (fs.existsSync(path.join(root, file))) budgets.set(file, 80);
	}
}
for (const [file, max] of budgets) {
	const content = text("budgets", file);
	if (content === undefined) continue;
	const count = lines(body(content)).length;
	if (count > max) finding("FAIL", "budgets", file, `${count} body lines exceeds ${max}`);
}

// A missing reference target is a failure; an unreadable source cannot be evaluated.
function reference(source: string, target: string, label: string, line: number, directoryOK = false): void {
	try {
		const real = realpathWithinRoot(root, path.resolve(root, target));
		if (real === null) {
			finding("FAIL", "references", source, `line ${line}: unresolved ${label} (${target}) (outside repository)`);
			return;
		}
		if (!directoryOK && !fs.statSync(real).isFile()) throw new Error("target is not a file");
	} catch {
		finding("FAIL", "references", source, `line ${line}: unresolved ${label} (${target})`);
	}
}
// omp reads `skill://<name>` from `.omp/skills/` (kit skills) or `.claude/skills/` (single-home project skills).
function skillTarget(name: string): string {
	const kit = `.omp/skills/${name}/SKILL.md`;
	try {
		if (fs.statSync(path.resolve(root, kit)).isFile()) return kit;
	} catch {
		// A missing or inaccessible omp skill falls back to the Claude home.
	}
	return `.claude/skills/${name}/SKILL.md`;
}
const referenceFiles = new Set(["AGENTS.md", ...files("references", "docs"), ...harnessFiles.filter(file => file.startsWith(".omp/"))]);
for (const file of referenceFiles) {
	const content = text("references", file);
	if (content === undefined) continue;
	for (const [index, line] of lines(content).entries()) {
		for (const match of line.matchAll(/\b(rule|skill):\/\/(\w[\w-]*)/g)) {
			const target = match[1] === "rule" ? `.omp/rules/${match[2]}.md` : skillTarget(match[2]!);
			reference(file, target, match[0], index + 1);
		}
	}
}
// Markdown links belong to Markdown documents, not evidence logs, diagrams, or other assets.
if (typeof Bun.markdown?.render !== "function") {
	finding("CANNOT-EVALUATE", "references", ".", "Markdown-link checks require Bun.markdown.render");
} else for (const file of ["AGENTS.md", "CLAUDE.md", ...files("references", "docs").filter(file => file.endsWith(".md"))]) {
	const content = text("references", file);
	if (content === undefined) continue;
	// Line scanning retains candidate locations; the Markdown parser decides which are links.
	// Only bare destinations of plain path characters are swapped for a sentinel: removing a pipe,
	// quote, bracket, equals sign or backtick, or the `--`/`?` before an angle-bracket destination's
	// `>` (a comment or processing-instruction end), could change the parse; others are always checked.
	let prefix = "doctor-link";
	while (content.includes(prefix)) prefix += "-";
	const candidates: { line: number; destination: string; start: number; end: number; sentinel?: string }[] = [];
	let offset = 0;
	for (const [index, line] of lines(content).entries()) {
		for (const match of line.matchAll(/!?\[[^\]\n]*\]\(\s*(?:<([^>\n]+)>|([^\s)]+))(?:\s+["'][^\n]*?["'])?\s*\)/gd)) {
			const destination = match[1] ?? match[2]!;
			if (/^(?:[a-z][\w+.-]*:|\/|#)/i.test(destination)) continue;
			const [start, end] = match.indices![match[1] === undefined ? 2 : 1]!;
			const sentinel = match[1] === undefined && /^[\w./#?%+~-]+$/.test(destination) ? `${prefix}-${candidates.length}` : undefined;
			candidates.push({ line: index + 1, destination, start: offset + start, end: offset + end, sentinel });
		}
		offset += line.length + 1;
	}
	let marked = content;
	for (let index = candidates.length - 1; index >= 0; index--) {
		const candidate = candidates[index]!;
		if (candidate.sentinel) {
			marked = marked.slice(0, candidate.start) + candidate.sentinel + marked.slice(candidate.end);
		}
	}
	const links = new Set<string>();
	Bun.markdown.render(marked, {
		link: (_children, { href }) => { links.add(href); return ""; },
		image: (_children, { src }) => { links.add(src); return ""; },
	});
	for (const candidate of candidates) {
		const { destination, line, sentinel } = candidate;
		if (sentinel && !links.has(sentinel)) continue;
		try {
			const relative = decodeURIComponent(destination.split(/[?#]/, 1)[0]!);
			if (relative) reference(file, path.join(path.dirname(file), relative), destination, line, true);
		} catch {
			finding("FAIL", "references", file, `line ${line}: invalid link ${destination}`);
		}
	}
}

// This lexical guard requires a read step on an earlier line, including for plain prose steps.
const mutation = /\b(?:edit(?:s|ed|ing)?|updat(?:e|es|ed|ing)|promot(?:e|es|ed|ing)|mov(?:e|es|ed|ing)|writ(?:e|es|ing)|append(?:s|ed|ing)?|archiv(?:e|es|ed|ing)|sync(?:s|ed|ing)?)\b/i;
const governed = /\b(?:gaps?|ledgers?|pitfalls?|archives?)\b|\bG-(?:x|\d+)\b/i;
for (const port of [".omp", ".claude"] as const) {
	for (const file of skillFiles(port)) {
		const content = text("read-before-mutate", file);
		if (content === undefined) continue;
		const rows = lines(body(content));
		const first = rows.findIndex(line => mutation.test(line) && governed.test(line));
		if (first < 0) continue;
		const pointer = port === ".omp" ? "rule://records" : "docs/process/records.md";
		if (!rows.slice(0, first).some(line => /\bread\b/i.test(line) && line.includes(pointer))) {
			const offset = lines(content).length - rows.length;
			finding("FAIL", "read-before-mutate", file, `line ${first + offset + 1}: governed mutation precedes a read ${pointer} step`);
		}
	}
}

const ompGuard = text("guard-config", ".omp/hooks/pre/guard-main.ts");
const sharedGuard = text("guard-config", "tools/guard-main.ts");
if (ompGuard !== undefined && sharedGuard !== undefined) {
	const ompConfig = /^const CONFIG_PATH = "([^"]+)";$/m.exec(ompGuard)?.[1];
	const sharedConfig = /^const CONFIG_PATH = "([^"]+)";$/m.exec(sharedGuard)?.[1];
	if (ompConfig !== configPath || sharedConfig !== configPath) {
		finding("FAIL", "guard-config", configPath, "an installed commit guard does not read the configured default branch");
	}
}

const canonicalPhrases = ["targeted tests", `never commit on ${defaultBranch.toLowerCase()}`, "max 2 revise", "disjoint", "never preload", "read a file before editing"];
const homes = new Map(canonicalPhrases.map(phrase => [phrase, new Set<string>()]));
for (const file of ["AGENTS.md", "CLAUDE.md", ...processFiles, ...skillFiles(".omp"), ...agentFiles(".omp")]) {
	const content = text("single-home", file);
	if (content === undefined) continue;
	for (const line of lines(body(content))) {
		if (/rule:\/\/|docs\/process\//i.test(line)) continue;
		for (const phrase of canonicalPhrases) if (line.toLowerCase().includes(phrase)) homes.get(phrase)!.add(file);
	}
}
for (const [phrase, sources] of homes) {
	if (sources.size > 1) finding("WARN", "single-home", ".", `${JSON.stringify(phrase)} appears in ${[...sources].sort().join(", ")}`);
}

// Recorded port idioms; keep replacements narrow so substantive instructions still compare.
const portIdioms: [RegExp, string][] = [
	[/\bvia `task`/g, "via Claude Code subagent dispatch"],
	[/\bsend an irc DM\b/g, "send a follow-up message"],
	[/\birc DMs\b/g, "follow-up messages"],
	[/`claude-reviewer` and `gpt-reviewer`/g, "`reviewer`"],
	[/\bin parallel with identical inputs\b/g, "with these inputs"],
];
function normalized(content: string): string[] {
	let shared = body(content).trim();
	shared = shared.replace(/rule:\/\/(\w[\w-]*)/g, "docs/process/$1.md");
	for (const [pattern, replacement] of portIdioms) shared = shared.replace(pattern, replacement);
	return shared.trim().split("\n");
}
function comparePair(omp: string, claude: string): void {
	const left = text("port-parity", omp);
	const right = text("port-parity", claude);
	if (left === undefined || right === undefined) return;
	const a = normalized(left);
	const b = normalized(right);
	const differences: number[] = [];
	for (let i = 0; i < Math.max(a.length, b.length) && differences.length < 3; i++) {
		if (a[i] !== b[i]) differences.push(i + 1);
	}
	if (differences.length) finding("FAIL", "port-parity", omp, `differs from ${claude} at normalized body lines ${differences.join(", ")}`);
}
for (const [omp, claude] of installedAgentPairs) comparePair(`.omp/agents/${omp}.md`, `.claude/agents/${claude}.md`);
for (const name of skillNames) comparePair(`.omp/skills/${name}/SKILL.md`, `.claude/skills/${name}/SKILL.md`);
const core = text("port-parity", "docs/process/mosaic-core.md");
const coreTwin = text("port-parity", ".claude/rules/mosaic-core.md");
if (core !== undefined && coreTwin !== undefined && body(core) !== body(coreTwin)) {
	finding("FAIL", "port-parity", ".claude/rules/mosaic-core.md", "body differs from docs/process/mosaic-core.md");
}

for (const file of ompRules) {
	try {
		fs.realpathSync(path.join(root, file));
	} catch {
		finding("FAIL", "symlinks", file, "rule target does not resolve");
	}
}
for (const file of processFiles) {
	if (file.endsWith("/model-notes.md")) continue;
	if (text("symlinks", file) === undefined) continue;
	const link = `.omp/rules/${path.basename(file)}`;
	let stat: fs.Stats;
	try {
		stat = fs.lstatSync(path.join(root, link));
	} catch (error) {
		finding("CANNOT-EVALUATE", "symlinks", link, `missing: ${String(error)}`);
		continue;
	}
	try {
		const abs = path.join(root, link);
		if (!stat.isSymbolicLink()) {
			finding("FAIL", "symlinks", link, `must be a symlink to ${file}`);
		} else if (fs.realpathSync(abs) !== fs.realpathSync(path.join(root, file))) {
			finding("FAIL", "symlinks", link, `does not point to ${file}`);
		}
	} catch (error) {
		finding("FAIL", "symlinks", link, `rule target does not resolve: ${String(error)}`);
	}
}

function frontmatter(content: string): string {
	return /^---\n((?:[\s\S]*?\n)?)---(?:\n|$)/.exec(content)?.[1] ?? "";
}
function compareGlobs(expected: Set<string>, actual: Set<string>, file: string): void {
	const missing = [...expected].filter(glob => !actual.has(glob));
	const extra = [...actual].filter(glob => !expected.has(glob));
	if (missing.length || extra.length) finding("FAIL", "governed-guard", file, `missing [${missing.join(", ")}]; extra [${extra.join(", ")}]`);
}
const guard = text("governed-guard", "docs/process/records-guard.md");
const guardTwin = text("governed-guard", ".claude/rules/records-guard.md");
const guardHook = text("governed-guard", ".claude/hooks/records-guard.sh");
if (guard !== undefined && guardTwin !== undefined && guardHook !== undefined) {
	const scope = /^scope:\s*(.*)$/m.exec(frontmatter(guard))?.[1] ?? "";
	const expected = new Set([...scope.matchAll(/tool:(?:edit|write)\(([^)]+)\)/g)].map(match => match[1]!));
	if (expected.size === 0) finding("FAIL", "governed-guard", "docs/process/records-guard.md", "scope contains no edit/write globs");
	const paths = /(?:^|\n)paths:[ \t]*(\[[^\n]*\]|(?:\n[ \t]+-[^\n]*)*)/.exec(frontmatter(guardTwin))?.[1] ?? "";
	const listed = paths.startsWith("[") ? paths.slice(1, -1).split(",") : paths.split("\n").map(line => line.replace(/^\s*-\s*/, ""));
	const twinGlobs = new Set(listed.map(glob => glob.trim().replace(/^(["'])(.*)\1$/, "$2")).filter(Boolean));
	const hookList = /^governed_globs=\([ \t]*\n([\s\S]*?)^\)/m.exec(guardHook)?.[1] ?? "";
	const hookGlobs = new Set([...hookList.matchAll(/["']([^"'\n]+)["']/g)].map(match => match[1]!));
	compareGlobs(expected, twinGlobs, ".claude/rules/records-guard.md");
	compareGlobs(expected, hookGlobs, ".claude/hooks/records-guard.sh");
}

// Canonicalize existing ancestors while retaining the suffix of a not-yet-created data folder.
function physicalPath(destination: string): string {
	let ancestor = destination;
	const suffix: string[] = [];
	while (!fs.existsSync(ancestor)) {
		suffix.unshift(path.basename(ancestor));
		ancestor = path.dirname(ancestor);
	}
	return path.join(fs.realpathSync(ancestor), ...suffix);
}
// Resolve nested member repositories from the nearest existing directory, not the link repo's ignore policy.
const repositoryRoots = new Map<string, string | undefined>();
function repositoryFor(destination: string): string | undefined {
	let ancestor = destination;
	while (!fs.existsSync(ancestor) || !fs.statSync(ancestor).isDirectory()) {
		const parent = path.dirname(ancestor);
		if (parent === ancestor) return undefined;
		ancestor = parent;
	}
	if (!repositoryRoots.has(ancestor)) {
		const git = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: ancestor, encoding: "utf8" });
		repositoryRoots.set(ancestor, git.status === 0 ? fs.realpathSync(git.stdout.trim()) : undefined);
	}
	return repositoryRoots.get(ancestor);
}
const repositoryFiles = new Map<string, string[]>();
function inventory(repo: string, prefix: string): string[] {
	const cached = repositoryFiles.get(prefix);
	if (cached) return cached;
	const git = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: repo, encoding: "utf8" });
	if (git.status !== 0) throw new Error(`git ls-files failed: ${String(git.stderr ?? "").trim() || String(git.error)}`);
	const result = git.stdout.split("\0").filter(Boolean).map(file => path.join(prefix, file))
		.filter(file => file !== ".." && !file.startsWith(`..${path.sep}`) && !path.isAbsolute(file)
			&& fs.existsSync(path.join(root, file)) && !fs.statSync(path.join(root, file)).isDirectory());
	repositoryFiles.set(prefix, result);
	return result;
}
const rootRepository = standards.length ? repositoryFor(root) : undefined;
const inventoryRepositories = new Map<string, string>(rootRepository ? [["", root]] : []);
const unavailableRepositories = new Set<string>();
if (standards.length) for (const member of repositories.filter(repo => repo.path !== ".")) {
	const destination = physicalPath(path.resolve(root, member.path));
	const repo = repositoryFor(destination);
	if (repo !== destination) {
		finding("CANNOT-EVALUATE", "standards", member.path, `cannot evaluate member ${member.name}: no git repository at configured path`);
		unavailableRepositories.add(member.path);
	} else inventoryRepositories.set(member.path, repo);
}
for (const [prefix, repo] of inventoryRepositories) {
	try { inventory(repo, prefix); }
	catch (error) {
		unavailableRepositories.add(prefix || ".");
		finding("CANNOT-EVALUATE", "standards", prefix || ".", `cannot inventory repository: ${String(error)}`);
	}
}

for (const standard of standards) {
	const canonical = `docs/standards/${standard.name}.md`;
	for (const file of [canonical, `.omp/rules/${standard.name}.md`, `.claude/rules/${standard.name}.md`]) {
		if (!fs.existsSync(path.join(root, file))) {
			finding("FAIL", "standards", file, "installed standard file is missing");
			continue;
		}
		const content = text("standards", file);
		if (content === undefined || file === canonical) continue;
		if (!body(content).includes(`Canonical rule: \`${canonical}\``)) finding("FAIL", "standards", file, `must point at ${canonical}`);
		try {
			const header = frontmatter(content);
			let actual: string[];
			if (file.startsWith(".omp/")) {
				const scope = /^scope:[ \t]*(.*)$/m.exec(header)?.[1];
				if (scope === undefined) throw new Error("scope field is required");
				const parsed: unknown = JSON.parse(scope);
				if (!Array.isArray(parsed) || parsed.some(token => typeof token !== "string")) throw new Error("scope must be a string sequence");
				actual = parsed;
			} else {
				const paths = /^paths:[ \t]*(\[[^\n]*\]|(?:\n[ \t]+-[^\n]*)*)[ \t]*$/m.exec(header)?.[1];
				if (paths === undefined) throw new Error("paths field is required");
				actual = paths.startsWith("[") ? JSON.parse(paths)
					: paths.split("\n").filter(line => line.trim()).map(line => JSON.parse(line.replace(/^[ \t]+-[ \t]*/, "")));
			}
			const expected = file.startsWith(".omp/") ? standard.paths.flatMap(glob => [`tool:edit(${glob})`, `tool:write(${glob})`]) : standard.paths;
			if (JSON.stringify(actual) !== JSON.stringify(expected)) finding("FAIL", "standards", file, "scope differs from installed standards metadata");
		} catch {
			finding("FAIL", "standards", file, "cannot parse rendered scope");
		}
	}
	comparePair(`.omp/rules/${standard.name}.md`, `.claude/rules/${standard.name}.md`);
	for (const glob of standard.paths) {
		try {
			const pattern = new Bun.Glob(glob);
			let matched: boolean;
			if (rootRepository) {
				matched = false;
				for (const prefix of inventoryRepositories.keys()) {
					if (repositoryFiles.get(prefix)?.some(file => pattern.match(file))) { matched = true; break; }
				}
			} else {
				matched = [...pattern.scanSync({ cwd: root, dot: true, onlyFiles: true, followSymlinks: false })]
					.some(file => !file.split("/").some(part => part === ".git" || part === "node_modules"));
			}
			if (!matched) {
				if (unavailableRepositories.size) finding("CANNOT-EVALUATE", "standards", canonical,
					`cannot evaluate glob ${glob}: unavailable repositories: ${[...unavailableRepositories].join(", ")}`);
				else finding("FAIL", "standards", canonical, `glob matches no repository file: ${glob}`);
			}
		} catch (error) {
			finding("CANNOT-EVALUATE", "standards", canonical, `cannot evaluate glob ${glob}: ${String(error)}`);
		}
	}
	if (standard.name === "excluded-data") {
		const dir = standard.dir ?? "excluded_data";
		const destination = physicalPath(path.resolve(root, dir));
		const repo = repositoryFor(destination);
		if (!repo) finding("CANNOT-EVALUATE", "excluded-data-ignore", dir, "cannot evaluate ignore policy without a git repository");
		else {
			const folder = `${path.relative(repo, destination)}/`;
			const ignored = spawnSync("git", ["check-ignore", "-q", "--", folder], { cwd: repo, encoding: "utf8" });
			if (ignored.status === 1) finding("FAIL", "excluded-data-ignore", dir, "folder is not ignored; add its one folder ignore line");
			else if (ignored.status !== 0) finding("CANNOT-EVALUATE", "excluded-data-ignore", dir,
				`git check-ignore failed: ${String(ignored.stderr ?? "").trim() || String(ignored.error ?? ignored.signal)}`);
		}
	}
}
// Placeholder ownership is the installed harness's text surface, not the project tree.
// Exclude project sources (JSX), workflows, Makefiles, fonts/images, and nested checkouts.
const placeholderFiles = new Set([
	"AGENTS.md", "CLAUDE.md", "docs/index.md", "docs/gaps.md", "docs/gaps-archive.md",
	"docs/architecture/README.md", "docs/architecture/pitfalls.md", "docs/architecture/open-questions.md", "docs/kit/maintenance.md",
	"docs/plans/README.md", "docs/plans/TEMPLATE.md", "docs/product/README.md",
	...(diagramsOn && diagramsRoot ? [`${diagramsRoot}/README.md`] : []),
	...harnessFiles, ...processFiles,
	...standards.map(standard => `docs/standards/${standard.name}.md`),
	...(trackingMode === "local" ? files("placeholders", "docs/tracker", false).filter(file => file.endsWith(".json")) : []),
	...files("placeholders", "tools").filter(file => file.endsWith(".ts")),
]);
for (const file of placeholderFiles) {
	const content = text("placeholders", file);
	if (content?.includes("\u007b\u007b")) finding("FAIL", "placeholders", file, "unrendered template placeholder");
}
finish();
