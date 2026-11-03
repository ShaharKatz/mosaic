# Release management & client-facing communication — market research (as of 2026-10-31)

Scope: how many contributors' commits/PRs become changelogs, release notes, audience-specific announcements, and how customer feedback flows back to trackers. Linear's own Releases feature is excluded.

## 0. The chain at a glance

| Step | Who authors | Who approves | What is automated (AI?) | Evidence vs marketing | How many contributions are aggregated | Cadence/versioning |
|---|---|---|---|---|---|---|
| Commit/PR metadata | Each contributor (type prefix, changeset file, PR label) | PR reviewer; squash-merger can rewrite the message | Lint (commitlint) and label checks; Release Drafter `check-pr` | Evidence: tied to a diff | Per commit or PR | n/a |
| Changelog file | Generated from commits (release-please, semantic-release) or from contributor-written changeset files (Changesets) | Maintainer merges the "Release PR" / "Version Packages" PR; semantic-release has no human gate | Version bump, CHANGELOG, tag, GitHub Release | Evidence, but often noisy | Grouped by type/label/package | SemVer from commit types; CalVer as the alternative |
| Release notes | GitHub generate-notes / Release Drafter / Jira version notes; AI drafts (Copilot release notes, Rovo) | Human publishes the draft | Category grouping by label; AI summarization with uncertainty flags | Partly curated | Grouped by PR label, Jira work type, or AI clustering | Per tag or per Jira version |
| Audience announcements | PM / PMM / docs (LaunchNotes, Beamer, Headway, AnnounceKit, Featurebase, Productlane, Mintlify, Intercom News) | PMM/PM; launch tier decides how much review | AI drafts from Jira/Linear/PRDs; multi-channel fan-out; segmentation | Marketing copy, sometimes only loosely linked to the shipped diff | Digests by product area/date | Continuous, or tiered (T1/T2/T3) |
| Exposure/rollout | Engineer/PM flags (LaunchDarkly, Statsig) | Flag approvals, pipeline phase approvals | Guarded rollouts, auto-rollback on regression | Evidence: metrics | Per flag, not per version | Decoupled from deploy/version |
| Incidents | Incident responders (Statuspage, incident.io) | Responder; workflows can auto-publish | Auto-publish/resolve from incident state | Evidence-based operational comms | Per incident/component | Event-driven |
| Feedback → tracker | Support/CS/sales, or AI extraction (Canny Autopilot, Linear Agent in Intercom, Productlane AI) | PM triage | Two-way status sync; voters notified on status change | Customer evidence attached to issues | Dedup/merge into posts/requests | Continuous |

## 1. Coverage table

