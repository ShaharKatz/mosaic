---
description: "Declare architecture deltas, maintain as-built and intended diagrams, and verify decisions and landing receipts."
---
Read when: planning or implementing architectural changes, reviewing diagram deltas, or closing a plan.
# Two views, three layers
- Follow `{{DIAGRAMS_ROOT}}/README.md`: as-built view is `as-built` + `retiring`; intended view is `as-built` + `intended`. Code is the authority for reality; recorded decisions are the authority for direction.
# Declaring a delta
- Every plan fills `## Architecture delta` with `adds`, `realizes`, `builds`, `retires`, `removes`, `withdraws`, `changes` and `diagrams:`, each `none` when empty.
- Type A realizes existing intent without semantic change, removes retiring elements, or tracks code. Type B changes direction without code; type C changes direction with code. A build absent from intent is `builds`, never `realizes`.
- Apply the decision predicate in `{{DIAGRAMS_ROOT}}/README.md`. The records task assigns and records the next global `D<n>` in the owning element doc and decision map before the diagram task, with its `gate: Decision — …` line (`rule://records`) in the records task's commit and the Execution log; drafts use `D-NNNN-n`. The approval brief names the direction change.
- Intent exists before drawing: `plan:NNNN` identifies the approved plan with tracking `none`; otherwise use `tracker://<key>` through `rule://tracker`. Never invent intent or decisions.
# Who acts
- The diagram task is the last implementation task, dispatched to `diagram-keeper` using the diagrams skill. Its review packet contains worktree delta and text projection, not pixels or raw XML.
- The keeper never stages or commits. The orchestrator reruns `bun tools/diagram-check.ts` and `bun tools/diagram-delta.ts delta <base sha> --worktree` before committing; include validation in the project's declared verification command.
- In multi-repo projects, as-built `source` paths into member repositories require those members to be checked out wherever diagram-check runs (including link-repo CI); absent members report check 4.
# Close-out
- `bun tools/diagram-delta.ts compare <plan> <base sha> HEAD` must exit 0 or return to review. Rerun after any diagram-changing rebase before landing.
- Merge `bun tools/diagram-delta.ts delta <base sha> HEAD --candidates --plan <plan>` into the librarian packet.
# Intent and receipts
- `areas:` may name exact `diagram:<file>#<id>` entries. Type A binds to existing intent; no projection text is mirrored to a tracker.
- A landing receipt names every realized `<file>#<id>` and its transition, with the commit or pull-request locator required by `rule://git-flow`. Without a tracker retain receipts in the plan log and ledger; otherwise post through `rule://tracker`, closing intent only when all its elements are built.
- Optional GitHub diagram links use the configured remote and default branch; neither GitHub nor an MCP is required for offline validation/deltas.
- Audit stale/missing intent and architecture-shaped work without elements as a scoped human digest, never by querying a tracker in CI.
# Light path
- Architectural light-path changes update as-built through the keeper on the same branch and carry the worktree delta in the commit body. A new element absent from intent is a direction change routed to `rule://plan-triage`.
{{DIAGRAMS_ERD}}
# Generated Prisma ERDs
- The enabled `diagrams.erd` adapter owns its configured output exclusively; generated ERDs are marked generated-only and the keeper never edits them. Single-file and split Prisma schemas are supported without a running MCP.
- On schema changes run `bun tools/erd-generate.ts`, then `bun tools/erd-generate.ts --check` and `bun tools/diagram-check.ts` through the project's declared verification command. This is schema visualization only, not a migration or database procedure.
- `--check` is read-only and names missing, changed and unexpected outputs. `--file <schema>` selects a repo-relative input or an unambiguous path suffix, isolates its output and performs no orphan cleanup; references still resolve across all inputs.
- Output must be a safe directory strictly inside the diagrams home, never a kit-file collision. Full generation removes only orphan files bearing both the generated suffix and marker. Other files remain and fail sync.
- Declaration comparison exempts only generated outputs of this enabled adapter when its full sync check passes for the compared snapshot; disabling the adapter or any drift restores ordinary declaration requirements.
{{/DIAGRAMS_ERD}}
