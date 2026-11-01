# Plan: Mermaid replaces draw.io in mosaic, and installed projects migrate on upgrade (2026-10-31)

Background and evidence: [Viewing and reviewing draw.io diagrams](2026-10-31-drawio-review.md), sections "Mermaid instead of draw.io" and "Proposed process".

## Outcome

- Diagram sources are `.mmd` files. GitHub (Mermaid 12.2.0), Orca (11.17.2) and Linear render them natively; their source diffs are readable in any PR view.
- mosaic's layer model, element provenance, decision/intent rules, change kinds and plan declarations keep their meaning.
- A PR touching diagrams gets one review comment in the conversation: the changes in words plus before/after Mermaid drawings with changes coloured. It is plain text, so no images, attachments or upload tokens are involved.
- An installed project with `diagrams.mode: "drawio"` converts its diagrams on its next `/mosaic-kit` upgrade. Conversion is verified by identical projections before and after.

## Status (2026-11-01)

All three phases are built, verified and landed: [ShaharKatz/mosaic#3](https://github.com/ShaharKatz/mosaic/pull/3), rebase-merged on 2026-11-01 as `9fdbcb9` (branch `ShaharKatz/docs-drawio-local-and` kept).

| Phase | Built | Evidence |
|---|---|---|
| 1. Mermaid bundle | Subset parser and checks 1–10, delta, `erDiagram` generator, installer and doctor (`drawio` rejected with the upgrade message; a stale `.drawio` under the root fails doctor), contract, rule, skills, agents | `diagram-smoke` 185 cases, `erd-smoke` 48, `tooling-smoke`, `kit-parity`; sandbox diagrams render in Mermaid 12.2.0 and 11.17.2 |
| 2. Review comment | `tools/diagram-review.ts`, the `git-flow` posting bullet, an optional workflow in the contract README | `diagram-review-smoke` 14 cases; [drawio-pr-demo#2](https://github.com/ShaharKatz/drawio-pr-demo/pull/2): the workflow created the marked comment with `GITHUB_TOKEN`, edited that same comment after the next push, and the documented manual lookup + `PATCH` hit the same id (one comment total) |
| 3. Upgrade path | `install/drawio-to-mermaid.ts` and `.md`, the `/mosaic-kit` pointer | `drawio-migration-smoke` 8 cases and the dry runs below |

Dry runs, all on clones (originals untouched):

| Project | Result |
|---|---|
| airgap-analyst, airgap-analyst-ex5 (kit `4deeffe`, no diagrams yet) | 28 recorded adaptations preserved; 17 kit files placed, `docs/index.md` and `git-flow.md` by clean three-way merge; converter: nothing to convert; doctor 0/0/0, checkup PASS; the upgraded tree equals the new render except the 28 adaptations |
| `/tmp/mosaic-review` sandbox (`system.drawio` + generated ERD) | Gate passed (11 elements); generated ERD deleted and regenerated; diagram-check, `erd-generate --check`, doctor, checkup pass |

Found during verification and fixed beyond the spec:

- **Mermaid lexer hazards.** Probes through the 12.2.0 and 11.17.2 parsers (336 cases, now 0 accepted-but-broken) found that ids with a keyword before the first `-`/`.` (`end-user`, `graph-db`) or with `--`, `-.`, `.-` break parsing; `direction TB`-style text anywhere on a line makes Mermaid silently drop the node's label and data or the whole edge; `|""|` fails; ERD names `UK`/`PK`/`FK` (any case) and `@map` names with spaces or leading digits fail, as do `%` and direction text in ERD labels. The checker rejects them, the generator backtick-quotes names and entity-codes labels, and the converter lists such ids.
- **Comment size.** A 60-model schema produced an 80,520-character comment; GitHub's limit is 65,536. ERD drawings now show only the changed tables plus name-only neighbours (2,102 characters for that case), and drawings that still exceed the limit become a note, largest first.
- **Upgrade loop.** The frozen archived manifest keeps `drawio`, which the new installer rejects on the next upgrade. The procedure keys on runtime `.omp/mosaic.json`, and the adaptation record's manifest line records the `mermaid` substitution. The owner proposal also covers project text naming the mount (airgap's `docs/index.md` row).
- **Removed dead weight.** `--erd-output` (ERD output always lies inside the root); the old palette moved from the installed constants into the converter.
- **GitHub quirk.** In the demo repository, `pull_request` runs started only after its first push-triggered run.
- **Independent review (reviewer agent, second attempt after a rate limit).** Six findings, all fixed with regression cases: ERD drawings were focused per side, so an additions-only change showed the whole schema as Before (now one focus per file from both sides); the install skill and migration map sent fresh installs' draw.io files to the upgrade-only converter (now: preserve them as project documents or redraw); the converter did not escape `#` in edge and group labels; `--plans` missed column-0 `areas:` items and CRLF frontmatter; the manual comment lookup was not paginated; `<br />` and `<BR>` were not read as line breaks.

Rollout (the owner approved every item on 2026-11-01):

1. **mosaic:** landed as above.
2. **airgap-analyst:** upgraded through `/mosaic-kit` in [ShaharKatz/airgap-analyst#6](https://github.com/ShaharKatz/airgap-analyst/pull/6) (Linear SHA-10), rebase-merged as `305ca71` (branch `kit/upgrade-9fdbcb9` kept). It places the 17 changed kit files, sets `diagrams.mode: "mermaid"`, and makes the owner-approved project edits: `drawio` leaves `.mcp.json` and `enabledMcpjsonServers`, the `docs/index.md` row names only `linear`, and `kit-adaptations.md` updates its source and manifest lines and the `.claude/settings.json` row. Final review (the project's `gpt-reviewer`): APPROVE on `850b98b` with one procedural note, that the contract README replacement was not on the approved list (the installed README equalled the old starter). CI passed on the head and on `main`.
3. **airgap-analyst-ex5:** a second worktree of the same repository, on the analysis branch `example-5-new-vs-returning-dashboard`. `main` was merged into it locally (`5435495`, not pushed); only the 20 upgrade paths changed. It was not rebased because Tableau Desktop had the branch's workbook open.
4. **Linear** posting of the review comment stays optional (its Mermaid version is unverified). [drawio-pr-demo#2](https://github.com/ShaharKatz/drawio-pr-demo/pull/2) and its branches are kept.

## Verified facts this plan relies on

| Fact | Evidence |
|---|---|
| GitHub renders Mermaid 12.2.0; Orca bundles 11.17.2 | ` ```mermaid info ` in a gist; Orca's `infoDiagram` chunk |
| Layer classes on nodes, edge ids with classes, layer and review classes combined, `style` on ER entities | Rendered on GitHub (gist `dfdcf3fa`) and with 11.17.2 |
| mosaic ids with `-` and `.` work as node and edge ids, except a keyword before the first `-`/`.` and `--`, `-.`, `.-` (see Status) | Rendered and parsed with 12.2.0 and 11.17.2 |
| ER attribute types `String?` and `Decimal(14,6)` parse | Same |
| Orca shows `.mmd` files in a Mermaid viewer and Mermaid blocks in Markdown | `~/code/mermaid-demo` opened in Orca |
| Linear's editor renders ` ```mermaid ` blocks | Linear docs (Editor); version not known |

## Decisions (confirmed 2026-10-31: D4 = (b), D8, D9; the remaining defaults accepted with "do all phases")

| # | Decision | Default | Alternative |
|---|---|---|---|
| D1 | Replacement | `diagrams.mode: "mermaid"` replaces `"drawio"`. The installer rejects `"drawio"` with a pointer to the upgrade procedure. No dual mode. | Keep drawio as a legacy mode (two toolchains to maintain). |
| D2 | File form | One standalone `.mmd` per diagram: `system.mmd`, `<component-slug>.mmd`, generated `<stem>.erd.mmd`. | Mermaid blocks inside Markdown files. |
| D3 | Layers | Layer is a class: none = as-built, `intended`, `retiring`. Every edge carries an id (`src id@--> tgt`) so it can take a layer class. | — |
| D4 | Element metadata | (b): extra keys in Mermaid's element data block `<id>@{ … }`, which renders on GitHub (12.2.0) and with Orca's 11.17.2. Generated ER files, whose grammar has no data blocks, carry the same pairs in `%% @<id> …` lines (see "Metadata options" below and the [implementation spec](2026-10-31-mermaid-contract-spec.md)). | (a) comment lines; (c) a sidecar file per diagram. |
| D5 | Grammar | A strict Mermaid subset that the tools parse and validate; anything else fails, as malformed XML does today. | Accept full Mermaid (the tools could not reliably classify changes). |
| D6 | Styles | Canonical `classDef` lines owned by `tools/constants/diagrams.ts`. Layers: intended = faded + italic, retiring = faded + grey; no dashes, because dashes mean async edges. Categories (service, store, external, agent, messaging, legend) set fill plus dark text so they read in light and dark themes. Edge kinds are classes: `async` dashed, `observe` dotted; sync is the default solid arrow. | — |
| D7 | Ids | Keep `ID_PATTERN`; additionally reject ids Mermaid misreads: keywords (`end`, `graph`, `flowchart`, `subgraph`, `class`, `classDef`, `style`, `linkStyle`, `click`, `direction`, `default`, `interpolate`, …), a keyword before the first `-` or `.` (`end-user`), and `--`, `-.`, `.-` (probed against Mermaid 12.2.0 and 11.17.2). | — |
| D8 | Review comment (confirmed) | `tools/diagram-review.ts` prints the comment Markdown, starting with a `<!-- mosaic:diagram-review -->` marker. In pull-request landing mode, whoever opens or updates the PR creates the comment once and afterwards edits the comment carrying the marker. (`gh pr comment --edit-last` would edit whatever that account commented last.) An optional CI workflow is documented; Actions' `GITHUB_TOKEN` suffices because nothing is uploaded. | CI only. |
| D9 | Converter (confirmed) | Source-side only (`install/drawio-to-mermaid.ts` in the mosaic checkout), run during `/mosaic-kit` upgrades. It carries the old XML parser; it is never installed into projects. | Ship it in the kit (dead code after every project migrates). |
| D10 | draw.io MCP | Removed: `DRAWIO_PACKAGE`, `DRAWIO_MOUNT`, doctor's mount check, the keeper's `mcp__drawio__*` tools. The keeper edits `.mmd` text. | — |

### Metadata options (D4)

Metadata is what lets mosaic check a diagram against the repository rather than trust the picture. `component` names the owning component; `source` cites the code that proves an as-built element exists; `decision` and `intent` tie intended and retiring elements to a recorded decision and an approved plan or tracker item; `kind=legend` marks presentation-only elements. diagram-check validates all of them, and diagram-delta counts a metadata edit as a semantic change and requires citations on additions and retirements. Mermaid draws none of it, so each form below is invisible in the rendered diagram.

| | (a) Comment lines | (b) Element data block | (c) Sidecar file |
|---|---|---|---|
| Example | `%% @api component=apps/api source=apps/api/src/server.ts` above `api("Orders API")` | `api@{ shape: rounded, label: "Orders API", component: "apps/api", source: "apps/api/src/server.ts" }` | `system.meta.yaml` with `api: { component: apps/api, source: apps/api/src/server.ts }` |
| Renderer guarantee | Documented: Mermaid ignores `%%` lines | Undocumented: Mermaid 12.2.0 and 11.17.2 ignore unknown keys today; a stricter future release would break rendering, and GitHub upgrades Mermaid on its own schedule | Not read by Mermaid at all |
| Edits and review | Element and its metadata change together in one diff | Same, and a node is one line | Two files per change; a new element needs both |
| Editors that rebuild code from a visual model (Mermaid Chart Visual Editor) | May drop comments (untested); diagram-check then fails | May drop unknown keys (untested); diagram-check then fails | Unaffected |
| Text editors, agents, Orca Source | Keep it | Keep it | Keep it |

With (a) or (b), a dropped field fails diagram-check rather than disappearing silently, and git history holds the previous values.

## The Mermaid diagram contract (replaces `docs/architecture/diagrams/README.md`)

The exact grammar, parsed model, constants, checks, review output and converter rules are in the [implementation spec](2026-10-31-mermaid-contract-spec.md).

```text
flowchart LR
  api@{ shape: rounded, label: "Orders API", component: "apps/api", source: "apps/api/src/server.ts" }
  db@{ shape: cyl, label: "Postgres", component: "platform", source: "apps/api/prisma/schema.prisma" }
  search@{ shape: rounded, label: "Search service", component: "apps/api", decision: "D1", intent: "plan:0001" }
  api api-db@-->|"Prisma"| db
  api-db@{ component: "apps/api", source: "apps/api/src/db.ts" }
  api api-search@-->|"index orders"| search
  api-search@{ component: "apps/api", decision: "D1", intent: "plan:0001" }
  class search,api-search intended
  class api,search service
  class db store
  (canonical classDef lines)
```

- **Header:** first line `flowchart LR` or `flowchart TB`; one diagram per file.
- **Statements:** one per line, in sections:
  - nodes and groups (`<id>@{ shape, label, metadata }`; `subgraph <id>["<label>"]` … `end`, followed by the group's data line);
  - edges (`<src> <id>@-->|"<label>"| <tgt>`, each followed by its `<id>@{ metadata }` line);
  - `class <ids> <class>` lines;
  - the canonical `classDef` block.
- **Metadata:** the same keys and rules as today (`component`, `source`, `decision`, `intent`, `kind: "legend"`), as quoted values in the data block. Shapes are limited to `rounded`, `rect` and `cyl`.
- **Tables:** a node with `table: "true"` takes the label lines after the first (`<br/>`-separated) as rows. This keeps the `row |` projection for legend tables and lets converted tables project identically.
- **Legends:** marked `kind: "legend"`, optionally grouped in a subgraph; legend isolation keeps its meaning through subgraph membership.
- **Projection output is unchanged** (`<layer> | <id> | <label> | <component> | source=…`, `row |`, `edge |`). Plans, librarian packets and tracker receipts are unaffected, and the migration gate can compare projections across formats.
- **Gone:** geometry, pages, overlap, font-size and compression rules, and `--normalize`. Mermaid lays diagrams out itself; lanes are subgraphs.
- **ERDs:** `erDiagram`. The first line is the marker comment `%% generated: mosaic-prisma-erd from <schema>`.
  - Columns are `type name PK|FK|UK "…"`. `IDX`, `U` on composites, defaults and `@db` attributes go into the comment.
  - `@@` model attributes become `%%` lines inside the entity.
  - Enums are entities with `enum <VALUE>` rows.
  - Relations use Mermaid cardinalities (`}o--||`, `|o--||`, `}o--o{`) with labels `fields → references onDelete: …`.
- **Editors:**
  - Orca's `.mmd` viewer and Source toggle.
  - Mermaid Live Editor.
  - Mermaid Chart Visual Editor: it rewrites formatting, so run diagram-check afterwards.
  - The keeper agent editing text.

## Phase 1: port the kit bundle (behaviour parity)

| Area | Files | Change |
|---|---|---|
| Constants | `kit/tools/constants/diagrams.ts` | Mode literal `mermaid`; `.mmd` extension; layer/category/edge-kind class names and the canonical `classDef` block; keyword list; renumbered `CHECK_REASONS`.<br>Remove `DRAWIO_PACKAGE`, `DRAWIO_MOUNT`, `PAGE_WIDTH_LIMIT`, `MAX_EXPANDED_PAGE_BYTES`, `XML_*`, `FONT_SIZE_FLOOR`, `ROUTING_KEYS`, unused `PALETTE`.<br>Keep `safeRoot`, `safeDiagramsRoot`, `diagramPathKey`: the installer uses them for every destination. |
| Parser + validator | `kit/tools/diagram-check.ts` | Replace the XML reader and `Drawing` with a subset parser exposing the same surface: `elements`, `byId`, `layer()`, `rows()`, `ancestors()`, metadata and structural attributes.<br>Checks: grammar and single diagram; one layer class per element; ids/metadata/components/keywords; source existence; decision map; intent syntax; canonical `classDef` block; endpoints and layer visibility; system coverage; legend isolation.<br>Discovery `**/*.mmd`. |
| Delta | `kit/tools/diagram-delta.ts` | Keep transitions, `rowDiff`, declaration parsing, compare and candidates. `semantic()` compares metadata, label, endpoints, rows and non-layer classes. The ERD exemption reads the `%% generated:` marker. |
| ERD | `kit/tools/erd-generate.ts`, `kit/tools/constants/erd.ts` | Keep the Prisma parser and file handling (`--check`, `--file`, orphan cleanup, collision refusal). Replace mxGraph rendering with deterministic `erDiagram` output. Suffix `.erd.mmd`; marker as a comment. |
| Contract and rule | `kit/docs/architecture/diagrams/README.md`, `kit/docs/process/diagrams.md` | Rewrite the contract as above. In the rule, "raw XML" becomes "source", MCP mentions go, the ERD block gets the new suffix. Avoid `{{…}}` (hexagon syntax) in kit Markdown: the installer treats it as a placeholder. |
| Skills and agents (both runtimes) | `.omp/.claude skills/diagrams/SKILL.md`, `agents/diagram-keeper.md` | Edit `.mmd` directly, then run check/project/delta. Drop MCP preflight and the `mcp__drawio__*` tool list. Respect budgets (skill 120, agent 60 lines). |
| Callers | `mosaic-execute`, `mosaic-plan` twins, `TEMPLATE.md`, `records.md`, `tracker.md`, `dispatch.md`, `docs/architecture/README.md` | Rename the block token `DIAGRAMS_DRAWIO` to `DIAGRAMS_MERMAID`. Content is format-neutral. |
| Installer | `kit/install.ts` | Mode literal; reject `drawio` with an upgrade hint; token rename; drop `DRAWIO_PACKAGE` rendering; bundle list adds `diagram-review.ts`; runtime metadata `mode: "mermaid"`. |
| Doctor | `kit/tools/doctor.ts` | Mode literal; delete the `.mcp.json` drawio mount check. New FAIL: `*.drawio` files under the diagrams root in mermaid mode, with an upgrade hint. Keep budgets, twins, symlink and placeholder checks. |
| Docs | `kit/README.md`, `kit/docs/index.md`, `kit/docs/kit/maintenance.md`, `install/{README,placeholders,migration-map}.md`, root `mosaic-install` skill twins | Wording, mode, token names, ERD suffix. `maintenance.md` is at its 120-line budget: edits must not add lines. |
| Fixtures | `tests/loops/fixtures/**` | Regenerate with `bun tests/loops/build-fixture.ts`; check with `bun tests/loops/kit-parity.ts`. |

## Phase 2: PR review comment and Linear

- **`tools/diagram-review.ts <base> <head>`:** prints the Markdown comment.
  - The change list in words, with before → after details for `changes` and labels/endpoints for additions.
  - Position moves no longer exist (no geometry).
  - Per changed diagram, before and after Mermaid with review classes: green new, purple planned, amber changed, red retiring/removed. ERDs get entity outlines and column markers in attribute comments.
- **`rule://git-flow`, pull-request mode:** when the PR changes the diagrams root, post the comment after the first push and refresh the marked comment after later pushes (`gh pr comment <pr> --body-file <file>` to create, `gh api -X PATCH repos/<owner>/<repo>/issues/comments/<id> -F body=@<file>` to update). Document an optional workflow (checkout with history, `bun tools/diagram-review.ts`, then create or update the marked comment). As built, the workflow posts through `actions/github-script` with its default `GITHUB_TOKEN`, because kit Markdown cannot contain the `${{ … }}` expression a `gh` step would need for the token.
- **Linear:** with tracker mode `mcp` on Linear, post the same Markdown on the linked issue; Linear renders Mermaid. Separately, verify Linear's Mermaid version supports edge ids before relying on layer classes there.

## Phase 3: upgrading installed projects (`/mosaic-kit`)

This hooks into the baseline-diff upgrade procedure (`kit/docs/kit/maintenance.md`, "Manifest, placeholders, and upgrades"), the way the Local stack backfill does. The detailed steps live in the source checkout (`install/drawio-to-mermaid.md`); the installed `/mosaic-kit` skill twins point to them, so installed budgets do not grow.

1. **Preflight.** The migration applies only when runtime `.omp/mosaic.json` says `diagrams.mode: "drawio"`; afterwards only the frozen archived manifest keeps `drawio`, and later upgrades render it with `mermaid` substituted (step 9). Active plans whose diagram task has not landed should land or pause first, because their declarations and base snapshot are `.drawio`. Name them in the brief.
2. **Old baseline.** Render the previous kit revision into scratch, as today, and keep its `tools/` for the gate.
3. **Working manifest.** Set `diagrams.mode: "mermaid"`; root, components and `erd` stay.
4. **Convert.** `bun <mosaic>/install/drawio-to-mermaid.ts --root <diagrams root>` turns each hand-authored `.drawio` into a `.mmd` with the same basename. It preserves:
   - ids, labels (newlines become `<br/>`), layers as classes, and metadata as data-block pairs;
   - edge kinds from dash style, categories from fill colour, and legends as a subgraph;
   - tables as table nodes.

   Ids Mermaid misreads (keywords, `end-user`-style keyword prefixes, `--`/`-.`/`.-`) stop the run with a list; renaming them is a human decision because plans cite ids. Generated `.erd.drawio` files carrying the adapter marker are deleted and regenerated with the new `erd-generate.ts`, not converted.
5. **Equivalence gate.** For every converted file, the old tool's projection of the `.drawio` and the new tool's projection of the `.mmd` must hold the same element blocks (element line plus its `row |` lines; order may differ). Any difference stops the upgrade. Then `diagram-check`, `erd-generate --check`, doctor and checkup must pass.
6. **Contract README (project-owned).** Diff the installed `README.md` against the old starter to find project adaptations, render the new starter, and re-apply adaptations that still apply. Show the result in the brief for approval; never overwrite silently.
7. **Active references.** In open plans, rewrite `diagram:<file>.drawio#<id>` areas and `diagrams:` lists to `.mmd`. Archived plans, landing receipts and frozen migration records stay as they are.
8. **Runtime config (project-owned).** Propose removing the `drawio` server from `.mcp.json` and from `enabledMcpjsonServers` in `.claude/settings.json`, plus project text naming the mount; the owner approves in the brief.
9. **Adaptation record.** Mark drawio-specific rows in `kit-adaptations.md` as superseded and record on its manifest line that baseline renders substitute `mermaid` for the archived `drawio`; re-apply the rest from the baseline diff as usual.
10. **Land.** Use a `kit/<slug>` branch with a format-only change, landed through the project's usual landing mode. Deltas resume between `.mmd` revisions afterwards; none is computed across the migration commit.

Projects with `diagrams.mode` absent or `none` need only the regular upgrade.

## Tests and verification

- **`tests/kit/diagram-smoke.ts`:** new fixture builder for the subset. Keep every format-neutral group (transitions, compare, candidates, frontmatter, containment, intent modes, decision maps, CLI exits). Replace the XML, geometry and font groups with grammar, keyword, canonical-classDef and subgraph-legend groups.
- **`tests/kit/erd-smoke.ts`:** parser cases unchanged; render assertions rewritten for `erDiagram`. Keep the drift, selection, orphan, collision and exemption cases.
- **`tests/kit/tooling-smoke.ts`:** mode literal; drop the mount probes; add the stale `.drawio` doctor probe; keep the root, alias and collision matrix.
- **New `tests/kit/drawio-migration-smoke.ts` (source-side):** convert fixtures covering every layer, transition-relevant metadata, edge kind, category, legend and table, then assert the projection equality gate.
- **Rendering:** render every `.mmd` fixture once with Mermaid 12.2.0 and 11.17.2 in a headless browser before landing. This is a manual pre-release check; it adds no npm dependency to the kit.

## Rollout

1. Build phases 1 and 2 in the mosaic source and land them as one kit change; phase 3's converter and procedure land with it.
2. Dry-run the upgrade on a copy of `~/code/airgap-analyst`. It has `diagrams.mode: "drawio"`, kit `4deeffe`, a drawio and a Linear MCP server, and no `.drawio` files yet. That exercises the manifest switch, contract README, MCP removal and checks; a sandbox with diagrams (as in `/tmp/mosaic-review`) exercises conversion and the gate.
3. Upgrade `airgap-analyst` and `airgap-analyst-ex5` through `/mosaic-kit`.

## Risks

- **Layout.** Hand layout is gone, and GitHub (ELK, neo look) and Orca (dagre) lay out the same file differently.
- **Linear.** Its Mermaid version is unknown; layer classes on edges need a recent one.
- **Visual editors** may drop `%%` metadata; diagram-check catches it (D4), and a sidecar is the fallback if this proves common.
- **In-flight plans** across the migration commit need landing or re-basing first (Phase 3, step 1).
- **Budgets.** Kit Markdown budgets (`maintenance.md` at 120/120) constrain wording changes.
