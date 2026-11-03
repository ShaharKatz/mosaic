# Session summary 2026-11-03 — multi-contributor collaboration, for picking up the 14 rulings

**What was done:**
- Researched how teams and their agents collaborate across chat (Slack), a tracker (Linear), a knowledge base (Notion), releases and customer announcements, then looked at band.ai.
- Mapped every finding onto mosaic, with recommended upgrades.
- Wrote a first-principles design of jobs, tool roles, install-time bindings and reconciliation across tools.
- Had that design challenged by a cross-family critic and a fact-check, and rewrote it.

**What is not done:** nothing is installed, and no kit file changed.

**What's next:** your rulings on the 14 questions at the end of this file; planning phase 1 waits on them.

## What exists now

| Thing | Where | State |
|---|---|---|
| Market research report | [2026-10-31-market-research.md](2026-10-31-market-research.md) | The answer to the first request, saved as delivered (only its links to session files now point to `sources/`) |
| Research evidence | [sources/research-*.md](sources/) (6 files) | One report per research slice, about 150 sources, primary sources first, dated 2026-10-31 |
| Mosaic inventories | [sources/mosaic-inventory.md](sources/mosaic-inventory.md), [sources/mosaic-mechanics.md](sources/mosaic-mechanics.md) | What `kit/` does today at commit `4deeffe`, with file and line citations |
| Report mapped to mosaic | [2026-10-31-market-research-mosaic-upgrades.md](2026-10-31-market-research-mosaic-upgrades.md) | Every table gains "Mosaic today" and "Recommended upgrade" columns; a 21-item upgrade backlog in waves, plus a rejected list |
| First-principles design, second draft | [2026-10-31-jobs-roles-surfaces.md](2026-10-31-jobs-roles-surfaces.md) | 14 principles, 7 fact classes and a transfer policy, 16 tool roles, 25 jobs, surface map and cards, agent access, approvals, reconciliation, coverage, phases, 14 questions; §16 logs the critique |
| This summary | this file | Conversation record and rulings worksheet |

## How the conversation went

1. **Market research (2026-10-31).**
   - *Asked:* how SDLC frameworks handle communication between several contributors who use Slack, Linear, a Notion-like knowledge center, releases and client-facing announcements. Look at the market independently first, then at band.ai. Pure research, before any mosaic plan.
   - *Starting point:* mosaic models one human plus one orchestrator session. Repo records are the authority, and an optional tracker gets copies. There is nothing for chat, knowledge bases, releases or customers.
   - *Method:* six research slices ran in parallel: spec-driven frameworks, agent platforms, collaboration tools, release and customer communication, process frameworks, and multi-agent coordination. I researched Linear directly through its documentation tools. band.ai came only after the market analysis, as asked. The claims the conclusions rest on were checked against the vendors' own pages.
2. **Mapping to mosaic.**
   - *Asked:* save the report in its own directory, then rewrite it with a "how mosaic is today" column and recommended upgrades, relating every non-table part to mosaic too.
   - *Done:* I saved the original and the slice reports. A read-only agent inventoried `kit/` with citations. Then I wrote the upgrades document and its backlog.
3. **First principles.**
   - *Asked:* define the jobs to be done and the roles tools play (several tools may play one role). Decide what goes where at installation; for example, if the knowledge base for X is Notion, mosaic must know that and how it's structured so the right subagents can use it. Treat reconciliation as a bigger job now that tools other than Linear are involved.
   - *Done:* a second inventory covered how installation, agents, rules and checks work, and the design document followed.
4. **"Keep going."**
   - mosaic's own critic model, `openai-codex/gpt-6-astra`, ran read-only through `omp`, alongside a separate fact-check of every claim.
   - They raised 13 challenges (3 blocking) and 16 factual errors. All were accepted, and the design was rewritten as a second draft with a change log (§16).
   - One wrong claim in the upgrade backlog was corrected.
5. **Hand-off (2026-11-03).**
   - *Asked:* commit the work so it can continue from another git account, and summarize the whole conversation.
   - *Done:* this file, committed on branch `ShaharKatz/mosaic-p2p-collaboration`.

