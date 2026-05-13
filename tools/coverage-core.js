const fs = require("node:fs/promises");
const path = require("node:path");

const {
  ASSERT_FAILURE_EXPECTED_MESSAGE,
  assertFailureProbeExportNames,
  createCoverageContext,
  loadHarness,
  runExpectedFailure,
  runTestFile,
  writeCoverageReport,
} = require("./watwat-core.js");

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function findFiles(root, predicate) {
  const files = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile() && predicate(entry.name)) {
        files.push(entryPath);
      }
    }
  }

  await walk(root);
  files.sort();
  return files;
}

function findCoverageManifests(root) {
  return findFiles(root, (name) => name.endsWith(".cov.json"));
}

function findCoverageTestWasms(root) {
  return findFiles(root, (name) => name.endsWith(".test.wasm"));
}

function coveragePathFor(manifestPath) {
  return path.join(
    path.dirname(manifestPath),
    `${path.basename(manifestPath, ".cov.json")}.coverage.json`,
  );
}

function coverageTestPathFor(manifestPath) {
  return path.join(
    path.dirname(manifestPath),
    `${path.basename(manifestPath, ".cov.json")}.test.wasm`,
  );
}

function blockById(manifest) {
  const blocks = new Map();

  for (const block of manifest.blocks ?? []) {
    blocks.set(block.id, block);
  }

  return blocks;
}

function uncoveredIds(report) {
  if (Array.isArray(report.uncovered_ids)) {
    return report.uncovered_ids;
  }

  if (!Array.isArray(report.hits)) {
    return [];
  }

  return report.hits
    .map((hit, id) => (hit === 0 ? id : -1))
    .filter((id) => id !== -1);
}

function percent(covered, total) {
  if (total === 0) {
    return "100.00%";
  }

  return `${((covered / total) * 100).toFixed(2)}%`;
}

function formatBlock(manifest, blocks, id) {
  const block = blocks.get(id);

  if (block === undefined) {
    return `${manifest.module ?? "unknown"}: block ${id}`;
  }

  const file = manifest.module ?? "unknown";
  const line = block.line ?? "?";
  const col = block.col ?? "?";
  const func = block.func ?? "<unknown>";
  const kind = block.kind ?? "<unknown>";

  return `${file}:${line}:${col} ${func} ${kind} block ${id}`;
}

async function checkCoverageManifest(manifestPath) {
  const manifest = await readJson(manifestPath);
  const coveragePath = coveragePathFor(manifestPath);
  const total = manifest.blocks?.length ?? 0;

  let report;
  try {
    report = await readJson(coveragePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    return {
      manifestPath,
      missingCoverage: true,
      module: manifest.module ?? manifestPath,
      covered: 0,
      total,
      uncovered: [],
    };
  }

  const blocks = blockById(manifest);
  const uncovered = uncoveredIds(report);
  const covered = Math.max(0, total - uncovered.length);
  return {
    manifestPath,
    missingCoverage: false,
    module: manifest.module ?? manifestPath,
    covered,
    total,
    uncovered: uncovered.map((id) => formatBlock(manifest, blocks, id)),
  };
}

function summarizeCoverageCheck(results) {
  let failed = false;
  let covered = 0;
  let total = 0;
  const lines = [];

  for (const result of results) {
    covered += result.covered;
    total += result.total;

    if (result.missingCoverage) {
      failed = true;
      lines.push(`coverage-check: missing ${coveragePathFor(result.manifestPath)}`);
      lines.push(`coverage-check: ${result.module} 0/${result.total} blocks covered (0.00%)`);
    }

    for (const uncovered of result.uncovered) {
      failed = true;
      lines.push(`coverage-check: uncovered ${uncovered}`);
    }

    if (!result.missingCoverage) {
      lines.push(
        `coverage-check: ${result.module} ${result.covered}/${result.total} blocks covered (${percent(result.covered, result.total)})`,
      );
    }
  }

  lines.push(`coverage-check: total ${covered}/${total} blocks covered (${percent(covered, total)})`);

  return {
    covered,
    failed,
    lines,
    total,
  };
}

async function checkCoverageRoot(root) {
  const manifests = await findCoverageManifests(root);

  if (manifests.length === 0) {
    return {
      covered: 0,
      failed: true,
      lines: [`coverage-check: no coverage manifests found in ${root}`],
      manifests,
      results: [],
      total: 0,
    };
  }

  const results = await Promise.all(manifests.map(checkCoverageManifest));
  return {
    ...summarizeCoverageCheck(results),
    manifests,
    results,
  };
}

function relatedTestPathsFor(manifestPath, testPaths) {
  const moduleBase = path.basename(manifestPath, ".cov.json");
  const exactTest = `${moduleBase}.test.wasm`;
  const splitTestPrefix = `${moduleBase}.`;

  return testPaths.filter((testPath) => {
    const testFile = path.basename(testPath);
    return testFile === exactTest || testFile.startsWith(splitTestPrefix);
  });
}

function mergeHits(target, report) {
  for (let index = 0; index < target.length; index += 1) {
    target[index] = Math.max(target[index], report.hits[index] ?? 0);
  }
}

async function accessOrThrow(file, message) {
  try {
    await fs.access(file);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`${message}: ${file}`);
    }

    throw error;
  }
}

