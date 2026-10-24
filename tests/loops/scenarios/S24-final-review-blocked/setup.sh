#!/usr/bin/env bash
set -euo pipefail
[[ -f tools/doctor.ts ]] || exit 0
bun "$(dirname "${BASH_SOURCE[0]}")/../S23-final-review-ready/setup.ts" S24-final-review-blocked
