# No magic strings

Repeated or meaningful string and numeric literals — header names, error codes, issuers, allowlists, routes, environment keys and wire-level status strings — belong in a named, domain-specific constants file. Import them at use sites and in tests; do not retype protocol literals in specs.

Follow the component's existing constants layout. For example, use `src/constants/<domain>.ts`, a Python `constants/` package, or `constants.py` inside the named domain package. Name new files for their domain, not `misc`; do not introduce another competing layout.

Leave a genuinely single-use, local, context-obvious value inline, including framework-idiomatic decorators when extraction obscures them. Extract a string with cross-file or domain meaning before using it. Shared production/test literals always come from the production constant.
