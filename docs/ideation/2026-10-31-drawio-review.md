# Viewing and reviewing draw.io diagrams in Orca and git (2026-10-31)

Question: can we see draw.io diagrams rendered in the IDE (Orca) and on GitHub, and understand what a PR changed — in particular mosaic's architecture (`system.drawio`, component files) and generated Prisma ERDs (`*.erd.drawio`)?

Versions: Orca 1.4.239, draw.io desktop 32.6.1 (unpacked CLI at `/tmp/drawio-cli`, not installed), git 2.56.

## Answer

| Need | `.drawio.svg` / `.drawio.png` | mosaic `.drawio` (as shipped) |
|---|---|---|
| See it in Orca | yes: rendered image; many at once via a Markdown gallery | no: XML in the editor |
| See it on GitHub | yes: rendered | no: XML source |
| See what a PR changed, in Orca | PNG: before/after image panes; SVG: useless one-line text diff | raw XML diff |
| See what a PR changed, on GitHub | visual image diff | raw XML diff |
| Understand *what* changed | only by spotting differences in pictures | readable only through mosaic's `project`/`delta`, which are CLI-only |

Viewing is solved for exported formats, not for mosaic's `.drawio`. Understanding changes is not solved anywhere except the terminal: mosaic's text projection is the clearest review form we found, and nothing puts it in front of a reviewer in Orca or a GitHub PR yet.

## Experiment 1 — format demo (`/tmp/drawio-orca-demo`, Orca project `drawio-orca-demo`)

One diagram saved as `.drawio`, `.drawio.svg` and `.drawio.png`, plus a Mermaid copy in the README. The commit holds v1; the working tree holds v2 (rename, relabel, one added box). Checked on screen through Orca computer use:

- README rich view renders the SVG, the PNG and the Mermaid block (Mermaid renders under its source).
- Opening `.drawio.svg` shows Orca's image viewer.
- SVG diff: Monaco text diff of 4 lines; the change is buried inside line 4 (the whole SVG, 56,450 → 77,027 characters). Source Control counts it `+1 −1`.
- PNG diff: "Original" and "Modified" image panes (stacked, or side by side in split view). Orca's docs promise swipe and onion skin; build 1.4.239 has neither. Source Control shows no line counts.
- Orca labels the diffs itself: PNG `binary`, SVG and `.drawio` `text` (`orca file diff --json`). Binary detection is a NUL byte in the first 8 KiB (`src/shared/binary-buffer.ts`); only binary files get the image diff, so SVG never does.
- Open in → draw.io works: Settings → General → Open In Apps → Custom app, command `open -a <path to draw.io.app>`; Orca appends the file path. The per-file menu is only on Source Control rows (right-click a changed file); the file explorer offers Open in for the whole worktree only.
- Editing in draw.io and saving keeps the file a valid `.drawio.svg`; the diff is the moved shape plus the viewport attributes `dx`/`dy`.

Findings worth keeping:

- draw.io leaves the pre-save version as `.$<name>.bkp` next to the file, even after quitting. Ignore `.$*.bkp`.
- SVGs saved from the draw.io app are about 4× smaller than CLI exports (17 KB vs 77 KB): the CLI embeds a PNG fallback image for every label.
- draw.io SVG exports follow the viewer's theme by default (dark boxes in Orca's dark theme); `--theme light` pins them. PNGs stay light.
- Non-browser SVG renderers draw them badly (black boxes, "Text is not SVG") because labels use `<foreignObject>` and CSS `light-dark()`. Browsers, Orca and GitHub are fine.
- A git `textconv` driver (`.gitattributes` + `git config diff.<name>.textconv`) only affects `git diff`, `git log -p` and `git show`. Orca reads blobs with `git show <rev>:<path>`, which skips textconv; GitHub cannot run it.
- GitHub has visual image diffs (2-up, swipe, onion skin) for PNG and SVG; not exercised in this experiment.

## Experiment 2 — mosaic diagrams (`/tmp/mosaic-review`)

