#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
	assertAcceptor, CANNOT_EVALUATE, CLEARED, CONFIG_PATH, executionLog, flowValue, gateStatuses, hasIdentity,
	linkRemote, matchFlows, NONE, OK, parseRoster, PENDING, planFrontmatter, projectKey, ROSTER_PATH,
	rosterErrors, userFilePath, validateHandoff, validateUserFile,
	type Handoff, type Person, type PlanFrontmatter, type UserFile,
} from "./constants/handoff.ts";

class InvalidInput extends Error {}
const message = (error: unknown): string => error instanceof Error ? error.message : String(error);
const input = <T>(read: () => T): T => {
	try { return read(); } catch (error) { throw new InvalidInput(message(error)); }
};
const json = (value: unknown): void => console.log(JSON.stringify(value, null, 2));

function context() {
	const config = JSON.parse(readFileSync(resolve(import.meta.dir, "..", CONFIG_PATH), "utf8"));
	if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("runtime metadata must be an object");
	const handoff = validateHandoff(config.handoff, { landing: config.landing?.mode ?? "direct", tracking: config.tracking?.mode ?? "none" });
	const people = parseRoster(readFileSync(resolve(import.meta.dir, "..", ROSTER_PATH), "utf8"));
	const errors = rosterErrors(people, handoff);
	if (errors.length) throw new Error(errors.join("; "));
	return { config, handoff, people };
}

type PersonalFile = { path: string; project: string; handoff: Handoff; people: Person[] };
function personal(config: Record<string, unknown>, handoff: Handoff, people: Person[]): PersonalFile {
	const project = projectKey(linkRemote(config));
	return { path: userFilePath(process.env, project), project, handoff, people };
}

function readUser(location: PersonalFile) {
	let text: string;
	try { text = readFileSync(location.path, "utf8"); }
	catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return { path: location.path, exists: false, valid: true } as const;
		throw error;
	}
	try {
		const content = validateUserFile(JSON.parse(text), location);
		return { path: location.path, exists: true, valid: true, content } as const;
	} catch (error) {
		return { path: location.path, exists: true, valid: false, error: message(error) } as const;
	}
}

function resolvePlan(plan: PlanFrontmatter, handoff: Handoff, people: Person[], user?: UserFile) {
	const selected = input(() => flowValue(plan.flow, handoff));
	if (selected.kind === "tbd" && plan.status !== "draft") throw new InvalidInput("flow: TBD is only allowed while status: draft");
	for (const [role, handle] of Object.entries(plan.acceptors)) input(() => assertAcceptor(role, handle, handoff, people, "plan acceptors"));
	let flow: string | null;
	let source: "plan" | "user" | "areas" | "default";
	let candidates: string[] = [];
	if (selected.kind === "flow" || selected.kind === "none") {
		flow = selected.kind === "flow" ? selected.id : NONE;
		source = "plan";
	} else if (user?.defaults?.flow !== undefined) {
		flow = user.defaults.flow;
		source = "user";
	} else {
		candidates = matchFlows(handoff, plan.areas);
		flow = candidates.length === 1 ? candidates[0]! : candidates.length ? null : NONE;
		source = candidates.length ? "areas" : "default";
	}
	// The acceptor is someone other than the contributor; the user file's `me` is the contributor on this machine.
	const notContributor = (person: Person, label: string): Person => {
		if (person.handle === user?.me) throw new InvalidInput(`${label}: ${person.handle} is the contributor and cannot accept their own change`);
		return person;
	};
	const gates = (handoff.flows.find(entry => entry.id === flow)?.gates ?? []).map(gate => {
		let person: Person | undefined;
		let acceptorSource: "plan" | "user" | "only-holder" | null = null;
		if (plan.acceptors[gate.role] !== undefined) {
			person = notContributor(input(() => assertAcceptor(gate.role, plan.acceptors[gate.role], handoff, people, "plan acceptors")), "plan acceptors");
			acceptorSource = "plan";
		} else if (user?.defaults?.acceptors?.[gate.role] !== undefined) {
			person = notContributor(input(() => assertAcceptor(gate.role, user.defaults!.acceptors![gate.role], handoff, people, "user file defaults.acceptors")), "user file defaults.acceptors");
			acceptorSource = "user";
		} else if (user) {
			// Picking the only holder is safe only when the contributor is known and excluded; otherwise ask the human.
			const holders = people.filter(entry => entry.roles.includes(gate.role) && entry.handle !== user.me);
			if (holders.length === 1) { person = holders[0]; acceptorSource = "only-holder"; }
		}
		const post = person ? person.prefers.surface ? [person.prefers.surface] : gate.surfaces.filter(surface => hasIdentity(person!, surface)) : [];
		const include = person?.prefers.artifacts ? gate.artifacts.filter(artifact => artifact === "pr" || person!.prefers.artifacts!.includes(artifact)) : gate.artifacts;
		const acceptor = person ? { handle: person.handle, trackerId: person.trackerId, mention: person.mention, githubLogin: person.githubLogin } : null;
		return { ...gate, acceptor, acceptorSource, post, include, requestReview: handoff.requestReview && post.includes("pr-review") };
	});
	return { flow, source, candidates, gates };
}

