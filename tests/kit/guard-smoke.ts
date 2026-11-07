#!/usr/bin/env bun
import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { type CommitTarget, resolveTarget } from "../../kit/tools/guard-main.ts";

type GuardCase = { command: string; cwd: string; targets: CommitTarget[]; expectBlock?: boolean; offending?: string };
type GuardInput = { command: string; cwd: string };
type GuardResult = { block?: boolean; reason?: string } | undefined;
type GuardHandler = (event: { toolName: string; input: GuardInput }, context: { cwd: string }) => Promise<GuardResult>;
const dirs = (...paths: string[]): CommitTarget[] => paths.map(path => ({ kind: "directory", path }));
const gitDirs = (...paths: string[]): CommitTarget[] => paths.map(path => ({ kind: "git-dir", path }));

const resolverCases: { command: string; targets: CommitTarget[] }[] = [
	...["env", "command", "exec", "time", "nice", "timeout 9", "sudo"].map(prefix => ({
		command: `${prefix} git commit -m x`, targets: dirs("/tmp"),
	})),
	{ command: "unknown-wrapper /usr/bin/git commit -m x", targets: dirs("/tmp") },
	{ command: "command -p /usr/bin/git --no-pager commit -m x", targets: dirs("/tmp") },
	{ command: "{ git commit -m x; }", targets: dirs("/tmp") },
	{ command: "(git commit -m x)", targets: dirs("/tmp") },
	{ command: "! git commit -m x", targets: dirs("/tmp") },
	{ command: "if true; then git commit -m x; fi", targets: dirs("/tmp") },
	{ command: "if false; then :; elif true; then git commit; else git commit; fi", targets: dirs("/tmp", "/tmp") },
	{ command: "while false; do git commit -m x; done", targets: dirs("/tmp") },
	{ command: "until true; do git commit -m x; done", targets: dirs("/tmp") },
	...["dash", "ksh", "mksh", "ash", "busybox sh"].map(shell => ({
		command: `${shell} -c "git commit -m x"`, targets: dirs("/tmp"),
	})),
	{ command: "env -C /repo git commit -m x", targets: dirs("/repo") },
	{ command: "env --chdir=/repo git commit -m x", targets: dirs("/repo") },
	{ command: "env --chdir /repo git commit -m x", targets: dirs("/repo") },
	{ command: "env VAR=val git commit -m x", targets: dirs("/tmp") },
	{ command: "timeout 9 env -C /repo VAR=val git commit -m x", targets: dirs("/repo") },
	{ command: "env -S 'git commit -m x'", targets: dirs("/tmp") },
	{ command: "env --split-string='git commit -m x'", targets: dirs("/tmp") },
	{ command: "env --split-string 'git commit -m x'", targets: dirs("/tmp") },
	{ command: "env -S'git commit -m x'", targets: dirs("/tmp") },
	{ command: "env -ivS 'git commit -m x'", targets: dirs("/tmp") },
	{ command: "env -C /repo -S 'git commit -m x'", targets: dirs("/repo") },
	{ command: "env -S '-C /repo git commit -m x'", targets: dirs("/repo") },
	{ command: "env -S 'git -C' /repo commit -m x", targets: dirs("/repo") },
	{ command: "env -S 'GIT_DIR=/r/.git git commit -m x'", targets: gitDirs("/r/.git") },
	{ command: `env -S 'sh -c "cd /repo && git commit"'`, targets: dirs("/repo") },
	{ command: "env -S 'git status'", targets: [] },
	{ command: "sudo -D /repo git commit -m x", targets: dirs("/repo") },
	{ command: "sudo --chdir=/repo git commit -m x", targets: dirs("/repo") },
	{ command: "sudo --chdir /repo git commit -m x", targets: dirs("/repo") },
	{ command: "(cd /repo && git commit -m x)", targets: dirs("/repo") },
	{ command: "(cd /repo); git commit -m x", targets: dirs("/tmp") },
	{ command: "(cd /repo && git commit); git commit", targets: dirs("/repo", "/tmp") },
	{ command: "(cd /repo; (cd inner; git commit); git commit); git commit", targets: dirs("/repo/inner", "/repo", "/tmp") },
	{ command: "{ cd /repo; }; git commit", targets: dirs("/repo") },
	{ command: "{ cd /repo; git commit; }; git commit", targets: dirs("/repo", "/repo") },
	{ command: "env -C /repo git commit; git commit", targets: dirs("/repo", "/tmp") },
	{ command: "git -C /feature commit -m a && git -C /mainrepo commit -m b", targets: dirs("/feature", "/mainrepo") },
	{ command: "git --git-dir /r/.git commit -m x", targets: gitDirs("/r/.git") },
	{ command: "git --git-dir=/r/.git commit -m x", targets: gitDirs("/r/.git") },
	{ command: "GIT_DIR=/r/.git git commit -m x", targets: gitDirs("/r/.git") },
	{ command: "env GIT_DIR=/r/.git git commit -m x", targets: gitDirs("/r/.git") },
	{ command: "export GIT_DIR=/r/.git; git commit -m x", targets: gitDirs("/r/.git") },
	{ command: "export GIT_DIR=/r/.git; git status; git commit; git commit", targets: gitDirs("/r/.git", "/r/.git") },
	{ command: "GIT_DIR=/r/.git; git commit -m x", targets: [...dirs("/tmp"), ...gitDirs("/r/.git")] },
	{ command: "GIT_DIR=.git; git -C /r commit", targets: [...dirs("/r"), ...gitDirs("/r/.git")] },
	{ command: "GIT_DIR=/r/.git; export GIT_DIR; git commit", targets: gitDirs("/r/.git") },
	{ command: "export GIT_DIR; GIT_DIR=/r/.git; git commit", targets: gitDirs("/r/.git") },
	{ command: "export GIT_DIR=/old/.git; GIT_DIR=/r/.git; git commit", targets: gitDirs("/r/.git") },
	{ command: "GIT_DIR=/old/.git git status; GIT_DIR=/r/.git; git commit", targets: [...dirs("/tmp"), ...gitDirs("/r/.git")] },
	{ command: "GIT_DIR=/r/.git; (export GIT_DIR; git commit); git commit", targets: [...gitDirs("/r/.git"), ...dirs("/tmp"), ...gitDirs("/r/.git")] },
	{ command: "GIT_DIR=/r/.git; sh -c 'export GIT_DIR; git commit'", targets: [...dirs("/tmp"), ...gitDirs("/r/.git")] },
	{ command: "GIT_DIR=/r/.git; git --git-dir=/other/.git commit", targets: gitDirs("/other/.git") },
	{ command: "export GIT_DIR=/r/.git; env -iS 'git commit'", targets: dirs("/tmp") },
	{ command: "git --git-dir .git -C /r commit -m x", targets: gitDirs("/r/.git") },
	{ command: "git -C /r --git-dir=.git commit -m x", targets: gitDirs("/r/.git") },
	{ command: "GIT_DIR=.git git -C /r commit -m x", targets: gitDirs("/r/.git") },
	{ command: "env GIT_DIR=.git git -C /r commit -m x", targets: gitDirs("/r/.git") },
	{ command: "export GIT_DIR=.git; cd /r; git commit", targets: gitDirs("/r/.git") },
	{ command: "env -C /r GIT_DIR=.git git commit -m x", targets: gitDirs("/r/.git") },
	{ command: "GIT_DIR=/other/.git git --git-dir=/r/.git commit", targets: gitDirs("/r/.git") },
	{ command: "GIT_DIR=/r/.git git commit; git commit", targets: [...gitDirs("/r/.git"), ...dirs("/tmp")] },
	{ command: "env GIT_DIR=/r/.git git commit; git commit", targets: [...gitDirs("/r/.git"), ...dirs("/tmp")] },
	{ command: "(export GIT_DIR=/r/.git; git commit); git commit", targets: [...gitDirs("/r/.git"), ...dirs("/tmp")] },
	{ command: "{ export GIT_DIR=/r/.git; }; git commit", targets: gitDirs("/r/.git") },
	{ command: "export GIT_DIR=/r/.git; env -i git commit; git commit", targets: [...dirs("/tmp"), ...gitDirs("/r/.git")] },
	{ command: "export GIT_DIR=/r/.git; env -u GIT_DIR git commit", targets: dirs("/tmp") },
	{ command: "export GIT_DIR=/r/.git; unset GIT_DIR; git commit", targets: dirs("/tmp") },
	{ command: "git --work-tree /r commit", targets: dirs("/tmp") },
	{ command: "git --work-tree=/r commit", targets: dirs("/tmp") },
	{ command: "GIT_WORK_TREE=/r git commit", targets: dirs("/tmp") },
	{ command: "git -c core.worktree=/r commit", targets: dirs("/tmp") },
	{ command: "git -ccore.worktree=/r commit", targets: dirs("/tmp") },
	{ command: "git status", targets: [] },
	{ command: "echo hi", targets: [] },
	{ command: "git commit-tree HEAD^{tree}", targets: [] },
	{ command: 'grep -r "git commit" docs', targets: [] },
	{ command: "# git commit\n git status # git commit", targets: [] },
	{ command: "echo cd /repo; git commit # git -C /other commit", targets: dirs("/tmp") },
	{ command: "eval 'cd /repo'; git commit", targets: dirs("/repo") },
	{ command: 'echo eval "cd /feature"; git commit -m x', targets: dirs("/tmp") },
	{ command: 'echo eval "cd /feature; git commit"; git commit', targets: dirs("/feature", "/tmp") },
	{ command: "command eval 'cd /f'; git commit", targets: dirs("/f") },
	...["!", "{", "}", "if", "then", "elif", "else", "fi", "while", "until", "for", "select", "do", "done", "case", "esac", "time", "[[", "function"].map(word => ({
		command: `"${word}" cd /f; git commit`, targets: dirs("/tmp"),
	})),
	{ command: "\\if cd /f; git commit", targets: dirs("/tmp") },
	{ command: '"d"one cd /f; git commit', targets: dirs("/tmp") },
	// A backslash-newline inside a reserved word is a continuation, not quoting: the word stays grammar.
	{ command: "i\\\nf false; then cd /f; fi; git commit", targets: dirs("/tmp", "/f") },
	{ command: "if true; th\\\nen cd /f; fi; git commit", targets: dirs("/tmp", "/f") },
	{ command: "c\\\nd /f; git commit", targets: dirs("/f") },
	...["fi", "done", "esac", "}"].map(word => ({
		command: `${word} cd /f; git commit`, targets: dirs("/tmp"),
	})),
	{ command: '"cd" /f; git commit', targets: dirs("/f") },
	{ command: '"command" cd /f; git commit', targets: dirs("/f") },
	{ command: '"eval" "cd /f"; git commit', targets: dirs("/f") },
	{ command: '"export" GIT_DIR=/f/.git; git commit', targets: gitDirs("/f/.git") },
	{ command: 'export GIT_DIR=/f/.git; "unset" GIT_DIR; git commit', targets: dirs("/tmp") },
	{ command: "env -S 'if cd /f git commit'", targets: dirs("/tmp") },
	{ command: `env -S 'command -p --' "if" cd /f git commit`, targets: dirs("/tmp") },
	{ command: "false && export GIT_DIR=/feature/.git; git commit", targets: [...dirs("/tmp"), ...gitDirs("/feature/.git")] },
	{ command: "export GIT_DIR=/f/.git | cat; git commit", targets: [...dirs("/tmp"), ...gitDirs("/f/.git")] },
	{ command: "false && cd /f; git commit", targets: dirs("/tmp", "/f") },
	{ command: "cd /f; git commit", targets: dirs("/f") },
	{ command: "cd /f && git commit", targets: dirs("/f") },
	{ command: "git fetch && cd /f && git commit", targets: dirs("/f") },
	{ command: "cd /f || exit 1; git commit", targets: dirs("/f") },
	{ command: "cd /f | cat; git commit", targets: dirs("/tmp", "/f") },
	{ command: "cd /f & git commit", targets: dirs("/tmp", "/f") },
	{ command: "if true; then cd /f; fi; git commit", targets: dirs("/tmp", "/f") },
	{ command: "if false; then export GIT_DIR=/f/.git; else cd /g; fi; git commit", targets: [...dirs("/tmp"), ...gitDirs("/f/.git"), ...dirs("/g")] },
	{ command: "while false; do cd /f; done; git commit", targets: dirs("/tmp", "/f") },
	{ command: "until true; do cd /f; done; git commit", targets: dirs("/tmp", "/f") },
	{ command: "for x in a; do cd /f; done; git commit", targets: dirs("/tmp", "/f") },
	{ command: "select x in a; do cd /f; done; git commit", targets: dirs("/tmp", "/f") },
	{ command: "case x in x) cd /f;; esac; git commit", targets: dirs("/tmp", "/f") },
	{ command: "(cd /f); git commit", targets: dirs("/tmp") },
	{ command: "cd /base && (cd /inner); git commit", targets: dirs("/base") },
	{ command: "false && (cd /inner) && cd /f; git commit", targets: dirs("/tmp", "/f") },
	{ command: "false && cd /f || cd /g; git commit", targets: dirs("/tmp", "/f", "/g") },
	{ command: "false && cd /f\n git commit", targets: dirs("/tmp", "/f") },
	{ command: "false &&\n export GIT_DIR=/feature/.git; git commit", targets: [...dirs("/tmp"), ...gitDirs("/feature/.git")] },
	{ command: 'git -C "/tmp/link/../main" commit', targets: dirs("/tmp/link/../main") },
	{ command: "git -C link -C ../main commit", targets: dirs("/tmp/link/../main") },
	{ command: "env -C link/../main git commit", targets: dirs("/tmp/link/../main") },
	{ command: "sudo -D link/../main git commit", targets: dirs("/tmp/link/../main") },
	{ command: "git --git-dir=link/../main/.git commit", targets: gitDirs("/tmp/link/../main/.git") },
	{ command: "GIT_DIR=link/../main/.git git commit", targets: gitDirs("/tmp/link/../main/.git") },
	{ command: "cd link/../main; git commit", targets: dirs("/tmp/main") },
];