Kit installed into a monorepo sandbox (components `apps/web`, `apps/api`, Prisma ERD adapter). v1 → v2 is one PR-sized commit:

- architecture: Redis cache + `api → redis` edge (`builds`), intended search service + edge citing `D1` (`adds`), the `web → api` edge relabelled, Stripe moved (layout only);
- schema: new `Coupon` model, `Order.status` enum and `Order.couponId`, `Product.price Decimal` → `priceCents Int`; ERD regenerated with `bun tools/erd-generate.ts`.

What each surface shows for that PR:

| Surface | Result |
|---|---|
| Orca / GitHub file diff | Raw XML. ERD `+73 −10` lines, 27 of them geometry-only; column text sits at the end of long `value` attributes. `system.drawio` `+22 −2`. |
| `bun tools/diagram-delta.ts project <file>` | Clear inventory: one line per element (`layer \| id \| label \| component \| source=…`), table columns as `row \|` lines, edges as `from → to \| label`. |
| `bun tools/diagram-delta.ts delta <base> <head>` | Transitions per element and column-level row diffs for tables. Gaps: `changes: system.drawio#web-api` does not say what changed (the label); `builds`/`adds` print ids only, no labels or endpoints. Layout-only moves are correctly omitted. |
| Projection as git textconv | Best result: a unified diff of the projections shows every relabel, new table, column, enum value, edge and layer, and hides layout moves. |
| Rendered ERD (draw.io export) | Tables are readable, but relation lines and their labels run through table rows, and the grid is alphabetical: adding `Coupon` moved every table (Order x 26 → 402, OrderItem 402 → 778, Product 778 → 1154, User to the next row), so any picture diff flags everything. |

The projection diff for this PR (`git diff HEAD~1 HEAD` in the sandbox):

```diff
 as-built | model-order | Order (Order) | apps/api | source=apps/api/prisma/schema.prisma
+  row | couponId : String? FK
   row | createdAt : DateTime @default(now())
   row | id : String PK @default(cuid())
+  row | status : OrderStatus @default(PENDING)
   row | userId : String FK
@@
-  row | price : Decimal @db.Decimal(10, 2)
+  row | priceCents : Int
@@
-edge | as-built | web-api | web → api | HTTPS /api
+as-built | redis | Redis cache | platform | source=apps/api/src/cache.ts
+intended | search | Search service | apps/api | decision=D1 | intent=plan:0001
+edge | as-built | web-api | web → api | HTTPS /api + JWT
+edge | as-built | api-redis | api → redis | cache-aside
+edge | intended | api-search | api → search | index orders
```

`diagram-delta.ts project` cannot be the textconv command directly: it only reads files inside the diagrams home, and git hands textconv temp files. The sandbox uses a local wrapper (`.git/diagram-textconv.ts`, wired through `.git/info/attributes` and `git config diff.drawio.textconv`):

```ts
import { readFileSync } from "node:fs";
import { Drawing } from "../tools/diagram-check.ts";
import { project } from "../tools/diagram-delta.ts";
console.log(project(new Drawing(readFileSync(Bun.argv[2]!, "utf8"))).join("\n"));
```

## Options to close the gap (none implemented)

1. **Projection textconv in the kit.** Ship the wrapper as a kit tool plus `*.drawio diff=drawio`; each clone runs one `git config`. Semantic `git diff`/`git log -p` locally; Orca's diff view and GitHub stay XML.
2. **More detail from `delta`.** Print before → after for `changes` (label, endpoints, metadata) and the label/endpoints for `adds`/`builds`. Small change; improves plan close-out and librarian packets too.
3. **Committed review sidecars, drift-checked.** Generate `<name>.drawio.md` beside each diagram with the projection, optionally plus a Mermaid rendering of it; `diagram-check` fails when stale, as `erd-generate --check` does for ERDs. Orca's Source Control and GitHub PR diffs then show the semantic change, and Mermaid gives a picture in both without a draw.io binary. Cost: generated files in every diagram change.
4. **Rendered previews.** An `.svg`/`.png` per diagram needs draw.io desktop (Electron) or a headless browser running draw.io's viewer library (see the spike below) wherever it is generated, including CI; `rlespinasse/drawio-export-action` (MIT) already runs draw.io desktop in Docker for GitHub Actions. GitHub renders PNG and SVG files and diffs them as images (2-up, swipe, onion skin), and renders `.mmd`/`.mermaid` files and Mermaid blocks, but shows `.drawio` as XML ([GitHub docs](https://docs.github.com/en/repositories/working-with-files/using-files/working-with-non-code-files)). Switching the source format to `.drawio.svg` instead would leave the picture stale whenever an agent or the MCP edits the embedded XML without re-exporting, and the tools would need to read the embedded model.
5. **PR comment from CI** with the delta and projection diff: GitHub only, nothing in Orca's diff view.

