# Multi-agent / multiplayer coordination on one codebase — market scan (as of 2026-10-31)

Citations are bracketed numbers that point to §5. Scope labels: **1H** means one developer's parallel agents; **NH** means several humans, each with their own agents.

## 1. Coverage table

| Product / framework | Category | One-line what (scope) | Surfaces touched | Primary source |
|---|---|---|---|---|
| MCP Agent Mail (Python → Rust) | Coordination server (OSS) | Agent identities, inboxes, threads, advisory file leases, commit guard (1H by design; multi-human [UNVERIFIED]) | repo, chat-like inbox | [1][2] |
| Beads (`bd`) | Agent issue ledger (OSS) | Dolt-backed dependency graph with atomic claim (1H, or NH through Dolt server/remotes) | tracker, repo | [3] |
| Gas Town / Gas City / Wasteland | Orchestrator plus federation | Mayor/polecat/refinery fleet on Beads; Wasteland adds a shared wanted board (1H, plus NH through federation) | tracker, repo, PR | [4][5][6] |
| Claude Code subagents / agent teams / cross-session messaging / worktrees | Harness features | Lead plus teammates with a shared task list and mailbox; peer messaging between sessions (1H) | repo | [9][10][11] |
| Vibe Kanban | Kanban for agents | Task board with one worktree per task; company shut down 2026-04-10 and the project is now community OSS (NH features removed) | tracker, repo, PR | [12][13] |
| Conductor (local + Cloud) | Parallel-agent app | Worktree workspaces; Cloud (2026-07-30) adds shared multiplayer workspaces (1H → NH) | repo, PR, tracker intake | [14][15][16] |
| Sculptor (Imbue) | Parallel-agent app | One container per agent, Pairing Mode sync, conflict flagging (1H) | repo | [17] |
| Terragon | Background agents | Shut down 2026-02-09 and open-sourced | repo, PR | [18] |
| Crystal → Nimbalyst | Parallel-agent app | Parallel sessions in worktrees; Nimbalyst is the successor (1H) | repo | [19][56] |
| GitHub Agent HQ / mission control / Copilot projects | Platform control plane | Assign, steer and track many vendors' agents; governance; PR primitives (NH) | tracker (issues), PR, chat (Slack/Teams), repo | [20][21][23] |
| Linear agent platform | Tracker integration point | Agents as app users, delegation, AgentSession lifecycle (NH) | tracker | [32][33] |
| Devin | Cloud agent | Slack-synced sessions, code channels, Linear delegation (NH) | chat, tracker, PR | [34][35] |
| Cursor cloud agents (+ Graphite) | Cloud agent + review | Team-visible agents, team follow-ups; Graphite acquired 2025-12-19 (NH) | chat, tracker, PR | [31][36][37] |
| Amp workspaces / multiplayer | Shared agent threads | Threads shared by default, multiplayer prompting, agent-to-agent (NH) | chat-like threads, repo | [38][39][40] |
| Zed Delta / DeltaDB (+ ACP) | Multiplayer agent environment | Replicated thread plus worktree; replaces PRs; Claude Code `/delta share` (NH) | repo, review, chat-like threads | [42][43][44] |
| Replit Agent teams | App builder | Shared Kanban, isolated task copies, apply step (NH) | tracker-like board, repo | [46] |
| Lovable workspaces | App builder | Per-person drafts, roles, publish policies (NH) | repo, release (publish) | [47] |
| GitHub stacked PRs / merge queue / CODEOWNERS | Parallel-work primitives | Stacks GA 2026-10-06 and land through the merge queue as one group (NH) | PR, repo | [27][28][29] |
| MCP, A2A, AGENTS.md, Agent Skills, ACP, AAIF | Protocols / standards | Tools, agent-to-agent tasks, repo guidance, skills, editor↔agent | repo, cross-tool | [48]–[54] |
| Microsoft Entra Agent ID | Agent identity | Directory identities and token claims for agents (NH/enterprise) | identity, audit | [55] |

