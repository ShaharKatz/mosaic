# AI-native SDLC & spec-driven frameworks: how they handle multiple contributors (state as of 2026-10-31)

## 1. Coverage table

| Product / framework | Category | One-line what | Surfaces touched | Primary source |
|---|---|---|---|---|
| GitHub Spec Kit | OSS SDD toolkit (CLI + agent skills) | constitution → specify → plan → tasks → implement → converge; extension/preset/bundle/catalog system | repo, PR; tracker, KB, release via community extensions | https://github.com/github/spec-kit |
| AWS Kiro (IDE/CLI/Web) + Kiro Crew | Commercial agentic IDE/cloud agent + OSS personal agent workspace | requirements/design/tasks specs, steering, hooks; Crew adds persistent agents reachable from Slack/Teams/Telegram | repo, PR (Web), chat (Crew) | https://kiro.dev/docs/steering/ ; https://kiro.dev/faq |
| AWS AI-DLC (awslabs/aidlc-workflows) | Methodology + harness-neutral engine | Inception/Construction/Operations, mob rituals, units of work, bolts; v2.11 adds team-owned Construction with git-ref claims and merge gates | repo, git refs, PR-like merge gate | https://github.com/awslabs/aidlc-workflows |
| BMAD Method (v6.12 stable, v7 alpha) | OSS agile-persona method (skills) | persona agents (PM, architect, dev, PO "Sofia"), PRD/architecture/stories, party mode, ticketing stores | repo; tracker (GitHub/Jira/Linear/Notion/Trello); KB via hooks | https://github.com/bmad-code-org/BMAD-METHOD |
| OpenSpec (Fission-AI) | OSS lightweight SDD (change proposals + delta specs) | propose → apply → archive; "stores" (beta) for cross-repo planning | repo, PR | https://github.com/Fission-AI/OpenSpec |
| Tessl | Commercial; pivoted from spec-as-source framework to skill/context registry ("agent enablement platform") | registry, evals, governance of agent skills | registry; PR (code-review loop) | https://tessl.io/ |
| Agent OS v3 (Builder Methods) | OSS standards layer | discover/inject coding standards; /shape-spec in plan mode | repo | https://buildermethods.com/agent-os |
| obra/superpowers | OSS skills methodology | brainstorm → worktree → plan → subagent TDD → review → finish branch | repo, PR | https://github.com/obra/superpowers |
| Every Compound Engineering plugin | OSS skills plugin | brainstorm/plan/work/simplify/review/compound; handoff, Proof sharing, announcement drafts | repo, PR, shared doc (Proof), customer copy (drafts) | https://github.com/EveryInc/compound-engineering-plugin |
| GSD Core (ex get-shit-done) | OSS SDD/context system | phases, parallel waves, workstreams, ship-a-PR | repo, PR, GitHub issue | https://github.com/open-gsd/gsd-core |
| Thoughtworks Radar / martinfowler.com | Analyst critique | SDD = Assess; Spec Kit, OpenSpec, Superpowers = Assess (Apr 2026) | n/a | https://www.thoughtworks.com/en-us/radar/techniques/spec-driven-development |

## 2. Per product

