---
description: "Shared first convention"
scope: {{STANDARD_SCOPE}}
condition: ".*"
interruptMode: tool-only
---
# Shared first
Reuse {{DESIGN_SYSTEM}}, then the component's shared layer, before creating a shared module that both callers adopt in the same change. Derive rather than retype; a second copy of an existing vocabulary, map, helper or asset is a defect.
Canonical rule: `docs/standards/shared-first.md`.
