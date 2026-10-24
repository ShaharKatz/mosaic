#!/usr/bin/env bun
import { strictEqual, deepStrictEqual, ok, throws, rejects } from "node:assert";
import * as fs from "node:fs";
import * as p from "node:path";
import { tmpdir } from "node:os";
import type { TestEntry } from "../../kit/tools/constants/codex-review.ts";
import { MUTATION, PROBE, STATUS } from "../../kit/tools/constants/codex-review.ts";
import { groups, inside, mutate, parseReport, provision, route, runTests, safeReplace, stateHash } from "../../kit/tools/codex-review-harness.ts";
const { install } = await import(process.env.MOSAIC_INSTALLER ?? new URL("../../kit/install.ts", import.meta.url).href);
const scratch = fs.mkdtempSync(p.join(tmpdir(), "mosaic review smoke "));
const bun = process.execPath;
let cases = 0;
function pass(name: string): void { cases++; console.log(`PASS ${name}`); }
function put(root: string, file: string, text: string): void { fs.mkdirSync(p.dirname(p.join(root, file)), { recursive: true }); fs.writeFileSync(p.join(root, file), text); }
function command(args: string[], cwd: string, expected = 0, env = process.env): string {
  const result = Bun.spawnSync(args, { cwd, env, stdout: "pipe", stderr: "pipe" });
  strictEqual(result.exitCode, expected, `${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result.stdout.toString();
}
function git(root: string, ...args: string[]): string { return command(["git", ...args], root); }
function entry(format: TestEntry["testRunner"]["format"], testCommand: string, path = ".", cwd = path): TestEntry {
  return { repository: ".", path, testCommand, testRunner: { format, setup: [], argsPrefix: [], cwd } };
}
const manifest = {
  project: { name: "Example", summary: "Example contains isolated test subjects." }, topology: "monorepo", git: { defaultBranch: "main" },
  tracking: { mode: "none" }, landing: { mode: "direct" }, remotes: { link: "https://example.invalid/example.git", members: {} }, members: [], components: [],
  rootTest: { testCommand: "uv run --with pytest pytest", testRunner: { format: "pytest", setup: [], argsPrefix: [], cwd: "." } },
};
try {
  const input = p.join(scratch, "manifest.json"); fs.writeFileSync(input, JSON.stringify(manifest));
  const source = p.join(scratch, "installed");
  await install({ manifest: input, target: source, kitCommit: "smoke" });
  const config = JSON.parse(fs.readFileSync(p.join(source, ".omp/mosaic.json"), "utf8"));
  deepStrictEqual(config.testing[0], { repository: ".", path: ".", ...manifest.rootTest });
  const harness = p.join(source, "tools/codex-review-harness.ts");
  strictEqual(command([bun, "tools/doctor.ts"], source), "doctor: 0 fail, 0 warn, 0 cannot-evaluate\n");
  pass("installed root runner and doctor without Codex");

  git(source, "init", "-b", "review-smoke");
  git(source, "config", "user.name", "Smoke"); git(source, "config", "user.email", "smoke@example.invalid");
  put(source, ".gitignore", ".venv/\nnode_modules/\n.pytest_cache/\n__pycache__/\n");
  put(source, "subject.py", "VALUE = 11\nUNUSED = 33\n");
  put(source, "test subject.py", "from subject import VALUE\ndef test_value():\n    assert VALUE == 11\n");
  git(source, "add", "."); git(source, "commit", "-qm", "base");
  const base = git(source, "rev-parse", "HEAD").trim();
  put(source, "subject.py", "VALUE = 11\nUNUSED = 34\n");
  git(source, "add", "."); git(source, "commit", "-qm", "change");
  const head = git(source, "rev-parse", "HEAD").trim();
  const clone = p.join(scratch, "snapshot with spaces");
  command([bun, harness, "gather", "--repo", source, "--base", base, "--head", head, "--out", clone], source);
  strictEqual(git(clone, "rev-parse", "HEAD").trim(), head);
  for (const format of ["jest", "vitest", "exit-code"] as const) {
    throws(() => groups(clone, [entry(format, "true")], ["subject.py::test_value"]), /only pytest supports node IDs/);
  }
  ok(fs.readFileSync(`${clone}.diff`, "utf8").includes("UNUSED = 34"));
  command([bun, harness, "gather", "--repo", source, "--base", head, "--head", head, "--out", `${clone}-empty`], source, 1);
  command([bun, harness, "provision", "--clone", clone, "--for", "test subject.py"], source);
  const state = command([bun, harness, "snapshot-state", "--clone", clone], source).trim();
  const out = p.join(scratch, "pytest-result.json");
  command([bun, harness, "test", "--clone", clone, "--out", out, "--", "test subject.py"], source);
  strictEqual(JSON.parse(fs.readFileSync(out, "utf8")).status, STATUS.pass);
  command([bun, harness, "assert-isolation", "--clone", clone, "--repo", source, "--expect-state", state], source);
  command([bun, harness, "assert-isolation", "--clone", clone, "--repo", source], source, 1);
  pass("native gather/provision/test/isolation with real pytest, pinned commits and spaced paths");

  const matrix = p.join(scratch, "matrix.json");
  for (const [format, testCommand, testFile, subject, body] of [
    ["pytest", "uv run --with pytest pytest", "test subject.py", "subject.py", "from subject import VALUE\ndef test_value():\n    assert VALUE == 11\n"],
    ["jest", "npx --yes --package=jest jest --config '{}'", "value.test.js", "subject.json", "const fs=require('node:fs'); test('value catches mutation',()=>expect(JSON.parse(fs.readFileSync('subject.json')).VALUE).toBe(11));\n"],
    ["vitest", "npx --yes --package=vitest vitest --globals", "value.test.js", "subject.json", "test('value catches mutation',()=>expect(JSON.parse(require('node:fs').readFileSync('subject.json')).VALUE).toBe(11));\n"],
  ] as const) {
    const root = format === "pytest" ? clone : p.join(scratch, format);
    if (format !== "pytest") {
      fs.mkdirSync(root); git(root, "init", "-b", "review-smoke"); git(root, "config", "user.name", "Smoke"); git(root, "config", "user.email", "smoke@example.invalid");
      put(root, ".gitignore", "node_modules/\n"); put(root, "package.json", '{"private":true}\n');
      put(root, subject, '{"VALUE":11,"UNUSED":34}\n'); put(root, testFile, body);
      git(root, "add", "."); git(root, "commit", "-qm", "suite");
    }
    const selected = [testFile]; const configured = [entry(format, testCommand)];
    strictEqual(runTests(root, configured, selected).status, STATUS.pass);
    const specs = [
      { label: "caught", file: subject, old: format === "pytest" ? "VALUE = 11" : '"VALUE":11', new: format === "pytest" ? "VALUE = 1" : '"VALUE":1', test_paths: selected },
      { label: "survived", file: subject, old: format === "pytest" ? "UNUSED = 34" : '"UNUSED":34', new: format === "pytest" ? "UNUSED = 3" : '"UNUSED":3', test_paths: selected },
      { label: "not-applied", file: subject, old: "NOT_PRESENT", new: "", test_paths: selected },
    ];
    const before = stateHash(root);
    strictEqual(await mutate(root, configured, specs, selected, matrix), 0);
    const results = JSON.parse(fs.readFileSync(matrix, "utf8"));
    ok(results[0].result.startsWith(MUTATION.caught), JSON.stringify(results));
    strictEqual(results[1].result, MUTATION.survived);
    ok(results[2].result.startsWith(MUTATION.notApplied));
    strictEqual(stateHash(root), before);
    const original = fs.readFileSync(p.join(root, subject));
    fs.writeFileSync(p.join(root, subject), original.toString().replace(format === "pytest" ? "VALUE = 11" : '"VALUE":11', format === "pytest" ? "VALUE = 1" : '"VALUE":1'));
    const failure = runTests(root, configured, selected); strictEqual(failure.status, STATUS.failed); ok(failure.names.some(name => name.includes("value")));
    strictEqual(await mutate(root, configured, specs.slice(0, 1), selected, matrix), 0);
    ok(JSON.parse(fs.readFileSync(matrix, "utf8"))[0].result.startsWith(MUTATION.inconclusive));
    fs.writeFileSync(p.join(root, subject), original);
    const skipped = format === "pytest" ? "import pytest\n@pytest.mark.skip\ndef test_value():\n    assert False\n" : "test.skip('skipped',()=>{});\n";
    put(root, testFile, skipped);
    strictEqual(runTests(root, configured, selected).status, STATUS.error);
    put(root, testFile, body);
    pass(`${format}: real pass/failure/named caught/survived/not-applied/baseline/all-skipped and restoration`);
  }

  const opaque = [entry("exit-code", "test $(cat subject.py | wc -l) -eq 2")];
  strictEqual(runTests(clone, opaque, ["subject.py"]).status, STATUS.pass);
  strictEqual(parseReport("exit-code", "", 7).status, STATUS.failed);
  strictEqual(await mutate(clone, [entry("exit-code", "test -f subject.py && ! test -f missing")], [{ file: "subject.py", old: "VALUE = 11", new: "VALUE = 1", test_paths: ["subject.py"] }], [], matrix), 0);
  const coarse = [entry("exit-code", "test \"$(cat subject.py)\" = \"$(printf 'VALUE = 11\\nUNUSED = 34')\"")];
  strictEqual(await mutate(clone, coarse, [{ file: "subject.py", old: "VALUE = 11", new: "VALUE = 1", test_paths: ["subject.py"] }], [], matrix), 0);
  ok(JSON.parse(fs.readFileSync(matrix, "utf8"))[0].result.startsWith(MUTATION.inconclusive));
  pass("opaque exit-code command: nonzero failure is never attributable coverage");

  for (const format of ["pytest", "jest", "vitest"]) {
    for (const text of ["", "malformed", "null", "[]", "{}", "<testsuites><testcase></testsuites>"]) strictEqual(parseReport(format, text, 0).status, STATUS.error);
  }
  const json = JSON.stringify({ numPassedTests: 0, numFailedTests: 1, testResults: [{ status: "failed", assertionResults: [{ status: "failed", fullName: "failure" }] }], numRuntimeErrorTestSuites: 1 });
  strictEqual(parseReport("jest", json, 1).status, STATUS.error);
  strictEqual(parseReport("vitest", json, 1, JSON.stringify({ unhandledErrors: 1, reason: "failed" })).status, STATUS.error);
  strictEqual(parseReport("pytest", '<testsuite><testcase><failure/></testcase></testsuite>', 1).status, STATUS.error);
  const previousPythonPath = process.env.PYTHONPATH;
  put(scratch, "source-python/json.py", 'raise RuntimeError("source imports must not execute while parsing reports")\n');
  try {
    process.env.PYTHONPATH = p.join(scratch, "source-python");
    strictEqual(parseReport("pytest", '<testsuite><testcase name="safe"/></testsuite>', 0).status, STATUS.pass);
  } finally {
    if (previousPythonPath === undefined) delete process.env.PYTHONPATH; else process.env.PYTHONPATH = previousPythonPath;
  }
  pass("malformed/missing/nonobject reports, runtime errors and abnormal precedence");

  put(clone, "component with spaces/test.py", "def test_component():\n    assert True\n");
  const rootEntry = entry("pytest", "uv run --with pytest pytest");
  const component = entry("pytest", "uv run --with pytest pytest", "component with spaces");
  deepStrictEqual([...groups(clone, [rootEntry, component], ["./component with spaces//test.py::test_component"]).values()], [["test.py::test_component"]]);
  deepStrictEqual([...groups(clone, [rootEntry, component], ["component with spaces", "component with spaces/missing.py"]).values()], [[]]);
  strictEqual(runTests(clone, [rootEntry, component], ["component with spaces/test.py"]).status, STATUS.pass);
  const rootFirst = entry("exit-code", "true"), single = entry("exit-code", "exit 3", "a");
  rootFirst.testRunner.setup = ["printf root > selected-setup.txt"]; single.testRunner.setup = ["printf component > selected-setup.txt"];
  put(clone, "a/t.js", "");
  deepStrictEqual([...groups(clone, [rootFirst, single], ["a/t.js"]).keys()], [single], "one-character component must outrank root");
  strictEqual(runTests(clone, [rootFirst, single], ["a/t.js"]).status, STATUS.failed);
  provision(clone, [rootFirst, single], ["a/t.js"]);
  strictEqual(fs.readFileSync(p.join(clone, "a/selected-setup.txt"), "utf8"), "component");
  ok(!fs.existsSync(p.join(clone, "selected-setup.txt")));
  for (const filename of ["-k.py", "@x"]) deepStrictEqual([...groups(clone, [rootEntry], [filename]).values()], [[`./${filename}`]], "option-like filename must stay literal");
  for (const path of ["../escape", "/etc/passwd", `${clone}2/test.py`]) throws(() => route(clone, path));
  fs.symlinkSync(scratch, p.join(clone, "outside-link")); throws(() => route(clone, "outside-link/../escape")); fs.unlinkSync(p.join(clone, "outside-link"));
  ok(!inside(clone, `${clone}2`));
  pass("longest component routing, node IDs, whole selection, component cwd, raw/normalized containment");

  const wrapper = p.join(scratch, "wrapper.sh");
  fs.writeFileSync(wrapper, '#!/bin/sh\n[ "$1" = -- ] || exit 90\nshift\nexec uv run --with pytest pytest "$@"\n'); fs.chmodSync(wrapper, 0o755);
  const wrapped = entry("pytest", `sh '${wrapper}'`); wrapped.testRunner.argsPrefix = ["--"];
  strictEqual(runTests(clone, [wrapped], ["test subject.py::test_value"]).status, STATUS.pass);
  pass("wrapper argument forwarding and spaced root filename/node ID");
  const trackedTarget = p.join(clone, "subject.py"), startingBytes = fs.readFileSync(trackedTarget), startingMode = fs.statSync(trackedTarget).mode & 0o7777;
  try {
    const copiedBytes = Buffer.from("VALUE = 11\r\n# copied uncommitted work\r\n");
    fs.writeFileSync(trackedTarget, copiedBytes); fs.chmodSync(trackedTarget, 0o640);
    strictEqual(await mutate(clone, [rootEntry], [{ file: "subject.py", old: "VALUE = 11", new: "VALUE = 1", test_paths: ["test subject.py"] }], [], matrix), 0);
    ok(JSON.parse(fs.readFileSync(matrix, "utf8"))[0].result.startsWith(MUTATION.caught));
    deepStrictEqual(fs.readFileSync(trackedTarget), copiedBytes); strictEqual(fs.statSync(trackedTarget).mode & 0o7777, 0o640);
    const binary = Buffer.from([255, 0, 10]); fs.writeFileSync(trackedTarget, binary);
    strictEqual(await mutate(clone, [entry("exit-code", "true")], [{ file: "subject.py", old: "x", new: "y", test_paths: ["subject.py"] }], [], matrix), 0);
    ok(JSON.parse(fs.readFileSync(matrix, "utf8"))[0].result.startsWith(MUTATION.notApplied));
    deepStrictEqual(fs.readFileSync(trackedTarget), binary);
  } finally { fs.writeFileSync(trackedTarget, startingBytes); fs.chmodSync(trackedTarget, startingMode); }
  pass("copied uncommitted CRLF bytes/mode are restored; binary apply errors retain a truthful matrix");

  const before = stateHash(clone);
  const original = fs.readFileSync(p.join(clone, "subject.py")); const mode = fs.statSync(p.join(clone, "subject.py")).mode & 0o7777;
  for (const action of [() => fs.writeFileSync(p.join(clone, "subject.py"), Buffer.from(original.toString().replaceAll("\n", "\r\n"))),
    () => fs.chmodSync(p.join(clone, "subject.py"), 0o646), () => git(clone, "update-index", "--skip-worktree", "subject.py")]) {
    action(); ok(stateHash(clone) !== before); fs.writeFileSync(p.join(clone, "subject.py"), original); fs.chmodSync(p.join(clone, "subject.py"), mode); git(clone, "update-index", "--no-skip-worktree", "subject.py");
  }
  const beforeMode = fs.statSync(clone).mode & 0o7777; fs.chmodSync(clone, beforeMode === 0o700 ? 0o755 : 0o700); ok(stateHash(clone) !== before); fs.chmodSync(clone, beforeMode);
  put(clone, "deep/inner/state.txt", "state");
  const ancestor = p.join(clone, "deep/inner"), ancestorMode = fs.statSync(ancestor).mode & 0o7777, ancestorState = stateHash(clone);
  try { fs.chmodSync(ancestor, ancestorMode === 0o700 ? 0o755 : 0o700); ok(stateHash(clone) !== ancestorState, "non-root ancestor mode must change state"); }
  finally { fs.chmodSync(ancestor, ancestorMode); }
  const linkedState = stateHash(clone), externalLink = p.join(scratch, "tracked-hardlink");
  try { fs.linkSync(p.join(clone, "subject.py"), externalLink); ok(stateHash(clone) !== linkedState, "tracked file link count must change state"); }
  finally { fs.unlinkSync(externalLink); }
  fs.unlinkSync(p.join(clone, "subject.py")); const missing = stateHash(clone); fs.mkdirSync(p.join(clone, "subject.py")); ok(stateHash(clone) !== missing); fs.rmdirSync(p.join(clone, "subject.py")); fs.writeFileSync(p.join(clone, "subject.py"), original);
  if (process.platform === "linux") {
    const rawName = Buffer.concat([Buffer.from(`${clone}/raw-`), Buffer.from([255])]);
    fs.writeFileSync(rawName, "first"); const rawState = stateHash(clone);
    fs.writeFileSync(rawName, "second"); ok(stateHash(clone) !== rawState); fs.unlinkSync(rawName);
  }
  pass("raw bytes, file/directory modes, index flags and missing/directory distinction");

  const outside = p.join(scratch, "outside.txt"); fs.writeFileSync(outside, "outside unchanged");
  for (const kind of ["symlink", "hardlink"]) {
    fs.unlinkSync(p.join(clone, "subject.py"));
    if (kind === "symlink") fs.symlinkSync(outside, p.join(clone, "subject.py")); else fs.linkSync(outside, p.join(clone, "subject.py"));
    await safeReplace(clone, "subject.py", original, mode);
    strictEqual(fs.readFileSync(outside, "utf8"), "outside unchanged"); strictEqual(fs.lstatSync(p.join(clone, "subject.py")).nlink, 1);
  }
  put(clone, "held/subject.txt", "before"); const held = p.join(clone, "held"); const moved = p.join(clone, "held-original");
  const external = p.join(scratch, "external"); fs.mkdirSync(external); put(external, "subject.txt", "outside");
  await safeReplace(clone, "held/subject.txt", Buffer.from("restored"), 0o640, () => { fs.renameSync(held, moved); fs.symlinkSync(external, held); });
  strictEqual(fs.readFileSync(p.join(external, "subject.txt"), "utf8"), "outside");
  strictEqual(fs.readFileSync(p.join(moved, "subject.txt"), "utf8"), "restored");
  fs.unlinkSync(held); fs.renameSync(moved, held);
  await rejects(safeReplace(clone, "../outside.txt", Buffer.from("bad"), 0o600));
  put(clone, "race/intermediate/leaf/subject.txt", "inside"); put(scratch, "race-outside/leaf/subject.txt", "outside unchanged");
  const intermediate = p.join(clone, "race/intermediate"), savedIntermediate = p.join(clone, "race/saved"), raceOutside = p.join(scratch, "race-outside");
  try {
    await rejects(safeReplace(clone, "race/intermediate/leaf/subject.txt", Buffer.from("bad"), 0o600, undefined, () => {
      fs.renameSync(intermediate, savedIntermediate); fs.symlinkSync(raceOutside, intermediate);
    }), /REFUSED: held directory outside clone/);
    strictEqual(fs.readFileSync(p.join(raceOutside, "leaf/subject.txt"), "utf8"), "outside unchanged");
  } finally { fs.unlinkSync(intermediate); fs.renameSync(savedIntermediate, intermediate); }
  git(clone, "add", "held/subject.txt");
  const failedRestore = entry("exit-code", `if [ "$(cat held/subject.txt)" = changed ]; then mv held held-saved; ln -s '${external}' held; fi; true`);
  try {
    strictEqual(await mutate(clone, [failedRestore], [{ file: "held/subject.txt", old: "restored", new: "changed", test_paths: ["held/subject.txt"] }], [], matrix), 1);
    const row = JSON.parse(fs.readFileSync(matrix, "utf8"))[0];
    ok(row.result.startsWith(MUTATION.inconclusive) && row.result.includes(MUTATION.survived) && row.result.includes("restoration failed"));
    strictEqual(fs.readFileSync(p.join(external, "subject.txt"), "utf8"), "outside");
  } finally {
    fs.unlinkSync(held); fs.renameSync(p.join(clone, "held-saved"), held); put(clone, "held/subject.txt", "restored");
  }
  pass(`held-directory link swap and symlink/hardlink restoration on ${process.platform}`);

  const setup = entry("exit-code", "true"); setup.testRunner.setup = ["printf setup > approved.txt"]; setup.testRunner.verifyCommand = "test -f approved.txt";
  provision(clone, [setup], ["subject.py"]); strictEqual(fs.readFileSync(p.join(clone, "approved.txt"), "utf8"), "setup"); fs.unlinkSync(p.join(clone, "approved.txt"));
  put(clone, ".venv/lib/python-test/site-packages/_editable_impl_example.pth", `${scratch}\n`);
  throws(() => provision(clone, [entry("exit-code", "true")], ["subject.py"]), /outside review clone/);
  fs.unlinkSync(p.join(clone, ".venv/lib/python-test/site-packages/_editable_impl_example.pth"));
  throws(() => provision(clone, [setup], ["../escape"])); ok(!fs.existsSync(p.join(clone, "approved.txt")));
  pass("approved setup/provenance and outside editable-root/selection refusals");

  const refusalSpecs = [null, { file: "../outside.txt", old: "outside", new: "bad", test_paths: ["subject.py"] },
    { file: "subject.py", old: "VALUE = 11", new: "VALUE = 1", test_paths: ["subject.py", "component with spaces/test.py"] },
    { file: "subject.py", old: "VALUE = 11", new: "VALUE = 1", test_paths: "not-an-array" }];
  strictEqual(await mutate(clone, [rootEntry, component], refusalSpecs, [], matrix), 0);
  const refusals = JSON.parse(fs.readFileSync(matrix, "utf8")); ok(refusals[0].result.startsWith(MUTATION.notApplied)); ok(refusals.slice(1).every((row: { result: string }) => row.result.startsWith(MUTATION.refused)));
  const dirty = entry("exit-code", "printf dirt > contamination.txt; true");
  strictEqual(await mutate(clone, [dirty], [
    { file: "subject.py", old: "VALUE = 11", new: "VALUE = 1", test_paths: ["subject.py"] },
    { file: "subject.py", old: "VALUE = 11", new: "VALUE = 2", test_paths: ["subject.py"] },
  ], [], matrix), 1);
  const contaminated = JSON.parse(fs.readFileSync(matrix, "utf8")); ok(contaminated.every((row: { result: string }) => row.result.startsWith(MUTATION.inconclusive))); fs.unlinkSync(p.join(clone, "contamination.txt"));
  pass("malformed specs, traversal/mixed component refusal and contamination stopping matrix");
  const dirtyTarget = entry("pytest", "printf '\\n# baseline edited target\\n' >> subject.py; uv run --with pytest pytest");
  strictEqual(await mutate(clone, [dirtyTarget], [
    { file: "subject.py", old: "VALUE = 11", new: "VALUE = 1", test_paths: ["test subject.py"] },
    { file: "subject.py", old: "VALUE = 11", new: "VALUE = 2", test_paths: ["test subject.py"] },
  ], [], matrix), 1);
  const targetMatrix = JSON.parse(fs.readFileSync(matrix, "utf8"));
  ok(targetMatrix.every((row: { result: string; contaminated: boolean }) => row.result.startsWith(MUTATION.inconclusive) && row.contaminated));
  deepStrictEqual(fs.readFileSync(p.join(clone, "subject.py")), original);
  pass("passing real pytest baseline cannot hide target edits through restoration or continue its matrix");

  const member = p.join(scratch, "independent member");
  fs.mkdirSync(member); git(member, "init", "-b", "review-smoke");
  put(member, "member.py", "def test_member():\n    assert True\n");
  const memberConfig = p.join(scratch, "member-config.json");
  fs.writeFileSync(memberConfig, JSON.stringify({ testing: [{ ...entry("pytest", "uv run --with pytest pytest"), repository: "members/example" }] }));
  command([bun, harness, "test", "--clone", member, "--repository", "members/example", "--config", memberConfig, "--out", out, "--", "member.py"], source);
  strictEqual(JSON.parse(fs.readFileSync(out, "utf8")).status, STATUS.pass);
  pass("independent member clone cwd and explicit runtime repository selection");

  const invalidTargetSpecs = [
    { file: "absent.py", old: "x", new: "y", test_paths: ["subject.py"] },
    { file: "subject.py", old: "\n", new: "", test_paths: ["test subject.py"] },
    { file: p.join(clone, "subject.py"), old: "VALUE = 11", new: "x", test_paths: ["subject.py"] },
    { file: "component with spaces/test.py", old: "True", new: "False", test_paths: ["subject.py"] },
  ];
  strictEqual(await mutate(clone, [rootEntry], invalidTargetSpecs, [], matrix), 0);
  const invalidTargets = JSON.parse(fs.readFileSync(matrix, "utf8"));
  ok(invalidTargets[0].result.startsWith(MUTATION.notApplied));
  ok(invalidTargets[1].result.startsWith(MUTATION.notApplied));
  ok(invalidTargets.slice(2).every((row: { result: string }) => row.result.startsWith(MUTATION.refused)));
  fs.linkSync(p.join(clone, "subject.py"), p.join(scratch, "subject-hardlink"));
  strictEqual(await mutate(clone, [rootEntry], [{ file: "subject.py", old: "VALUE = 11", new: "x", test_paths: ["subject.py"] }], [], matrix), 0);
  ok(JSON.parse(fs.readFileSync(matrix, "utf8"))[0].result.startsWith(MUTATION.refused)); fs.unlinkSync(p.join(scratch, "subject-hardlink"));
  strictEqual(runTests(clone, [entry("exit-code", "missing-review-executable")], ["subject.py"]).status, STATUS.error);
  const mixed = runTests(clone, [entry("exit-code", "printf safe-command-ran")], ["../escape", "subject.py"]);
  strictEqual(mixed.status, STATUS.error); ok(mixed.output.includes("safe-command-ran"));
  const noGit = p.join(scratch, "not-git"); fs.mkdirSync(noGit);
  strictEqual(await mutate(noGit, [rootEntry], [], [], matrix), 1);
  ok(JSON.parse(fs.readFileSync(matrix, "utf8"))[0].result === MUTATION.inconclusive);
  pass("missing/duplicate/absolute/untracked/hardlink mutation targets, missing executable, mixed safe/unsafe groups and initial matrix failure");

  const stub = p.join(scratch, "bin"); fs.mkdirSync(stub);
  for (const [body, expected] of [["exit 2", 1], ["exit 0", 1], [`echo ${PROBE.writeOK}; echo ${PROBE.netOK}`, 0], [`echo ${PROBE.writeBad}; echo ${PROBE.netOK}`, 1]] as const) {
    put(stub, "codex", `#!/bin/sh\n${body}\n`); fs.chmodSync(p.join(stub, "codex"), 0o755);
    command([bun, harness, "probe-sandbox", "--clone", clone], source, expected, { ...process.env, PATH: `${stub}:${process.env.PATH}` });
  }
  pass("sandbox missing markers/abnormal exit/write allowed fail closed");
  const trace = p.join(scratch, "codex-trace");
  const prompt = p.join(scratch, "prompt.txt"); fs.writeFileSync(prompt, "Review only the pinned diff.");
  put(stub, "codex", `#!/bin/sh
printf '%s\\n' "$*" >> "$REVIEW_STUB_TRACE"
if [ "$1" != exec ] || [ "$2" = --help ]; then [ -z "$(cat)" ] || exit 95; fi
case "$1" in
  --version) echo codex-test; exit 0;;
  login) [ "$2" = status ]; exit $?;;
  sandbox) echo ${PROBE.writeOK}; echo ${PROBE.netOK}; exit 0;;
  exec)
    if [ "$2" = --help ]; then echo '--sandbox --output-schema --output-last-message'; exit 0; fi
    last=
    for argument in "$@"; do last=$argument; done
    [ "$last" = - ] || exit 93
    instructions=$(cat)
    [ -n "$instructions" ] || exit 94
    if [ -n "$REVIEW_STUB_INPUT" ]; then printf '%s' "$instructions" > "$REVIEW_STUB_INPUT"; fi
    if [ -n "$REVIEW_STUB_DIRTY" ]; then
      while [ "$#" -gt 0 ]; do
        if [ "$1" = -C ]; then shift; printf changed > "$1/review-side-effect.txt"; break; fi
        shift
      done
      printf '%s' "$REVIEW_STUB_RESULT" > "$REVIEW_STUB_OUT"
      exit 0
    fi
    while [ "$#" -gt 0 ]; do
      if [ "$1" = -o ]; then shift; printf '%s' "$REVIEW_STUB_RESULT" > "$1"; exit 0; fi
      shift
    done
    exit 91;;
esac
exit 92
`);
  fs.chmodSync(p.join(stub, "codex"), 0o755);
  const validReview = { verdict: "ship", summary: "No findings.", findings: [], proposed_mutations: [], addressed_pr_comments: [] };
  for (const [index, payload] of [validReview, {}, null, { ...validReview, verdict: "invented" }].entries()) {
    command([bun, harness, "run", "--clone", clone, "--repo", source, "--prompt", prompt, "--out", p.join(scratch, `review-${index}.json`)], source, index === 0 ? 0 : 1,
      { ...process.env, PATH: `${stub}:${process.env.PATH}`, REVIEW_STUB_TRACE: trace, REVIEW_STUB_RESULT: JSON.stringify(payload) });
  }
  const largePrompt = p.join(scratch, "large-prompt.txt"), receivedPrompt = p.join(scratch, "received-prompt.txt");
  const largeInstructions = "change\n".repeat(40_000) + "end";
  ok(Buffer.byteLength(largeInstructions) > 200 * 1024); fs.writeFileSync(largePrompt, largeInstructions);
  command([bun, harness, "run", "--clone", clone, "--repo", source, "--prompt", largePrompt, "--out", p.join(scratch, "large-review.json")], source, 0,
    { ...process.env, PATH: `${stub}:${process.env.PATH}`, REVIEW_STUB_TRACE: trace, REVIEW_STUB_RESULT: JSON.stringify(validReview), REVIEW_STUB_INPUT: receivedPrompt });
  strictEqual(fs.readFileSync(receivedPrompt, "utf8"), largeInstructions);
  // Codex runs inside the clone; a relative --out must still land beside the caller, never in the clone.
  command([bun, harness, "run", "--clone", clone, "--repo", source, "--prompt", "prompt.txt", "--out", "relative-review.json"], scratch, 0,
    { ...process.env, PATH: `${stub}:${process.env.PATH}`, REVIEW_STUB_TRACE: trace, REVIEW_STUB_RESULT: JSON.stringify(validReview) });
  ok(fs.existsSync(p.join(scratch, "relative-review.json")), "relative output must be written beside the caller");
  ok(!fs.existsSync(p.join(clone, "relative-review.json")), "relative output must never be written into the clone");
  const danglingOutput = p.join(scratch, "dangling-review.json"), danglingTarget = p.join(scratch, "must-not-create.json");
  fs.symlinkSync(danglingTarget, danglingOutput);
  command([bun, harness, "run", "--clone", clone, "--repo", source, "--prompt", prompt, "--out", danglingOutput], source, 1,
    { ...process.env, PATH: `${stub}:${process.env.PATH}`, REVIEW_STUB_TRACE: trace, REVIEW_STUB_RESULT: JSON.stringify(validReview) });
  ok(fs.lstatSync(danglingOutput).isSymbolicLink()); ok(!fs.existsSync(danglingTarget));
  fs.unlinkSync(danglingOutput);
  const sourceAlias = p.join(scratch, "source-output-alias"); fs.symlinkSync(source, sourceAlias);
  for (const forbidden of [p.join(source, "forbidden-review.json"), p.join(clone, "forbidden-review.json"), p.join(sourceAlias, "alias-review.json")]) {
    command([bun, harness, "run", "--clone", clone, "--repo", source, "--prompt", prompt, "--out", forbidden], source, 1,
      { ...process.env, PATH: `${stub}:${process.env.PATH}`, REVIEW_STUB_TRACE: trace, REVIEW_STUB_RESULT: JSON.stringify(validReview) });
    ok(!fs.existsSync(forbidden), "refused output must never be written");
  }
  fs.unlinkSync(sourceAlias);
  const existingOutput = p.join(scratch, "existing-review.json"); fs.writeFileSync(existingOutput, "preserve existing result");
  command([bun, harness, "run", "--clone", clone, "--repo", source, "--prompt", prompt, "--out", existingOutput], source, 1,
    { ...process.env, PATH: `${stub}:${process.env.PATH}`, REVIEW_STUB_TRACE: trace, REVIEW_STUB_RESULT: JSON.stringify(validReview) });
  strictEqual(fs.readFileSync(existingOutput, "utf8"), "preserve existing result");
  const dirtyReviewOutput = p.join(scratch, "dirty-review.json");
  command([bun, harness, "run", "--clone", clone, "--repo", source, "--prompt", prompt, "--out", dirtyReviewOutput], source, 1,
    { ...process.env, PATH: `${stub}:${process.env.PATH}`, REVIEW_STUB_TRACE: trace, REVIEW_STUB_RESULT: JSON.stringify(validReview), REVIEW_STUB_DIRTY: "1", REVIEW_STUB_OUT: dirtyReviewOutput });
  ok(fs.existsSync(p.join(clone, "review-side-effect.txt")));
  fs.unlinkSync(p.join(clone, "review-side-effect.txt"));
  const invocations = fs.readFileSync(trace, "utf8");
  ok(invocations.includes("exec --skip-git-repo-check -s read-only -C"));
  const calls = invocations.split("\n");
  ok(calls.filter(line => line.startsWith("exec ")).every(line => !line.includes(" -m ") && !line.includes(" --model ")));
  deepStrictEqual([...new Set(calls.filter(line => line.startsWith("login ")))], ["login status"]);
  pass("actual Codex command boundary: capability/login/posture gates, read-only execution and strict result rejection");
  console.log(`codex-review-smoke: ${cases} cases passed; real pytest/Jest/Vitest suites executed; no model calls`);
} finally { fs.rmSync(scratch, { recursive: true, force: true }); }
