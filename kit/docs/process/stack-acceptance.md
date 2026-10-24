---
description: "Declare and run local-stack acceptance with the project's keyless envelope and safety checks."
---
Read when: writing a plan's Verification, running final verification, or requesting local-stack acceptance on the light path.
# Declaring scenarios
- Every plan's Verification has `### Stack acceptance`: `stack: none — <reason>`, or the smallest local stack that exercises the change and its scenarios. If the project's Local stack section says `none`, declare `stack: none — no local stack`.
- Older plans without the block: log `stack: not declared (pre-rule plan)` and continue.
- Each `S<k>` states what it proves; `exercises:` the code paths covered; the drive; the passing observation (log, row, status/body or visible state); and the edge cases chosen and why.
- Read the project-owned **Local stack** section of `rule://stack` before choosing commands. Unknown procedure or safety facts block a run; never invent them.
# Envelope and safety
- Run every stack command and host-side drive inside the declared envelope. Whenever the stack reads any credential, the envelope is required: remove or blank every credential and connection override read by configuration, environment files, host drives and their imports so local defaults apply. Never source real credentials.
- Before bring-up, run the project's coverage check proving no credential or connection variable is uncovered, including environment-file precedence and host-side drives. Stop on an uncovered variable; never weaken the check to proceed.
- `none needed — <reason>` is an explicit project statement, never an assumed envelope exemption. It requires no credential or connection overrides to be read.
- Before each drive, run the project's pre-drive safety check (or retain its explicit `none needed` reason). A write to an external system needs a named, human-approved line in the plan. A real key or spend also names its variable and approval; only the approved variable may leave the envelope. Never retain secret values in evidence.
# Running
- After every task has the required APPROVE and the other Verification steps pass, the orchestrator dispatches `stack-operator` with the plan's Stack acceptance block, head commit and evidence folder. {{LANDING_PULL_REQUEST}}Run before `rule://final-review`, so the review sees the evidence.{{/LANDING_PULL_REQUEST}}{{LANDING_DIRECT}}Run before human sign-off.{{/LANDING_DIRECT}} Route failure as a defect through `rule://review-loop`.
- Use only the project's bring-up, drive, stop and teardown procedure. Record the owned instance and endpoints; never touch another session's stack. Stop the owned stack afterwards and on failure. Never run data-dropping teardown unless the plan explicitly says the state is disposable.
- A later change to any `exercises:` path or to the scenario's declaration reruns that scenario on the new head before sign-off; after sign-off, rerun before readiness/landing.{{LANDING_PULL_REQUEST}} Repairs rerun affected scenarios before the next final-review round.{{/LANDING_PULL_REQUEST}}
# Evidence
- Per scenario, write `docs/plans/evidence/<NNNN>/stack/S<k>.md`: head commit, owned instance/endpoints, envelope, coverage and pre-drive safety output, exact commands with actual exit codes, and observation excerpts supporting PASS or FAIL. Never include secrets or session tokens.
- Execution log: `- stack S<k> @<sha>: PASS|FAIL — <observation>`.
# Light path and inline work
- Light-path work runs acceptance only on human request or when the change can only be observed at runtime; retain scenario evidence in the run directory and its scenarios and result in the commit body. When it is required, a PASS on the current head is a landing gate: the change does not land{{LANDING_PULL_REQUEST}}, and `rule://final-review` does not start,{{/LANDING_PULL_REQUEST}} until it passes, and a FAIL routes through `rule://review-loop` like a review finding. Inline work never runs it.
