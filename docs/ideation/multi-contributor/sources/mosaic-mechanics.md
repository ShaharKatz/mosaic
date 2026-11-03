I answered all 10 questions from the files under `kit/`, `install/` and the two install-skill twins, plus the source-side `docs/ideation/2026-09-27-migration-proof.md`, which I used only to find where the H-numbers come from. I edited nothing. Each absence names the search terms I used.

## Summary
- **External bindings:** the tracker is the only external system that gets bound at install time. Its mode is `none`, `local` or `mcp`; MCP mode takes one server name plus an optional team and queue. Drawio is a separate opt-in MCP used only for diagrams.
- **Precedence:** source precedence is two sentences, and the index they point to has no rank column.
- **Who touches the tracker:** only the orchestrator, the main session, reads it through MCP or writes to it. Agents are read-only, except that `executor`, `diagram-keeper` and `stack-operator` may write files.
- **Checks:** doctor and checkup run offline and skip links that have a URL scheme.

## 1. Source precedence and non-repo sources
- **Entrypoints** (`kit/AGENTS.md:2`, `kit/CLAUDE.md:2`): "Architecture docs outrank product docs; rank other project sources by the documentation index." The next lines add "The human may override any recorded decision; surface the conflict" (`:3`) and "User instructions outrank skill text" (`:6`).
- **Circular pointer:** `kit/docs/index.md:80` says "Source precedence is in the entrypoint." `kit/docs/product/README.md:6-7` gives architecture precedence and says to rank other materials "according to the project's indexed sources".
- **No rank in the index:** the index table at `index.md:2-4` has only the columns `Document | Purpose | Read when`. There is no rank, authority, owner or freshness column.
- **The only non-repo sources represented today:**
  - An MCP-mode index row (`index.md:23`): "Runtime MCP server `{{MCP_SERVER}}` | Live intent, discussion, and intake through runtime tools".
  - Drawio "MCP editing" in the diagrams row (`index.md:15`).
  - The tracker authority table (`kit/docs/process/tracker.md:16-25`). It assigns "Owner, assignment, priority, due dates, human discussion | Tracker | None in repo" and says "Tracker state is never proof of landing."
  - Plan frontmatter `tracker: {provider, server, id, key, url}` (`kit/docs/plans/TEMPLATE.md:12-25`).
  - Diagram intent `tracker://<key>` (`kit/docs/architecture/diagrams/README.md:23`).
  - Migration rules: "Existing external tickets stay authoritative" (`install/migration-map.md:127`), and tickets keep their external IDs and URLs (`:98`).
- **External notes become repo files.** They are handled as "Data-only ingestion" with no plan (`kit/docs/process/plan-triage.md:30-33`, `product/README.md:61-75`). External URLs otherwise appear only as prose citations, e.g. `model-notes.md:7`.
- **Absence:** no matches for Notion, Slack, Confluence, Google Docs, Figma, Jira or Linear anywhere in `kit/`, `install/` or the skills.

## 2. Records doc classes (`kit/docs/process/records.md:8-14`)
| Class | Contents and how it changes |
|---|---|
| **Truth** | Element docs, D#, pitfalls and open questions. "Amend in place". Entries are removed by a signed-off `mosaic-gap-audit` verdict or by the plan that removed the subject; "git history is the only archive". |
| **Process** | Rules, skills and agents. "Keep one authoritative project location". Rule 6 (`:46`): they change "only as their own planned work". |
| **Registry** | Ledgers, gaps and index tables. "Fixed row schema; append rows or change status". |
| **Archive** | "Frozen once archived; never rewrite or repoint historical records". |

**Who edits, and how:**
- `dispatch.md:10-14`: the orchestrator writes close-out and registry sync, the executor edits only task files, the librarian proposes, and reviewers never edit.
- `map.md`: only the human approves a plan or signs off.
- New tagged records pass the minting gate (`records.md:27-33`).
- Who owns what: `kit/docs/kit/maintenance.md:4-8`. Only `/mosaic-install` and `/mosaic-kit` write `kit-adaptations.md` (`:58`).
- Enforcement: the records-guard interrupt (`records-guard.md:3-5`) and the lint hooks (`kit/.claude/settings.json`; `maintenance.md:45-49`).

