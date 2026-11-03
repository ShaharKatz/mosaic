# Collaboration & knowledge vendors: SDLC and agent features (state as of 2026-10-31)

Scope: Slack, Notion, Atlassian, GitHub (as a collaboration platform), knowledge layers, Slack-native engineering tools, and notable 2025–2026 peers. Linear appears only as an integration partner. Every claim links to a source. [UNVERIFIED] marks claims I could not confirm from a source.

## 1. Coverage table

| Product / framework | Category | What it is (one line) | Surfaces touched | Primary source |
|---|---|---|---|---|
| Slack platform (RTS API, MCP server, Slackbot, Slack Code) | Chat / agent host | Conversational "agentic OS" with agent APIs and code channels | chat, repo/PR (through partners), tracker (through partners) | https://slack.com/blog/news/slack-code-channels-for-agents |
| Slack AI (recaps, summaries, huddle notes, Lists, Canvases, Workflow Builder) | Chat-native AI and light work tracking | Summaries, digests, meeting notes, lightweight lists | chat, knowledge base (light), tracker (light) | https://slack.com/intl/en-au/help/articles/25076892548883-Guide-to-AI-features-in-Slack |
| Notion 3.x (Agents, Custom Agents, AI Meeting Notes, MCP, synced DBs) | Knowledge base + work DB | Workspace with autonomous agents, MCP in and out | knowledge base, tracker, chat (Slack), repo (GitHub sync) | https://www.notion.com/releases/2026-10-13 |
| Atlassian Rovo + Teamwork Graph + Rovo MCP | Agent platform over Jira/Confluence/Loom/Bitbucket | Graph-grounded agents and a hosted MCP server | tracker, knowledge base, repo/PR, release | https://developer.atlassian.com/cloud/rovo-mcp/ |
| Jira (agents in Jira, release notes), Confluence, Loom, JPD/Product Collection, Compass→DX | Tracker / KB / video / discovery | Agents as assignees; Rovo-drafted release notes | tracker, KB, release, customer feedback | https://www.atlassian.com/blog/announcements/ai-agents-in-jira |
| GitHub (Issues/sub-issues/types, Projects, Copilot Spaces, Memory, Automations, MCP, Slack app) | Repo + tracker + agent | Repo-native planning and agent memory | repo, PR, tracker, chat (Slack), release | https://github.blog/changelog/2026-10-28-github-intelligence-puts-your-code-context-and-history-to-work |
| Glean | Enterprise search / agent platform | Permissioned knowledge graph; agents-as-code | KB, chat, tracker (read) | https://www.unite.ai/glean-adds-headless-agent-building-for-claude-code-cursor-and-codex/ |
| Unblocked | Engineering context engine | Reconciles code, Slack, issues, and docs for agents | chat, repo, PR, tracker, KB | https://docs.getunblocked.com/what-is-unblocked.md |
| Dosu | Auto-documentation / knowledge infrastructure | Generates and maintains docs from PRs, issues, and chat | repo, PR, chat, KB | https://dosu.dev/llms-full.txt |
| Swimm | Code documentation, now a services company | Pivoted from SaaS to "Service as Software" | repo | https://swimm.io/blog/weve-stopped-asking-customers-to-bet-on-the-right-tool |
| DeepWiki (Cognition) | Auto-generated repo wiki | AI wiki and MCP server for public repos | repo, KB | https://cognition.com/blog/deepwiki-mcp-server |
| Axolo | Slack-native PR tool | One Slack channel per PR with two-way comment sync | chat, PR | https://axolo.co/docs/guides/features |
| Swarmia | Engineering intelligence | Slack digests and reminders; tracks AI-agent contributions | chat, PR, tracker | https://www.swarmia.com/changelog/2026-09-30-more-review-agents/ |
| incident.io | Incident management | Slack-native incidents; AI SRE; hosted MCP | chat, KB (post-mortems), customer (status pages) | https://incident.io/changelog/remote-mcp-server |
| Geekbot | Standup bot | Async standups; CLI and MCP added in 2026 | chat | https://geekbot.com/blog/geekbot-cli-and-geekbot-mcp/ |
| Sleuth | DORA / deploy tracker | Deploy "mission control" in Slack | chat, release | https://help.sleuth.io/sleuth-dora/integrations-1/slack |
| CodeRabbit Agent for Slack (peer) | Code review → Slack agent | "Second brain" that turns threads into a knowledge base | chat, PR, tracker, KB | https://adtmag.com/articles/2026/04/22/coderabbit-launches-slack-agent-aimed-at-broader-software-development-workflow.aspx |
| OpenAI Symphony (peer) | Tracker-driven agent orchestrator | Polls a tracker and runs one isolated Codex workspace per issue | tracker, repo, PR | https://github.com/openai/symphony/blob/main/elixir/README.md |
| Linear (integration partner only) | Tracker | Slack synced threads, Asks, Releases | chat, tracker, release | https://linear.app/docs/linear-asks-slack |

