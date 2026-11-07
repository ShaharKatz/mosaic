#!/usr/bin/env bun
// Port-neutral resolver for every commit target (cwd or explicit git dir) in a command.
// Follows wrappers, shell groups, cwd/env changes, inline scripts and env split strings without executing
// submitted commands. Quoted reserved words are command names, not grammar. $VAR values, aliases and
// on-disk scripts/xargs are not evaluated; standalone git words are inspected behind unknown prefixes.
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { basename, isAbsolute, join, resolve } from "node:path";

const CONFIG_PATH = ".omp/mosaic.json";
const VALUE_OPTIONS: Record<string, true> = {
	"-C": true, "-c": true, "--git-dir": true, "--work-tree": true,
	"--namespace": true, "--super-prefix": true, "--config-env": true,
};
const SHELLS: Record<string, true> = {
	bash: true, sh: true, zsh: true, dash: true, ksh: true, mksh: true, ash: true,
};
export type CommitTarget = { kind: "directory" | "git-dir"; path: string };
type ShellState = {
	cwd: string;
	initialCwd: string;
	gitDir: string | undefined;
	gitDirExported: boolean;
	gitDirOptional: boolean;
};
type Body = { text: string; end: number };
type Operator = "&&" | "||" | "|" | "&" | ";" | "\n" | "end";
type Segment = { tokens: string[]; quoted: boolean[]; substitutions: string[]; heredocs: string[]; scope?: "(" | ")"; operator: Operator };
type Heredoc = { segment: Segment; delimiter: string; stripTabs: boolean };

