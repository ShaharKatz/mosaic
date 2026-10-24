# Shared first

Before writing a component, constant, map, helper or asset, find and reuse what already exists. A second copy of a vocabulary, mapping or asset is a defect, not a convenience. Resolve in this order and stop at the first hit:

1. **Design system:** {{DESIGN_SYSTEM}}. Reuse its components, tokens, palettes, name maps and assets; use a supported direct import when a barrel does not export the needed item rather than reimplementing it.
2. **The component's shared layer:** existing shared components, helpers, assets and domain constants. For example, a `constants/` package or `src/constants/<domain>.ts`.
3. **A new shared module:** when two call sites need the same thing, create it in the shared layer and migrate both callers in the same change. Do not leave the first copy inline.

Derive shared values from the layer above rather than retyping them so upstream changes propagate. If a derivation must mirror an unexported internal, name that dependency so upgrades recheck it.

When touching a local copy of something shareable, replace it with the shared source in that change; never add another local copy. Reviewers treat a new duplicate of an existing shared thing as a substantive finding.
