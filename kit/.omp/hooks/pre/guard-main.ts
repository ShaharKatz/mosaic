// tool_call(bash) adapter: block commits on the configured default branch.
// The shared resolver follows every commit target, including explicit git dirs and inline scripts.
// Binds LLM sessions only — a human terminal is the escape hatch.
// Landing policy lives in docs/process/git-flow.md, not in this commit guard.
// tool_call payload: {"toolName":"bash","input":{"command":"git commit -m x","cwd":"/repo"}}
// Read defaultBranch from the installed root's .omp/mosaic.json; if absent, default to main.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { HookAPI } from "@oh-my-pi/pi-coding-agent/extensibility/hooks";
import { resolveTarget } from "../../../tools/guard-main.ts";

const CONFIG_PATH = ".omp/mosaic.json";
async function configuredBranch(): Promise<string> {
	try {
		const config = JSON.parse(await readFile(join(import.meta.dir, "../../..", CONFIG_PATH), "utf8"));
		if (typeof config.defaultBranch !== "string" || !config.defaultBranch.trim() || /[\r\n\0]/.test(config.defaultBranch)) {
			throw new Error(`${CONFIG_PATH}: defaultBranch must be a nonempty single-line string`);
		}
		return config.defaultBranch;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return "main";
		throw error;
	}
}

export default function (pi: HookAPI) {
	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "bash") return;
		const cmd = String(event.input.command ?? "");
		if (!cmd) return;

		// The bash tool runs the command in its `cwd` param; resolution must too.
		const base = String(event.input.cwd ?? "") || ".";
		const targets = resolveTarget(cmd, base);
		if (targets.length === 0) return; // not a git commit — nothing to guard
		let defaultBranch: string;
		try {
			defaultBranch = await configuredBranch();
		} catch (error) {
			return { block: true, reason: `Cannot read ${CONFIG_PATH}: ${String(error)}` };
		}

		// Fail open per unreadable branch, without skipping any later commit targets.
		// The wrapper treats thrown hooks as blocks, so git errors must not escape.
		for (const target of targets) {
			const selector = target.kind === "git-dir" ? [`--git-dir=${target.path}`] : ["-C", target.path];
			let branch = "";
			try {
				const { stdout } = await pi.exec("git", [...selector, "branch", "--show-current"], {
					cwd: ctx.cwd,
					timeout: 5000,
				});
				branch = stdout.trim();
			} catch {
				continue;
			}
			if (branch !== defaultBranch) continue;
			return {
				block: true,
				reason:
					`Direct commits to ${defaultBranch} are blocked in ${target.path} (docs/process/git-flow.md). Create a task branch in the target repo first:\n` +
					`  git ${selector.join(" ")} checkout -b task/NNNN-<slug>   (branch name = plan filename in docs/plans/)\n` +
					`Landing on ${defaultBranch}: follow docs/process/git-flow.md after review + human sign-off.`,
			};
		}
	});
}
