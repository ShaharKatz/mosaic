#!/usr/bin/env bash
set -euo pipefail
[[ -f tools/doctor.ts ]] || exit 0
bun "$(dirname "${BASH_SOURCE[0]}")/setup.ts" S23-final-review-ready
