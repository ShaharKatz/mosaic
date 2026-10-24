# S24 — Fetch failures, concurrent heads and the final-review limit

1. A paginated comment fetch emits an empty first page then exits nonzero on page two. The docs-only exemption must not turn that failure into no comments or readiness; report the failure without retrying forever.
2. For head-moved, obtain a real first final verdict, trigger the offline concurrent-writer hook, discover the remote/local mismatch, fast-forward and replay the previous reviewed patch. Dispatch a delta round with the new pinned head and retain new-head CI, rather than announcing the first SHA ready.
3. The planned two-revise case has two substantive final REVISE rounds, an unresolved arithmetic acceptance defect and no waiver. Escalate to the human without repairing it, dispatching a third round, or resetting the final counter because task-review cycles are zero.
4. Record the final verdicts, exemption/failure and human escalation in branch history/plan records, as well as the output companion and final report. Do not fabricate approvals or mutate the fake host's control state directly.

Mosaic-only; uses S23's shared setup, offline gh boundary and observable assertion helpers. No production host access or merge is permitted.
