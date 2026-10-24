# Architecture diagrams

Scope: topology under `{{DIAGRAMS_ROOT}}/`. Review text projections and deltas, not pixels or XML. Commands run from the installed repository root. `tools/diagram-check.ts`, `tools/diagram-delta.ts`, and `tools/constants/diagrams.ts` enforce this contract.

## Files and views

Use `system.drawio` for one element per configured component and cross-component edges; use `<component-slug>.drawio` for detail. Draw named runtime integrations with other components, cloud services or external APIs reached through contracts/credentials; omit passive asset downloads, tests and unused factories. Components are manifest member paths (multi-repo) or component paths (monorepo), recorded in `.omp/mosaic.json`'s `diagrams.components`; `platform` and `external` are additional valid bindings.

Each file is one `<mxfile compressed="false">`, exactly one `<diagram>` and exactly one uncompressed `<mxGraphModel>` child, never base64 text. `bun tools/diagram-check.ts --normalize <file>` decodes base64 → raw inflate → URL-decode and writes indented XML. This explicit operation is the tools' only write; projections must remain identical. In draw.io desktop turn File → Properties → Compressed off.

After root cell `0` (and optional empty structural default cell `1`), define layer cells with ids `as-built`, `intended`, `retiring`, in that order, each `parent="0"`. Every other parent chain terminates through one layer at `0`. **As-built view** is `as-built` + `retiring`; **intended view** is `as-built` + `intended`.

## Elements and provenance

Every vertex or edge not below a `shape=table` cell is an element: one `<object>` with a stable logical id matching `^[a-z0-9][a-z0-9._-]*$`, unique within its file, wrapping exactly one `<mxCell>`. The inner cell carries structural `vertex`/`edge`, `parent`, `style`, `source`, `target` and geometry, never `id` or `value`. Set logical ids yourself; generated draw.io ids may fail validation. References are `<file>#<id>`, with file relative to this diagrams home.

| Metadata | Requirement |
|---|---|
| `label` | Every element, including legends. |
| `component` | An installed component binding, `platform`, or `external`; required except legends. |
| `source` | Required on as-built and retiring. Comma-separated existing repo-relative paths, optional trailing `:L<n>` per token. Absolute paths, `..` and symlink escapes fail. Cite the proving operation, not a comment, import or signature; validation proves containment/existence only, so reviewers must open the source. |
| `decision` | Required on intended/retiring, optional on as-built. Whenever present, a global `D<n>` row in `docs/architecture/README.md`'s decision map or, where a project keeps one, the frozen `docs/architecture/decisions-archive.md`; a number listed in both fails. |
| `intent` | Required on intended/retiring, optional on as-built. With tracking `none`, `plan:NNNN` names an approved plan; otherwise `tracker://<key>` names intent resolved per the tracker rule. Existence/status/approval is audited by humans, not queried by CI. |
| `kind="legend"` | Presentation only; exempt from component/provenance, transitions and the decision predicate, but projected and counted. |

Below a table, only plain structural vertex cells with `shape=tableRow` or `shape=partialRectangle` are allowed. They are exempt from element metadata, overlap and page checks, and projected as the owning table's rows. Their font sizes are still checked. Legend edges connect legends only (including legend table rows); architecture edges cannot touch legends or their descendants. Architecture elements cannot have legend ancestors.

```xml
<object id="service-api" label="API" component="platform" source="tools">
  <mxCell vertex="1" parent="as-built" style="rounded=1;fillColor=#dae8fc;strokeColor=#6c8ebf;">
    <mxGeometry x="40" y="40" width="200" height="60" as="geometry"/>
  </mxCell>
</object>
```

An as-built edge has two as-built endpoints; intended endpoints are as-built or intended; retiring endpoints are as-built or retiring. An edge must be visible with both endpoints in every view where it appears. Move/redeclare edges when moving vertices.

## Styles and geometry

As-built has no `opacity` key; intended has `opacity=45;fontStyle=2`; retiring has `opacity=45;fillColor=#f5f5f5;strokeColor=#666666`. Layer styles override category colors. Category fill/stroke: external `#d5e8d4/#82b366`, service `#dae8fc/#6c8ebf`, agent/executor `#e1d5e7/#9673a6`, store `#ffe6cc/#d79b00`, messaging `#fff2cc/#d6b656`, legend `#f5f5f5/#666666`.

