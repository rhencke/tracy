#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

while IFS='|' read -r export_name expected_message wasm_path; do
  if [[ -z "${export_name}" || "${export_name}" == \#* ]]; then
    continue
  fi

  node "${ROOT_DIR}/tools/watwat.js" \
    --expect-failure "${export_name}" "${expected_message}" "${ROOT_DIR}/${wasm_path}"
done <<'PROBES'
probe_assert_eq_i32_failure|assert test failed|dist/wasm/std/assert.test.wasm
probe_assert_eq_i64_failure|assert test failed|dist/wasm/std/assert.test.wasm
probe_assert_eq_f64_failure|assert test failed|dist/wasm/std/assert.test.wasm
probe_assert_eq_str_length_failure|assert test failed|dist/wasm/std/assert.test.wasm
probe_assert_eq_str_value_failure|assert test failed|dist/wasm/std/assert.test.wasm
probe_assert_true_failure|assert test failed|dist/wasm/std/assert.test.wasm
probe_assert_false_failure|assert test failed|dist/wasm/std/assert.test.wasm
PROBES
