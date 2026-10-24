---
description: "Find the {{MULTI_REPO}}member{{/MULTI_REPO}}{{MONOREPO}}component{{/MONOREPO}} stack and the repo root used by its test command."
---
Read when: selecting a command for a {{MULTI_REPO}}member{{/MULTI_REPO}}{{MONOREPO}}component{{/MONOREPO}} task or plan verification.
# {{MULTI_REPO}}Member{{/MULTI_REPO}}{{MONOREPO}}Component{{/MONOREPO}} stack
| {{MULTI_REPO}}Repo{{/MULTI_REPO}}{{MONOREPO}}Path{{/MONOREPO}} | Stack | Command and working directory |
|---|---|---|
{{MEMBERS}}
For targeted tests and allowed scope during execution and review, read [targeted-tests](targeted-tests.md) (loaded automatically inside executor and reviewer agents; the main session reads the file); for final verification and durable output, read `rule://verification`.
{{REVIEW_ENGINE}}
## Review-clone runners
Runtime `.omp/mosaic.json` `testing` entries use these same commands with declared `testRunner` format, approved setup, argument prefix and repository-relative cwd. Read `skill://review-with-codex` only when that optional engine is selected; the default reviewer is unchanged.
The harness forwards selected paths/report arguments only for pytest, Jest and Vitest; exit-code commands run unchanged and cannot attribute a mutation to a test. Missing rootTest means no root fallback. Member repositories each need their own pinned clone and repository selector.
{{/REVIEW_ENGINE}}

## Local stack
<!-- Project-owned: /mosaic-install confirms none from the survey, or replaces it with
the required procedure below. Unknowns are marked for the human, never guessed.
For a stack, use one bullet per label: Bring-up, Stop, Teardown, Drives, Credentials,
Envelope, Coverage check, Pre-drive safety check. Keep each labelled value on one
physical line (link detailed multi-line procedures). Include exact commands and cwd,
owned-instance/endpoint selection and teardown's data effects. Envelope must cover
all credential and connection reads, including environment files and host drives;
Coverage check proves this before bring-up. Credentials, Envelope and Pre-drive
safety check may say "none needed — reason" only when explicitly established.
Never treat this starter's none as survey evidence. -->
none