## What the research found

- **The roles have settled; the authority hasn't.**
  - Chat is where requests arrive and work is discussed live.
  - The tracker is the control centre: ownership, agent assignment, code review and now releases.
  - The repo holds code plus agent instructions.
  - The knowledge base supplies context and receives copies.

  Every vendor still calls its own layer the system of record.
- **2026's theme is agents working in front of the team** instead of in one person's private session: Claude Tag, Slack Code, Linear coding sessions, Zed Delta, Atlassian AMP, BAND.
- **Coordinating several people's agents is the weakest layer.** Vendors isolate work in worktrees and merge it one change at a time; claims are advisory or missing. AWS AI-DLC's team mode is the only rigorous precedent among frameworks installed into a repo.
- **Release tracking is moving into trackers.** Linear Releases feeds CI deploys into the tracker and drafts notes. Customer announcements are the step least tied to evidence.
- **Mosaic's direct competitors** (Spec Kit, Kiro, BMAD, OpenSpec and others) work for one person.
- **band.ai** (Thenvoi AI, trading as BAND):
  - Funding and launch: a $17M seed on 2026-04-23; BAND for Developers, a desktop app, launched 2026-10-15.
  - What it is: a vendor-neutral room where agents and people talk.
  - What it lacks: no tracker, knowledge base, git or release support, and its approvals are conversational.
  - For mosaic: it complements mosaic rather than competing.
- **Linear now covers much of the loop itself:**
  - an agent and coding sessions;
  - Loops, its recurring agent automations;
  - Diffs, for code review;
  - Releases with AI-drafted notes;
  - Asks, for requests from Slack and email;
  - Customer Requests.

  Its MCP server already exposes releases, release notes, diffs and status updates.

## Where mosaic stands

**Already strong:**
- plan numbers reserved atomically (rule R2);
- tracker intent and overlap reports;
- one automation writer per tracker item, with handover by a person;
- landing backed by evidence;
- reviewers from two model families.

**Missing:**
- **People and approval:** a single "Human" role; approvals not tied to a plan revision.
- **Tracker coupling:** a tracker rule written in Linear's tool names, and circular source precedence.
- **Uncovered surfaces:** nothing for chat, knowledge bases, releases or customers.
- **Safety and testing:** no rule treating outside text as untrusted; a loop rig that switches MCP off.

## The design in brief

The full text is in the [design document](2026-10-31-jobs-roles-surfaces.md).
- **Principles:**
  - one authority per fact;
  - authority follows the kind of fact;
  - one writer per field;
  - roles, not tools;
  - chat is never the record;
  - people decide;
  - outside text is data;
  - copies are marked and verified;
  - outgoing messages are journaled first;
  - know the pipes;
  - decide at install;
  - least privilege;
  - degrade without blocking;
  - reading is not permission to redistribute.
- **Where facts live:**
  - governing records → repo;
  - source materials (PRDs, meeting notes, customer requests) → the authors' tools, pinned by plans;
  - coordination state → the home tracker;
  - evidence → the system that produced it;
  - communications → approved text in the repo.

  A transfer policy says where each sensitivity level may be copied.
- **Installation decides a surface map.** Each role and domain is bound to a concrete place in a concrete tool. One short card per surface says where things are, how to ask, what mosaic may do, what the tool can guarantee, which integrations exist and who writes each field. Five new rulings drive it: H-surfaces, H-people, H-release, H-pipes, H-transfer.
- **Approvals:**
  - An approval is a verifiable human action approving the hash of the plan's scope, tasks, `files:`, acceptance and pins.
  - Messages relayed from chat don't count.
  - Approvals are re-checked at execution start and at sign-off.
- **Reconciliation:**
  - Outgoing messages are written to a journal in the repo before sending.
  - Reads are saved as checked envelopes.
  - Mosaic writes automatically only where the tool can make a retry safe; everything else becomes a finding.
  - Only the orchestrator calls outside tools until each runtime can enforce per-agent limits.