## Building a plugin or app

Every host needs the same engine: mosaic's `delta()` for what changed, attribute-level before → after for `changes`, and a renderer that marks changed elements by id. Marking by id rather than comparing pictures keeps the ERD's reflowing layout irrelevant.

Spike (`/tmp/drawio-spike/build.ts` → `review.html`, 5 MB, self-contained): draw.io's viewer library (`viewer-static.min.js`, 4.9 MB, Apache-2.0) inlined into one page with Orca's plugin-frame Content-Security-Policy (`default-src 'none'; connect-src 'none'; script-src 'unsafe-inline'`, no eval). Headless Chromium rendered both sandbox diagrams with no console errors: added tables and elements outlined green, changed ones amber, added columns filled green, and a side list with details such as `label: HTTPS /api → HTTPS /api + JWT`. The viewer toolbar's layer toggle switches between the as-built and intended views.

| Host | Can do | Cannot do |
|---|---|---|
| Orca plugin, `customEditors` (Orca ≥ 1.4.245, released 2026-10-30) | Open `.drawio` rendered in the editor tab, beside Source and Changes, with pages, zoom and the layer toggle (built, below) | Frames receive only the document text: no path, no git, no network. Custom editors are not used by Orca's diff view. So viewing yes, PR diffs no. |
| Orca plugin, `trusted-worker` | Full Node (git, files), command-palette commands, typing into terminals | No UI of its own and no host method to open a file or tab. Plugin storage is worker-only, so it cannot hand data to a panel or editor frame. |
| Orca, no plugin | Open a generated `review.html` in Orca's HTML preview or browser tab (documented; not tried) | Someone has to generate and open it |
| Orca upstream (MIT, near-daily releases) | Either let custom editors render diffs (pass original and modified documents), giving the spike's view inside Source Control; or honour git `textconv` in the diff view, giving the projection diff for any repo with a driver | Needs the maintainers to accept it |
| GitHub Action | Sticky PR comment with the change list and a Mermaid drawing of the changed elements (GitHub renders Mermaid in comments); HTML report as an artifact; PNGs from headless Chromium | Artifacts can't be embedded in a comment, so PNGs need hosting the comment can reach |
| Browser extension on GitHub PR pages | Replace a `.drawio` XML diff with the highlighted render and change list, using the reviewer's session, so private repos work | Every reviewer installs it; GitHub page changes break it |

Suggested order: the engine as a kit tool (Markdown change list + self-contained HTML), then the GitHub Action comment, then a `.drawio` custom-editor plugin for viewing in Orca, and a proposal to Orca for custom editors in the diff view. Until Orca has that, the HTML report is the in-Orca visual diff.

### Built: draw.io viewer plugin (`~/code/orca-drawio-viewer`)

A `sandboxed-ui` custom editor for `.drawio` and `.dio`. Its frame inlines draw.io's viewer (v32.6.9, pinned by SHA-256; `bun scripts/build.ts` writes `editor/index.html`, 4.7 MiB, not committed) and renders the document Orca sends, with page switcher, zoom, fit and layer toggle; it never edits. Verified in Orca 1.4.245 after Settings → Plugins → Add plugin → From a folder… → Install → enable: mosaic's system diagram and generated ERD render beside Source and Changes, and an edit on disk re-renders the open tab. Diagrams stay on a light page in Orca's dark theme because the viewer's dark mode turned ERD table text black on black. Neither Orca's official nor its community catalog had a draw.io plugin on 2026-10-31; Orca's own Excalidraw plugin uses the same pattern (an inlined 5.5 MB bundle, committed). To install from Git or a catalog, commit `editor/index.html` together with the viewer's Apache-2.0 notice.

