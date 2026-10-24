---
name: diagrams
description: Edit topology through mounted drawio MCP, validate provenance and return worktree projections/deltas without committing.
---
# Diagram updates

Scope: `{{DIAGRAMS_ROOT}}/` under the target repository root. Run commands from that root; for scratch repositories without installed tools, use `bun <installed root>/tools/<tool>.ts` with cwd set to scratch and its own `.omp/mosaic.json` settings.

## 1. Precheck before any write
Read `rule://records`. Confirm drawio is mounted: omp reads `xd://mcp__drawio_set_page`; Claude Code lists `mcp__drawio__set_page`. If unavailable, stop with **start the drawio MCP (`.mcp.json`) and retry**, changing nothing. Configuration alone is not availability proof.
The project-owned mount uses `npx -y {{DRAWIO_PACKAGE}}`; its pin comes from `tools/constants/diagrams.ts`. Never replace other servers. omp reads device schemas and writes JSON to `xd://mcp__drawio_<tool>`; Claude Code calls `mcp__drawio__<tool>`. Read actual argument schemas before calls.

## 2. Read inputs
Read `{{DIAGRAMS_ROOT}}/README.md`, the plan's Architecture delta, exact authorized paths and base SHA. Require recorded global decisions and existing intent for decision-changing edits: approved `plan:NNNN` without a tracker, otherwise `tracker://<key>` per the tracker rule. Missing inputs or conflicting scope/contract are stop conditions, never invented decisions.

## 3. Bootstrap or normalize
For a new file only, write this empty uncompressed wrapper before MCP editing. The pinned server's `set_page` replaces an existing page's model, not its outer file:

```xml
<mxfile compressed="false">
  <diagram id="page-1" name="Page-1">
    <mxGraphModel page="1" pageWidth="1600" pageHeight="1100">
      <root>
        <mxCell id="0"/>
        <mxCell id="as-built" value="as-built" parent="0"/>
        <mxCell id="intended" value="intended" parent="0"/>
        <mxCell id="retiring" value="retiring" parent="0"/>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

For an existing compressed file, run `bun tools/diagram-check.ts --normalize <file>` before MCP editing.

## 4. Draw through MCP
1. `list_pages`, then `get_page` for the selected page.
2. Compose a model with stable logical ids, object wrappers, layers, styles, provenance, endpoint visibility and geometry per the contract.
3. `set_page`, then `get_page` again; confirm read-back matches the submitted model and fix mismatches before continuing.
4. Run `bun tools/diagram-check.ts --normalize <file>` to keep readable XML. Confirm normalization does not change `bun tools/diagram-delta.ts project <file>` output.

## 5. Validate and report
Run `bun tools/diagram-check.ts <file>`, `bun tools/diagram-delta.ts delta <base sha> --worktree <file>`, `bun tools/diagram-delta.ts project <file>` and `bun tools/diagram-delta.ts compare <plan> <base sha> --worktree`. Fix failures and repeat affected proof. Optional `open_drawio_xml` is for human viewing, not review evidence.
Return the worktree delta, validator count line, text projection, comparison result and changed files. The orchestrator independently verifies before committing.

## Hard boundaries
Never stage or commit, never edit outside the authorized diagrams home, never read SVG as text, never silently skip an unavailable MCP or substitute manual topology edits beyond bootstrap/normalization. No generated-file ownership is implied by the core bundle.
{{DIAGRAMS_ERD}}
Generated Prisma ERDs under the configured adapter output are never keeper-edited. Follow `rule://diagrams`'s generated-ERD guidance instead; generation and sync checks need no MCP.
{{/DIAGRAMS_ERD}}