- **Releases:** something counts as released only with deploy proof for every component it touches, per environment and audience, with rollbacks handled.
- **Phases:**
  1. Foundations: one tracker, named people and versioned approvals, claims and handoff, read-only knowledge sources, reconciliation run by a person, test fixtures.
  2. Releases.
  3. Publishing and announcements.
  4. Scheduled and multi-tool operation.

**What the critique changed most:**
- the approval evidence contract;
- the transfer policy;
- keeping outside-tool access to the orchestrator;
- the event journal and observation envelopes;
- write rules gated on what each tool can do;
- delivery-based release proof;
- the migration path;
- fake tool servers for the loop rig;
- a smaller first deliverable.

## Rulings worksheet

Each question is defined in [§14 of the design](2026-10-31-jobs-roles-surfaces.md#14-questions-that-need-a-human-ruling). Write your answer in the Ruling column; the next draft of the design will apply the rulings.

| # | Question | Proposed answer | Ruling |
|---|---|---|---|
| 1 | Do PRDs stay in the knowledge base as source materials that plans pin, or are they ingested into the repo's product docs? | Stay in the knowledge base; plans pin them | |
| 2 | Is the roster a static file, or derived from tracker and code-host teams? | Static file for decision roles | |
| 3 | Which places may carry an approval? | Session, PR review, tracker comment under the evidence contract; chat later | |
| 4 | Who writes copies to outside tools? | The orchestrator only; revisit once per-agent limits exist | |
| 5 | Where do surface cards live, and which record class are they? | `docs/surfaces/`, Registry class | |
| 6 | How are release records grouped? | One per scheduled release; one per window for continuous pipelines (e.g. daily) | |
| 7 | Who runs reconciliation, and when? | A person, in phase 1; checkup and CI later, after a ruling | |
| 8 | When do several trackers get supported? | Phase 4 | |
| 9 | Who owns each tracker's workflow-state field? | The tracker's own automations, wherever they are configured | |
| 10 | Which destinations does each sensitivity level allow, and which levels may go to model providers? | The default matrix in §3.1 of the design; your call on model providers | |
| 11 | Should mosaic ever publish to customer channels itself? | No; people publish | |
| 12 | How much tool structure do cards record, versus re-checking on demand? | Your call | |
| 13 | Is §12.1's phasing right, with phase 1 as the first deliverable? | Yes | |
| 14 | May an approval proceed on a source with no retrievable version and no allowed capture? | Yes, if the approval says so explicitly | |

## How to pick this up

1. **Fetch the branch** from the other account (it needs access to `ShaharKatz/mosaic`):
   `git fetch origin ShaharKatz/mosaic-p2p-collaboration && git switch ShaharKatz/mosaic-p2p-collaboration`.
2. **Read, in this order:**
   - this file;
   - the design's Summary, §12.1 (phases) and §14 (questions);
   - then, as needed, the design's §16 (critique log), the upgrades document, and `sources/`.
3. **Fill in the Ruling column above.** Then ask for the next draft of the design to apply them.
4. **After the rulings:** write a phase-1 build contract, the way [round2-build-contract.md](../round2-build-contract.md) did for the earlier rounds.
   - It covers kit changes plus new loop scenarios, and the loop-rig fakes come first because every phase-1 scenario depends on them.
   - Product changes go in `kit/`, per the repository README.

## Practical notes

- **Re-running the critic:**
  `omp -p --model openai-codex/gpt-6-astra --thinking max --tools read,grep,glob --no-session --no-skills @<brief.md>`
  It runs read-only. The model roles come from `kit/.omp/config.yml`: critic `gpt-6-astra`, reviewers `opus-5-5` and `gpt-6-sol`.
- **Dates:** market facts are dated 2026-10-31, and the tool landscape is churning, so re-verify vendor details before building on them. Mosaic facts describe `kit/` at commit `4deeffe`.
- **Pending verification:** the design records two items as needing verification before relying on them.
  - Whether each runtime can enforce per-agent MCP limits.
  - Which tracker comment fields expose relayed or on-behalf-of authorship on tools other than Linear.
