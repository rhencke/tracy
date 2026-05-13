import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  registerWatwatExpectedFailureTests,
  registerWatwatTests,
} from "./watwat-vitest.mjs";

const require = createRequire(import.meta.url);
const {
  ASSERT_FAILURE_EXPECTED_MESSAGE,
  assertFailureProbeExportNames,
} = require("./watwat-core.js");

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WAT_TEST_DIRS = Object.freeze(["dist/wasm", "dist/wasm/std"]);
const ASSERT_FAILURE_PROBE_FILE = "dist/wasm/std/assert.test.wasm";
const EXPECTED_FAILURE_PROBE_FILES = Object.freeze([
  "dist/wasm/watwat.test.wasm",
  ASSERT_FAILURE_PROBE_FILE,
]);

function normalizedWatTestPath(file) {
  return file.replaceAll(path.sep, "/");
}

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
    .map((entry) => normalizedWatTestPath(path.join(dir, entry.name)));
}

const watTestFiles = (
  await Promise.all(WAT_TEST_DIRS.map((dir) => watTestFilesIn(dir)))
).flat().sort();
const watTestFileSet = new Set(watTestFiles);
const missingExpectedFailureProbeFiles = EXPECTED_FAILURE_PROBE_FILES.filter(
  (file) => !watTestFileSet.has(normalizedWatTestPath(file)),
);

if (missingExpectedFailureProbeFiles.length > 0) {
  throw new Error(
    `missing expected-failure probe module(s): ${missingExpectedFailureProbeFiles.join(", ")}`,
  );
}

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
  ...(await assertFailureProbeExportNames(path.join(ROOT_DIR, ASSERT_FAILURE_PROBE_FILE))).map(
    (exportName) => ({
      exportName,
      expectedMessage: ASSERT_FAILURE_EXPECTED_MESSAGE,
      file: ASSERT_FAILURE_PROBE_FILE,
    }),
  ),
];

if (expectedFailureProbes.length > 0) {
  await registerWatwatExpectedFailureTests(expectedFailureProbes, {
    harnessPath: "tools/tracy-watwat-harness.js",
  });
}
