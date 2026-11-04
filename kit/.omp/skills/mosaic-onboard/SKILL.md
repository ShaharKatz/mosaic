---
name: mosaic-onboard
description: Choose your roster identity and personal handoff defaults; write only the validated user file outside the repository.
---
{{HANDOFF}}
# /mosaic-onboard — Set personal handoff defaults
Read each named rule once per session; a later step naming a rule you already read means apply it, not reread it.
Read `rule://records` before proceeding.
This skill never edits the repository, roster, flows, or preview cards and never commits or posts to a tracker. Its only write is the user file produced by `tools/handoff.ts user --write`.

1. Read `rule://handoff` "Flow at planning"; read `.omp/mosaic.json`. Run all commands below from the link root. Require the installed `handoff` module; if absent, explain that enabling it is a reviewed `/mosaic-kit` change and stop.
2. Ask who the contributor is; run `bun tools/handoff.ts roster` and match their confirmed handle, never infer identity from the runtime account. Report a malformed roster or unavailable metadata instead of inventing people or roles.
   If the person is absent, propose a row for `docs/surfaces/people.md` in the conversation as a light-path documentation change under the records rule. Use its existing columns, verified tracker author id/mention and GitHub login, declared roles and acceptance preferences; use `—` for missing identities, never emails or secrets, and never reuse a handle. Do not apply the row from this skill; stop until a separately reviewed change makes the person available.
3. Run `bun tools/handoff.ts user` to show the existing personal settings and exact path. The tool derives the project key from committed link-repo remote metadata and stores one file under `$XDG_CONFIG_HOME` (or `~/.config`), shared by checkouts and runtimes; never hand-derive a checkout-local copy.
4. Ask for a default flow: one installed flow id, `none`, or no personal default (use area matching). Ask which roster person, if any, should be the default acceptor for each gate role; `bun tools/handoff.ts roster --role <role>` lists candidates. Defaults cannot add flows, roles or people; preferences never widen a gate's allowed surfaces or artifacts. Keep an unset choice unset, not a fabricated default.
5. Show the complete proposed replacement and obtain the contributor's choices before writing. Run `bun tools/handoff.ts user --write --me @<handle>` with `--flow <id|none>` only when chosen and one `--acceptor <role>=@<handle>` per chosen role; quote argument values. The CLI validates before writing; on exit 1, explain the invalid choice and resolve it with the human, never bypass validation or hand-edit JSON.
6. Run `bun tools/handoff.ts user` again and show its JSON output, including path, validity and saved content. Finish only when it exits 0 with the intended settings. Explain that these are personal defaults, not approval: each plan records its confirmed `flow:`/`acceptors:` and offers the human a skip choice.
{{/HANDOFF}}
