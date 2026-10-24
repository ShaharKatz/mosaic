# Using mosaic

## What the kit installs

Mosaic installs an orchestration harness into a project root: a multi-repo link repo or a monorepo.
It supplies shared process rules, omp and Claude Code ports, bounded agents and skills, hooks,
local tools, a starting pitfalls catalog, and empty architecture/product/gap/plan registries; tracker data is installed only for explicitly selected `local` tracking.
The installation roots are `AGENTS.md`, `CLAUDE.md`, `.omp/`, `.claude/`, `docs/`, and `tools/`.
The source installer, this README, checkout-only `../install/` migration references, loop rig, and fake export project are not installed.
Without cutoff, existing project records are reconciled, not replaced with empty registries.

## Installing into a project

Keep a mosaic checkout as the source. You need Bun with `Bun.markdown` (verified on 1.4.2), Git, and clean target/member worktrees.
In an omp or Claude Code session at maximum effort **in the mosaic checkout**, invoke:

```text
/mosaic-install <target>
```

Supply the target path and any known factual answers; the skill asks only for missing facts or
human rulings, never for a handwritten manifest. It derives the project name and full-sentence
summary, `multi-repo` or `monorepo` topology, default branch from `origin/HEAD`, members or
components, remotes, stacks, test commands and cwd, coverage notes, tracking mode/server/scope,
and observed landing/CI policy. Ambiguous evidence is a question, not permission to assume defaults.

The [migration guide](../install/README.md) and [mapping policy](../install/migration-map.md)
define the full procedure:

1. Survey the target read-only, including existing rules, agents, skills, hooks, docs, and ledgers.
   Dirty files and unresolved safety/merge blockers stop target writes; user changes are never
   stashed, reset, overwritten, or committed by the migration.
2. Create or explicitly resume `mosaic/install`. Generate the manifest as an installation record,
   dry-install to fresh scratch outside the target, and compare every collision before placement.
3. Build a concept-alignment table with stable row IDs, both adapt-kit and restructure-target
   options, a chosen resolution, owner, status, and human rulings; the tracker row and H-tracking
   are mandatory even for `none`. Prefer adapting wording/paths; restructure only for a named
   mechanical requirement or human choice.
4. Write the migration plan and nothing-lost ledger, run the planning adversary at maximum effort,
   and record a ruling on every challenge. Resolve human-owned blockers before affected work.
5. Execute task by task on `mosaic/install`, preserving project safety rules and custom entries.
   Run doctor, governed-record lint, and checkup after each task; retain outputs and fix failures.
6. Account for every edited kit file in the adaptations record, require doctor PASS, then obtain
   independent APPROVE verdicts from both `claude-reviewer` and `gpt-reviewer` on the final snapshot.
   Repairs return through the checks, adaptation gate, and review loop.
7. Run the installed `/mosaic-checkup` in an omp self-check session and stop at the sign-off brief.
   This last check needs the `omp` binary and working model credentials even for a Claude-led
   migration; missing runtime proof is a blocker, not an assumed pass.

During migration, all target writes, including reports, stay on `mosaic/install` under `docs/mosaic-migration/`:

| Record | What it preserves |
|---|---|
| `STATUS.md` | Phase checkpoints and last commit, so interrupted sessions can resume |
| `00-survey.md` | Inventory, value provenance, command evidence/limits, baseline, and conflicts |
| `manifest.json` | Skill-generated input to `kit/install.ts`; a reproducibility record, not runtime config |
| `01-dry-install.md` | Scratch comparison, per-path merge decisions, and external snapshot locations |
| `02-plan.md` | Tasks, adversary rulings, nothing-lost ledger, and execution evidence |
| `03-concept-alignment.md` | Permanent concept-to-kit table and human rulings, using [this template](../install/concept-alignment.md) |
| `kit-adaptations.md` | Each changed kit file's hunk summary, reason, alignment IDs, and verification |

