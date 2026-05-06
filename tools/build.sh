#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
WAT_DIR="${ROOT_DIR}/wat"
STATIC_DIR="${ROOT_DIR}/static"

PATH="${ROOT_DIR}/node_modules/.bin:${PATH}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'error: %s is required on PATH\n' "$1" >&2
    exit 1
  fi
}

require_command wat2wasm
require_command esbuild
require_command sha256sum

node "${ROOT_DIR}/tools/generate-host-abi.js" --check
node "${ROOT_DIR}/tools/generate-parser-state-abi.js" --check

rm -rf "${DIST_DIR}"
mkdir -p "${DIST_DIR}/wasm"

if [ -d "${WAT_DIR}" ]; then
  while IFS= read -r -d '' wat_file; do
    rel_path="${wat_file#"${WAT_DIR}/"}"
    wasm_path="${DIST_DIR}/wasm/${rel_path%.wat}.wasm"
    mkdir -p "$(dirname "${wasm_path}")"
    wat2wasm "${wat_file}" -o "${wasm_path}"
  done < <(find "${WAT_DIR}" -type f -name '*.wat' -print0 | sort -z)
fi

esbuild "${ROOT_DIR}/bootstrap.js" \
  --bundle \
  --minify \
  --sourcemap \
  --outfile="${DIST_DIR}/bootstrap.bundle.js"

cp "${ROOT_DIR}/index.html" "${DIST_DIR}/index.html"
cp "${ROOT_DIR}/manifest.webmanifest" "${DIST_DIR}/manifest.webmanifest"

if [ -d "${STATIC_DIR}/icons" ]; then
  mkdir -p "${DIST_DIR}/icons"
  cp -R "${STATIC_DIR}/icons/." "${DIST_DIR}/icons/"
fi

build_hash="$(
  cd "${DIST_DIR}"
  find . -type f ! -name 'build-info.js' -print0 \
    | sort -z \
    | xargs -0 sha256sum \
    | sha256sum \
    | awk '{ print $1 }'
)"

cat > "${DIST_DIR}/build-info.js" <<EOF
export const TRACY_BUILD_HASH = "${build_hash}";
EOF
