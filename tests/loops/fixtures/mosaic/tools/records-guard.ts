// Canonical governed-record matching shared by both pre-edit adapters.
// CLI: project root in argv, Claude JSON on stdin; guidance JSON or silent exit 0.
import { readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, parse, relative, sep } from "node:path";

export const GOVERNED_GLOBS = [
	"docs/gaps.md",
	"docs/gaps/**",
	"docs/gaps-archive.md",
	"**/docs/plans/README.md",
	"docs/architecture/pitfalls.md",
	"**/docs/pitfalls.md",
	"docs/architecture/README.md",
	"docs/architecture/decisions-archive.md",
	".omp/**",
	".claude/**",
	"docs/process/**",
	"docs/surfaces/**",
] as const;
const governed = GOVERNED_GLOBS.map(pattern => new Bun.Glob(pattern));

// Resolve symlinks before subsequent .. segments; missing suffixes are valid Write targets.
function physicalPath(file: string, root: string): string {
	let current = isAbsolute(file) ? parse(file).root : root;
	for (const part of file.split(sep)) {
		if (!part || part === ".") continue;
		if (part === "..") { current = dirname(current); continue; }
		const next = join(current, part);
		try { current = realpathSync(next); }
		catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
			current = next;
		}
	}
	return current;
}

export function recordsGuardContext(projectDir: string, files: readonly string[], runtime: "omp" | "claude", cwd = projectDir): string | undefined {
	const root = realpathSync(projectDir);
	const base = cwd === projectDir ? root : realpathSync(cwd);
	for (const file of files) {
		if (!file) continue;
		const rel = relative(root, physicalPath(file, base));
		if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) continue;
		if (!governed.some(glob => glob.match(rel))) continue;
		return readFileSync(join(root, `.${runtime}/rules/records-guard.md`), "utf8")
			.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "").trim();
	}
	return undefined;
}

if (import.meta.main) {
	try {
		const input = JSON.parse(await Bun.stdin.text());
		const file = input?.tool_input?.file_path;
		if (typeof file === "string") {
			const context = recordsGuardContext(process.argv[2] ?? join(import.meta.dir, ".."), [file], "claude");
			if (context) console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: context } }));
		}
	} catch { /* A reminder must not prevent an edit when input or rule files are unreadable. */ }
}
