# Multi-contributor SDLC collaboration: market research (as of 2026-10-31)

## Bottom line

- **The way teams split work across tools has settled, but no tool settles which one holds the truth.**
  - Slack is where requests arrive and work is discussed live.
  - The tracker (Linear, Jira, GitHub) is the control centre: who owns what, agent assignment, code review, and now releases.
  - The repo holds the code plus the agents' instructions (AGENTS.md, skills).
  - Notion or Confluence supplies context and receives published copies.
  - Each vendor still says its own layer is the system of record, and no product reconciles them.
- **2026's theme is moving agents from one person's private session into the team's view.** Claude Tag (06-23), Linear coding sessions (06-11), Slack Code (08-20), Zed Delta (09-16), Atlassian AMP (10-07), BAND for Developers (10-15). Atlassian's CEO put it this way: "The agent experience is largely single player today." That is the same limit mosaic has.
- **Coordinating several people's agents is the weakest part of the market.**
  - Vendors give each agent its own worktree or sandbox, then merge one at a time through merge queues and stacked PRs.
  - Claiming work is advisory or missing, and no standard covers it.
  - Among frameworks installed into the repo, only AWS AI-DLC has real team claims, handoff and a merge gate.
- **Release tracking is moving into the tracker; customer announcements remain weak.**
  - Linear Releases takes deploy events from CI and marks an issue Done when the change ships, not when it merges.
  - It drafts release notes with AI and keeps a changelog per pipeline.
  - Customer announcements are AI drafts written from ticket text. Nothing ties them to evidence that the change actually shipped.
- **Mosaic's direct competitors work for one person.** Spec Kit, Kiro, BMAD, OpenSpec, superpowers and Compound Engineering approve through a PR or by the one person in the chat. Tracker, Slack and Notion support comes from community add-ons, and release support is almost absent.
- **band.ai is a vendor-neutral room where agents and people talk to each other.** It does not cover the tracker, knowledge base, git, releases or announcements, and its approvals are conversational, not enforced.

Method: seven research slices run in parallel, about 150 sources, primary sources first. I re-checked the claims the conclusions rest on against the vendors' own pages: Linear docs and changelog, Slack Code, Claude Tag, Atlassian AMP, AI-DLC team mode, GitHub stacked PRs, Zed Delta, and band.ai. The full per-slice reports with every source are in [`sources/`](sources/): [spec frameworks](sources/research-spec-frameworks.md), [agent platforms](sources/research-agent-platforms.md), [collaboration tools](sources/research-collab-tools.md), [release communication](sources/research-release-comms.md), [process frameworks](sources/research-process-frameworks.md) and [multi-agent coordination](sources/research-multi-agent.md).

---

## 1. Market map

