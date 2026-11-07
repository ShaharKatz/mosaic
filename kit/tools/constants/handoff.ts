// Handoff vocabulary shared by the installer, doctor, lint, tools/handoff.ts and their smokes.
// One module owns every grammar: runtime metadata, roster, preview card, user file, plan
// frontmatter and Execution-log lines. Callers never re-parse these formats themselves.
import { basename, join } from "node:path";

export const SURFACES = ["tracker-reply", "pr-review"] as const;
export const ARTIFACTS = ["pr", "preview"] as const;
export type Surface = (typeof SURFACES)[number];
export type Artifact = (typeof ARTIFACTS)[number];
export type Gate = { role: string; surfaces: Surface[]; artifacts: Artifact[]; state?: string };
export type Flow = { id: string; areas?: string[]; when?: string; gates: Gate[] };
export type Handoff = { flows: Flow[]; preview?: string; requestReview: boolean; notify?: { slack: { server: string; channel?: string } } };
export type Prefers = { surface?: Surface; artifacts?: Artifact[] };
export type Person = { handle: string; roles: string[]; trackerId?: string; mention?: string; githubLogin?: string; slackId?: string; prefers: Prefers };
export type UserFile = { schema: 1; project: string; me: string; defaults?: { flow?: string; acceptors?: Record<string, string> } };

export const CONFIG_PATH = ".omp/mosaic.json";
export const ROSTER_PATH = "docs/surfaces/people.md";
export const ROSTER_HEADER = "| Handle | Roles | Tracker id | Tracker mention | GitHub login | Slack id | Prefers |";
export const LINK_REPO = "link-repo";
export const NONE = "none";
export const TBD = "TBD";
export const PREVIEW_HEADINGS = ["Produce", "Served commit", "Access and classification", "Lifetime and teardown"] as const;
export const OK = 0;
export const PENDING = 1;
export const CANNOT_EVALUATE = 2;

const ID = /^[a-z][a-z0-9-]*$/;
// Removing @ must produce a valid final component of roster/<handle> without rewriting identity.
const HANDLE = /^@(?!.*(?:\.\.|\.lock$))[a-z0-9](?:[a-z0-9._-]*[a-z0-9_-])?$/;
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
const EMPTY = "—";
const ROSTER_FIELDS = ["handle", "roles", "trackerId", "mention", "githubLogin", "slackId", "prefers"] as const;
export type RosterFields = { handle: string } & Partial<Record<(typeof ROSTER_FIELDS)[number], string>>;
// Strip a trailing ` # comment`; values in this module's frontmatter fields never contain " #".
const COMMENT = /\s+#.*$/;