**External copies:**
- Rule 2 (`:43`): compression requires "a retained link demonstrably containing the full record".
- Rule 5 (`:45`): "add a pointer… Accurate copies still drift."
- Rule 11 (`:51`): "Query live state; document how to ask, never the current answer."
- `tracker.md:46,102`: "Link evidence rather than mirror registries, verification output, findings, attachments, or source excerpts."
- `intake.md:37`: verdicts stay in tracker comments, and durable rulings go through the records rule.

**Absence:** there is no doc class for externally hosted records. Searched `external|URL|mirror|copy` in `records.md` and `registries.md`.

## 3. Registries and context discipline
- **Never preload** (`registries.md:6`): "Never preload gaps…, pitfall catalogs, ledgers, or plan documents into the main session."
- **Scout pointers** (`:7`): `registry-scout` returns "identifier + one line + where to read the full entry". A one- or two-entry intake may use a bounded direct read instead.
- **Who reads in full:** the orchestrator reads flagged entries in full (`:9`). Challengers read whole catalogs (`:12`). Archived hits are reported as `archived: <path>` (`:16`).
- **Scout output** (`.omp/agents/registry-scout.md:17-29`): `G-<n> — … — read: <path/heading>`, `catalog absent: <member> (not clearance)`, `NOTHING RELEVANT — searched:`, and "do not quote its full body". Pitfalls are "never cited by number" (`index.md:6`).
- **Documented budgets** (`maintenance.md:24`): rules ≤80 body lines, skills ≤120, agents ≤60, entrypoints ≤30, the maintenance reference ≤120. Narrower limits: core 30, intake 40, map/tracker 60, intake/checkup skills 80.
- **Budgets doctor actually enforces** (`kit/tools/doctor.ts:427-451`): `AGENTS.md` and `CLAUDE.md` 30; core 30; intake 40; map 60; every other rule 80. **`tracker.md` is not given 60 in code.** Also: skills 120 (intake/checkup 80), agents 60, standards 80, `specialists.ts` 160; frontmatter is excluded from counts.
- **Other size caps:** gap entries and pitfalls ≤4 lines (`records.md:18,47`); human briefs ≤40 lines (`human-gates.md:12`); `/mosaic-kit` brief ≤20 lines; review verdicts ≤15 lines before findings.
- **Absence:** no token or context budgets. Searched `token budget|context budget|tokens`.

## 4. Agents
Model roles are defined in `kit/.omp/config.yml:2-10`. The Claude side has 11 agents: one `reviewer` serves as the twin of both omp reviewers (`doctor.ts:371`).

| Agent | Purpose | Role | omp tools / Claude tools | Writes |
|---|---|---|---|---|
| claude-reviewer, gpt-reviewer (Claude: reviewer) | Diff verdict APPROVE/REVISE | @review-claude / @review-gpt | read, grep, glob, bash, `spawns: scout` / same without spawn | Never edits; "shell use is restricted to reading and checks" (`:22,47,52`) |
| plan-adversary | Challenges a draft plan | @critic | read, grep, glob, bash, `spawns: scout` / same | No commits; read-only shell (`:20`); body says to use `registry-scout` via `task` (`:13`) |
| executor | Implements one task block | @templated | read, write, edit, bash, grep, glob | Only `files:` paths; no commit unless instructed (`:11,16`) |
| diagram-keeper | Edits topology diagrams | @templated (Claude file has no `model:`) | omp list has no MCP tool / Claude adds `mcp__drawio__list_pages, get_page, set_page, open_drawio_xml` | Only authorized files under the diagrams root; never stages or commits (`:11-13`) |
| stack-operator | Runs acceptance scenarios | @balanced | read, grep, glob, bash, write | Scenario evidence only; "Never write to an external system without the named human-approved plan line" (`:10,12`) |
| librarian | Checks docs at close-out | @balanced | read, grep, glob | "never edit" (`:27`) |
| ticket-investigator | ASSESS or REFUTE one request | @investigator | read, grep, glob, bash | "No checkout, installs, edits, commits, tracker writes" (`:37`) |
| registry-scout, context-scout | Registry pointers; area brief | @smol | registry: read, grep, glob; context: + bash | "never write files anywhere" (`registry-scout:29`, `context-scout:26`) |
| tracker-scout (installed in local mode only) | Collision report | @smol | read, bash | Read-only CLI operations; never writes (`:8,18`) |
| frontend-reviewer (opt-in) | Frontend specialist review | @review-claude | read, grep, glob, bash | Read-only on the repo and on publishing surfaces (`:14`) |

