import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  registerWatwatExpectedFailureTests,
  registerWatwatTests,
} from "./watwat-vitest.mjs";

const require = createRequire(import.meta.url);
const {
  assertFailureProbeCases,
  findTestWasms,
} = require("./watwat-core.js");

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WAT_TEST_ROOT = "dist/wasm";
const ASSERT_FAILURE_PROBE_FILE = "dist/wasm/std/assert.test.wasm";
const EXPECTED_FAILURE_PROBE_FILES = Object.freeze([
  "dist/wasm/watwat.test.wasm",
  ASSERT_FAILURE_PROBE_FILE,
]);

function normalizedWatTestPath(file) {
  return file.replaceAll(path.sep, "/");
}

const watTestFiles = (
  await findTestWasms(path.join(ROOT_DIR, WAT_TEST_ROOT), { allowMissing: true })
).map((file) => normalizedWatTestPath(path.relative(ROOT_DIR, file)));
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
  ...(await assertFailureProbeCases(path.join(ROOT_DIR, ASSERT_FAILURE_PROBE_FILE))).map(
    (probe) => ({
      ...probe,
      file: ASSERT_FAILURE_PROBE_FILE,
    }),
  ),
];

if (expectedFailureProbes.length > 0) {
  await registerWatwatExpectedFailureTests(expectedFailureProbes, {
    harnessPath: "tools/tracy-watwat-harness.js",
  });
}
