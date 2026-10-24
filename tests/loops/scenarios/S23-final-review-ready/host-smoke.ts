import assert from "node:assert/strict";
import { chmod, copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = await realpath(await mkdtemp(join(tmpdir(), "mosaic-final-review-host-")));
try {
  const control = join(root, ".scenario"), repo = join(root, "cases/planned"), origin = join(control, "origin.git");
  await mkdir(join(control, "bin"), { recursive: true });
  await mkdir(repo, { recursive: true });
  for (const [source, target] of [["fake-gh.ts", "gh"], ["host-request.ts", "host-request.ts"]]) await copyFile(join(import.meta.dir, source), join(control, "bin", target));
  await chmod(join(control, "bin/gh"), 0o755);
  const git = (args: string[], stdin?: string) => {
    const result = Bun.spawnSync(["git", ...args], { cwd: root, stdin: stdin === undefined ? undefined : Buffer.from(stdin),
      env: { ...process.env, GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid", GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid" }, stdout: "pipe", stderr: "pipe" });
    assert.equal(result.exitCode, 0, result.stderr.toString());
    return result.stdout.toString().trim();
  };
  git(["init", "--bare", origin]);
  const tree = git(["--git-dir", origin, "mktree"], "");
  const sha = git(["--git-dir", origin, "commit-tree", tree], "fixture\n");
  git(["--git-dir", origin, "update-ref", "refs/heads/topic", sha]);
  await writeFile(join(control, "state.json"), JSON.stringify({ cases: { planned: { repo, origin, base: sha, head: sha, next: null, moved: false, failedFetch: false, bots: false } } }));
  const body = "Comment 101 rejected: the approved increment is two.";
  await writeFile(join(repo, "reply.txt"), body);
  await writeFile(join(repo, "reply.json"), JSON.stringify({ body }));
  const endpoint = "repos/fixture/planned/issues/1/comments";
  const probes: { args: string[]; method: string; stdin?: string }[] = [
    ...["-F", "--field", "-f", "--raw-field"].map(flag => ({ args: ["api", endpoint, flag, `body=${body}`], method: "POST" })),
    { args: ["api", endpoint, "--input", "reply.json"], method: "POST" },
    { args: ["api", endpoint, "--input", "-"], method: "POST", stdin: JSON.stringify({ body }) },
    { args: ["api", endpoint, "--method", "POST", "-F", "body=@reply.txt"], method: "POST" },
    { args: ["api", endpoint, "-X", "GET", "-F", `body=${body}`], method: "GET" },
    { args: ["api", endpoint, "--method=GET", "--input", "reply.json"], method: "GET" },
    { args: ["pr", "comment", "1", "--body", body], method: "POST" },
    { args: ["pr", "comment", "1", "--body-file", "reply.txt"], method: "POST" },
    { args: ["pr", "comment", "1", "--body-file", "-"], method: "POST", stdin: body },
  ];
  for (const probe of probes) {
    const result = Bun.spawnSync([process.execPath, join(control, "bin/gh"), ...probe.args], { cwd: repo,
      stdin: probe.stdin === undefined ? undefined : Buffer.from(probe.stdin), stdout: "pipe", stderr: "pipe" });
    assert.equal(result.exitCode, 0, result.stderr.toString());
    const call = JSON.parse((await readFile(join(control, "calls.jsonl"), "utf8")).trim().split("\n").at(-1)!);
    assert.deepEqual({ method: call.method, endpoint: call.endpoint, body: call.body }, { method: probe.method, endpoint, body });
    const output = JSON.parse(result.stdout.toString());
    if (probe.method === "GET") assert.deepEqual(output, []);
    else if (probe.args[0] === "pr") assert.equal(output.body, body);
    else assert.equal(output.accepted, true);
  }
  console.log(`PASS executable fake host: ${probes.length} request/body variants, explicit GET overrides preserved`);
} finally { await rm(root, { recursive: true, force: true }); }