| Product/framework | Category | One-line what | Surfaces touched | Primary source |
|---|---|---|---|---|
| Conventional Commits 1.0.0 | Convention | Typed commit messages mapped to SemVer | repo, PR, release | https://www.conventionalcommits.org/en/v1.0.0/ |
| SemVer 2.0.0 / CalVer | Versioning | MAJOR.MINOR.PATCH for a declared public API; date-based alternative | release, customer | https://semver.org/ ; https://calver.org/about.html |
| Keep a Changelog 1.1.0 | Convention | Human-curated CHANGELOG.md format | repo, release, customer | https://keepachangelog.com/en/1.1.0/ |
| release-please | Release automation | Maintains a Release PR from Conventional Commits | repo, PR, release | https://github.com/googleapis/release-please |
| semantic-release | Release automation | Fully automated version, notes, and publish in CI | repo, release | https://github.com/semantic-release/semantic-release |
| Changesets | Release automation | Contributor-authored change intents and a "Version Packages" PR | repo, PR, release | https://github.com/changesets/changesets |
| GitHub generated release notes | Release notes | Lists PRs and contributors, categorized via `.github/release.yml` | PR, release | https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes |
| Release Drafter | Release notes | Draft release updated as PRs merge | PR, release | https://github.com/release-drafter/release-drafter |
| GitHub Copilot Release Notes | AI release notes | Copilot CLI writes notes from PRs between two refs | PR, release, chat (via JSON) | https://github.com/github/copilot-release-notes |
| Jira versions / Release hub / release notes (+Rovo) | Tracker release | Version readiness plus generated notes into Confluence | tracker, KB, PR | https://support.atlassian.com/jira-cloud-administration/docs/create-release-notes/ |
| LaunchDarkly (release pipelines, guarded rollouts, approvals) | Feature-flag release | Phased, metric-guarded flag rollouts with approvals | chat, tracker, release | https://launchdarkly.com/docs/home/releases/release-pipelines |
| Statsig (now Amplitude) | Feature-flag release | Release pipelines for gates/configs | release | https://docs.statsig.com/release-pipeline/overview |
| LaunchNotes | Announcement platform | Segmented, multi-channel release comms from Jira/Notion | chat, KB, customer | https://www.launchnotes.com/release-notes-tool |
| Beamer, Headway, AnnounceKit | Changelog widgets | In-app changelog widgets, segmentation, email/Slack | customer, chat | https://www.getbeamer.com/changelog ; https://headwayapp.co/ ; https://announcekit.app/use-cases/changelog-software |
| Canny | Feedback + changelog | Feedback capture (AI Autopilot), roadmap, changelog, tracker sync | tracker, customer | https://canny.io/integrations |
| Featurebase | Feedback + changelog | Feedback boards, changelog, two-way Linear sync | tracker, customer | https://help.featurebase.app/en/articles/6970004-linear-integration |
| Productlane | Support/feedback on Linear | Helpdesk, portal, roadmap, and changelog built on Linear | chat, tracker, customer | https://productlane.com/docs/integrations/linear |
| Mintlify changelog | Docs changelog | `<Update>` MDX entries with RSS in a git-backed docs site | repo, KB, customer | https://www.mintlify.com/docs/components/update |
| Intercom (now Fin, Salesforce) News + Linear integration | Support + announcements | Targeted Newsfeeds; Linear issue linking and agent-created issues | chat, tracker, customer | https://www.intercom.com/help/en/articles/6362267-getting-started-with-news ; https://linear.app/docs/intercom |
| Jira Product Discovery | Feedback → tracker | Ideas with linked "insights" and delivery tickets | tracker | https://www.atlassian.com/software/jira/product-discovery/features |
| Atlassian Statuspage | Status page | Public, private, and audience-specific incident pages | customer, chat | https://support.atlassian.com/statuspage/docs/read-the-statuspage-user-guide/ |
| incident.io Status Pages | Status page | Public, internal, and customer pages auto-published from incidents | customer, chat | https://docs.incident.io/status-pages/auto-publishing |
| Amazon Working Backwards PR/FAQ | Practice | Writes the launch press release before building | KB, customer | https://commoncog.com/putting-amazons-pr-faq-to-practice/ |
| PMM launch tiers (T1/T2/T3) | Practice | Sizes the launch effort to its strategic weight | chat, customer | https://www.launchnotes.com/blog/the-ultimate-product-launch-plan-for-new-product-marketers |

## 2. Per product/framework