## 2. Per product / framework

### MCP Agent Mail
- **What it is:** an HTTP FastMCP server, described as "gmail for your coding agents." The Python version is deprecated; it was superseded by `mcp_agent_mail_rust` (34 tools, TUI) [1][2].
- **Identity:** memorable adjective+noun agent names (e.g. GreenCastle) and a directory of active agents, programs and models [1].
- **Claims / leases:** `file_reservation_paths(paths, ttl, exclusive, reason)` takes advisory leases on globs [1].
  - Conflicts are returned *alongside* grants; reservations are never refused.
  - Leases can be renewed, released or force-released. Stale leases are auto-released using inactivity, mail, filesystem and git heuristics, and the previous holder is notified [1].
  - An optional pre-commit and pre-push guard blocks commits that touch another agent's exclusive lease. It works by checking `AGENT_NAME` [1].
  - "Build slots" are leases on long-running resources such as dev servers [1].
- **Messaging:** threaded GFM messages with acknowledgement and ack-TTL escalation [1].
  - Contact policies: open / auto / contacts_only / block_all [1].
  - A "Product Bus" groups several repos under one inbox [1].
  - The recommended convention is to use the Beads id as the `thread_id` [1].
- **Human↔agent:** a "Human Overseer" web composer sends priority messages that bypass contact policies [1].
- **Audit:** all messages and leases are written as git-committed artifacts and indexed in SQLite FTS. Exports are static bundles, optionally Ed25519-signed and age-encrypted, for stakeholders [1].
- **Scope:** the docs target "agents… across one or more codebases." A commercial Companion iOS app steers fleets [1]. Explicit multi-human tenancy: [UNVERIFIED].

### Beads
- **What it is:** a "distributed graph issue tracker for AI agents, powered by Dolt." It first shipped in October 2025 and has about 28k stars; the repo is now under `gastownhall` [3][4].
- **Claims:** `bd ready` lists unblocked work and `bd update <id> --claim` "atomically" sets assignee plus in_progress [3].
- **Conflict avoidance:**
  - Hash-based IDs avoid merge collisions across branches and agents [3].
  - Embedded mode allows a single writer; `--server` mode supports concurrent writers [3].
  - Cross-machine sync runs through `bd dolt push/pull` [3].
- **Messaging:** a message issue type with threading [3].
- **Memory:** `bd remember` and `bd prime` [3].
- **Handoff:** session crashes and handoffs resume by reading beads [4].
- **Multi-human:** a contributor mode routes planning to a separate repo, and maintainer roles are auto-detected [3].

### Gas Town / Gas City / Wasteland
- **What it is:** open-sourced on 2026-01-01; v1.0 in 2026 [4]. Kilo launched a hosted version on 2026-05-19 [6].
- **Roles:**
  - Mayor: coordinates and never writes code.
  - Polecats: ephemeral workers, each in its own worktree.
  - Witness: supervises and nudges stuck workers.
  - Refinery: a merge-queue agent that serializes merges and can "re-imagine" changes when conflicts get hard [4][5][7].
- **Handoff:** work hangs on persistent "hooks." `gt seance` revives a predecessor session so the new one can ask it questions [5].
- **Messaging:** inter-agent mail, mainly polecat→mayor, plus tmux "nudges" [5].
- **Multi-human (Wasteland, March 2026):** a federated "wanted board" where people post and claim work. Validators award multi-dimensional "stamps" that build portable reputation [4][6].
- **Gas City:** an SDK for building orchestrators that "can run hundreds of concurrent agents" [4].