| Segment | Main products | What it does in the team's workflow | How well it handles several people |
|---|---|---|---|
| Tracker as control centre | Linear, Jira/Rovo, GitHub (Agent HQ), GitLab Duo | Intake, ownership, agent assignment, code review, releases, status | High; changing fastest |
| Chat as the workroom | Slack Code and Slackbot, Claude Tag, Devin/Factory task channels, MS Teams | Where requests arrive; live steering; approvals; digests | Good visibility; weak lasting record |
| Knowledge and context | Notion 3.x agents, Confluence/Rovo, Glean, Unblocked, Dosu, DeepWiki | Context for agents; meeting notes into the tracker; auto-generated docs | Medium; the knowledge base is a copy, not the source |
| Cloud coding agents | Devin, Cursor, Codex, Copilot, Factory, Amp, Augment, Warp, Ona, Charlie | Do delegated work and report back where it was asked | Medium; each has different rules on identity and who may steer |
| Frameworks installed in the repo (mosaic's direct competitors) | Spec Kit, Kiro, AWS AI-DLC, BMAD, OpenSpec, superpowers, Compound Engineering, GSD, Agent OS | Process, specs and approval gates inside the repo | Low; AI-DLC is the exception |
| Coordination layers | MCP Agent Mail, Beads/Gas Town, Claude Code agent teams, Conductor Cloud, Zed Delta, BAND | Claims, inboxes, shared rooms, handoff | Low to medium; mostly one person's agents |
| Release and customer communication | release-please, Changesets, Copilot Release Notes, Linear Releases, LaunchDarkly, LaunchNotes, Productlane, Featurebase, Canny, Statuspage/incident.io | Release notes, rollout, announcements, feedback | Notes are mature; announcements tied to evidence don't exist |
| Process frameworks | Scrum and "AI and Scrum" 2026.1, AI-Native SAFe, Shape Up, Team Topologies, DORA 2025, GitLab handbook, Apache Way, RFC/ADR processes, Amazon PR/FAQ | Where decisions live, cadence, accountability | Mature rules; nothing on syncing tools or on agents claiming work |

## 2. Where each kind of communication lives in 2026

| Concern | Usual home | Examples | Weak spot |
|---|---|---|---|
| Intake | Chat, email or form → tracker triage, with the thread synced back to the requester | Linear Asks (Slack, email, web), `@GitHub` creating issues from Slack, Intercom → Linear | Treating a whole thread as the spec invites prompt injection |
| Ownership | Tracker: a human assignee plus an agent "delegate" | Linear's delegate model, agents as Jira assignees, assigning issues to Copilot | A second person delegating can start a parallel session (Devin, Codex) |
| Specs and decisions | Repo (spec or ADR reviewed in a PR) or knowledge base | Spec Kit, OpenSpec, AI-DLC; BMAD and Jira Planner publishing to Confluence/Notion | One-person approval gates; specs collide |
| Live work and steering | A chat room per task, or a session attached to the tracker issue | Slack Code, Claude Tag, Devin/Factory channels, Linear coding sessions, BAND rooms | Who may steer someone else's agent differs by product |
| Coordination | Each agent isolated, merges serialized | Worktrees and sandboxes, merge queue, stacked PRs, AI-DLC claims | No claims across tools; no standard |
| Review and approval | PR (GitHub or Linear Diffs) plus approvals in the channel | Guided reviews, risk scores, an extra approval required for agent PRs | Review is the bottleneck |
| Team knowledge | Versioned files in the repo plus tools that index everything | AGENTS.md, skills, GitHub "Dreaming" proposing rule changes as PRs, Unblocked, Dosu | Decisions made in chat rarely become formal records |
| Status and digests | Tracker updates pushed into Slack | Linear's agent-drafted project updates and Pulse feed, Slack Recaps, Loops weekly digests | Noise from many agents in Slack |
| Release | CI → a release in the tracker → AI notes, or a pending "release PR" | Linear Releases, Jira+Rovo, release-please, Changesets | Notes built from commit messages are noisy |
| Customer announcements | Changelog and announcement tools, support tools | LaunchNotes, Productlane, Featurebase, Linear Loops, Claude Tag | Not tied to evidence of what shipped; versions for different audiences drift apart |
| Customer feedback | Support and feedback tools synced both ways with the tracker | Linear Customer Requests, Featurebase emailing voters, Intercom reopening conversations | Fairly mature |

## 3. Findings

1. **Chat is where requests come in; the record is kept elsewhere.**
   - **Process rules agree on this.** GitLab keeps Slack for only 90 days, bans it for approvals and decisions, and treats the issue description as the single source of truth ([handbook](https://handbook.gitlab.com/handbook/communication/)). Apache: "if it didn't happen on the mailing list, it didn't happen." Amazon decides on written narratives.
   - **The tools follow.** Linear syncs Slack threads into issues and project-update comments in both directions ([docs](https://linear.app/docs/slack)). It tells agents to report through typed activity entries rather than comments, because comments can be edited.
   - **Vendors still each claim to be the record.** Jira says it is "where agents own meaningful parts of work". Notion calls itself "a durable shared place". Slack says the conversation is the real work.

2. **Agent work done in front of the team is 2026's headline.**
   - Slack Code gives one channel per task, visible to the team. People can see diffs and redirect the agent, risky changes can be sent to a person for approval, and the channel archives itself as an audit log ([Slack](https://slack.com/blog/news/slack-code-channels-for-agents)). Slack reports that more than 70% of these channels open and close within a day.
   - Claude Tag puts one shared @Claude in each channel, and admins see a log of who asked for each task ([Anthropic](https://www.anthropic.com/news/introducing-claude-tag)). Anthropic says 65% of its product team's code comes from its internal version.
   - Zed Delta replicates the agent conversation and the working tree together. Zed turned off pull requests on Delta's own repo; 33 people have since landed 570 changes ([Zed](https://zed.dev/blog/delta-public-beta)).
   - Atlassian AMP gives every agent a named owner and shows agents next to people in presence bars ([Computer Weekly](https://www.computerweekly.com/news/366652013/Atlassian-Team-26-Europe-move-to-AI-as-team-sport-with-multi-player-agentic-system)).

3. **Every product handles requests the same way; they differ on identity and steering rights.**
   - **The common loop:** mention or assign the agent, it runs a session, reports progress in the same place, and finishes with a PR and a session link. The whole thread is the spec.
   - **Identity depends on where you ask.** In a shared channel the agent acts as a service account; in a DM it acts as the requester.
   - **Risks the vendors document themselves:**
     - Cursor's team follow-ups allow "lateral movement" into a more privileged colleague's secrets.
     - The person who requested a Factory PR can be its only approver.
     - GitHub blocks you from approving a Copilot PR you assigned, and requires an extra approval for unattributed PRs.
     - GitLab gives agents only the access that both the triggering user and the service account have.

4. **The industry agrees that the agent acts on a person's behalf and the person stays accountable.**
   - Linear's Agent Interaction Guidelines: "An agent cannot be held accountable" ([AIG](https://linear.app/developers/aig)).
   - Scrum's "AI and Scrum" 2026.1: "AI may recommend, but humans decide."
   - Team Topologies: every agent should be governed by a long-lived team.
   - Apache asks for `Generated-by:` commit trailers.
   - Linear Diffs marks review comments an agent wrote on someone's behalf.

5. **Coordinating several contributors is the weakest layer.**
   - **Most tools serve one developer's parallel agents.** Claude Code agent teams allow one team per session, and two teammates editing the same file "leads to overwrites".
   - **Where claims exist, they are advisory or only local.** Agent Mail uses time-limited advisory leases on files; Beads has an atomic `--claim`.
   - **Known collision bugs:**
     - Spec Kit numbers spec folders 001, 002…, so teammates collide ([#497](https://github.com/github/spec-kit/discussions/497)).
     - OpenSpec silently overwrites a teammate's requirement edit when the second change is archived ([#1387](https://github.com/Fission-AI/OpenSpec/issues/1387)).
     - OpenAI Symphony keeps its claims only in memory, so they are lost on restart.
   - **AWS AI-DLC team mode is the one rigorous precedent installed in the repo** ([workshop mode](https://github.com/awslabs/aidlc-workflows/blob/main/docs/guide/workshop-mode.md)):
     - Roles are integration lead, unit team and review group.
     - Claims are git refs, and "exactly one concurrent claimant wins".
     - `adopt` hands an in-progress claim to a teammate.
     - Work goes publish → pin (exact commit plus evidence) → human merge gate → land.
     - It does not work across repos yet.
   - MCP, A2A, ACP, AGENTS.md and Agent Skills cover plumbing; none defines claims or ownership. This is my inference from reading the specs.

6. **Review is the bottleneck.**
   - Faros: 98% more merged PRs but 91% more review time ([Faros](https://www.faros.ai/blog/ai-software-engineering)).
   - DORA 2025: AI "amplifies what's already there". Throughput and instability rise together, and rework rate became a fifth metric.
   - Thoughtworks Radar Vol 34: "codebase cognitive debt" gets worse with several contributors.
   - **Vendors are responding at the review step.**
     - Linear has Guided Reviews, a risk-score plugin, and `.gitattributes` categories for grouping files, including `review-agent-guidance`.
     - GitHub stacked PRs went GA on 2026-10-06; a stack goes through the merge queue as one group ([GitHub](https://github.blog/changelog/2026-10-06-stacked-pull-requests-generally-available/)).
     - Cursor bought Graphite.

7. **Team knowledge is moving into versioned files; the knowledge base becomes a copy.**
   - Cursor dropped Memories in favour of Rules. Devin is moving Knowledge to Skills and Plugins.
   - GitHub "Dreaming" proposes edits to skills and instructions as PRs. Thoughtworks Radar lists shared instruction files as "Adopt".
   - Capturing decisions from chat means automated summaries, such as Notion's agents triggered by meeting notes and Unblocked/Dosu indexing. Nobody produces formal decision records with a human ruling.

8. **Release tracking is moving into the tracker.**
   - **Linear Releases** ([docs](https://linear.app/docs/releases)), launched 2026-04-30:
     - A CI action reads issue IDs from commit messages.
     - Pipelines are continuous or scheduled, with path filters for monorepos.
     - On merge the issue moves to "Merged"; when the release completes it moves to Done. That transition "triggers integration automations… when changes are available to customers".
     - Linear Agent drafts the release notes, and each pipeline keeps a changelog.
   - **On the repo side,** the human gate is a pending release PR (release-please, Changesets). Copilot Release Notes lists entries it is unsure of separately for a person to check.
   - **Linear's MCP server, mounted in this session,** already lets outside agents read and write releases, release notes, PR diffs, merges, status updates and agent skills.

9. **Customer announcements are the step least connected to evidence.**
   - **Drafts come from ticket text:**
     - Productlane drafts a changelog when a Linear project completes.
     - Linear's "Loops" automation has a template that writes "user-facing messaging that Support can share".
     - Claude Tag posts to #announcements with a "sent on behalf of" line.
     - Compound Engineering's `ce-promote` drafts copy but "never posts".
   - **LaunchNotes' own guidance** is one canonical record, split per audience only when the action the reader must take differs; otherwise the versions drift apart ([LaunchNotes](https://www.launchnotes.com/release-notes/audiences)).
   - **No product I found links what customers are told to what was verified to ship.** No slice found one.

10. **High churn and usage-based billing.**
    - **Shut down or absorbed in the past year:**
      - Google Jules shuts down on 2026-12-31; Vibe Kanban and Terragon closed.
      - Standalone Rovo Dev was folded into Jira, and Windsurf became Devin Desktop.
      - Claude in Slack became Claude Tag; Codex in Slack moved to @ChatGPT.
      - Cursor Memories and Devin Knowledge were dropped.
      - Atlassian Compass is moving to DX; Statsig went to OpenAI, then Amplitude.
    - **Agent work is billed by credits:** Linear, Notion, Rovo. One user reported about 760 Rovo credits for a single PR review.
    - **Durable pieces:** the open standards now under the Linux Foundation's Agentic AI Foundation (MCP, AGENTS.md, A2A) and files in the repo. This is my inference.
    - **Shared surfaces add risk.** Notion 3.0 agents could be tricked into leaking data, and a public GitHub issue could make the GitHub MCP server leak private-repo data.
    - **Slack throttles apps not listed in its Marketplace** to one message-history request per minute.

## 4. Gaps nobody fills yet

- **Which surface owns which fact.** No one declares, for each kind of fact, whether chat, tracker, knowledge base or repo is authoritative, and then detects drift between them.
- **Claims and handoff across several people.** AI-DLC works in one repo only, Symphony's claims vanish on restart, and BAND tasks allow several assignees. There is no standard.
- **Release → announcement backed by evidence.** No chain runs from landing/verification evidence to release notes to per-audience announcements, with approval and provenance at each step.
- **Chat decisions into formal records.** Tools summarize and index chat. None turns a decision into a record with a lifecycle and a named decider, as ADR, KEP and RFD processes do.
- **More than one approver for agent output.** Gates answer to whoever is in the session. Named reviewers, quorum, and time-boxed lazy consensus (Apache's 72 hours, Rust's final comment period) aren't built into any product for agent plans.
- **Reducing review load with structured evidence.** Guided reviews and risk scores are early steps; reviewing is where the cost lands.

---

## 5. band.ai

### What it is
- **Company.** Thenvoi AI Ltd, trading as BAND. CEO Arick Goomanovsky, CTO Vlad Luzin. Came out of stealth on 2026-04-23 with a [$17M seed](https://www.prnewswire.com/il/news-releases/band-exits-stealth-with-17m-to-build-the-communication-and-interaction-layers-for-the-internet-of-agents-302751810.html) (Sierra, Hetz, Team8). [BAND for Developers](https://www.prnewswire.com/il/news-releases/band-launches-band-for-developers-to-support-the-transformation-of-sdlc-collaboration-and-control-of-multiple-coding-agents-302909844.html) launched 2026-10-15: free to start, macOS/Windows/Linux, plus a VS Code extension. The public customer story is Qodo's "Dark Factory".
- **[Platform](https://www.band.ai/platform).** Two layers: a collaboration layer ("Agentic Mesh") and a governance layer ("Interaction Control Plane"). Pieces:
  - Persistent identities for agents.
  - Rooms where people and agents are both participants.
  - @mention routing: an agent that isn't mentioned never receives the message; people see everything.
  - Delivery tracking per agent and contacts across organizations.
  - A memory API with store, supersede and archive.
  - Room and organization roles, and an audit trail.
  - Bridges: a Python/TypeScript SDK (`band-sdk` 6.0.1) with about 20 framework adapters, A2A, ACP, MCP (platform actions only), a Slack adapter, and self-hosting for Enterprise.
- **[Band Desktop](https://docs.band.ai/band-desktop.md)** (formerly "Jam") connects local coding agents and central organization agents into rooms. Supported agents:
  - Claude Code through the `band-peer` plugin (`/jam as <role>`).
  - Codex, Copilot, OpenCode and Antigravity.
  - Cursor and Gemini CLI through ACP.

  Each room has:
  - A plan plus diagram.
  - A task board with append-only history.
  - A "Needs your response" queue.
  - The agents' own permission prompts.
  - Cost per agent.
  - Reusable agent teams.

  The pitch is "stop being the go-between": the planner and reviewer stay in the room, and review findings survive context compaction.

### Against the surfaces you named

| Surface | What BAND covers |
|---|---|
| Slack | Its own rooms are the chat. The Python-only `SlackAdapter` links a Slack thread to a room for one agent; the Slack person is not a room participant ([docs](https://docs.band.ai/integrate/slack.md)) |
| Linear | No integration. A task has an opaque `linked_native_id` field |
| Notion | None. The memory API is agent memory, not a team knowledge base |
| Git, review, merge | Out of scope by design: "you provide source access, worktrees, branches… conflict handling, and the merge" ([docs](https://docs.band.ai/understand/when-to-use-band.md)) |
| Approvals | Approving by @mention is "not a security boundary"; whether an agent obeys "depends on its model and instructions" ([docs](https://docs.band.ai/features/human-in-the-loop.md)). Only the coding agent's own permission prompts are enforced, by the coding agent |
| Releases and announcements | None |
| Several people | Yes: teammates' agents share rooms, an agent's owner can read any room it's in, and rooms have roles ([docs](https://docs.band.ai/security/permissions-and-visibility.md)) |

### Strengths
- **Works across vendors and owners.** It is the only product I found built for "my Claude Code + your Codex + an organization agent in one room" across machines and companies.
- **The room outlives any session.** That addresses two real problems: planner and reviewer agents being dismissed once coding starts, and open review findings lost when a chat is compacted.
- **Plumbing.** Routing is deterministic, task history is append-only, cost is shown per agent and per room, and it connects to the A2A, ACP and MCP standards instead of competing with them.

### Weaknesses and risks
- **Governance marketing goes further than the docs.** The site says "no lateral movement, no privilege escalation" and "approve, override". The docs say approvals are conversational, and that stopping an external agent may not stop it receiving messages.
- **No exclusive claims.** "Your first status write joins you" to a task, and several agents can work the same one ([API](https://docs.band.ai/api/agent-api/agent-api-chat-tasks/update-chat-task.md)). There is no conflict detection, and git is out of scope.
- **The Desktop plan is local.** It is not sent to SDK agents, other machines or other owners.
- **Discovery on the local network is on by default.** It announces your agents' handles, room names and cost estimates to others on the same network.
- **Young and changing.**
  - The SDK broke compatibility going from 4 to 5 to 6 within months.
  - The SDK can't send the API's "needs attention" events, and the web app can't display them.
  - It was renamed twice (Thenvoi→BAND, Jam→Desktop).
  - RuntimeWire noted the founder's answers "do not establish adoption or measured productivity gains" ([RuntimeWire](https://runtimewire.com/article/band-launches-agent-desktop-as-some-developers-build-custom--735e95)).

### Where it sits
- **Overlaps:** Slack Code and Claude Tag (rooms with agents in them), Claude Code agent teams (one person only), Conductor Cloud, MCP Agent Mail, Atlassian AMP.
- **Its bet:** the layer where agents talk is neutral infrastructure, separate from the tracker and chat vendors.
- **How it differentiates:** it compares itself to "team chat with agents", meaning Slack-style channels, which have no plans or work items. Linear already has coding sessions, delegation to agents, and a board.
- **For your four surfaces,** BAND covers only the conversation between agents and people. It is the communication channel, not the process.

---

## 6. Mosaic today against the market (no proposals)

| Capability | Best in the market | mosaic today |
|---|---|---|
| Stating which surface owns each fact | Process rules (GitLab, Apache); Linear Weave ("Linear is the source of truth") | Yes, for repo ↔ tracker only (authority/projection table in `tracker.md`) |
| Seeing overlapping work | AI-DLC claims, Agent Mail leases | Advisory `intersect` over tracker areas, plus single-writer tokens |
| Handing work between sessions or people | AI-DLC `adopt`, Conductor "Reassign" | The human hands the item over in the tracker and the writer generation increments |
| Agent acts for an accountable human | Industry consensus | Yes: the human approves plans and signs off |
| "Done" backed by evidence | Linear Releases: done = shipped | done = landing receipt on the published branch, not deployment |
| Intake rigor | Linear auto-applies its triage suggestions | Fingerprinted verdicts, an independent check by a second model family, and every outcome stops at the human |
| Chat as front door or live room | Slack Code, Claude Tag, Linear Asks, BAND | None |
| Knowledge base copy (Notion) | Notion MCP and agents, BMAD publishing | None |
| Several people with roles; more than one approver | AI-DLC lead / unit team / review group | One human plus one orchestrator |
| Status digests for stakeholders | Linear agent-drafted updates and Pulse feed | None |
| Release notes and changelog | Linear Releases, release-please | None |
| Customer announcements and feedback loop | LaunchNotes, Productlane, Linear Customer Requests | None |

## Main sources
- **Linear:** [releases](https://linear.app/docs/releases) · [coding sessions](https://linear.app/docs/coding-sessions) · [loops](https://linear.app/docs/loops) · [asks](https://linear.app/docs/linear-asks-slack) · [slack](https://linear.app/docs/slack) · [updates](https://linear.app/docs/initiative-and-project-updates) · [diffs](https://linear.app/docs/diffs) · [agents](https://linear.app/docs/agents-in-linear) · [changelog timeline](https://linear.app/changelog/timeline)
- **Platforms:**
  - Slack/Anthropic: [Slack Code](https://slack.com/blog/news/slack-code-channels-for-agents) · [Claude Tag](https://www.anthropic.com/news/introducing-claude-tag)
  - Atlassian: [AMP](https://www.computerweekly.com/news/366652013/Atlassian-Team-26-Europe-move-to-AI-as-team-sport-with-multi-player-agentic-system) · [Agents in Jira](https://www.atlassian.com/blog/announcements/ai-agents-in-jira)
  - GitHub: [Agent HQ](https://github.blog/news-insights/company-news/welcome-home-agents/) · [Universe 2026](https://github.blog/news-insights/company-news/github-universe-2026-evolving-every-layer-of-the-stack/)
  - Notion: [Notion 3.8](https://www.notion.com/releases/2026-10-13)
- **Frameworks and process:** [AI-DLC](https://github.com/awslabs/aidlc-workflows) · [Spec Kit](https://github.com/github/spec-kit) · [Fowler on spec-driven development](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html) · [Radar](https://www.thoughtworks.com/radar) · [AI and Scrum](https://scrumexpansion.org/ai-and-scrum/2026.1) · [AI-Native SAFe](https://framework.scaledagile.com/blog/safe-summit-keynote-recap-launching-the-operating-model-for-the-age-of-ai) · [DORA AI capabilities](https://cloud.google.com/blog/products/ai-machine-learning/introducing-doras-inaugural-ai-capabilities-model)
- **Coordination:** [MCP Agent Mail](https://github.com/Dicklesworthstone/mcp_agent_mail) · [Beads](https://github.com/gastownhall/beads) · [Claude Code agent teams](https://code.claude.com/docs/en/agent-teams) · [Conductor](https://www.conductor.build/docs/cloud/collaboration) · [AAIF](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation)
- **Release:** [release-please](https://github.com/googleapis/release-please) · [Changesets](https://github.com/changesets/changesets) · [Copilot Release Notes](https://github.com/github/copilot-release-notes) · [Productlane](https://productlane.com/docs/integrations/linear) · [Featurebase](https://help.featurebase.app/en/articles/6970004-linear-integration)
- **band.ai:** [site](https://www.band.ai/) · [Desktop page](https://www.band.ai/use-cases/band-desktop) · [docs index](https://docs.band.ai/llms.txt) · [Qodo story](https://www.band.ai/blog/qodo-dark-factory-delegation-collaboration)