- **MCP access:** the only explicit MCP grant is the Claude diagram-keeper's drawio tools. omp reaches MCP through "writes JSON to `xd://mcp__drawio_<tool>`" (`.omp/skills/diagrams/SKILL.md:11`).
  - [INFERENCE] Any omp agent that has `write` could call mounted devices, if the runtime mounts them for subagents.
- **Network:** no agent declares a network or sandbox restriction. `.claude/settings.json` contains hooks only, so bash limits are textual.
- **Tracker writes:** no agent may write to the tracker; only the orchestrator does.
  - Intent: `mosaic-plan/SKILL.md:14-15`.
  - Verdicts: `mosaic-intake/SKILL.md:21-23`.
  - Lifecycle events: `mosaic-execute/SKILL.md:62`.
  - Planning row: `dispatch.md:10`.
  - In MCP mode there is "no tracker-scout dispatch" (`tracker.md:89`).

## 5. Install survey and human rulings
- **MCP survey** (`.omp/skills/mosaic-install/SKILL.md:26`): "Survey `mcpServers` in `~/.omp/agent/mcp.json` and target `.omp/mcp.json`, plus user/project Claude `.claude/settings.json` and `.mcp.json`; distinguish configured servers from tools actually mounted…". It also searches commit and branch keys matching `[A-Z]+-\d+`.
- **H-tracking** (`:27`): "`none` with no tracker evidence; `local` only on explicit owner request; `mcp` for a mounted MCP tracker or one the owner names… For `mcp`, require the runtime server name, team if known, and a queue state/label from evidence or a human ruling."
  - Ticket keys or docs alone need a ruling, never a silent fallback to `local` (`migration-map.md:45`).
  - Manifest shape: `{ "mode": "mcp", "mcp": { "server", "team", "queue" } }`, and only `server` is required (`:46`).
  - Placeholder rules for `tracking.mcp.team` and `tracking.mcp.queue` (`placeholders.md:15-17`): optional single-line strings; an underivable queue needs a ruling.
  - Unset values render as "not configured; resolve the target team…" and "…obtain the H-tracking queue ruling before intake" (`kit/install.ts:313-315`).
  - "Installation performs no MCP writes" (`migration-map.md:127`).
- **H0** (`SKILL.md:28`; `concept-alignment.md:34`): cutoff yes or no; it defaults to `no` without the owner.
- **H3** (`SKILL.md:29`): landing mode comes from evidence of PR protection or PR flow; "Conflicting or absent evidence requires a human question, never a default."
- **Alignment row format** (`concept-alignment.md:21`): `| ID | Existing concept / path or name / inventory evidence | Kit concept / home | alignment | Adapt-kit option | Restructure-target option | direction + rationale | resolution | owner | status + evidence |`.
  - IDs run `A1`, `A2`, … and are never reused (`:15`).
  - Allowed values for each field are listed at `:24-29`.
  - A tracker row is mandatory even for `none` (`:18`; `SKILL.md:62`).