function record(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
function singleLine(value: unknown): value is string {
	return typeof value === "string" && !!value.trim() && !/[\r\n\0|]/.test(value) && !value.includes("\u007b\u007b");
}
function onlyKeys(value: Record<string, unknown>, keys: string[], label: string): void {
	const extra = Object.keys(value).filter(key => !keys.includes(key));
	if (extra.length) throw new Error(`${label} has unsupported keys: ${extra.join(", ")}`);
}

/** Same safety predicate as review.specialists globs: repository-relative, no traversal or shell-like syntax. */
export function safeGlob(glob: unknown): glob is string {
	return typeof glob === "string" && !!glob.trim() && !/^[\\/]/.test(glob) && !/[\\\r\n\0()|`]/.test(glob)
		&& !glob.includes("\u007b\u007b") && !glob.split("/").some(part => !part || part === "." || part === "..");
}
export function safeMarkdownPath(path: unknown): path is string {
	return safeGlob(path) && !/[*?[\]{}]/.test(path) && path.endsWith(".md");
}

/**
 * Validate the install manifest's or runtime metadata's `handoff` object and return its normalized form.
 * Phase 1 requires pull-request landing; `tracker-reply` needs a tracker; `state` maps the handoff event to a
 * team-native state and exists only in MCP tracking (local replay uses the event name as its state).
 */
export function validateHandoff(value: unknown, context: { landing: string; tracking: string }): Handoff {
	if (!record(value)) throw new Error("handoff must be an object");
	onlyKeys(value, ["flows", "preview", "requestReview", "notify"], "handoff");
	if (context.landing !== "pull-request") throw new Error("handoff requires landing.mode: pull-request");
	if (!Array.isArray(value.flows) || !value.flows.length) throw new Error("handoff.flows must be a nonempty array");
	if (value.preview !== undefined && !safeMarkdownPath(value.preview)) throw new Error("handoff.preview must be a safe repository-relative .md path");
	if (value.requestReview !== undefined && typeof value.requestReview !== "boolean") throw new Error("handoff.requestReview must be a boolean");
	let notify: Handoff["notify"];
	if (value.notify !== undefined) {
		if (!record(value.notify)) throw new Error("handoff.notify must be an object");
		onlyKeys(value.notify, ["slack"], "handoff.notify");
		const slack = value.notify.slack;
		if (!record(slack)) throw new Error("handoff.notify.slack must be an object");
		onlyKeys(slack, ["server", "channel"], "handoff.notify.slack");
		if (typeof slack.server !== "string" || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(slack.server)) {
			throw new Error("handoff.notify.slack.server must be a nonempty single-line server slug");
		}
		if (slack.channel !== undefined && !singleLine(slack.channel)) throw new Error("handoff.notify.slack.channel must be a nonempty single-line string");
		notify = { slack: { server: slack.server, ...(slack.channel !== undefined ? { channel: slack.channel as string } : {}) } };
	}
	const ids = new Set<string>();
	const flows = value.flows.map((entry, index): Flow => {
		const label = `handoff.flows[${index}]`;
		if (!record(entry)) throw new Error(`${label} must be an object`);
		onlyKeys(entry, ["id", "areas", "when", "gates"], label);
		if (typeof entry.id !== "string" || !ID.test(entry.id) || entry.id === NONE || entry.id === TBD.toLowerCase()) throw new Error(`${label}.id must be a lowercase slug other than none/tbd`);
		if (ids.has(entry.id)) throw new Error(`${label}.id is duplicate: ${entry.id}`);
		ids.add(entry.id);
		if (entry.when !== undefined && !singleLine(entry.when)) throw new Error(`${label}.when must be a nonempty single-line string`);
		let areas: string[] | undefined;
		if (entry.areas !== undefined) {
			if (!Array.isArray(entry.areas) || !entry.areas.length || !entry.areas.every(safeGlob)) throw new Error(`${label}.areas must be a nonempty array of safe repository-relative globs`);
			if (new Set(entry.areas).size !== entry.areas.length) throw new Error(`${label}.areas has duplicates`);
			areas = [...entry.areas] as string[];
		}
		if (!Array.isArray(entry.gates) || !entry.gates.length) throw new Error(`${label}.gates must be a nonempty array`);
		const roles = new Set<string>();
		const gates = entry.gates.map((raw, gateIndex): Gate => {
			const gateLabel = `${label}.gates[${gateIndex}]`;
			if (!record(raw)) throw new Error(`${gateLabel} must be an object`);
			onlyKeys(raw, ["role", "surfaces", "artifacts", "state"], gateLabel);
			if (typeof raw.role !== "string" || !ID.test(raw.role)) throw new Error(`${gateLabel}.role must be a lowercase slug`);
			if (roles.has(raw.role)) throw new Error(`${gateLabel}.role repeats ${raw.role}; one gate per role in a flow`);
			roles.add(raw.role);
			if (!Array.isArray(raw.surfaces) || !raw.surfaces.length || !raw.surfaces.every(surface => (SURFACES as readonly unknown[]).includes(surface))
				|| new Set(raw.surfaces).size !== raw.surfaces.length) throw new Error(`${gateLabel}.surfaces must be unique values from ${SURFACES.join(", ")}`);
			const surfaces = raw.surfaces as Surface[];
			if (surfaces.includes("tracker-reply") && context.tracking === "none") throw new Error(`${gateLabel}.surfaces: tracker-reply requires tracking.mode local or mcp`);
			const artifacts = raw.artifacts === undefined ? ["pr"] : raw.artifacts;
			if (!Array.isArray(artifacts) || !artifacts.every(artifact => (ARTIFACTS as readonly unknown[]).includes(artifact))
				|| new Set(artifacts).size !== artifacts.length || !artifacts.includes("pr")) throw new Error(`${gateLabel}.artifacts must be unique values from ${ARTIFACTS.join(", ")} and include pr`);
			if (artifacts.includes("preview") && value.preview === undefined) throw new Error(`${gateLabel}.artifacts: preview requires handoff.preview (the project's preview card)`);
			const gate: Gate = { role: raw.role, surfaces: [...surfaces], artifacts: [...artifacts] as Artifact[] };
			if (raw.state !== undefined) {
				if (context.tracking !== "mcp") throw new Error(`${gateLabel}.state maps the handoff event to a tracker state and requires tracking.mode: mcp`);
				if (!singleLine(raw.state)) throw new Error(`${gateLabel}.state must be a nonempty single-line string`);
				gate.state = raw.state;
			}
			return gate;
		});
		return { id: entry.id, ...(areas ? { areas } : {}), ...(entry.when !== undefined ? { when: entry.when as string } : {}), gates };
	});
	return { flows, ...(value.preview !== undefined ? { preview: value.preview as string } : {}), requestReview: value.requestReview ?? true, ...(notify ? { notify } : {}) };
}

