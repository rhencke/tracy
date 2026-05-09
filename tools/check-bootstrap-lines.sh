#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BOOTSTRAP="${ROOT_DIR}/bootstrap.mjs"
MAX_LINES=50

line_count="$(wc -l < "${BOOTSTRAP}")"
line_count="${line_count//[[:space:]]/}"

if (( line_count > MAX_LINES )); then
  printf 'error: bootstrap.mjs has %d lines; README limit is %d\n' "${line_count}" "${MAX_LINES}" >&2
  exit 1
fi
