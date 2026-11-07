#!/usr/bin/env bun
import { deepStrictEqual as same, notStrictEqual, ok, strictEqual as eq } from "node:assert";
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { Handoff } from "../../kit/tools/constants/handoff.ts";
import { install } from "../../kit/install.ts";

const scratch = realpathSync(mkdtempSync(join(tmpdir(), "mosaic-handoff-")));
const PLAN = "docs/plans/0042-handoff.md";
const PROJECT = "github.com/acme/app";
const HEAD = "a".repeat(40), NEXT_HEAD = "b".repeat(40), AT = "2026-11-04T10:00:00Z";
const ROSTER = `# People\n\n| Handle | Roles | Tracker id | Tracker mention | GitHub login | Slack id | Prefers |\n|---|---|---|---|---|---|---|\n| @dana | designer | dana-id | @Dana Levi | dana-l | U_DANA | — |\n| @pat | product | pat-id | @Pat | pat-p | U_PAT | — |\n| @dev | engineer | dev-id | @Developer | dev-e | U_DEV | — |\n`;
const LEE = "| @lee | designer | lee-id | @Lee | lee-d | U_LEE | — |\n";
let count = 0;

class Fixture {
	base = mkdtempSync(join(scratch, "case-"));
	root = join(this.base, "project");
	env = { ...process.env, HOME: join(this.base, "home"), XDG_CONFIG_HOME: join(this.base, "xdg") };
	userPath = join(this.env.XDG_CONFIG_HOME, "mosaic", PROJECT, "user.json");
	handoff: Handoff = {
		flows: [
			{ id: "design-acceptance", areas: ["services/frontend/**"], gates: [{ role: "designer", surfaces: ["tracker-reply", "pr-review"], artifacts: ["pr", "preview"] }] },
			{ id: "product-acceptance", areas: ["services/billing/**"], gates: [{ role: "product", surfaces: ["tracker-reply", "pr-review"], artifacts: ["pr"] }] },
			{ id: "design-and-product", gates: [
				{ role: "designer", surfaces: ["tracker-reply", "pr-review"], artifacts: ["pr"] },
				{ role: "product", surfaces: ["tracker-reply", "pr-review"], artifacts: ["pr"] },
			] },
		],
		preview: "docs/surfaces/preview.md", requestReview: true,
	};
	constructor() {
		for (const file of ["handoff.ts", "constants/handoff.ts", "tracker.ts", "lint-ledgers.ts", "root-containment.ts"]) {
			const target = join(this.root, "tools", file);
			mkdirSync(dirname(target), { recursive: true });
			copyFileSync(resolve(import.meta.dir, "../../kit/tools", file), target);
		}
		this.config();
		this.put("docs/surfaces/people.md", ROSTER);
		this.put("docs/tracker/items.json", "[]\n");
		this.put("comment.txt", "Please review the acceptance criteria.\n");
	}
	put(file: string, content: string) {
		const target = join(this.root, file);
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(target, content);
	}
	config(handoff: unknown = this.handoff, tracking = "local") {
		this.put(".omp/mosaic.json", JSON.stringify({ landing: { mode: "pull-request", host: "github" }, tracking: { mode: tracking },
			repositories: [{ name: "link-repo", path: ".", remote: "git@GitHub.com:acme/app.git" }], ...(handoff === null ? {} : { handoff }) }));
	}
	plan(fields: { flow?: string; status?: string; areas?: string[]; acceptors?: string } = {}, log = "", file = PLAN) {
		this.put(file, ["---", `status: ${fields.status ?? "draft"}`, `areas: [${(fields.areas ?? []).join(", ")}]`,
			...(fields.flow !== undefined ? [`flow: ${fields.flow}`] : []), ...(fields.acceptors !== undefined ? [`acceptors: ${fields.acceptors}`] : []),
			"---", "# Handoff", "", "## Context", "", "## Scope", "", "## Task breakdown", "", "## Review checklist", "", "## Verification", "", "### Unverified", "", "## Planning log", "", "## Execution log", log, ""].join("\n"));
	}
	user(defaults: { flow?: string; acceptors?: Record<string, string> }, me = "@dev") {
		mkdirSync(dirname(this.userPath), { recursive: true });
		writeFileSync(this.userPath, JSON.stringify({ schema: 1, project: PROJECT, me, defaults }));
	}
	run(tool: string, args: string[], code = 0, cwd = this.root) {
		const result = Bun.spawnSync([process.execPath, join(this.root, "tools", `${tool}.ts`), ...args], { cwd, env: this.env, stdout: "pipe", stderr: "pipe" });
		eq(result.exitCode, code, `${tool} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
		if (code === 0) eq(result.stderr.toString(), "");
		return { stdout: result.stdout.toString(), stderr: result.stderr.toString() };
	}
	command(args: string[], code = 0, diagnostic?: RegExp) {
		const result = this.run("handoff", args, code);
		if (diagnostic) { ok(result.stderr.startsWith("handoff: "), result.stderr); ok(diagnostic.test(result.stderr), result.stderr); }
		return result.stdout ? JSON.parse(result.stdout) : undefined;
	}
	lint(code = 0, diagnostic?: RegExp, file = PLAN) {
		const result = this.run("lint-ledgers", [file], code);
		if (diagnostic) ok(diagnostic.test(result.stderr), result.stderr);
	}
	intent() {
		return this.run("tracker", ["intent", "--title", "Acceptance", "--repos", "link-repo", "--areas", "services/frontend/**", "--writer", "owner#1"]).stdout.trim();
	}
	get(key: string) {
		return JSON.parse(this.run("tracker", ["get", key]).stdout);
	}
}
function test(name: string, body: (fixture: Fixture) => void) {
	const fixture = new Fixture();
	try { body(fixture); console.log(`PASS ${++count} ${name}`); }
	catch (error) { console.error(`FAIL ${name}`); throw error; }
}
function requested(role = "designer", who = "@dana", round = 1, head = HEAD) {
	return `- handoff R${round} ${role}: REQUESTED ${who} ${AT} head ${head} pr://42 preview none`;
}
function accepted(role = "designer", who = "@dana", round = 1, head = HEAD) {
	return `- handoff R${round} ${role}: ACCEPTED ${who} ${AT} tracker-reply/accept-${round} head ${head}`;
}
const returned = `- handoff R1 designer: RETURNED @dana ${AT} tracker-reply/return-1 (2 findings)`;
const findings = "- handoff R1 designer: S — Focus is missing → fixed\n- handoff R1 designer: P — Copy needs clarification → amended: human approved";

try {
	test("plan flow overrides user and areas", r => {
		r.user({ flow: "product-acceptance" }); r.plan({ flow: "design-acceptance", areas: ["services/billing/**"] });
		const result = r.command(["resolve", "--plan", PLAN]);
		eq(result.flow, "design-acceptance"); eq(result.source, "plan"); eq(result.gates[0].role, "designer");
	});
	test("explicit plan skip overrides user", r => {
		r.user({ flow: "design-acceptance" }); r.plan({ flow: "none — documentation only", areas: ["services/frontend/**"] });
		same(r.command(["resolve", "--plan", PLAN]), { flow: "none", source: "plan", candidates: [], gates: [], suggestions: [] });
	});
	for (const flow of ["product-acceptance", "none"]) test(`user flow overrides area match: ${flow}`, r => {
		r.user({ flow }); r.plan({ flow: "TBD", areas: ["services/frontend/**"] });
		const result = r.command(["resolve", "--plan", PLAN]); eq(result.flow, flow); eq(result.source, "user");
	});
	test("one area match resolves the flow", r => {
		r.user({});
		r.plan({ areas: ["services/frontend/view.ts"] }); const result = r.command(["resolve", "--plan", PLAN]);
		eq(result.flow, "design-acceptance"); eq(result.source, "areas"); same(result.candidates, ["design-acceptance"]);
	});
	test("literal areas respect the flow glob and ancestor directories", r => {
		r.user({});
		r.handoff.flows[0]!.areas = ["services/frontend/*.tsx"]; r.config();
		r.plan({ areas: ["services/frontend/card.ts"] });
		same(r.command(["resolve", "--plan", PLAN]), { flow: "none", source: "default", candidates: [], gates: [], suggestions: [] });
		for (const area of ["services/frontend/card.tsx", "services/frontend"]) {
			r.plan({ areas: [area] }); const result = r.command(["resolve", "--plan", PLAN]);
			eq(result.flow, "design-acceptance"); eq(result.source, "areas"); same(result.candidates, ["design-acceptance"]);
		}
	});
	test("unmatched and contract areas select no handoff", r => {
		r.plan({ areas: ["services/jobs/**", "contract:frontend"] });
		same(r.command(["resolve", "--plan", PLAN]), { flow: "none", source: "default", candidates: [], gates: [], suggestions: [] });
	});
	test("several area matches ask instead of guessing", r => {
		r.plan({ areas: ["services/frontend/**", "services/billing/**"] });
		same(r.command(["resolve", "--plan", PLAN], 1), { flow: null, source: "areas", candidates: ["design-acceptance", "product-acceptance"], gates: [], suggestions: [] });
	});
	test("plan acceptor overrides user acceptor", r => {
		r.put("docs/surfaces/people.md", ROSTER + LEE); r.user({ acceptors: { designer: "@lee" } });
		r.plan({ flow: "design-acceptance", acceptors: '{ designer: "@dana" }' });
		const gate = r.command(["resolve", "--plan", PLAN]).gates[0]; eq(gate.acceptorSource, "plan");
		same(gate.acceptor, { handle: "@dana", trackerId: "dana-id", mention: "@Dana Levi", githubLogin: "dana-l", slackId: "U_DANA" });
	});
	test("user acceptor selects among multiple holders", r => {
		r.put("docs/surfaces/people.md", ROSTER + LEE); r.user({ acceptors: { designer: "@lee" } }); r.plan({ flow: "design-acceptance" });
		const gate = r.command(["resolve", "--plan", PLAN]).gates[0]; eq(gate.acceptor.handle, "@lee"); eq(gate.acceptorSource, "user");
	});
	test("only holder supplies acceptor and reachable surfaces", r => {
		r.user({});
		r.put("docs/surfaces/people.md", ROSTER.replace("dana-id | @Dana Levi", "— | @Dana Levi")); r.plan({ flow: "design-acceptance" });
		const gate = r.command(["resolve", "--plan", PLAN]).gates[0]; eq(gate.acceptor.handle, "@dana"); eq(gate.acceptorSource, "only-holder");
		same(gate.post, ["pr-review"]); same(gate.include, ["pr", "preview"]); eq(gate.requestReview, true);
	});
	test("multiple role holders leave an explicit pending acceptor", r => {
		r.user({});
		r.put("docs/surfaces/people.md", ROSTER + LEE); r.plan({ flow: "design-acceptance" });
		const gate = r.command(["resolve", "--plan", PLAN], 1).gates[0];
		eq(gate.acceptor, null); eq(gate.acceptorSource, null); same(gate.post, []); eq(gate.requestReview, false);
	});
	test("plan acceptor cannot be the contributor", r => {
		r.user({}, "@dana"); r.plan({ flow: "design-acceptance", acceptors: '{ designer: "@dana" }' });
		eq(r.command(["resolve", "--plan", PLAN], 1, /is the contributor and cannot accept their own change/), undefined);
	});
	test("user-default acceptor cannot be the contributor", r => {
		r.user({ acceptors: { designer: "@dana" } }, "@dana"); r.plan({ flow: "design-acceptance" });
		eq(r.command(["resolve", "--plan", PLAN], 1, /is you; an acceptor is someone other than the contributor/), undefined);
	});
	test("contributor as sole role holder leaves acceptance unresolved", r => {
		r.user({}, "@dana"); r.plan({ flow: "design-acceptance" });
		const gate = r.command(["resolve", "--plan", PLAN], 1).gates[0];
		eq(gate.acceptor, null); eq(gate.acceptorSource, null); same(gate.post, []); eq(gate.requestReview, false);
	});
	test("only-holder selection excludes the contributor", r => {
		r.put("docs/surfaces/people.md", ROSTER + LEE); r.user({}, "@dana"); r.plan({ flow: "design-acceptance" });
		const gate = r.command(["resolve", "--plan", PLAN]).gates[0];
		eq(gate.acceptor.handle, "@lee"); eq(gate.acceptorSource, "only-holder");
	});
	for (const known of [false, true]) test(`only-holder resolution with contributor ${known ? "known" : "unknown"}`, r => {
		if (known) r.user({});
		r.plan({ flow: "design-acceptance" });
		const gate = r.command(["resolve", "--plan", PLAN], known ? 0 : 1).gates[0];
		eq(gate.acceptor?.handle ?? null, known ? "@dana" : null);
		eq(gate.acceptorSource, known ? "only-holder" : null);
		same(gate.post, known ? ["tracker-reply", "pr-review"] : []);
	});
	for (const [acceptors, diagnostic] of [
		['{ designer: "@unknown" }', /not on the roster/], ['{ designer: "@pat" }', /does not hold role/],
		['{ unknown: "@dana" }', /not a gate role/], ['["@dana"]', /one-line map/],
		['', /one-line map/], ['\n  designer: "@dana"', /one-line map/],
	] as const) test(`invalid plan acceptors: ${acceptors}`, r => {
		r.plan({ flow: "design-acceptance", acceptors }); eq(r.command(["resolve", "--plan", PLAN], 1, diagnostic), undefined);
		r.lint(1, diagnostic);
	});
	test("empty acceptors map keeps normal resolution", r => {
		r.user({});
		r.plan({ flow: "design-acceptance", acceptors: "{}" }); r.lint();
		const gate = r.command(["resolve", "--plan", PLAN]).gates[0]; eq(gate.acceptor.handle, "@dana"); eq(gate.acceptorSource, "only-holder");
	});
	test("prefers selects posting and preserves pr in packet", r => {
		r.user({});
		r.put("docs/surfaces/people.md", ROSTER.replace("U_DANA | —", "U_DANA | surface: tracker-reply; artifacts: preview"));
		r.plan({ flow: "design-acceptance" }); const gate = r.command(["resolve", "--plan", PLAN]).gates[0];
		same(gate.post, ["tracker-reply"]); same(gate.include, ["pr", "preview"]); eq(gate.requestReview, false);
	});
	test("artifact preference can omit preview", r => {
		r.user({});
		r.put("docs/surfaces/people.md", ROSTER.replace("U_DANA | —", "U_DANA | artifacts: pr")); r.plan({ flow: "design-acceptance" });
		const gate = r.command(["resolve", "--plan", PLAN]).gates[0]; same(gate.post, ["tracker-reply", "pr-review"]); same(gate.include, ["pr"]); eq(gate.requestReview, true);
	});
	test("requestReview false respects attested automation", r => {
		r.user({});
		r.handoff.requestReview = false; r.config(); r.plan({ flow: "design-acceptance" });
		const gate = r.command(["resolve", "--plan", PLAN]).gates[0]; same(gate.post, ["tracker-reply", "pr-review"]); eq(gate.requestReview, false);
	});
	test("MCP gate carries team-native state", r => {
		r.user({});
		r.handoff.flows[0]!.gates[0]!.state = "QA"; r.config(r.handoff, "mcp"); r.plan({ flow: "design-acceptance" });
		eq(r.command(["resolve", "--plan", PLAN]).gates[0].state, "QA");
	});
	test("MCP gate without native state resolves without inventing one", r => {
		r.user({}); r.config(r.handoff, "mcp"); r.plan({ flow: "design-acceptance" });
		const result = r.command(["resolve", "--plan", PLAN]);
		eq(result.flow, "design-acceptance");
		eq(Object.hasOwn(result.gates[0], "state"), false);
		same(result.gates[0].post, ["tracker-reply", "pr-review"]);
	});
	test("roster filters by role", r => {
		same(r.command(["roster", "--role", "designer"]).map((person: { handle: string }) => person.handle), ["@dana"]);
		same(r.command(["roster", "--role", "unknown"]), []);
	});
	test("seven-column roster keeps Slack separate from acceptance identity", r => {
		same(r.command(["roster"])[0], { handle: "@dana", roles: ["designer"], trackerId: "dana-id", mention: "@Dana Levi", githubLogin: "dana-l", slackId: "U_DANA", prefers: {} });
		r.put("docs/surfaces/people.md", ROSTER.replace("dana-id | @Dana Levi | dana-l", "— | @Dana Levi | —"));
		r.command(["roster"], 2);
	});
	test("legacy six-column roster cannot evaluate", r => {
		r.put("docs/surfaces/people.md", ROSTER.replace(" Slack id |", "").replace("|---|---|---|---|---|---|---|", "|---|---|---|---|---|---|")
			.replace(" U_DANA |", "").replace(" U_PAT |", "").replace(" U_DEV |", ""));
		eq(r.command(["roster"], 2), undefined);
	});
	for (const handle of ["@alex..smith", "@alex.", "@alex.lock"]) test(`roster rejects branch-unsafe handle ${handle} on read and write`, r => {
		r.command(["roster", "--set", "--handle", handle, "--roles", "engineer"], 1, /branch-safe/);
		eq(readFileSync(join(r.root, "docs/surfaces/people.md"), "utf8"), ROSTER);
		r.put("docs/surfaces/people.md", ROSTER.replace("@dev", handle));
		r.command(["roster"], 2, /branch-safe/);
	});
	test("dotted roster handle forms its exact onboarding branch", r => {
		eq(r.command(["roster", "--set", "--handle", "@tal.m", "--roles", "engineer"]).action, "added");
		ok(r.command(["roster"]).some((person: { handle: string }) => person.handle === "@tal.m"));
		const branch = Bun.spawnSync(["git", "check-ref-format", "--branch", "roster/tal.m"], { cwd: r.root, stdout: "pipe", stderr: "pipe" });
		eq(branch.exitCode, 0, branch.stderr.toString());
		eq(branch.stdout.toString().trim(), "roster/tal.m");
	});
	test("roster set adds with absent optional fields and preserves surrounding bytes", r => {
		const before = `${ROSTER}\n## Notes\nKeep this text and its  spacing.\n`;
		r.put("docs/surfaces/people.md", before);
		const row = "| @new | engineer | — | — | — | — | — |";
		same(r.command(["roster", "--set", "--handle", "@new", "--roles", "engineer"]), {
			path: join(r.root, "docs/surfaces/people.md"), handle: "@new", action: "added", row, written: true,
		});
		eq(readFileSync(join(r.root, "docs/surfaces/people.md"), "utf8"), before.replace("\n## Notes", `${row}\n\n## Notes`));
		eq(r.command(["roster", "--role", "engineer"])[1].handle, "@new");
	});
	for (const linked of [false, true]) test(linked ? "atomic roster update preserves a contained symlink and updates its referent" : "atomic roster replacement keeps mode and leaves no temporary file", r => {
		const link = join(r.root, "docs/surfaces/people.md");
		const file = linked ? join(r.root, "docs/team/people.md") : link, directory = dirname(file);
		if (linked) {
			r.put("docs/team/people.md", ROSTER);
			rmSync(link); symlinkSync("../team/people.md", link);
		}
		chmodSync(file, 0o640);
		const entries = readdirSync(directory), linkEntries = readdirSync(dirname(link));
		eq(r.command(["roster", "--set", "--handle", "@dev", "--mention", "@Developer Updated"]).written, true);
		eq(readFileSync(file, "utf8"), ROSTER.replace("@Developer", "@Developer Updated"));
		eq(statSync(file).mode & 0o7777, 0o640);
		same(readdirSync(directory), entries);
		if (linked) {
			ok(lstatSync(link).isSymbolicLink());
			eq(readlinkSync(link), "../team/people.md");
			eq(readFileSync(link, "utf8"), readFileSync(file, "utf8"));
			same(readdirSync(dirname(link)), linkEntries);
		}
	});
	for (const linked of [false, true]) test(linked ? "failed roster write preserves its contained symlink and referent" : "partial roster write failure preserves original bytes and removes its temporary file", r => {
		const link = join(r.root, "docs/surfaces/people.md");
		const file = linked ? join(r.root, "docs/team/people.md") : link, directory = dirname(file);
		if (linked) {
			r.put("docs/team/people.md", ROSTER);
			rmSync(link); symlinkSync("../team/people.md", link);
		}
		const entries = readdirSync(directory), linkEntries = readdirSync(dirname(link)), mode = statSync(file).mode;
		r.put("disk-full.ts", `import fs from "node:fs";
import { mock } from "bun:test";
const write = fs.writeFileSync;
mock.module("node:fs", () => ({ ...fs, writeFileSync(file, data, ...options) {
	if (typeof data === "string" && data.includes("| Handle |")) {
		write(file, data.slice(0, 17), ...options);
		throw Object.assign(new Error("ENOSPC: disk full during roster write"), { code: "ENOSPC" });
	}
	return write(file, data, ...options);
} }));
`);
		const failed = Bun.spawnSync([process.execPath, "--preload", join(r.root, "disk-full.ts"), join(r.root, "tools/handoff.ts"),
			"roster", "--set", "--handle", "@dev", "--mention", "@Developer Updated"], { cwd: r.root, env: r.env, stdout: "pipe", stderr: "pipe" });
		eq(failed.exitCode, 2, `${failed.stdout}\n${failed.stderr}`);
		ok(failed.stderr.toString().includes("ENOSPC"), failed.stderr.toString());
		eq(failed.stdout.toString(), "");
		eq(readFileSync(file, "utf8"), ROSTER);
		eq(statSync(file).mode, mode);
		same(readdirSync(directory), entries);
		if (linked) {
			ok(lstatSync(link).isSymbolicLink());
			eq(readlinkSync(link), "../team/people.md");
			eq(readFileSync(link, "utf8"), ROSTER);
			same(readdirSync(dirname(link)), linkEntries);
		}
	});
	test("roster refuses escaping symlinks before reads or writes", r => {
		const link = join(r.root, "docs/surfaces/people.md"), external = join(r.base, "outside-people.md");
		writeFileSync(external, ROSTER);
		rmSync(link); symlinkSync(external, link);
		const linkEntries = readdirSync(dirname(link));
		for (const args of [["roster"], ["roster", "--set", "--handle", "@dev", "--mention", "@Changed"],
			["roster", "--set", "--handle", "@dev", "--mention", "@Changed", "--dry-run"]]) {
			r.command(args, 2, /contained file/);
			eq(readFileSync(external, "utf8"), ROSTER);
			ok(lstatSync(link).isSymbolicLink());
			eq(readlinkSync(link), external);
			same(readdirSync(r.base).filter(name => name.startsWith("outside-people.md")), ["outside-people.md"]);
			same(readdirSync(dirname(link)), linkEntries);
		}
	});
	test("roster set preserves unsupplied cells and row whitespace while returning a canonical row", r => {
		const old = "\t |  @dana  |  designer\t| dana-id   |  @Dana Levi\t| dana-l | U_DANA  |   — | \t";
		const before = `${ROSTER.replace(ROSTER.split("\n")[4]!, old)}\nTrailing notes.\n`;
		r.put("docs/surfaces/people.md", before);
		const row = "| @dana | designer | dana-id | @Dana Updated | dana-l | U_NEXT | — |";
		same(r.command(["roster", "--set", "--handle", "@dana", "--mention", "@Dana Updated", "--slack", "U_NEXT"]), {
			path: join(r.root, "docs/surfaces/people.md"), handle: "@dana", action: "updated", row, written: true,
		});
		eq(readFileSync(join(r.root, "docs/surfaces/people.md"), "utf8"), before.replace("@Dana Levi", "@Dana Updated").replace("U_DANA", "U_NEXT"));
	});
	test("roster set clears optional values without clearing omitted roles", r => {
		r.put("docs/surfaces/people.md", ROSTER.replace("U_DEV | —", "U_DEV | artifacts: pr"));
		const args = ["roster", "--set", "--handle", "@dev", "--tracker-id", "—", "--mention", "—", "--github", "—", "--slack", "—", "--prefers", "—"];
		const row = "| @dev | engineer | — | — | — | — | — |";
		same(r.command(args), { path: join(r.root, "docs/surfaces/people.md"), handle: "@dev", action: "updated", row, written: true });
		same(r.command(["roster", "--role", "engineer"]), [{ handle: "@dev", roles: ["engineer"], prefers: {} }]);
		const before = readFileSync(join(r.root, "docs/surfaces/people.md"), "utf8");
		same(r.command(args), { path: join(r.root, "docs/surfaces/people.md"), handle: "@dev", action: "unchanged", row, written: false });
		eq(readFileSync(join(r.root, "docs/surfaces/people.md"), "utf8"), before);
	});
	for (const added of [false, true]) test(`roster dry-run ${added ? "add" : "update"} never writes`, r => {
		const handle = added ? "@new" : "@dev", row = `| ${handle} | engineer | — | — | — | U_NEW | — |`;
		const args = ["roster", "--set", "--handle", handle, "--roles", "engineer", "--slack", "U_NEW", "--tracker-id", "—", "--mention", "—", "--github", "—"];
		same(r.command([...args, "--dry-run"]), { path: join(r.root, "docs/surfaces/people.md"), handle, action: added ? "added" : "updated", row, written: false });
		eq(readFileSync(join(r.root, "docs/surfaces/people.md"), "utf8"), ROSTER);
	});
	for (const args of [
		["--handle", "@new"], ["--roles", "engineer"], ["--handle", "bad", "--roles", "engineer"],
		["--handle", "@new", "--roles", "engineer,engineer"], ["--handle", "@new", "--roles", "engineer", "--slack", "two tokens"],
		["--handle", "@dev", "--slack", "U_DANA"], ["--handle", "@dev", "--tracker-id", "dana-id"],
		["--handle", "@dev", "--github", "DANA-L"], ["--handle", "@dev", "--mention", "bad\nmention"],
		["--handle", "@dev", "--mention", "bad | cell"], ["--handle", "@dana", "--roles", "engineer"],
		["--handle", "@dana", "--tracker-id", "—", "--github", "—"], ["--handle", "@dana", "--prefers", "surface: chat"],
	] as const) test(`invalid roster set preserves all bytes: ${args.join(" ")}`, r => {
		r.command(["roster", "--set", ...args], 1);
		eq(readFileSync(join(r.root, "docs/surfaces/people.md"), "utf8"), ROSTER);
	});
	test("roster set validates preferences against every flow before writing", r => {
		r.handoff.flows[2]!.gates[0]!.surfaces = ["pr-review"]; r.config();
		r.command(["roster", "--set", "--handle", "@dana", "--prefers", "surface: tracker-reply"], 1);
		eq(readFileSync(join(r.root, "docs/surfaces/people.md"), "utf8"), ROSTER);
	});
	test("roster set validates untouched rows and can repair an existing invalid field", r => {
		const broken = ROSTER.replace("U_PAT", "U_DANA");
		r.put("docs/surfaces/people.md", broken);
		r.command(["roster", "--set", "--handle", "@dev", "--mention", "@New Developer"], 1);
		eq(readFileSync(join(r.root, "docs/surfaces/people.md"), "utf8"), broken);
		eq(r.command(["roster", "--set", "--handle", "@pat", "--slack", "U_PAT"]).written, true);
		eq(readFileSync(join(r.root, "docs/surfaces/people.md"), "utf8"), ROSTER);
	});
	test("roster set repairs missing gate ownership before validating the resulting roster", r => {
		r.put("docs/surfaces/people.md", ROSTER.replace("| designer |", "| engineer |"));
		eq(r.command(["roster", "--set", "--handle", "@dana", "--roles", "designer"]).written, true);
		eq(readFileSync(join(r.root, "docs/surfaces/people.md"), "utf8"), ROSTER);
	});
	test("roster set persists supplied roles identities and preferences with CRLF surrounding bytes", r => {
		const before = `${ROSTER}\nNotes stay intact.\n`.replaceAll("\n", "\r\n");
		r.put("docs/surfaces/people.md", before);
		const row = "| @dev | engineer,contributor | developer-2 | @Developer Two | developer-two | U_DEV2 | artifacts: pr |";
		same(r.command(["roster", "--set", "--handle", "@dev", "--roles", "engineer,contributor", "--tracker-id", "developer-2",
			"--mention", "@Developer Two", "--github", "developer-two", "--slack", "U_DEV2", "--prefers", "artifacts: pr"]), {
			path: join(r.root, "docs/surfaces/people.md"), handle: "@dev", action: "updated", row, written: true,
		});
		eq(readFileSync(join(r.root, "docs/surfaces/people.md"), "utf8"), before.replace("| @dev | engineer | dev-id | @Developer | dev-e | U_DEV | — |", row));
		same(r.command(["roster", "--role", "contributor"]), [{ handle: "@dev", roles: ["engineer", "contributor"],
			trackerId: "developer-2", mention: "@Developer Two", githubLogin: "developer-two", slackId: "U_DEV2", prefers: { artifacts: ["pr"] } }]);
	});
	for (const notify of [
		{ unknown: {} }, { slack: { server: "slack", unknown: true } }, { slack: {} },
		{ slack: { server: "" } }, { slack: { server: "slack\nother" } }, { slack: { server: "9slack" } },
		{ slack: { server: "slack.team" } }, { slack: { server: 1 } }, { slack: { server: "slack", channel: "" } },
		{ slack: { server: "slack", channel: "one\ntwo" } }, { slack: { server: "slack", channel: 1 } },
	] as const) test(`invalid notify cannot evaluate: ${JSON.stringify(notify)}`, r => {
		r.config({ ...r.handoff, notify }); eq(r.command(["roster"], 2), undefined);
	});
	for (const when of ["", "   ", "first\nsecond", "first\rsecond", 42, null, []]) test(`invalid when cannot evaluate: ${JSON.stringify(when)}`, r => {
		r.config({ ...r.handoff, flows: r.handoff.flows.map((flow, index) => index ? flow : { ...flow, when }) });
		eq(r.command(["roster"], 2), undefined);
	});
	for (const slack of [{ server: "Slack_team-2" }, { server: "slack", channel: "#design-review" }]) test(`valid Slack mount: ${JSON.stringify(slack)}`, r => {
		r.config({ ...r.handoff, notify: { slack } });
		eq(r.command(["roster", "--role", "designer"])[0].handle, "@dana");
	});
	for (const selection of ["none", "plan", "user", "areas", "ambiguous"] as const) test(`suggestions remain advisory with ${selection} selection`, r => {
		const hints = r.handoff.flows.slice(0, 2).map(flow => ({ id: flow.id, when: `Consider ${flow.id} after a visible behavior change.` }));
		r.config({ ...r.handoff, flows: r.handoff.flows.map((flow, index) => index < 2 ? { ...flow, when: hints[index]!.when } : flow) });
		r.user(selection === "user" ? { flow: "design-acceptance" } : {});
		r.plan({ ...(selection === "plan" ? { flow: "design-acceptance" } : {}),
			areas: selection === "areas" ? ["services/frontend/card.ts"] : selection === "ambiguous" ? ["services/frontend/card.ts", "services/billing/invoice.ts"] : [] });
		const result = r.command(["resolve", "--plan", PLAN], selection === "ambiguous" ? 1 : 0);
		eq(result.flow, selection === "none" ? "none" : selection === "ambiguous" ? null : "design-acceptance");
		same(result.suggestions, hints.filter(hint => hint.id !== result.flow));
		eq(result.source, selection === "none" ? "default" : selection === "ambiguous" ? "areas" : selection);
	});
	test("roster failures cannot evaluate", r => {
		r.put("docs/surfaces/people.md", ROSTER + LEE.replace("@lee", "@dana"));
		eq(r.command(["roster"], 2, /duplicate/), undefined);
	});
	test("unsupported preference cannot evaluate", r => {
		r.handoff.flows[0]!.gates[0]!.surfaces = ["pr-review"]; r.config();
		r.put("docs/surfaces/people.md", ROSTER.replace("U_DANA | —", "U_DANA | surface: tracker-reply"));
		r.command(["roster"], 2, /does not allow/);
	});
	for (const [row, diagnostic] of [
		[LEE.replace("lee-id", "dana-id"), /tracker id dana-id already belongs to another roster row/],
		[LEE.replace("lee-d", "DANA-L"), /GitHub login DANA-L already belongs to another roster row/],
		[LEE.replace("U_LEE", "U_DANA"), /Slack/],
	] as const) test(`duplicate roster identity blocks every command: ${diagnostic}`, r => {
		r.put("docs/surfaces/people.md", ROSTER + row); r.plan({ flow: "design-acceptance" });
		for (const args of [["roster"], ["resolve", "--plan", PLAN], ["status", "--plan", PLAN], ["user"], ["user", "--write", "--me", "@dev"]]) {
			eq(r.command(args, 2, diagnostic), undefined);
		}
		ok(!existsSync(r.userPath));
	});
	for (const content of ["{", "[]", JSON.stringify({ handoff: {} })]) test(`malformed metadata cannot evaluate: ${content}`, r => {
		r.put(".omp/mosaic.json", content); r.command(["roster"], 2, /handoff: /);
	});
	test("missing metadata and unreadable plan cannot evaluate", r => {
		r.command(["status", "--plan", "missing.md"], 2, /ENOENT/); rmSync(join(r.root, ".omp/mosaic.json")); r.command(["roster"], 2, /ENOENT/);
	});
	test("strict arguments reject unused options", r => {
		r.command(["resolve", "--plan", PLAN, "--write"], 1, /Unknown option/);
		r.command(["user", "--flow", "none"], 1, /require user --write/);
	});
	test("metadata is tool-relative but plan is cwd-relative", r => {
		r.user({});
		r.plan({ flow: "design-acceptance" }, "", "member/plan.md");
		const result = r.run("handoff", ["resolve", "--plan", "plan.md"], 0, join(r.root, "member"));
		eq(JSON.parse(result.stdout).flow, "design-acceptance");
	});
	test("status refuses a plan without an explicit flow", r => {
		r.plan(); eq(r.command(["status", "--plan", PLAN], 2, /plan has no flow:; record a flow id or `none — <reason>`/), undefined);
	});
	test("status clears an explicitly skipped flow", r => {
		r.plan({ flow: "none — internal change" }); same(r.command(["status", "--plan", PLAN]), { flow: "none", source: "plan", cleared: true, gates: [] });
	});
	for (const [field, value] of [
		["status", "approved"], ["flow", "design-acceptance"], ["acceptors", '{ designer: "@dana" }'], ["areas", "[services/billing/**]"],
	] as const) test(`duplicate ${field} cannot hide a conflicting plan decision`, r => {
		r.plan({ flow: field === "flow" ? "none — internal change" : "design-acceptance", acceptors: "{}" });
		const content = readFileSync(join(r.root, PLAN), "utf8").replace("\n---\n", `\n${field}: ${value}\n---\n`);
		r.put(PLAN, content);
		const diagnostic = new RegExp(`plan frontmatter declares ${field}: 2 times; keep exactly one`);
		eq(r.command(["status", "--plan", PLAN], 2, diagnostic), undefined);
		eq(r.command(["resolve", "--plan", PLAN], 1, diagnostic), undefined);
		r.lint(1, diagnostic);
	});
	test("status reports an unrequested gate", r => {
		r.plan({ flow: "design-acceptance" }); const result = r.command(["status", "--plan", PLAN], 1);
		eq(result.cleared, false); eq(result.gates[0].state, "none"); eq(result.gates[0].round, 0);
	});
	test("status records requested head and person", r => {
		r.plan({ flow: "design-acceptance" }, requested()); const result = r.command(["status", "--plan", PLAN], 1);
		eq(result.cleared, false); eq(result.gates[0].state, "requested"); eq(result.gates[0].acceptor, "@dana"); eq(result.gates[0].requestedHead, HEAD);
	});
	test("accepted archived plan clears with acceptance evidence", r => {
		const file = "docs/plans/archived/0042-handoff.md";
		r.plan({ flow: "design-acceptance", status: "done" }, `${requested()}\n${accepted()}`, file);
		const result = r.command(["status", "--plan", file]); eq(result.cleared, true); eq(result.gates[0].acceptedHead, HEAD); eq(result.gates[0].locator, "tracker-reply/accept-1");
	});
	for (const who of ["@unknown", "@pat"]) test(`status rejects requested non-holder ${who}`, r => {
		r.plan({ flow: "design-acceptance" }, requested("designer", who));
		eq(r.command(["status", "--plan", PLAN], 2, /is not a roster person holding role designer/), undefined);
	});
	for (const kind of ["ACCEPTED", "RETURNED"]) for (const surface of ["tracker-reply", "pr-review"] as const) {
		test(`status rejects ${kind} on disallowed ${surface}`, r => {
			r.handoff.flows[0]!.gates[0]!.surfaces = [surface === "tracker-reply" ? "pr-review" : "tracker-reply"]; r.config();
			const answer = (kind === "ACCEPTED" ? accepted() : `${returned}\n${findings}`).replace("tracker-reply/", `${surface}/`);
			r.plan({ flow: "design-acceptance" }, `${requested()}\n${answer}`);
			eq(r.command(["status", "--plan", PLAN], 2, new RegExp(`gate designer does not accept answers on ${surface}`)), undefined);
		});
		test(`status rejects ${kind} without ${surface} identity`, r => {
			r.put("docs/surfaces/people.md", surface === "tracker-reply"
				? ROSTER.replace("dana-id | @Dana Levi", "— | @Dana Levi")
				: ROSTER.replace("dana-l | U_DANA", "— | U_DANA"));
			const answer = (kind === "ACCEPTED" ? accepted() : `${returned}\n${findings}`).replace("tracker-reply/", `${surface}/`);
			r.plan({ flow: "design-acceptance" }, `${requested()}\n${answer}`);
			eq(r.command(["status", "--plan", PLAN], 2, new RegExp(`@dana has no roster identity on ${surface}`)), undefined);
		});
	}
	test("tracker acceptance must bind to the requested head", r => {
		r.plan({ flow: "design-acceptance" }, `${requested()}\n${accepted("designer", "@dana", 1, NEXT_HEAD)}`);
		eq(r.command(["status", "--plan", PLAN], 2, /a tracker reply binds to the requested head/), undefined);
	});
	test("PR acceptance may bind to the reviewed commit instead", r => {
		r.plan({ flow: "design-acceptance" }, `${requested()}\n${accepted("designer", "@dana", 1, NEXT_HEAD).replace("tracker-reply/", "pr-review/")}`);
		const result = r.command(["status", "--plan", PLAN]);
		eq(result.cleared, true); eq(result.gates[0].requestedHead, HEAD); eq(result.gates[0].acceptedHead, NEXT_HEAD); eq(result.gates[0].locator, "pr-review/accept-1");
	});
	test("returned findings remain pending", r => {
		r.plan({ flow: "design-acceptance" }, `${requested()}\n${returned}\n${findings}`); const result = r.command(["status", "--plan", PLAN], 1);
		eq(result.gates[0].state, "returned"); eq(result.gates[0].returnedRounds, 1); eq(result.gates[0].locator, "tracker-reply/return-1"); eq(result.cleared, false);
	});
	test("returned feedback supersedes same-round acceptance without rewriting its journal", r => {
		const file = "docs/plans/archived/0042-handoff.md";
		r.plan({ flow: "design-acceptance", status: "done" }, `${requested()}\n${accepted()}\n${returned}\n${findings}`, file);
		const before = readFileSync(join(r.root, file), "utf8");
		const result = r.command(["status", "--plan", file], 1), gate = result.gates[0];
		eq(result.cleared, false); eq(gate.state, "returned"); eq(gate.round, 1);
		eq(gate.returnedRounds, 1); eq(gate.acceptor, "@dana"); eq(gate.acceptedHead, null);
		eq(gate.locator, "tracker-reply/return-1");
		eq(readFileSync(join(r.root, file), "utf8"), before);
	});
	test("new round clears after accepted feedback was returned", r => {
		r.plan({ flow: "design-acceptance" }, `${requested()}\n${accepted()}\n${returned}\n${findings}\n${requested("designer", "@dana", 2, NEXT_HEAD)}\n${accepted("designer", "@dana", 2, NEXT_HEAD)}`);
		const result = r.command(["status", "--plan", PLAN]), gate = result.gates[0];
		eq(result.cleared, true); eq(gate.state, "accepted"); eq(gate.round, 2);
		eq(gate.returnedRounds, 1); eq(gate.acceptedHead, NEXT_HEAD); eq(gate.locator, "tracker-reply/accept-2");
	});
	test("duplicate acceptance in a cleared round remains invalid", r => {
		r.plan({ flow: "design-acceptance" }, `${requested()}\n${accepted()}\n${accepted()}`);
		r.command(["status", "--plan", PLAN], 2, /R1 for designer is not open/);
	});
	test("another role holder cannot return the acceptor's cleared round", r => {
		r.put("docs/surfaces/people.md", ROSTER + LEE);
		r.plan({ flow: "design-acceptance" }, `${requested()}\n${accepted()}\n${returned.replace("@dana", "@lee")}\n${findings}`);
		r.command(["status", "--plan", PLAN], 2, /@lee is not the requested acceptor @dana/);
	});
	test("return after acceptance still requires an allowed surface", r => {
		r.handoff.flows[0]!.gates[0]!.surfaces = ["pr-review"]; r.config();
		r.plan({ flow: "design-acceptance" }, `${requested()}\n${accepted().replace("tracker-reply/", "pr-review/")}\n${returned}\n${findings}`);
		r.command(["status", "--plan", PLAN], 2, /does not accept answers on tracker-reply/);
	});
	test("return after acceptance still requires the acceptor's surface identity", r => {
		r.put("docs/surfaces/people.md", ROSTER.replace("dana-id | @Dana Levi", "— | @Dana Levi"));
		r.plan({ flow: "design-acceptance" }, `${requested()}\n${accepted().replace("tracker-reply/", "pr-review/")}\n${returned}\n${findings}`);
		r.command(["status", "--plan", PLAN], 2, /@dana has no roster identity on tracker-reply/);
	});
	test("return after acceptance still requires its declared findings", r => {
		r.plan({ flow: "design-acceptance" }, `${requested()}\n${accepted()}\n${returned}`);
		r.command(["status", "--plan", PLAN], 2, /RETURNED finding count mismatch/);
	});
	for (const log of [returned, `${returned}\n${findings}\n- handoff R1 designer: S — Extra finding → fixed`]) test(`status refuses mismatched returned count: ${log.includes("Extra") ? "extra" : "missing"}`, r => {
		r.plan({ flow: "design-acceptance" }, `${requested()}\n${log}`); r.command(["status", "--plan", PLAN], 2, /finding count mismatch|finding without an open RETURNED count/);
	});
	test("later gate cannot open before first clears", r => {
		r.plan({ flow: "design-and-product" }, requested("product", "@pat")); r.command(["status", "--plan", PLAN], 2, /before gate designer cleared/);
	});
	test("ordered gates clear independently", r => {
		const log = `${requested()}\n${accepted()}\n${requested("product", "@pat")}`;
		r.plan({ flow: "design-and-product" }, log); const pending = r.command(["status", "--plan", PLAN], 1);
		same(pending.gates.map((gate: { state: string }) => gate.state), ["accepted", "requested"]);
		r.plan({ flow: "design-and-product" }, `${log}\n${accepted("product", "@pat")}`); eq(r.command(["status", "--plan", PLAN]).cleared, true);
	});
	for (const disposition of ["WITHDRAWN", "OVERRIDDEN"]) test(`${disposition} clears the request`, r => {
		r.plan({ flow: "design-acceptance" }, `${requested()}\n- handoff R1 designer: ${disposition} ${AT} by @dev — Human decision recorded`);
		const result = r.command(["status", "--plan", PLAN]); eq(result.cleared, true); eq(result.gates[0].state, disposition.toLowerCase());
	});
	test("repair opens a new head-bound round", r => {
		r.plan({ flow: "design-acceptance" }, `${requested()}\n${returned}\n${findings}\n${requested("designer", "@dana", 2, NEXT_HEAD)}\n${accepted("designer", "@dana", 2, NEXT_HEAD)}`);
		const gate = r.command(["status", "--plan", PLAN]).gates[0]; eq(gate.round, 2); eq(gate.returnedRounds, 1); eq(gate.acceptedHead, NEXT_HEAD);
	});
	for (const outcome of ["pending", "old-acceptance", "accepted"]) test(`superseding an open handoff round: ${outcome}`, r => {
		r.put("docs/surfaces/people.md", ROSTER + LEE);
		const requests = `${requested()}\n${requested("designer", "@lee", 2, NEXT_HEAD)}`;
		const answer = outcome === "pending" ? "" : outcome === "old-acceptance" ? accepted() : accepted("designer", "@lee", 2, NEXT_HEAD);
		r.plan({ flow: "design-acceptance" }, `${requests}\n${answer}`);
		if (outcome === "old-acceptance") {
			eq(r.command(["status", "--plan", PLAN], 2, /no request R1 for designer/), undefined);
		} else {
			const result = r.command(["status", "--plan", PLAN], outcome === "pending" ? 1 : 0);
			const gate = result.gates[0];
			eq(result.cleared, outcome === "accepted"); eq(gate.state, outcome === "pending" ? "requested" : "accepted");
			eq(gate.round, 2); eq(gate.requestedHead, NEXT_HEAD); eq(gate.acceptor, "@lee");
			eq(gate.acceptedHead, outcome === "accepted" ? NEXT_HEAD : null);
		}
	});
	for (const flow of ["TBD", "missing-flow", "none"]) test(`status refuses unresolved flow: ${flow}`, r => {
		r.plan({ flow }); r.command(["status", "--plan", PLAN], 2, /TBD|not a configured|needs a reason/);
	});
	test("status rejects malformed handoff lines", r => {
		r.plan({ flow: "design-acceptance" }, "- handoff R1 designer: ACCEPTED without evidence"); r.command(["status", "--plan", PLAN], 2, /malformed handoff line/);
	});
	test("user path uses XDG and committed SSH remote", r => {
		same(r.command(["user"]), { path: r.userPath, exists: false, valid: true }); ok(!existsSync(r.userPath));
	});
	test("user write persists validated defaults", r => {
		same(r.command(["user", "--write", "--me", "@dev", "--flow", "design-acceptance", "--acceptor", "designer=@dana", "--acceptor", "product=@pat"]), { path: r.userPath, written: true });
		const expected = { schema: 1, project: PROJECT, me: "@dev", defaults: { flow: "design-acceptance", acceptors: { designer: "@dana", product: "@pat" } } };
		eq(readFileSync(r.userPath, "utf8"), `${JSON.stringify(expected, null, 2)}\n`);
		same(r.command(["user"]), { path: r.userPath, exists: true, valid: true, content: expected });
	});
	for (const args of [["--me", "@unknown"], ["--me", "@dev", "--flow", "unknown"], ["--me", "@dev", "--acceptor", "designer=@pat"], ["--me", "@dev", "--acceptor", "designer=@dana", "--acceptor", "designer=@dana"]]) test(`invalid user write is side-effect free: ${args.join(" ")}`, r => {
		r.command(["user", "--write", ...args], 1, /handoff: /); ok(!existsSync(r.userPath)); ok(!existsSync(dirname(r.userPath)));
	});
	test("user write refuses a contributor acceptor without creating a file", r => {
		r.command(["user", "--write", "--me", "@dana", "--acceptor", "designer=@dana"], 1, /is you; an acceptor is someone other than the contributor/);
		ok(!existsSync(r.userPath)); ok(!existsSync(dirname(r.userPath)));
	});
	test("invalid user write preserves existing file", r => {
		r.user({ flow: "none" }); const before = readFileSync(r.userPath, "utf8");
		r.command(["user", "--write", "--me", "@dev", "--acceptor", "designer=@pat"], 1, /does not hold role/); eq(readFileSync(r.userPath, "utf8"), before);
	});
	for (const invalid of ["{", JSON.stringify({ schema: 1, project: PROJECT, me: "@dev", defaults: { acceptors: { designer: "@pat" } } })]) test(`invalid existing user file blocks resolve: ${invalid}`, r => {
		r.user({}); writeFileSync(r.userPath, invalid); r.plan({ flow: "none — no gate" });
		r.command(["resolve", "--plan", PLAN], 1, /handoff: /);
		const result = r.command(["user"], 1, /handoff: /); eq(result.exists, true); eq(result.valid, false); ok(typeof result.error === "string");
	});
	for (const [flow, status, code, diagnostic] of [
		["TBD", "approved", 1, /only allowed while status: draft/], ["TBD", "draft", 0, undefined],
		["none", "approved", 1, /needs a reason/], ["unknown", "approved", 1, /not a configured handoff flow/],
		["design-acceptance", "approved", 0, undefined], ["none — no interface change", "approved", 0, undefined],
	] as const) test(`lint flow ${flow} while ${status}`, r => {
		r.plan({ flow, status }); r.lint(code, diagnostic);
	});
	test("draft plan may omit flow while planning", r => {
		r.plan({ status: "draft" }); r.lint();
	});
	test("approved pre-module plan must record a flow decision", r => {
		r.plan({ status: "approved" }); r.lint(1, /record a flow id or `none — <reason>`; in-flight plans that predate the module use `none — predates handoff`/);
		r.plan({ status: "approved", flow: "none — predates handoff" }); r.lint();
	});
	test("module-off flow remains inert without constants installed", r => {
		r.config(null); rmSync(join(r.root, "tools/constants/handoff.ts"));
		r.plan({ status: "approved", flow: "design-acceptance", acceptors: "legacy value" }); r.lint();
		r.plan({ status: "approved" }); r.lint();
	});
	test("lint refuses escaping helper before executing it", r => {
		const marker = join(r.base, "external-module-executed");
		r.put("tools-escape/handoff.ts", `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(marker)}, "executed"); throw new Error("external code ran");\n`);
		const helper = join(r.root, "tools/constants/handoff.ts");
		rmSync(helper); symlinkSync(join(r.root, "tools-escape/handoff.ts"), helper);
		r.plan({ status: "approved", flow: "design-acceptance" });
		r.lint(2, /handoff helper is unavailable or escapes lint-ledgers' directory/);
		ok(!existsSync(marker), "external helper must never execute");
	});
	test("lint refuses a directory in place of its helper", r => {
		const helper = join(r.root, "tools/constants/handoff.ts");
		rmSync(helper); mkdirSync(helper);
		r.plan({ status: "approved", flow: "design-acceptance" });
		r.lint(2, /handoff helper is unavailable or escapes lint-ledgers' directory/);
	});
	test("lint accepts a contained helper symlink", r => {
		const helper = join(r.root, "tools/constants/handoff.ts"), target = join(r.root, "tools/shared/handoff.ts");
		mkdirSync(dirname(target), { recursive: true }); copyFileSync(helper, target);
		rmSync(helper); symlinkSync(target, helper);
		r.plan({ status: "approved", flow: "design-acceptance" }); r.lint();
	});
	test("member plan finds link metadata and roster through root walk", r => {
		const file = "services/frontend/docs/plans/0042-handoff.md";
		r.plan({ status: "approved", flow: "design-acceptance", acceptors: '{ designer: "@pat" }' }, "", file); r.lint(1, /does not hold role/, file);
		r.plan({ status: "approved", flow: "design-acceptance", acceptors: '{ designer: "@dana" }' }, "", file); r.lint(0, undefined, file);
	});
	test("tracker handoff changes state without a landing receipt", r => {
		const key = r.intent(); r.run("tracker", ["event", key, "review", "--writer", "owner#1"]);
		const result = JSON.parse(r.run("tracker", ["event", key, "handoff", "--writer", "owner#1", "--note", "Awaiting Dana"]).stdout);
		eq(result.state, "handoff"); eq(result.managed.lastEvent.event, "handoff"); eq(r.get(key).state, "handoff");
	});
	test("event takeover claims the next writer generation", r => {
		const key = r.intent(); r.run("tracker", ["event", key, "handoff", "--writer", "owner#1"]);
		r.run("tracker", ["event", key, "executing", "--writer", "resumer#2", "--take-over"]);
		const item = r.get(key); eq(item.state, "executing"); eq(item.managed.writer, "resumer#2"); ok(item.body.includes("writer: resumer#2\n"));
		const entries = JSON.parse(r.run("tracker", ["receipt", key]).stdout); eq(entries.at(-1).payload.takeover, true);
		r.run("tracker", ["event", key, "review", "--writer", "resumer#2"]);
		ok(r.run("tracker", ["event", key, "executing", "--writer", "owner#1"], 1).stderr.includes("WRITER-CONFLICT"));
	});
	for (const command of ["event", "comment"]) for (const [last, writer] of [["intent", "resumer#2"], ["review", "resumer#2"], ["handoff", "owner#2"], ["handoff", "resumer#1"], ["handoff", "resumer#3"]]) test(`${command} refuses invalid takeover after ${last} by ${writer}`, r => {
		const key = r.intent(); if (last !== "intent") r.run("tracker", ["event", key, last!, "--writer", "owner#1"]);
		const before = r.get(key), receipt = r.run("tracker", ["receipt", key]).stdout;
		const args = command === "event" ? ["event", key, "executing"] : ["comment", key, "--file", "comment.txt"];
		const refused = r.run("tracker", [...args, "--writer", writer!, "--take-over"], 1); ok(refused.stderr.includes("WRITER-CONFLICT"));
		same(r.get(key), before); eq(r.run("tracker", ["receipt", key]).stdout, receipt);
	});
	for (const command of ["event", "comment"]) test(`plain foreign ${command} still conflicts after handoff`, r => {
		const key = r.intent(); r.run("tracker", ["event", key, "handoff", "--writer", "owner#1"]);
		const args = command === "event" ? ["event", key, "executing"] : ["comment", key, "--file", "comment.txt"];
		ok(r.run("tracker", [...args, "--writer", "resumer#2"], 1).stderr.includes("WRITER-CONFLICT"));
	});
	test("comment takeover updates owner and managed body", r => {
		const key = r.intent(); r.run("tracker", ["event", key, "handoff", "--writer", "owner#1"]);
		const id = r.run("tracker", ["comment", key, "--file", "comment.txt", "--writer", "resumer#2", "--take-over"]).stdout.trim();
		const item = r.get(key); eq(item.managed.writer, "resumer#2"); ok(item.body.includes("writer: resumer#2\n")); eq(item.comments.find((comment: { id: string }) => comment.id === id).author, "resumer#2");
		eq(JSON.parse(r.run("tracker", ["receipt", key]).stdout).at(-1).payload.takeover, true);
		r.run("tracker", ["event", key, "executing", "--writer", "resumer#2"]);
	});
	test("replies retain parents and independent idempotence", r => {
		const key = r.intent(); const args = ["comment", key, "--file", "comment.txt", "--writer", "owner#1"];
		const parent = r.run("tracker", args).stdout.trim(); eq(r.run("tracker", args).stdout.trim(), parent);
		const reply = r.run("tracker", [...args, "--parent", parent]).stdout.trim(); notStrictEqual(reply, parent);
		eq(r.run("tracker", [...args, "--parent", parent]).stdout.trim(), reply);
		const otherReply = r.run("tracker", [...args, "--parent", reply]).stdout.trim(); notStrictEqual(otherReply, reply);
		const comments = r.get(key).comments; eq(comments.length, 3); eq(comments[1].parentId, parent); eq(comments[2].parentId, reply); eq(comments[0].parentId, undefined);
		const receipts = JSON.parse(r.run("tracker", ["receipt", key]).stdout); eq(receipts.at(-1).payload.parentId, reply);
		ok(r.run("tracker", [...args, "--parent", "missing"], 1).stderr.includes("unknown parent comment")); same(r.get(key).comments, comments);
	});
	test("existing top-level receipt remains idempotent across writers", r => {
		const key = r.intent(); const original = r.run("tracker", ["comment", key, "--file", "comment.txt", "--writer", "owner#1"]).stdout;
		eq(r.run("tracker", ["comment", key, "--file", "comment.txt", "--writer", "foreign#1"]).stdout, original);
		eq(r.get(key).comments.length, 1);
	});
	test("takeover on existing comment claims ownership without duplicating receipt", r => {
		const key = r.intent(); const args = ["comment", key, "--file", "comment.txt"];
		const original = r.run("tracker", [...args, "--writer", "owner#1"]).stdout;
		r.run("tracker", ["event", key, "handoff", "--writer", "owner#1"]);
		eq(r.run("tracker", [...args, "--writer", "resumer#2", "--take-over"]).stdout, original);
		const item = r.get(key); eq(item.managed.writer, "resumer#2"); eq(item.comments.length, 1);
		ok(r.run("tracker", [...args, "--writer", "resumer#2", "--take-over"], 1).stderr.includes("WRITER-CONFLICT"));
	});
	test("seeded parent and relay attribution survive get", r => {
		const comments = [
			{ id: "request", body: "Please accept", author: "owner#1", createdAt: AT },
			{ id: "human", body: "Accepted", author: "dana-id", createdAt: AT, parentId: "request", onBehalfOf: null },
			{ id: "relay", body: "Accepted through relay", author: "relay-id", createdAt: AT, parentId: "request", onBehalfOf: "dana-id" },
		];
		r.put("docs/tracker/items.json", JSON.stringify([{ key: "ENG-42", id: "item-42", title: "Handoff", body: "", state: "review", assignee: null,
			labels: [], team: "Engineering", url: "replay://ENG-42", updatedAt: AT, repos: ["link-repo"], managed: null, comments, attachments: [] }]));
		same(r.get("ENG-42").comments, comments);
		ok(r.run("tracker", ["comment", "ENG-42", "--file", "comment.txt", "--writer", "resumer#2", "--take-over"], 1).stderr.includes("WRITER-CONFLICT"));
	});
	for (const state of ["done", "abandoned", "parked"]) test(`handoff refuses ${state} state`, r => {
		const key = r.intent();
		const flags = state === "done" ? ["--receipt", JSON.stringify({ repo: "link-repo", ref: "main", commit: HEAD, reachable: true })] : state === "parked" ? ["--note", "Wait for access"] : [];
		r.run("tracker", ["event", key, state, "--writer", "owner#1", ...flags]);
		r.run("tracker", ["event", key, "handoff", "--writer", "owner#1"], 1); eq(r.get(key).state, state);
	});
	for (const notify of [false, true]) {
		const fixture = new Fixture(), target = join(fixture.base, "installed"), overlay = join(fixture.base, "overlay");
		const manifest = join(fixture.base, "manifest.json");
		mkdirSync(join(overlay, "docs/surfaces"), { recursive: true });
		writeFileSync(join(overlay, "docs/surfaces/people.md"), ROSTER.replace("U_DANA", "—") + LEE.replace("U_LEE", "—"));
		const when = "The change needs a design acceptance decision.";
		const slack = { server: "slack_team", channel: "C_REVIEW" };
		writeFileSync(manifest, JSON.stringify({
			project: { name: "Handoff smoke", summary: "An offline handoff integration fixture." },
			topology: "monorepo", members: [], remotes: { link: "https://example.invalid/app.git" },
			tracking: { mode: "none" }, landing: { mode: "pull-request", host: "github" },
			handoff: { flows: [{ id: "design-acceptance", when, gates: [{ role: "designer", surfaces: ["pr-review"] }] }],
				...(notify ? { notify: { slack } } : {}) },
		}));
		await install({ manifest, target, overlay, kitCommit: "fixture" });
		const metadata = JSON.parse(readFileSync(join(target, ".omp/mosaic.json"), "utf8"));
		eq(metadata.handoff.flows[0].when, when);
		if (notify) same(metadata.handoff.notify, { slack });
		else eq(Object.hasOwn(metadata.handoff, "notify"), false);
		const doctor = Bun.spawnSync([process.execPath, join(target, "tools/doctor.ts")], {
			cwd: target, stdout: "pipe", stderr: "pipe",
		});
		eq(doctor.exitCode, 0, `${doctor.stdout}\n${doctor.stderr}`);
		const output = doctor.stdout.toString(), warnings = output.split("\n").filter(line => line.startsWith("WARN "));
		if (notify) {
			for (const handle of ["@dana", "@lee"]) ok(warnings.some(line => line.includes(handle) && /slack/i.test(line)), output);
			eq(warnings.length, 2, output);
			ok(output.endsWith("doctor: 0 fail, 2 warn, 0 cannot-evaluate\n"), output);
		} else eq(output, "doctor: 0 fail, 0 warn, 0 cannot-evaluate\n");
		console.log(`PASS ${++count} installed notify ${notify ? "on warns for each missing gate-holder Slack id" : "off does not warn"} and when rendering`);
	}
	console.log(`PASS ${count} handoff smoke cases`);
} finally {
	rmSync(scratch, { recursive: true, force: true });
}