function listOf<T extends string>(text: string, allowed: readonly T[], label: string): T[] {
	const values = text.split(",").map(value => value.trim());
	if (!values.every(value => (allowed as readonly string[]).includes(value)) || new Set(values).size !== values.length) {
		throw new Error(`${label} must list unique values from ${allowed.join(", ")}`);
	}
	return values as T[];
}

/** Locate the one supported roster table, retaining line endings for byte-preserving writes. */
function rosterTable(markdown: string) {
	const lines = markdown.split(/(?<=\n)/);
	const start = lines.findIndex(line => line.trim() === ROSTER_HEADER);
	if (start < 0) throw new Error(`roster requires the 7-column header (including Slack id): ${ROSTER_HEADER}`);
	if (!/^\|(?:\s*:?-{3,}:?\s*\|){7}$/.test(lines[start + 1]?.trim() ?? "")) throw new Error("roster table header must be followed by its separator row");
	let end = start + 2;
	while (end < lines.length && lines[end]!.trim().startsWith("|")) end++;
	return { lines, start: start + 2, end };
}

function rosterCells(line: string): string[] {
	const trimmed = line.trim();
	if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) throw new Error(`roster row is not a table row: ${line}`);
	const cells = trimmed.slice(1, -1).split("|");
	if (cells.length !== ROSTER_FIELDS.length) throw new Error(`roster row must have 7 cells: ${line}`);
	return cells;
}

/** Parse the roster table (first table whose header equals ROSTER_HEADER). Rows end at the first non-table line. */
export function parseRoster(markdown: string): Person[] {
	const { lines, start, end } = rosterTable(markdown);
	const people: Person[] = [];
	const handles = new Set<string>();
	// One account belongs to one person; GitHub logins are case-insensitive.
	const trackerIds = new Set<string>();
	const logins = new Set<string>();
	const slackIds = new Set<string>();
	for (const line of lines.slice(start, end)) {
		const [handle, roles, trackerId, mention, login, slackId, prefers] = rosterCells(line).map(cell => {
			const value = cell.trim();
			return value === EMPTY || value === "" ? undefined : value;
		});
		if (!handle || !HANDLE.test(handle)) throw new Error(`roster handle must be @name and branch-safe (no consecutive dots, trailing dot or .lock suffix): ${line}`);
		if (handles.has(handle)) throw new Error(`roster handle is duplicate: ${handle}`);
		handles.add(handle);
		const roleList = (roles ?? "").split(",").map(role => role.trim());
		if (!roleList.every(role => ID.test(role)) || new Set(roleList).size !== roleList.length) throw new Error(`${handle}: roles must be unique lowercase slugs`);
		const person: Person = { handle, roles: roleList, prefers: {} };
		if (trackerId !== undefined) {
			if (/\s/.test(trackerId)) throw new Error(`${handle}: tracker id must be one token`);
			if (trackerIds.has(trackerId)) throw new Error(`${handle}: tracker id ${trackerId} already belongs to another roster row`);
			trackerIds.add(trackerId);
			person.trackerId = trackerId;
		}
		if (mention !== undefined) person.mention = mention;
		if (login !== undefined) {
			if (!LOGIN.test(login)) throw new Error(`${handle}: GitHub login is not a valid login`);
			if (logins.has(login.toLowerCase())) throw new Error(`${handle}: GitHub login ${login} already belongs to another roster row`);
			logins.add(login.toLowerCase());
			person.githubLogin = login;
		}
		if (slackId !== undefined) {
			if (/\s/.test(slackId)) throw new Error(`${handle}: Slack id must be one token`);
			if (slackIds.has(slackId)) throw new Error(`${handle}: Slack id ${slackId} already belongs to another roster row`);
			slackIds.add(slackId);
			person.slackId = slackId;
		}
		for (const part of (prefers ?? "").split(";").map(item => item.trim()).filter(Boolean)) {
			const match = /^(surface|artifacts):\s*(\S.*)$/.exec(part);
			if (!match) throw new Error(`${handle}: prefers entries are "surface: <surface>" or "artifacts: <a>, <b>"`);
			if (match[1] === "surface") {
				if (person.prefers.surface !== undefined) throw new Error(`${handle}: prefers names surface twice`);
				const surfaces = listOf(match[2]!, SURFACES, `${handle}: prefers surface`);
				if (surfaces.length !== 1) throw new Error(`${handle}: prefers surface names one surface`);
				person.prefers.surface = surfaces[0];
			} else {
				if (person.prefers.artifacts !== undefined) throw new Error(`${handle}: prefers names artifacts twice`);
				person.prefers.artifacts = listOf(match[2]!, ARTIFACTS, `${handle}: prefers artifacts`);
			}
		}
		people.push(person);
	}
	return people;
}