## 2. Per product

### Slack (Salesforce)
Salesforce frames Slack as the conversational layer of an "agentic OS" (Agentforce 360). Slack and Agentforce were consolidated under one executive ([Reworked](https://www.reworked.co/digital-workplace/slacks-rts-api-and-mcp-server-hit-general-availability/)).
- **How agents read and write Slack:** The Real-Time Search (RTS) API and the MCP server were announced 2025-10-13 and reached GA on 2026-02-17. Agents query live data that stays inside Slack, with no external storage, and results respect user permissions ([Reworked](https://www.reworked.co/digital-workplace/slacks-rts-api-and-mcp-server-hit-general-availability/)). The MCP server covers messaging, search, canvases, threads, reactions, and files. Workflow triggers, event subscriptions, slash commands, and bulk channel monitoring are available only through the Web API ([Scalekit](https://www.scalekit.com/blog/slack-mcp-vs-api)). Launch partners include ChatGPT, Codex, Claude, Agentspace, Perplexity, Dropbox Dash, and Notion AI ([Slack](https://slack.com/blog/news/powering-agentic-collaboration)).
- **Agent↔agent routing:** Since 2026-03-31, Slackbot routes requests to third-party agents. Slack's own example: in one conversation, Slackbot invokes the Vercel agent to deploy and the Linear agent to update the issue. Slackbot also supports in-meeting note-taking that executes follow-ups, scheduled automations created by asking, and "AI skills" saved in canvases ([Slack](https://slack.com/blog/news/agent-orchestration)).
- **Multi-contributor coding (Slack Code, 2026-08-20):** Mentioning a coding agent spins up a "code channel" for that task. The team sees diffs and live previews, can redirect the agent mid-task, and can route high-stakes changes to a human for approval. The channel auto-archives when the work is done and stays searchable as an audit log. Partners: Claude, Devin, GitHub Copilot, and Vercel, with ChatGPT "soon". Slack reports that more than 70% of code channels open and close within a day ([Slack](https://slack.com/blog/news/slack-code-channels-for-agents)).
- **Status and digests:** Conversation summaries (all paid plans), daily Recaps of chosen channels (Business+), huddle notes, file summaries, AI-built workflows, and enterprise search across connected apps (Enterprise+). AI answers include only content the user can access ([Slack help](https://slack.com/intl/en-au/help/articles/25076892548883-Guide-to-AI-features-in-Slack)).
- **Light tracking:** Lists (owner, due date, status) can be embedded in Canvases ([Slack](https://slack.com/intl/en-in/features/task-list)). A third-party review notes that Lists has no dependencies or cross-project reporting ([Mursa](https://www.mursa.me/blog/slack-canvas-lists-project-management)).
- **Governance and data boundary:** Since 2025-05-29, non-Marketplace commercial apps are limited to 1 request/min and 15 objects per call on `conversations.history` and `conversations.replies` ([Slack changelog](https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps/)). Apps such as Glean can no longer store Slack data in long-term indexes ([Techzine](https://www.techzine.eu/news/applications/132144/salesforce-restricts-access-to-slack-data-for-ai-use/)).

### Notion
Notion 3.0 (2025-09-18) rebuilt Notion AI as Agents that can run 20+ minutes of multi-step work and use memory stored in Notion pages ([Notion](https://www.notion.com/releases/2025-09-18)).
- **Autonomous agents:** Custom Agents launched 2026-02-24 (v3.3). They run on triggers or schedules. Notion's examples include Q&A agents in Slack, task-routing agents, and standup/status agents. Every run is logged and reversible, and admins control who can create agents. Billing moved to Notion credits on 2026-05-04 ([Notion](https://www.notion.com/releases/2026-02-24)). Custom Agents gained access to private Slack channels on 2026-05-01 ([Notion](https://www.notion.com/releases/2026-05-01)).
- **Decision capture from meetings:** Since 2026-07-31, a finished AI Meeting Note can trigger Custom Agents that update trackers, post decision recaps to Slack, and file engineering tickets ([Notion](https://www.notion.com/releases/2026-07-31)).
- **Agent read/write (v3.8, 2026-10-13):**
  - Inbound MCP lets external agents read context and update docs and trackers. Notion's example: Cursor pulls a spec from Notion, then marks the task done ([Notion 3.0](https://www.notion.com/releases/2025-09-18)).
  - Outbound MCP connects Notion's own agents to 150+ tools.
  - A Skills API syncs skills from Notion into GitHub.
  - Version history attributes each change to a person or an agent.
  - Column-level permissions apply to people and agents.
  - Admin MCP controls show who connected each tool and allow revoking access per person.
  - Synced databases for GitHub, Jira, and Salesforce were rebuilt ([Notion](https://www.notion.com/releases/2026-10-13)).
- **Repo boundary:** GitHub sync is one-way and read-only for synced properties. Edits must be made in GitHub. Users can add Notion-only properties. The legacy sync stopped updating after 2026-10-30. A shared synced database can expose private-repo data to Notion viewers who lack repo access ([Notion help](https://www.notion.com/help/github)).

### Atlassian (Rovo, Teamwork Graph, Jira, Confluence, Loom, JPD, Compass)
- **Agents as tracked teammates:** "Agents in Jira" entered open beta on 2026-02-25. Agents can be assignees, @mentioned in comments, or placed in a workflow status. They respect Jira permissions and audit trails. Third-party and MCP agents are supported, including GitHub Copilot ([Atlassian](https://www.atlassian.com/blog/announcements/ai-agents-in-jira)). The Summer 2026 release added a built-in "Delivery Agent" for recurring coordination work ([Atlassian Community](https://community.atlassian.com/forums/Jira-articles/Introducing-the-Jira-2026-Summer-Release-%EF%B8%8F/ba-p/3268349)).
- **Multiplayer protocol:** AMP (Agentic Multiplayer Protocol) was announced at Team '26 Europe on 2026-10-07.
  - Each agent has a named owner and appears in presence bars next to humans.
  - "Agent sessions" surface cloud and local agent work in Jira and the Teamwork Graph.
  - Atlassian says the graph holds 250B+ objects and now indexes code down to symbol level ([Computer Weekly](https://www.computerweekly.com/news/366652013/Atlassian-Team-26-Europe-move-to-AI-as-team-sport-with-multi-player-agentic-system)).
- **Rovo MCP Server:** GA on 2026-02-04 ([Scalekit](https://www.scalekit.com/blog/atlassian-mcp-vs-api)). It covers Jira, Confluence, JSM, Bitbucket, Loom, Goals/Projects, Teamwork Graph, and code search. Authentication is OAuth 2.1 or an API token, actions run under the user's permissions, and tools are discovered on demand. Some tools consume Rovo credits ([Atlassian dev docs](https://developer.atlassian.com/cloud/rovo-mcp/)).
- **Tracker as system of record for external orchestrators:** In 2026-08, Atlassian positioned Jira as the system of record for OpenAI Symphony ([Atlassian blog title](https://www.atlassian.com/blog/ai-at-work/jira-system-of-record-openai-symphony); body not retrievable).
- **Release notes:** Jira's Releases tab has a "Create with Rovo" option that publishes to Confluence. Automation can also run a Release Notes Drafter agent on the "Version Released" trigger ([Atlassian support](https://support.atlassian.com/jira-cloud-administration/docs/create-release-notes/), [Community lesson](https://community.atlassian.com/learning/lesson/automate-release-notes-generation-with-rovo)).
- **Loom:** "Record for agent" is in open beta. It turns a screen recording into a structured prompt for Rovo, Claude, or ChatGPT, or into Jira work items ([Atlassian](https://www.atlassian.com/blog/loom/record-for-agents)).
- **Discovery and customer feedback:** Product Collection (early access, Team '26) combines JPD, a new Feedback tool, and Rovo, linking feedback to delivery in Jira ([Computer Weekly](https://www.computerweekly.com/blog/CW-Developer-Network/Atlassian-introduces-Product-Collection-for-AI-developer-decisions)).
- **Deprecation:** Compass stopped selling on 2026-05-13 and ends on 2027-12-31. Its catalog and scorecards move to DX ([Atlassian Community](https://community.atlassian.com/forums/Compass-articles/The-Next-Chapter-for-Compass/ba-p/3235743)). Atlassian agreed to buy DX for about $1B in 2025-09 ([SiliconANGLE](https://siliconangle.com/2025/09/18/atlassian-acquires-developer-productivity-startup-dx-1b/)).

### GitHub
- **Tracker primitives:** Sub-issues, issue types, and advanced search went GA on 2025-04-09 ([GitHub](https://github.blog/changelog/2025-04-09-evolving-github-issues-and-projects/)).
- **Chat intake:** Since 2026-03-30, `@GitHub` in Slack creates issues and sub-issues from natural language. A thread can be used to refine the issue before creation, and channels can set a default repository ([GitHub](https://github.blog/changelog/2026-03-30-create-issues-from-slack-with-copilot/)). The Copilot coding agent has been usable from Slack since 2025-10-28 (same source).
- **Shared context and memory:**
  - Copilot Spaces went GA on 2025-09-24 and got an API on 2026-05-18 ([GitHub](https://github.blog/changelog/2026-05-18-copilot-spaces-api-now-generally-available/)).
  - Copilot Memory went GA on 2026-10-28 with personal and repository memories.
  - "Dreaming" (preview) proposes changes to checked-in skills and instructions as PRs for human review ([GitHub](https://github.blog/changelog/2026-10-28-github-intelligence-puts-your-code-context-and-history-to-work)).
- **Shared automations (2026-10-28):** Automations are owned by the repository and can be edited by anyone with write access. Actions are attributed to Copilot rather than a person, the repo owner is billed, and change history is kept ([GitHub](https://github.blog/changelog/2026-10-28-build-shared-workflows-for-your-team-with-copilot-automations)).
- **MCP:** The remote GitHub MCP server went GA on 2025-09-04 with OAuth 2.1 + PKCE ([GitHub](https://github.blog/changelog/2025-09-04-remote-github-mcp-server-is-now-generally-available/)). A lockdown mode for untrusted public-repo content followed on 2025-12-10 ([GitHub](https://github.blog/changelog/2025-12-10-the-github-mcp-server-adds-support-for-tool-specific-configuration-and-more/)).
- Discussions: I found no 2025–26 agent features for Discussions [UNVERIFIED].

### Knowledge layers
- **Glean:** Permissioned graph over 275+ sources. Since 2026-10-21 (GA), agents can be authored as code (`spec.yaml` plus `instructions.md`) from Claude Code, Cursor, or Codex, reviewed in PRs, and published to Glean's runtime with an audit trail ([Unite.AI](https://www.unite.ai/glean-adds-headless-agent-building-for-claude-code-cursor-and-codex/)). Glean's MCP servers support per-server approvals for write actions ([Releasebot](https://releasebot.io/updates/glean)).
- **Unblocked:** Indexes GitHub/GitLab, Slack/Teams, Confluence, Linear, Jira, Datadog, Sentry, and more. It reconciles sources that contradict each other and cites its answers. Delivery channels: MCP, PR review, Slack/Teams, CLI, and API. Access controls mirror the source systems ([Unblocked docs](https://docs.getunblocked.com/what-is-unblocked.md)).
- **Dosu:** Watches code, PRs, issues, and conversations to generate and maintain docs, AGENTS.md, and skills. Integrates with GitHub, Slack, and Discord, imports from and exports to Confluence and Notion, and offers an MCP server and OpenAPI. It open-sourced its auto-label and stale-issue bots ([Dosu](https://dosu.dev/llms-full.txt)).
- **DeepWiki:** Free MCP server (2025-05-22) with tools `ask_question`, `read_wiki_contents`, and `read_wiki_structure` for indexed public repos. Private repos require a Devin account ([Cognition](https://cognition.com/blog/deepwiki-mcp-server)). Cognition acquired Windsurf in 2025-07 ([Cognition](https://cognition.ai/blog/windsurf)).
- **Swimm:** In 2026-05 it moved from SaaS to a services model focused on legacy modernization ([Swimm](https://swimm.io/blog/weve-stopped-asking-customers-to-bet-on-the-right-tool)).

### Slack-native engineering tools
- **Axolo:** Creates one Slack channel per PR. Slack messages become GitHub comments and review comments become Slack threads. Other features: CI check summaries, a deployments channel, daily open-PR stand-up summaries, `/lgtm` to approve, self-assigning as reviewer via a 🔍 reaction, reviewer time slots, and bookmarks linking the Jira/Linear ticket ([Axolo docs](https://axolo.co/docs/guides/features)).
- **Swarmia:** Review reminders and digests posted to Slack or Teams team channels ([Swarmia help](https://help.swarmia.com/settings/team/team-notifications)). It auto-detects AI agents such as Devin, Graphite, and Greptile and compares their throughput and review share ([Swarmia](https://www.swarmia.com/changelog/2026-09-30-more-review-agents/)). Its MCP server can take actions as of 2026-10-19 ([Swarmia](https://www.swarmia.com/changelog/2026-10-19-mcp-actions)).
- **incident.io:** Incidents run from Slack with `/inc` commands and AI post-mortems ([incident.io](https://incident.io/incident-response-slack)). A hosted MCP server entered public beta on 2026-03-31 with user OAuth that inherits user permissions; it can draft on-call handovers to post in Slack. AI SRE is in private beta ([incident.io](https://incident.io/changelog/remote-mcp-server)).
- **Geekbot:** Added a CLI and MCP server on 2026-07-09. Agents draft standups from merged PRs and Jira tickets, but every write requires human approval. It also produces AI weekly rollups ([Geekbot](https://geekbot.com/blog/geekbot-cli-and-geekbot-mcp/)).
- **Sleuth:** Deploy "mission control" in Slack ([Sleuth](https://help.sleuth.io/sleuth-dora/integrations-1/slack)). A competitor claims Sleuth was acquired in late 2024 [UNVERIFIED] ([PanDev](https://pandev-metrics.com/docs/blog/best-sleuth-alternative-2026)).

### Peers
- **CodeRabbit Agent for Slack (2026-04-22):** Captures decisions and conversations into a continuously updated knowledge base and works inside shared threads ([ADTmag](https://adtmag.com/articles/2026/04/22/coderabbit-launches-slack-agent-aimed-at-broader-software-development-workflow.aspx)).
- **OpenAI Symphony:**
  - Polls Linear, GitHub Issues, Jira, Asana, or GitLab and creates one workspace per issue.
  - Keeps an issue claimed while blocked, but blocked state is held only in memory.
  - Stops the agent when the issue reaches a terminal state.
  - Keeps tracker tokens host-side.
  - Its Linear workflow expects custom "Human Review" and "Merging" statuses ([README](https://github.com/openai/symphony/blob/main/elixir/README.md)).
- **Linear (partner):**
  - Slack threads sync two ways with issue comments ([Linear](https://linear.app/integrations/slack)).
  - Asks turn Slack messages into issues, even for non-Linear users ([Linear](https://linear.app/docs/linear-asks-slack)).
  - Releases (2026-04-30) track deploy state from CI and generate release notes with Linear Agent ([Linear](https://linear.app/changelog/2026-04-30-releases)).

## 3. Cross-cutting patterns

1. **Every tool claims to be the system of record, in its own layer.** The repo/GitHub owns code plus memory and skills. Jira says it is "where agents own meaningful parts of work". Notion pitches itself as "a durable shared place" for context across agents. Slack pitches the conversation as the real work and code channels as the audit log. Sources: [Jira](https://www.atlassian.com/blog/announcements/ai-agents-in-jira), [Notion 3.8](https://www.notion.com/releases/2026-10-13), [Slack Code](https://slack.com/blog/news/slack-code-channels-for-agents).
2. **"Multiplayer" agents replacing single-player sessions.** The same framing appears in Slack Code, Atlassian AMP, and Jira agent sessions, all aimed at making agent work visible to the team.
3. **MCP is the universal read/write layer, scoped to the user.**
   - Hosted with OAuth and per-user permissions: Slack, Notion, Rovo, GitHub, incident.io, Geekbot, Dosu, Unblocked, Glean.
   - Tools discovered on demand to save context: Rovo, GitHub tool configuration.
4. **Turning chat into durable records.**
   - Bidirectional thread sync: Linear, Axolo.
   - Chat to issue: GitHub `@GitHub`, Linear Asks.
   - Meeting to tracker: Notion meeting-note trigger, Slackbot meeting execution, Loom action items.
   - Chat to knowledge base: CodeRabbit, Dosu, Unblocked.
5. **Agents as identifiable, accountable actors.**
   - Jira assignee agents; AMP agent owners and presence.
   - GitHub shared automations act as "Copilot"; Notion attributes agent edits.
   - Swarmia detects which agent produced which change.
6. **Scheduled digests produced by agents.** Slack Recaps, Notion status agents, Geekbot rollups, Axolo stand-up PR summaries, Swarmia digests, Linear agent-drafted project updates ([Linear summary](https://spyingbee.com/updates/linear/2026-06)).
7. **Human approval gates inside the agent loop.** Slack Code approvals, Geekbot human-in-the-loop writes, GitHub Dreaming opening PRs for review, Glean write-action approvals, Symphony's "Human Review" status.
8. **Release notes generated from tracker state.** Jira/Rovo to Confluence; Linear Releases from CI. Customer-facing announcement tooling remains thin: Atlassian itself publishes its release notes via LaunchNotes ([jirareleases](https://jirareleases.atlassian.com/announcements/rovo-search-is-now-in-jira)).
9. **Skills and instructions as shared artifacts.** Notion Skills API to GitHub, Slackbot skills in canvases, GitHub repo memories and skills, Dosu-maintained AGENTS.md, Glean agents-as-code.

## 4. Weaknesses, gaps, complaints

- **Prompt-injection risk in collaborative surfaces.**
  - Notion 3.0 agents: data could be exfiltrated through the web-search tool via a poisoned PDF ([Simon Willison](https://simonwillison.net/2025/Sep/19/notion-lethal-trifecta/), [PromptArmor](https://www.promptarmor.com/resources/notion-ai-unpatched-data-exfiltration)). A similar issue was filed against Notion's MCP server ([GitHub #238](https://github.com/makenotion/notion-mcp-server/issues/238)).
  - GitHub MCP: a "toxic agent flow" where a public-repo issue led to a private-repo leak. Invariant Labs says this is architectural, not fixable by a server patch ([Invariant Labs](https://invariantlabs.ai/blog/mcp-github-vulnerability)).
- **Restricted data access.** Slack's rate limits and storage ban on non-Marketplace apps narrow third-party indexing of Slack ([Slack](https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps/), [CDO Magazine](https://www.cdomagazine.tech/aiml/slack-tightens-data-access-rules-blocking-third-party-apps-from-storing-messages)). Reworked notes that experts flagged governance concerns as third-party integrations expand ([Reworked](https://www.reworked.co/digital-workplace/slacks-rts-api-and-mcp-server-hit-general-availability/)).
- **Unpredictable usage-based costs.** One user reported about 760 Rovo credits spent on a single Bitbucket PR review. Overage billing starts 2026-12-03 at $0.01/credit. Users have complained Rovo cannot be turned off ([Atlassian Community](https://community.atlassian.com/forums/Bitbucket-questions/Rovo-Dev-insanely-high-credit-usage-for-quot-Code-review-in/qaq-p/3180413), [bleulemon](https://www.bleulemon.fr/en/blog-rovo-credits), [Protege](https://www.tryprotege.com/blog/atlassian-rovo-complete-guide)). Notion Custom Agents also moved to paid credits ([Notion](https://www.notion.com/releases/2026-02-24)).
- **Agent noise in chat.** A user reported "10+ AI agents into Slack... information overflow" ([X](https://x.com/joshua_xu_/status/2050398954614087904)).
- **Brittle generation.** The Rovo release-notes agent asked "which project?" until the prompt was fixed. The rich-text description of a Jira version can't be reliably read or written through REST ([Community](https://community.atlassian.com/forums/Jira-questions/Not-Having-Success-automating-Release-Notesa/qaq-p/3182264), [Community](https://community.atlassian.com/forums/Rovo-questions/Feasibility-of-Automating-Release-Notes-with-Jira-Automation-and/qaq-p/3167778)).
- **Integration limits.**
  - Forge-based Rovo agents lack related Teamwork Graph data ([Atlassian dev community](https://community.developer.atlassian.com/t/lack-of-access-to-related-data-from-teamwork-graph-for-forge-based-rovo-agents/94332)).
  - Notion's GitHub sync is read-only, excludes PR review details, and drops pages outside the history window ([Notion help](https://www.notion.com/help/github)).
  - Linear's synced threads don't work in DMs ([Linear](https://linear.app/docs/slack)).
  - Slack Lists lacks dependencies ([Mursa](https://www.mursa.me/blog/slack-canvas-lists-project-management)).
- **Unclear claim/ownership semantics across tools.** Symphony loses its blocked/claim map on restart, and its raw tracker tools reach anything the token can access ([README](https://github.com/openai/symphony/blob/main/elixir/README.md)). I found no vendor offering cross-tool conflict detection between concurrent human/agent contributors [UNVERIFIED: absence of evidence].
- **Vendor churn.** Compass is being sunset into DX; Swimm left SaaS; legacy Notion GitHub syncs stopped updating after 2026-10-30.

## 5. Sources
Slack: https://slack.com/blog/news/slack-code-channels-for-agents · https://slack.com/blog/news/agent-orchestration · https://slack.com/blog/news/powering-agentic-collaboration · https://www.reworked.co/digital-workplace/slacks-rts-api-and-mcp-server-hit-general-availability/ · https://www.scalekit.com/blog/slack-mcp-vs-api · https://slack.com/intl/en-au/help/articles/25076892548883-Guide-to-AI-features-in-Slack · https://slack.com/intl/en-in/features/task-list · https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps/ · https://www.techzine.eu/news/applications/132144/salesforce-restricts-access-to-slack-data-for-ai-use/
Notion: https://www.notion.com/releases/2025-09-18 · https://www.notion.com/releases/2026-02-24 · https://www.notion.com/releases/2026-05-01 · https://www.notion.com/releases/2026-07-31 · https://www.notion.com/releases/2026-10-13 · https://www.notion.com/help/github
Atlassian: https://www.atlassian.com/blog/announcements/ai-agents-in-jira · https://developer.atlassian.com/cloud/rovo-mcp/ · https://www.computerweekly.com/news/366652013/Atlassian-Team-26-Europe-move-to-AI-as-team-sport-with-multi-player-agentic-system · https://www.computerweekly.com/blog/CW-Developer-Network/Atlassian-introduces-Product-Collection-for-AI-developer-decisions · https://www.atlassian.com/blog/loom/record-for-agents · https://support.atlassian.com/jira-cloud-administration/docs/create-release-notes/ · https://community.atlassian.com/learning/lesson/automate-release-notes-generation-with-rovo · https://community.atlassian.com/forums/Compass-articles/The-Next-Chapter-for-Compass/ba-p/3235743 · https://siliconangle.com/2025/09/18/atlassian-acquires-developer-productivity-startup-dx-1b/ · https://www.atlassian.com/blog/ai-at-work/jira-system-of-record-openai-symphony
GitHub: https://github.blog/changelog/2025-04-09-evolving-github-issues-and-projects/ · https://github.blog/changelog/2026-03-30-create-issues-from-slack-with-copilot/ · https://github.blog/changelog/2026-10-28-github-intelligence-puts-your-code-context-and-history-to-work · https://github.blog/changelog/2026-10-28-build-shared-workflows-for-your-team-with-copilot-automations · https://github.blog/changelog/2025-09-04-remote-github-mcp-server-is-now-generally-available/ · https://github.blog/changelog/2026-05-18-copilot-spaces-api-now-generally-available/
Knowledge layers and tools: https://www.unite.ai/glean-adds-headless-agent-building-for-claude-code-cursor-and-codex/ · https://docs.getunblocked.com/what-is-unblocked.md · https://dosu.dev/llms-full.txt · https://cognition.com/blog/deepwiki-mcp-server · https://swimm.io/blog/weve-stopped-asking-customers-to-bet-on-the-right-tool · https://axolo.co/docs/guides/features · https://www.swarmia.com/changelog/2026-09-30-more-review-agents/ · https://incident.io/changelog/remote-mcp-server · https://geekbot.com/blog/geekbot-cli-and-geekbot-mcp/ · https://help.sleuth.io/sleuth-dora/integrations-1/slack · https://adtmag.com/articles/2026/04/22/coderabbit-launches-slack-agent-aimed-at-broader-software-development-workflow.aspx · https://github.com/openai/symphony/blob/main/elixir/README.md · https://linear.app/docs/linear-asks-slack · https://linear.app/changelog/2026-04-30-releases
Criticism: https://simonwillison.net/2025/Sep/19/notion-lethal-trifecta/ · https://invariantlabs.ai/blog/mcp-github-vulnerability · https://community.atlassian.com/forums/Bitbucket-questions/Rovo-Dev-insanely-high-credit-usage-for-quot-Code-review-in/qaq-p/3180413 · https://www.bleulemon.fr/en/blog-rovo-credits · https://x.com/joshua_xu_/status/2050398954614087904
