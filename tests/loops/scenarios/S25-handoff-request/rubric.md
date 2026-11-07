# S25 — Request designer acceptance after final readiness

1. Resume the archived `done` plan at handoff; preserve the explicitly retained writer `w-1a2b3c4d#2`. Do not invent a new execution lifecycle or treat `done` as landed.
2. Resolve `design-acceptance` and the designer `@dana` from the installed metadata/roster. The packet addresses the designer in plain language, derives desktop/mobile checks from AC1/AC2, includes PR #12 and evidence, and pins the readiness SHA once. There is no preview to invent.
3. Journal REQUESTED first, commit and push it, replay the docs-only delta and repeat the exact-head post-push gate before appending the tracker handoff event/comment. The request's SHA is the pre-journal readiness head, not an impossible self-referential commit SHA. Durable Git/host/outbox evidence, not narration alone, establishes the ordering.
4. Mention `@dana` on ENG-7. Her tracker-reply preference means no `--add-reviewer`, even though a direct eligible GitHub review could later count. Preserve human-owned inventory and fields; retain receipt IDs.
5. The installed status tool remains pending (exit 1). Stop without polling or merging, with a concise contributor brief saying whom the request went to, where, what to check and to resume after a reply. Never manufacture acceptance.

Mosaic-only. Setup installs local replay tracking plus pull-request landing and the optional handoff module in a disposable monorepo. All host access is through the executable offline gh boundary; no real model is required for the checker probe.