### Claude Code: subagents, agent teams, cross-session messaging, worktrees
- **Agent teams** are experimental and off by default [9].
  - Structure: one lead plus teammates, each a full session with its own context. You can message any teammate directly [9].
  - Claims: a shared task list (pending / in progress / completed, with dependencies). Teammates self-claim, and "task claiming uses file locking" to prevent races [9].
  - Mailbox: one JSON inbox per agent under `~/.claude/teams/` [9].
  - Gates: teammates send plan-approval requests to the lead. The `TeammateIdle`, `TaskCreated` and `TaskCompleted` hooks can block an action (exit code 2) [9].
  - Limitations [9]:
    - one team per session, and no team can be shared across sessions;
    - no nested teams;
    - the lead role is fixed;
    - teammates are not restored on resume;
    - task status can lag;
    - two teammates editing the same file "leads to overwrites."
- **Cross-session messaging** connects the *same user's* sessions [10].
  - Transport: a local socket restricted to that OS user, or Anthropic servers for remote and cloud sessions [10].
  - Safeguards: an incoming message "can't approve anything" and can't change configuration. Inbound mode is accept / hold / refuse [10].
- **Worktrees:** `claude --worktree <name>` creates `.claude/worktrees/<name>`, and subagents can get temporary worktrees [11].
- **Scope:** everything here is 1H.

### Vibe Kanban, Conductor, Sculptor, Terragon, Crystal
- **Vibe Kanban** launched June 2025 [12].
  - Its maker, bloop, shut down on 2026-04-10. Remote "kanban issues, comments, projects and organisations" were removed after 30 days; local workspaces still work [12].
  - It runs one worktree per task [13].
- **Conductor** local workspaces give each agent its own branch and worktree. The docs advise putting several agents in one workspace only when they share a branch, noting that "agents in the same workspace can edit the same files" [14].
  - Conductor Cloud (2026-07-30) runs isolated microVMs and adds an HTTP API [16].
  - Multiplayer: organization-wide workspaces, presence dots, live shared chats with typing indicators, "Follow," "Reassign to" for handoff, and deep links [15].
- **Sculptor** gives each agent its own Docker container [17].
  - Pairing Mode syncs agent↔local repo in both directions [17].
  - Merges flag potential conflicts, which "you can hand back to the agent" [17].
  - Sessions persist plans, chats and tool calls [17].
- **Terragon** shut down on 2026-02-09 and was open-sourced [18].
- **Crystal** ran parallel sessions in worktrees and is now Nimbalyst [19][56].

### GitHub (Agent HQ, mission control, PR primitives)
- **Agent HQ** was announced 2025-10-28 [20].
  - Mission control: one place to "assign, steer, and track" agents across web, VS Code, CLI and mobile [20].
  - Branch controls govern CI on agent code [20].
  - "Identity features to control which agent is building the task… just like… any other developer" [20].
  - One-click conflict resolution; Slack and Linear integrations [20].
  - Control plane: allowed agents, audit logging, model access [20].
- **Third-party agents:** Claude and Codex agents entered public preview 2026-02-04 [22]. Partners can ship agents as GitHub Apps triggered from issues and PRs [21].
- **Universe 2026 (2026-10-28):** Copilot projects run parallel sessions across repos; sessions continue across surfaces; automations learn from outcomes; Copilot code review Max [23].
- **Attribution / approval rule:** you cannot approve a Copilot PR "if it was you who assigned Copilot" [24].
- **Volume controls:**
  - Caps on open PRs per non-writer (2026-06-17) [25].
  - The PR dashboard's author filter now includes agent-created PRs [26].
- **Stacked PRs** reached GA on 2026-10-06 [27].
  - A stack enters the merge queue "as a single merge group" [27].
  - Approvals survive rebases of unchanged code, and the `gh stack` CLI supports worktrees [27].
- **Merge queue and CODEOWNERS:**
  - The merge queue builds temporary merge-group branches and merges FIFO only when checks pass [29].
  - CODEOWNERS and required reviews still apply before a PR enters the queue [30].