/** Identity a person needs to be asked on, and to accept on, a surface. */
export function hasIdentity(person: Person, surface: Surface): boolean {
	return surface === "tracker-reply" ? person.trackerId !== undefined : person.githubLogin !== undefined;
}

/** Cross-check the roster against flows: every gate role is held by someone reachable on the gate; a preference never widens a gate. */
export function rosterErrors(people: Person[], handoff: Handoff): string[] {
	const errors = new Set<string>();
	for (const flow of handoff.flows) {
		for (const gate of flow.gates) {
			const holders = people.filter(person => person.roles.includes(gate.role));
			if (!holders.length) errors.add(`flow ${flow.id}: no roster person holds role ${gate.role}`);
			for (const person of holders) {
				if (!gate.surfaces.some(surface => hasIdentity(person, surface))) {
					errors.add(`flow ${flow.id}: ${person.handle} holds ${gate.role} but has no identity on ${gate.surfaces.join(" or ")}`);
				}
				const preferred = person.prefers.surface;
				if (preferred !== undefined && !gate.surfaces.includes(preferred)) {
					errors.add(`flow ${flow.id}: ${person.handle} prefers ${preferred}, which gate ${gate.role} does not allow`);
				}
				if (preferred !== undefined && !hasIdentity(person, preferred)) errors.add(`${person.handle} prefers ${preferred} but has no identity there`);
			}
		}
	}
	return [...errors];
}

/** Upsert only supplied fields; validate the complete result before the caller may write it. */
export function upsertRoster(markdown: string, fields: RosterFields, handoff: Handoff): { markdown: string; row: string; action: "added" | "updated" | "unchanged" } {
	for (const field of ROSTER_FIELDS) {
		if (fields[field] !== undefined && !singleLine(fields[field])) throw new Error(`roster ${field} must be a nonempty single-line cell; use ${EMPTY} to clear an optional field`);
	}
	if (!HANDLE.test(fields.handle)) throw new Error("roster handle must be @name and branch-safe (no consecutive dots, trailing dot or .lock suffix)");
	const { lines, start, end } = rosterTable(markdown);
	let index = end;
	let cells = ROSTER_FIELDS.map(() => ` ${EMPTY} `);
	for (let candidate = start; candidate < end; candidate++) {
		const existing = rosterCells(lines[candidate]!);
		if (existing[0]!.trim() === fields.handle) { index = candidate; cells = existing; break; }
	}
	const updated = ROSTER_FIELDS.map((field, column) => {
		const original = cells[column]!, value = fields[field]?.trim();
		if (value === undefined || value === original.trim()) return original;
		const start = original.search(/\S/);
		return start < 0 ? original + value : original.slice(0, start) + value + original.slice(start + original.trim().length);
	});
	const row = `| ${updated.map(cell => cell.trim()).join(" | ")} |`;
	const action = index === end ? "added" : updated.every((cell, column) => cell === cells[column]) ? "unchanged" : "updated";
	let result = markdown;
	if (action !== "unchanged") {
		const offset = lines.slice(0, index).reduce((length, line) => length + line.length, 0);
		if (action === "updated") {
			const original = lines[index]!;
			const replacement = original.slice(0, original.indexOf("|")) + `|${updated.join("|")}|` + original.slice(original.lastIndexOf("|") + 1);
			result = markdown.slice(0, offset) + replacement + markdown.slice(offset + original.length);
		} else {
			const ending = lines[start - 1]!.endsWith("\r\n") ? "\r\n" : "\n";
			const unterminated = offset > 0 && markdown[offset - 1] !== "\n";
			result = markdown.slice(0, offset) + (unterminated ? ending : "") + row
				+ (offset < markdown.length || !unterminated ? ending : "") + markdown.slice(offset);
		}
	}
	const errors = rosterErrors(parseRoster(result), handoff);
	if (errors.length) throw new Error(errors.join("; "));
	return { markdown: result, row, action };
}

