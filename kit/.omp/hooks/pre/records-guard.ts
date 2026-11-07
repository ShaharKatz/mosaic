// Native TTSR scopes match spelling, not physical paths; normalize before the reminder.
import { join } from "node:path";
import type { HookAPI } from "@oh-my-pi/pi-coding-agent/extensibility/hooks";
import { recordsGuardContext } from "../../../tools/records-guard.ts";

// Envelope paths include rename destinations; added source lines are never edit targets.
export function recordTargetPaths(input: Record<string, unknown>): string[] {
	const paths = new Set<string>();
	for (const file of [input.path, ...(Array.isArray(input.paths) ? input.paths : [])]) {
		if (typeof file === "string" && file) paths.add(file);
	}
	if (typeof input.input === "string") for (const line of input.input.split(/\r?\n/)) {
		const file = /^\[(.+)#[0-9A-F]{4}\]\s*$/.exec(line)?.[1]
			?? /^\*\*\* (?:Add|Update|Delete) File: (.+)$/.exec(line)?.[1]
			?? /^\*\*\* Move to: (.+)$/.exec(line)?.[1];
		if (file) paths.add(file);
		else {
			const move = /^MV (.+)$/.exec(line)?.[1]?.trim();
			if (move) paths.add(move.replace(/^(["'])(.*)\1$/, "$2"));
		}
	}
	return [...paths];
}

export default function (pi: HookAPI) {
	const reminded = new Set<string>();
	pi.on("tool_call", (event, ctx) => {
		if (event.toolName !== "edit" && event.toolName !== "write" && event.toolName !== "apply_patch") return;
		try {
			const session = ctx.sessionManager.getSessionId();
			if (reminded.has(session)) return;
			const context = recordsGuardContext(join(import.meta.dir, "../../.."), recordTargetPaths(event.input), "omp", ctx.cwd);
			if (!context) return;
			reminded.add(session);
			return {
				block: true,
				reason: `Governed edit paused for the records reminder. Read it, then retry the same call to proceed; this reminder fires once per session.\n\n${context}`,
			};
		} catch { /* Reminder failures must never block the tool. */ }
	});
}