### Linear (integration point only)
- Agents are app users installed by admins with `actor=app` [32].
- Assigning an issue to an agent sets it as **delegate**, not assignee, "so humans maintain ownership" [32].
- Agents cannot be project leads and are not billable seats [32].
- An `AgentSession` tracks state (working, awaiting input, error, done) from emitted activities [33].

### Devin
- Mentioning @Devin in Slack starts a session. Users are linked by matching email [34].
- Sessions sync both ways with a Slack thread [34].
- "Code channels" give one session its own channel, with a status chip, PR tabs and a live worklog [34].
- Linear: you assign tickets to Devin or add playbook labels such as `!plan` or `!implement` [35].

### Cursor (cloud agents, Graphite)
- Agents are visible to their team, gated by each viewer's repo access [36].
- Viewing is read-only unless an admin enables team follow-ups [36].
- Follow-ups execute with the **creator's** integration tokens. Cursor confirmed this is by design and that mitigation is an admin setting (disabled / service accounts only) [37].
- Cursor acquired Graphite, the stacked-PR and review tool, on 2025-12-19 [31].

### Amp
- Workspace threads are shared by default. Admins can see members' private threads [39].
- Multiplayer: teammates can prompt in one thread and its orb or runner for 7 days [38].
  - Every member gains access to the secrets, files and terminal [38].
  - MCP calls use the owner's credentials; costs are billed to the owner [38].
  - @-tagging a teammate activates multiplayer, and threads have voice/video "Space" calls [38].
- Agent-to-agent: agents spawn or delegate to agents in other projects, orbs or machines, with explicit file transfer [40].
- Public discoverable threads were removed on 2026-06-02 because of the risk of exposing sensitive files [41].

### Zed Delta / DeltaDB
- Private beta 2026-08-12, public beta 2026-09-16 [42][43].
- DeltaDB "replicates the conversation and the worktree together, in real time," capturing edits between commits [42].
- Comments anchor to code or conversation and track the code as it evolves [42].
- Review subthreads get isolated worktree copies; reviewers request revisions or fix with an agent [43].
- Zed disabled PRs on its own repo; 33 people landed 570 changes that way [43].
- Teammates who never open Delta see a normal git repo [42].
- Claude Code sessions can be shared via `/delta share` [44].
- Zed hosts external agents over ACP [45].

### Replit and Lovable
- **Replit** puts every collaborator's agent tasks on a shared Kanban (Draft / Active / Ready / Done) [46].
  - Each task runs in an isolated project copy; "Agent handles conflicts automatically when multiple tasks are applied" [46].
  - Collaborators can see chat history and memories [46].
  - Parallel background tasks: 1 on Core, 10 on Pro [46].
  - The FAQ says Agent "isn't a messaging tool — use Slack" [46].
- **Lovable** gives each person a "draft" with its own chat; the draft reaches the project only when someone accepts it [47].
  - Roles: Viewer / Editor / Admin / Owner [47].
  - Enterprise policies can require approval before publishing [47].
  - Credits come from the owner's workspace [47].

### Protocols and standards
- **AAIF** (Linux Foundation) formed 2025-12-09, anchored by MCP, goose and AGENTS.md [48]. Anthropic donated MCP to it [49].
- **A2A:** v1.0 on 2026-03-12; accepted into AAIF on 2026-08-27 [50][51].
  - Agent cards advertise capabilities; tasks have a lifecycle [50].
  - It calls itself "horizontal," with MCP as the "vertical" layer [50].
- **AGENTS.md** is used by 60k+ projects; the nearest file wins [52].
- **Agent Skills** (`SKILL.md`, progressive disclosure) was originated by Anthropic and released as an open standard [53].
- **ACP** (Zed + JetBrains) [54]:
  - registry released 2026-03-09;
  - session list (2026-03-09) and session resume (2026-04-22) stabilized;
  - Transports working group formed 2026-04-22;
  - v2 draft 2026-07-20.