function main(): void {
	const [command, ...args] = Bun.argv.slice(2);
	if (!["resolve", "status", "user", "roster"].includes(command ?? "")) throw new InvalidInput("usage: bun tools/handoff.ts resolve|status --plan <path> | user [--write --me @handle] | roster [--role <role>]");
	if (command === "resolve" || command === "status") {
		const { values } = input(() => parseArgs({ args, strict: true, options: { plan: { type: "string" } } }));
		if (!values.plan) throw new InvalidInput(`${command} requires --plan <path>`);
		const { config, handoff, people } = context();
		const markdown = readFileSync(resolve(values.plan), "utf8");
		if (command === "resolve") {
			const user = readUser(personal(config, handoff, people));
			if (!user.valid) throw new InvalidInput(user.error);
			const result = resolvePlan(input(() => planFrontmatter(markdown)), handoff, people, user.content);
			json(result);
			process.exitCode = result.flow === null || result.gates.some(gate => gate.acceptor === null) ? PENDING : OK;
		} else {
			const plan = planFrontmatter(markdown);
			const flow = flowValue(plan.flow, handoff);
			if (flow.kind === "tbd") throw new Error("flow: TBD cannot be evaluated; confirm a flow before approval");
			if (flow.kind === "absent") throw new Error("plan has no flow:; record a flow id or `none — <reason>` (an in-flight plan that predates the module: `none — predates handoff`)");
			const gates = flow.kind === "flow" ? gateStatuses(executionLog(markdown), handoff.flows.find(entry => entry.id === flow.id)!, people) : [];
			const cleared = gates.every(gate => CLEARED.includes(gate.state));
			json({ flow: flow.kind === "flow" ? flow.id : NONE, source: "plan", cleared, gates });
			process.exitCode = cleared ? OK : PENDING;
		}
	} else if (command === "roster") {
		const { values } = input(() => parseArgs({ args, strict: true, options: { role: { type: "string" } } }));
		const { people } = context();
		json(values.role === undefined ? people : people.filter(person => person.roles.includes(values.role!)));
	} else {
		const { values } = input(() => parseArgs({ args, strict: true, options: {
			write: { type: "boolean" }, me: { type: "string" }, flow: { type: "string" }, acceptor: { type: "string", multiple: true },
		} }));
		if (!values.write && (values.me !== undefined || values.flow !== undefined || values.acceptor !== undefined)) throw new InvalidInput("--me, --flow and --acceptor require user --write");
		const { config, handoff, people } = context();
		const location = personal(config, handoff, people);
		if (!values.write) {
			const result = readUser(location);
			json(result);
			if (!result.valid) { console.error(`handoff: ${result.error}`); process.exitCode = PENDING; }
			return;
		}
		const acceptors: Record<string, string> = Object.create(null);
		for (const assignment of values.acceptor ?? []) {
			const separator = assignment.indexOf("=");
			if (separator < 1) throw new InvalidInput("--acceptor must be <role>=@handle");
			const role = assignment.slice(0, separator);
			if (Object.hasOwn(acceptors, role)) throw new InvalidInput(`--acceptor names ${role} twice`);
			acceptors[role] = assignment.slice(separator + 1);
		}
		const content = input(() => validateUserFile({ schema: 1, project: location.project, me: values.me,
			...(values.flow !== undefined || values.acceptor !== undefined ? { defaults: {
				...(values.flow !== undefined ? { flow: values.flow } : {}), ...(values.acceptor !== undefined ? { acceptors } : {}),
			} } : {}),
		}, location));
		mkdirSync(dirname(location.path), { recursive: true });
		writeFileSync(location.path, `${JSON.stringify(content, null, 2)}\n`);
		json({ path: location.path, written: true });
	}
}

if (import.meta.main) {
	try { main(); }
	catch (error) {
		console.error(`handoff: ${message(error)}`);
		process.exitCode = error instanceof InvalidInput ? PENDING : CANNOT_EVALUATE;
	}
}