### GitHub Spec Kit
Open-source toolkit (≈144k stars) giving agents "structured processes, reusable templates, and documented outcomes"; SDD in core plus bug-fix and idea-assessment extensions ([README](https://github.com/github/spec-kit)).
- **Shared artifacts:** `.specify/memory/constitution.md` + per-feature `specs/NNN-feature/` (spec, plan, tasks). Microsoft (Oct 7 2026) describes a *layered constitution*: org baseline → domain/tech overlay → team customization, delivered via presets ([MS blog](https://developer.microsoft.com/blog/from-spec-first-to-enterprise-ready-extending-github-spec-kit/)).
- **Review/approval:** core says run skills "one at a time, reviewing each result before continuing" — a single-user chat gate ([README](https://github.com/github/spec-kit)). PR-based approval exists only as community extension "Plan Review Gate" ("Require spec.md and plan.md to be merged via MR/PR before allowing task generation") and "Spec Validate" (peer-review SLA, hard gate before implement) ([community catalog](https://github.com/github/spec-kit/blob/main/docs/community/extensions.md)).
- **Tracker:** core `speckit.taskstoissues` is deprecated in favour of `specify extension add github` ([extensions ref](https://github.github.io/spec-kit/reference/extensions.html)). Community: Jira (3 variants), Linear (`linear-sync`, `linear-weave`), Azure DevOps, GitHub Projects, Trello, OpenProject. Linear Weave pulls requirements from a Linear issue, mirrors tasks.md into sub-issues per task/phase/story, syncs status via hooks; "Linear is the source of truth — no local state files" and dedup relies on title prefixes ([Linear Weave](https://speckit-community.github.io/extensions/linear-weave)). linear-sync adds a GitHub Action flipping issues to Ready-to-merge/Merged on PR events ([repo](https://github.com/ashbrener/spec-kit-linear-sync)).
- **Chat/KB:** community "Microsoft 365 Integration" (Teams messages, meeting transcripts → markdown), "Confluence Extension" (publish spec summary), "Work IQ", "Shared Knowledge" (cross-repo decisions) ([catalog](https://github.com/github/spec-kit/blob/main/docs/community/extensions.md)). No Slack integration found in catalog.
- **Release/announcement:** community "Spec Changelog" (changelog/release notes from spec git history) and "Ship Release Extension" ([catalog](https://github.com/github/spec-kit/blob/main/docs/community/extensions.md)).
- **Multi-contributor:** community "Team Assign" (assign tasks.md items to engineers, per-engineer workboard), "Spec Orchestrator" (detect conflicts across parallel specs), "Worktrees", "Branch Convention", "Archive Extension" (merge features into project memory resolving conflicts) ([catalog](https://github.com/github/spec-kit/blob/main/docs/community/extensions.md)).
- **Governance:** org-controlled catalogs with highest priority vs discovery-only community catalog; bundles pinned with provenance ([MS blog](https://developer.microsoft.com/blog/from-spec-first-to-enterprise-ready-extending-github-spec-kit/)). Catalog listings "are not audits or endorsements" ([README](https://github.com/github/spec-kit)).

### AWS Kiro (IDE/CLI/Web) and Kiro Crew
Kiro: agentic IDE/CLI/Web/mobile; specs = `requirements.md`, `design.md`, `tasks.md` ([best practices](https://kiro.dev/docs/specs/best-practices/)). Kiro Crew: open-sourced Aug 4 2026, "a personal AI agent that runs on your own machine" ([changelog 0.1](https://kiro.dev/changelog/crew/0-1/)).
- **Shared artifacts:** workspace steering `.kiro/steering/` (product.md, tech.md, structure.md), global `~/.kiro/steering/`; "Team steering" = global steering "pushed to user's PCs via MDM solutions or Group Policies" or downloaded from a central repo; AGENTS.md supported ([steering](https://kiro.dev/docs/steering/)). Hooks are JSON in `.kiro/hooks/` (workspace) or `~/.kiro/hooks/` ([hooks](https://kiro.dev/docs/hooks.md)).
- **Spec sharing/review:** "Specs are designed to be version-controlled… Store specs directly in your project repository"; cross-team via "central specs repository" + git submodules; Kiro invites requests for "cross-project spec management" features ([best practices](https://kiro.dev/docs/specs/best-practices/)). Standard specs have per-phase review; Quick Spec skips it; "Your team benefits from explicit approval checkpoints" (same page).
- **Parallel work:** "Run all Tasks" builds a dependency graph and runs waves concurrently (agent-level). For teammate overlap: "Sync Files" marks tasks done "because a coworker or you ended up doing it in another session" (same page). No claim/lock mechanism documented.
- **Tracker/KB:** import requirements from Jira/Confluence via MCP or copy-paste (same page).
- **Kiro Web:** cloud sandboxes, coordinates changes across GitHub/GitLab repos and opens PRs; "MCP and other governance controls are not yet supported" for cloud sessions ([FAQ](https://kiro.dev/faq)).
- **Chat (Crew):** Slack DM threads = sessions, Block Kit approval buttons, channel modes `mention`/`observe`; gateway "locked to `KIROCREW_OWNER_ID`… Non-owner messages are silently dropped" ([Crew Slack](https://kiro.dev/docs/crew/interfaces/slack.md)). Crew 0.8 (Sep 27 2026) "Crewmate Teams" group *agent* crewmates; PR watches wake on review requests ([0.8](https://kiro.dev/changelog/crew/0-8)). Signed audit log ([FAQ](https://kiro.dev/faq)).
- **Identity/billing:** "each developer needs their own subscription"; IAM Identity Center for enterprise ([FAQ](https://kiro.dev/faq)).

### AWS AI-DLC
Methodology published Jul 31 2025: AI plans, asks, implements after human validation; Inception via "Mob Elaboration – where the entire team actively validates AI's questions and proposals", Construction via "Mob Construction"; sprints → "bolts", epics → "Units of Work"; context persisted to repo ([AWS blog](https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/)). Engine v2.11.x (preview builds Oct 2026) runs in Claude Code, Kiro, Codex, Cursor, opencode, Copilot; "14 agents… Human approval gates… 131-event audit trail" ([README](https://github.com/awslabs/aidlc-workflows); [releases](https://github.com/awslabs/aidlc-workflows/releases)).
- **Shared artifacts:** committed `aidlc/spaces/<space>/` with `memory/` (org.md → team.md → project.md rule chain), `knowledge/`, `intents/` registry; "a space is one team's world"; per-user gitignored cursors so "two teammates can sit in different intents at the same time" ([spaces & intents](https://github.com/awslabs/aidlc-workflows/blob/main/docs/guide/03-spaces-and-intents.md)). Tier-2 team knowledge + DocumentKB for PRDs/policies ([knowledge](https://github.com/awslabs/aidlc-workflows/blob/main/docs/guide/08-knowledge.md)).
- **Roles & rituals:** Integration lead (Inception on main, monitors claims, presents merge gates, lands Units), Unit team (claims one dependency-ready Unit), Review group; workshop scope for facilitated group sessions ([workshop mode](https://github.com/awslabs/aidlc-workflows/blob/main/docs/guide/workshop-mode.md); [facilitator guide](https://github.com/awslabs/aidlc-workflows/blob/main/docs/guide/facilitator-guide.md)).
- **Claims/conflicts:** claims are git refs `refs/heads/claim/<intent-id8>/<unit>`; "Exactly one concurrent claimant wins"; handoff via `aidlc unit adopt`; `publish` → `pin` (records exact OID + evidence) → human merge gate → `land`. Land refuses on "contract drift", aborts on real source conflicts, refuses clean merges whose result differs from the pinned candidate; team-submitted receipts are "team assertions" re-verified at pin ([workshop mode](https://github.com/awslabs/aidlc-workflows/blob/main/docs/guide/workshop-mode.md)). Team ownership unavailable for cross-repo work (same).
- **Tracker:** unofficial guidance: "A connected tracker can also provide context; agree which record is authoritative" ([mobelaboration.com](https://mobelaboration.com/ai-dlc), third-party). No first-party Jira/Linear/Slack integration found [UNVERIFIED absence].

### BMAD Method
"Agile Ai Driven Development"; v6.0.0 released Feb 17 2026, stable v6.12 (Sep 2026), v7 preview alpha with ETA Oct 16 2026 ([README](https://github.com/bmad-code-org/BMAD-METHOD); [releases](https://github.com/bmad-code-org/BMAD-METHOD/releases)).
- **Personas (changing):** v6.3.0 (Apr 2026) "Consolidate three agent personas into Developer agent (Amelia): remove… Bob Scrum Master"; v6.11 deprecates `bmad-create-story`/`bmad-dev-story` (Phase 4 = sprint-planning → build → code-review) and removes `bmad-shard-doc` outright; unreleased v7: "Sofia the Product Owner (`bmad-agent-po`) replaces `bmad-spec`, `bmad-ticket` and `bmad-correct-course`" ([CHANGELOG](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/CHANGELOG.md)). Story sharding and the SM persona — BMAD's classic handoff artifacts — are therefore deprecated/removed.
- **Shared artifacts:** `sprint-status.yaml` (retro action items carried in it), `stories.yaml` contract ("deliberately no `status`"), ticket tree under initiative folders ([CHANGELOG](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/CHANGELOG.md)).
- **Tracker:** PO ticketing "store" starters: github, jira, linear, notion, trello, repo ([skill config dir](https://github.com/bmad-code-org/BMAD-METHOD/tree/main/skills/bmad-agent-po/config); [store setup](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/skills/bmad-agent-po/references/store-setup.md)).
- **Team adoption:** committed `_bmad/custom/*.toml` overrides inherited "on pull", personal `.user.toml` gitignored; `on_complete`/`external_handoffs` publish PRDs/briefs to Confluence/Notion and offer Jira epics; "Creating a Jira epic is visible to the team, so confirm first" ([team doc](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/docs/customize/adopt-bmad-across-a-team.md)).
- **Agent↔agent:** party mode (multi-persona rooms; modes auto/session/subagent/agent-team; persistent party memory); fix noting Claude Code Agent Teams are "mailbox-style, not… broadcast" ([CHANGELOG](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/CHANGELOG.md)).
- **Parallelism:** "Remove spec-wip.md singleton… enabling parallel sessions" (v6.3) ([CHANGELOG](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/CHANGELOG.md)); no human claim/lock mechanism found.

### OpenSpec
Lightweight change-proposal SDD: `openspec/changes/<name>/` (proposal.md, delta specs, design.md, tasks.md) folded into `openspec/specs/` on archive ([README](https://github.com/Fission-AI/OpenSpec)).
- **Review:** convention-only: branch per change, "the PR contains the spec delta AND the code"; reviewer reads proposal → delta → code; "OpenSpec doesn't touch git… Everything below is convention, not enforcement" ([team-workflow](https://github.com/Fission-AI/OpenSpec/blob/main/docs/team-workflow.md)).
- **Parallel work:** "One change, one owner"; "The one place conflicts show up is `specs/`"; archive after merge recommended (same).
- **Known conflict defect:** delta records only new text of a MODIFIED requirement, so a second archiver "silently overwrites the first author's edit"; reproduced on v1.14.1 (Oct 6 2026); third-party `concord overlap/check` detects multi-change claims on the same requirement; advisory overlap reporting proposed upstream (#1698) ([issue #1387](https://github.com/Fission-AI/OpenSpec/issues/1387); [parallel merge plan](https://github.com/Fission-AI/OpenSpec/blob/main/openspec-parallel-merge-plan.md)).
- **Cross-repo/team:** Stores (beta): planning in its own repo shared by git, "Specs and changes get branches and pull requests the same way code does"; platform team owns specs, product teams reference read-only ([stores](https://openspec.dev/docs/stores)).
- No tracker/chat/KB/release integration in core [UNVERIFIED absence]; README points to community schemas for tool integrations.

### Tessl
Launched framework + spec registry Sep 2025 ([Tessl blog](https://tessl.io/blog/tessl-launches-spec-driven-framework-and-registry)); Böckeler documented spec-as-source with `// GENERATED FROM SPEC - DO NOT EDIT`, 1:1 spec-to-file ([Fowler](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)). By Oct 2026 the homepage positions Tessl as "the agent enablement platform": org-wide skill registry, activation visibility, before/after evals, security scanning; "Org-wide policy gating and audit logs are rolling out for enterprise plans"; automated code-review loop on PRs ([tessl.io](https://tessl.io/)). Multi-human spec review/ownership mechanics not documented [UNVERIFIED].

### Agent OS v3 (Builder Methods)
v3 (Jan 2026) refocuses on standards: `/discover-standards`, `/inject-standards`, `index.yml`, `/shape-spec` in plan mode; profiles keep only `standards/`; sync script pushes project standards back to base profiles ([releases](https://github.com/buildermethods/agent-os/releases); [migration](https://buildermethods.com/agent-os/migration)). Claims "Team alignment" ([site](https://buildermethods.com/agent-os)); sharing is via profiles/files; no tracker, review, or claim mechanics found [UNVERIFIED absence].

### obra/superpowers
Skills methodology by Jesse Vincent / Prime Radiant: brainstorming → using-git-worktrees → writing-plans → subagent-driven-development (two-stage review) → TDD → requesting-code-review → finishing-a-development-branch ("merge/PR/keep/discard") ([README](https://github.com/obra/superpowers)). "Collaboration" skills are human↔agent and agent↔agent (dispatching-parallel-agents, receiving-code-review); no multi-human, tracker, or chat features. Effectively single-developer; commercial support via Prime Radiant (same).

### Every Compound Engineering
36 skills, 14 hosts; loop brainstorm → plan → work → simplify → review → compound; learnings in `docs/solutions/`; `/lfg` runs end-to-end, opens PR, watches CI, "does not merge unless you grant that" ([README](https://github.com/EveryInc/compound-engineering-plugin)).
- **Team knowledge:** experimental Compound Packs — ref-pinned git repos of prescriptive rules that plan grounds in and review enforces, cited per rule ([packs](https://github.com/EveryInc/compound-engineering-plugin/blob/main/docs/guides/packs.md)).
- **Human↔human:** `ce-proof` publishes markdown to Proof, "a real-time markdown editor where humans and agents work in the same document"; local file stays canonical ([ce-proof](https://github.com/EveryInc/compound-engineering-plugin/blob/main/docs/guides/ce-proof.md)). `ce-handoff` writes an immutable session snapshot for a fresh agent ([ce-handoff](https://github.com/EveryInc/compound-engineering-plugin/blob/main/docs/guides/ce-handoff.md)).
- **Announcements:** `ce-promote` drafts X/LinkedIn/email/blog/changelog copy after merge; "It never posts… Posting stays a human action" ([ce-promote](https://github.com/EveryInc/compound-engineering-plugin/blob/main/docs/guides/ce-promote.md)). Only framework found with built-in customer-facing announcement drafting.

### GSD Core (other notable peer)
`gsd-build/get-shit-done` (≈64k stars) moved to `open-gsd/gsd-core` ([redirect](https://github.com/gsd-build/get-shit-done)). Parallel waves of fresh-context executors; "Ship — create the PR, archive the phase" ([README](https://github.com/open-gsd/gsd-core)). `/gsd-workstreams` isolates concurrent milestone areas; optional GitHub issue "for team visibility"; `MILESTONE-SUMMARY.md` "for team onboarding and stakeholder review"; strict mode to publish PRs without planning artifacts ([FEATURES](https://github.com/open-gsd/gsd-core/blob/main/docs/FEATURES.md)).

### Thoughtworks Radar & martinfowler.com
- Böckeler (Oct 15 2025): three levels spec-first / spec-anchored / spec-as-source; Kiro "like using a sledgehammer to crack a nut"; Spec Kit markdown "verbose and tedious to review… I'd rather review code"; "False sense of control"; asks whether developers or product people are the intended users; MDD parallel ([article](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)).
- Radar Vol 33 (Nov 2025): SDD **Assess**; "unclear who their intended user is"; possible "bitter lesson" ([blip](https://www.thoughtworks.com/en-us/radar/techniques/spec-driven-development)).
- Radar Vol 34 (Apr 15 2026): Spec Kit **Assess** — constitution useful; "instruction bloat" → context rot; verbose markdown; "experienced engineers… extract the most value" ([blip](https://www.thoughtworks.com/en-us/radar/languages-and-frameworks/github-spec-kit)). OpenSpec **Assess** — delta specs suit brownfield; BMAD "heavier… rigid", Kiro "vendor-specific IDE"; teams should "re-evaluate the need for SDD tooling" ([blip](https://www.thoughtworks.com/en-us/radar/tools/openspec)). Superpowers **Assess** ([blip](https://www.thoughtworks.com/en-us/radar/languages-and-frameworks/superpowers)). Vol 35 due Nov 4 2026 [UNVERIFIED; [YouTube short](https://www.youtube.com/shorts/YWEGhawmGf8)].

## 3. Cross-cutting patterns

1. **Git repo as system of record; PR as the approval meeting.** Spec Kit, Kiro, OpenSpec, superpowers, CE, GSD all store specs in-repo and rely on ordinary PR review; none ship a native multi-approver spec sign-off (Spec Kit's is a community extension; OpenSpec says "convention, not enforcement").
2. **Approval gates are single-human chat gates.** Spec Kit "review each result", Kiro per-phase review, AI-DLC `[?]` stage gates, BMAD readiness gate — gates answer "the person in this session", not a named approver. AI-DLC's pinned merge gate with Review group is the exception.
3. **Layered rules/context with team vs personal split.** Spec Kit layered constitution/presets; Kiro workspace/global/MDM "team steering"; AI-DLC org→team→project memory; BMAD committed `.toml` vs gitignored `.user.toml`; CE Compound Packs; Agent OS profiles sync.
4. **Tracker sync is bolt-on and one-directional-ish.** Spec Kit (≈10 community tracker extensions incl. two Linear), BMAD PO stores (GitHub/Jira/Linear/Notion/Trello), Kiro MCP import; AI-DLC/OpenSpec/superpowers/Agent OS none. Linear Weave makes Linear authoritative with title-prefix identity.
5. **Claims/ownership only in AI-DLC.** Git-ref claims, adopt-handoff, pin + merge gate. Others rely on "one change, one owner" (OpenSpec) or after-the-fact task syncing (Kiro "Sync Files").
6. **Parallelism means agents, not people.** Kiro task waves, GSD waves/workstreams, superpowers/CE worktrees, BMAD party mode, Kiro Crew crewmate teams.
7. **Chat is personal-agent surface, not team coordination.** Kiro Crew Slack is owner-locked; Spec Kit M365 extension ingests Teams transcripts as spec input; no framework posts status/digests to team channels natively.
8. **KB = publish target.** BMAD `external_handoffs` to Confluence/Notion, Spec Kit Confluence extension, CE Proof; local file stays canonical.
9. **Release/announcement mostly absent.** Exceptions: CE `ce-promote` (drafts only), Spec Kit community Spec Changelog / Ship Release, GSD milestone summary.
10. **Rapid churn/renames.** BMAD removes SM/story-sharding/tech-writer persona; CE `/workflows:*` → `/ce-*`; Tessl framework → skill platform; GSD repo moved; Spec Kit deprecates taskstoissues.

## 4. Weaknesses, gaps, complaints

- **Spec numbering & merge conflicts in teams (Spec Kit):** numerically incremented `specs/NNN` folders "will naturally conflict"; "No automated check 'does this satisfy BOTH spec-002-feature-A AND spec-002-feature-B?'"; one user: Jira customization means "others cannot get updates immediately"; another: "won't work with git worktrees… monorepo" ([discussion #497](https://github.com/github/spec-kit/discussions/497)).
- **Silent spec overwrite on parallel changes (OpenSpec):** reproduced on 1.14.1; overlap invisible until archive ([#1387](https://github.com/Fission-AI/OpenSpec/issues/1387)).
- **Review overload / verbosity:** Böckeler; Radar Vol 33/34 ([Fowler](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html); [Radar Spec Kit](https://www.thoughtworks.com/en-us/radar/languages-and-frameworks/github-spec-kit)).
- **Unclear role split between product and developers:** "presented as a given that a developer would do all this analysis" ([Fowler](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)); "unclear who their intended user is" ([Radar](https://www.thoughtworks.com/en-us/radar/techniques/spec-driven-development)).
- **Instruction bloat / context rot** from growing shared constitutions ([Radar](https://www.thoughtworks.com/en-us/radar/languages-and-frameworks/github-spec-kit)).
- **Agents ignore specs** ("False sense of control") ([Fowler](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)); dev in #497 reports agents not following `constitution.md`.
- **Cross-project spec management missing (Kiro):** docs recommend submodules and solicit feature requests ([Kiro](https://kiro.dev/docs/specs/best-practices/)); Kiro Web cloud sessions lack MCP/governance controls ([FAQ](https://kiro.dev/faq)).
- **AI-DLC team mode limits:** not available across repos ([workshop mode](https://github.com/awslabs/aidlc-workflows/blob/main/docs/guide/workshop-mode.md)); "most public material about it is description, not evidence" ([mobelaboration.com](https://mobelaboration.com/ai-dlc)).
- **Unproven productivity claims:** no public benchmark for compound engineering ([AI Builder Club](https://www.aibuilderclub.com/blog/compound-engineering-claude-code), secondary); Tessl "truest vision, least-proven execution" ([codemyspec](https://codemyspec.com/blog/tessl-review), secondary).
- **Ecosystem trust:** Spec Kit community extensions are unaudited ([catalog note](https://github.com/github/spec-kit/blob/main/docs/community/extensions.md)).

## 5. Sources
- https://github.com/github/spec-kit
- https://github.com/github/spec-kit/discussions/497
- https://github.com/github/spec-kit/blob/main/docs/community/extensions.md
- https://github.github.io/spec-kit/reference/extensions.html
- https://speckit-community.github.io/extensions/linear-weave
- https://github.com/ashbrener/spec-kit-linear-sync
- https://developer.microsoft.com/blog/from-spec-first-to-enterprise-ready-extending-github-spec-kit/
- https://kiro.dev/docs/steering/
- https://kiro.dev/docs/specs/best-practices/
- https://kiro.dev/docs/hooks.md
- https://kiro.dev/faq
- https://kiro.dev/changelog/crew/0-1/
- https://kiro.dev/changelog/crew/0-8
- https://kiro.dev/docs/crew/interfaces/slack.md
- https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle/
- https://github.com/awslabs/aidlc-workflows
- https://github.com/awslabs/aidlc-workflows/releases
- https://github.com/awslabs/aidlc-workflows/blob/main/docs/guide/workshop-mode.md
- https://github.com/awslabs/aidlc-workflows/blob/main/docs/guide/03-spaces-and-intents.md
- https://github.com/awslabs/aidlc-workflows/blob/main/docs/guide/08-knowledge.md
- https://github.com/awslabs/aidlc-workflows/blob/main/docs/guide/facilitator-guide.md
- https://mobelaboration.com/ai-dlc
- https://github.com/bmad-code-org/BMAD-METHOD
- https://github.com/bmad-code-org/BMAD-METHOD/releases
- https://github.com/bmad-code-org/BMAD-METHOD/blob/main/CHANGELOG.md
- https://github.com/bmad-code-org/BMAD-METHOD/blob/main/docs/customize/adopt-bmad-across-a-team.md
- https://github.com/bmad-code-org/BMAD-METHOD/blob/main/skills/bmad-agent-po/references/store-setup.md
- https://github.com/Fission-AI/OpenSpec
- https://github.com/Fission-AI/OpenSpec/blob/main/docs/team-workflow.md
- https://github.com/Fission-AI/OpenSpec/issues/1387
- https://github.com/Fission-AI/OpenSpec/blob/main/openspec-parallel-merge-plan.md
- https://openspec.dev/docs/stores
- https://tessl.io/
- https://tessl.io/blog/tessl-launches-spec-driven-framework-and-registry
- https://buildermethods.com/agent-os
- https://buildermethods.com/agent-os/migration
- https://github.com/buildermethods/agent-os/releases
- https://github.com/obra/superpowers
- https://github.com/EveryInc/compound-engineering-plugin
- https://github.com/EveryInc/compound-engineering-plugin/blob/main/docs/guides/ce-proof.md
- https://github.com/EveryInc/compound-engineering-plugin/blob/main/docs/guides/ce-handoff.md
- https://github.com/EveryInc/compound-engineering-plugin/blob/main/docs/guides/ce-promote.md
- https://github.com/EveryInc/compound-engineering-plugin/blob/main/docs/guides/packs.md
- https://github.com/gsd-build/get-shit-done
- https://github.com/open-gsd/gsd-core
- https://github.com/open-gsd/gsd-core/blob/main/docs/FEATURES.md
- https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html
- https://www.thoughtworks.com/en-us/radar/techniques/spec-driven-development
- https://www.thoughtworks.com/en-us/radar/languages-and-frameworks/github-spec-kit
- https://www.thoughtworks.com/en-us/radar/tools/openspec
- https://www.thoughtworks.com/en-us/radar/languages-and-frameworks/superpowers
- https://www.youtube.com/shorts/YWEGhawmGf8
- https://www.aibuilderclub.com/blog/compound-engineering-claude-code
- https://codemyspec.com/blog/tessl-review
