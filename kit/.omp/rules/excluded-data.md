---
description: "Excluded data convention"
scope: {{STANDARD_SCOPE}}
condition: ".*"
interruptMode: tool-only
---
# Excluded data
Route data outputs into `{{EXCLUDED_DATA_DIR}}/`, namespaced by tool; ignore that folder once, never add per-output ignore entries. Commit only small reviewed, sanitized fixtures. Credentials follow the project's existing secrets handling.
Canonical rule: `docs/standards/excluded-data.md`.
