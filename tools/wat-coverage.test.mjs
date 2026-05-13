import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, test } from "vitest";

const require = createRequire(import.meta.url);
const {
  coverageTestPathFor,
  expectedFailureRunsFor,
  findCoverageManifests,
  findCoverageTestWasms,
  readJson,
  runCoverageManifest,
} = require("./coverage-core.js");

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COVERAGE_ROOT = path.join(ROOT_DIR, "dist/wasm-cov");

function relativeCoveragePath(file) {
  return path.relative(ROOT_DIR, file).replaceAll(path.sep, "/");
}

async function coverageRootExists() {
  try {
    await fs.access(COVERAGE_ROOT);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function coverageCaseName(manifest, manifestPath) {
  const moduleName = manifest.module ?? relativeCoveragePath(manifestPath);
  const testPath = coverageTestPathFor(manifestPath);
  const expectedFailureRuns = expectedFailureRunsFor(manifestPath, testPath);

  if (expectedFailureRuns.length === 0) {
    return `${moduleName} coverage`;
  }

  const probes = expectedFailureRuns.map(([, exportName]) => exportName).join(", ");
  return `${moduleName} coverage with expected-failure probes: ${probes}`;
}

async function coverageCases() {
  if (!(await coverageRootExists())) {
    return [];
  }

  const [manifestPaths, testPaths] = await Promise.all([
    findCoverageManifests(COVERAGE_ROOT),
    findCoverageTestWasms(COVERAGE_ROOT),
  ]);

  return Promise.all(
    manifestPaths.map(async (manifestPath) => ({
      manifestPath,
      name: coverageCaseName(await readJson(manifestPath), manifestPath),
      testPaths,
    })),
  );
}

const cases = await coverageCases();

if (cases.length === 0) {
  test.skip("dist/wasm-cov coverage artifacts are not built", () => {});
} else {
  describe("WAT coverage", () => {
    for (const coverageCase of cases) {
      test(coverageCase.name, async () => {
        await runCoverageManifest(coverageCase.manifestPath, coverageCase.testPaths);
      });
    }
  });
}
