---
description: "Hand a reviewed pull request to a named acceptor, verify their answer, and repair returned feedback before merge."
---
Read when: selecting a plan's acceptance flow, requesting acceptance after final review, or resuming that request before merge.
# Handoff before merge
Scope: planned work in pull-request mode only. Handoff is a landing condition, not a plan status; the contributor keeps ownership. Run tool commands from the link root.
## Flow at planning
- While drafting, run `bun tools/handoff.ts resolve --plan <path>`; write the chosen `flow:` and any per-plan role-to-handle `acceptors:`. Resolution prefers the plan, then personal defaults, then one matching `areas:` flow, else none. Ask the human when candidates are ambiguous; `TBD` is draft-only. Every plan past draft records `flow:` explicitly; `status` refuses a plan without it.
- The gate's role is policy; its acceptor is a roster person other than the contributor. Resolution prefers plan `acceptors:`, then personal defaults, then the only other holder of the role (only when your user file names you); a missing person is a question, not permission to choose an outsider or yourself.
- In the approval brief, say who will check the change, where they may answer, and what happens next. Offer “skip handoff” to land after reviewers and CI only; record `flow: none — <reason>` when skipped, or the chosen flow before approval.
- The human approves `flow:` with the plan. A later change is a mid-flight amendment under `skill://mosaic-execute` step 14; record the human's decision in the Execution log.
## Request
- After `rule://final-review` reaches stable exact-head readiness, run `bun tools/handoff.ts resolve --plan <path>` again. Request gates in flow order, only after earlier gates are cleared and their acceptances still hold. Ask the human for any unresolved acceptor and record their handle in `acceptors:`. Without a user file, confirm the contributor's handle in-session and never request the contributor.
- Use the resolved `post` surfaces and `include` artifacts. Roster preferences choose where to ask and what to carry; they never widen the gate's allowed surfaces or artifacts. Acceptance on any allowed surface counts, even if it was not the preferred notification.
- For a preview, read the project-owned card at metadata `handoff.preview`: `# Preview: <name>`, `- produce: pipe | command | manual | skill:<name>`, and sections `## Produce`, `## Served commit`, `## Access and classification`, `## Lifetime and teardown`. The kit supplies no deployer.
- Follow `produce`: observe a pipe's URL for the readiness head; run the named command or `skill:<name>` under this plan's approved flow; for manual production, ask the human. Respect the card's cost, per-run permissions, authentication, URL classification, lifetime and teardown; never use a shared or production environment.
- Verify the served commit as the card directs. If it differs or cannot be verified, label the preview “unverified: may not serve the handed-off head” or omit it, and say why. Never post a URL where the card forbids it.
- Write the packet under `rule://human-gates`: audience is the acceptor; first say what changed and what they should accept. Derive “what to check” from the plan's acceptance criteria; include the PR locator, evidence path and any preview with its verification result. At most 40 lines; show the head SHA once, in parentheses.
- Journal first in the plan's `## Execution log`, including an archived plan. In the line below, `head` is the exact-head readiness SHA observed BEFORE the journal commit, not that commit's resulting SHA; use a UTC ISO-8601 timestamp and the next round for this gate:
  `- handoff R<n> <role>: REQUESTED @<handle> <ISO> head <sha> pr://<n> preview <https-url|none>`
- Commit the journal (`git commit`; in two-commit close-out, `git commit --amend --no-edit` on the close-out commit), then `git push --force-with-lease origin <branch>` per `rule://git-flow`. Replay and repeat final review's post-push comments/CI gate before posting. The journal is a docs-only delta from the requested head: no code-review round is needed.
- Re-fetch the tracker item, check the writer, set `handoff`, and post the packet with the roster mention per **Tracker operations**. Retain the request comment id for this round; search the existing marker before retrying an uncertain post. Never change assignee, priority or unrelated labels.
- Read the current PR body with `gh pr view <n> --json body`; build `<file>` by adding or updating one `## Handoff` section carrying the packet summary and, when publishable, a preview link in the form `[<name> Preview](https://preview.example)` with the actual URL. Preserve every other section and its evidence. Apply it with `gh pr edit <n> --body-file <file>`. Run `gh pr edit <n> --add-reviewer <login>` only when `resolve` returns `requestReview: true`.
- STOP with a contributor brief: whom you asked, where, what they will see, and “run `/mosaic-execute <plan>` again once they answer”. Never poll or wait on a timer.
## Resume and verify
- Re-fetch writer ownership. Only when the last managed event is `handoff`, the prior session is gone, and the human confirms in-session may this session claim its own token at the owner's generation + 1: local uses `--take-over` on its first event/comment; MCP records the new token/generation in the fresh managed block. A live writer stays `WRITER-CONFLICT`; never impersonate it.
- Read every allowed surface completely: tracker comments through the last page; GitHub with `gh api repos/<o>/<r>/pulls/<n>/reviews --paginate`. A failed/incomplete read holds the gate, never proves silence or acceptance.
- Count only an explicit acceptance or returned feedback in a reply whose `parentId` is this gate's latest REQUESTED round's comment, or a PR review submitted after that round's REQUESTED time whose latest state for that reviewer is `APPROVED`/`CHANGES_REQUESTED` (not dismissed). Require the requested acceptor's roster identity: tracker id equals comment author id; GitHub login equals review user login, never an app/bot, never the contributor. Require `onBehalfOf` null and no exposed sync/relay attribution. Report wrong-person, relayed, earlier-round, ambiguous and other comments as seen, not counted; a tracker state is never acceptance.
- Bind a tracker reply to the REQUESTED head, or a PR review to its `commit_id`; retain the accepting record's id/body and that SHA. The REQUESTED head is the readiness SHA BEFORE the journal commit. Run final review's replay from that SHA to HEAD using the recorded base: the journal and later records-only commits are docs-only deltas and preserve acceptance; only an own-code delta makes it stale. A failed replay cannot clear the gate.
- For a current acceptance, append the line below and commit/push records through the same close-out and post-push replay route; never rewrite the answer to fit the log:
  `- handoff R<n> <role>: ACCEPTED @<handle> <ISO> <tracker-reply|pr-review>/<id> head <sha>`