async function loadWatwatRuntime(options = {}) {
  const toolsDir = options.toolsDir ?? __dirname;
  const rootDir = options.rootDir ?? path.resolve(toolsDir, "..");

  return {
    assertPath: options.assertPath ?? path.resolve(rootDir, "dist/wasm/std/assert.wasm"),
    harness:
      options.harness ??
      (await loadHarness(options.harnessPath ?? path.join(toolsDir, "tracy-watwat-harness.js"))),
  };
}

async function runWithCoverage(manifestPath, args, options = {}) {
  const coveragePath = coveragePathFor(manifestPath);

  try {
    await fs.rm(coveragePath, { force: true });
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  const manifest = await readJson(manifestPath);
  const coverage = createCoverageContext(manifest);
  const { assertPath, harness } = await loadWatwatRuntime(options);

  if (args[0] === "--expect-failure") {
    const [, exportName, expectedMessage, testPath] = args;
    const result = await runExpectedFailure(
      exportName,
      expectedMessage,
      testPath,
      assertPath,
      coverage,
      harness,
    );

    if (!result.ok) {
      throw new Error(`${result.name}: ${result.message}`);
    }
  } else {
    for (const testPath of args) {
      await fs.access(testPath);
      const results = await runTestFile(testPath, assertPath, coverage, harness);
      const failure = results.find((result) => !result.ok);
      if (failure !== undefined) {
        throw new Error(`${testPath} ${failure.name}: ${failure.message}`);
      }
    }
  }

  await writeCoverageReport(manifestPath, manifest, coverage);
  return readJson(coveragePath);
}

async function expectedFailureRunsFor(manifestPath, testPath) {
  if (path.basename(manifestPath) !== "assert.cov.json") {
    return [];
  }

  const probes = await assertFailureProbeExportNames(testPath);

  return probes.map((exportName) => [
    "--expect-failure",
    exportName,
    ASSERT_FAILURE_EXPECTED_MESSAGE,
    testPath,
  ]);
}

function coverageReportForHits(manifest, hits) {
  return {
    module: manifest.module,
    hits,
    uncovered_ids: hits
      .map((hit, id) => (hit === 0 ? id : -1))
      .filter((id) => id !== -1),
  };
}

async function writeMergedCoverageReport(manifestPath, manifest, hits) {
  await fs.writeFile(
    coveragePathFor(manifestPath),
    `${JSON.stringify(coverageReportForHits(manifest, hits), null, 2)}\n`,
  );
}

async function runCoverageManifest(manifestPath, testPaths, options = {}) {
  const manifest = await readJson(manifestPath);
  const testPath = coverageTestPathFor(manifestPath);
  const relatedTestPaths = relatedTestPathsFor(manifestPath, testPaths);
  if (relatedTestPaths.length === 0) {
    throw new Error(`coverage test wasm missing for ${manifestPath}`);
  }

  const hits = new Array(manifest.blocks?.length ?? 0).fill(0);
  for (const suiteTestPath of testPaths) {
    mergeHits(hits, await runWithCoverage(manifestPath, [suiteTestPath], options));
  }

  const expectedFailureRuns = await expectedFailureRunsFor(manifestPath, testPath);
  if (expectedFailureRuns.length > 0) {
    await accessOrThrow(testPath, "coverage test wasm missing");
  }

  for (const args of expectedFailureRuns) {
    mergeHits(hits, await runWithCoverage(manifestPath, args, options));
  }

  await writeMergedCoverageReport(manifestPath, manifest, hits);
}

async function runCoverageRoot(root, options = {}) {
  const manifests = await findCoverageManifests(root);
  const testPaths = await findCoverageTestWasms(root);

  if (manifests.length === 0) {
    throw new Error(`no coverage manifests found in ${root}`);
  }

  if (testPaths.length === 0) {
    throw new Error(`no coverage test wasm files found in ${root}`);
  }

  for (const manifestPath of manifests) {
    await runCoverageManifest(manifestPath, testPaths, options);
  }

  return {
    manifests,
    testPaths,
  };
}

module.exports = {
  checkCoverageManifest,
  checkCoverageRoot,
  coveragePathFor,
  coverageReportForHits,
  coverageTestPathFor,
  expectedFailureRunsFor,
  findCoverageManifests,
  findCoverageTestWasms,
  loadWatwatRuntime,
  mergeHits,
  readJson,
  relatedTestPathsFor,
  runCoverageManifest,
  runCoverageRoot,
  runWithCoverage,
  summarizeCoverageCheck,
  writeMergedCoverageReport,
};
