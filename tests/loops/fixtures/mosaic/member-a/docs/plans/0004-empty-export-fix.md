---
plan: "0004"
title: Empty export fix
status: review
created: 2026-09-25
repo: member-a
branch: task/0004-empty-export-fix
areas: [member-a/member_a/api.py, contract:export_rows]
---

# Plan 0004 — Empty export fix

## Context

[D2](../../../docs/architecture/export.md#d2--empty-input-returns-an-empty-document) requires an empty document for empty input. [Plan 0002](0002-empty-export-handling.md) retained the skipped regression and unresolved defect. This conditional S9 seed records the correction awaiting close-out and landing.

## Scope

Return an empty string for empty CSV input, correct the docstring, and run the empty-input regression unskipped. Preserve non-empty CSV bytes and [D1](../../../docs/architecture/export.md#d1--csv-is-the-default-export-format).

### Out of scope

JSON, Parquet, authorization changes and cache behavior.

## Task breakdown

### T1 — Return an empty document for empty input

- repo: member-a
- files: member_a/api.py, tests/test_api.py
- reads: member_a/api.py, tests/test_api.py, ../docs/architecture/export.md
- instructions: Check emptiness before first-row access, return the empty string, correct the docstring and remove the tracked skip and unused pytest import. Retain the CSV module and non-empty output.
- acceptance: `export_rows([])` returns `""`; both existing tests pass unskipped; non-empty CSV bytes remain unchanged.

## Review checklist

- D2's empty document means an empty string, not an invented header.
- D1's default, first-row key ordering and CSV quoting remain unchanged.
- Align architecture Implications, product flow and roadmap at close-out without rewriting the decisions.

## Verification

From the member-a root after the S9 setup applies T1:

```text
$ uv run pytest tests/test_api.py -q
..                                                                       [100%]
2 passed in 0.00s
```

### Verification gaps

None for the bounded empty-input correction. Product's Parquet question and plan 0002's authorization obligation are not part of this fix.

## Planning log

The fixture author approved the empty-input correction. S9 pre-approves close-out and sign-off; the seeded branch has not landed.

## Execution log

- T1 — executor — complete: return the empty string before row access, correct the docstring and unskip the regression (`0004-T1`).
- Review — claude-reviewer — APPROVE; empty and populated CSV paths satisfy the bounded contract.
- Review — gpt-reviewer — APPROVE; existing CSV bytes preserved and the empty regression runs unskipped.
- Verification — two tests pass after the S9 setup's correction; status is review, not landed.
- Interpretation: empty CSV means empty string, not header-only (D2)
- Tradeoff: kept csv module instead of manual join