- For returned feedback, follow **Returned after sign-off**. For stale acceptance, request a new round naming the own-code delta; it supersedes the open round, and the stale answer is never logged as ACCEPTED. For no answer, report the request's age and STOP; silence is not acceptance. Conflicting answers require a human ruling, not a convenient choice.
- Before telling the human to merge, `bun tools/handoff.ts status --plan <path>` must exit 0; immediately re-read every acceptance, require it still present and unedited, and repeat the head check and final-review gate. Missing, edited, dismissed or stale evidence holds merge. Status exits 1 for pending gates/invalid human input, 2 for malformed or unreadable evidence/configuration; neither permits merge.
## Returned after sign-off
The archived plan stays `done` while its PR is open; `done` records sign-off, not landing. Its Execution log remains writable for this repair window; after landing, Archive-class freezing applies.
| Kind | Test | Route and sign-off |
|---|---|---|
| Defect | An approved acceptance criterion is not met | Substantive finding; repair and reverify within scope. Prior sign-off covers the correction. |
| Amendment | Criteria are met, but the acceptor wants different behavior within approved scope and `files:` | The contributor approves an amendment in-session under execute step 14, or contests it in the thread with a reason. Log approval and name the new behavior in the brief; that approval is re-sign-off. |
| Deferral | Pre-existing bug, unrelated request, or work outside approved scope | Record reproducer/evidence as new intent, a light-path change or a draft plan via execute step 7. Name its locator in the next request; the acceptor may accept the deferral or hold. |
- Before repairs, log RETURNED and exactly one classified finding line per finding; summaries are at most 15 words, `S` substantive or `P` procedural. Record the disposition, then update it with the actual repair/deferral evidence:
  `- handoff R<n> <role>: RETURNED @<handle> <ISO> <tracker-reply|pr-review>/<id> (<k> findings)`
  `- handoff R<n> <role>: <S|P> — <summary> → <fixed|amended: …|deferred: <locator>|contested: <reason>>`
- Re-emit tracker `executing`; repair through `rule://review-loop` and `rule://final-review`: owning executor, required task reviewers on the repair delta, affected verification and scenarios, then final review of any own-code delta. Keep the selected close-out layout; do not reopen plan status.
- Every repair starts a new round and thread, with the delta since the prior request in its packet; re-emit `handoff` at that request. After two returned rounds, the human decides: another round, named override, or abandonment under `skill://mosaic-execute` step 14 (close the PR unmerged, mark/repoint the abandoned plan and ledger, emit tracker `abandoned`).
## Withdraw and override
- WITHDRAWN requires the human's recorded decision amending the approved flow; OVERRIDDEN names the human author and reason. Both clear the gate; never manufacture either from silence. Append the applicable line and commit/push/replay records as above:
  `- handoff R<n> <role>: WITHDRAWN <ISO> by @<handle> — <reason>`
  `- handoff R<n> <role>: OVERRIDDEN <ISO> by @<handle> — <reason>`
## Tracker operations
Read `rule://tracker` for writer checks, state mappings and idempotent markers; re-fetch before every write. These operations never transfer item ownership to the acceptor.
{{TRACKING_MCP}}
Use the installed runtime MCP server named in `rule://tracker`; read its mounted schemas first.
| Operation | MCP binding |
|---|---|
| `read-item` | `get_issue` for the full item and managed writer block. |
| `set-state` | `save_issue` with `id`, gate `state`, and managed last-event `handoff`, after a fresh read; resolve native states, never guess. Repair uses the existing `executing` mapping. |
| `add-comment` | `save_comment` with `issueId` and packet `body`, roster `@mention`, and the tracker comment marker; retain the returned id. Use `parentId` for a reply, never an existing comment `id`. |
| `list-comments` | `list_comments` with `issueId`, through every cursor to the last page; inspect `author.id`, `onBehalfOf`, `parentId` and any sync/relay attribution. |
{{/TRACKING_MCP}}
{{TRACKING_LOCAL}}
Use `bun tools/tracker.ts --provider replay <command>` from the link root.
| Operation | Replay command |
|---|---|
| `read-item` | `get <key>`: complete item and managed writer block. |
| `set-state` | `event <key> handoff --writer <token#gen> [--note <text>]`; local state is `handoff`, with no state mapping or receipt required. Repair uses `event <key> executing --writer <token#gen>`. |
| `add-comment` | `comment <key> --file <path> --writer <token#gen> [--parent <comment id>]`; retain its stable id. `--parent` must identify an existing comment on this item. |
| `list-comments` | `get <key>` returns all comments; inspect `author`, `parentId` and `onBehalfOf`. A write receipt alone does not prove a person saw the request. |
{{/TRACKING_LOCAL}}
{{TRACKING_NONE}}
No tracker operations are available: the request is the log line, PR body and permitted review request. `tracker-reply` is unavailable; verify the acceptor's GitHub review.
{{/TRACKING_NONE}}
A “ready for merge” automation must not target the gate's state. Set `handoff.requestReview: false` when an attested review-request pipe moves tracker state; the tracker mention is the notification, and an allowed GitHub approval still counts without a formal request.
