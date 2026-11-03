# Process frameworks: how they handle communication among multiple contributors (humans and AI agents)

Scope: established SDLC/process/governance frameworks and their published 2025–2026 updates for AI. As of 2026-10-31. Market description only.

## 1. Coverage table

| Framework | Category | What it is | Surfaces touched | Primary source |
|---|---|---|---|---|
| Scrum (2020 Guide + 2025 Expansion Pack + 2026 "AI and Scrum") | Team framework | Sprints, 3 accountabilities, 3 commitments | tracker, repo (DoD), stakeholder review | https://scrumexpansion.org/ai-and-scrum/2026.1 |
| Kanban Guide (May 2025) | Flow method | Definition of Workflow plus 4 flow metrics | tracker/board | https://kanbanguides.org/the-kanban-guide/2025.5/ |
| SAFe 6 → AI-Native SAFe (Sep 2026) | Scaled framework | ARTs, PI Planning, release on demand | tracker, planning board, release, customer | https://framework.scaledagile.com/blog/safe-summit-keynote-recap-launching-the-operating-model-for-the-age-of-ai |
| LeSS | Scaled Scrum | One PO, one backlog, many teams | tracker, sync, code | https://less.works/less/framework/index |
| Shape Up | Product process | Pitches, betting table, 6+2-week cycles, hill charts | written pitches, project tool | https://basecamp.com/shapeup |
| Spotify model | Org model | Squads, tribes, chapters, guilds | org/chat | https://www.jeremiahlee.com/posts/failed-squad-goals/ |
| Team Topologies (2nd ed. 2025) | Org design | 4 team types, 3 interaction modes | team APIs, platforms | https://teamtopologies.com/key-concepts |
| DORA 2025 + AI Capabilities Model | Research/metrics | AI-as-amplifier and 7 capabilities | repo, platform | https://cloud.google.com/blog/products/ai-machine-learning/introducing-doras-inaugural-ai-capabilities-model |
| SPACE / DX Core 4 | Metrics | Productivity measurement frameworks | none (measurement) | https://getdx.com/research/measuring-developer-productivity-with-the-dx-core-4/ |
| InnerSource (Trusted Committer) | OSS-inside-company | Cross-team contribution roles | repo, PR | https://patterns.innersourcecommons.org/p/trusted-committer |
| GitLab handbook-first | Company operating system | Handbook as SSoT, async, DRI | chat, tracker, KB, repo, MR | https://handbook.gitlab.com/handbook/communication/ |
| Amazon Working Backwards / narratives | Decision process | PR/FAQ, 6-page memos, silent reading | docs, customer (mock PR) | https://workingbackwards.com/concepts/working-backwards-pr-faq-process/ |
| Rust RFCs / K8s KEPs / PEPs / Oxide RFDs / Google design docs | Design-decision processes | Proposals as versioned docs with states | repo, PR, forum, release | https://github.com/rust-lang/rfcs |
| ADRs (Nygard) | Decision log | Immutable numbered decisions in the repo | repo | https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions |
| Apache Way | OSS governance | Public lists, lazy consensus, votes | mailing list, repo, release | https://community.apache.org/contributors/mailing-lists.html |
| Thoughtworks Radar Vol 34 (Apr 2026) | Analyst guidance | Agent-era techniques (Adopt/Trial/Caution) | repo, agent harness | https://www.thoughtworks.com/radar |
| AWS AI-DLC (Jul 2025; awslabs/aidlc-workflows) | AI-native SDLC | AI plans, humans approve, mob rituals, "bolts" | repo, chat (gates) | https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle |

## 2. Per framework