- None of these specs, as read, defines file claims or leases, ownership, or conflict detection [INFERENCE from [50]–[54]].
- **Identity:** Entra Agent ID token claims "enable proper attribution, policy evaluation, and audit trails" [55].

## 3. Cross-cutting patterns
1. **Isolate first, reconcile at landing.** Examples: worktrees (Claude Code, Conductor, Crystal, Vibe Kanban, Gas Town polecats), containers or microVMs (Sculptor, Conductor Cloud), project copies (Replit tasks), drafts (Lovable) [11][14][17][46][47].
2. **Serialized landing as conflict control.** Examples: GitHub merge queue and stack groups, Gas Town Refinery, Replit's apply step, Sculptor's conflict flagging [7][27][29][46][17].
3. **Advisory claims, not hard locks.** Examples: Agent Mail TTL leases plus commit guard, Beads `--claim`, Claude team task file-lock, Wasteland wanted-board claims [1][3][9][4].
4. **External ledger as shared memory and handoff medium.** Examples: Beads/hooks, Claude team task list, Linear AgentSession, Replit Kanban [3][5][9][33][46].
5. **Thread/session as the collaboration unit.** Examples: Amp multiplayer, Delta, Conductor Cloud shared chats, Devin Slack sync, Cursor team follow-ups, GitHub session continuity [38][42][15][34][36][23].
6. **Agents get distinct identities while humans keep accountability.** Examples: Linear delegate vs assignee, GitHub's rule against self-approving your agent's PR, Entra Agent ID, Agent Mail names [32][24][55][1].
7. **Hierarchical orchestration.** Examples: Claude team lead, Gas Town Mayor/Witness, GitHub Copilot projects [9][4][23].
8. **Inter-agent messaging with trust gates.** Examples: Claude cross-session messages (cannot approve), Agent Mail contact policies plus Human Overseer, Amp agent-to-agent, A2A [10][1][40][50].
9. **Chat and tracker as intake and status surfaces for agents.** Examples: Devin code channels, Cursor/Amp Slack, GitHub Slack/Linear integrations, Linear delegation [34][36][39][20][32].
10. **Standards cover plumbing, not coordination.** MCP, A2A, ACP, AGENTS.md and Skills standardize tools, context and transport; claims and ownership stay vendor-specific [48]–[54] [INFERENCE].

## 4. Weaknesses, gaps, complaints
- **Gas Town in practice:** one week produced "three mayors, 141 orphaned Claude Code processes." The same review reports thin observability, launches in yolo mode by default, lost work ("most work gets done; some work gets lost"), an agent overwriting a config file, and high cost [5].
- **Design and review are the bottleneck:**
  - Gas Town and Beads were called "vibe designed" [7].
  - "The bottleneck is going to be how fast humans can review code" [7].
  - A teammate's agent can rename a schema while another's agent refactors the API layer [7].
- **Beads:** "had to uninstall Beads after seeing it only confuse my agents" [8].
- **Claude agent teams:** experimental; task status lags; no resume; fixed lead; same-file overwrites; higher token cost [9].
- **Shared sessions blur identity:**
  - Cursor follow-ups run as the creator. A forum report called this "bearer-token-equivalent," and Slack prompts can be deleted after the agent has acted, removing the audit trail [37].
  - Amp multiplayer exposes secrets and terminal to every member [38].
  - Amp removed public threads because of sensitive-content risk [41].
- **Business fragility:** Vibe Kanban's maker shut down for lack of a business model and removed team features [12]. Terragon shut down [18].
- **Agent PR volume:** GitHub added PR caps for non-writers and agent-author filters [25][26] and notes "more code means more pull requests and more demand for review" [23].
- **Practical ceiling:** 2–4 parallel worktree sessions "before review overhead and API rate limits become friction points" (secondary source) [57].
- **Gaps:**
  - Most coordination tools are 1H; true NH multiplayer is new (Delta, Conductor Cloud, Amp multiplayer) [15][38][43].
  - No cross-vendor standard for claims or ownership exists [INFERENCE].