/** Validate a project-owned preview card; returns the skill name when produce is `skill:<name>`. */
export function previewCardErrors(markdown: string): { errors: string[]; skill?: string } {
	const errors: string[] = [];
	const produce = [...markdown.matchAll(/^- produce: (.*)$/gm)];
	let skill: string | undefined;
	if (produce.length !== 1) errors.push("preview card needs exactly one `- produce: pipe|command|manual|skill:<name>` line");
	else {
		const match = /^(pipe|command|manual|skill:([a-z0-9][a-z0-9-]*))$/.exec(produce[0]![1]!.trim());
		if (!match) errors.push(`preview card produce mode is invalid: ${produce[0]![1]}`);
		else skill = match[2];
	}
	const lines = markdown.split(/\r?\n/);
	for (const heading of PREVIEW_HEADINGS) {
		const index = lines.findIndex(line => line.trim() === `## ${heading}`);
		if (index < 0) {
			errors.push(`preview card is missing section ## ${heading}`);
			continue;
		}
		const next = lines.findIndex((line, at) => at > index && /^#{1,2} /.test(line));
		if (!lines.slice(index + 1, next < 0 ? undefined : next).join("\n").trim()) errors.push(`preview card section ## ${heading} is empty`);
	}
	return { errors, ...(skill ? { skill } : {}) };
}

/** Normalize a Git remote to host/owner/repo; local paths become local/<name>. Same key from every checkout of one remote. */
export function projectKey(remote: string): string {
	let host: string;
	let path: string;
	const url = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/i.exec(remote);
	const scp = /^(?:[^@/]+@)?([^/:]+):(?!\/\/)(.+)$/.exec(remote);
	if (url) [host, path] = [url[1]!, url[2]!];
	else if (scp && !remote.startsWith("/") && !remote.startsWith(".")) [host, path] = [scp[1]!, scp[2]!];
	else [host, path] = ["local", basename(remote.replace(/\/+$/, ""))];
	path = path.replace(/\/+$/, "").replace(/\.git$/, "");
	const segments = [host.toLowerCase(), ...path.split("/")];
	if (segments.some(segment => !segment || segment === "." || segment === ".." || !/^[A-Za-z0-9._-]+$/.test(segment))) {
		throw new Error(`cannot derive a project key from remote: ${remote}`);
	}
	return segments.join("/");
}

/** The link repository's remote from runtime metadata (written in pull-request mode). */
export function linkRemote(config: Record<string, unknown>): string {
	const entry = Array.isArray(config.repositories) ? config.repositories.find(item => record(item) && item.name === LINK_REPO) : undefined;
	if (!record(entry) || typeof entry.remote !== "string" || !entry.remote.trim()) throw new Error(`handoff needs repositories[${LINK_REPO}].remote in ${CONFIG_PATH}`);
	return entry.remote;
}

/** Personal file outside every checkout: $XDG_CONFIG_HOME (or ~/.config)/mosaic/<project key>/user.json. */
export function userFilePath(env: Record<string, string | undefined>, key: string): string {
	const base = env.XDG_CONFIG_HOME?.trim() || (env.HOME?.trim() ? join(env.HOME, ".config") : "");
	if (!base) throw new Error("cannot locate the user file: neither XDG_CONFIG_HOME nor HOME is set");
	return join(base, "mosaic", ...key.split("/"), "user.json");
}

/** Check that `handle` is a roster person holding `role`, a gate role of some flow; returns that person. */
export function assertAcceptor(role: string, handle: unknown, handoff: Handoff, people: Person[], label: string): Person {
	if (!handoff.flows.some(flow => flow.gates.some(gate => gate.role === role))) throw new Error(`${label}: ${role} is not a gate role in any flow`);
	const person = people.find(entry => entry.handle === handle);
	if (!person) throw new Error(`${label}: ${String(handle)} is not on the roster`);
	if (!person.roles.includes(role)) throw new Error(`${label}: ${person.handle} does not hold role ${role}`);
	return person;
}

export function validateUserFile(value: unknown, context: { project: string; handoff: Handoff; people: Person[] }): UserFile {
	if (!record(value)) throw new Error("user file must be a JSON object");
	onlyKeys(value, ["schema", "project", "me", "defaults"], "user file");
	if (value.schema !== 1) throw new Error("user file schema must be 1");
	if (value.project !== context.project) throw new Error(`user file project must be ${context.project}`);
	if (typeof value.me !== "string" || !context.people.some(person => person.handle === value.me)) throw new Error(`user file me must be a roster handle in ${ROSTER_PATH}`);
	const file: UserFile = { schema: 1, project: context.project, me: value.me };
	if (value.defaults === undefined) return file;
	if (!record(value.defaults)) throw new Error("user file defaults must be an object");
	onlyKeys(value.defaults, ["flow", "acceptors"], "user file defaults");
	const defaults: NonNullable<UserFile["defaults"]> = {};
	const flow = value.defaults.flow;
	if (flow !== undefined) {
		if (flow !== NONE && !context.handoff.flows.some(entry => entry.id === flow)) throw new Error(`user file defaults.flow must be a configured flow or ${NONE}`);
		defaults.flow = flow as string;
	}
	if (value.defaults.acceptors !== undefined) {
		if (!record(value.defaults.acceptors)) throw new Error("user file defaults.acceptors must map role to @handle");
		defaults.acceptors = {};
		for (const [role, handle] of Object.entries(value.defaults.acceptors)) {
			if (handle === value.me) throw new Error(`user file defaults.acceptors: ${handle} is you; an acceptor is someone other than the contributor`);
			defaults.acceptors[role] = assertAcceptor(role, handle, context.handoff, context.people, "user file defaults.acceptors").handle;
		}
	}
	return { ...file, defaults };
}

export type PlanFrontmatter = { status?: string; flow?: string; acceptors: Record<string, string>; areas: string[] };

/** Line-oriented frontmatter reader for the fields this module owns; not a YAML parser. */
export function planFrontmatter(markdown: string): PlanFrontmatter {
	const lines = markdown.split(/\r?\n/);
	if (lines[0] !== "---") throw new Error("plan has no frontmatter");
	const end = lines.indexOf("---", 1);
	if (end < 0) throw new Error("plan frontmatter is not closed");
	const head = lines.slice(1, end);
	const field = (name: string) => {
		const indexes = head.flatMap((line, index) => (line.startsWith(`${name}:`) ? [index] : []));
		if (indexes.length > 1) throw new Error(`plan frontmatter declares ${name}: ${indexes.length} times; keep exactly one`);
		const index = indexes[0];
		return index === undefined ? undefined : { index, value: head[index]!.slice(name.length + 1).replace(COMMENT, "").trim() };
	};
	const result: PlanFrontmatter = { acceptors: {}, areas: [] };
	const status = field("status");
	if (status) result.status = status.value.split(/\s+/)[0];
	const flow = field("flow");
	if (flow) result.flow = flow.value;
	const acceptors = field("acceptors");
	if (acceptors) {
		const match = /^\{(.*)\}$/.exec(acceptors.value);
		if (!match) throw new Error("acceptors must be a one-line map such as { designer: \"@dana\" } (use {} for none)");
		for (const entry of match[1]!.split(",").map(item => item.trim()).filter(Boolean)) {
			const pair = /^([a-z][a-z0-9-]*)\s*:\s*"?(@[a-z0-9][a-z0-9._-]*)"?$/.exec(entry);
			if (!pair) throw new Error(`acceptors entry must be role: "@handle": ${entry}`);
			if (result.acceptors[pair[1]!] !== undefined) throw new Error(`acceptors names ${pair[1]} twice`);
			result.acceptors[pair[1]!] = pair[2]!;
		}
	}
	const areas = field("areas");
	if (areas) {
		const inline = /^\[(.*)\]$/.exec(areas.value);
		if (inline) result.areas = inline[1]!.split(",").map(item => item.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
		else if (!areas.value) {
			for (const line of head.slice(areas.index + 1)) {
				const item = /^\s+-\s+(.+)$/.exec(line);
				if (!item) break;
				result.areas.push(item[1]!.replace(COMMENT, "").trim().replace(/^["']|["']$/g, ""));
			}
		}
	}
	return result;
}

export type FlowValue = { kind: "flow"; id: string } | { kind: "none"; reason: string } | { kind: "tbd" } | { kind: "absent" };

/** Interpret `flow:`: a configured flow id, `none — <reason>`, `TBD` (drafting only), or absent (allowed only while drafting; callers decide). */
export function flowValue(value: string | undefined, handoff: Handoff | undefined): FlowValue {
	if (value === undefined) return { kind: "absent" };
	if (value === TBD) return { kind: "tbd" };
	const none = /^none — (\S.*)$/.exec(value);
	if (none) return { kind: "none", reason: none[1]! };
	if (value === NONE) throw new Error("flow: none needs a reason: `none — <reason>`");
	if (!handoff) throw new Error(`flow: ${value} names a handoff flow, but no handoff flows are configured`);
	if (!handoff.flows.some(flow => flow.id === value)) throw new Error(`flow: ${value} is not a configured handoff flow (${handoff.flows.map(flow => flow.id).join(", ")})`);
	return { kind: "flow", id: value };
}

/** The literal directory part of a glob or path, before its first glob metacharacter. */
function literalPrefix(glob: string): string {
	const index = glob.search(/[*?[{]/);
	return (index < 0 ? glob : glob.slice(0, index)).replace(/\/+$/, "");
}

/**
 * Flows whose `areas` overlap a plan's `areas:` (`contract:` entries never match). A literal plan path matches when the
 * flow glob matches it, or when it names a directory containing the glob's literal part; two globs also overlap when
 * one literal part contains the other, since neither pattern can be enumerated.
 */
export function matchFlows(handoff: Handoff, planAreas: string[]): string[] {
	const paths = planAreas.filter(area => !area.startsWith("contract:"));
	return handoff.flows.filter(flow => flow.areas?.some(glob => paths.some(area => {
		if (new Bun.Glob(glob).match(area)) return true;
		const [left, right] = [literalPrefix(glob), literalPrefix(area)];
		const ancestor = !!left && (left === right || left.startsWith(`${right}/`));
		if (right === area.replace(/\/+$/, "")) return ancestor;
		return new Bun.Glob(area).match(glob) || !left || !right || ancestor || right.startsWith(`${left}/`);
	}))).map(flow => flow.id);
}

// Execution-log grammar. Every `- handoff ` line must match exactly one of these.
const ROLE_SRC = "[a-z][a-z0-9-]*";
const HANDLE_SRC = "@[a-z0-9][a-z0-9._-]*";
const ISO_SRC = "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d+)?)?Z";
const SHA_SRC = "[0-9a-f]{40,64}";
const LOCATOR_SRC = "(tracker-reply|pr-review)\\/([^\\s()]+)";
const PREFIX = `^- handoff R([1-9]\\d*) (${ROLE_SRC}): `;
export const LINE = {
	requested: new RegExp(`${PREFIX}REQUESTED (${HANDLE_SRC}) (${ISO_SRC}) head (${SHA_SRC}) pr://(\\d+) preview (https://\\S+|none)$`),
	accepted: new RegExp(`${PREFIX}ACCEPTED (${HANDLE_SRC}) (${ISO_SRC}) ${LOCATOR_SRC} head (${SHA_SRC})$`),
	returned: new RegExp(`${PREFIX}RETURNED (${HANDLE_SRC}) (${ISO_SRC}) ${LOCATOR_SRC} \\((\\d+) findings\\)$`),
	finding: new RegExp(`${PREFIX}([SP]) — (\\S(?:.*\\S)?) → (fixed|amended: \\S.*|deferred: \\S.*|contested: \\S.*)$`),
	withdrawn: new RegExp(`${PREFIX}WITHDRAWN (${ISO_SRC}) by (${HANDLE_SRC}) — (\\S.*)$`),
	overridden: new RegExp(`${PREFIX}OVERRIDDEN (${ISO_SRC}) by (${HANDLE_SRC}) — (\\S.*)$`),
} as const;

export type GateState = "none" | "requested" | "accepted" | "returned" | "withdrawn" | "overridden";
export type GateStatus = {
	role: string; state: GateState; round: number; acceptor: string | null; requestedHead: string | null;
	acceptedHead: string | null; locator: string | null; at: string | null; returnedRounds: number;
};
export const CLEARED: readonly GateState[] = ["accepted", "withdrawn", "overridden"];

/** The `## Execution log` section (to the next `## ` heading or end of file). */
export function executionLog(markdown: string): string {
	const lines = markdown.split(/\r?\n/);
	const start = lines.findIndex(line => line === "## Execution log");
	if (start < 0) return "";
	const end = lines.findIndex((line, index) => index > start && /^## /.test(line));
	return lines.slice(start + 1, end < 0 ? undefined : end).join("\n");
}

/**
 * Replay the handoff lines of an Execution log against a flow's gates; throws on any malformed line or transition.
 * Beyond grammar it enforces what the log alone can prove: the requested acceptor is a roster person holding the gate's
 * role, an answer cites a surface the gate allows and the acceptor has an identity on, and a tracker reply binds to the
 * requested head. Whether the cited evidence still exists live is the rule's re-read, not this function's.
 */
export function gateStatuses(log: string, flow: Flow, people: Person[]): GateStatus[] {
	const statuses = flow.gates.map((gate): GateStatus => ({
		role: gate.role, state: "none", round: 0, acceptor: null, requestedHead: null, acceptedHead: null, locator: null, at: null, returnedRounds: 0,
	}));
	const pendingFindings = new Map<string, number>();
	for (const line of log.split(/\r?\n/)) {
		if (!line.startsWith("- handoff ")) continue;
		const where = `Execution log line "${line}"`;
		const kind = (Object.keys(LINE) as (keyof typeof LINE)[]).find(name => LINE[name].test(line));
		if (!kind) throw new Error(`malformed handoff line: ${where}`);
		const match = LINE[kind].exec(line)!;
		const round = Number(match[1]);
		const role = match[2]!;
		const index = statuses.findIndex(status => status.role === role);
		if (index < 0) throw new Error(`${where}: role ${role} is not a gate of flow ${flow.id}`);
		const status = statuses[index]!;
		const gate = flow.gates[index]!;
		const key = `R${round} ${role}`;
		if (kind === "finding") {
			const left = pendingFindings.get(key);
			if (!left) throw new Error(`${where}: finding without an open RETURNED count for ${key}`);
			if (match[4]!.split(/\s+/).length > 15) throw new Error(`${where}: finding summary exceeds 15 words`);
			pendingFindings.set(key, left - 1);
			continue;
		}
		if (kind === "requested") {
			const blocked = statuses.slice(0, index).find(earlier => !CLEARED.includes(earlier.state));
			if (blocked) throw new Error(`${where}: gate ${role} requested before gate ${blocked.role} cleared`);
			// A new round may supersede an open one (stale head after an own-code change, or another acceptor); answers then cite only the new round.
			if (round !== status.round + 1) throw new Error(`${where}: expected R${status.round + 1} for ${role}`);
			const person = people.find(entry => entry.handle === match[3]);
			if (!person || !person.roles.includes(role)) throw new Error(`${where}: ${match[3]} is not a roster person holding role ${role}`);
			Object.assign(status, { state: "requested", round, acceptor: match[3]!, requestedHead: match[5]!, acceptedHead: null, locator: null, at: match[4]! });
			continue;
		}
		if (round !== status.round || status.round === 0) throw new Error(`${where}: no request R${round} for ${role}`);
		if (kind === "accepted" || kind === "returned") {
			if (status.state !== "requested" && !(kind === "returned" && status.state === "accepted")) throw new Error(`${where}: R${round} for ${role} is not open`);
			if (match[3] !== status.acceptor) throw new Error(`${where}: ${match[3]} is not the requested acceptor ${status.acceptor}`);
			const surface = match[5] as Surface;
			const person = people.find(entry => entry.handle === status.acceptor)!;
			if (!gate.surfaces.includes(surface)) throw new Error(`${where}: gate ${role} does not accept answers on ${surface}`);
			if (!hasIdentity(person, surface)) throw new Error(`${where}: ${person.handle} has no roster identity on ${surface}`);
			status.at = match[4]!;
			status.locator = `${surface}/${match[6]}`;
			if (kind === "accepted") {
				if (surface === "tracker-reply" && match[7] !== status.requestedHead) throw new Error(`${where}: a tracker reply binds to the requested head ${status.requestedHead}`);
				Object.assign(status, { state: "accepted", acceptedHead: match[7]! });
				continue;
			}
			const count = Number(match[7]);
			if (!count) throw new Error(`${where}: RETURNED needs at least one finding`);
			Object.assign(status, { state: "returned", acceptedHead: null });
			status.returnedRounds += 1;
			pendingFindings.set(key, count);
			continue;
		}
		// WITHDRAWN / OVERRIDDEN close an open request or a returned round.
		if (status.state !== "requested" && status.state !== "returned") throw new Error(`${where}: R${round} for ${role} is neither open nor returned`);
		Object.assign(status, { state: kind, at: match[3]! });
	}
	const mismatched = [...pendingFindings].filter(([, left]) => left !== 0);
	if (mismatched.length) {
		throw new Error(`RETURNED finding count mismatch: ${mismatched.map(([key, left]) => `${key} ${left > 0 ? `missing ${left}` : `has ${-left} extra`}`).join("; ")}`);
	}
	return statuses;
}