### Scrum (+ Expansion Pack, + AI and Scrum)
The Scrum Guide 2020 still defines the framework. Jocham, Coleman and Sutherland published the Scrum Guide Expansion Pack v1.0 in June 2025. It treats Scrum as mutable, while the 2020 Guide calls it immutable ([SGEP AI](https://scrumexpansion.org/ai-and-scrum/2026.1), [PDF](https://scrumexpansion.org/scrum-guide-expanded/2025.6/pdf/scrum-guide-expansion-pack.en.pdf)).
- **Cadence:** Sprint Planning, Daily Scrum, Sprint Review and Retrospective. The Review "should never be considered a gate to releasing value" ([Scrum.org/Hodgson](https://www.scrum.org/resources/blog/your-ai-agents-can-deliver-scrum-what-governs-them)).
- **Artifacts:** Product Backlog with the Product Goal, Sprint Backlog with the Sprint Goal, and the Increment with the Definition of Done. SGEP splits Done into a "Definition of Output Done" and a "Definition of Outcome Done" ([SGEP AI](https://scrumexpansion.org/ai-and-scrum/2026.1)).
- **AI agents:** "AI and Scrum" v2026.1 (Jan 18, 2026) holds that humans stay accountable: "AI may recommend, but humans decide". It proposes a working agreement that sets agent boundaries and "fast manual stop or override mechanisms". It also proposes flagging AI-generated work items and expanding the Sprint Review to cover how AI was used ([SGEP AI](https://scrumexpansion.org/ai-and-scrum/2026.1)).
- **Practitioner case (Scrum.org, Oct 2, 2026):** a team of 8 AI agents with one human PO. Every norm is a document the agent reads before acting: a team canvas, a single versioned DoD file (a second copy is treated as a defect), skill files, and a constraints register of 20+ failure modes. A Scrum Master agent keeps Jira accurate and never does production work. Release sits at an "irreversibility boundary" that a human owns. When the author scales to multiple humans, each human governs their own agent team, and the human Scrum Team acts as the Nexus Integration Team ([Hodgson](https://www.scrum.org/resources/blog/your-ai-agents-can-deliver-scrum-what-governs-them)).
- **Credentials:** Scrum.org sells PSM-AI and PSPO-AI Essentials certifications ([Scrum.org](https://www.scrum.org/resources/blog/aws-ai-dlc-why-ai-coding-still-needs-human-accountability)). Scrum Alliance's output is mainly courses and microcredentials ([Scrum Alliance](https://resources.scrumalliance.org/Course/ai-agility-comprehensive-introduction)). I found no normative Scrum Alliance agent-team guidance [UNVERIFIED].

### Kanban Guide (2025.5)
- **Artifacts:** a Definition of Workflow that sets work-item units, start and finish points, WIP control, explicit policies and an SLE. Four flow metrics are mandatory: WIP, Throughput, Work Item Age and Cycle Time.
- **Cadence:** none required. Changes to the workflow can be made "just-in-time" without waiting for a formal meeting ([Kanban Guide](https://kanbanguides.org/the-kanban-guide/2025.5/)).
- **Gaps:** no roles, release or stakeholder communication model, and no AI guidance in the guide.

### SAFe 6 → AI-Native SAFe
- **Cadence:** PI Planning is "typically a 2-day event for the entire ART that takes place every 8-12 weeks", led by the RTE. Outputs are committed PI objectives and an ART planning board showing feature dates and dependencies. The official tool is piplanning.io ([PI Planning](https://framework.scaledagile.com/pi-planning)).
- **Release:** "Develop on cadence. Release on demand." Release is decoupled from deployment so that "Product Marketing can target promotional activities" and sales can schedule with confidence ([RoD](https://framework.scaledagile.com/release-on-demand)).
- **Sync events:** System Demo and ART Sync (Coach Sync plus PO Sync) are documented SAFe events. I could not fetch those pages (HTTP 403), so their details are [UNVERIFIED].
- **AI:** AI-Native SAFe was released Sep 15, 2026 and coexists with "Core SAFe". Changes:
  - PI Planning becomes "PI Outcome Planning".
  - Experiments and Prototypes are added as new work items.
  - Fixed roles give way to capabilities: Product, Builder, Domain Expert and AI.
  - Teams set their own cadence around Align, Sense and Respond.
  - A new "AI Value Architect" change agent is added ([recap](https://framework.scaledagile.com/blog/safe-summit-keynote-recap-launching-the-operating-model-for-the-age-of-ai)).
  - AI-Native Teams have 3–7 humans "augmented with AI" and work human-in-the-loop. Flow-based teams operate inside a cadence-based ART ([AI-Native Teams](https://framework.scaledagile.com/ain-safe-ai-native-teams)).

### LeSS
One Product Owner and one Product Backlog serve multiple teams. Events are Sprint Planning One and Two, an Overall Retrospective and a joint Sprint Review. A dedicated "Coordination & Integration" section covers cross-team work, and communities are a structural element ([LeSS framework](https://less.works/less/framework/index)). I found no AI update [UNVERIFIED].

### Shape Up (Basecamp)
- **Cadence:** six-week cycles followed by a two-week cool-down. The betting table meets during cool-down. At Basecamp it is the CEO, CTO, a senior programmer and the product strategist, in a call of 1–2 hours. "There's no 'step two'" and no backlog. Only one cycle is bet at a time ([Betting Table](https://basecamp.com/shapeup/2.2-chapter-08)).
- **Shaping:** a small senior group shapes written pitches in parallel with the cycle. Pitches set an appetite instead of an estimate ([Intro](https://basecamp.com/shapeup/0.3-chapter-01)).
- **Ownership and limits:** the team owns its scope. A circuit breaker means no extensions by default.
- **Status:** hill charts give "status without asking". Teams drag scopes uphill (unknowns) or downhill (execution), and each update is logged on the project. A dot that doesn't move "is effectively a raised hand" ([Show Progress](https://basecamp.com/shapeup/3.4-chapter-13)).
- **AI:** none published [UNVERIFIED].

### Spotify model
Squads, tribes, chapters and guilds. An ex-Spotify PM reports the model was "only ever aspirational and never fully implemented". Spotify "did not define a common process for cross-team collaboration", and managers had little responsibility beyond career development ([Lee](https://www.jeremiahlee.com/posts/failed-squad-goals/)).

### Team Topologies
- **Model:** four team types and three interaction modes: Collaboration, X-as-a-Service and Facilitating ([key concepts](https://teamtopologies.com/key-concepts)). The second edition came out in 2025 ([book](https://teamtopologies.com/book)).
- **AI (Aug 2026, Skelton):** the authors move from "construction boundaries" to "stewardship boundaries". They map team cognitive load to agent context windows. Every agent and automated workflow should be "governed by a specific, long-lived team" responsible for traceability and auditability ([TT AI age](https://teamtopologies.com/news-blogs-newsletters/team-topologies-for-the-ai-age-stewardship-of-value-flow)).
- They also frame Team Topologies as "infrastructure for agency" and warn against "unbounded access to data… by AI tools and agents" ([keynote](https://teamtopologies.com/keynote-talks/team-topologies-as-the-infrastructure-for-agency-with-ai)).

### DORA (2025)
- **Rename and metrics:** the report is now "State of AI-assisted Software Development" (no longer "Accelerate State of DevOps"), and the four metrics have become five ([year in review](https://dora.dev/insights/dora-2025-year-in-review)). The fifth is rework rate ([Radar](https://www.thoughtworks.com/radar/techniques/summary/dora-metrics)).
- **Findings:** 90% AI adoption, and 30% report little or no trust in AI-generated code. "AI doesn't fix a team; it amplifies what's already there" ([announcement](https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report)).
- **Throughput vs stability:** higher adoption goes with higher throughput *and* higher instability. DORA describes a "verification tax" ([DORA tensions](https://dora.dev/insights/balancing-ai-tensions/)).
- **AI Capabilities Model:** seven capabilities, published as a full report in December 2025 ([capabilities](https://cloud.google.com/blog/products/ai-machine-learning/introducing-doras-inaugural-ai-capabilities-model)):
  1. Clear and communicated AI stance
  2. Healthy data ecosystems
  3. AI-accessible internal data
  4. Strong version control
  5. Small batches
  6. User-centric focus
  7. Quality internal platforms

### SPACE / DX Core 4
DX Core 4 "encapsulates DORA, SPACE, and DevEx". It weights speed and output metrics, including diffs per engineer, equally with the Developer Experience Index. DX itself urges caution with throughput metrics ([DX](https://getdx.com/research/measuring-developer-productivity-with-the-dx-core-4/)). Neither framework covers communication surfaces. The ACM SPACE paper returned HTTP 403 [UNVERIFIED detail].

### InnerSource: Trusted Committer
The Trusted Committer role recognizes frequent cross-team contributors and helps maintainers scale support. Each project documents the scope of the role itself ([pattern](https://patterns.innersourcecommons.org/p/trusted-committer)). The catalogue also includes "Transparent Cross-Team Decision Making using RFCs" (same source).

### GitLab: handbook-first, async, DRI
- **Where things live:** "Discussion in issues or Merge Requests is preferred over everything else." The issue description "should be the single source of truth".
- **Slack:** only 90 days are retained, so Slack must not be used for approvals, decisions or official records.
- **Announcements:** major decisions go out on several channels at once, each linking to the single source of truth (the handbook, an epic, an issue or a doc). The Slack message is never the source of truth.
- **Meetings:** every meeting has notes so people can participate async ([Communication](https://handbook.gitlab.com/handbook/communication/)).
- **DRI:** one person has the final say ([DRI](https://handbook.gitlab.com/handbook/people-group/directly-responsible-individuals)).

### Amazon Working Backwards and narratives
- **PR/FAQ:** a mock press release, an external FAQ written for customers and press, and an internal FAQ written for stakeholders.
- **Review meetings:** 15–20 minutes of silent reading with inline comments, then about 40 minutes of discussion. Reviews aim at "truth-seeking vs. selling". The process often takes months of drafts before a product is approved ([PR/FAQ](https://workingbackwards.com/concepts/working-backwards-pr-faq-process/)).
- **Narratives:** six pages maximum for a one-hour meeting. Narratives replace slides except in one-to-many meetings or metrics-only meetings such as the WBR ([Narratives](https://workingbackwards.com/concepts/narratives-decision-making/)).

### RFC and design-doc processes
- **Rust:** an RFC is a markdown file in a PR. A sub-team member proposes a "motion for final comment period" with a disposition: merge, close or postpone. Consensus among all thread participants is not required ([rust-lang/rfcs](https://github.com/rust-lang/rfcs)).
- **Kubernetes KEP:** `kep.yaml` status is one of provisional, implementable, implemented, deferred, rejected, withdrawn or replaced. One SIG owns each KEP, and approvers span the impacted SIGs, under a DACI model ([KEP process](https://raw.githubusercontent.com/kubernetes/enhancements/master/keps/sig-architecture/0000-kep-process/README.md)).
- **PEP:** the elected Steering Council is the final authority. A sponsor or PEP-Delegate and PEP Editors manage the workflow ([PEP 1](https://peps.python.org/pep-0001/)).
- **Oxide RFD:** six states: prediscussion, ideation, discussion, published, committed and abandoned. Rough work iterates on a branch, discussion happens in a PR, and comments continue after publication ([RFD 1](https://rfd.shared.oxide.computer/rfd/0001)).
- **Google design docs:** sections include Context and scope and Alternatives considered. Separate privacy design docs and security reviews are required by launch ([Ubl](https://www.industrialempathy.com/posts/design-docs-at-google/)).

### ADRs
ADRs live in the repo as `doc/arch/adr-NNN.md`, numbered monotonically. A reversed decision is kept and marked "superseded" ([Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)). AI-DLC's Domain Design stage writes `decisions.md` (ADRs) ([AI-DLC stages](https://awslabs.github.io/aidlc-workflows/guide/04-phases-and-stages/)).

### Apache Way
- **Mailing list as record:** "If it didn't happen on the mailing list, it didn't happen." Synchronous chat suits end-user support, but decisions must be taken back to the list ([ASF lists](https://community.apache.org/contributors/mailing-lists.html)). Private decisions are disallowed ([Apache Way](https://www.apache.org/theapacheway/)).
- **Lazy consensus:** state your intent publicly and wait, usually 72 hours. Silence means consent ([decision making](https://community.apache.org/committers/decisionMaking.html)).
- **AI:** the ASF's Generative Tooling Guidance recommends naming the tool in commit messages with a `Generated-by:` token, for future Tooling-Provenance release files ([ASF](https://www.apache.org/legal/generative-tooling.html), [RAI](https://rai.apache.org/policy-recommendations.html)).

### Thoughtworks Technology Radar Vol 34 (Apr 2026; Vol 35 webinar pending)
- **Adopt:** "Curated shared instructions" (AGENTS.md/CLAUDE.md in service templates) and DORA metrics.
- **Trial:** Agent Skills and feedback sensors for coding agents.
- **Assess:**
  - "Team of coding agents": an orchestrator plus peer messaging.
  - "Measuring collaboration quality with coding agents": first-pass acceptance, iteration cycles, review burden, tracked at team level.
  - Spec-driven tools (Spec Kit, OpenSpec).
- **Caution:**
  - "Coding agent swarms", whose emerging patterns include a durable work ledger (beads) and a merge mechanism.
  - "Codebase cognitive debt", which is worse "with multiple contributors".
  - Coding throughput as a productivity measure.
- **Themes:** "We may need to consider agent topologies alongside team topologies" ([Radar](https://www.thoughtworks.com/radar); blip text at [techniques](https://www.thoughtworks.com/en-cl/radar/techniques/summary/coding-agent-swarms)).

### AWS AI-DLC (blog Jul 31, 2025; awslabs/aidlc-workflows)
- **Core loop:** AI creates a plan, asks clarifying questions, and implements only after human validation.
- **Rituals:** Mob Elaboration and Mob Construction. "Bolts" (hours or days) replace sprints, and Units of Work replace epics. Plans, requirements and designs persist in the repo ([AWS](https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle)).
- **Structure:** the workflows repo has 5 phases and 33 stages. Every stage ends with an approval gate that "needs a real message from you". Verification gates sit at phase boundaries, and audit shards are kept.
- **Team mode:** with "Unit Ownership: team", "each person claims a Unit and builds it in their own checkout". A claim is refused until the Unit's dependencies are complete.
- **Agents:** role agents (product, architect, delivery, quality) run as mobs or hub-and-spoke ([stages](https://awslabs.github.io/aidlc-workflows/guide/04-phases-and-stages/)).

## 3. Cross-cutting patterns

1. **Chat is ephemeral and the written record is canonical.** GitLab: Slack is never for decisions. Apache: "didn't happen on the list". Amazon: decisions run on narratives. Rust, KEP and RFD: decisions happen in PRs.
2. **Documents carry explicit lifecycle states.** KEP status, RFD states, Rust FCP dispositions, ADR "superseded", AI-DLC stage markers.
3. **A single accountable human decider.** GitLab DRI, Scrum PO, Shape Up betting table, PEP Steering Council or Delegate, the SAFe RTE and Business Owners, KEP approvers.
4. **Claims and ownership boundaries for parallel work.** AI-DLC Unit claims gated on dependencies; Team Topologies stewardship boundaries; KEP owning SIG; Shape Up's uninterrupted teams.
5. **Status by artifact, not by meeting.** Hill charts, Kanban flow metrics, the SAFe ART planning board, GitLab issue descriptions as the single source of truth.
6. **Silence as consent, time-boxed.** Apache lazy consensus (72h) and Rust FCP.
7. **Release decoupled from deployment, with customer messaging as an explicit step.** SAFe Release on Demand (marketing and sales), Amazon's mock PR and external FAQ. Most of the other frameworks say little about customer announcements.
8. **AI updates converge on "agents produce, humans are accountable."** Covered by SGEP, AI-Native SAFe, Team Topologies, AI-DLC gates, Kubernetes and Ghostty.
9. **Norms as machine-readable repo files.** Single DoD file and skill files (Scrum.org case), AGENTS.md/CLAUDE.md (Radar Adopt), AI-DLC memory files, ASF `Generated-by:` trailers.
10. **Metrics move away from output.** DORA's rework rate, Radar's collaboration quality, DX's caution on diffs per engineer.

## 4. Weaknesses, gaps and complaints

- **SAFe:** criticized as "top-down, large-batch planning" that "scales up the solution rather than scaling down the problem" ([Geraghty](https://tomgeraghty.co.uk/index.php/a-short-critique-of-safe/)). PI Planning "too often leads to fragile plans" ([Humanizing Work](https://www.humanizingwork.com/pi-planning-is-broken-heres-a-better-way/)).
- **Spotify:** the model was never implemented and had no cross-team process ([Lee](https://www.jeremiahlee.com/posts/failed-squad-goals/)).
- **AI-DLC:** Scrum.org's Dave West (Aug 4, 2026) says it has no Product Goal, no stakeholder review and no retrospective. Its "events are internal". Its "continuous" feedback "never gets defined" ([Scrum.org](https://www.scrum.org/resources/blog/aws-ai-dlc-why-ai-coding-still-needs-human-accountability)).
- **Agent teams:** agents have no informal channels, so weak governance shows up as "silent failure". Two DoD copies diverged for four months ([Hodgson](https://www.scrum.org/resources/blog/your-ai-agents-can-deliver-scrum-what-governs-them)).
- **Verification tax and instability:** AI raises throughput together with instability ([DORA](https://dora.dev/insights/balancing-ai-tensions/)).
- **Codebase cognitive debt** grows with multiple contributors. Swarm experiments relied on unusually complete specs and test suites ([Radar](https://www.thoughtworks.com/en-cl/radar/techniques/summary/coding-agent-swarms)).
- **OSS overload:**
  - A Linux Foundation survey: maintainers estimate about 25% of incoming PRs are "AI slop" (31% on large projects). Only 35% of projects have a formal GenAI policy ([Register](https://www.theregister.com/ai-and-ml/2026/10/21/ai-cuts-coding-time-but-its-also-filling-open-sources-inbox-with-crap/5304389)).
  - Kubernetes requires AI disclosure and uses a co-author CLA check to flag agent PRs ([k8s blog](https://kubernetes.io/blog/2026/06/26/open-source-maintainership-in-the-age-of-ai/)).
  - Ghostty limits AI PRs and keeps a public denouncement list ([AI_POLICY](https://github.com/ghostty-org/ghostty/blob/main/AI_POLICY.md)).
- **Semantic diffusion:** terms like "spec-driven development" and "harness engineering" are used inconsistently ([Radar themes](https://www.thoughtworks.com/radar)).
- **Gaps across the frameworks:**
  - None of the classic frameworks (Scrum, Kanban, LeSS, Shape Up, TT, RFC/ADR processes) specifies how chat, tracker, KB, repo and release-notes surfaces stay synchronized.
  - None defines agent identity or claims beyond AI-DLC Unit claims, ASF/Kubernetes disclosure and Kubernetes' co-author CLA check.
  - Release-note and customer-announcement mechanics appear only in SAFe RoD and Amazon PR/FAQ.
  - This is my synthesis of the reviewed sources [INFERENCE].

## 5. Sources
https://scrumexpansion.org/ai-and-scrum/2026.1 · https://scrumexpansion.org/scrum-guide-expanded/2025.6/pdf/scrum-guide-expansion-pack.en.pdf · https://www.scrum.org/resources/blog/your-ai-agents-can-deliver-scrum-what-governs-them · https://www.scrum.org/resources/blog/aws-ai-dlc-why-ai-coding-still-needs-human-accountability · https://resources.scrumalliance.org/Course/ai-agility-comprehensive-introduction · https://kanbanguides.org/the-kanban-guide/2025.5/ · https://framework.scaledagile.com/pi-planning · https://framework.scaledagile.com/release-on-demand · https://framework.scaledagile.com/blog/safe-summit-keynote-recap-launching-the-operating-model-for-the-age-of-ai · https://framework.scaledagile.com/ain-safe-ai-native-teams · https://less.works/less/framework/index · https://basecamp.com/shapeup/0.3-chapter-01 · https://basecamp.com/shapeup/2.2-chapter-08 · https://basecamp.com/shapeup/3.4-chapter-13 · https://www.jeremiahlee.com/posts/failed-squad-goals/ · https://teamtopologies.com/key-concepts · https://teamtopologies.com/book · https://teamtopologies.com/news-blogs-newsletters/team-topologies-for-the-ai-age-stewardship-of-value-flow · https://teamtopologies.com/keynote-talks/team-topologies-as-the-infrastructure-for-agency-with-ai · https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report · https://cloud.google.com/blog/products/ai-machine-learning/introducing-doras-inaugural-ai-capabilities-model · https://dora.dev/insights/dora-2025-year-in-review · https://dora.dev/insights/balancing-ai-tensions/ · https://getdx.com/research/measuring-developer-productivity-with-the-dx-core-4/ · https://patterns.innersourcecommons.org/p/trusted-committer · https://handbook.gitlab.com/handbook/communication/ · https://handbook.gitlab.com/handbook/people-group/directly-responsible-individuals · https://workingbackwards.com/concepts/working-backwards-pr-faq-process/ · https://workingbackwards.com/concepts/narratives-decision-making/ · https://github.com/rust-lang/rfcs · https://raw.githubusercontent.com/kubernetes/enhancements/master/keps/sig-architecture/0000-kep-process/README.md · https://peps.python.org/pep-0001/ · https://rfd.shared.oxide.computer/rfd/0001 · https://www.industrialempathy.com/posts/design-docs-at-google/ · https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions · https://www.apache.org/theapacheway/ · https://community.apache.org/contributors/mailing-lists.html · https://community.apache.org/committers/decisionMaking.html · https://www.apache.org/legal/generative-tooling.html · https://rai.apache.org/policy-recommendations.html · https://www.thoughtworks.com/radar · https://www.thoughtworks.com/en-cl/radar/techniques/summary/coding-agent-swarms · https://aws.amazon.com/blogs/devops/ai-driven-development-life-cycle · https://awslabs.github.io/aidlc-workflows/guide/04-phases-and-stages/ · https://tomgeraghty.co.uk/index.php/a-short-critique-of-safe/ · https://www.humanizingwork.com/pi-planning-is-broken-heres-a-better-way/ · https://www.theregister.com/ai-and-ml/2026/10/21/ai-cuts-coding-time-but-its-also-filling-open-sources-inbox-with-crap/5304389 · https://kubernetes.io/blog/2026/06/26/open-source-maintainership-in-the-age-of-ai/ · https://github.com/ghostty-org/ghostty/blob/main/AI_POLICY.md