Keep readable lanes or cluster stores/external systems beside consumers. Use orthogonal edges; solid sync/owned, dashed async/autonomous, dotted observe/scrape. Dash is not a layer marker. Explicit font sizes must be ≥11, page width ≤1600. Vertices stay within page bounds using absolute boxes (geometry plus all ancestor offsets); same-layer element vertices cannot overlap, excluding ancestor/descendant pairs. Edges and structural table rows are exempt from geometry checks.

## Projection, delta and comparison

`bun tools/diagram-delta.ts project <file>` emits document-order lines:

```text
<layer> | <id> | <label> | <component> | source=… | decision=… | intent=…
  row | <row text>
edge | <layer> | <id> | <from> → <to> | <label>
```

Only present provenance attributes appear; legends include `kind=legend`. `delta <base> <head> [paths]` reads git revisions; `delta <base> --worktree [paths]` includes untracked files without changing HEAD or the index.

| Before → after | Kind |
|---|---|
| absent → intended | `adds` |
| intended → as-built | `realizes` |
| absent → as-built | `builds` |
| as-built → retiring | `retires` |
| retiring → absent, or as-built → absent | `removes` |
| intended → absent | `withdraws` |
| surviving element, semantic edit | `changes` |

Reject as-built → intended, retiring → intended and intended → retiring. Creation/deletion reports only its transition. Surviving elements can report both a transition and `changes`. Mechanical transition edits are direct layer parent changes, style keys belonging to the two layers, newly added `source` on realizes, and added/replaced decision/intent on retires. Labels, components, endpoints, rows, other metadata/style keys and bare style tokens are semantic. Position/size and edge routing/port styles (`exitX/Y/Dx/Dy/Perimeter`, `entryX/Y/Dx/Dy/Perimeter`) are layout only. Legends appear separately, outside compare; retagging architecture to/from legend is a real removal/addition under snapshot-local classification.

### Decision predicate

New decisions and intent are required on the cell for `adds`, `builds`, `retires`; in the declaration for as-built → absent, intended → absent, and any semantic edit whose **before** layer is intended (including realizes plus changes). Pure realizes, retiring removal, or changes tracking code on as-built/retiring require no new decision. Record global decisions and intent before drawing; drafts use `D-NNNN-n` until the records task assigns the global number.

`bun tools/diagram-delta.ts compare <plan> <base> (<head> | --worktree)` strictly parses one Architecture delta section with all seven kinds and `diagrams:`. Entries are `<file>#<id>`, optionally `(D<n>, plan:NNNN)` or `(D<n>, tracker://<key>)`; use `none` for empty lines. Diagrams lists relative files or trailing-slash directory prefixes. Reject observed-but-undeclared, declared-but-unobserved, missing/invalid required citations, unlisted changed files, illegal transitions and malformed sections. Core has **no generated-folder exemption**, including folders named `erd/`.

`delta <base> <head> --candidates --plan <plan>` writes only docimpact-shaped JSON to stdout (`candidates: [{doc,class:"diagram",why}], cannotEvaluate: []`); the delta goes to stderr. Candidates include semantic/legend changes and unchanged diagrams with components matching plan areas.
Plan `areas:` accepts single-line inline sequences and block list items. Quote inline paths containing commas; commas inside complete quoted items are not separators. Doubled single quotes and backslash-escaped double quotes/backslashes are decoded; other backslash sequences remain literal. Malformed quoted items fail rather than silently dropping diagram candidates; multiline flow sequences are unsupported.

## Validation and editing

`bun tools/diagram-check.ts [files]` defaults to this home. Exit 0 prints file/element counts; exit 1 names failures: (1) XML/page/compression; (2) layers/chains; (3) ids/wrappers/metadata/components; (4) source containment/existence; (5) mapped decisions; (6) intent syntax for tracking mode; (7) layer style; (8) endpoints/visibility; (9) overlap; (10) page bounds; (11) font sizes; (12) when system.drawio exists, non-legend as-built/retiring coverage for every configured component; (13) legend isolation.

Topology edits use the diagrams skill and diagram-keeper with the mounted drawio MCP. Validation, projections and comparisons work offline. The contract is a project-owned starter; installed tool/rule/skill baselines stay kit-owned. Core does not ship a schema generator.