### Conventional Commits / SemVer / Keep a Changelog
These conventions are the substrate the automation tools build on.
- **Shared artifacts:** `type(scope)!: description`, plus footers. `fix` maps to PATCH, `feat` to MINOR, and `BREAKING CHANGE` or `!` to MAJOR (https://www.conventionalcommits.org/en/v1.0.0/). SemVer requires the software to "declare a public API" (https://semver.org/).
- **Multi-contributor:** The spec says contributors need not comply if maintainers squash-merge and "clean up the commit messages as they're merged" (CC FAQ).
- **Evidence vs copy:** Keep a Changelog states "Changelogs are for humans, not machines" and calls commit-log diffs "a bad idea… full of noise". It recommends an `Unreleased` section and the types Added/Changed/Deprecated/Removed/Fixed/Security. It criticizes GitHub Releases as a "non-portable changelog" (https://keepachangelog.com/en/1.1.0/).
- **Cadence:** Per version. CalVer bases the version on calendar dates instead (https://calver.org/about.html).

### release-please (Google)
- **System of record:** Git history. The tool keeps an open Release PR "up-to-date as additional work is merged". Merging that PR updates CHANGELOG.md, tags the commit, and creates the GitHub Release. It does not publish to registries (https://github.com/googleapis/release-please).
- **Governance:** The human gate is merging the Release PR. Lifecycle labels are `autorelease: pending`, `tagged`, and `published`.
- **Aggregation/fixes:** Footers can encode several changes in one commit. `BEGIN_COMMIT_OVERRIDE` in a merged PR body rewrites what goes into the notes. `Release-As: x.y.z` forces a version. The project "highly" recommends squash-merge.

### semantic-release
- Automates the whole release workflow in CI: verify, analyze commits, generate notes, tag, publish, notify. The goal is that "no human is directly involved", with releases "unromantic and unsentimental" (https://github.com/semantic-release/semantic-release).
- **Governance:** No approval gate by design. Timing is controlled through branches and channels (`next`, `beta`) and pre-release recipes.

### Changesets
- **Authorship:** "Allowing the person making contributions to make key decisions." Each changeset records a SemVer bump type and changelog text (https://raw.githubusercontent.com/changesets/changesets/main/docs/intro-to-using-changesets.md).
- **Aggregation:** `changeset version` consumes all pending changesets, bumps dependent packages in monorepos, and writes changelog entries. The project recommends reviewing these before `publish`. The project advises against making a missing changeset block a contribution.
- **Automation:** `changesets/action` opens or updates a "Version Packages" PR and can create GitHub Releases. It also has `pr-status` and `pr-comment` sub-actions. v2 targets Changesets v3, which is in development (https://github.com/changesets/action).

### GitHub generated release notes / Release Drafter
- **GitHub:** "Generate release notes" lists merged PRs, contributors, and a full-changelog link. `.github/release.yml` maps labels to categories and excludes labels or authors such as bots. Releases can open a Discussion. Immutable releases exist (https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes).
- **Release Drafter:** Updates a draft release on every merge. Label-based categories carry `semver-increment`, which resolves the next version. Templates include `$CONTRIBUTORS` and `$NEW_CONTRIBUTORS`. A `check-pr` action validates labels and titles on PRs. It also runs outside Actions, on GitLab, Gitea, and Forgejo (https://github.com/release-drafter/release-drafter).

### AI release-note generators
- **GitHub Copilot Release Notes** (GitHub CLI & Desktop team, "active development"). It reads PR titles, bodies, labels, and diffs between two refs. A team style guide lives at `.github/release-notes-instructions.md`. Outputs are markdown, JSON, `skipped-prs`, and `uncertain-entries`, the last "separated for human review". It needs a Copilot license (https://github.com/github/copilot-release-notes).
- **Atlassian Rovo** drafts Jira version release notes and publishes them to Confluence (https://support.atlassian.com/jira-cloud-administration/docs/create-release-notes/).
- **2025–26 long tail:** Released (Jira, https://released.so/ai-release-notes), Notra, ShipTell, and Bellotify (vendor-authored listicles, e.g. https://www.usenotra.com/blog/best-automated-changelog-tools-in-2026). There is also a Scalekit agent template that groups PRs, links Linear issues, and publishes to Confluence/Notion (https://www.scalekit.com/agent-templates/release-changelog-agent). [UNVERIFIED] quality claims for these come only from vendors.

### Jira versions, Release hub, release notes
- **System of record:** The Jira version, through each work item's fix version. The Release hub shows version status. Connected dev tools add warnings, such as work items "marked as done but have open pull requests or unreviewed code" (https://support.atlassian.com/jira-software-cloud/docs/check-the-release-status-of-a-version/).
- **Notes:** Notes group work items by work type and can include a custom "Release notes" rich-text field per item. They can be created as a Confluence draft listing everyone who worked on the items, then edited for the audience and permissioned. Notes are "auto-generated… each time you view", and saving keeps only the format (https://support.atlassian.com/jira-cloud-administration/docs/create-release-notes/).

### LaunchDarkly
- **Release pipelines** (beta, Enterprise only) move boolean flags through phases. Each phase sets the environment, the audience, whether approvals are required, and whether to use a guarded rollout. The limit is 20 pipelines per project (https://launchdarkly.com/docs/home/releases/release-pipelines).
- **Guarded rollouts** (Enterprise plus the Guardian add-on) ramp traffic while sequential testing watches metrics. On a regression they notify the maintainer and can auto-roll back (https://launchdarkly.com/docs/home/releases/guarded-rollouts).
- **Approvals** work like code review, gated by the `reviewApprovalRequest` permission. Notifications go by email, in-app, and via the Slack/Teams apps (https://launchdarkly.com/docs/home/releases/approvals).
- In May 2025 LaunchDarkly announced release observability and AI Configs (https://www.globenewswire.com/news-release/2025/05/14/3081433/0/en/launchdarkly-introduces-new-release-observability-ai-configurations-and-analytics-capabilities-to-help-developers-innovate-faster-without-the-risk.html).

### Statsig
- **Release Pipelines** (announced Apr 22, 2025) stage gate and config changes across environments and segments. They advance on a timer or by manual approval, and are supported only in Server Core SDKs (https://docs.statsig.com/release-pipeline/overview ; https://www.statsig.com/blog/release-pipelines).
- **Ownership:** OpenAI agreed to acquire Statsig on Sep 2, 2025 (https://www.statsig.com/blog/openai-acquisition). Per Statsig's later note, the product, brand, and customers moved to **Amplitude on May 5, 2026**, while the original team stayed at OpenAI (https://www.statsig.com/blog/statsig-amplitude-phase-1).

### Announcement/changelog platforms
- **LaunchNotes:** Turns "Jira, Notion, Loom, or any PRD links" into a draft. Segments by product line, plan, or attribute. Publishes once to a widget, Slack, Teams, email, and RSS. Also offers digests, idea voting, an MCP server, audit logs, and RBAC (https://www.launchnotes.com/release-notes-tool). Its audience-matrix guide names six readers: end user, admin, developer, CS, sales, leadership. It advises splitting notes "when the required action differs" and treating variants as renderings of "one canonical release record" (https://www.launchnotes.com/release-notes/audiences).
- **Beamer:** Segmentation plus "Boosted Announcements" and NPS (https://www.getbeamer.com/changelog). In Feb 2024 Beamer acquired Userflow (https://techcrunch.com/2024/02/07/beamer-buys-userflow-to-build-a-consolidated-user-experience-platform/).
- **Headway:** Widget plus Slack/Twitter (https://headwayapp.co/).
- **AnnounceKit:** Own-domain page, 10+ widget modes, Jira-synced voting, digests, multi-language (https://announcekit.app/use-cases/changelog-software).
- **Mintlify:** `<Update>` components in MDX create anchored entries and RSS. Dates are derived from Git history unless overridden, so the changelog is a repo artifact reviewed like docs (https://www.mintlify.com/docs/components/update).
- **Intercom → Fin:** News items go into audience-targeted Newsfeeds, and the Messenger shows one Newsfeed per user (https://www.intercom.com/help/en/articles/6362267-getting-started-with-news). Salesforce completed its acquisition of "Fin, formerly Intercom" on Sep 10, 2026 (https://www.hpcwire.com/bigdatawire/this-just-in/salesforce-completes-acquisition-of-fin/ ; SEC 10-Q https://www.sec.gov/Archives/edgar/data/0001108524/000110852426000190/crm-20260731.htm).

### Feedback → tracker loops
- **Productlane:** "Built on Linear." Two-way real-time sync of issues, projects, customers, and comments. The customer conversation is mirrored into a pinned Linear comment, and replying to it in Linear messages the customer. AI drafts issues from support threads. Optional auto-create files every new thread into triage. Completing a Linear project can create a changelog draft "ready for you to review and publish". It can also auto-assign bugs to a Cursor agent (https://productlane.com/docs/integrations/linear).
- **Linear × Intercom:** Create or link issues from conversations. "Create with Linear Agent" drafts the issue from the full conversation, following admin-defined routing guidance. Linking creates a Linear customer request. Completing or canceling the issue posts an internal note and reopens the conversation (https://linear.app/docs/intercom).
- **Canny:** Push posts to Linear. Status-sync rules keep stakeholders updated (https://linear.app/integrations/canny). Autopilot extracts and deduplicates requests from Gong, Intercom, Zendesk, and review sites, in automatic or review mode with an audit log (https://canny.io/blog/autopilot-review-sources/).
- **Featurebase:** Per-board, per-team status rules, one-way or bidirectional. When a status changes in Linear, "all upvoters are notified by email". Linear projects enter a moderation queue before going public. The native integration "does not generate Release notes", and the documented workaround is MCP plus an AI tool (https://help.featurebase.app/en/articles/6970004-linear-integration).
- **Jira Product Discovery:** Ideas carry insights (customer evidence with impact ratings) and linked delivery tickets (https://www.atlassian.com/software/jira/product-discovery/features).

### Status pages
- **Atlassian Statuspage:** Public, private (SAML/Google), and audience-specific pages. Supports components, templates, postmortems, email/SMS/webhook subscribers, and a Slack activity feed. Its guide states "doesn't currently have any access controls or granular permission levels for team members" (https://support.atlassian.com/statuspage/docs/read-the-statuspage-user-guide/).
- **incident.io:** Workflows auto-publish and auto-resolve status-page incidents from internal incident state. Expressions map severity to component impact, with a "Notify subscribers" toggle. The internal and public names can differ (https://docs.incident.io/status-pages/auto-publishing). Authenticated customer pages launched Oct 31, 2023 (https://incident.io/changelog/customer-status-pages).

### Pre-build announcement and launch sizing
- **Working Backwards PR/FAQ:** A one-to-two-page press release plus FAQ, written before development. If it can't be made compelling, the product is not worth building (https://commoncog.com/putting-amazons-pr-faq-to-practice/ ; https://www.ideaplan.io/frameworks/working-backwards).
- **Launch tiers:**
  - T1 is flagship: press, executives, about 6 weeks of lead time. T2 is significant, about 3 weeks. T3 is "a release note and nothing else", about 1 week (https://strkr.io/answers/what-is-product-launch ; https://discover.gtmplaybook.co/launch-tiering-framework).
  - The tier is set when the feature is committed (https://startupfundraising.com/product-launch-tiers).
  - LaunchNotes advises at least one T2 launch per quarter (https://www.launchnotes.com/blog/the-ultimate-product-launch-plan-for-new-product-marketers).

## 3. Cross-cutting patterns
1. **A "pending release" PR as the approval gate.** Automation proposes and a human merges: release-please Release PR, Changesets "Version Packages" PR, Release Drafter draft release. semantic-release is the outlier with no gate.
2. **Release metadata captured at contribution time, by each contributor.** Commit type prefixes (Conventional Commits), changeset files (Changesets), PR labels (GitHub `release.yml`, Release Drafter), and a per-item "Release notes" field (Jira).
3. **Aggregation by labels or categories, with exclusions for bots and chores.** GitHub `exclude.authors`, Release Drafter `pre-exclude`, release-please "releasable units" (`feat`/`fix`/`deps`).
4. **AI drafts, human publishes.** Copilot Release Notes `uncertain-entries`, Rovo drafts in Confluence, Productlane changelog drafts, LaunchNotes drafts from PRDs, Canny Autopilot review mode. Vendors keep a human review step.
5. **One canonical record, rendered per audience.** LaunchNotes' audience matrix, Intercom per-audience Newsfeeds, Statuspage audience-specific pages, incident.io internal/public/customer pages.
6. **Exposure decoupled from version.** LaunchDarkly and Statsig make "released" a per-flag, per-segment state with approvals and metric guards. That state is separate from the tag/changelog version.
7. **Two-way tracker ↔ customer sync closes the loop.** Status changes notify voters or reopen conversations: Featurebase, Canny, Linear×Intercom, Productlane.
8. **Event-driven status comms derived from internal state.** incident.io workflows. Statuspage email/API automation and component automation.
9. **Pre-build announcement as a planning artifact.** PR/FAQ. Launch tiers decided at commitment time.

## 4. Weaknesses, gaps, complaints
- **Commit-derived changelogs are noisy.** One feature can mean "five 'feat' commits and dozens of 'fix' commits", leaving "a cluttered list of technical steps" (https://xnok.github.io/infra-bootstrap-tools/blog/intentional-releases-changesets/). Conventional Commits "focuses on the wrong thing (the commit type)" (https://sumnerevans.com/posts/software-engineering/stop-using-conventional-commits/). Enforcing it "stifles new contributions" (https://lobste.rs/s/oqlpna/stop_using_conventional_commits).
- **Non-conforming commits silently drop out of semantic-release changelogs** (https://dev.to/maximecheramy/tools-for-semantic-versioning-48la). semantic-release is "genuinely painful for a monorepo" (https://www.nazarboyko.com/articles/conventional-commits-automated-semantic-release). Reviewers struggle to judge which commits belong in the notes (https://brianschiller.com/blog/2023/09/18/changesets-vs-semantic-release/).
- **release-please is fragile.** Stale `autorelease: pending` labels block new Release PRs. Notes overrides don't work with plain merges (https://github.com/googleapis/release-please).
- **GitHub Releases are "non-portable" and "not very discoverable"** (https://keepachangelog.com/en/1.1.0/).
- **Jira notes can't hold media.** Markdown export breaks with panels or statuses (https://support.atlassian.com/jira-cloud-administration/docs/create-release-notes/).
- **Feature-flag release automation is gated and limited.** LaunchDarkly pipelines are beta, Enterprise-only, and boolean-only. Guarded rollouts need an add-on (LD docs). Statsig pipelines don't support experiments or scheduled rollouts (Statsig docs). Statsig changed owner twice in 9 months (Statsig blog).
- **Audience variants drift.** Single blasts get ignored, and over-segmentation means "nobody sees the whole release" (https://www.launchnotes.com/release-notes/audiences). This is vendor content.
- **Integration gaps between feedback sync and release notes.** Featurebase's Linear sync does not generate release notes (Featurebase docs). Productlane comment sync "has no setting to turn this off" and can flood Linear inboxes (Productlane docs). Headway is criticized as too thin for a feedback loop (https://www.featurebase.app/blog/headway-alternatives, a competitor source).
- **Statuspage has no team-member permission granularity** (Statuspage guide).
- **Most evidence of AI release-note quality is vendor-written.** [UNVERIFIED] No independent evaluations found.

## 5. Sources
https://www.conventionalcommits.org/en/v1.0.0/ · https://semver.org/ · https://calver.org/about.html · https://keepachangelog.com/en/1.1.0/ · https://github.com/googleapis/release-please · https://github.com/semantic-release/semantic-release · https://github.com/changesets/changesets · https://raw.githubusercontent.com/changesets/changesets/main/docs/intro-to-using-changesets.md · https://github.com/changesets/action · https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes · https://github.com/release-drafter/release-drafter · https://github.com/github/copilot-release-notes · https://www.scalekit.com/agent-templates/release-changelog-agent · https://released.so/ai-release-notes · https://www.usenotra.com/blog/best-automated-changelog-tools-in-2026 · https://support.atlassian.com/jira-cloud-administration/docs/create-release-notes/ · https://support.atlassian.com/jira-software-cloud/docs/check-the-release-status-of-a-version/ · https://launchdarkly.com/docs/home/releases/release-pipelines · https://launchdarkly.com/docs/home/releases/guarded-rollouts · https://launchdarkly.com/docs/home/releases/approvals · https://www.globenewswire.com/news-release/2025/05/14/3081433/0/en/launchdarkly-introduces-new-release-observability-ai-configurations-and-analytics-capabilities-to-help-developers-innovate-faster-without-the-risk.html · https://docs.statsig.com/release-pipeline/overview · https://www.statsig.com/blog/release-pipelines · https://www.statsig.com/blog/openai-acquisition · https://www.statsig.com/blog/statsig-amplitude-phase-1 · https://www.launchnotes.com/release-notes-tool · https://www.launchnotes.com/release-notes/audiences · https://www.launchnotes.com/blog/the-ultimate-product-launch-plan-for-new-product-marketers · https://www.getbeamer.com/changelog · https://techcrunch.com/2024/02/07/beamer-buys-userflow-to-build-a-consolidated-user-experience-platform/ · https://headwayapp.co/ · https://announcekit.app/use-cases/changelog-software · https://www.mintlify.com/docs/components/update · https://www.intercom.com/help/en/articles/6362267-getting-started-with-news · https://www.hpcwire.com/bigdatawire/this-just-in/salesforce-completes-acquisition-of-fin/ · https://www.sec.gov/Archives/edgar/data/0001108524/000110852426000190/crm-20260731.htm · https://productlane.com/docs/integrations/linear · https://linear.app/docs/intercom · https://linear.app/integrations/canny · https://canny.io/blog/autopilot-review-sources/ · https://help.featurebase.app/en/articles/6970004-linear-integration · https://www.featurebase.app/blog/headway-alternatives · https://www.atlassian.com/software/jira/product-discovery/features · https://support.atlassian.com/statuspage/docs/read-the-statuspage-user-guide/ · https://docs.incident.io/status-pages/auto-publishing · https://incident.io/changelog/customer-status-pages · https://commoncog.com/putting-amazons-pr-faq-to-practice/ · https://www.ideaplan.io/frameworks/working-backwards · https://strkr.io/answers/what-is-product-launch · https://discover.gtmplaybook.co/launch-tiering-framework · https://startupfundraising.com/product-launch-tiers · https://xnok.github.io/infra-bootstrap-tools/blog/intentional-releases-changesets/ · https://sumnerevans.com/posts/software-engineering/stop-using-conventional-commits/ · https://lobste.rs/s/oqlpna/stop_using_conventional_commits · https://dev.to/maximecheramy/tools-for-semantic-versioning-48la · https://www.nazarboyko.com/articles/conventional-commits-automated-semantic-release · https://brianschiller.com/blog/2023/09/18/changesets-vs-semantic-release/
