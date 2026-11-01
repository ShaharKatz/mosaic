---
name: diagrams
description: Edit Mermaid topology files directly, validate provenance and return worktree projections/deltas without committing.
---
# Diagram updates

Scope: `{{DIAGRAMS_ROOT}}/` under the target repository root. Run commands from that root; for scratch repositories without installed tools, use `bun <installed root>/tools/<tool>.ts` with cwd set to scratch and its own `.omp/mosaic.json` settings.

## 1. Precheck before any write
Read `rule://records`. Diagrams are plain-text Mermaid `.mmd` files edited directly; no MCP server or external editor is involved. Run `bun tools/diagram-check.ts` once first so pre-existing failures are reported, not attributed to your edit.

## 2. Read inputs
Read `{{DIAGRAMS_ROOT}}/README.md`, the plan's Architecture delta, exact authorized paths and base SHA. Require recorded global decisions and existing intent for decision-changing edits: approved `plan:NNNN` without a tracker, otherwise `tracker://<key>` per the tracker rule. Missing inputs or conflicting scope/contract are stop conditions, never invented decisions.

## 3. Start a new file
For a new file only, write the header `flowchart LR` (or `flowchart TB`) followed by the contract's canonical `classDef` block, copied exactly from `{{DIAGRAMS_ROOT}}/README.md`. Name the system diagram `system.mmd` and detail views `<component-slug>.mmd`.

## 4. Edit the source text
1. Keep the canonical layout and section order: header; node definitions and `subgraph` groups (each group's data line right after its `end`); top-level edges, each followed by its data line; `class` lines; the `classDef` block last.
2. Use stable logical ids Mermaid reads as one id (no keyword such as `end`, also not before a first `-` or `.` as in `end-user`; no `--`, `-.` or `.-`), quoted values with `#quot;` and `<br/>` encodings, layer/category/edge-kind classes, provenance and endpoint visibility per the contract; never write `direction` followed by `TB`, `BT`, `RL`, `LR` or `TD` in any text.
3. Change only the elements the declaration names; move or redeclare edges when moving vertices.
4. Run `bun tools/diagram-delta.ts project <file>` and confirm the projection shows exactly the intended elements and rows.

## 5. Validate and report
Run `bun tools/diagram-check.ts <file>`, `bun tools/diagram-delta.ts delta <base sha> --worktree <file>`, `bun tools/diagram-delta.ts project <file>` and `bun tools/diagram-delta.ts compare <plan> <base sha> --worktree`. Fix failures and repeat affected proof. Rendered previews (Orca `.mmd` viewer, Mermaid Live Editor) are for human viewing, not review evidence.
Return the worktree delta, validator count line, text projection, comparison result and changed files. The orchestrator independently verifies before committing.

## Hard boundaries
Never stage or commit, never edit outside the authorized diagrams home, never read rendered images as evidence, never skip a failing check or leave a file outside the canonical layout. No generated-file ownership is implied by the core bundle.
{{DIAGRAMS_ERD}}
Generated Prisma ERDs (`.erd.mmd`) under the configured adapter output are never keeper-edited. Follow `rule://diagrams`'s generated-ERD guidance instead; generation and sync checks need no MCP.
{{/DIAGRAMS_ERD}}
