# People

Registry class: this roster names who may accept each handoff gate. Keep one row per person; handles are never reused. Store no emails or secrets. Change rows only through reviewed roster PRs under `rule://records` (including `/mosaic-onboard`); proposed roles become effective on reviewer merge.

| Handle | Roles | Tracker id | Tracker mention | GitHub login | Slack id | Prefers |
|---|---|---|---|---|---|---|

Slack id is an optional, unique single token (`—` when absent), used only for notifications, never acceptance. Tracker ids and GitHub logins identify acceptance authors; a Slack reply cannot clear a gate. Old six-column rosters are rejected with a clear seven-column-header error; no migration procedure is provided.

Handles begin with `@` and a lowercase letter/digit, then lowercase letters/digits, dots, underscores or hyphens. Consecutive dots, a trailing dot and a `.lock` suffix are forbidden so the exact `roster/<handle-without-@>` branch is valid; `@tal.m` is valid. Never silently rename a person to form a branch.