const scratch = mkdtempSync(join(tmpdir(), "mosaic-guard smoke-"));
const root = join(scratch, "root");
const member = join(root, "member");
const feat = join(root, "feat");
const nested = join(root, "a", "b");
const semicolon = join(root, "semi;colon");
const spaced = join(root, "dir with spaces");
const physicalMain = join(scratch, "physical", "main");
const logicalMain = join(scratch, "main");
const linkedMain = `${scratch}/link/../main`;
const config = join(root, ".omp", "mosaic.json");
const ompHook = join(root, ".omp", "hooks", "pre", "guard-main.ts");
const claudeHook = join(root, ".claude", "hooks", "guard-main.sh");
const cli = join(root, "tools", "guard-main.ts");
const originalHome = process.env.HOME;
const originalOldPwd = process.env.OLDPWD;
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

try {
	// Trap accidental HOME/OLDPWD expansion: unresolved cd forms use the tool cwd.
	process.env.HOME = member;
	process.env.OLDPWD = feat;
	const env = { ...process.env };
	for (const name of Object.keys(env)) {
		if (name.startsWith("GIT_")) delete env[name];
	}
	delete env.BASH_ENV;
	delete env.ENV;
	delete env.CDPATH;
	env.GIT_CONFIG_NOSYSTEM = "1";
	env.GIT_CONFIG_GLOBAL = "/dev/null";
	env.GIT_CONFIG_SYSTEM = "/dev/null";
	env.GUARD_SMOKE_GIT_NAME = "Guard Smoke";

	for (const [directory, branch] of [[root, "main"], [member, "main"], [feat, "task/probe"], [nested, "main"], [physicalMain, "main"], [logicalMain, "task/probe"]]) {
		mkdirSync(directory, { recursive: true });
		const initialized = Bun.spawnSync(["git", "init", "--quiet", "--template=", "-b", branch, directory], {
			cwd: scratch, env, stdout: "pipe", stderr: "pipe",
		});
		strictEqual(initialized.exitCode, 0, `git init ${directory}\n${initialized.stderr}`);
	}
	mkdirSync(join(scratch, "physical", "child"));
	symlinkSync("physical/child", join(scratch, "link"));
	for (const directory of [semicolon, spaced, dirname(ompHook), dirname(claudeHook)]) mkdirSync(directory, { recursive: true });
	cpSync(new URL("../../kit/tools/", import.meta.url), join(root, "tools"), { recursive: true });
	copyFileSync(new URL("../../kit/.omp/hooks/pre/guard-main.ts", import.meta.url), ompHook);
	copyFileSync(new URL("../../kit/.claude/hooks/guard-main.sh", import.meta.url), claudeHook);
	writeFileSync(config, JSON.stringify({ defaultBranch: "main" }));

	let handle!: GuardHandler;
	let forbiddenExecution: Error | undefined;
	// Exercise the installed module boundary: this temp-root path is selected at runtime.
	const { default: register } = await import(pathToFileURL(ompHook).href);
	register({
		on: (_event: string, callback: GuardHandler) => { handle = callback; },
		exec: async (command: string, args: string[], options: { cwd: string }) => {
			// The hook must inspect branches, never execute any guarded commit command.
			const directoryQuery = args.length === 4 && args[0] === "-C" && args[2] === "branch" && args[3] === "--show-current";
			const gitDirQuery = args.length === 3 && args[0]!.startsWith("--git-dir=") && args[1] === "branch" && args[2] === "--show-current";
			if (command !== "git" || (!directoryQuery && !gitDirQuery)) {
				forbiddenExecution = new Error(`Guard tried to execute more than a branch query: ${command} ${args.join(" ")}`);
				throw forbiddenExecution;
			}
			const result = Bun.spawnSync([command, ...args], { cwd: options.cwd, env, stdout: "pipe", stderr: "pipe" });
			if (result.exitCode !== 0) throw new Error(result.stderr.toString());
			return { stdout: result.stdout.toString() };
		},
	});

	async function adapters(input: GuardInput) {
		// Omp launches outside the installed root; Claude uses the documented stdin pipeline.
		// Repository selection follows the payload cwd, not either adapter's launch cwd.
		const omp = await handle({ toolName: "bash", input }, { cwd: scratch });
		if (forbiddenExecution) throw forbiddenExecution;
		const claude = Bun.spawnSync(["bash", "-c", `printf '%s' "$1" | bash .claude/hooks/guard-main.sh`, "guard-probe", JSON.stringify({ tool_input: input })], {
			cwd: root, env, stdout: "pipe", stderr: "pipe",
		});
		return { omp, claude };
	}

	async function check(test: GuardCase): Promise<void> {
		const label = `${test.command}\ncwd: ${test.cwd}`;
		deepStrictEqual(resolveTarget(test.command, test.cwd), test.targets, `resolver: ${label}`);
		const { omp, claude } = await adapters({ command: test.command, cwd: test.cwd });
		const blocked = test.expectBlock ?? test.targets.length > 0;
		strictEqual(Boolean(omp?.block), blocked, `omp: ${label}\n${omp?.reason ?? ""}`);
		strictEqual(claude.exitCode, blocked ? 2 : 0, `Claude: ${label}\n${claude.stdout}\n${claude.stderr}`);
		if (blocked) {
			const offending = test.offending ?? test.targets[0]!.path;
			ok(omp?.reason?.includes(offending), `omp must name the blocked target: ${label}\n${omp?.reason}`);
			ok(claude.stderr.toString().includes(offending), `Claude must name the blocked target: ${label}\n${claude.stderr}`);
			strictEqual(omp?.reason, claude.stderr.toString().trimEnd(), `block wording parity: ${label}`);
		}
	}

	const cases: GuardCase[] = [
		{ command: "git commit -m x", cwd: root, targets: dirs(root) },
		{ command: "git -C member commit -m x", cwd: root, targets: dirs(member) },
		{ command: "git -C feat commit -m x", cwd: root, targets: dirs(feat), expectBlock: false },
		{ command: "cd member && git commit -m x", cwd: root, targets: dirs(member) },
		{ command: "npm test && cd member && git commit -m x", cwd: root, targets: dirs(member) },
		{ command: ":; cd member && git commit -m x", cwd: root, targets: dirs(member) },
		{ command: "cd feat && git commit -m x", cwd: root, targets: dirs(feat), expectBlock: false },
		{ command: "git -C a -C b commit -m x", cwd: root, targets: dirs(nested) },
		{ command: 'echo "$(git commit -m x)"', cwd: root, targets: dirs(root) },
		{ command: "`git commit`", cwd: root, targets: dirs(root) },
		{ command: 'bash -c "cd member && git commit -m x"', cwd: root, targets: dirs(member) },
		{ command: "bash <<'EOF'\ncd member\ngit commit -m x\nEOF", cwd: root, targets: dirs(member) },
		{ command: 'grep -n "git commit" docs/process/git-flow.md', cwd: root, targets: [] },
		{ command: "git commit-tree HEAD^{tree}", cwd: root, targets: [] },
		{ command: "git -c user.name=x commit -m x", cwd: root, targets: dirs(root) },
		{ command: "git log", cwd: root, targets: [] },
		{ command: "/usr/bin/git commit -m x", cwd: root, targets: dirs(root) },
		{ command: "git commit -m x", cwd: scratch, targets: dirs(scratch), expectBlock: false },

		// -C is applied sequentially to the current shell directory, not just the last value.
		{ command: `git -C member -C ${quote(feat)} commit -m x`, cwd: root, targets: dirs(feat), expectBlock: false },
		{ command: `git -C ${quote(join(root, "a"))} -C b commit -m x`, cwd: feat, targets: dirs(nested) },
		{ command: "git -C ../feat commit -m x", cwd: member, targets: dirs(`${member}/../feat`), expectBlock: false },
		{ command: "cd .. && git -C member commit -m x", cwd: feat, targets: dirs(member) },
		{ command: "git -Ca -Cb commit -m x", cwd: root, targets: dirs(nested) },
		{ command: 'git -C member -C "" commit -m x', cwd: root, targets: dirs(member) },
		{ command: "cd feat; cd ../member; git commit -m x", cwd: root, targets: dirs(member) },
		{ command: "cd member\ncd ../feat\ngit commit -m x", cwd: root, targets: dirs(feat), expectBlock: false },
		{ command: "pushd feat && git commit -m x", cwd: root, targets: dirs(feat), expectBlock: false },
		{ command: "cd member && cd && git commit -m x", cwd: root, targets: dirs(root) },
		{ command: "cd - && git commit -m x", cwd: root, targets: dirs(root) },
		{ command: "cd ..; cd; git commit -m x", cwd: feat, targets: dirs(feat), expectBlock: false },
		{ command: "cd member; cd ../feat; cd -; git commit -m x", cwd: root, targets: dirs(root) },

		// Nested shells inherit the current directory, but cannot change their caller's cwd.
		{ command: 'bash -lc "cd member && git commit -m x"', cwd: root, targets: dirs(member) },
		{ command: 'bash -ec "cd feat && git commit -m x"', cwd: root, targets: dirs(feat), expectBlock: false },
		{ command: "eval 'cd member && git commit -m x'", cwd: root, targets: dirs(member) },
		{ command: "cd member && bash -c 'cd ../feat; cd; git commit -m x'", cwd: root, targets: dirs(member) },
		{ command: "bash -c 'cd feat'; git commit -m x", cwd: root, targets: dirs(root) },
		{ command: "MODE=probe git -C member commit -m x", cwd: root, targets: dirs(member) },
		{ command: "echo git commit -m x", cwd: root, targets: dirs(root) },
		{ command: `printf '%s' "$(printf '%s' "$(git -C member commit -m x)")"`, cwd: root, targets: dirs(member) },
		{ command: 'echo `echo \\`git -C member commit\\``', cwd: root, targets: dirs(member) },
		{ command: `echo "$(printf '%s' ')'; git -C member commit)"`, cwd: root, targets: dirs(member) },
		{ command: 'echo "$(cd feat && git commit -m x)"', cwd: root, targets: dirs(feat), expectBlock: false },
		{ command: 'echo "$(cd feat)"; git commit -m x', cwd: root, targets: dirs(root) },
		{ command: 'git -C feat commit -m "$(git -C member commit -m x)"', cwd: root, targets: dirs(member, feat) },

		{ command: "bash <<-'EOF'\n\tcd feat\n\tgit commit -m x\n\tEOF", cwd: root, targets: dirs(feat), expectBlock: false },
		{ command: "cat <<'EOF'\ncd member\ngit commit -m x\nEOF", cwd: root, targets: [] },
		{ command: "cat <<'EOF'\ngit commit -m x\nEOF\ngit -C feat commit -m x", cwd: root, targets: dirs(feat), expectBlock: false },
		{ command: "bash <<'EOF'\nprintf '%s\\n' 'git commit -m x'\nEOF", cwd: root, targets: [] },
		{ command: "echo '$(git commit -m x)'", cwd: root, targets: [] },
		{ command: "echo '`git commit -m x`'", cwd: root, targets: [] },
		{ command: `printf '%s\\n' "git commit; cd member && git commit"`, cwd: root, targets: [] },
		{ command: 'cd "semi;colon" && git commit -m x', cwd: root, targets: dirs(semicolon) },
		{ command: "git -C dir\\ with\\ spaces commit -m x", cwd: root, targets: dirs(spaced) },
		{ command: 'echo "\\$(git commit -m x)"', cwd: root, targets: [] },
		{ command: 'echo "\\`git commit -m x\\`"', cwd: root, targets: [] },
		{ command: "git \\\n-C member \\\ncommit -m x", cwd: root, targets: dirs(member) },
		{ command: "echo git\\ commit", cwd: root, targets: [] },

		// A later default-branch target still blocks after a feature branch or unreadable target.
		{ command: "git -C feat commit -m first; git -C member commit -m second", cwd: root, targets: dirs(feat, member), offending: member },
		{ command: 'echo "$(git -C feat commit -m first)"; git -C member commit -m second', cwd: root, targets: dirs(feat, member), offending: member },
		{ command: `git commit; git -C ${quote(root)} commit`, cwd: scratch, targets: dirs(scratch, root), offending: root },
		{ command: "git --git-dir missing commit; git -C member commit", cwd: root, targets: [...gitDirs(join(root, "missing")), ...dirs(member)], offending: member },
		{ command: "git --git-dir .git --work-tree . --namespace probe --super-prefix member/ --config-env user.name=GUARD_SMOKE_GIT_NAME commit -m x", cwd: root, targets: gitDirs(join(root, ".git")) },
		{ command: "git --git-dir=.git --work-tree=. --namespace=probe --super-prefix=member/ --config-env=user.name=GUARD_SMOKE_GIT_NAME commit -m x", cwd: root, targets: gitDirs(join(root, ".git")) },
		{ command: "git -cuser.name=x commit -m x", cwd: root, targets: dirs(root) },
		{ command: "git --git-dir commit log", cwd: root, targets: [] },
		{ command: "git --work-tree commit log", cwd: root, targets: [] },
		{ command: "git --namespace commit log", cwd: root, targets: [] },
		{ command: "git --super-prefix commit log", cwd: root, targets: [] },
		{ command: "git --config-env user.name=GUARD_SMOKE_GIT_NAME log", cwd: root, targets: [] },
		{ command: "git -c alias.probe=commit log", cwd: root, targets: [] },
		{ command: "git --no-pager -C member --no-optional-locks commit -m x", cwd: root, targets: dirs(member) },

		...["env", "command", "exec", "time", "nice", "timeout 9", "sudo"].map(prefix => ({
			command: `${prefix} git commit -m x`, cwd: root, targets: dirs(root),
		})),
		{ command: `env -C ${quote(member)} git commit`, cwd: feat, targets: dirs(member) },
		{ command: "env -S 'git commit -m x'", cwd: root, targets: dirs(root) },
		{ command: "env --split-string='git -C feat commit -m x'", cwd: root, targets: dirs(feat), expectBlock: false },
		{ command: `env -S ${quote(`git --git-dir=${quote(join(member, ".git"))} commit`)}`, cwd: scratch, targets: gitDirs(join(member, ".git")) },
		{ command: `export GIT_DIR=${quote(join(member, ".git"))}; env -iS 'git commit'`, cwd: feat, targets: dirs(feat), expectBlock: false },
		{ command: `sudo --chdir=${quote(member)} git commit`, cwd: feat, targets: dirs(member) },
		{ command: "dash -c 'git -C member commit'", cwd: root, targets: dirs(member) },
		{ command: "(cd member && git commit)", cwd: root, targets: dirs(member) },
		{ command: "(cd feat); git commit", cwd: root, targets: dirs(root) },
		{ command: "{ cd member; }; git commit", cwd: root, targets: dirs(member) },
		{ command: `git --git-dir ${quote(join(member, ".git"))} commit`, cwd: scratch, targets: gitDirs(join(member, ".git")) },
		{ command: `git --git-dir=${quote(join(feat, ".git"))} commit`, cwd: scratch, targets: gitDirs(join(feat, ".git")), expectBlock: false },
		{ command: `GIT_DIR=${quote(join(member, ".git"))} git commit`, cwd: feat, targets: gitDirs(join(member, ".git")) },
		{ command: `env GIT_DIR=${quote(join(member, ".git"))} git commit`, cwd: feat, targets: gitDirs(join(member, ".git")) },
		{ command: `export GIT_DIR=${quote(join(member, ".git"))}; git commit`, cwd: feat, targets: gitDirs(join(member, ".git")) },
		{ command: `GIT_DIR=${quote(join(feat, ".git"))}; git commit`, cwd: root, targets: [...dirs(root), ...gitDirs(join(feat, ".git"))] },
		{ command: `GIT_DIR=${quote(join(feat, ".git"))}; export GIT_DIR; git commit`, cwd: root, targets: gitDirs(join(feat, ".git")), expectBlock: false },
		{ command: `export GIT_DIR; GIT_DIR=${quote(join(member, ".git"))}; git commit`, cwd: feat, targets: gitDirs(join(member, ".git")) },
		{ command: "GIT_DIR=.git git -C member commit", cwd: root, targets: gitDirs(join(member, ".git")) },
		{ command: "git --git-dir .git -C member commit", cwd: root, targets: gitDirs(join(member, ".git")) },
		{ command: "git --git-dir=feat/.git commit; git --git-dir=member/.git commit", cwd: root, targets: gitDirs(join(feat, ".git"), join(member, ".git")), offending: join(member, ".git") },
		{ command: `GIT_WORK_TREE=${quote(feat)} git commit`, cwd: root, targets: dirs(root) },
		{ command: "git --work-tree=feat commit", cwd: root, targets: dirs(root) },
		{ command: "git -c core.worktree=feat commit", cwd: root, targets: dirs(root) },
		{ command: `echo eval ${quote(`cd ${quote(feat)}`)}; git commit -m x`, cwd: root, targets: dirs(root) },
		{ command: `"done" cd ${quote(feat)}; git commit -m x`, cwd: root, targets: dirs(root) },
		{ command: '"cd" feat; git commit', cwd: root, targets: dirs(feat), expectBlock: false },
		{ command: '"command" cd feat; git commit', cwd: root, targets: dirs(feat), expectBlock: false },
		{ command: '"eval" "cd feat"; git commit', cwd: root, targets: dirs(feat), expectBlock: false },
		{ command: `"export" GIT_DIR=${quote(join(member, ".git"))}; git commit`, cwd: feat, targets: gitDirs(join(member, ".git")) },
		{ command: `false && export GIT_DIR=${quote(join(feat, ".git"))}; git commit`, cwd: root, targets: [...dirs(root), ...gitDirs(join(feat, ".git"))] },
		{ command: `export GIT_DIR=${quote(join(feat, ".git"))} | cat; git commit`, cwd: root, targets: [...dirs(root), ...gitDirs(join(feat, ".git"))] },
		{ command: "false && cd feat; git commit", cwd: root, targets: dirs(root, feat) },
		{ command: "git fetch && cd feat && git commit", cwd: root, targets: dirs(feat), expectBlock: false },
		{ command: "cd feat || exit 1; git commit", cwd: root, targets: dirs(feat), expectBlock: false },
		{ command: "cd feat | cat; git commit", cwd: root, targets: dirs(root, feat) },
		{ command: "cd feat & git commit", cwd: root, targets: dirs(root, feat) },
		{ command: "if true; then cd feat; fi; git commit", cwd: root, targets: dirs(root, feat) },
		{ command: `git -C ${quote(linkedMain)} commit`, cwd: scratch, targets: dirs(linkedMain) },
		{ command: "git -C link -C ../main commit", cwd: scratch, targets: dirs(linkedMain) },
		{ command: `env --chdir=${quote(linkedMain)} git commit`, cwd: scratch, targets: dirs(linkedMain) },
		{ command: `sudo -D ${quote(linkedMain)} git commit`, cwd: scratch, targets: dirs(linkedMain) },
		{ command: `git --git-dir=${quote(`${linkedMain}/.git`)} commit`, cwd: scratch, targets: gitDirs(`${linkedMain}/.git`) },
		{ command: `GIT_DIR=${quote(`${linkedMain}/.git`)} git commit`, cwd: scratch, targets: gitDirs(`${linkedMain}/.git`) },
		{ command: "cd link/../main && git commit", cwd: scratch, targets: dirs(logicalMain), expectBlock: false },
	];
	for (const test of resolverCases) deepStrictEqual(resolveTarget(test.command, "/tmp"), test.targets, test.command);
	console.log(`PASS ${resolverCases.length} lexical cases: wrappers, shell scope, every commit, git-dir precedence, work-tree invariance, and SKIP`);
	for (const test of cases) await check(test);
	console.log(`PASS ${cases.length} command cases: resolver and both installed adapters, blocked-target diagnostics and per-target fail-open`);

	const cliCases = [
		{ payload: { command: "git -C member commit -m x", cwd: root }, expected: JSON.stringify(dirs(member)[0]) },
		{ payload: { tool_input: { command: "git -C ../feat commit -m x", cwd: member } }, expected: JSON.stringify(dirs(`${member}/../feat`)[0]) },
		{ payload: { command: "git -C feat commit; git --git-dir=member/.git commit", cwd: root }, expected: [...dirs(feat), ...gitDirs(join(member, ".git"))].map(target => JSON.stringify(target)).join("\n") },
		{ payload: { command: "echo '$(git commit -m x)'", cwd: root }, expected: "SKIP" },
		{ payload: { tool_input: { command: "git log", cwd: root } }, expected: "SKIP" },
	];
	for (const { payload, expected } of cliCases) {
		const result = Bun.spawnSync([process.execPath, cli], {
			cwd: scratch, env, stdin: Buffer.from(JSON.stringify(payload)), stdout: "pipe", stderr: "pipe",
		});
		strictEqual(result.exitCode, 0, `resolver CLI: ${JSON.stringify(payload)}\n${result.stderr}`);
		strictEqual(result.stdout.toString().trimEnd(), expected, `resolver CLI: ${JSON.stringify(payload)}`);
	}
	for (const args of [[], ["--hook"]]) {
		const result = Bun.spawnSync([process.execPath, cli, ...args], {
			cwd: scratch, env, stdin: Buffer.from("{"), stdout: "pipe", stderr: "pipe",
		});
		strictEqual(result.exitCode, 2, `malformed CLI JSON ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
	}
	console.log("PASS resolver CLI: flat and tool_input payloads, JSON-lines targets/SKIP, malformed JSON exits 2 in both modes");

	// Configuration belongs to the installation, not the queried member or launch cwd.
	writeFileSync(config, JSON.stringify({ defaultBranch: "task/probe" }));
	await check({ command: "git commit -m x", cwd: feat, targets: dirs(feat), expectBlock: true });
	await check({ command: "git commit -m x", cwd: root, targets: dirs(root), expectBlock: false });
	writeFileSync(config, "{");
	const malformed = await adapters({ command: "git commit -m x", cwd: root });
	ok(malformed.omp?.block, "omp must fail closed on malformed installed config");
	strictEqual(malformed.claude.exitCode, 2, `Claude must fail closed on malformed installed config\n${malformed.claude.stderr}`);
	console.log("PASS installed config: custom default branch and malformed JSON fail-closed on both adapters");
} finally {
	if (originalHome === undefined) delete process.env.HOME;
	else process.env.HOME = originalHome;
	if (originalOldPwd === undefined) delete process.env.OLDPWD;
	else process.env.OLDPWD = originalOldPwd;
	rmSync(scratch, { recursive: true, force: true });
}
