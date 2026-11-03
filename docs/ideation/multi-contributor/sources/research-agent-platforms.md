# Autonomous coding-agent platforms: how teams collaborate through them (state as of 2026-10-31)

Scope: background and cloud coding agents, and how they connect to chat, trackers, knowledge, repositories/PRs, and release communication. All claims link to a source. Anything I could not confirm is marked [UNVERIFIED].

## 1. Coverage table

| Product | Category | What it is | Surfaces touched | Primary source |
|---|---|---|---|---|
| Cognition Devin (+ Devin Desktop, formerly Windsurf) | Autonomous cloud agent + IDE | Cloud SWE agent with Slack, Jira, and Linear triggers, automations, skills/plugins, and DeepWiki | chat, tracker, KB (wiki), repo, PR | https://docs.devin.ai/integrations/slack |
| Factory Droids | Agent platform | "Delegations" from Slack, Teams, Linear, and Jira, running under a shared agent profile and service account | chat, tracker, repo, PR | https://docs.factory.com/delegations/index.md |
| Cursor cloud agents / Bugbot / Graphite | IDE + cloud agents + review | Cloud agents started from Slack, Linear, and GitHub; team follow-ups; Bugbot PR review; Graphite (acquired) | chat, tracker, repo, PR | https://cursor.com/docs/integrations/slack |
| OpenAI Codex | Cloud agent + review | Codex Cloud tasks from Linear and from Slack (now `@ChatGPT`); `@codex review` on GitHub | chat, tracker, PR | https://developers.openai.com/codex/integrations/linear |
| GitHub Copilot cloud agent / Agent HQ | Platform-native agent | Assign issues to Copilot; mission control; Slack, Teams, Linear, and Jira; third-party agents | chat, tracker, repo, PR | https://docs.github.com/en/copilot/how-tos/copilot-integrations/integrate-cloud-agent-with-slack |
| Anthropic Claude Code / Claude Tag | CLI/web agent + Slack team agent | Cloud sessions with sharing; GitHub Action; Claude Tag is a multiplayer `@Claude` in Slack | chat, repo, PR, (announcement posts) | https://claude.com/docs/claude-tag/concepts/how-it-works |
| Google Jules | Async agent (winding down) | GitHub-issue-labelled tasks; read-only after 2026-11-11, shut down 2026-12-31 | repo, PR | https://jules.google/docs/changelog/ |
| Amp | Agent + team workspace | Shared threads, workspace config, agent-to-agent messaging, Slack | chat, repo, PR | https://ampcode.com/docs/collaborate/workspaces |
| Augment Code Cosmos | Agent "software factory" | "Experts" fired by GitHub, GitLab, Slack, Linear, Jira, schedule, or webhook | chat, tracker, repo, PR | https://docs.augmentcode.com/cosmos/config-slack |
| Atlassian Rovo Dev → Jira Coding Agent | Tracker-native agent | Standalone Rovo Dev is being sunset; a coding agent is bundled into Jira; third-party agents can be assigned in Jira | tracker, KB (Confluence), PR | https://www.atlassian.com/software/rovo-dev |
| GitLab Duo Agent Platform | DevSecOps-native agents | Flows and external agents (Claude Code, Codex) mentioned in issues and MRs; composite identity | tracker, repo, MR | https://docs.gitlab.com/user/duo_agent_platform/agents/external/ |
| Charlie Labs | Agent "teammate" | TypeScript-focused agent woken by GitHub, Linear, Slack, or a schedule | chat, tracker, PR | https://docs.charlielabs.ai/how-it-works |
| Ona (ex-Gitpod) | Background agents + environments | Agents started from Slack, Linear, or a GitHub PR mention; per-org plus per-principal auth | chat, tracker, KB (Notion read), PR | https://ona.com/docs/ona/integrations/overview |
| Warp Oz | Agent orchestration | `@Oz` in Slack or Linear starts cloud agents in configured environments | chat, tracker, PR | https://docs.warp.dev/platform/integrations/quickstart.md |
| Linear Agents (substrate) | Tracker agent API | Delegate vs. assignee model; Agent Sessions and Agent Activities used by most of the agents above | tracker | https://linear.app/developers/agent-interaction |

