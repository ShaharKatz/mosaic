# PR evidence

A pull request touching the selected source paths, from any author, carries a `## Evidence` section a human can understand without reading the diff or reconstructing the session. Use the project's pull request template; omit inapplicable prompts only with a reason.

## Explain and demonstrate
- Describe what changed and why: before and after behavior, the seam behind which it lives, and deliberate limits.
- For a request-path or API change, diagram the request path as built (for example, a Mermaid sequence), naming the changed boundary and request/response shapes.
- Support backend claims with exact commands and their real output, identifying the branch revision or CI run exercised. A command listed without output is not proof.
- Quantitative claims carry measured before/after numbers, units, and conditions. Do not invent measurements or imply unexecuted checks passed.
- Include redacted requests and actual responses for changed contracts; remove credentials and sensitive data without obscuring the behavior under review.
- Give reproduction commands or steps, prerequisites, and expected observations so the human can repeat the check.

## Visual claims require permission
Browser checks and picture capture are opt-in and require the human's explicit OK. When approved, pictures of the real branch, not mocks or design exports, support visual claims; identify each observed surface and state. A flow can use an ordered picture strip or recording.
Without approval or when capture was not performed, state **not verified visually**, never assert visual correctness. Name every unobserved state and condition; never claim “every state seen” when any state was not seen. Approval to capture is not proof that capture occurred.

## Verification limits and review
State what was not verified, including unexercised states, environments, data shapes, and unavailable prerequisites. Keep observed results separate from expectations.
Missing evidence alone is procedural (P) in review, including missing pictures. An observed wrong state or a false/unsupported claim is substantive (S). Reviewers apply this distinction rather than treating absent pictures as a defect in the product.
