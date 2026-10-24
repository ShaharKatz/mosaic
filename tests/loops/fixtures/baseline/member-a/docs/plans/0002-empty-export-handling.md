---
plan: "0002"
title: Empty export handling
status: executing
created: 2026-09-03
repo: member-a
branch: task/0002-empty-export-handling
---

# Plan 0002 — Empty export handling

## Context

The CSV exporter indexes the first row even for empty input, raising `IndexError` instead of returning the empty document required by [D2](../../../docs/architecture/export.md#d2--empty-input-returns-an-empty-document). This member-homed plan covers that regression. [D1](../../../docs/architecture/export.md#d1--csv-is-the-default-export-format) preserves existing CSV calls.

## Scope

Record the empty-input regression, document the current API, and retain explicit close-out obligations. Non-empty CSV behavior must stay unchanged.

### Out of scope

Changing export authorization and choosing a second output format.
The future auth module belongs to plan 0004 (not yet drafted).

## Task breakdown

### T1 — Record the member-homed plan

- repo: member-a
- files: docs/plans/0002-empty-export-handling.md, docs/plans/README.md
- reads: ../docs/architecture/export.md, ../docs/plans/README.md
- instructions: Record the bounded regression work and its local ledger row; preserve the unresolved defect and other leftovers explicitly.
- acceptance: The member ledger points to this executing plan and the tasks distinguish recorded regression from verified behavior.

### T2 — Document and retain the empty-input test

- repo: member-a
- files: member_a/api.py, tests/test_api.py
- reads: member_a/api.py, tests/test_api.py, ../docs/architecture/export.md
- instructions: Add the export docstring and a `test_export_empty` assertion for the empty string. Keep the unresolved case explicitly skipped with reason `tracked in plan 0002 verification gaps`; preserve the existing non-empty CSV behavior.
- acceptance: The existing CSV test passes, the empty-input test is present with its tracked skip, and the remaining defect is not represented as verified behavior.

## Review checklist

- D1's CSV default, first-row column order, quoting and line terminators remain unchanged.
- The skipped minimum-arity case is visible under Verification gaps, not counted as coverage of D2.
- Close-out must distinguish a current defect, a conditional obligation, and a product question.

## Verification

From the member-a root:

```text
$ uv run pytest tests/test_api.py -q
.s                                                                       [100%]
1 passed, 1 skipped in 0.00s
```

The skipped test is not evidence of empty-input correctness.

### Verification gaps

- (a) DEFECT — `export_rows([])` still raises IndexError; `test_export_empty` left skipped.
- (b) OBLIGATION — when the auth module (plan 0004, not yet drafted) moves to OAuth, re-verify export authorization.
- (c) QUESTION — product has not decided whether Parquet is a required second format.

## Planning log

The fixture author approved the bounded regression-recording tasks. Implementation defects and product-owned questions remain visible for human-directed close-out.

## Execution log

- T1 — executor — complete: recorded the member-homed plan and local ledger (`0002-T1`).
- T2 — executor — complete: added the docstring and tracked skipped regression test (`0002-T2`).
- Review — claude-reviewer — APPROVE; [note] `export_rows` docstring still says 'always returns at least the header row'.
- Review — gpt-reviewer — APPROVE; [note] `export_rows` docstring still says 'always returns at least the header row'.
- Verification — the pytest command and full output are pasted above. Human close-out and landing have not been recorded; status remains executing.
