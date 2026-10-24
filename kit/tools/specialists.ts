#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

export type Specialist = { agent: string; paths: string[]; context?: string };

// Use rendered heading text, preserving separate spaces and globally unique slugs.
export function headingAnchors(markdown: string): string[] {
	const used = new Set<string>();
	const anchors: string[] = [];
	Bun.markdown.render(markdown, { heading: children => {
		const slug = children.toLowerCase().replace(/<[^>]*>/g, "").replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/ /g, "-");
		let anchor = slug;
		for (let suffix = 1; used.has(anchor); suffix++) anchor = `${slug}-${suffix}`;
		used.add(anchor);
		anchors.push(anchor);
		return "";
	} });
	return anchors;
}

export function matchingSpecialists(specialists: Specialist[], changedPaths: string[], prefix = ""): string[] {
	const agents = new Set<string>();
	const memberPrefix = prefix ? `${prefix.replace(/\/+$/, "")}/` : "";
	for (const specialist of specialists) {
		if (agents.has(specialist.agent)) continue;
		if (specialist.paths.some(glob => {
			const pattern = new Bun.Glob(glob);
			return changedPaths.some(file => pattern.match(`${memberPrefix}${file}`));
		})) agents.add(specialist.agent);
	}
	return [...agents];
}

export function changedPaths(nameStatus: string): string[] {
	if (!nameStatus) return [];
	const fields = nameStatus.split("\0");
	if (fields.pop() !== "") throw new Error("unterminated name-status output");
	const paths: string[] = [];
	for (let index = 0; index < fields.length;) {
		const status = fields[index++]!;
		const count = /^[AMDT]$/.test(status) ? 1 : /^[RC]\d+$/.test(status) ? 2 : 0;
		if (!count) throw new Error(`unsupported diff status: ${status}`);
		for (let side = 0; side < count; side++) {
			const file = fields[index++];
			if (!file) throw new Error(`missing path for diff status: ${status}`);
			paths.push(file);
		}
	}
	return paths;
}

if (import.meta.main) {
	try {
		const { values } = parseArgs({ args: Bun.argv.slice(2), strict: true, options: {
			repo: { type: "string" }, base: { type: "string" }, head: { type: "string" }, prefix: { type: "string" },
		} });
		if (!values.repo || !values.base || !values.head) throw new Error("usage: bun tools/specialists.ts --repo <path> --base <sha> --head <sha> [--prefix <member path>]");
		if (![values.base, values.head].every(sha => /^[a-f0-9]{40,64}$/i.test(sha))) throw new Error("base and head must be pinned commit hashes");
		const prefix = values.prefix ?? "";
		if (prefix && (/^[\\/]/.test(prefix) || /[\\\r\n\0]/.test(prefix)
			|| prefix.replace(/\/+$/, "").split("/").some(part => !part || part === "." || part === ".."))) throw new Error("prefix must be installation-relative");
		const config = JSON.parse(readFileSync(resolve(import.meta.dir, "../.omp/mosaic.json"), "utf8"));
		const specialists: Specialist[] = config.review?.specialists ?? [];
		if (!Array.isArray(specialists) || specialists.some(entry => !entry || typeof entry.agent !== "string"
			|| !/^[a-zA-Z0-9][\w-]*$/.test(entry.agent) || !Array.isArray(entry.paths) || !entry.paths.length
			|| entry.paths.some(glob => typeof glob !== "string" || !glob.trim() || /^[\\/]/.test(glob)
				|| /[\\\r\n\0()|`]/.test(glob) || glob.includes("\u007b\u007b") || glob.split("/").some(part => !part || part === "." || part === "..")))) throw new Error("invalid review.specialists metadata");
		const diff = spawnSync("git", ["-C", values.repo, "diff", "--name-status", "-z", "-M", `${values.base}...${values.head}`], { encoding: "utf8" });
		if (diff.status !== 0) throw new Error(`cannot evaluate pinned diff: ${String(diff.stderr || diff.error || "git failed").trim()}`);
		const agents = matchingSpecialists(specialists, changedPaths(diff.stdout), prefix);
		console.log(JSON.stringify(agents));
	} catch (error) {
		console.error(`specialists: ${error instanceof Error ? error.message : String(error)}`);
		process.exitCode = 2;
	}
}
