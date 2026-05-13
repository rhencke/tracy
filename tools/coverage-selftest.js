#!/usr/bin/env node

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { instrumentWatFile } = require("./instrument.js");
const {
  createCoverageContext,
  loadHarness,
  runTestFile,
  writeCoverageReport,
} = require("./watwat-core.js");

const rootDir = path.resolve(__dirname, "..");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runNode(args, options = {}) {
  return execFileSync(process.execPath, args, {
    cwd: rootDir,
    encoding: "utf8",
    ...options,
  });
}

function blocksByFuncAndKind(manifest) {
  const seen = new Set();

  for (const block of manifest.blocks) {
    seen.add(`${block.func}:${block.kind}`);
  }

  return seen;
}

async function assertInstrumenterManifest(tmpDir) {
  const sourcePath = path.join(rootDir, "wat/watwat.cov.test.wat");
  const outputPath = path.join(tmpDir, "watwat.cov.instrumented.wat");
  const manifest = await instrumentWatFile(sourcePath, outputPath, { module: "wat/watwat.cov.test.wat" });
  const blocks = blocksByFuncAndKind(manifest);

  assert(blocks.has("$entry_value:func-entry"), "manifest missing function-entry block");
  assert(blocks.has("$folded_if_else_value:if-then"), "manifest missing folded if-then block");
  assert(blocks.has("$folded_if_else_value:if-else"), "manifest missing folded if-else block");
  assert(blocks.has("$flat_post_branch_value:post-branch"), "manifest missing post-branch block");

  for (const block of manifest.blocks) {
    assert(Number.isInteger(block.line) && block.line > 0, `block ${block.id} missing line`);
    assert(Number.isInteger(block.col) && block.col > 0, `block ${block.id} missing col`);
  }
}

async function assertWatwatCoverageOutput(tmpDir) {
  const manifestPath = path.join(tmpDir, "watwat.test.cov.json");
  await fsp.writeFile(
    manifestPath,
    `${JSON.stringify({ module: "wat/watwat.test.wat", blocks: [] }, null, 2)}\n`,
  );

  const manifest = JSON.parse(await fsp.readFile(manifestPath, "utf8"));
  const coverage = createCoverageContext(manifest);
  const harness = await loadHarness(path.join(rootDir, "tools/tracy-watwat-harness.js"));
  const results = await runTestFile(
    path.join(rootDir, "dist/wasm/watwat.test.wasm"),
    path.join(rootDir, "dist/wasm/std/assert.wasm"),
    coverage,
    harness,
  );
  const failure = results.find((result) => !result.ok);
  if (failure !== undefined) {
    throw new Error(`${failure.name}: ${failure.message}`);
  }

  await writeCoverageReport(manifestPath, manifest, coverage);

  const reportPath = path.join(tmpDir, "watwat.test.coverage.json");
  const report = JSON.parse(await fsp.readFile(reportPath, "utf8"));

  assert(report.module === "wat/watwat.test.wat", "coverage report preserves module name");
  assert(Array.isArray(report.hits), "coverage report missing hits array");
  assert(Array.isArray(report.uncovered_ids), "coverage report missing uncovered_ids array");
}

async function assertCoverageCheckReportsUncovered(tmpDir) {
  const manifestPath = path.join(tmpDir, "sample.cov.json");
  const reportPath = path.join(tmpDir, "sample.coverage.json");

  await fsp.writeFile(
    manifestPath,
    `${JSON.stringify(
      {
        module: "wat/sample.wat",
        blocks: [
          { id: 0, func: "$covered", kind: "func-entry", line: 3, col: 4 },
          { id: 1, func: "$branchy", kind: "if-else", line: 8, col: 9 },
        ],
      },
      null,
      2,
    )}\n`,
  );
  await fsp.writeFile(
    reportPath,
    `${JSON.stringify({ module: "wat/sample.wat", hits: [1, 0], uncovered_ids: [1] }, null, 2)}\n`,
  );

  try {
    runNode(["tools/coverage-check.js", tmpDir], { stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const stderr = error.stderr.toString();
    assert(stderr.includes("wat/sample.wat:8:9"), "checker output missing source location");
    assert(stderr.includes("$branchy"), "checker output missing function name");
    assert(stderr.includes("if-else"), "checker output missing block kind");
    assert(stderr.includes("wat/sample.wat 1/2 blocks covered (50.00%)"), "checker output missing module percentage");
    assert(stderr.includes("total 1/2 blocks covered (50.00%)"), "checker output missing total percentage");
    return;
  }

  throw new Error("coverage-check unexpectedly passed with an uncovered block");
}

async function main() {
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "tracy-cov-selftest-"));

  try {
    await assertInstrumenterManifest(tmpDir);
    await assertWatwatCoverageOutput(tmpDir);
    await assertCoverageCheckReportsUncovered(tmpDir);
  } finally {
    if (fs.existsSync(tmpDir)) {
      await fsp.rm(tmpDir, { recursive: true, force: true });
    }
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
