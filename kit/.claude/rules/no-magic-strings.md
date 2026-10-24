---
paths:
{{STANDARD_PATHS}}
---
# No magic strings
Meaningful or repeated literals belong in domain-named constants files following the existing constants layout. Import them wherever used, including tests; leave only genuinely local, single-use, context-obvious values inline.
Canonical rule: `docs/standards/no-magic-strings.md`.