At sign-off approval, only the alignment and adaptation records remain in `docs/mosaic-migration/`.
Both cutoff and non-cutoff migrations move transient reports, status, manifest, and inventory into
`docs/archived/mosaic-migration/` as frozen history. Evidence logs are ignored from phase 3 and deleted
after the archived plan/brief records their file list and final doctor/lint/checkup exits and reviewer
verdict lines. The document index's Migration rows link the two kept records and the archive, with a
History row for the archive. See [the lifecycle](../install/migration-map.md#migration-state-lifecycle).

Optional **CUTOFF mode** requires explicit `cutoff: yes` input or ruling H0; it is never the default.
It archives all inventoried pre-existing docs and ledgers under each owning repo's
`docs/archived/<original path>`, except owner-named process/runbook exceptions, preserving history,
bytes, modes, and symlink targets. This includes root/component docs and PR documents; entry files and harness
configuration still follow the merge policy. Fresh registries replace old active records, and the
index links archived families and counts. Old gaps and defects are not re-minted. The last task
writes `docs/docs-migration-instructions.md` from [the template](../install/docs-migration-instructions.template.md)
for the first real plan, `/mosaic-plan docs-rebuild` (`0001`); rebuilding current docs is not part of
installation. See [the cutoff boundary](../install/migration-map.md#cutoff-mode).

At the brief, inspect the branch and evidence, answer the exact questions against concept-alignment
row IDs, and decide whether to land. Questions concern missing facts or choices such as conflicting
safety rules, merge/retirement decisions, or a landing-policy override—not JSON fields. The brief
separates resolved rows, rows needing a ruling, unfinished tasks, and Unverified limits, and links
the adaptation record and doctor result. Cutoff adds the archive SHA/counts and rebuild handoff.
No default-branch advance, landing, push, or deployment is authorized by merely running the skill.

After landing, work from the target: read `AGENTS.md` or `CLAUDE.md`, `docs/process/map.md`, and
`docs/index.md`. Normally start with `/mosaic-intake`, then `/mosaic-plan <approved change>`;
`/mosaic-execute <plan-path>` follows plan approval. With cutoff, start instead with
`/mosaic-plan docs-rebuild` and supply `docs/docs-migration-instructions.md`.

## Customizing after install

Run `/mosaic-kit <intended change>` **in the installed project** for requested kit adaptations,
project agents/skills, model-role changes, tracking-mode switches, or upgrades—not ordinary project implementation.
The [maintenance guide](docs/kit/maintenance.md) owns the procedures for paired ports, shared-rule
homes, budgets, checks, and upgrades. The skill works on `kit/<slug>` and stops for a human brief
before landing.

Ownership, adaptation-record authorship, and upgrade reconciliation have one home in the
[maintenance guide](docs/kit/maintenance.md#ownership). Keep the record indexed; use that procedure
rather than treating its old rows as an authoritative change list or overwriting live project docs.

Add project-specific agents and skills alongside kit roles, following neighboring files and their
runtime conventions; preserve existing project-only entries. Configure available models and effort
levels through `modelRoles` in `.omp/config.yml`, keeping agent role references intact. Claude Code
uses its own runtime model settings. Detailed maintenance checks belong in the guide, not in
ordinary project instructions.
Pull-request installations include a final review on the open PR, defaulting to `gpt-reviewer`
(Claude Code: `reviewer` for the corresponding configured role). Later heads use the documented
Git 2.40+ replay procedure to review only the branch's own code delta. Every PR, including
docs-only and inline exemptions, still requires comment rulings and passing exact-head CI.
Direct landing does not install this rule or its callers; no additional manifest field is needed.
{{REVIEW_ENGINE}}
### Optional Codex engine and test runners
Codex remains opt-in; `gpt-reviewer` is the default. Add `testRunner` beside an existing member/component `testCommand` to install `/review-with-codex` twins and the shared harness/schema. No CLI installation, login or model choice is automatic.
Each runner has `format: "pytest" | "jest" | "vitest" | "exit-code"`, approved `setup: string[]`, `argsPrefix: string[]`, repository-relative `cwd` (defaults to component path/member clone root), optional non-secret `env`, and optional `verifyCommand` for import/build provenance. Example: `"testRunner": { "format": "pytest", "setup": [], "argsPrefix": [], "cwd": "." }`.
Declare entry runners only on the topology's active entries: `components` for monorepos, `members` for multi-repo installations. Runners on inactive entries are rejected rather than dropped.
Direct commands use `argsPrefix: []`; wrappers such as a package-manager test script may need `["--"]`. Only known formats receive selected paths/report flags; only pytest accepts `::` node IDs. Exit-code commands run unchanged and yield no counts or attributable mutation failures. Setup is approved once at installation and runs automatically only in disposable review clones; undeclared setup needs approval.
The `vitest` format requires Vitest 3+ and a `testCommand` without a `run` subcommand: the harness adds `run` and its reporters.
Optional `rootTest: { testCommand, testRunner }` declares root tests; no entry means no root fallback. The installer normalizes selected entries into `.omp/mosaic.json` `testing`, not a separate runner registry or Markdown scraper. Old manifests without either field retain their installed Markdown, inventory and runtime metadata.
Read the [maintenance contract](docs/kit/maintenance.md) and [survey constraints](../install/placeholders.md) before changing runner metadata. Invocation reports missing project toolchains; structural doctor checks do not require them or Codex.
{{/REVIEW_ENGINE}}


### Path-selected review specialists

Survey whether the project actually has a frontend, its changed-path scope and an existing
project-owned review context section; never invent a frontend or replace project reviewers.
Optional `review.specialists: [{ agent, paths, context? }]` defaults to empty. Each agent must
exist in both runtimes (kit or project); paths are safe installation-root-relative globs,
including member prefixes for multi-repo projects. Every glob must match a project file.
Optional context is an existing project-owned `file#section` reference; preserve that section
in scratch with a project overlay when reproducing an install.

Selecting `frontend-reviewer` installs its skill/agent twins and dispatch/navigation lines.
Optional `review.frontend` accepts only `displayName` (default `Frontend review`) and
`collisions` (`named`, the default, or GitHub pull-request-only `codeowners-and-me`).
Design-system configuration has one home: `standards[].designSystem` on `shared-first`.
The specialist compares the installed version by default and stays code-only unless the human
approves browser checks/pictures for that review, with named states and expected cost.
Specialists receive the ordinary reviewers' pinned repo/base/head and add findings; they never
edit or publish. In direct mode results stay in-session; in GitHub pull-request mode the
orchestrator posts a head-pinned COMMENT review. Selected settings are recorded in `.omp/mosaic.json`.
Empty/omitted selection installs no optional twins, navigation or review metadata.
Nonempty selection also installs `tools/specialists.ts`; run its pinned three-dot diff command
from the review-loop rule to obtain a deduplicated JSON agent list (exit 0), or an explicit cannot-evaluate
error (exit 2, no stdout). Context anchors follow GitHub section-link rules, including duplicate
heading suffixes and separate space-derived hyphens.
Project-owned context files may be in-root symlinks. Existing specialist agents are preserved and
reported, even under `--force`; explicit project overlay entries take precedence. Upgrade kit-owned
twins through the scratch procedure, not by overwriting project reviewers.

## Reference

### Topology and default branch

These are surveyed facts, not choices made to fit a template:

| Topology | Manifest and installed behavior |
|---|---|
| `multi-repo` | A link repo plus at least one independent member git repo; each member has a named remote and its own repo boundary/ledger |
| `monorepo` | One git repo, `members: []`, optional `components` for in-repo packages/deployables, no component remotes or local ledgers |

Monorepo plans live in root `docs/plans/` with `repo: link-repo`; `files:` and `reads:` are
repo-root-relative. Components do not get separate branches or plan homes. The skill derives the
default branch from `origin/HEAD`, using the [survey derivation](../install/placeholders.md#derive-values-do-not-guess) when that ref is unavailable;
missing or conflicting evidence needs a ruling. Existing PR/CI and deployment policy is preserved
unless the human overrides it. `.omp/mosaic.json` holds runtime `defaultBranch`, `topology`,
`tracking`, `landing`, and source provenance in `kit.commit`; the generated manifest is an installation
record, not runtime configuration.

### Placeholders and generated manifest schema

The [rendering reference](../install/placeholders.md) defines exact expansions and safe placement.
The skill supplies every value from survey evidence; source Markdown uses these double-brace tokens:

| Token | Value or expansion |
|---|---|
| `PROJECT_NAME` | `project.name`, used in map/index/architecture titles and read gates |
| `PROJECT_SUMMARY` | `project.summary`, the complete first sentence of both entry files |
| `LINK_REMOTE` | `remotes.link`, the root/link remote in git-flow instructions |
| `DEFAULT_BRANCH` | `git.defaultBranch`, used in branch, review, and landing instructions |
| `MEMBERS` | File-specific member/component rows, topology text, remote clauses, or plan/tracker examples |
| `MEMBER_REMOTE:<name>` | Named `remotes.members[name]` lookup |
| `TRACKING` | `tracking.mode`: `none`, `local`, or `mcp`; omitted helper input defaults to `none` |
| `MCP_SERVER` / `MCP_TEAM` / `MCP_QUEUE` | Runtime server and optional scope; absent team/queue render readable instructions, not invented scope |
| `TRACKING_NONE` / `TRACKING_LOCAL` / `TRACKING_MCP` | Mode blocks with slash-prefixed closing tokens; keep only the selected mode; may contain topology blocks |
| `LANDING_DIRECT` / `LANDING_PULL_REQUEST` | Landing blocks with slash-prefixed closing tokens; selected after tracking and before topology; may contain topology blocks |
| `CLOSE_OUT_TWO_COMMIT` / `CLOSE_OUT_DEFAULT` | Close-out blocks with slash-prefixed closing tokens; selected after landing and before topology; opt-in two-commit layout or unchanged default layout |
| `MULTI_REPO` / `MONOREPO` | Non-nested topology blocks selected after tracking and landing blocks; then expand value tokens |
| `STANDARDS` | Optional Standards section and selected canonical links; empty when none selected |
| `STANDARD_PATHS` / `STANDARD_SCOPE` | JSON-quoted Claude paths list / one-line JSON sequence of complete omp edit-write scope tokens |
| `EXCLUDED_DATA_DIR` / `DESIGN_SYSTEM` | Selected excluded-data directory / shared-first design-system location or generic fallback |

The following examples document the schema consumed by the mechanical helper, not human setup
steps. A multi-repo record has at least one member:

```json
{
  "project": {
    "name": "Atlas",
    "summary": "Atlas is a link repo for the API service."
  },
  "topology": "multi-repo",
  "git": { "defaultBranch": "main" },
  "tracking": { "mode": "none" },
  "landing": { "mode": "direct" },
  "remotes": {
    "link": "https://example.invalid/atlas.git",
    "members": { "api": "https://example.invalid/api.git" }
  },
  "members": [{
    "name": "api",
    "path": "api",
    "stack": "TypeScript, Bun",
    "testCommand": "bun test",
    "coverageNote": ""
  }]
}
```

A monorepo record uses components instead; `components` may be omitted or empty:

```json
{
  "project": {
    "name": "Atlas",
    "summary": "Atlas contains the API in one repository."
  },
  "topology": "monorepo",
  "git": { "defaultBranch": "main" },
  "tracking": { "mode": "none" },
  "landing": { "mode": "direct" },
  "remotes": { "link": "https://example.invalid/atlas.git" },
  "members": [],
  "components": [{
    "name": "api",
    "path": "apps/api",
    "stack": "TypeScript, Bun",
    "testCommand": "bun test",
    "coverageNote": ""
  }]
}
```

Each member/component requires `name`, root-relative `path`, `stack`, `testCommand`, and
`coverageNote` (which may be empty). Names and paths must be unique within their list; paths cannot
be absolute or contain backslashes, `.` or `..` segments. Names use letters/digits first, then
letters/digits/dot/underscore/hyphen. Manifest strings are single-line and contain no placeholders.
Multi-repo member remotes are keyed by member name; monorepo `remotes.members` may be omitted.
The helper defaults omitted `topology` to `multi-repo`, `git.defaultBranch` to `main`,
`tracking` to `{ "mode": "none" }`, and `landing` to `{ "mode": "direct" }`, but the skill records each explicitly from survey evidence.
Commands render from each entry's path; adapt the stack document when proven cwd differs.
Tracking accepts `{ "mode": "local" }` or `{ "mode": "mcp", "mcp": { "server": "issues", "team": "ENG", "queue": "Triage" } }` instead of `none`. These names are illustrative: MCP `server` is the exact runtime name and required; `team` and `queue` are optional strings supported by H-tracking. Omit `mcp` for other modes.
Landing accepts `{ "mode": "pull-request", "host": "github" }` instead of direct; host is required (GitHub only) in pull-request mode and rejected in direct mode. The H3 survey selects pull-request from branch protection requiring PRs on the default branch, merged PRs on it, or documented PR flow, deriving the host from the remote. Direct pushes with no PRs select direct; conflicting or absent evidence requires a human question, never a default. Tracking blocks are resolved first, then landing blocks, then topology and values; tracking and landing may contain each other and topology, never same-family nesting or mode blocks inside topology blocks.
Optional `landing.closeOut: "two-commit"` is accepted only in pull-request mode; unknown values and direct-mode use are rejected. Select it only from project history showing squash-then-close-out commits or the human's choice, never by default. Absence preserves today's layout, including older runtime metadata. Render close-out blocks after landing and before topology/values. The task branch becomes one code commit (plan subject, task subjects in its body) before opening the pull request, followed by one close-out commit carrying its locator and all repo-owned terminal documentation; later review/CI code corrections use fixup/autosquash, keeping close-out last. Member-homed plans keep R4's link-repo ledger sync after the member merges.

### Opt-in team standards

Offer all five standards during survey, selecting only what the human confirms:
`excluded-data`, `no-magic-strings`, `shared-first`, `testing`, and `pr-evidence`.
The optional `standards` array contains unique entries with `name` and a nonempty `paths` list.
Globs are repository-relative single-line strings without backslashes, parentheses, or `.`/`..` segments.
Derive globs from surveyed source/test paths and show them to the human, rather than guessing from a language alone.
Only excluded-data accepts `dir` (default `excluded_data`), a relative directory of letters, digits,
underscores, hyphens and `/` separators. Only shared-first accepts the optional single-line
`designSystem` location; omission says "the project's design system or shared component library, if any".
For example:

```json
{
  "standards": [
    { "name": "excluded-data", "paths": ["src/**"], "dir": "excluded_data" },
    { "name": "no-magic-strings", "paths": ["src/**/*.ts", "tests/**/*.ts"] },
    { "name": "shared-first", "paths": ["src/**/*.tsx"], "designSystem": "packages/design-system" },
    { "name": "testing", "paths": ["tests/**"] }
  ]
}
```

Each selected standard installs canonical `docs/standards/<name>.md` plus short ordinary scoped rules
in both ports: Claude `paths:` and omp edit/write `scope`, following records-guard's runtime idioms.
Only selected standards get an index row and runtime metadata. Missing/empty list installs nothing.
Testing points to the project's stack commands and leaves a project-owned **Surfaces** section empty.
Merge an equivalent existing project standard, move it losslessly to `docs/standards/<name>.md`,
and repair its inbound links rather than creating a second authority.
For excluded-data, `/mosaic-install` adds one anchored folder ignore line; the helper never changes
`.gitignore`. In multi-repo projects, choose the folder inside the repo whose scripts write the data;
the folder and ignore line belong to that repo, not the link repo that ignores the member.
The manifest directory is installation-root-relative; the ignore line is relative to its owning repo.
Data goes into that folder instead of new per-path ignore entries; credentials use existing secrets handling.
Doctor fails for missing files, wrong pointers/scopes, or globs matching no non-ignored repository file when inventory is complete.
It uses installation-relative Git inventories when available, with a filesystem fallback without git; unmatched globs with incomplete inventory are cannot-evaluate and name the unavailable repositories.
It resolves the folder's owning repo from its nearest existing ancestor and checks
`git check-ignore -q <dir>/` there (owner-relative path; cannot-evaluate without git).
### Optional architecture diagrams

Manifest `diagrams: { "mode": "none" | "drawio", "root"?: "repo-relative-directory" }`
defaults to `none`. Enable drawio only by owner opt-in; the default root is
`docs/architecture/diagrams`. Absolute roots, traversal, backslashes, whitespace and
empty segments are rejected, as are `.git` segments, harness/tool namespaces, `docs/tracker`
and `docs/standards` subtrees, reserved documentation homes and colliding kit destinations.
Every destination ancestor is checked against both planned entries and the filesystem before writes;
a planned file or symlink cannot become a directory. Reserved names and planned destinations use
one NFC-normalized, case-insensitive identity policy on every filesystem; ambiguous aliases are
rejected rather than guessing filesystem sensitivity. The selected root receives the project-owned contract starter;
the kit installs a diagram rule, skill/keeper twins and Bun validation/delta tools.
Runtime metadata records the selected root and manifest member/component bindings.
With no tracker, an approved `plan:NNNN` is intent; other modes use `tracker://<key>`.
The core has no schema generator or generated-folder comparison exemption.

The project owns `.mcp.json`; the mechanical helper never writes it, even with `--force`.
The owner merges `{"mcpServers":{"drawio":{"command":"npx","args":["-y","<package>"]}}}`
without replacing other servers, taking `<package>` from `DRAWIO_PACKAGE` in
`tools/constants/diagrams.ts` (the only pin). Doctor **FAILs** missing/mismatched mounts;
configuration is not proof of a running server. The diagrams skill checks mounted tools
before any write. Offline validation/deltas need no MCP.
DIAGRAMS_DRAWIO blocks select opt-in text after tracking/landing/close-out and before
topology/values; DIAGRAMS_ROOT and DRAWIO_PACKAGE expand selected values.
Without the bundle, no diagram files, tools, MCP requirement or caller hooks are installed.

#### Optional Prisma ERDs

With drawio selected, optionally set `diagrams.erd` to
`{ "adapter": "prisma", "schemaGlobs": ["schema/**/*.prisma"], "output": "docs/architecture/diagrams/erd", "component": "platform", "label": "Schema" }`.
These are illustrative values: derive globs, component and label from the project and obtain owner opt-in.
Absence installs no adapter files, schema commands or generated-folder exemption.
Single-file schemas (including datasource/generator blocks) and split schemas are supported;
unsupported syntax reports file:line instead of dropping facts. No MCP, database or migration runs.
The output must be a safe directory **strictly inside** the selected diagrams root, never a
kit-file collision. It shares core's NFC/case-folded supported-root restrictions; siblings are not supported.
`component` must be an installed diagram binding, `platform` or `external`; `label` is a nonempty
single-line project-chosen caption. `schemaGlobs` is a nonempty array of safe repository-relative
globs ending in `.prisma`, without traversal, whitespace, braces, backslashes or parentheses.

Run `bun tools/erd-generate.ts`, then `bun tools/erd-generate.ts --check` and
`bun tools/diagram-check.ts` through the project's declared verification command on schema changes.
`--check` is read-only and names missing/changed/unexpected files; `--file <schema>` takes a
repo-relative input or unambiguous suffix and isolates its output, while resolving cross-file references.
Generation preflights all inputs before writes, refuses hand-authored destination collisions, and
cleans only orphans with the `.erd.drawio` suffix **and** the adapter marker.
Generated output is explicitly marked, never keeper-edited. Only enabled, fully synchronized output
matching the compared snapshot is exempt from declarations; no unconditional folder exemption exists.
DIAGRAMS_ERD slash-closed own-line/inline blocks select adapter-only Markdown after DIAGRAMS_DRAWIO;
doctor loads the adapter contract only from its own contained sibling constants when enabled.

PR evidence requires `landing: { mode: "pull-request", host: "github" }`. Ask whether the project
wants it and which source paths need evidence; browser checks and picture capture separately need the human's OK.
Selecting it installs `.github/pull_request_template.md` only when no project default template exists.
Defaults are non-directory case-insensitive `pull_request_template` files with any extension (e.g. `.md`, `.txt`) or none,
in `.github/`, the root or `docs/`, in that precedence order. Named files in case-insensitive
`PULL_REQUEST_TEMPLATE/` directories are preserved but do not block the kit default. Every existing template
is protected from overlays and `--force`; hand the owner the kit's `## Evidence` section to merge.
Doctor requires that heading in the effective default, never a shadowed or named template. Missing evidence alone
is procedural (P); an observed wrong state or false/unsupported claim is substantive (S).
In multi-repo installations, doctor checks only the link repository's template; offer the Evidence section
to each selected member repository's owner for its own pull requests, without assuming the link template applies there.

### Mechanical helper: greenfield/manual path

For a greenfield repo, a human may still supply this schema and call the helper directly from the
mosaic checkout:

```sh
bun kit/install.ts --manifest "/path/to/manifest.json" --target "/path/to/project"
bun kit/tools/doctor.ts --root "/path/to/project"
```

The helper renders Markdown, preserves modes, and creates shared process `.omp/rules/*.md` as relative symlinks
to `../../docs/process/*.md`; scoped standard rules in both ports are ordinary files.
It does not clone members, initialize git, configure remotes, or edit `.gitignore`. Git, Bash, Python 3 for Claude hooks, and
the project's test runners are needed for the corresponding installed workflows.
Changed destination files are refused before writes unless `--force` is given; identical installs
are no-ops. `--overlay <dir>` replaces same-path files in full after rendering, without merging or
rendering the overlay. Unrelated files are preserved, and symlinked destination directories are
refused. `--force` replaces bytes; it is not an existing-project migration or an upgrade strategy.

### Local-stack acceptance (always installed)

Every new plan declares scenarios or `stack: none — <reason>`. The rule and acceptance-only
`stack-operator` twins are always installed: the no-stack case is explicit, not an opt-in.
The project owns **Local stack** in `docs/process/stack.md`, not manifest fields.
The starter says `none`; `/mosaic-install` must confirm that from the survey or replace it
with bring-up/stop/teardown commands and cwd, drives, credential reads, envelope prefix,
coverage check and pre-drive safety check. Mark unknowns for the human; never invent commands.
Whenever any credential or connection override is read, require the keyless envelope;
`none needed — <reason>` is explicit, never a default. External writes need a named,
human-approved plan line. Acceptance runs before final review in pull-request mode,
before sign-off in direct mode. Doctor checks declarations only and never executes them.

### Local tools

Run these from the installed project root:

| Command | Purpose |
|---|---|
| `bun tools/doctor.ts` | Harness structural checks; exit 0 / 1 / 2 means pass / fail / cannot evaluate |
| `bun tools/checkup.ts --json` | Lint, doctor, and document/plan/trigger drift sweep |
| `bun tools/docimpact.ts <plan-path>` | Document-impact candidates to inspect, not automatic edit instructions |
| `bun tools/guard-main.ts` | Shared commit-target resolver for both guard adapters; JSON stdin → target path or `SKIP`; `--hook` checks Claude hook payloads |
| `tools/tracker.ts` (`local` only) | Offline inventory/intent operations; commands and safety gates live in the [tracker rule](docs/process/tracker.md) |
| `bun tools/stack-base.ts --repo <name> [--plan <path>]` (pull-request only) | Read-only repository-scoped stacked-base resolution; [procedure](docs/process/stacked-prs.md), ordered protocol and exit contract |
| `bun .omp/hooks/post/lint-ledgers.ts <path>` | Governed registry/plan lint when using omp |
| `bash .claude/hooks/lint-ledgers.sh <path>` | Governed registry/plan lint when using Claude Code |

Use the current runtime's lint hook. Doctor accepts `--root <dir>`; checkup's `--json` is optional.
For diagnostic details and kit-owned findings, use `/mosaic-kit` and the maintenance guide.

### Skills

| Skill | Purpose |
|---|---|
| `/mosaic-install <target>` | Checkout-only survey, migration, adaptation, and sign-off brief |
| `/mosaic-intake` | Investigate the intake queue and present a human digest |
| `/mosaic-plan <change>` | Scope, reserve, draft, challenge, and present work for human approval |
| `/mosaic-execute <plan-path>` | Execute an approved plan through review, verification, close-out, and landing gates |
| `/mosaic-gap-audit` | Re-check existing gaps against current evidence; apply verdicts only after sign-off |
| `/mosaic-checkup` | Sweep drift and present findings |
| `/mosaic-kit <intended change>` | Maintain the installed kit, project harness additions, model roles, and upgrades |

### Tracking modes

H-tracking records evidence from runtime MCP mounts/configuration, tracker docs, and commit/branch
ticket keys. The survey checks `~/.omp/agent/mcp.json` (`mcpServers`), target `.omp/mcp.json`,
and user/project Claude `.claude/settings.json` and `.mcp.json`; it distinguishes configured
servers from tools actually mounted in the session. Every install records a tracker alignment row.

| Mode | Selection | Runtime behavior |
|---|---|---|
| `none` | Default without tracker evidence, or an explicit owner ruling | No local tracker tool/data/scout or tracker frontmatter in the plan template; no fabricated ticket IDs. |
| `local` | Explicit owner request only | Existing offline replay CLI and local items/outbox; no live connection or synchronization. |
| `mcp` | A mounted MCP tracker or one named by the owner | Sessions call the runtime server's MCP tools directly, with no installed client or local tracker data. |

MCP needs the exact runtime server name, team when known, and a queue state/label inferred from
evidence or resolved by a human ruling. Ticket keys alone do not identify a server or queue;
missing mounted tools/credentials are a verification blocker, not an automatic local fallback.
Installation performs no MCP writes and supplies no MCP client/server implementation.
Only `local` installs `tools/tracker.ts`, `docs/tracker/**`, and both ports' `tracker-scout.md`.
Existing records and external IDs survive migration regardless of the new mode; mode switching
archives local data safely before obsolete kit-owned paths are removed. It never imports local
items into a live workspace as an installation step.
The rendered `docs/process/tracker.md` is the one home for mode-specific commands and safety gates;
skills and agents read it and follow the installed mode. Runtime metadata changes alone do not
re-render rules or callers: use `/mosaic-kit` and the [maintenance guide](docs/kit/maintenance.md).

