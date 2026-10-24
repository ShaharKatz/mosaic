# Testing — choose the right surface

## Which suite

- Pure single-module logic belongs in in-process unit tests; cross-module contracts belong in in-process integration tests with real collaborators. The component owning a cross-component contract owns its tests; update the other participant's suite in the same change.
- Infrastructure-dependent tests belong on a guarded smoke or end-to-end surface, never unguarded in the unit gate. Exercise real in-repository collaborators in integration tests, replacing only external systems at their boundaries. Validate live dependencies only on an authorized smoke or end-to-end surface.
- Read `rule://stack` (`docs/process/stack.md`) for each component's actual commands and working directory. During execution/review run only affected tests; leave the whole-suite gate for final verification. Record unavailable prerequisites rather than claiming a pass.

## Layout and isolation

When adding or restructuring a test root, use `tests/unit/` for no-I/O single-module cases, `tests/integration/` for in-process cross-module cases, `tests/smoke/` or `tests/e2e/` for live infrastructure, `tests/constants/` for test-only domain constants, and `tests/data/` for small curated samples. Do not mass-move existing suites.

Import wire literals from production constants. Anchor data paths to the test file, not the working directory. Keep generated, large and customer data in the project's excluded-data location. Tests must be independent across parallel processes: use isolated temporary paths and allocated ports rather than shared mutable resources. Gate live dependencies explicitly on their required environment.

## Quality bar

Choose black-box cases from public inputs, outputs, boundaries and errors, then cover missing branches. Prefer runner-native parameterization and fixtures to repeated handwritten cases. Follow FIRST: fast, isolated, repeatable, self-validating, timely (in the same change). Mock only external boundaries such as network, clock, subprocess and SDKs; patch where looked up, clean up patches, and exercise real in-repository collaborators.

## Surfaces