## 2. Per product

### Cognition Devin and Devin Desktop (Windsurf)
- **Corporate history.** Cognition acquired Windsurf in July 2025 ([TechCrunch](https://techcrunch.com/2025/07/14/cognition-maker-of-the-ai-coding-agent-devin-acquires-windsurf/)). Windsurf was rebranded to Devin Desktop in June 2026 ([Wikipedia](https://en.wikipedia.org/wiki/Cognition_AI)). Cascade reached end of life on 2026-07-01 according to a secondary source ([ToolRadar](https://www.gotoolradar.com/2026/09/what-happened-to-windsurf-how-it-became.html)); I did not confirm this from a Cognition page [UNVERIFIED primary].
- **Intake.**
  - Slack: `@Devin`, message shortcuts, `/ask-devin`.
  - Jira: either assign the Rovo-agent version of Devin, or use a service user (assignment, the `devin` label, or an @mention).
  - Linear: assign, @mention, or labels that map to playbooks.
  - Automations triggered by Slack reactions or Jira events.
  - Sources: [Slack](https://docs.devin.ai/integrations/slack), [Jira](https://docs.devin.ai/integrations/jira.md), [Linear](http://docs.devin.ai/integrations/linear).
- **Status back to the team.**
  - The Slack thread syncs both ways with the web session. Devin adds emoji reactions on completion or failure.
  - "Code channels" give a session its own Slack channel with a working/blocked/done status chip, PR tabs, and a live worklog. Devin can move a thread into one itself ([Slack](https://docs.devin.ai/integrations/slack)).
  - In Jira, the agent panel shows live status, a session link "so you can follow along or take over", and Devin's questions ([Jira](https://docs.devin.ai/integrations/jira.md)).
- **Human↔human etiquette in shared threads.** `!aside` lets people comment without Devin reading it; `mute`/`unmute` and `unsync` control whether Devin listens ([Slack](https://docs.devin.ai/integrations/slack)).
- **Identity.** Users are matched by email or a linked Atlassian account. A session "runs as the Devin user who matches the Jira user who assigned or mentioned Devin". Unmatched users fall back to a shared bot user. Only the Jira user who started a task can message or cancel it from Jira ([Jira](https://docs.devin.ai/integrations/jira.md)).
- **Multiple contributors.**
  - Re-assignment by another person "can start another session even if the first is still running".
  - With the service-user option, while a session is linked to a work item, new assignments are ignored and @mentions are routed to that session for 30 days ([Jira](https://docs.devin.ai/integrations/jira.md)).
  - PR feedback (comments, CI, merge conflicts) is routed "to the session that owns the PR" ([release notes, 2026-10-28](https://docs.devin.ai/release-notes/overview)).
- **Knowledge.**
  - Knowledge (auto-generated, pinned, and ingested from `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, and similar files) is deprecated and is migrating to Skills in Plugins ([docs](https://docs.devin.ai/onboard-devin/knowledge-onboarding)).
  - Playbooks are an org-shared library of prompts ([docs](https://docs.devin.ai/product-guides/creating-playbooks)).
  - DeepWiki generates repository wikis ([docs](https://docs.devin.ai/work-with-devin/deepwiki)).
- **Releases.** No native release-note feature found. Neon uses a weekly Devin Playbook to set up its changelog file ([Neon](https://neon.com/blog/ai-workflows-for-docs-devin)).

### Factory (Droids)
- **Intake.** `@Factory` in Slack, Teams, or Google Chat (in development); assign or @mention in Linear; Agents→Factory in Jira ([Delegations](https://docs.factory.com/delegations/index.md)).
- **Identity split.**
  - Channel and issue delegations run as an admin-configured service account under a shared "Apps" agent profile (instructions, plugins, compute).
  - DMs run as the sender, with their personal Git credentials and connectors.
  - Personal defaults (model, appended instructions) follow the requester but "do not make a shared session run as the requester" ([Delegations](https://docs.factory.com/delegations/index.md)).
- **Status and handoff.**
  - Droid can move a session into a Slack code channel that shows the repo, branch, and a diff. Anyone in the channel steers by posting.
  - When asked, Droid archives the channel with a summary of the outcome, PR links, and open items. Channels idle for 7 days are archived.
  - `!connect` returns SSH access to the running computer.
  - Channel sessions are not linked from Slack because they run as the service account ([Slack](https://docs.factory.ai/integrations/slack)).
- **Governance caveat (vendor-documented).** Factory is the PR author, so "the requester can still approve a Factory-authored pull request", which satisfies a one-approval rule. Factory's docs recommend requiring 2 approvals or a status check on `factory-droid[bot]` PRs ([Delegations](https://docs.factory.com/delegations/index.md)).

### Cursor (cloud agents, Bugbot, Graphite)
- **Intake.**
  - Slack: `@Cursor` reads the entire thread. Repo routing checks the message, then recent activity, then routing rules, then the channel default, then the team default.
  - Linear: delegate the issue or `@Cursor` in a comment. Config can come from `[repo=…]` in the text or from a "repo" label group.
  - Sources: [Slack](https://cursor.com/docs/integrations/slack), [Linear](https://cursor.com/docs/integrations/linear).
- **Status.**
  - In Slack: a short plan before coding, a live status line, then a completion notification with a View PR button.
  - In Linear: real-time status and an automatically created PR.
  - `@Cursor list my agents` lists your runs ([Slack](https://cursor.com/docs/integrations/slack)).
- **Shared channel settings.** Any team member can change a channel's default repo or pool. Cursor replies naming who changed it ([Slack](https://cursor.com/docs/integrations/slack)).
- **Visibility and takeover.**
  - Agents are visible to the team, but each viewer must also have access to the repository. Viewing is read-only.
  - The admin setting "Team follow-ups" (Disabled / Service accounts only / All) controls who can steer another person's agent.
  - Cursor warns this enables "lateral movement": a teammate can direct an agent holding a more privileged user's secrets ([settings](https://cursor.com/docs/cloud-agent/settings), [cloud agents](https://cursor.com/docs/cloud-agent)).
- **Team memory and rules.**
  - Team Rules are set in the dashboard and can be enforced.
  - Bugbot reads `.cursor/BUGBOT.md`, Bugbot Team Rules, and learned rules (since 2026-04-08 per a secondary source). `@cursor remember` on a PR adds a rule.
  - Personal Memories were removed in 2.1 (Nov 2025).
  - Sources: [Rules](https://cursor.com/docs/rules), [Bugbot](https://cursor.com/docs/bugbot), [cubic](https://www.cubic.dev/blog/cursor-bugbot-review), [cognee](https://www.cognee.ai/cursor-memory).
- **Automations.** Triggers from schedules, GitHub, GitLab, Slack, Linear, and webhooks ([docs](https://cursor.com/docs/cloud-agent/automations)).
- **Graphite.** Acquired 2025-12-19 ([Cursor blog](https://cursor.com/blog/graphite)). Graphite's site banner says "Cursor Cloud Agents are now in Graphite" ([Graphite](https://graphite.com/blog/graphite-joins-cursor)).

### OpenAI Codex
- **Launch.** GA, with the Slack integration announced at the same time ([OpenAI](https://openai.com/index/codex-now-generally-available/)).
- **Slack (moved to `@ChatGPT`).**
  - "If you previously used `@Codex`, start new requests with `@ChatGPT`."
  - Repo work runs as a separate Codex Cloud task under the requester's account, in workspace-shared environments.
  - A private Allow/Deny approval card can appear. The Follow along and Cancel controls are for the requester only, and "the channel reply doesn't give every channel member access to the underlying task".
  - Follow-ups from another account "may start a separate coding task".
  - Source: [docs](https://developers.openai.com/codex/integrations/slack).
- **Linear.**
  - Assign, or `@Codex` in a comment. Progress appears in the issue's Activity.
  - On completion Codex posts a summary and a chat link "so you can create a pull request".
  - With triage rules, Codex "runs chats using the account of the issue creator" ([docs](https://developers.openai.com/codex/integrations/linear)).
- **Review.** `@codex review` or automatic review. Rules come from a `## Code Review Rules` section in the nearest `AGENTS.md` (renamed from "Review guidelines" around July 2026) ([OpenAI](https://developers.openai.com/codex/use-cases/github-code-reviews), [cubic](https://www.cubic.dev/blog/codex-code-review)).

### GitHub Copilot cloud agent (formerly "coding agent") and Agent HQ
- **Agent HQ (Universe 2025, 2025-10-28).**
  - Mission control: assign, steer, and track agents across GitHub, VS Code, mobile, and CLI.
  - Third-party agents from Anthropic, OpenAI, Google, Cognition, and xAI.
  - Custom agents with their own prompt and tools.
  - Slack and Linear integrations, alongside Jira, Teams, and Azure Boards.
  - An agent "control plane" with audit logging ([GitHub blog](https://github.blog/news-insights/company-news/welcome-home-agents/)).
- **Universe 2026 (2026-10-28).** The Copilot app, Copilot projects (multi-repo parallel sessions), session continuity across clients, and automations that "learn from their outcomes and propose improvements" for human approval ([GitHub blog](https://github.blog/news-insights/company-news/github-universe-2026-evolving-every-layer-of-the-stack/)).
- **Slack.**
  - In DMs Copilot acts with your GitHub permissions. In shared channels, artifacts are created under the app identity, and such unattributed PRs need one extra approval by default.
  - Only users with write access to every selected repo can start or steer a session, but "any conversation participant can provide input".
  - Each task gets a dedicated "Slack Code" channel.
  - Channel default repositories are shared settings.
  - Copilot can create issues, including epic/child hierarchies, from a thread ([docs](https://docs.github.com/en/copilot/how-tos/copilot-integrations/integrate-cloud-agent-with-slack)).
- **Commit identity.** Commits are authored by Copilot with the assigner as co-author, and are signed ([docs](https://docs.github.com/en/copilot/concepts/security-governance-and-network-settings/risks-and-mitigations)).
- **Memory.** Copilot Memory (preview) stores repository facts per repo and preferences per user ([docs](https://docs.github.com/en/copilot/how-tos/copilot-integrations/integrate-cloud-agent-with-slack)).

### Anthropic Claude Code and Claude Tag
- **Claude Code in Slack (earlier version).** Each session runs under the individual's own account and plan limits, with a "View Session" link and a "Create PR" button. It was retired for Claude Tag-connected workspaces effective 2026-10-05 ([docs](https://code.claude.com/docs/en/slack)).
- **Claude Tag (beta, announced 2026-06-23, Team/Enterprise).**
  - One `@Claude` per channel; "anyone can see what it's working on, and can pick up the conversation" ([Anthropic](https://www.anthropic.com/news/introducing-claude-tag)).
  - Anyone in the channel steers by replying in the thread. **Stop** halts work and posts who stopped it.
  - In channels it acts under admin-provisioned service accounts with per-channel access; in one-to-one DMs it uses the user's own connectors.
  - Memory has two levels: per-channel notes, and workspace notes saved from public channels.
  - Long tasks show a live checklist edited in place. Slack doesn't notify on edits, so "the thread can look frozen".
  - It can post to other channels (e.g. #announcements) with an attribution line ("Sent by Claude in #team-eng on behalf of @jordan").
  - It can host pages "kept current" for digests ([docs](https://claude.com/docs/claude-tag/concepts/how-it-works)).
  - Admins get an activity log of who requested each task, plus per-channel spend limits ([Anthropic](https://www.anthropic.com/news/introducing-claude-tag)).
- **Cloud sessions.** Visibility can be Private or Team on Team/Enterprise plans. Recipients see a snapshot that does not update in real time ([docs](https://code.claude.com/docs/en/claude-code-on-the-web)).
- **GitHub Action.** `anthropics/claude-code-action` responds to `@claude` in issues and PRs ([secondary](https://fast.io/resources/claude-code-github-integration-guide/)).

### Google Jules
- Adding the `jules` label to a GitHub issue starts a task (2025-06-26) ([changelog](https://jules.google/docs/changelog/2025-06-26)).
- Jules is listed as a native assignee in Agent HQ ([GitHub blog](https://github.blog/news-insights/company-news/welcome-home-agents/)).
- **Shutdown.** Read-only after 2026-11-11, shut down 2026-12-31. Users can export their memories and sessions ([changelog](https://jules.google/docs/changelog/)).

### Amp
- **Workspace model.** Threads are shared with the workspace by default. Plugins, skills, agents, MCP servers, a global `AGENTS.md`, and secrets are configured once for all members. Admins can see private threads ([Workspaces](https://ampcode.com/docs/collaborate/workspaces)).
- **Collaboration.**
  - "Tag a teammate with `@` in a thread to pull them in and pair on the live orb."
  - Agents can start other agents, exchange files, and report back across projects and machines ([agent-to-agent](https://ampcode.com/docs/orbs/agent-to-agent)).
- **Slack (2026-07-20).** `@Amp` routes to your personal "Puck". Amp can ping a teammate when an issue resolves, and can search Slack for context ([news](https://ampcode.com/news/slack-integration)).

### Augment Code (Cosmos)
- **Positioning.** "Software factory" loops: review, ticket-to-PR, incident response. Triggers come from GitHub, GitLab, Slack, Linear, Jira, schedules, and webhooks ([site](https://www.augmentcode.com/)).
- **Slack triggers.** Configured with JSONLogic filters, and workflows can post results to a channel. Documented limitation: "Agents created via Slack are owned by the bot user… you won't see 'your' agent in the Cosmos web app" ([docs](https://docs.augmentcode.com/cosmos/config-slack)).

### Atlassian (Rovo Dev → Jira Coding Agent; agents in Jira)
- Standalone Rovo Dev is "reaching end of life"; its capabilities are moving into Jira subscriptions ([Atlassian](https://www.atlassian.com/software/rovo-dev)).
- The Jira Coding Agent runs a sandbox session from a work item, uses Jira and Confluence context, and opens a PR ([support](https://support.atlassian.com/jira-software-cloud/docs/what-is-the-jira-coding-agent/)).
- **2026-07-15 announcement.**
  - Assign work items to Claude Code, Cursor, or Copilot, with Codex "coming soon".
  - Jira Planner writes specs into Confluence using the Teamwork Graph.
  - A DX report maps AI cost to PRs ([BusinessWire](https://www.businesswire.com/news/home/20260715176442/en/Atlassian-Announces-System-for-AI-native-Software-Development-in-Jira), [Futurum](https://futurumgroup.com/insights/atlassian-fuses-the-agent-work-surface-workflow-and-control-plane-into-jira/)).

### GitLab Duo Agent Platform
- GA on 2026-01-15 ([GitLab press](https://about.gitlab.com/press/releases/2026-01-15-gitlab-announces-duo-agent-platform-general-availability/)).
- External agents (Claude Code and Codex, using GitLab-managed credentials) are mentioned in issues, epics, and MRs via a per-group service account. They run in CI and reply with an MR or an inline comment "while adhering to project permissions and keeping an audit trail".
- Triggers include work-item created or status changed, and MR ready, approved, or conflicted ([docs](https://docs.gitlab.com/user/duo_agent_platform/agents/external/)).
- **Composite identity.** Access is the intersection of the triggering user's and the service account's memberships ([docs](https://docs.gitlab.com/user/duo_agent_platform/agents/external/)).

### Charlie Labs, Ona, Warp
- **Charlie.**
  - Wakes on GitHub mentions, review requests, assignments, and PR activity; Linear issue creation and comments; Slack mentions and replies; and cron schedules ([docs](https://docs.charlielabs.ai/how-it-works)).
  - Can create Linear tickets from Slack threads ([changelog](https://www.charlielabs.ai/changelog?entry=2025-05-29-linear-agent)).
- **Ona.**
  - Two-layer auth: an admin enables an integration for the org, then a user or service account authenticates, "so the agent acts with the right identity".
  - Notion and Granola are available as read sources.
  - `@ona-agent` on a PR starts an agent ([docs](https://ona.com/docs/ona/integrations/overview)).
- **Warp Oz.**
  - `@Oz` in Slack or Linear reads the thread or issue and posts progress and PRs back.
  - Integrations require team membership ([docs](https://docs.warp.dev/platform/integrations/quickstart.md)).

### Linear Agents (the substrate most of these agents plug into)
- When an issue is delegated, "the human user remains the primary assignee, while the agent is added as a contributor" (Agent Interaction Guidelines principle: "an agent cannot be held accountable") ([Linear](https://linear.app/agents)).
- Agents report through AgentSessions and typed activities: thought, action, elicitation, response, error ([dev docs](https://linear.app/developers/agent-interaction)).
- Linear advises agents to rely on activities rather than comments, because comments "are editable" ([best practices](https://linear.app/developers/agent-best-practices)).

## 3. Cross-cutting patterns

1. **Mention or assign to start a task, and report back in the same place.** Every product follows this pattern: Devin, Cursor, Codex, Copilot, Factory, Warp, Charlie, Ona. The artifact of record is a PR, plus a link to the session.
2. **The thread is the spec.** Cursor, Copilot, Factory, and Claude Code all ingest the whole Slack thread as context. Copilot calls it "the decision-making context for the artifact". Copilot and Claude both warn about prompt injection from other participants' messages.
3. **Identity depends on where you ask.** Shared channels run as a service or app identity; DMs run as you. Examples: Factory, Claude Tag, Copilot. Codex and the earlier Claude Code Slack integration run as the requester. Devin and Codex triage run as a matched user, or as the issue creator.
4. **Dedicated per-task channels.** Devin, Factory, and Copilot ("Slack Code") all use Slack's Code Channels feature: one channel per session, a status chip, diffs, and archiving with a summary.
5. **Policies for steering someone else's agent.** Cursor's Team follow-ups setting (with a lateral-movement warning). Copilot requires write access to steer, but anyone can give input. Claude Tag lets any channel member steer. Devin's Jira panel accepts messages only from the requester. Codex's controls are for the requester only.
6. **Accountability kept with a human.** Linear's delegate/assignee split. Copilot's co-author trailer. Copilot's extra approval for unattributed PRs. Factory's advice to require two approvals.
7. **Team memory moves into versioned files and shared plugins.** Devin is moving Knowledge to Skills/Plugins. Cursor removed Memories in favor of Rules. Amp has a workspace `AGENTS.md`. Codex reads review rules from `AGENTS.md`. Claude Tag keeps channel and workspace notes. Copilot Memory scopes facts per repo.
8. **Event-driven automations replace one-off prompts.** Devin Automations, Cursor Automations, Copilot automations, Factory Automations, Augment Cosmos triggers, and GitLab flow triggers.
9. **Trackers become control planes for third-party agents.** Jira (assign Claude Code, Cursor, or Copilot), GitHub Agent HQ (Claude, Codex, Jules, and others), GitLab external agents, and the Linear agent API.
10. **Release and announcement support is almost absent.** No product above ships release-note or changelog generation as a feature [UNVERIFIED absence]. Teams use playbooks or automations for this (e.g. Neon's weekly Devin playbook). Claude Tag's cross-channel posts with attribution and its "page kept current" digests come closest.

## 4. Weaknesses, gaps, complaints (sourced)

- **Review is the bottleneck.** In Faros AI's telemetry, teams with high AI adoption merged 98% more PRs but spent 91% more time in review, with PRs 154% larger ([Faros](https://www.faros.ai/blog/ai-software-engineering)). Faros's later data shows review time up as much as 441% (median) and 31% more code reaching production unreviewed ([Faros](https://www.faros.ai/blog/are-ai-coding-assistants-really-saving)).
- **Low-quality AI PRs in open source.** GitHub weighed a PR "kill switch" ([The Register](https://www.theregister.com/software/2026/02/03/github-ponders-kill-switch-for-pull-requests-to-stop-ai-slop/4334869)). It then shipped options to disable PRs or restrict them to collaborators (2026-02-13) and PR caps ([danilchenko.dev](https://www.danilchenko.dev/posts/2026-04-11-github-ai-agents-pull-requests/), [CodeRabbit](https://www.coderabbit.ai/blog/github-gives-maintainers-a-throttle-for-the-ai-pull-request)).
- **Early agent PRs failed often.** dotnet/runtime saw a 41.7% success rate for Copilot agent PRs in May 2025, rising to about 71% later ([.NET Blog](https://devblogs.microsoft.com/dotnet/ten-months-with-cca-in-dotnet-runtime/)). The public frustration at the time was covered by [GIGAZINE](https://gigazine.net/gsc_news/en/20250522-github-copilot-coding-agent-error/).
- **Attribution friction.** Users objected to forced "Co-Authored-by Copilot" commit trailers ([heise](https://www.heise.de/en/news/WTF-Microsoft-forces-Co-Authored-by-Copilot-in-commits-11279554.html), [copilot-sdk #1172](https://github.com/github/copilot-sdk/issues/1172)).
- **Self-approval loophole.** Bot-authored PRs let the requester be the only approver (Factory docs, above).
- **Shared-steering security risk.** Cursor documents secret exfiltration and privilege escalation through team follow-ups ([Cursor](https://cursor.com/docs/cloud-agent/settings)).
- **Visibility gaps.**
  - Codex channel replies don't grant access to the underlying task.
  - Augment's Slack-created agents are invisible in its web app.
  - Factory doesn't link channel sessions from Slack.
  - Claude Code shared sessions are static snapshots. A GitHub issue asks for an org-wide shared view of sessions ([anthropics/claude-code #76162](https://github.com/anthropics/claude-code/issues/76162)).
- **Notification ambiguity.** Claude Tag's edited-in-place checklists produce no Slack notifications ([docs](https://claude.com/docs/claude-tag/concepts/how-it-works)). Teams lacks thread context for Factory ([docs](https://docs.factory.com/delegations/index.md)).
- **Duplicate and parallel sessions.** Devin's Jira assignment by a second person can start a parallel session ([docs](https://docs.devin.ai/integrations/jira.md)). Codex follow-ups from a different account may fork a new task ([docs](https://developers.openai.com/codex/integrations/slack)). I found no product with cross-agent claim or locking at the work-item level beyond per-session routing [UNVERIFIED absence].
- **Platform churn.**
  - Jules is shutting down.
  - Rovo Dev's standalone product is being sunset.
  - Windsurf/Cascade were folded into Devin.
  - Codex's Slack bot moved to `@ChatGPT`.
  - The earlier Claude Code Slack bot was retired.
  - Cursor Memories were removed.
  - Devin Knowledge is deprecated.

## 5. Sources

https://docs.devin.ai/integrations/slack · https://docs.devin.ai/integrations/jira.md · http://docs.devin.ai/integrations/linear · https://docs.devin.ai/release-notes/overview · https://docs.devin.ai/onboard-devin/knowledge-onboarding · https://docs.devin.ai/product-guides/creating-playbooks · https://docs.devin.ai/work-with-devin/deepwiki · https://techcrunch.com/2025/07/14/cognition-maker-of-the-ai-coding-agent-devin-acquires-windsurf/ · https://en.wikipedia.org/wiki/Cognition_AI · https://www.gotoolradar.com/2026/09/what-happened-to-windsurf-how-it-became.html · https://neon.com/blog/ai-workflows-for-docs-devin · https://docs.factory.com/delegations/index.md · https://docs.factory.ai/integrations/slack · https://cursor.com/docs/integrations/slack · https://cursor.com/docs/integrations/linear · https://cursor.com/docs/cloud-agent · https://cursor.com/docs/cloud-agent/settings · https://cursor.com/docs/cloud-agent/automations · https://cursor.com/docs/rules · https://cursor.com/docs/bugbot · https://www.cubic.dev/blog/cursor-bugbot-review · https://www.cognee.ai/cursor-memory · https://cursor.com/blog/graphite · https://graphite.com/blog/graphite-joins-cursor · https://openai.com/index/codex-now-generally-available/ · https://developers.openai.com/codex/integrations/slack · https://developers.openai.com/codex/integrations/linear · https://developers.openai.com/codex/use-cases/github-code-reviews · https://www.cubic.dev/blog/codex-code-review · https://github.blog/news-insights/company-news/welcome-home-agents/ · https://github.blog/news-insights/company-news/github-universe-2026-evolving-every-layer-of-the-stack/ · https://docs.github.com/en/copilot/how-tos/copilot-integrations/integrate-cloud-agent-with-slack · https://docs.github.com/en/copilot/concepts/security-governance-and-network-settings/risks-and-mitigations · https://code.claude.com/docs/en/slack · https://claude.com/docs/claude-tag/concepts/how-it-works · https://www.anthropic.com/news/introducing-claude-tag · https://code.claude.com/docs/en/claude-code-on-the-web · https://fast.io/resources/claude-code-github-integration-guide/ · https://jules.google/docs/changelog/ · https://jules.google/docs/changelog/2025-06-26 · https://ampcode.com/docs/collaborate/workspaces · https://ampcode.com/docs/orbs/agent-to-agent · https://ampcode.com/news/slack-integration · https://www.augmentcode.com/ · https://docs.augmentcode.com/cosmos/config-slack · https://www.atlassian.com/software/rovo-dev · https://support.atlassian.com/jira-software-cloud/docs/what-is-the-jira-coding-agent/ · https://www.businesswire.com/news/home/20260715176442/en/Atlassian-Announces-System-for-AI-native-Software-Development-in-Jira · https://futurumgroup.com/insights/atlassian-fuses-the-agent-work-surface-workflow-and-control-plane-into-jira/ · https://about.gitlab.com/press/releases/2026-01-15-gitlab-announces-duo-agent-platform-general-availability/ · https://docs.gitlab.com/user/duo_agent_platform/agents/external/ · https://docs.charlielabs.ai/how-it-works · https://www.charlielabs.ai/changelog?entry=2025-05-29-linear-agent · https://ona.com/docs/ona/integrations/overview · https://docs.warp.dev/platform/integrations/quickstart.md · https://linear.app/agents · https://linear.app/developers/agent-interaction · https://linear.app/developers/agent-best-practices · https://www.faros.ai/blog/ai-software-engineering · https://www.faros.ai/blog/are-ai-coding-assistants-really-saving · https://www.theregister.com/software/2026/02/03/github-ponders-kill-switch-for-pull-requests-to-stop-ai-slop/4334869 · https://www.danilchenko.dev/posts/2026-04-11-github-ai-agents-pull-requests/ · https://www.coderabbit.ai/blog/github-gives-maintainers-a-throttle-for-the-ai-pull-request · https://devblogs.microsoft.com/dotnet/ten-months-with-cca-in-dotnet-runtime/ · https://gigazine.net/gsc_news/en/20250522-github-copilot-coding-agent-error/ · https://www.heise.de/en/news/WTF-Microsoft-forces-Co-Authored-by-Copilot-in-commits-11279554.html · https://github.com/github/copilot-sdk/issues/1172 · https://github.com/anthropics/claude-code/issues/76162