## 5. Sources
1. https://github.com/Dicklesworthstone/mcp_agent_mail
2. https://github.com/Dicklesworthstone/mcp_agent_mail_rust
3. https://github.com/gastownhall/beads
4. https://yegge.ai/gastown
5. https://tenzinwangdhen.com/posts/gastown-good-bad-ugly
6. https://sdtimes.com/softwaredev/gas-town-by-kilo-multi-agent-orchestrator-now-available
7. https://maggieappleton.com/gastown
8. https://news.ycombinator.com/item?id=46624883
9. https://code.claude.com/docs/en/agent-teams
10. https://code.claude.com/docs/en/cross-session-messaging
11. https://code.claude.com/docs/en/worktrees
12. https://vibekanban.com/blog/shutdown
13. https://github.com/BloopAI/vibe-kanban
14. https://www.conductor.build/docs/concepts/parallel-agents
15. https://www.conductor.build/docs/cloud/collaboration
16. https://www.conductor.build/changelog/0.78.0-introducing-conductor-cloud
17. https://imbue.com/blog/sculptor-announce
18. https://www.terragonlabs.com/
19. https://github.com/stravu/crystal
20. https://github.blog/news-insights/company-news/welcome-home-agents
21. https://docs.github.com/en/copilot/concepts/agents/cloud-agent/agent-management
22. https://github.blog/changelog/2026-02-04-claude-and-codex-are-now-available-in-public-preview-on-github
23. https://github.blog/news-insights/company-news/github-universe-2026-evolving-every-layer-of-the-stack
24. https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/approving-a-pull-request-with-required-reviews
25. https://github.blog/changelog/2026-06-17-limit-open-pull-requests-for-users-without-write-access/
26. https://github.blog/changelog/2026-07-09-new-pull-requests-dashboard-is-now-generally-available/
27. https://github.blog/changelog/2026-10-06-stacked-pull-requests-generally-available/
28. https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-stacked-pull-requests
29. https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue
30. https://www.cubic.dev/blog/github-merge-queue
31. https://cursor.com/blog/graphite
32. https://linear.app/developers/agents
33. https://linear.app/developers/agent-interaction
34. https://docs.devin.ai/integrations/slack
35. https://docs.devin.ai/integrations/linear
36. https://cursor.com/docs/cloud-agent
37. https://forum.cursor.com/t/cursor-cloud-agent-sessions-are-shared-across-users-act-on-behalf/158866
38. https://ampcode.com/docs/collaborate/multiplayer
39. https://ampcode.com/docs/collaborate/workspaces
40. https://ampcode.com/docs/orbs/agent-to-agent
41. https://ampcode.com/news/end-of-public-threads
42. https://zed.dev/blog/introducing-delta
43. https://zed.dev/blog/delta-public-beta
44. https://x.com/zeddotdev/status/2115135016233509239
45. https://zed.dev/docs/ai/external-agents
46. https://docs.replit.com/build/invite-teammates
47. https://docs.lovable.dev/features/collaboration
48. https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation
49. https://blog.modelcontextprotocol.io/posts/2025-12-09-mcp-joins-agentic-ai-foundation
50. https://a2a-protocol.org/latest/blog/2026/08/27/a-new-chapter-for-a2a-joining-the-agentic-ai-foundation/
51. https://a2a-protocol.org/latest/blog/2026/03/12/a2a-protocol-ships-v10-production-ready-standard-for-agent-to-agent-communication
52. https://agents.md/
53. https://agentskills.io/home
54. https://agentclientprotocol.com/updates
55. https://learn.microsoft.com/en-us/entra/agent-id/agent-token-claims
56. https://nimbalyst.com/crystal
57. https://www.mindstudio.ai/blog/what-is-claude-code-git-worktree-pattern-parallel-feature-branches
