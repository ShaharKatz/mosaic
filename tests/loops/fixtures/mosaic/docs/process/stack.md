---
description: "Find the member stack and the repo root used by its test command."
---
Read when: selecting a command for a member task or plan verification.
# Member stack
| Repo | Stack | Command and working directory |
|---|---|---|
| `member-a` | Python standard-library CSV/IO export API, uv, pytest | `uv run pytest <file…>` from `member-a/`; export coverage is `tests/test_api.py` |
For targeted tests and allowed scope during execution and review, read [targeted-tests](targeted-tests.md) (loaded automatically inside executor and reviewer agents; the main session reads the file); for final verification and durable output, read `rule://verification`.

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
