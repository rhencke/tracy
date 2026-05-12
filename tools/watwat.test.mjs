import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  registerWatwatExpectedFailureTests,
  registerWatwatTests,
} from "./watwat-vitest.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WAT_TEST_DIRS = Object.freeze(["dist/wasm", "dist/wasm/std"]);
const ASSERT_FAILURE_PROBES = Object.freeze([
  "probe_assert_eq_i32_failure",
  "probe_assert_eq_i64_failure",
  "probe_assert_eq_f64_failure",
  "probe_assert_eq_str_length_failure",
  "probe_assert_eq_str_value_failure",
  "probe_assert_true_failure",
  "probe_assert_false_failure",
]);

async function watTestFilesIn(dir) {
  let entries;

  try {
    entries = await fs.readdir(path.join(ROOT_DIR, dir), { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".test.wasm"))
    .map((entry) => path.join(dir, entry.name));
}

const watTestFiles = (
  await Promise.all(WAT_TEST_DIRS.map((dir) => watTestFilesIn(dir)))
).flat().sort();
const watTestFileSet = new Set(watTestFiles);

if (watTestFiles.length > 0) {
  await registerWatwatTests(watTestFiles, {
    harnessPath: "tools/tracy-watwat-harness.js",
  });
}

const expectedFailureProbes = [
  {
    exportName: "probe_assert_eq_i32_failure",
    expectedMessage: "deliberate i32 failure",
    file: "dist/wasm/watwat.test.wasm",
  },
  ...ASSERT_FAILURE_PROBES.map((exportName) => ({
    exportName,
    expectedMessage: "assert test failed",
    file: "dist/wasm/std/assert.test.wasm",
  })),
].filter((probe) => watTestFileSet.has(probe.file));

if (expectedFailureProbes.length > 0) {
  await registerWatwatExpectedFailureTests(expectedFailureProbes, {
    harnessPath: "tools/tracy-watwat-harness.js",
  });
}