- **Rulings table** (`:40`): `| Alignment IDs | Exact question / choices | Why the agent cannot decide | Blocked action | Human answer / provenance | Implementing task / verification |`. "No answer means no affected action" (`:43`).
- **Where the other H-numbers come from:** H4–H9 appear only as parenthetical tags (`SKILL.md:86,87,90`; `migration-map.md:68,71,80`). They come from one migration proof, which lists "H1 base commit, H2 remote, H3 PR landing vs ff-only, H4 defect seeding, H5 plan corpus placement, H6 checkup namespaces, H7 agent twins" (`docs/ideation/2026-09-27-migration-proof.md:17`).
  - **Absence:** H1 and H2 are not used anywhere in `install/` or `kit/`.

## 6. `.omp/mosaic.json`
Written by `kit/install.ts:529-547` as 2-space-indented JSON:
```jsonc
{ "defaultBranch": "…", "topology": "multi-repo"|"monorepo",
  "tracking": { "mode": "none"|"local"|"mcp", "mcp"?: { "server", "team"?, "queue"? } },
  "landing": { "mode": "direct" } | { "mode": "pull-request", "host": "github", "closeOut"?: "two-commit" },
  "kit": { "commit": "<sha | --kit-commit | \"unknown\">" },
  "review"?: { "specialists": [{ "agent", "paths", "context"? }], "frontend"?: { "displayName"?, "collisions"? } },
  "testing"?: [{ "repository", "path", "testCommand", "testRunner": { "format", "setup", "argsPrefix", "cwd", "env"?, "verifyCommand"? } }],
  "standards"?: [{ "name", "paths", "dir"?, "designSystem"? }],
  "repositories"?: [{ "name": "link-repo", "path": ".", "remote" }, …],
  "diagrams"?: { "mode": "drawio", "root", "components", "erd"? } }
```
- **Conditional keys:**
  - `review` only when specialists are selected.
  - `testing` only when a runner is declared.
  - `standards` only when the list is non-empty.
  - `repositories` with pull-request mode, standards or specialists.
- **Credentials:** "no credentials belong in tracking metadata" (`maintenance.md:72`).
- **Readers:**
  - Both commit guards read only `defaultBranch` (`tools/guard-main.ts:218-232`; `.omp/hooks/pre/guard-main.ts:13-23`).
  - `doctor.ts:92-292` validates every key except `kit`.
  - `checkup.ts:89-95` reads topology and tracking.
  - `lint-ledgers.ts:295-302` uses the file's presence to find the project root.
  - `specialists.ts:65` reads review; `stack-base.ts:41-59` reads landing, `defaultBranch` and repositories.
  - `codex-review-harness.ts:423` reads testing; `diagram-check.ts:128-134` reads diagrams and tracking.
  - `erd-generate.ts:268` and `diagram-delta.ts:121` read diagrams; the frontend-review agent and skill read it too.
  - `/mosaic-kit` upgrades read `kit.commit` (`maintenance.md:76,79`).

## 7. Rule loading
- **Homes and names:** `.omp/rules/<name>.md` is a relative symlink to `docs/process/<name>.md` (`maintenance.md:23`). omp reads `rule://<name>`; Claude reads `docs/process/<name>.md` (`:20`).
- **Frontmatter:** each rule has a `description:` in frontmatter. `Read when:` is the first body line, not a frontmatter field (`records.md:2-4`).
- **Always loaded:** `mosaic-core` has `alwaysApply: true` ("Always applied", `index.md:58`).
- **Role-scoped:** `targeted-tests` has `alwaysApply: true` plus `agents: [executor, "*-reviewer", reviewer]` (`targeted-tests.md:3-4`), so it is "loaded automatically inside executor and reviewer agents" (`review-loop.md:11`).
- **Edit-scoped:** `records-guard` uses `scope: tool:edit/write(...)`, `condition: ".*"` and `interruptMode: tool-only`. Its Claude twin uses `paths:` plus a hook. Standards use the same pattern.
- **Everything else is on demand:** "A citation loads nothing: read the named rule before the dependent action" (`map.md:50`).
- **How skills cite rules:** "Read `rule://records`; read `rule://plan-triage`" (omp) or `docs/process/<name>.md` (Claude).
- **What doctor enforces:**
  - Whether `rule://` and `skill://` targets resolve (`doctor.ts:531-540`).
  - That a skill reads `rule://records` before a governed mutation (`:582-604`).
  - Port parity, with `rule://X` treated as equal to `docs/process/X.md` (`:642`).
  - Single-home duplication, reported as WARN (`:627`).

