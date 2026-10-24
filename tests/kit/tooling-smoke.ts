#!/usr/bin/env bun
import { deepStrictEqual, ok, rejects, strictEqual } from "node:assert";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { install } from "../../kit/install.ts";

const scratch = mkdtempSync(join(tmpdir(), "mosaic-tooling-"));
const target = join(scratch, "target");
function put(file: string, content: string | Uint8Array): void {
	const destination = join(target, file);
	mkdirSync(dirname(destination), { recursive: true });
	writeFileSync(destination, content);
}
function run(command: string[], code: number): string {
	const result = Bun.spawnSync(command, { cwd: target, stdout: "pipe", stderr: "pipe" });
	strictEqual(result.exitCode, code, `${command.join(" ")}\n${result.stdout}\n${result.stderr}`);
	return result.stdout.toString();
}
const bun = process.execPath;
const manifest = join(scratch, "manifest.json");
async function exerciseBraceScope(input: Record<string, unknown>): Promise<void> {
	const fresh = join(scratch, "brace-scope");
	const glob = "src/**/*.{ts,tsx}";
	const tokens = [`tool:edit(${glob})`, `tool:write(${glob})`];
	writeFileSync(manifest, JSON.stringify({ ...input, standards: [{ name: "testing", paths: [glob] }] }));
	await install({ manifest, target: fresh });
	mkdirSync(join(fresh, "src"));
	writeFileSync(join(fresh, "src/a.ts"), "export const example = true;\n");
	writeFileSync(join(fresh, "src/b.tsx"), "export const example = <div />;\n");
	const rulePath = join(fresh, ".omp/rules/testing.md");
	const rule = readFileSync(rulePath, "utf8");
	const expectedScope = `scope: ${JSON.stringify(tokens)}`;
	const failures: string[] = [];
	for (const scenario of ["rendered-sequence", "legacy-comma-string", "drop-write", "missing-scope"]) {
		writeFileSync(rulePath, scenario === "legacy-comma-string" ? rule.replace(/^scope:.*$/m, `scope: ${JSON.stringify(tokens.join(", "))}`)
			: scenario === "drop-write" ? rule.replace(/^scope:.*$/m, `scope: ${JSON.stringify([tokens[0]])}`)
			: scenario === "missing-scope" ? rule.replace(/^scope:.*\n/m, "") : rule);
		const result = Bun.spawnSync([bun, "tools/doctor.ts"], { cwd: fresh, stdout: "pipe", stderr: "pipe" });
		const output = result.stdout.toString();
		const valid = scenario === "rendered-sequence"
			? /^scope:.*$/m.exec(rule)?.[0] === expectedScope && result.exitCode === 0 && output === "doctor: 0 fail, 0 warn, 0 cannot-evaluate\n"
			: result.exitCode === 1 && output.includes("FAIL standards .omp/rules/testing.md:")
				&& output.includes(scenario === "drop-write" ? "scope differs from installed standards metadata" : "cannot parse rendered scope");
		console.log(`${valid ? "PASS" : "FAIL"} brace scope ${scenario}: exit ${result.exitCode}; ${output.trim()}`);
		if (!valid) failures.push(`${scenario}: ${readFileSync(rulePath, "utf8")}\n${output}\n${result.stderr}`);
	}
	deepStrictEqual(failures, []);
}
async function exerciseFinalReviewRegressions(input: Record<string, unknown>): Promise<void> {
	const failures: string[] = [];
	for (const scenario of ["renamed-paths", "unrelated-frontmatter-list", "below-git-root", "unavailable-member-glob", "git-start-failure"]) {
		const base = join(scratch, `final-${scenario}`);
		const fresh = scenario === "below-git-root" ? join(base, "installed") : base;
		const entry = scenario === "git-start-failure" ? { name: "excluded-data", paths: ["src/**"] }
			: { name: "testing", paths: [scenario === "unavailable-member-glob" ? "missing-member/**/*.py" : "src/**"] };
		writeFileSync(manifest, JSON.stringify({ ...input, ...(scenario === "unavailable-member-glob" ? {
			topology: "multi-repo", components: [],
			members: [{ name: "missing-member", path: "missing-member", stack: "Python", testCommand: "pytest", coverageNote: "" }],
			remotes: { link: "https://example.invalid/link.git", members: { "missing-member": "https://example.invalid/member.git" } },
		} : {}), standards: [entry] }));
		await install({ manifest, target: fresh });
		const init = Bun.spawnSync(["git", "init", "-b", "main"], { cwd: base, stdout: "pipe", stderr: "pipe" });
		strictEqual(init.exitCode, 0, init.stderr.toString());
		mkdirSync(join(fresh, "src"));
		writeFileSync(join(fresh, "src/example.ts"), "export const example = true;\n");
		const rulePath = join(fresh, `.claude/rules/${entry.name}.md`);
		const rule = readFileSync(rulePath, "utf8");
		if (scenario === "renamed-paths") writeFileSync(rulePath, rule.replace("paths:", "other:"));
		if (scenario === "unrelated-frontmatter-list") writeFileSync(rulePath, rule.replace("---\n", '---\nother:\n  - "unrelated/**"\n'));
		let command = [bun, "tools/doctor.ts"];
		if (scenario === "git-start-failure") {
			writeFileSync(join(fresh, "unavailable-git.ts"), `
import { mock } from "bun:test";
import * as childProcess from "node:child_process";
const realSpawn = childProcess.spawnSync;
mock.module("node:child_process", () => ({ ...childProcess, spawnSync: (...args) =>
	args[0] === "git" && args[1][0] === "check-ignore"
		? { status: null, stdout: null, stderr: null, error: new Error("spawn git ENOENT") }
		: realSpawn(...args) }));
// The external process boundary must be replaced before loading the CLI.
await import("./tools/doctor.ts");
`);
			command = [bun, "unavailable-git.ts"];
		}
		const result = Bun.spawnSync(command, { cwd: fresh, stdout: "pipe", stderr: "pipe" });
		const output = result.stdout.toString();
		const expectedCode = scenario === "renamed-paths" ? 1 : scenario === "unavailable-member-glob" || scenario === "git-start-failure" ? 2 : 0;
		const valid = result.exitCode === expectedCode && (scenario === "renamed-paths"
			? output.includes(`FAIL standards .claude/rules/${entry.name}.md:`)
			: scenario === "unavailable-member-glob"
				? !output.includes("FAIL ") && output.includes("cannot evaluate glob missing-member/**/*.py") && output.includes("unavailable repositories: missing-member")
				: scenario === "git-start-failure" ? output.includes("CANNOT-EVALUATE excluded-data-ignore") && !result.stderr.toString().includes("TypeError")
					: output === "doctor: 0 fail, 0 warn, 0 cannot-evaluate\n");
		console.log(`${valid ? "PASS" : "FAIL"} final-review regression ${scenario}: exit ${result.exitCode}; ${output.trim()}`);
		if (!valid) failures.push(`${scenario}: expected ${expectedCode}; got ${result.exitCode}\n${output}\n${result.stderr}`);
	}
	deepStrictEqual(failures, []);
}
async function exerciseRepositoryPaths(input: Record<string, unknown>): Promise<void> {
	const fresh = join(scratch, "repository-paths");
	const member = "group/member-a";
	const putFresh = (file: string, content: string) => {
		mkdirSync(dirname(join(fresh, file)), { recursive: true });
		writeFileSync(join(fresh, file), content);
	};
	const git = (cwd: string, ...args: string[]) => {
		const result = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
		strictEqual(result.exitCode, 0, `${result.stdout}\n${result.stderr}`);
	};
	const inputWithMembers = {
		...input, topology: "multi-repo", components: [],
		members: [{ name: "member-a", path: member, stack: "Python", testCommand: "pytest", coverageNote: "" }],
		remotes: { link: "https://example.invalid/link.git", members: { "member-a": "https://example.invalid/member.git" } },
		standards: [{ name: "testing", paths: ["**/*.py"] }],
	};
	writeFileSync(manifest, JSON.stringify(inputWithMembers));
	await install({ manifest, target: fresh });
	git(fresh, "init", "-b", "main");
	putFresh(".gitignore", "/group/\n");
	mkdirSync(join(fresh, member), { recursive: true });
	git(join(fresh, member), "init", "-b", "main");
	putFresh(`${member}/src/example.py`, "example = True\n");
	const metadata = JSON.parse(readFileSync(join(fresh, ".omp/mosaic.json"), "utf8"));
	deepStrictEqual(metadata.repositories, [
		{ name: "link-repo", path: ".", remote: inputWithMembers.remotes.link },
		{ name: "member-a", path: member, remote: inputWithMembers.remotes.members["member-a"] },
	]);
	const wildcard = Bun.spawnSync([bun, "tools/doctor.ts"], { cwd: fresh, stdout: "pipe", stderr: "pipe" });
	strictEqual(wildcard.exitCode, 0, `${wildcard.stdout}\n${wildcard.stderr}`);
	strictEqual(wildcard.stdout.toString(), "doctor: 0 fail, 0 warn, 0 cannot-evaluate\n");
	console.log("PASS repository inventory: **/*.py matches only a nested ignored member's non-ignored file");

	writeFileSync(manifest, JSON.stringify({ ...inputWithMembers, standards: [
		...inputWithMembers.standards, { name: "excluded-data", paths: ["**/*.py"], dir: `${member}/data-link/new/output` },
	] }));
	await install({ manifest, target: fresh, force: true });
	putFresh(`${member}/.gitignore`, "/data/\n");
	mkdirSync(join(fresh, member, "data"));
	symlinkSync("data", join(fresh, member, "data-link"));
	const link = join(scratch, "installed-tree-link");
	symlinkSync(fresh, link);
	const symlinked = Bun.spawnSync([bun, join(fresh, "tools/doctor.ts"), "--root", link],
		{ cwd: scratch, stdout: "pipe", stderr: "pipe" });
	strictEqual(symlinked.exitCode, 0, `${symlinked.stdout}\n${symlinked.stderr}`);
	strictEqual(symlinked.stdout.toString(), "doctor: 0 fail, 0 warn, 0 cannot-evaluate\n");
	ok(!existsSync(join(fresh, member, "data/new/output")), "ignore verification does not create the destination");
	console.log("PASS physical paths: symlinked --root from another cwd, symlinked data ancestor and missing destination suffix; doctor 0/0/0");

	const complete = JSON.parse(readFileSync(join(fresh, ".omp/mosaic.json"), "utf8"));
	putFresh(".omp/mosaic.json", JSON.stringify({ ...complete, repositories: [
		...complete.repositories, { name: "missing-member", path: "group/missing-member", remote: "https://example.invalid/missing.git" },
	] }));
	const missing = Bun.spawnSync([bun, "tools/doctor.ts"], { cwd: fresh, stdout: "pipe", stderr: "pipe" });
	strictEqual(missing.exitCode, 2, `${missing.stdout}\n${missing.stderr}`);
	ok(missing.stdout.toString().includes("CANNOT-EVALUATE standards group/missing-member:"));
	ok(missing.stdout.toString().includes("doctor: 0 fail, 0 warn, 1 cannot-evaluate"));
	console.log("PASS repository availability: a missing member alone is cannot-evaluate; available member scopes still match");
}
async function exerciseStandardRegressions(input: Record<string, unknown>): Promise<void> {
	const failures: string[] = [];
	for (const scenario of ["member-ignore", "member-source-glob", "file-only-ignore", "folder-ignore", "edit-without-write", "missing-file", "ignored-only-glob"]) {
		const fresh = join(scratch, `regression-${scenario}`);
		const entry = scenario.endsWith("ignore")
			? { name: "excluded-data", paths: ["src/**"], dir: scenario === "member-ignore" ? "member-a/excluded_data" : "excluded_data" }
			: { name: "testing", paths: [scenario === "ignored-only-glob" ? ".venv/**/*.ts" : scenario === "member-source-glob" ? "member-a/src/**" : "src/**"] };
		writeFileSync(manifest, JSON.stringify({ ...input, ...(scenario.startsWith("member-") ? {
			topology: "multi-repo", components: [],
			members: [{ name: "member-a", path: "member-a", stack: "TypeScript", testCommand: "bun test", coverageNote: "" }],
			remotes: { link: "https://example.invalid/link.git", members: { "member-a": "https://example.invalid/member.git" } },
		} : {}), standards: [entry] }));
		await install({ manifest, target: fresh });
		const putFresh = (file: string, content: string) => {
			mkdirSync(dirname(join(fresh, file)), { recursive: true });
			writeFileSync(join(fresh, file), content);
		};
		const git = (cwd: string, ...args: string[]) => {
			const result = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe",
				env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" } });
			strictEqual(result.exitCode, 0, `${result.stdout}\n${result.stderr}`);
		};
		git(fresh, "init", "-b", "main");
		putFresh("src/example.ts", "export const example = true;\n");
		if (scenario === "member-ignore" || scenario === "member-source-glob") {
			putFresh(".gitignore", "/member-a/\n");
			mkdirSync(join(fresh, "member-a"));
			git(join(fresh, "member-a"), "init", "-b", "main");
			putFresh("member-a/src/example.ts", "export const example = true;\n");
		}
		if (scenario === "file-only-ignore") putFresh(".gitignore", "/excluded_data/x\n");
		if (scenario === "folder-ignore") putFresh(".gitignore", "/excluded_data/\n");
		if (scenario === "edit-without-write") {
			const rule = `.omp/rules/${entry.name}.md`;
			putFresh(rule, readFileSync(join(fresh, rule), "utf8").replaceAll("tool:write(", "tool:edit("));
		}
		if (scenario === "missing-file") rmSync(join(fresh, `docs/standards/${entry.name}.md`));
		if (scenario === "ignored-only-glob") {
			putFresh(".gitignore", "/.venv/\n/node_modules/\n");
			putFresh(".venv/example.ts", "export const ignored = true;\n");
			putFresh("node_modules/example.ts", "export const ignored = true;\n");
		}
		const result = Bun.spawnSync([bun, "tools/doctor.ts"], { cwd: fresh, stdout: "pipe", stderr: "pipe" });
		const output = result.stdout.toString();
		const expectedCode = scenario === "folder-ignore" || scenario === "member-source-glob" ? 0 : 1;
		const expectedDetail = scenario.endsWith("ignore") && scenario !== "folder-ignore" ? "FAIL excluded-data-ignore"
			: scenario === "edit-without-write" ? "scope differs from installed standards metadata"
			: scenario === "missing-file" ? "installed standard file is missing"
			: scenario === "ignored-only-glob" ? "glob matches no repository file: .venv/**/*.ts"
			: "doctor: 0 fail, 0 warn, 0 cannot-evaluate";
		if (result.exitCode !== expectedCode || !output.includes(expectedDetail)) {
			failures.push(`${scenario}: expected exit ${expectedCode} and ${expectedDetail}; got exit ${result.exitCode}\n${output}\n${result.stderr}`);
		}
		console.log(`${result.exitCode === expectedCode && output.includes(expectedDetail) ? "PASS" : "FAIL"} standard regression ${scenario}: exit ${result.exitCode}; ${output.trim()}`);
		if (scenario === "member-ignore") {
			putFresh("member-a/.gitignore", "/excluded_data/\n");
			const ignored = Bun.spawnSync([bun, "tools/doctor.ts"], { cwd: fresh, stdout: "pipe", stderr: "pipe" });
			strictEqual(ignored.exitCode, 0, `${ignored.stdout}\n${ignored.stderr}`);
		}
	}
	deepStrictEqual(failures, []);
}
async function exerciseStandards(input: Record<string, unknown>): Promise<void> {
	const names = ["excluded-data", "no-magic-strings", "shared-first", "testing"];
	const snapshot = (root: string): Record<string, string> => {
		const result: Record<string, string> = {};
		for (const file of new Bun.Glob("**/*").scanSync({ cwd: root, dot: true, onlyFiles: false })) {
			const stat = lstatSync(join(root, file));
			result[file] = stat.isSymbolicLink() ? `link:${readlinkSync(join(root, file))}`
				: stat.isDirectory() ? `directory:${stat.mode & 0o777}` : `${stat.mode & 0o777}:${readFileSync(join(root, file)).toString("base64")}`;
		}
		return result;
	};
	let expected: Record<string, string> | undefined;
	for (const standards of [undefined, []]) {
		const fresh = join(scratch, standards ? "standards-empty" : "standards-omitted");
		writeFileSync(manifest, JSON.stringify({ ...input, standards }));
		await install({ manifest, target: fresh, kitCommit: "compatibility" });
		if (expected) deepStrictEqual(snapshot(fresh), expected);
		else expected = snapshot(fresh);
		ok(!existsSync(join(fresh, "docs/standards")), "no standards directory");
		for (const name of names) for (const port of [".omp", ".claude"]) {
			ok(!existsSync(join(fresh, `${port}/rules/${name}.md`)), "no scoped standard rule");
		}
		ok(!readFileSync(join(fresh, "docs/index.md"), "utf8").includes("## Standards\n"));
		ok(!Object.hasOwn(JSON.parse(readFileSync(join(fresh, ".omp/mosaic.json"), "utf8")), "repositories"));
		ok(!Object.hasOwn(JSON.parse(readFileSync(join(fresh, ".omp/mosaic.json"), "utf8")), "standards"));
		const doctor = Bun.spawnSync([bun, "tools/doctor.ts"], { cwd: fresh, stdout: "pipe", stderr: "pipe" });
		strictEqual(doctor.exitCode, 0, `${doctor.stdout}\n${doctor.stderr}`);
		strictEqual(doctor.stdout.toString(), "doctor: 0 fail, 0 warn, 0 cannot-evaluate\n");
	}
	console.log("PASS standards omitted/empty: identical bytes, modes, paths, symlinks and metadata; no standard files/navigation/config; doctor 0/0/0");
	await exerciseRepositoryPaths(input);
	await exerciseStandardRegressions(input);

	for (const name of names) {
		const fresh = join(scratch, `standard-${name}`);
		const paths = ["src/**/*.ts", "tests/**/*.ts"];
		const entry = { name, paths, ...(name === "excluded-data" ? { dir: "private_data" } : {}),
			...(name === "shared-first" ? { designSystem: "packages/ui" } : {}) };
		writeFileSync(manifest, JSON.stringify({ ...input, standards: [entry] }));
		await install({ manifest, target: fresh });
		const putFresh = (file: string, content: string) => {
			mkdirSync(dirname(join(fresh, file)), { recursive: true });
			writeFileSync(join(fresh, file), content);
		};
		putFresh("src/example.ts", "export const value = 1;\n");
		putFresh("tests/example.test.ts", "export const example = true;\n");
		ok(!existsSync(join(fresh, ".gitignore")), "mechanical installer must not edit ignore policy");
		const invoke = (command: string[], code: number) => {
			const result = Bun.spawnSync(command, { cwd: fresh, stdout: "pipe", stderr: "pipe",
				env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" } });
			strictEqual(result.exitCode, code, `${command.join(" ")}\n${result.stdout}\n${result.stderr}`);
			return result.stdout.toString();
		};
		const doctor = (code: number) => invoke([bun, "tools/doctor.ts"], code);
		if (name === "excluded-data") {
			const noGit = doctor(2);
			ok(noGit.includes("doctor: 0 fail, 0 warn, 1 cannot-evaluate"), noGit);
			ok(noGit.includes("CANNOT-EVALUATE excluded-data-ignore private_data:"), noGit);
			invoke(["git", "init", "-b", "main"], 0);
			ok(doctor(1).includes("FAIL excluded-data-ignore private_data:"), "unignored folder detected");
			putFresh(".gitignore", "/private_data/\n");
			invoke(["git", "check-ignore", "-q", "private_data/x"], 0);
		}
		strictEqual(doctor(0), "doctor: 0 fail, 0 warn, 0 cannot-evaluate\n");
		const canonical = `docs/standards/${name}.md`;
		const content = readFileSync(join(fresh, canonical), "utf8");
		const index = readFileSync(join(fresh, "docs/index.md"), "utf8");
		ok(index.includes("## Standards\n") && index.includes(`[${name}](standards/${name}.md)`));
		for (const port of [".omp", ".claude"]) {
			const rule = readFileSync(join(fresh, `${port}/rules/${name}.md`), "utf8");
			for (const glob of paths) ok(rule.includes(glob), rule);
			ok(rule.includes(`Canonical rule: \`${canonical}\``));
			ok(!rule.includes("{{"));
		}
		ok(!content.includes("{{"));
		for (const other of names.filter(other => other !== name)) {
			for (const file of [`docs/standards/${other}.md`, `.omp/rules/${other}.md`, `.claude/rules/${other}.md`]) ok(!existsSync(join(fresh, file)), file);
			ok(!index.includes(`standards/${other}.md`));
		}
		if (name === "excluded-data") ok(content.includes("`private_data/`"));
		if (name === "shared-first") ok(content.includes("packages/ui"));
		if (name === "testing") ok(content.endsWith("## Surfaces\n") && content.includes("rule://stack"));
		const metadata = JSON.parse(readFileSync(join(fresh, ".omp/mosaic.json"), "utf8"));
		deepStrictEqual(metadata.standards, [entry]);
		putFresh(".omp/mosaic.json", JSON.stringify({ ...metadata, standards: [{ ...entry, paths: [...paths, "missing/**/*.ts"] }] }));
		ok(doctor(1).includes("glob matches no repository file: missing/**/*.ts"));
		putFresh(".omp/mosaic.json", JSON.stringify(metadata));
		const rulePath = `.claude/rules/${name}.md`;
		const rule = readFileSync(join(fresh, rulePath), "utf8");
		putFresh(rulePath, rule.replace(`Canonical rule: \`${canonical}\``, "Canonical rule: elsewhere"));
		ok(doctor(1).includes(`must point at ${canonical}`));
		putFresh(rulePath, rule);
		for (const file of [canonical, `.omp/rules/${name}.md`, rulePath]) {
			const original = readFileSync(join(fresh, file), "utf8");
			rmSync(join(fresh, file));
			ok(doctor(1).includes(`FAIL standards ${file}:`), `missing ${file} detected as definite failure`);
			putFresh(file, original);
		}
		strictEqual(doctor(0), "doctor: 0 fail, 0 warn, 0 cannot-evaluate\n");
		console.log(`PASS standard ${name}: selected files/scopes/index, no residue, doctor 0/0/0; stale glob, missing files and wrong pointer rejected`);
	}
	for (const standards of [
		null, {}, ["testing"], [{ name: "unknown", paths: ["src/**"] }],
		[{ name: "testing", paths: [] }], [{ name: "testing", paths: "src/**" }],
		[{ name: "testing", paths: [""] }], [{ name: "testing", paths: ["../escape/**"] }],
		[{ name: "testing", paths: ["/absolute/**"] }], [{ name: "testing", paths: ["src/\n**"] }],
		[{ name: "testing", paths: ["src/**"], dir: "data" }],
		[{ name: "excluded-data", paths: ["src/**"], designSystem: "ui" }],
		[{ name: "excluded-data", paths: ["src/**"], dir: "../data" }],
		[{ name: "shared-first", paths: ["src/**"], designSystem: "" }],
		[{ name: "testing", paths: ["src/**"] }, { name: "testing", paths: ["tests/**"] }],
	]) {
		writeFileSync(manifest, JSON.stringify({ ...input, standards }));
		await rejects(install({ manifest, target: join(scratch, "invalid-standard") }), /standards/);
		ok(!existsSync(join(scratch, "invalid-standard")), "invalid manifest rejected before writes");
	}
	console.log("PASS standards invalid manifests: list, names, duplicates, paths and standard-specific fields rejected before writes");
	const combined = join(scratch, "standards-combined");
	writeFileSync(manifest, JSON.stringify({ ...input, standards: names.map(name => ({ name, paths: ["src/**/*.ts", "tests/**/*.ts"] })) }));
	const cli = Bun.spawnSync([bun, join(import.meta.dir, "../../kit/install.ts"), "--manifest", manifest, "--target", combined],
		{ stdout: "pipe", stderr: "pipe" });
	strictEqual(cli.exitCode, 0, `${cli.stdout}\n${cli.stderr}`);
	for (const file of ["src/example.ts", "tests/example.test.ts"]) {
		mkdirSync(dirname(join(combined, file)), { recursive: true });
		writeFileSync(join(combined, file), "export const example = true;\n");
	}
	const combinedGit = Bun.spawnSync(["git", "init", "-b", "main"], { cwd: combined, stdout: "pipe", stderr: "pipe" });
	strictEqual(combinedGit.exitCode, 0, combinedGit.stderr.toString());
	writeFileSync(join(combined, ".gitignore"), "/excluded_data/\n");
	const combinedDoctor = Bun.spawnSync([bun, "tools/doctor.ts"], { cwd: combined, stdout: "pipe", stderr: "pipe" });
	strictEqual(combinedDoctor.exitCode, 0, `${combinedDoctor.stdout}\n${combinedDoctor.stderr}`);
	strictEqual(combinedDoctor.stdout.toString(), "doctor: 0 fail, 0 warn, 0 cannot-evaluate\n");
	ok(readFileSync(join(combined, "docs/standards/excluded-data.md"), "utf8").includes("`excluded_data/`"));
	ok(readFileSync(join(combined, "docs/standards/shared-first.md"), "utf8").includes("the project's design system or shared component library, if any"));
	console.log("PASS standards CLI smoke: all four together, default data folder/generic design-system text, doctor 0/0/0");
	writeFileSync(manifest, JSON.stringify(input));
}
function exerciseCloseOut(flow: string): void {
	const repo = join(scratch, "close-out-history");
	mkdirSync(repo);
	const env = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_AUTHOR_NAME: "Smoke",
		GIT_AUTHOR_EMAIL: "smoke@example.invalid", GIT_COMMITTER_NAME: "Smoke", GIT_COMMITTER_EMAIL: "smoke@example.invalid",
		GIT_EDITOR: ":", GIT_SEQUENCE_EDITOR: ":" };
	const git = (...args: string[]): string => {
		const result = Bun.spawnSync(["git", ...args], { cwd: repo, stdout: "pipe", stderr: "pipe", env });
		strictEqual(result.exitCode, 0, `${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
		return result.stdout.toString().trim();
	};
	git("init", "-b", "main");
	git("config", "commit.gpgsign", "false");
	writeFileSync(join(repo, "code.txt"), "base\n");
	git("add", "."); git("commit", "-m", "base");
	const base = git("rev-parse", "HEAD");
	git("update-ref", "refs/remotes/origin/main", base);
	git("checkout", "-b", "task");
	writeFileSync(join(repo, "code.txt"), "implementation\n");
	git("add", "."); git("commit", "-m", "0001-T1: implement");
	writeFileSync(join(repo, "extra.txt"), "task two\n");
	git("add", "."); git("commit", "-m", "0001-T2: finish");
	git("reset", "--soft", base);
	git("commit", "-m", "0001: plan subject", "-m", "0001-T1: implement\n0001-T2: finish");
	writeFileSync(join(repo, "terminal.md"), "done; pr://1\n");
	git("add", "."); git("commit", "-m", "0001: close-out");
	git("checkout", "main");
	git("checkout", "-b", "upstream-topic");
	writeFileSync(join(repo, "upstream.txt"), "upstream topic\n");
	git("add", "."); git("commit", "-m", "upstream topic");
	git("checkout", "main");
	writeFileSync(join(repo, "mainline.txt"), "mainline\n");
	git("add", "."); git("commit", "-m", "mainline");
	git("merge", "--no-ff", "upstream-topic", "-m", "upstream merge");
	git("update-ref", "refs/remotes/origin/main", "HEAD");
	git("checkout", "task"); git("rebase", "origin/main");
	const code = git("rev-parse", "HEAD^");
	writeFileSync(join(repo, "code.txt"), "implementation corrected\n");
	git("add", "."); git("commit", "--fixup", code);
	const command = flow.match(/`(GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash [^`]+)`/)?.[1];
	ok(command, "rendered autosquash command");
	const rendered = command.replace("<code commit>", code).replace("<base sha>", base);
	const rebased = Bun.spawnSync(["bash", "-c", rendered], { cwd: repo, stdout: "pipe", stderr: "pipe", env });
	strictEqual(rebased.exitCode, 0, `${rebased.stdout}\n${rebased.stderr}`);
	const commits = git("rev-list", "--reverse", "origin/main..HEAD").split("\n");
	strictEqual(commits.length, 2, `autosquash must not replay default-branch merge history: ${git("log", "--oneline", "origin/main..HEAD")}`);
	deepStrictEqual(commits.map(commit => git("show", "-s", "--format=%s", commit)), ["0001: plan subject", "0001: close-out"]);
	strictEqual(git("show", "--format=", "--name-only", commits[1]), "terminal.md");
	strictEqual(git("show", `${commits[0]}:code.txt`), "implementation corrected");
	ok(git("show", "-s", "--format=%b", commits[0]).includes("0001-T1: implement\n0001-T2: finish"));
	console.log("PASS executable close-out: upstream merge, rebase, rendered autosquash; two commits, corrected code first, terminal-only close-out last");
}
try {
	writeFileSync(manifest, JSON.stringify({
		project: { name: "Monorepo", summary: "Monorepo contains an API and worker." },
		topology: "monorepo", git: { defaultBranch: "master" },
		tracking: { mode: "local" },
		remotes: { link: "https://example.invalid/monorepo.git" }, members: [],
		components: ["apps/api", "packages/worker"].map(component => ({
			name: component.split("/")[1], path: component, stack: "TypeScript", testCommand: "bun test", coverageNote: "",
		})),
	}));
	await install({ manifest, target });
	const input = JSON.parse(readFileSync(manifest, "utf8"));
	await exerciseBraceScope(input);
	await exerciseFinalReviewRegressions(input);
	await exerciseStandards(input);
	const markdown = new Map<string, Buffer>();
	for await (const file of new Bun.Glob("**/*.md").scan({ cwd: target, dot: true, onlyFiles: true })) {
		markdown.set(file, readFileSync(join(target, file)));
	}
	deepStrictEqual(JSON.parse(readFileSync(join(target, ".omp/mosaic.json"), "utf8")).landing, { mode: "direct" });
	writeFileSync(manifest, JSON.stringify({ ...input, landing: { mode: "direct" } }));
	await install({ manifest, target });
	for (const [file, bytes] of markdown) deepStrictEqual(readFileSync(join(target, file)), bytes, file);
	const directFlow = readFileSync(join(target, "docs/process/git-flow.md"), "utf8");
	ok(directFlow.includes("git merge --ff-only task/NNNN-<slug>"));
	ok(directFlow.includes("No PRs; review is in-session"));
	console.log("PASS landing direct: omitted/explicit metadata and every Markdown byte agree; legacy ff-only flow retained");

	for (const tracking of [{ mode: "none" }, { mode: "local" }, { mode: "mcp", mcp: { server: "issues" } }]) {
		for (const topology of ["monorepo", "multi-repo"]) {
			const prTarget = join(scratch, `pr-${tracking.mode}-${topology}`);
			writeFileSync(manifest, JSON.stringify({
				...input, tracking, topology, landing: { mode: "pull-request", host: "github" },
				remotes: { ...input.remotes, members: { api: "https://github.com/example/api.git" } },
				members: topology === "multi-repo" ? [{ ...input.components[0], name: "api" }] : [],
			}));
			await install({ manifest, target: prTarget });
			const flow = readFileSync(join(prTarget, "docs/process/git-flow.md"), "utf8");
			for (const passage of ["git rebase origin/master", "git push -u origin <branch>", "git push --force-with-lease origin <branch>",
				'gh pr create --base master --head <branch> --title "<title>" --body-file <file>',
				"every check", "every comment", "human merges", "merge method", "delete", "pr://<number>",
				"gh pr view <number> --json state,mergeCommit", "git merge-base --is-ancestor"]) ok(flow.includes(passage), passage);
			ok(!flow.includes("No PRs") && !flow.includes("--ff-only"), flow);
			ok(!flow.includes("reset --soft"), "unconfigured pull-request retains unsquashed layout");
			strictEqual(flow.includes("tracker://<key>"), tracking.mode !== "none");
			strictEqual(flow.includes("one pull request per targeted repo"), topology === "multi-repo");
			const planHome = readFileSync(join(prTarget, "docs/process/plan-home.md"), "utf8");
			ok(planHome.includes("gh pr list --head docs/NNNN-reserve --state all"), "later sessions can recover the reservation pull request");
			strictEqual(planHome.includes("title, body and commit subjects name the plan number, never the tracker item key"), tracking.mode === "mcp");
			strictEqual(planHome.includes("Do not reuse a ledger row title containing the key as the pull request title"), tracking.mode === "mcp");
			strictEqual(planHome.includes("can move the item to done when the reservation merges, before any work has landed"), tracking.mode === "mcp");
			for (const file of ["docs/process/verification.md", "docs/process/tracker.md", "docs/process/plan-home.md", "docs/product/README.md",
				".omp/skills/mosaic-gap-audit/SKILL.md", ".claude/skills/mosaic-gap-audit/SKILL.md",
				".omp/skills/mosaic-execute/SKILL.md", ".claude/skills/mosaic-execute/SKILL.md"]) {
				const text = readFileSync(join(prTarget, file), "utf8");
				ok(text.includes(file.startsWith(".claude/") ? "process/git-flow.md" : "rule://git-flow"), file);
				ok(!text.includes("<landed hash>") && !text.includes("landed hash,") && !text.includes("(<hash>)"), file);
				ok(!text.includes("--ff-only") && !text.includes("its hash exists"), file);
			}
			ok(readFileSync(join(prTarget, "docs/plans/README.md"), "utf8").includes("| Branch | Landed |"));
			for await (const file of new Bun.Glob("**/*.md").scan({ cwd: prTarget, dot: true, onlyFiles: true })) {
				ok(!readFileSync(join(prTarget, file), "utf8").includes("{{"), file);
			}
			const doctor = Bun.spawnSync([bun, "tools/doctor.ts"], { cwd: prTarget, stdout: "pipe", stderr: "pipe" });
			strictEqual(doctor.exitCode, 0, `${doctor.stdout}\n${doctor.stderr}`);
			ok(doctor.stdout.toString().includes("doctor: 0 fail, 0 warn, 0 cannot-evaluate"));
			console.log(`PASS landing pull-request: ${tracking.mode}/${topology}, complete flow, locators, no residue, doctor 0/0/0`);
		}
	}
	for (const tracking of [{ mode: "none" }, { mode: "local" }, { mode: "mcp", mcp: { server: "issues" } }]) {
		for (const topology of ["monorepo", "multi-repo"]) {
			const closeTarget = join(scratch, `close-${tracking.mode}-${topology}`);
			const landing = { mode: "pull-request", host: "github", closeOut: "two-commit" };
			writeFileSync(manifest, JSON.stringify({
				...input, tracking, topology, landing,
				remotes: { ...input.remotes, members: { api: "https://github.com/example/api.git" } },
				members: topology === "multi-repo" ? [{ ...input.components[0], name: "api" }] : [],
			}));
			await install({ manifest, target: closeTarget });
			deepStrictEqual(JSON.parse(readFileSync(join(closeTarget, ".omp/mosaic.json"), "utf8")).landing, landing);
			const flow = readFileSync(join(closeTarget, "docs/process/git-flow.md"), "utf8");
			if (tracking.mode === "none" && topology === "monorepo") exerciseCloseOut(flow);
			for (const passage of ["git reset --soft <base sha> && git commit", "plan's subject", "task subjects",
				"git commit --fixup <code commit>", "GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash <code commit>^",
				"Keep the code commit first and any close-out commit last, with no other commits", "no follow-up commit records landing"]) ok(flow.includes(passage), passage);
			strictEqual(flow.includes("owns no terminal documentation keeps only its code commit"), topology === "multi-repo");
			strictEqual(flow.includes("Member-homed plans keep R4's link-repo ledger sync"), topology === "multi-repo");
			if (topology === "multi-repo") ok(flow.includes("open it before the link repo's close-out, which records every targeted repo's locator"));
			const map = readFileSync(join(closeTarget, "docs/process/map.md"), "utf8");
			ok(map.includes("Squashed code commit, then one close-out commit"));
			for (const runtime of [".omp", ".claude"]) {
				const execute = readFileSync(join(closeTarget, runtime, "skills/mosaic-execute/SKILL.md"), "utf8");
				ok(execute.includes("ONE code commit (plan subject, task subjects in its body)"));
				ok(execute.includes("hold these terminal changes for the ONE close-out commit after step 11"));
				ok(execute.includes("Commit all repo-owned terminal documentation together as ONE close-out commit"));
				ok(execute.indexOf("Run ledger lint on every changed governed record and resolve failures before committing.") < execute.indexOf("Commit all repo-owned terminal documentation together"));
				strictEqual(execute.includes("Member-homed plans keep R4's link-repo ledger sync"), topology === "multi-repo");
				ok(!execute.includes("Commit the terminal plan and ledger changes."));
				ok(execute.indexOf("ONE code commit") < execute.indexOf("**Archive on sign-off:**"));
			}
			for await (const file of new Bun.Glob("**/*.md").scan({ cwd: closeTarget, dot: true, onlyFiles: true })) {
				ok(!readFileSync(join(closeTarget, file), "utf8").includes("{{"), file);
			}
			const doctor = Bun.spawnSync([bun, "tools/doctor.ts"], { cwd: closeTarget, stdout: "pipe", stderr: "pipe" });
			strictEqual(doctor.exitCode, 0, `${doctor.stdout}\n${doctor.stderr}`);
			ok(doctor.stdout.toString().includes("doctor: 0 fail, 0 warn, 0 cannot-evaluate"));
			console.log(`PASS close-out two-commit: ${tracking.mode}/${topology}, code/terminal split, locator, fixups, doctor 0/0/0`);
		}
	}
	const runtimeConfig = JSON.parse(readFileSync(join(target, ".omp/mosaic.json"), "utf8"));
	for (const [landing, diagnostic] of [
		[{ mode: "pull-request" }, "landing.host must be github in pull-request mode"],
		[{ mode: "unknown" }, "landing.mode must be direct or pull-request"],
		[{ mode: "direct", host: "github" }, "landing.host is only valid in pull-request mode"],
		[{ mode: "pull-request", host: "other" }, "landing.host must be github in pull-request mode"],
		[{ mode: "direct", closeOut: "two-commit" }, "landing.closeOut is only valid in pull-request mode"],
		[{ mode: "pull-request", host: "github", closeOut: "unknown" }, "landing.closeOut must be two-commit"],
		[{ mode: "pull-request", host: "github", closeOut: null }, "landing.closeOut must be two-commit"],
	] as const) {
		writeFileSync(manifest, JSON.stringify({ ...input, landing }));
		await rejects(install({ manifest, target: join(scratch, "invalid-landing") }),
			(error: Error) => error.message.includes(diagnostic));
		put(".omp/mosaic.json", JSON.stringify({ ...runtimeConfig, landing }));
		ok(run([bun, "tools/doctor.ts"], 1).includes(diagnostic), diagnostic);
	}
	put(".omp/mosaic.json", JSON.stringify({ ...runtimeConfig, landing: undefined }));
	run([bun, "tools/doctor.ts"], 0);
	put(".omp/mosaic.json", JSON.stringify({ ...runtimeConfig, landing: { mode: "pull-request", host: "github" } }));
	ok(run([bun, "tools/doctor.ts"], 0).includes("doctor: 0 fail, 0 warn, 0 cannot-evaluate"));
	console.log("PASS close-out compatibility: pull-request metadata without closeOut accepted");
	put(".omp/mosaic.json", `${JSON.stringify(runtimeConfig, null, 2)}\n`);
	writeFileSync(manifest, JSON.stringify(input));
	console.log("PASS landing invalid manifests: missing/unsupported host, unknown mode, direct host rejected");
	run([bun, "tools/doctor.ts"], 0);
	deepStrictEqual(JSON.parse(run([bun, "tools/checkup.ts", "--json"], 0)), { findings: [], cannotEvaluate: [] });
	console.log("PASS fresh two-component monorepo: doctor and checkup");

	ok(!existsSync(join(target, ".git")), "gate smoke uses an installed root without git history");
	put("docs/plans/archived/0999-gate.md", "# Archived gate probe\n");
	const orphanOnly = JSON.parse(run([bun, "tools/checkup.ts", "--json"], 1));
	deepStrictEqual(orphanOnly.cannotEvaluate, []);
	deepStrictEqual(orphanOnly.findings.map((finding: { class: string }) => finding.class), ["orphan-plan"]);
	const gateText = run([bun, "tools/checkup.ts", "--gate", "--root", target], 0);
	ok(gateText.includes("orphan-plan") && gateText.includes("informational; gate-exempt"), gateText);
	ok(gateText.includes("checkup: PASS — 1 findings, 0 cannot-evaluate, 1 gate-exempt\n"), gateText);
	deepStrictEqual(JSON.parse(run([bun, "tools/checkup.ts", "--gate", "--json"], 0)), orphanOnly);
	console.log("PASS checkup gate: orphan-only plain exit 1, gate exit 0, unchanged JSON; no git repository/history");

	put("docs/gate.md", "G-999 has no gap entry.\n");
	const gateReference = JSON.parse(run([bun, "tools/checkup.ts", "--json", "--gate"], 1));
	deepStrictEqual(gateReference.cannotEvaluate, []);
	ok(gateReference.findings.some((finding: { class: string; fix: string }) => finding.class === "dangling-reference" && finding.fix === "human"));
	ok(gateReference.findings.some((finding: { class: string }) => finding.class === "orphan-plan"));
	rmSync(join(target, "docs/gate.md"));
	put("docs/plans/0998-gate.md", "---\nstatus: draft\n---\n# Incomplete numbered plan\n");
	const gateLint = JSON.parse(run([bun, "tools/checkup.ts", "--gate", "--json"], 1));
	deepStrictEqual(gateLint.cannotEvaluate, []);
	ok(gateLint.findings.some((finding: { class: string; fix: string }) => finding.class === "lint" && finding.fix === "human"));
	rmSync(join(target, "docs/plans/0998-gate.md"));
	console.log("PASS checkup gate: human-fix dangling-reference and lint findings still fail, even with exempt orphans");

	const missingRoot = join(scratch, "missing-root");
	const incomplete = JSON.parse(run([bun, "tools/checkup.ts", "--root", missingRoot, "--json"], 2));
	ok(incomplete.cannotEvaluate.some((item: { detail: string }) => item.detail.includes("cannot enumerate root")));
	deepStrictEqual(JSON.parse(run([bun, "tools/checkup.ts", "--gate", "--root", missingRoot, "--json"], 2)), incomplete);
	symlinkSync(join(scratch, "missing-input"), join(target, "docs/gate-unreadable.md"));
	const gateIncomplete = JSON.parse(run([bun, "tools/checkup.ts", "--gate", "--json"], 2));
	ok(gateIncomplete.cannotEvaluate.some((item: { path: string }) => item.path === "docs/gate-unreadable.md"));
	ok(gateIncomplete.findings.some((finding: { class: string }) => finding.class === "orphan-plan"));
	rmSync(join(target, "docs/gate-unreadable.md"));
	rmSync(join(target, "docs/plans/archived/0999-gate.md"));
	console.log("PASS checkup gate: bad root and unreadable input exit 2; incomplete JSON shape unchanged");
	for (const [name, content, code, line] of [
		["inline code", "`[example](missing.md)`\n", 0, 0],
		["fenced code", "```\n[example](missing.md)\n```\n", 0, 0],
		["indented code", "    [example](missing.md)\n", 0, 0],
		["lone backtick", "An unmatched ` in this paragraph.\n\n[b](missing.md)\n", 1, 3],
		["backtick in title", '[b](missing.md "a ` title")\n', 1, 1],
		["GFM table pipe", "| Example | Continuation | Link |\n| --- | --- | --- |\n| `[x](a|b)` | [b](missing.md) |\n", 1, 3],
		["HTML comment end", "<!-- [x](<-->)\n\n[b](missing.md)\n", 1, 3],
		["sentinel collision", "[valid](<doctor-link-1>)\n\n`[example](missing.md)`\n", 0, 0],
		["image", "![b](missing.md)\n", 1, 1],
	] as const) {
		put("docs/doctor-link-1", "A real link target.\n");
		put("docs/markdown-links.md", content);
		const result = run([bun, "tools/doctor.ts"], code);
		if (line) ok(result.includes(`FAIL references docs/markdown-links.md: line ${line}: unresolved missing.md`), result);
		console.log(`PASS doctor Markdown: ${name}`);
	}
	rmSync(join(target, "docs/markdown-links.md"));
	rmSync(join(target, "docs/doctor-link-1"));
	// Import only after disabling the parser; a static import would evaluate doctor first.
	put("without-markdown.ts", 'Bun.markdown = undefined;\nawait import("./tools/doctor.ts");\n');
	const withoutMarkdown = run([bun, "without-markdown.ts"], 2);
	strictEqual(withoutMarkdown.split("\n").filter(line => line.startsWith("CANNOT-EVALUATE ")).length, 1, withoutMarkdown);
	ok(withoutMarkdown.includes("CANNOT-EVALUATE references .: Markdown-link checks require Bun.markdown.render"), withoutMarkdown);
	ok(withoutMarkdown.includes("doctor: 0 fail, 0 warn, 1 cannot-evaluate"), withoutMarkdown);
	rmSync(join(target, "without-markdown.ts"));
	console.log("PASS doctor Markdown: unavailable parser reports one cannot-evaluate");

	for (const file of ["view.tsx", "Makefile", ".github/workflows/check.yml", "docs/diagram.drawio", ".claude/assets/font.ttf", "image.png"]) {
		put(file, file.endsWith(".png") || file.endsWith(".ttf") ? new Uint8Array([0, 255, 123, 123]) : "{{project syntax}}\n");
	}
	put(".claude/worktrees/other/.git", "gitdir: /not-this-repository\n");
	put(".claude/worktrees/other/AGENTS.md", "{{OTHER_PROJECT}}\n");
	put("docs/evidence.log", "[not a Markdown link](missing-file)\n");
	run([bun, "tools/doctor.ts"], 0);
	for (const file of ["AGENTS.md", ".omp/config.yml", ".claude/hooks/guard-main.sh", "docs/process/map.md", "docs/index.md", "docs/plans/TEMPLATE.md", "docs/architecture/README.md", "docs/tracker/items.json", "tools/checkup.ts"]) {
		const original = readFileSync(join(target, file), "utf8");
		put(file, `${original}\n{{UNRENDERED}}\n`);
		const result = run([bun, "tools/doctor.ts"], 1);
		ok(result.includes(`FAIL placeholders ${file}:`), result);
		put(file, original);
	}
	console.log("PASS placeholders: project assets excluded; harness text defects rejected");

	mkdirSync(join(scratch, "etc"));
	writeFileSync(join(scratch, "etc/hosts"), "outside the installed root\n");
	put("docs/containment.md", "[outside](../../etc/hosts)\n");
	ok(run([bun, "tools/doctor.ts"], 1).includes("unresolved ../../etc/hosts (../etc/hosts) (outside repository)"));
	mkdirSync(`${target}-outside`);
	writeFileSync(join(`${target}-outside`, "entry"), "a sibling sharing the root prefix\n");
	symlinkSync(join(`${target}-outside`, "entry"), join(target, "docs/escape-target"));
	put("docs/containment.md", "[outside symlink](escape-target)\n");
	ok(run([bun, "tools/doctor.ts"], 1).includes("(outside repository)"));
	rmSync(join(target, "docs/escape-target"));
	symlinkSync(join(target, "AGENTS.md"), join(target, "docs/inside-target"));
	put("docs/containment.md", "[inside symlink](inside-target)\n");
	run([bun, "tools/doctor.ts"], 0);
	rmSync(join(target, "docs/inside-target"));
	rmSync(join(target, "docs/containment.md"));
	console.log("PASS doctor containment: parent escape and sibling-prefix symlink rejected; internal symlink accepted");

	put(".claude/skills/project-only/SKILL.md", "---\nname: project-only\n---\nArchive the ledger using {{PROJECT_SYNTAX}}.\n" + "Retain this project instruction.\n".repeat(125));
	put(".omp/agents/project-only.md", "---\nname: project-only\n---\nRead skill://project-only and rule://project-only.\n" + "Retain this project instruction.\n".repeat(65));
	run([bun, "tools/doctor.ts"], 0);
	console.log("PASS non-kit harness: unchanged single-port project entries need no twins, splits, or kit metadata");

	put("docs/skill-references.md", "Read skill://missing-project-skill.\n");
	ok(run([bun, "tools/doctor.ts"], 1).includes("FAIL references docs/skill-references.md: line 1: unresolved skill://missing-project-skill"));
	console.log("PASS skill references: a skill missing from both homes fails references");

	const claudeKitSkill = ".claude/skills/mosaic-plan/SKILL.md";
	const kitSkill = readFileSync(join(target, claudeKitSkill), "utf8");
	writeFileSync(join(scratch, "kit-skill.md"), kitSkill);
	rmSync(join(target, claudeKitSkill));
	symlinkSync(join(scratch, "kit-skill.md"), join(target, claudeKitSkill));
	put("docs/skill-references.md", "Read skill://mosaic-plan.\n");
	run([bun, "tools/doctor.ts"], 0);
	rmSync(join(target, claudeKitSkill));
	put(claudeKitSkill, kitSkill);
	console.log("PASS skill references: kit skills resolve in .omp before the external Claude twin");

	put("docs/skill-references.md", "Read skill://project-only.\n");
	run([bun, "tools/doctor.ts"], 0);
	rmSync(join(target, "docs/skill-references.md"));
	console.log("PASS skill references: single-home project skills resolve in .claude");

	mkdirSync(join(target, ".omp/skills/project-only/SKILL.md"), { recursive: true });
	put("docs/skill-references.md", "Read skill://project-only.\n");
	run([bun, "tools/doctor.ts"], 0);
	rmSync(join(target, ".omp/skills/project-only"), { recursive: true });
	rmSync(join(target, "docs/skill-references.md"));
	console.log("PASS skill references: a directory at the omp skill file falls back to .claude");

	const legacy = "# Legacy notes\n\nD9 was a local label. Review plan 0042 for OldContract.\n[Old source](missing.md) and rule://retired-history.\n";
	put("docs/archived/docs/old/x.md", legacy);
	put("docs/archived/docs/product/legacy.md", "# Old product without metadata\n\nOldContract cites plan 0042.\n");
	put("docs/archived/docs/gaps.md", "# Unstructured old gaps and defects\n");
	put("docs/history.md", "[plan 0042 and D9](archived/docs/old/x.md)\n");
	// Architecture source records are Archive class too (rule://records): their stale links never fail doctor or checkup.
	put("docs/architecture/source/bakeoff/README.md", "# Frozen bake-off\n\n[superseded plan](../../../plans/0042-gone.md) cites D9.\n");
	run([bun, "tools/doctor.ts"], 0);
	deepStrictEqual(JSON.parse(run([bun, "tools/checkup.ts", "--json"], 0)), { findings: [], cannotEvaluate: [] });
	put("archive-impact.md", "---\nplan: \"0042\"\nrepo: link-repo\nareas: [contract:OldContract]\n---\n# Impact probe\n");
	const archiveImpact = JSON.parse(run([bun, "tools/docimpact.ts", "archive-impact.md"], 0));
	deepStrictEqual(archiveImpact.cannotEvaluate, []);
	ok(archiveImpact.candidates.every((candidate: { doc: string }) => !candidate.doc.startsWith("docs/archived/")));
	put("docs/old/x.md", legacy);
	const activeLegacy = JSON.parse(run([bun, "tools/checkup.ts", "--json"], 1));
	ok(activeLegacy.findings.some((finding: { class: string; path: string }) => finding.class === "dangling-reference" && finding.path === "docs/old/x.md"));
	ok(activeLegacy.findings.every((finding: { path: string }) => !finding.path.startsWith("docs/archived/")));
	deepStrictEqual(activeLegacy.cannotEvaluate, []);
	rmSync(join(target, "docs/old/x.md"));
	rmSync(join(target, "archive-impact.md"));
	console.log("PASS cutoff history: frozen sources excluded, inbound links valid, identical active prose still checked");

	put("docs/product/labels.md", "D9 is a project-local label.\n");
	put("apps/docs/component.md", "D8 is a component-local label.\n");
	put("packages/docs/component.md", "D7 is a component-local label.\n");
	deepStrictEqual(JSON.parse(run([bun, "tools/checkup.ts", "--json"], 0)), { findings: [], cannotEvaluate: [] });
	const index = readFileSync(join(target, "docs/architecture/README.md"), "utf8");
	put("docs/architecture/README.md", `${index}\n| D1 | Default | decision.md |\n`);
	put("docs/architecture/decision.md", "# Decisions\n\n### D1 — Default\n");
	put("docs/process/sub/citations.md", [
		"Release 0991 is a local label.",
		"plan 0992",
		"docs/plans/0993-unwritten.md",
		"ADR-0994 implements plan 0995.",
		"See adr/0996-choice.md and plan 0997.",
		"See 0998-choice and plan 0999.",
		"See D9 G-999 P-999.",
	].join("\n") + "\n");
	put("docs/adr/citations.md", "plan 0888 and D8 are not kit citations here.\n");
	put("docs/analysis/citations.md", "D7 is local; plan 0777 is not.\nG-998 and P-998 keep their namespaces.\n");
	put("docs/plans/0881-probe.md", "---\nplan: 0881\nstatus: draft\n---\n# 0883 — Probe\n\nplan: 0882\n" +
		["Context", "Scope", "Task breakdown", "Review checklist", "Verification", "Planning log", "Execution log"].map(section => `\n## ${section}\n`).join("") + "\n### Unverified\n");
	const checked = JSON.parse(run([bun, "tools/checkup.ts", "--json"], 1));
	deepStrictEqual(checked.cannotEvaluate, []);
	deepStrictEqual(checked.findings.map((finding: { class: string; path: string; detail: string }) => [finding.class, finding.path, finding.detail.split(" ")[0]]), [
		["dangling-reference", "docs/analysis/citations.md", "0777"],
		["dangling-reference", "docs/analysis/citations.md", "G-998"],
		["dangling-reference", "docs/analysis/citations.md", "P-998"],
		["dangling-reference", "docs/plans/0881-probe.md", "0881"],
		["dangling-reference", "docs/process/sub/citations.md", "0992"],
		["dangling-reference", "docs/process/sub/citations.md", "0993"],
		["dangling-reference", "docs/process/sub/citations.md", "D9"],
		["dangling-reference", "docs/process/sub/citations.md", "G-999"],
		["dangling-reference", "docs/process/sub/citations.md", "P-999"],
		["dangling-reference", "docs/product/labels.md", "D9"],
	]);
	console.log("PASS citations: explicit plan cues, ADR exclusions, indexed D scope, unchanged G/P");

	// A project that numbered decisions keeps its frozen D-map in decisions-archive.md: the map alone enables the D namespace and
	// every row defines its number. Pitfalls have no archive: a citation of a removed entry dangles and routes to repair.
	put("docs/architecture/README.md", index);
	const legacyMap = "# Decision map (frozen)\n\n| D | Title | File |\n|---|---|---|\n| D1 | Default | decision.md |\n| D2 | Settlement | decision.md |\n";
	put("docs/architecture/decisions-archive.md", legacyMap);
	put("docs/process/sub/legacy-map.md", "D1 has a heading; D2 has only its map row; D4 has neither; P-997 was removed.\n");
	const records = JSON.parse(run([bun, "tools/checkup.ts", "--json"], 1));
	deepStrictEqual(records.cannotEvaluate, []);
	deepStrictEqual(records.findings
		.filter((finding: { path: string }) => finding.path === "docs/process/sub/legacy-map.md")
		.map((finding: { class: string; detail: string; fix: string }) => [finding.class, finding.detail.split(" ")[0], finding.fix]), [
		["dangling-reference", "D4", "human"],
		["dangling-reference", "P-997", "route"],
	]);
	// Lint discovers member catalogs as <child>/docs/pitfalls.md; one P-number space spans them and the link catalog.
	const pitfalls = readFileSync(join(target, "docs/architecture/pitfalls.md"), "utf8");
	const sharedPitfall = pitfalls.match(/^- \*\*P-\d+ ·.*$/m)![0];
	for (const command of [[bun, ".omp/hooks/post/lint-ledgers.ts"], ["bash", ".claude/hooks/lint-ledgers.sh"]]) {
		const check = (file: string, code: number, diagnostic = "") => {
			const result = Bun.spawnSync([...command, file], { cwd: target, stdout: "pipe", stderr: "pipe" });
			strictEqual(result.exitCode, code, result.stderr.toString());
			if (diagnostic) ok(result.stderr.toString().includes(diagnostic), result.stderr.toString());
		};
		check("docs/architecture/decisions-archive.md", 0);
		put("docs/architecture/decisions-archive.md", `${legacyMap}| D2 | Settlement again | decision.md |\n`);
		check("docs/architecture/decisions-archive.md", 1, "duplicate decision id 'D2'");
		put("docs/architecture/decisions-archive.md", legacyMap);
		put("member-a/docs/pitfalls.md", `# Pitfalls\n\n${sharedPitfall}\n`);
		check("member-a/docs/pitfalls.md", 1, "also catalogued in docs/architecture/pitfalls.md");
		check("docs/architecture/pitfalls.md", 1, "also catalogued in member-a/docs/pitfalls.md");
		put("member-a/docs/pitfalls.md", `# Pitfalls\n\n${sharedPitfall.replace(/P-\d+/, "P-997")}\n`);
		check("member-a/docs/pitfalls.md", 0);
		check("docs/architecture/pitfalls.md", 0);
	}
	rmSync(join(target, "member-a"), { recursive: true });
	rmSync(join(target, "docs/architecture/decisions-archive.md"));
	rmSync(join(target, "docs/process/sub/legacy-map.md"));
	put("docs/architecture/README.md", `${index}\n| D1 | Default | decision.md |\n`);
	console.log("PASS record catalogs: a legacy D-map alone enables and defines D ids; a removed pitfall's citation routes; P ids unique across catalogs; D-map rows unique");

	put("docs/plans/program.md", "# Existing project program, not a kit lifecycle plan\n");
	for (const command of [[bun, ".omp/hooks/post/lint-ledgers.ts"], ["bash", ".claude/hooks/lint-ledgers.sh"]]) {
		run([...command, "docs/plans/program.md"], 2);
		put("docs/plans/0881-probe.md", "---\nstatus: draft\n---\n# Incomplete numbered plan\n");
		run([...command, "docs/plans/0881-probe.md"], 1);
		// Retained evidence artifacts under docs/plans/evidence/ are not lifecycle plans, even with a NNNN- name.
		put("docs/plans/evidence/0881/session/0881-design-memo.md", "# Design memo kept as evidence\n");
		run([...command, "docs/plans/evidence/0881/session/0881-design-memo.md"], 2);
	}
	rmSync(join(target, "docs/plans/0881-probe.md"));
	const evidenceScan = Bun.spawnSync([bun, "tools/checkup.ts", "--json"], { cwd: target, stdout: "pipe", stderr: "pipe" });
	ok(!JSON.parse(evidenceScan.stdout.toString()).findings.some((finding: { path: string }) => finding.path.startsWith("docs/plans/evidence/")), evidenceScan.stdout.toString());
	rmSync(join(target, "docs/plans/evidence"), { recursive: true });
	console.log("PASS both lint ports: project programs and evidence artifacts unsupported; numbered plans still schema-gated");

	const reviewPlan = "docs/plans/0884-review-attribution.md";
	const reviewBody = (log: string, status = "review", taskClass = "docs") => [
		"---", `status: ${status}`, "---", "## Context", "## Scope", "## Task breakdown",
		"### T1 — Refresh docs", ...(taskClass ? [`- class: ${taskClass}`] : []),
		"## Review checklist", "## Verification", "### Unverified", "## Planning log", "## Execution log", log, "",
	].join("\n");
	const first = "- T1 R2 claude-reviewer: S — CSV default claim contradicts the source → fixed";
	const second = "- T1 R2 claude-reviewer: P — Missing source citation → rejected: the preceding sentence already cites it";
	const attributed = [
		"- T1 R2 claude-reviewer: REVISE (2 findings)",
		"- T1 R2 gpt-reviewer: REVISE (1 findings)", first,
		"- Verification retained after the wave joined.", second,
		"- T1 R2 gpt-reviewer: S — Empty input behavior is misstated → deferred: plan 0884 Unverified",
		"- T1 R3 claude-reviewer: APPROVE (0 findings)",
	].join("\n");
	for (const command of [[bun, ".omp/hooks/post/lint-ledgers.ts"], ["bash", ".claude/hooks/lint-ledgers.sh"]]) {
		const check = (body: string, code: number, diagnostic = "") => {
			put(reviewPlan, body);
			const result = Bun.spawnSync([...command, reviewPlan], { cwd: target, stdout: "pipe", stderr: "pipe" });
			strictEqual(result.exitCode, code, result.stderr.toString());
			if (diagnostic) ok(result.stderr.toString().includes(diagnostic), result.stderr.toString());
		};
		check(reviewBody(attributed), 0);
		check(reviewBody(attributed, "done", "code"), 0);
		check(reviewBody(attributed, "review", ""), 0);
		check(reviewBody(attributed, "review", "other"), 1, "invalid class 'other'");
		check(reviewBody("- T1 R2 C9/G6: REVISE (1 findings)\n- T1 R2 C9/G6: S — Incorrect claim → fixed"), 1, "R2");
		check(reviewBody(attributed.replace(second, "")), 1, "T1 R2 claude-reviewer");
		check(reviewBody(`${attributed}\n${first}`), 1, "T1 R2 claude-reviewer");
		check(reviewBody(`${first}\n- T1 R2 claude-reviewer: REVISE (1 findings)`), 1, "T1 R2 claude-reviewer");
		check(reviewBody(attributed.replace(second, second.replace("R2", "R3"))), 1, "T1 R2 claude-reviewer");
		check(reviewBody("- T1 R2 claude-reviewer: REVISE (1 findings)", "executing"), 0);
		const complete = reviewBody("", "draft");
		check(complete.replace("## Context\n", "## Contextual\n"), 1, "missing required section: '## Context'");
		check(complete.replace("## Context\n", "The ## Context section is discussed here.\n"), 1, "missing required section: '## Context'");
		check(complete.replace("### Unverified\n", "### Unverified assumptions\n"), 1, "missing required section: '### Unverified'");
		check(complete.replace("### Unverified\n", "A ### Verification gaps section is discussed here.\n"), 1, "missing required section: '### Unverified'");
		check(complete.replace("## Context\n", "## Context \t\n").replace("### Unverified\n", "### Verification gaps \t\n"), 0);
	}
	rmSync(join(target, reviewPlan));
	console.log("PASS both lint ports: whole-line required headings, attributed findings, exact later round counts, merged reviewer rejection, docs/code classes");

	const gaps = readFileSync(join(target, "docs/gaps.md"), "utf8");
	const gapBody = (trigger: string) => [
		"- **G-999 · Recheck the runbooks**", `  when: ${trigger}`,
		"  Recheck the new workflow; its implementation has not landed.",
		"  **From:** smoke. **Status:** open.", "",
	].join("\n");
	const longGap = [
		"- **G-999 · Recheck the runbooks**", "  when: plan 0004 lands",
		...Array.from({ length: 11 }, (_, index) => `  Recheck step ${index + 1} after the implementation lands.`),
		"  **From:** smoke.", "  **Status:** open.", "",
	].join("\n");
	const fixtureGaps = readFileSync(new URL("../loops/fixtures/mosaic/docs/gaps.md", import.meta.url), "utf8");
	const gapsArchive = readFileSync(join(target, "docs/gaps-archive.md"), "utf8");
	const noTriggerDiagnostic = "G-999 has no Trigger:/when: line naming its condition";
	for (const command of [[bun, "tools/lint-ledgers.ts"], [bun, ".omp/hooks/post/lint-ledgers.ts"], ["bash", ".claude/hooks/lint-ledgers.sh"]]) {
		const check = (body: string, code: number, diagnostic = "", file = "docs/gaps.md") => {
			put(file, body);
			const result = Bun.spawnSync([...command, file], { cwd: target, stdout: "pipe", stderr: "pipe" });
			strictEqual(result.exitCode, code, result.stderr.toString());
			if (diagnostic) ok(result.stderr.toString().includes(diagnostic), result.stderr.toString());
		};
		check(longGap, 1, "G-999: entry has 15 lines; at most four (rule://records)");
		// Legitimacy is a judgment (records routing, gap-audit REROUTE), never a regex: shape-valid first-use text passes.
		check(gapBody("the first operator run of each runbook in docs/runbooks/*.md"), 0);
		check(gapBody("when someone wants it"), 0);
		check(gapBody(""), 1, noTriggerDiagnostic);
		check(fixtureGaps, 0);
		check(`${gapBody("plan 0004 lands")}\n  \n## Notes\nOutside the entry.\n`, 0);
		check(gapBody("plan 0004 lands").replace("  Recheck", "\n  Recheck"), 1, "G-999: entry has 5 lines; at most four (rule://records)");
		check(gapBody("plan 0004 lands").replace("  when: plan 0004 lands\n", "") + "\n## Notes\nwhen: plan 0004 lands\n", 1, noTriggerDiagnostic);
		check(longGap.replace("G-999", "G-998").replace("plan 0004 lands", "the first operator run of each runbook").replace("**Status:** open.", "**Status:** closed by 0004."), 0, "", "docs/gaps-archive.md");
	}
	// Split dossiers: the archived G-998 above is frozen history; an active dossier needs a trigger line anywhere, not only in a quoted row.
	put("docs/gaps/G-998-frozen.md", "# G-998 · Frozen dossier\nHistory only; no trigger line.\n");
	put("docs/gaps/G-999-active.md", "# G-999 · Active dossier\n- **G-999 · Recheck the runbooks** — quoted row with an inline **Trigger:** copy.\n\n**Trigger:** plan 0004 lands.\n");
	put("docs/gaps/G-997-untriggered.md", "# G-997 · Active dossier without a trigger\nBody only.\n");
	for (const command of [[bun, "tools/lint-ledgers.ts"], [bun, ".omp/hooks/post/lint-ledgers.ts"], ["bash", ".claude/hooks/lint-ledgers.sh"]]) {
		run([...command, "docs/gaps/G-998-frozen.md"], 0);
		run([...command, "docs/gaps/G-999-active.md"], 0);
		const result = Bun.spawnSync([...command, "docs/gaps/G-997-untriggered.md"], { cwd: target, stdout: "pipe", stderr: "pipe" });
		strictEqual(result.exitCode, 1, result.stderr.toString());
		ok(result.stderr.toString().includes("G-997 has no Trigger:/when: line naming its condition"), result.stderr.toString());
	}
	rmSync(join(target, "docs/gaps"), { recursive: true });
	console.log("PASS split dossiers: archived ids frozen, trigger line anywhere in an active dossier, untriggered dossier rejected");
	put("docs/gaps-archive.md", gapsArchive);
	console.log("PASS all lint entrypoints: 15-line rejection, shape-only trigger line, fixture G-1..G-3, four-line plan trigger, physical-line boundaries, archive exemption");

	put("docs/gaps.md", `${gaps}\n- **G-999 · Missing path**\n  **Trigger:** when \`missing/docs/**\` is added.\n  Recheck the path once it exists; it cannot be checked now.\n  **From:** smoke. **Status:** open.\n`);
	const triggered = JSON.parse(run([bun, "tools/checkup.ts", "--json"], 1));
	deepStrictEqual(triggered.cannotEvaluate, []);
	deepStrictEqual(triggered.findings.filter((finding: { class: string }) => finding.class === "stale-trigger").map((finding: { path: string; detail: string }) => [finding.path, finding.detail.split(" ")[0]]), [["docs/gaps.md", "G-999"]]);
	console.log("PASS monorepo root stale-trigger evaluation");

	writeFileSync(join(scratch, "outside"), "outside the installed root\n");
	put("proof/inside", "inside the installed root\n");
	symlinkSync(join(scratch, "outside"), join(target, "proof/escape"));
	for (const [trigger, missing] of [
		["../outside", true], ["../target-outside/*", true], ["proof/escape", true],
		["proof/esc*", true], ["proof/inside", false], ["../target/proof/inside", false],
	] as const) {
		put("docs/gaps.md", `${gaps}\n${gapBody(`\`${trigger}\` is added`)}`);
		const result = JSON.parse(run([bun, "tools/checkup.ts", "--json"], 1));
		deepStrictEqual(result.cannotEvaluate, []);
		strictEqual(result.findings.some((finding: { class: string; detail: string }) =>
			finding.class === "stale-trigger" && finding.detail.startsWith("G-999 ")), missing, trigger);
	}
	rmSync(join(target, "proof"), { recursive: true });
	put("docs/gaps.md", gaps);
	console.log("PASS trigger containment: external paths/globs/symlinks never match; in-root targets match");
	// Bare prose with slashes is not a path; quoted tokens and path-shaped bare tokens still are.
	put("docs/gaps.md", `${gaps}\n${gapBody("headed/GPU runners exist, the \`server-fold\`/\`server-pdf\` split lands, the category/link/view-range check lands, or apps/missing/*.ts appears")}`);
	const prose = JSON.parse(run([bun, "tools/checkup.ts", "--json"], 1));
	deepStrictEqual(prose.cannotEvaluate, []);
	deepStrictEqual(prose.findings.filter((finding: { class: string }) => finding.class === "stale-trigger").map((finding: { detail: string }) => finding.detail.split(";")[0]),
		["G-999 Trigger matches nothing in the link or member repos: apps/missing/*.ts"]);
	put("docs/gaps.md", gaps);
	console.log("PASS trigger prose: bare slash words ignored; path-shaped bare tokens evaluated");

	put("impact.md", "---\nplan: 0001\nrepo: link-repo\nareas: [contract:export_rows]\n---\n# Impact probe\n");
	put("docs/prd/legacy.md", "# Existing PRD without metadata\n");
	put("docs/product/partial.md", "---\ncontracts: [export_rows]\n---\n# Missing repo metadata\n");
	put("docs/product/valid.md", "---\ncontracts: [export_rows]\nrepos: [link-repo]\n---\n# Export feature\n");
	const impact = JSON.parse(run([bun, "tools/docimpact.ts", "impact.md"], 0));
	deepStrictEqual(impact.candidates.filter((candidate: { class: string }) => candidate.class === "product-contract").map((candidate: { doc: string }) => candidate.doc), ["docs/product/valid.md"]);
	const unknownProducts = impact.cannotEvaluate.filter((entry: { class: string }) => entry.class === "product-contract");
	deepStrictEqual(unknownProducts.map((entry: { reason: string }) => entry.reason.split(":")[0]), [
		"docs/prd/legacy.md", "docs/product/labels.md", "docs/product/partial.md",
	]);
	ok(unknownProducts.every((entry: { reason: string }) => entry.reason.includes("repos")));
	ok(unknownProducts.slice(0, 2).every((entry: { reason: string }) => entry.reason.includes("contracts")));
	console.log("PASS docimpact: metadata-free product/PRD documents are unknown, not empty success");
} finally {
	rmSync(scratch, { recursive: true, force: true });
}
