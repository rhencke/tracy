import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, test } from "vitest";

const require = createRequire(import.meta.url);
const {
  checkCoverageRoot,
  coverageTestPathFor,
  expectedFailureRunsFor,
  findCoverageManifests,
  findCoverageTestWasms,
  readJson,
  runCoverageManifest,
} = require("./coverage-core.js");

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COVERAGE_ROOT = path.join(ROOT_DIR, "dist/wasm-cov");
const CHECK_COVERAGE = process.env.WAT_COVERAGE_CHECK === "1";

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

async function coverageArtifacts() {
  if (!(await coverageRootExists())) {
    return {
      rootExists: false,
      cases: [],
    };
  }

  const [manifestPaths, testPaths] = await Promise.all([
    findCoverageManifests(COVERAGE_ROOT),
    findCoverageTestWasms(COVERAGE_ROOT),
  ]);

  return {
    rootExists: true,
    cases: await Promise.all(
      manifestPaths.map(async (manifestPath) => ({
        manifestPath,
        name: coverageCaseName(await readJson(manifestPath), manifestPath),
        testPaths,
      })),
    ),
  };
}

async function assertCoverageRootComplete() {
  const result = await checkCoverageRoot(COVERAGE_ROOT);

  for (const line of result.lines) {
    console.error(line);
  }

  if (result.failed) {
    throw new Error(result.lines.join("\n"));
  }
}

const artifacts = await coverageArtifacts();

if (!artifacts.rootExists) {
  const testMissingCoverageRoot = CHECK_COVERAGE ? test : test.skip;

  testMissingCoverageRoot("dist/wasm-cov coverage artifacts are built", () => {
    throw new Error("dist/wasm-cov coverage artifacts are not built");
  });
} else if (artifacts.cases.length === 0) {
  test.skip("dist/wasm-cov coverage artifacts are not built", () => {});
} else {
  describe.sequential("WAT coverage", () => {
    for (const coverageCase of artifacts.cases) {
      test(coverageCase.name, async () => {
        await runCoverageManifest(coverageCase.manifestPath, coverageCase.testPaths);
      });
    }

    if (CHECK_COVERAGE) {
      test("coverage-check reports full WAT coverage", async () => {
        await assertCoverageRootComplete();
      });
    }
  });
}