### GitHub demo PR

[ShaharKatz/drawio-pr-demo#1](https://github.com/ShaharKatz/drawio-pr-demo/pull/1) (private) shows the sandbox change on GitHub. First look: the `.drawio` XML diffs were unreadable, `schema.prisma` is just highlighted code, and both `*.preview.png` image diffs showed tiny squares. The squares are a known bug in GitHub's new Files changed view: its image-diff iframe sizes the images once, sometimes while hidden, and stamps them 0×0 ([community #209101](https://github.com/orgs/community/discussions/209101), [#204047](https://github.com/orgs/community/discussions/204047)); on private repos its image tokens also expire after about five minutes. So GitHub's image diff cannot carry the review.

Committed pictures (previews in the PR, then marked renders on an orphan `review-assets` branch) were rejected: the repository should hold only what is true after merge. Current version: only `*.drawio` and the schema are committed; `.gitattributes` marks `*.drawio` `linguist-generated`, which GitHub collapses in diffs. The design review is one PR comment (hand-posted mock, generated from mosaic's `delta()` by throwaway scripts in `/tmp/drawio-pr-demo-src/`): the changes in words with before → after details, position-only moves listed separately, and each changed diagram rendered by draw.io before (removed parts red, changed amber, removed columns shaded red) and after (new green, planned purple, changed amber, new columns shaded green). The four pictures are GitHub attachments uploaded with `gh pr comment --edit-last --attach`; the attachment URLs return the PNGs.

### Proposed process: diagrams in git, design diff in the conversation

- **Repository:** only `.drawio` sources, as they should be after merge. `*.drawio linguist-generated=true` collapses the XML on GitHub and files it under generated changes in Linear's review view.
- **Pull request:** one comment, created on the first push and edited on later pushes, carries the change list and marked before/after pictures. `gh` 2.99+ `--attach` uploads images as GitHub attachments, visible to whoever can read the repository; nothing enters git.
- **Who posts it:** `--attach` accepts OAuth tokens and personal access tokens only. GitHub App installation tokens, which includes Actions' `GITHUB_TOKEN`, get 404 from the upload endpoint; GitHub calls this intended for now ([cli/cli#14309](https://github.com/cli/cli/issues/14309)). So either the agent or person who opens or updates the PR posts it with their own `gh` login (works today, as in the demo), or CI uses a bot account's PAT stored as a secret. Without a PAT, CI can still post the change list plus a Mermaid drawing with `GITHUB_TOKEN`, since GitHub renders Mermaid in comments.
- **Linear:** Linear Diffs reviews GitHub PRs inside Linear (`linear.review/<owner>/<repo>/pull/<n>`), syncing comments and reviews both ways, once the workspace's GitHub integration has code access to the repository. The demo repository is not connected (`get_diff` finds nothing), so whether GitHub attachment images render there is untested. Linear's editor renders ` ```mermaid ` blocks and accepts uploaded images, so the same report can also go on the linked Linear issue.
- **Locally:** the Orca plugin shows the diagram; `git diff` with the projection textconv shows the change in words. A visual local diff would be a `git difftool` that opens the same marked before/after renders, usable from git GUIs that support external diff tools; possible, not built.

## Mermaid instead of draw.io

Mermaid is the one text format GitHub, Linear and Orca all render natively, so the source diff is readable in every PR and a review comment needs no image hosting or upload token. Renderer versions on 2026-10-31: GitHub 12.2.0 (from a ` ```mermaid info ` block in a gist), Orca 11.17.2 (bundled), Linear unknown. GitHub draws Mermaid in the reader's theme, and flowcharts use ELK layout and the `neo` look by default in Mermaid 12, so the same file is laid out differently on GitHub and in Orca.

Layers have no Mermaid equivalent; they map onto classes. Verified on GitHub (secret gist [dfdcf3fa](https://gist.github.com/ShaharKatz/dfdcf3fa7d329b3b1444242bad6d9738)) and with Mermaid 11.17.2:

- Each element's layer is a class: none for as-built, `class search,api_search intended`, `class csv,api_csv retiring`. Edges take classes through edge ids (`api api_search@-->|"index orders"| search`). One `classDef` per layer gives the look (intended faded and italic). The demo's retiring style used a dashed outline, which clashes with mosaic's rule that dashes mean async edges; a grey style would avoid that.
- The tools would read the class as the layer, so mosaic's change kinds stay as they are; realizing an element removes its id from the `intended` class line.
- No renderer can hide a class, so the layer toggle is gone. The as-built view (as-built + retiring) and intended view (as-built + intended) become generated, filtered copies.
- Review colors are further classes added by the review comment; they combine with the layer classes (a planned element shows faded italic with a purple outline). ERD tables take `style <Table> stroke:…`, and changed columns are marked in the attribute comment (`"🟢 new"`, `"🔴 removed"`). Outlines and opacity read well in light and dark themes; fills do not.
- Element metadata (`component`, `source`, `decision`, `intent`) has no slot in Mermaid; it would live in `%% @<id> key=value` comment lines, which renderers ignore, or in a separate file.
- Mermaid places every element itself; hand-arranged lanes and positions from the draw.io contract cannot be kept.

Built on 2026-11-01 (uncommitted): metadata went into Mermaid data blocks (`id@{ … }`) instead of `%%` comments, and the PR review comment, converter and upgrade path exist. Status, evidence and open decisions: [the plan's Status section](2026-10-31-mermaid-migration-plan.md#status-2026-11-01).

## Operating notes (Orca computer use)

- Needs Accessibility and Screen Recording for "Orca Computer Use"; plain `screencapture` stays blocked without its own grant.
- Electron apps expose only window chrome until their accessibility tree is on, so clicks fail with `window_not_focused`. For a running Orca: `osascript -e 'tell application "System Events" to tell process "Orca" to set value of attribute "AXManualAccessibility" to true'` (no restart). For draw.io: launch with `--args --force-renderer-accessibility`.
- `orca computer scroll` did not scroll Orca's editor; `press-key PageUp/PageDown` after clicking into it did. `type-text` entered text twice in Orca's inputs; trim with `Delete` presses (`set-value` updated the field but not the app's state).
- `orca file open <path> --line <n>` switches a Markdown tab to raw source mode.
- `orca file open|diff --focus` switches Orca's view without computer use; `orca terminal switch --terminal <handle>` brings it back.

## Leftovers

- `/tmp/drawio-orca-demo`, `/tmp/mosaic-review` (sandbox with the projection textconv wired locally), `/tmp/drawio-spike` (visual-diff spike: `build.ts`, `review.html`), `/tmp/drawio-cli` (373 MB). macOS deletes `/tmp` files that have not been accessed for a few days, not only on reboot: by 2026-10-31 the demo repo had lost `.git/HEAD`, `.git/config`, `.gitattributes` and its textconv script, so Orca's `drawio-orca-demo` project no longer shows a workspace.
- Orca: `shaharkatz.drawio-viewer` installed and enabled. The install is a copy under `~/Library/Application Support/orca/plugins/`, so reinstall after changing the plugin. Project `orca-drawio-viewer` added with `orca repo set --external-worktree-visibility show`; without it, Orca 1.4.245 showed no workspace for the newly added repo.
- Orca setting: Open In Apps entry `draw.io` → `open -a /tmp/drawio-cli/draw.io.app`; breaks once `/tmp/drawio-cli` is gone.
- macOS: "Orca Computer Use" keeps Accessibility and Screen Recording until revoked in System Settings → Privacy & Security.