function backtickBody(command: string, start: number): Body | null {
	for (let index = start + 1; index < command.length; index++) {
		if (command[index] === "\\") index++;
		else if (command[index] === "`") {
			return { text: command.slice(start + 1, index).replace(/\\([$`\\])/g, "$1"), end: index };
		}
	}
	return null;
}

/** Find a balanced $(...) body, ignoring quoted parentheses and nested substitutions. */
function substitutionBody(command: string, start: number): Body | null {
	let depth = 1;
	let quote = "";
	for (let index = start + 2; index < command.length; index++) {
		const char = command[index]!;
		if (quote === "'") {
			if (char === quote) quote = "";
			continue;
		}
		if (char === "\\") { index++; continue; }
		if (char === quote) { quote = ""; continue; }
		if (!quote && (char === "'" || char === '"')) { quote = char; continue; }
		if (char === "`" || (char === "$" && command[index + 1] === "(")) {
			const nested = char === "`" ? backtickBody(command, index) : substitutionBody(command, index);
			if (nested === null) return null;
			index = nested.end;
			continue;
		}
		if (quote) continue;
		if (char === "(") depth++;
		if (char === ")" && --depth === 0) return { text: command.slice(start + 2, index), end: index };
	}
	return null;
}

/** Quote-aware shell words; heredoc bodies never become outer commands or cwd changes. */
function segments(command: string): Segment[] {
	const result: Segment[] = [];
	const pending: Heredoc[] = [];
	let segment: Segment = { tokens: [], quoted: [], substitutions: [], heredocs: [], operator: "end" };
	let token = "";
	let started = false;
	let tokenQuoted = false;
	let quote = "";
	let heredoc: { stripTabs: boolean } | null = null;
	const endToken = () => {
		if (!started) return;
		if (heredoc) {
			pending.push({ segment, delimiter: token, stripTabs: heredoc.stripTabs });
			heredoc = null;
		} else {
			segment.tokens.push(token);
			segment.quoted.push(tokenQuoted);
		}
		token = "";
		started = false;
		tokenQuoted = false;
	};
	const endSegment = (operator?: Operator) => {
		endToken();
		const nonempty = segment.tokens.length > 0 || segment.substitutions.length > 0;
		if (nonempty) result.push(segment);
		const previous = result[result.length - 1];
		const continued = !nonempty && operator === "\n" && previous && ["&&", "||", "|"].includes(previous.operator);
		if (operator && previous && !continued) previous.operator = operator;
		segment = { tokens: [], quoted: [], substitutions: [], heredocs: [], operator: "end" };
	};
	for (let index = 0; index < command.length; index++) {
		const char = command[index]!;
		if (quote === "'") {
			if (char === quote) quote = "";
			else token += char;
			continue;
		}
		if (char === "\\" && index + 1 < command.length) {
			const next = command[index + 1]!;
			if (!quote || '$`"\\\n'.includes(next)) {
				// A backslash-newline is removed before word recognition; only a real escape quotes the word.
				if (next !== "\n") { token += next; started = true; tokenQuoted = true; }
				index++;
				continue;
			}
		}
		if (char === quote) { quote = ""; continue; }
		if (!quote && (char === '"' || char === "'")) { quote = char; started = true; tokenQuoted = true; continue; }
		if (!heredoc && (char === "`" || (char === "$" && command[index + 1] === "("))) {
			const body = char === "`" ? backtickBody(command, index) : substitutionBody(command, index);
			if (body !== null) {
				segment.substitutions.push(body.text);
				token += command.slice(index, body.end + 1);
				started = true;
				index = body.end;
				continue;
			}
		}
		if (quote) { token += char; continue; }
		if (char === "#" && !started) {
			while (index < command.length && command[index] !== "\n") index++;
			index--;
			continue;
		}
		if (char === "<" && command[index + 1] === "<" && command[index + 2] !== "<") {
			endToken();
			const stripTabs = command[index + 2] === "-";
			heredoc = { stripTabs };
			index += stripTabs ? 2 : 1;
			continue;
		}
		if (char === "\n") {
			endSegment("\n");
			let cursor = index + 1;
			for (const document of pending) {
				const body: string[] = [];
				while (cursor < command.length) {
					const newline = command.indexOf("\n", cursor);
					const end = newline < 0 ? command.length : newline;
					let line = command.slice(cursor, end);
					if (document.stripTabs) line = line.replace(/^\t+/, "");
					cursor = newline < 0 ? command.length : newline + 1;
					if (line === document.delimiter) break;
					body.push(line);
				}
				document.segment.heredocs.push(body.join("\n"));
			}
			pending.length = 0;
			index = cursor - 1;
			continue;
		}
		if (char === "(" || char === ")") {
			endSegment();
			result.push({ tokens: [], quoted: [], substitutions: [], heredocs: [], scope: char, operator: "end" });
			continue;
		}
		if (/\s/.test(char)) { endToken(); continue; }
		if (char === "|" || char === "&" || char === ";") {
			const doubled = char !== ";" && command[index + 1] === char;
			endSegment(doubled ? char === "|" ? "||" : "&&" : char);
			if (doubled) index++;
			continue;
		}
		token += char;
		started = true;
	}
	endSegment("end");
	return result;
}

/** Git/env/sudo use physical path traversal: collapsing .. before a symlink changes the repo. */
function physicalPath(base: string, directory: string): string {
	return directory === "" ? base : isAbsolute(directory) ? directory : `${base}/${directory}`;
}

function unionStates(...groups: readonly ShellState[][]): ShellState[] {
	const seen = new Set<string>();
	const result: ShellState[] = [];
	for (const group of groups) {
		for (const state of group) {
			const key = JSON.stringify([state.cwd, state.initialCwd, state.gitDir, state.gitDirExported, state.gitDirOptional]);
			if (seen.has(key)) continue;
			seen.add(key);
			result.push(state);
		}
	}
	return result;
}

/** Git resolves a relative git dir after all -C options, regardless of option order. */
function commitTargets(tokens: readonly string[], start: number, state: ShellState, targets: CommitTarget[]): void {
	let directory = state.cwd;
	let gitDir = state.gitDir;
	let definiteGitDir = state.gitDirExported && !state.gitDirOptional;
	let index = start + 1;
	while (index < tokens.length) {
		const token = tokens[index]!;
		if (VALUE_OPTIONS[token] === true) {
			if (tokens[index + 1] === undefined) return;
			if (token === "-C") directory = physicalPath(directory, tokens[index + 1]!);
			if (token === "--git-dir") { gitDir = tokens[index + 1]!; definiteGitDir = true; }
			index += 2;
		} else if (token.startsWith("-C") && token.length > 2) {
			directory = physicalPath(directory, token.slice(2));
			index++;
		} else if (token.startsWith("--git-dir=")) {
			gitDir = token.slice("--git-dir=".length);
			definiteGitDir = true;
			index++;
		} else if (token.startsWith("-")) index++;
		else break;
	}
	if (tokens[index] !== "commit") return;
	// A bare assignment may retain an inherited export flag; neither candidate is safe to discard.
	if (gitDir === undefined || !definiteGitDir) targets.push({ kind: "directory", path: directory });
	if (gitDir !== undefined) targets.push({ kind: "git-dir", path: physicalPath(directory, gitDir) });
}

/** Prefix cwd/env changes belong to the invoked command, never its caller. */
function prefixOptions(tokens: string[], quoted: boolean[], start: number, states: ShellState[], sudo: boolean): number {
	let index = start + 1;
	let options = true;
	for (; index < tokens.length; index++) {
		const token = tokens[index]!;
		if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(token)) {
			if (token.startsWith("GIT_DIR=")) {
				for (const state of states) {
					state.gitDir = token.slice("GIT_DIR=".length);
					state.gitDirExported = true;
					state.gitDirOptional = false;
				}
			}
			continue;
		}
		if (token === "--" && options) { options = false; continue; }
		if (!options) break;
		if (!sudo) {
			const shortSplit = /^-([iv0]*)S(.*)$/.exec(token);
			const separateSplit = token === "--split-string" || (shortSplit !== null && shortSplit[2] === "");
			const split = separateSplit ? tokens[index + 1] ?? ""
				: shortSplit?.[2] ?? (token.startsWith("--split-string=") ? token.slice("--split-string=".length) : undefined);
			if (split !== undefined) {
				const flags = shortSplit?.[1] ? [`-${shortSplit[1]}`] : [];
				// env inserts the split words before the remaining argv, including its own options.
				const words = [...flags, ...segments(split).flatMap(segment => segment.tokens)];
				tokens.splice(index, separateSplit ? 2 : 1, ...words);
				quoted.splice(index, separateSplit ? 2 : 1, ...words.map(() => true));
				index--;
				continue;
			}
		}
		if (token === (sudo ? "-D" : "-C") || token === "--chdir") {
			const directory = tokens[++index];
			if (directory !== undefined) for (const state of states) state.cwd = physicalPath(state.cwd, directory);
		} else if (token.startsWith("--chdir=")) {
			for (const state of states) state.cwd = physicalPath(state.cwd, token.slice("--chdir=".length));
		} else if (token.startsWith(sudo ? "-D" : "-C") && token.length > 2) {
			for (const state of states) state.cwd = physicalPath(state.cwd, token.slice(2));
		} else if (!sudo && (token === "--ignore-environment" || token === "-" || (/^-[iv0]+$/.test(token) && token.includes("i")))) {
			for (const state of states) {
				state.gitDir = undefined;
				state.gitDirExported = false;
				state.gitDirOptional = false;
			}
		} else if (!sudo && (token === "-u" || token === "--unset" || token.startsWith("--unset="))) {
			const name = token.startsWith("--unset=") ? token.slice("--unset=".length) : tokens[++index];
			if (name === "GIT_DIR") {
				for (const state of states) {
					state.gitDir = undefined;
					state.gitDirExported = false;
					state.gitDirOptional = false;
				}
			}
		} else if (sudo && ["-u", "--user", "-g", "--group", "-h", "--host", "-p", "--prompt", "-R", "--chroot", "-T", "--command-timeout"].includes(token)) {
			index++;
		} else if (!token.startsWith("-")) break;
	}
	return index;
}

function inspectSegment(segment: Segment, states: ShellState[], targets: CommitTarget[], conditionalDepth: number): ShellState[] {
	for (const body of segment.substitutions) {
		inspect(body, states.map(state => ({ ...state, initialCwd: state.cwd })), targets, conditionalDepth);
	}
	const tokens = segment.tokens;
	const local = states.map(state => ({ ...state }));
	let head = true;
	let temporary = false;
	for (let index = 0; index < tokens.length; index++) {
		const token = tokens[index]!;
		const name = basename(token);
		if (head && /^(?:command|builtin|exec)$/.test(token)) continue;
		if (head && !segment.quoted[index] && /^(?:!|\{|\}|if|then|elif|else|fi|while|until|for|select|do|done|case|esac|time|\[\[|function)$/.test(token)) {
			if (/^(?:fi|done|esac|\}|\[\[|function)$/.test(token)) head = false;
			continue;
		}
		if (head && /^[A-Za-z_][A-Za-z0-9_]*=/.test(token)) {
			if (token.startsWith("GIT_DIR=")) {
				for (const state of local) {
					state.gitDir = token.slice("GIT_DIR=".length);
					state.gitDirExported = true;
					state.gitDirOptional = false;
				}
			}
			if (index === tokens.length - 1 && !temporary) {
				states = states.map((state, index) => ({ ...state, gitDir: local[index]!.gitDir, gitDirOptional: local[index]!.gitDirOptional }));
			}
			continue;
		}
		if (name === "env" || name === "sudo") {
			index = prefixOptions(tokens, segment.quoted, index, local, name === "sudo") - 1;
			temporary = true;
			continue;
		}
		if (head && token.startsWith("-")) continue;
		if (head && (name === "cd" || name === "pushd")) {
			const directory = tokens[index + 1] === "--" ? tokens[index + 2] : tokens[index + 1];
			for (const state of local) {
				state.cwd = directory === undefined || directory === "-" ? state.initialCwd : resolve(state.cwd, directory);
			}
			if (!temporary) states = states.map((state, index) => ({ ...state, cwd: local[index]!.cwd }));
		} else if (head && name === "export") {
			for (const assignment of tokens.slice(index + 1)) {
				if (assignment !== "GIT_DIR" && !assignment.startsWith("GIT_DIR=")) continue;
				for (const state of local) {
					if (assignment.startsWith("GIT_DIR=")) {
						state.gitDir = assignment.slice("GIT_DIR=".length);
						state.gitDirOptional = false;
					}
					state.gitDirExported = !tokens.includes("-n");
				}
				if (!temporary) {
					states = states.map((state, index) => ({
						...state, gitDir: local[index]!.gitDir,
						gitDirExported: local[index]!.gitDirExported, gitDirOptional: local[index]!.gitDirOptional,
					}));
				}
			}
		} else if (head && name === "unset") {
			if (tokens.slice(index + 1).includes("GIT_DIR")) {
				for (const state of local) {
					state.gitDir = undefined;
					state.gitDirExported = false;
					state.gitDirOptional = false;
				}
				if (!temporary) states = states.map(state => ({ ...state, gitDir: undefined, gitDirExported: false, gitDirOptional: false }));
			}
		} else if (name === "git") {
			const candidates: CommitTarget[] = [];
			for (const state of local) commitTargets(tokens, index, state, candidates);
			const seen = new Set<string>();
			for (const target of candidates) {
				const key = JSON.stringify([target.kind, target.path]);
				if (seen.has(key)) continue;
				seen.add(key);
				targets.push(target);
			}
		} else if (name === "eval") {
			const after = inspect(tokens.slice(index + 1).join(" "), local, targets, conditionalDepth);
			if (head && !temporary) states = after;
			break;
		} else if (SHELLS[name] === true || (name === "busybox" && SHELLS[basename(tokens[index + 1] ?? "")] === true)) {
			let optionIndex = index + (name === "busybox" ? 2 : 1);
			let stdin = false;
			let script: string | undefined;
			for (; optionIndex < tokens.length; optionIndex++) {
				const option = tokens[optionIndex]!;
				if (option === "--") { optionIndex++; break; }
				if (!option.startsWith("-")) break;
				if (/^-[^-]*c/.test(option)) { script = tokens[optionIndex + 1] ?? ""; break; }
				if (/^-[^-]*s/.test(option)) stdin = true;
				if (["-o", "-O", "--rcfile", "--init-file"].includes(option)) optionIndex++;
			}
			const bodies = script !== undefined ? [script] : stdin || optionIndex === tokens.length ? segment.heredocs : [];
			for (const body of bodies) {
				// A new shell cannot export a value its caller might not have exported to it.
				inspect(body, local.map(state => ({
					...state, initialCwd: state.cwd, gitDirOptional: state.gitDirOptional || !state.gitDirExported,
				})), targets, conditionalDepth);
			}
			if (script !== undefined) index = optionIndex + 1;
		}
		head = false;
	}
	return unionStates(states);
}

function inspect(command: string, states: ShellState[], targets: CommitTarget[], conditionalDepth = 0): ShellState[] {
	let chain: ShellState[] = [];
	const scopes: { states: ShellState[]; chain: ShellState[]; conditionalDepth: number }[] = [];
	for (const segment of segments(command)) {
		if (segment.scope === "(") {
			scopes.push({ states, chain, conditionalDepth });
			chain = [];
			continue;
		}
		if (segment.scope === ")") {
			const outer = scopes.pop();
			if (outer) ({ states, chain, conditionalDepth } = outer);
		}
		const before = states;
		const previousDepth = conditionalDepth;
		for (let index = 0; index < segment.tokens.length; index++) {
			const token = segment.tokens[index]!;
			if (/^(?:command|builtin|exec)$/.test(token)) continue;
			if (segment.quoted[index]) break;
			if (/^(?:if|while|until|for|select|case)$/.test(token)) conditionalDepth++;
			else if (/^(?:fi|done|esac)$/.test(token)) { conditionalDepth = Math.max(0, conditionalDepth - 1); break; }
			else if (!/^(?:!|\{|then|elif|else|do|time)$/.test(token)) break;
		}
		let after = inspectSegment(segment, states, targets, conditionalDepth);
		if (previousDepth || conditionalDepth || segment.operator === "|" || segment.operator === "&") after = unionStates(before, after);
		// && needs the predecessor's success state; || and later chains may follow any earlier exit.
		chain = unionStates(chain, after);
		states = segment.operator === "&&" || segment.operator === "|" ? after : chain;
		if (segment.operator !== "&&" && segment.operator !== "||" && segment.operator !== "|") chain = [];
	}
	return states;
}

/** Resolve every inspected commit, preserving command/substitution order and target kind. */
export function resolveTarget(command: string, cwd: string): CommitTarget[] {
	const targets: CommitTarget[] = [];
	const directory = isAbsolute(cwd) ? cwd : resolve(cwd);
	inspect(command, [{ cwd: directory, initialCwd: directory, gitDir: undefined, gitDirExported: false, gitDirOptional: false }], targets);
	return targets;
}

async function hook(targets: readonly CommitTarget[]): Promise<number> {
	let defaultBranch: string;
	try {
		try {
			const config = JSON.parse(await readFile(join(import.meta.dir, "..", CONFIG_PATH), "utf8"));
			if (typeof config.defaultBranch !== "string" || !config.defaultBranch.trim() || /[\r\n\0]/.test(config.defaultBranch)) {
				throw new Error(`${CONFIG_PATH}: defaultBranch must be a nonempty single-line string`);
			}
			defaultBranch = config.defaultBranch;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
			defaultBranch = "main";
		}
	} catch (error) {
		console.error(`Cannot read ${CONFIG_PATH}: ${String(error)}`);
		return 2;
	}
	// Fail open per unreadable branch, without skipping any later commit targets.
	for (const target of targets) {
		const selector = target.kind === "git-dir" ? [`--git-dir=${target.path}`] : ["-C", target.path];
		const branch = spawnSync("git", [...selector, "branch", "--show-current"], { encoding: "utf8", timeout: 5000 });
		if (branch.status !== 0 || branch.stdout.trim() !== defaultBranch) continue;
		console.error(
			`Direct commits to ${defaultBranch} are blocked in ${target.path} (docs/process/git-flow.md). Create a task branch in the target repo first:\n` +
			`  git ${selector.join(" ")} checkout -b task/NNNN-<slug>   (branch name = plan filename in docs/plans/)\n` +
			`Landing on ${defaultBranch}: follow docs/process/git-flow.md after review + human sign-off.`,
		);
		return 2;
	}
	return 0;
}

async function main(): Promise<number> {
	if (process.argv.length > 2 && (process.argv.length !== 3 || process.argv[2] !== "--hook")) {
		console.error("Usage: bun tools/guard-main.ts [--hook] < command.json");
		return 2;
	}
	let command: string;
	let cwd: string;
	try {
		const payload = JSON.parse(await Bun.stdin.text());
		const input = payload?.tool_input ?? payload;
		if (input === null || typeof input !== "object" || Array.isArray(input)
			|| (input.command !== undefined && typeof input.command !== "string")
			|| (input.cwd !== undefined && typeof input.cwd !== "string")) throw new Error("expected {command, cwd}");
		command = input.command ?? "";
		cwd = input.cwd || ".";
	} catch (error) {
		console.error(`Cannot read guard input: ${String(error)}`);
		return 2;
	}
	const targets = resolveTarget(command, cwd);
	if (process.argv[2] === "--hook") return targets.length === 0 ? 0 : hook(targets);
	if (targets.length === 0) console.log("SKIP");
	else for (const target of targets) console.log(JSON.stringify(target));
	return 0;
}

if (import.meta.main) process.exitCode = await main();
