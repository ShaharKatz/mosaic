---
name: review-with-codex
description: "Opt-in read-only Codex review of one pinned snapshot; no fixes, pushes, comments, or automatic mutations."
---
# Review with Codex
Read `docs/process/stack.md` and `docs/process/review-loop.md`. This is an optional engine; `gpt-reviewer` remains the default.
Input: source repository, pinned base/head commits, plan/checklist or `no plan` and acceptance, pitfalls, prior rulings, later-round own-code delta, and verification/scenario evidence for that exact snapshot.
The caller supplies the pinned base, including for stacked branches; do not guess a default branch or invent a base resolver.
Return a review only. Never fix code, commit, push, write tracker state, post comments, or start a review-cycles loop.
Prerequisites: Bun with `bun:ffi`/`cc` for descriptor-safe mutations (Linux needs libc development linker files); `python3` for standard-library JUnit parsing; the declared test toolchain. These are checked by execution, never installed by doctor.

## Snapshot and evidence
1. Select covering test files before provisioning. Reuse verification only for the exact reviewed snapshot; run only missing covering tests. Mutations require the orchestrator's explicit request.
2. Set `HARNESS` to the installed absolute `tools/codex-review-harness.ts` path, `CONFIG` to the source's `.omp/mosaic.json`, `SOURCE` to the owning repository, and `RUN_DIR` to a new directory outside it. Set `SNAP` to a nonexistent child of that directory.
3. Run `bun "$HARNESS" gather --repo "$SOURCE" --base "$BASE" --head "$HEAD" --out "$SNAP"`. Read its JSON and `"$SNAP.diff"`; base=head is a hard stop, not an empty clean review.
4. Gather creates a detached `--no-hardlinks` clone; it does not copy uncommitted files. If requested, explicitly copy reviewed uncommitted/untracked files into that clone, preserving bytes/modes/deletions, record the exact inventory and extend the diff. Otherwise state that uncommitted work is excluded. Do not review source-tree files while claiming snapshot evidence.
5. For independent member repositories, repeat with each member's own pinned base/head and separate clone/results. `--repository <member path>` selects that repository's runtime testing entries; selections and cwd are relative to its clone, not the link repository. Omit this flag for the link/root repository.
6. Run `bun "$HARNESS" provision --clone "$SNAP" --config "$CONFIG" --for <covering path>` (repeat `--for` for each path; include `--repository` when needed). Only installation-approved `setup` and `verifyCommand` execute automatically. Undeclared setup stops for human approval and a recorded configuration change; never improvise setup.
7. Capture `bun "$HARNESS" snapshot-state --clone "$SNAP"` after provisioning as nonempty `STATE`; it includes copied work, not just the committed tree. Stop if capture fails.
8. Run `bun "$HARNESS" test --clone "$SNAP" --config "$CONFIG" --out "$RUN_DIR/test-results.json" -- <covering paths>` with the same repository selector. Read the artifact's `status`, names and diagnostics: command exit 0 means a result was written, not tests passed. `ERROR` outranks `FAILED`, which outranks `PASS`; missing/malformed/all-skipped reports are errors.
9. Tests/setup/mutations run with developer privileges in the disposable clone, never in the source checkout. This prevents accidental spillover, not hostile tests. Ignored environments are outside the isolation comparison; never copy/reuse source environments. Editable roots must remain in-clone; use declared provenance verification for project-specific imports/builds.
{{LANDING_PULL_REQUEST}}
## Pull-request context
Require installed/authenticated `gh` before discovery; never install or log in automatically. Read the open PR's pinned diff and all pages of issue comments, reviews and inline comments. Retain every command's exit code; a failed fetch is not an empty list. An authenticated lookup that explicitly finds no PR permits local-only review with that fact stated; other lookup failures stop. Supply fetched comments verbatim and assess each against the snapshot. The local pinned diff remains authoritative if the remote head is older.
{{/LANDING_PULL_REQUEST}}

## Read-only review
1. Write a prompt under `RUN_DIR` containing the inputs, exact snapshot identity, diff, test evidence/limits and any prior rulings. For later rounds prioritize fix completeness and the caller's own-code delta; widen only for changed contracts, guards or safety-critical paths. Do not reopen ruled findings without materially new evidence.
2. Ask for concrete reachable triggers, cited file/lines, fixes and confidence; do not manufacture findings. Proposed mutations are requests, not evidence. Only the selected tests can establish a mutation outcome.
3. Run `bun "$HARNESS" run --clone "$SNAP" --repo "$SOURCE" --prompt "$RUN_DIR/prompt.txt" --out "$RUN_DIR/findings.json"` in the foreground. The harness checks CLI capabilities/login and affirmative write-blocked/network-blocked sandbox markers, then runs Codex read-only with the prompt file on stdin and the shared strict schema; other commands receive empty stdin. It never installs/logs in or selects a model; configured Codex settings apply. Do not weaken the sandbox to make a failure pass.
4. Nonzero exit, absent/empty/malformed/schema-invalid output, failed posture probe or isolation failure means failed review, never approval. Preserve artifacts and snapshot. Read the actual JSON before reporting any finding/verdict.
5. Validate every finding against the snapshot code. Keep confirmed findings; record a concrete cited reason for every false-positive ruling. Present unresolved disagreements with both positions to the orchestrator; no unbounded dispute loop.

## Requested mutations and restoration
Run only on request: `bun "$HARNESS" mutate --clone "$SNAP" --config "$CONFIG" --spec "$RUN_DIR/findings.json" --out "$RUN_DIR/matrix.json"` with the same repository selector. Read the retained matrix, including baselines, diagnostics and contamination flags.
- `caught by <test>`: passing unchanged baseline, then an attributable named assertion failure.
- `SURVIVED`: only those selected tests passed with the mutation; not proof the change is harmless.
- `NOT APPLIED`: no unique applicable snippet or read/write failure; proves nothing, never survival.
- `INCONCLUSIVE`: failing/changed baseline, execution problem, or unattributable exit-code-only failure; never a coverage claim.
- `REFUSED`: unsafe/untracked/linked target, invalid paths, or tests spanning components; not a content judgment.
The harness restores original bytes/mode through a held directory descriptor, refuses symlink/hardlink targets, and stops later mutations after contamination. A retained matrix is not trustworthy when restoration/isolation fails.

## Return and cleanup
Run `bun "$HARNESS" assert-isolation --clone "$SNAP" --repo "$SOURCE" --expect-state "$STATE"`. A failed assertion keeps the clone for inspection; never delete failed-run evidence. Only after success may the caller remove its exact owned snapshot directory.
Return actual engine `Codex`, verdict (`ship`/`revise`/`block`), reviewed head/base, action-required findings, open disagreements, per-comment assessments when fetched, dropped findings with code reasons, artifact paths and verification limits. `ship` maps to APPROVE only with no action-required findings or disagreements; other verdicts map to REVISE. The orchestrator owns repair rounds, evidence placement and human decisions under `docs/process/review-loop.md`.
