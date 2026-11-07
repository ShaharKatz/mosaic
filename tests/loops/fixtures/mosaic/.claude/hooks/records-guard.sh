#!/usr/bin/env bash
set -euo pipefail

project_dir=${CLAUDE_PROJECT_DIR:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)}
exec bun "$project_dir/tools/records-guard.ts" "$project_dir"