## 8. `/mosaic-kit`
- **General flow** (`kit/.omp/skills/mosaic-kit/SKILL.md:8-14`):
  1. Read the maintenance guide and `rule://records`.
  2. Classify the change.
  3. Branch to `kit/<slug>`.
  4. Follow the matching procedure.
  5. Run doctor, lint and checkup.
  6. Update the adaptation record.
  7. Present a ≤20-line brief and stop for the human.
- **Tracking switch** (`maintenance.md:86-97`): "editing metadata alone does not update rules or callers" (`:87`). "Installation and switching perform no MCP writes" (`:89`). Steps:
  1. Record H-tracking old and new in the alignment row and the adaptations log.
  2. Re-render the saved manifest into fresh scratch and diff old against new.
  3. Inventory and snapshot local data.
  4. Archive `local` data losslessly under `docs/archived/`.
  5. Merge both ports and `mosaic.json`.
  6. Run doctor, lint and checkup plus a read-only smoke test of the selected mode.
- **Landing change and upgrades:** a landing-mode change follows the same render-and-compare approach (`:83`). Upgrades diff against the baseline using `kit.commit` (`:75-79`). "`--force` is not a migration or mode-switch strategy" (`:74`).

## 9. Doctor and checkup
- **Offline:** doctor runs only local `git rev-parse`, `git ls-files` and `git check-ignore` (`doctor.ts:739,748,836`). "Inspect declarations only: never execute a project's commands or import its tools" (`:453`).
- **`.mcp.json` is read statically, for drawio only:** "configuration is not running-server proof" (`:231-234`). Doctor does not check the tracker MCP server at all.
- **Checkup** only spawns doctor and lint with bun (`checkup.ts:115`).
- **Stated limits:** "not live host access, CI success" (`maintenance.md:82`); "Doctor validates metadata… offline" (`:84`); diagram intent is "audited by humans, not queried by CI" (`diagrams/README.md:23`).
- **Exit codes:** both tools use 0 PASS, 1 FAIL or findings, 2 CANNOT-EVALUATE (`doctor.ts:27`; `checkup.ts:37`; `index.md:20`). Cannot-evaluate triggers include bad usage or root, a missing `Bun.markdown`, absent member repos, and a failed `git check-ignore`.
- **Tools outside doctor and checkup that do touch the network:** `stack-base.ts` runs `git fetch` and `gh` (`:85-89,137`), and the Codex sandbox probe runs `curl` (`codex-review-harness.ts:347-351`).

## 10. Link freshness and snapshots
- **Absence:** no external-link freshness check exists. Doctor and checkup skip any destination with a `scheme:` prefix (`doctor.ts:557`; `checkup.ts:143,257`), and checkup excludes `scheme://` trigger targets (`checkup.ts:333`).
- **Staleness concepts that do exist:**
  - Tracker items report `last event (stale Nd)` (`tracker-scout.md:13`; `tracker.md:89`).
  - `stale-plan-link` and `stale-trigger` checks cover in-repo targets only.
  - Product docs carry a `verified:` field (`product/README.md:26`).
  - Intake fingerprints are a SHA-256 over title, body, comments and attachments, plus per-repo revisions. Any change forces re-investigation (`intake.md:20,35`; `mosaic-intake/SKILL.md:12-14`).
- **Evidence packets:**
  - Closure packets and verdicts go in `docs/plans/evidence/<NNNN>/` (`mosaic-execute/SKILL.md:42`); stack evidence goes in `…/stack/S<k>.md` (`stack-acceptance.md:20`).
  - "Evidence must outlive the command" (`verification.md:13`).
  - The tracker gets links rather than copies (`tracker.md:46,102`).
  - **Absence:** no rule snapshots external source content into evidence packets.