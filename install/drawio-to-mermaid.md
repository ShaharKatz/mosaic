# Upgrading a draw.io project to Mermaid (`/mosaic-kit`)

Source-side procedure for upgrading an installed project whose runtime `.omp/mosaic.json` selects `diagrams.mode: "drawio"`. The current installer rejects that mode, so this runs inside the regular baseline-diff upgrade in the installed `docs/kit/maintenance.md` ("Manifest, placeholders, and upgrades"), before any new kit files are placed. Projects whose `diagrams.mode` is absent or `none` skip this file entirely and take the regular upgrade.

`<mosaic>` below is the absolute path of this mosaic checkout; `<root>` is the project's `diagrams.root` (default `docs/architecture/diagrams`). Run every command from the installed project root.

## 1. Preflight

- Read `.omp/mosaic.json` and the saved manifest. Continue only when `.omp/mosaic.json` says `diagrams.mode: "drawio"`. After this migration only the frozen archived manifest still says `drawio`: later upgrades skip this file and render their baselines from it with `mermaid` substituted, as step 9 records.
- List active plans (outside `docs/plans/archived/`) whose diagram task has not landed. Their `## Architecture delta` declarations and base snapshot are `.drawio`, and no delta is computed across the migration commit, so they land or pause first. Name them in the brief.
- Start from a clean worktree on a new `kit/<slug>` branch.

## 2. Old baseline

Render the previous kit revision (`kit.commit`) with the saved manifest into fresh scratch, as the regular upgrade does, and diff it against the installed tree to derive the adaptation set. Keep its `tools/` for reference; the converter carries its own copy of the pre-migration reader and projection (from mosaic `e2b4125`), so it never runs project code.

## 3. Working manifest

Copy the saved manifest to the working input and set `diagrams.mode: "mermaid"`. `root`, `components` and `erd` stay unchanged. Make the same one-word change in the live `.omp/mosaic.json` now: the converter's closing diagram-check reads it.

## 4. Convert

```sh
bun <mosaic>/install/drawio-to-mermaid.ts --root <root> [--plans docs/plans] [--docs docs]
```

- `<root>` covers generated ERDs too: `diagrams.erd.output` always lies inside it. Pass `--plans docs/plans` whenever the project has plans, and `--docs docs` whenever it has live docs. `--docs` accepts one safe repository-relative directory.
- Each hand-authored `.drawio` becomes the sibling `.mmd`: ids, labels (`<br/>` line breaks, `#quot;` quotes), layers as classes, `<object>` attributes as data pairs, containers as subgraphs, tables as `table: "true"` nodes, shapes, categories from the old palette, and edge kinds from dash style.
- Generated ERDs (`mxfile generator="mosaic-prisma-erd"`) are deleted, not converted; step 6 regenerates them.
- With `--plans`, `.drawio` becomes `.mmd` in `diagram:<path>#<id>` areas and in `## Architecture delta` references and `- diagrams:` lists of plans outside `docs/plans/archived/`. Archived plans, landing receipts and frozen migration records stay as they are.
- With `--docs`, Markdown links/images (including anchors, encoded paths and angle-bracket destinations containing spaces) and backticked repository-relative paths under that directory are repointed only when their resolved destination was converted or was a deleted generated ERD. Links resolve relative to their Markdown file, or from the repository root when they start with `/`; code spans resolve from the repository root. Path spelling, query, fragment and title are preserved. Generated ERD references become `<stem>.erd.mmd`, ready for step 6. Each changed file is reported. Both rewrites skip directories named `archived`, consecutive `plans/evidence/` directories (even without `--plans`), `<plans>/evidence/`, `docs/architecture/source/`, `gaps-archive.md` and `decisions-archive.md`; unrelated `.drawio` destinations stay unchanged. Documentation directories and scanned files must physically remain inside the repository; frozen exclusions use their canonical repository-relative paths, so symlink aliases cannot bypass them. Unsafe documentation paths abort before any writes. Without `--docs`, live-doc references are not rewritten.
- `.drawio` sources are deleted after a successful write; `--keep` retains them for inspection, but remove them before landing (doctor fails on `*.drawio` under the root).

Exit codes:

| Exit | Meaning | Action |
|---|---|---|
| 0 | Converted; diagram-check is clean | Continue |
| 1 | Nothing written | Fix the cause below and rerun |
| 2 | Converted; diagram-check findings remain | Fix the listed findings (e.g. stale `source` paths) as a separate, named item in the brief |

Exit 1 causes:

- **Ids Mermaid misreads:** keywords (`end`, `class`, `style`, …), ids whose part before the first `-` or `.` is one (`end-user`, `graph-db`), and ids containing `--`, `-.` or `.-`; listed as `<file>#<id>`. Renaming them is a human decision because plans and receipts cite ids; ask the owner, rename in the `.drawio` and every active citation, then rerun.
- **Equivalence gate:** for each file, the old projection of the `.drawio` and the new kit's projection of the produced `.mmd` must hold the same element blocks (element line plus its `row |` lines; order may differ). On a mismatch the converter prints a unified diff of the sorted blocks. Typical causes are elements outside any layer, multi-line table rows, or HTML labels; fix the source drawing (as a pre-migration correction named in the brief) and rerun. Never hand-edit the `.mmd` to pass the gate.
- **Conversion errors:** unreadable XML, an existing `.mmd` with the same name, values Mermaid cannot encode (backslashes, newlines in metadata), text Mermaid reads as a statement (`direction TB` and the like in a label or metadata value; reword it in the source drawing), or invalid ids.

## 5. Place the new kit

Render the new kit with the working manifest into separate scratch and place only kit-owned results, re-applying verified adaptations, exactly as the regular upgrade does.

## 6. Regenerate ERDs

When `diagrams.erd` is configured, run the new generator after the new kit files are placed:

```sh
bun tools/erd-generate.ts
```

It writes `<erd.output>/<stem>.erd.mmd`.

## 7. Contract README (project-owned)

`<root>/README.md` is project-owned. Do not overwrite it.

1. Diff the installed README against the old starter from step 2 to find the project's adaptations.
2. Take the new starter from the step 5 render.
3. Re-apply the adaptations that still apply.
4. Show the result and the dropped adaptations in the brief for owner approval.

## 8. Runtime config (project-owned)

Propose removing the `drawio` server from `.mcp.json` and `drawio` from `enabledMcpjsonServers` in `.claude/settings.json`, plus project text that describes the mount (for example a `docs/index.md` harness row naming `drawio`; `git grep -n drawio` outside archived records finds them). Nothing in the kit uses them any more. The owner approves in the brief; never edit them silently.

## 9. Adaptation record

In `docs/mosaic-migration/kit-adaptations.md`, mark drawio-specific rows (MCP mounts, `mcp__drawio__*` tools, XML/geometry rules, `--normalize`) as superseded by this upgrade. Re-apply the remaining rows from the baseline diff as usual. On its manifest line, record that baseline renders from this source revision on substitute `diagrams.mode: "mermaid"` for the archived `drawio`; never rewrite the frozen manifest.

## 10. Check and land

```sh
bun tools/diagram-check.ts
bun tools/erd-generate.ts --check   # only when diagrams.erd is configured
bun tools/doctor.ts
bun tools/checkup.ts
```

All must pass. Update `kit.commit`, then present the `/mosaic-kit` brief. It covers the converter report, the gate result, ERD regeneration, the README merge, the MCP proposal, superseded adaptation rows and paused plans. Land on `kit/<slug>` as a format-only change through the project's landing mode. Afterwards, deltas run between `.mmd` revisions; none is computed across the migration commit.
