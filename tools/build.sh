#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

jobs="${MAKE_J:-}"
if [ -z "${jobs}" ]; then
  if command -v nproc >/dev/null 2>&1; then
    jobs="$(nproc)"
  else
    jobs="$(getconf _NPROCESSORS_ONLN 2>/dev/null || printf '1')"
  fi
fi

exec make -C "${ROOT_DIR}" -j"${jobs}" dist
