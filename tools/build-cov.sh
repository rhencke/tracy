#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WAT_DIR="${ROOT_DIR}/wat"
COV_DIR="${ROOT_DIR}/dist/wasm-cov"

PATH="${ROOT_DIR}/node_modules/.bin:${PATH}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'error: %s is required on PATH\n' "$1" >&2
    exit 1
  fi
}

require_command node
require_command wat2wasm

node "${ROOT_DIR}/tools/generate-host-abi.js" --check
node "${ROOT_DIR}/tools/generate-parser-state-abi.js" --check

rm -rf "${COV_DIR}"
mkdir -p "${COV_DIR}"

if [ -d "${WAT_DIR}" ]; then
  while IFS= read -r -d '' wat_file; do
    rel_path="${wat_file#"${WAT_DIR}/"}"
    cov_wat_path="${COV_DIR}/${rel_path}"
    cov_manifest_path="${cov_wat_path%.wat}.cov.json"
    cov_wasm_path="${cov_wat_path%.wat}.wasm"

    mkdir -p "$(dirname "${cov_wat_path}")"
    if [[ "${rel_path}" == *.test.wat ]]; then
      cp "${wat_file}" "${cov_wat_path}"
    else
      node "${ROOT_DIR}/tools/instrument.js" "${wat_file}" "${cov_wat_path}" "${cov_manifest_path}"
    fi
    wat2wasm "${cov_wat_path}" -o "${cov_wasm_path}"
  done < <(find "${WAT_DIR}" -type f -name '*.wat' -print0 | sort -z)
fi
