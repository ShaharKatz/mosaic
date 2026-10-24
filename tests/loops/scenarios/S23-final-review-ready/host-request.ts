import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type HostRequest = { method: string; endpoint: string; body: string };
export async function hostRequest(args: string[], cwd: string, name: string): Promise<HostRequest> {
  const flags: Record<string, string[]> = {};
  for (let index = 0; index < args.length; index++) {
    const match = /^(--[^=]+)=(.*)$/.exec(args[index]);
    const flag = match?.[1] ?? args[index];
    if (!["--method", "-X", "-f", "-F", "--field", "--raw-field", "--input", "--body", "--body-file"].includes(flag)) continue;
    const value = match?.[2] ?? args[++index];
    if (value === undefined) throw new Error(`Missing value for ${flag}`);
    (flags[flag] ??= []).push(value);
  }
  const read = (file: string) => file === "-" ? Bun.stdin.text() : readFile(resolve(cwd, file), "utf8");
  let body = "";
  const input = flags["--input"]?.at(-1);
  if (input !== undefined) {
    const content = await read(input);
    try {
      const parsed = JSON.parse(content);
      body = typeof parsed.body === "string" ? parsed.body : content;
    } catch { body = content; }
  }
  for (const flag of ["-f", "--raw-field", "-F", "--field"]) for (const field of flags[flag] ?? []) {
    if (!field.startsWith("body=")) continue;
    const value = field.slice("body=".length);
    body = (flag === "-F" || flag === "--field") && value.startsWith("@") ? await read(value.slice(1)) : value;
  }
  const bodyFile = flags["--body-file"]?.at(-1);
  if (bodyFile !== undefined) body = await read(bodyFile);
  body = flags["--body"]?.at(-1) ?? body;
  const comment = args[0] === "pr" && args[1] === "comment";
  const explicit = flags["--method"]?.at(-1) ?? flags["-X"]?.at(-1);
  const hasFields = ["-f", "-F", "--field", "--raw-field", "--input"].some(flag => flags[flag]);
  return { method: comment ? "POST" : (explicit ?? (hasFields ? "POST" : "GET")).toUpperCase(),
    endpoint: comment ? `repos/fixture/${name}/issues/${args[2] ?? "1"}/comments` : args.find(arg => arg.startsWith("repos/")) ?? "", body };
}
