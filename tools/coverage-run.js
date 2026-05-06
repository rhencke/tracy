#!/usr/bin/env node

const { execFileSync } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

const assertFailureProbes = [
  ["probe_assert_eq_i32_failure", "assert test failed"],
  ["probe_assert_eq_i64_failure", "assert test failed"],
  ["probe_assert_eq_f64_failure", "assert test failed"],
  ["probe_assert_eq_str_length_failure", "assert test failed"],
  ["probe_assert_eq_str_value_failure", "assert test failed"],
  ["probe_assert_true_failure", "assert test failed"],
  ["probe_assert_false_failure", "assert test failed"],
];

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function findManifests(root) {
  const manifests = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile() && entry.name.endsWith(".cov.json")) {
        manifests.push(entryPath);
      }
    }
  }

  await walk(root);
  manifests.sort();
  return manifests;
}

async function findTestWasms(root) {
  const tests = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile() && entry.name.endsWith(".test.wasm")) {
        tests.push(entryPath);
      }
    }
  }

  await walk(root);
  tests.sort();
  return tests;
}

function coveragePathFor(manifestPath) {
  return path.join(
    path.dirname(manifestPath),
    `${path.basename(manifestPath, ".cov.json")}.coverage.json`,
  );
}

function testPathFor(manifestPath) {
  return path.join(
    path.dirname(manifestPath),
    `${path.basename(manifestPath, ".cov.json")}.test.wasm`,
  );
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

function runWatwat(args) {
  execFileSync(process.execPath, [
    path.join(__dirname, "watwat.js"),
    "--harness",
    path.join(__dirname, "tracy-watwat-harness.js"),
    ...args,
  ], {
    stdio: "inherit",
  });
}

async function runWithCoverage(manifestPath, args) {
  const coveragePath = coveragePathFor(manifestPath);

  try {
    await fs.rm(coveragePath, { force: true });
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  runWatwat(["--cov", manifestPath, ...args]);
  return readJson(coveragePath);
}

function expectedFailureRunsFor(manifestPath, testPath) {
  if (path.basename(manifestPath) !== "assert.cov.json") {
    return [];
  }

  return assertFailureProbes.map(([exportName, expectedMessage]) => [
    "--expect-failure",
    exportName,
    expectedMessage,
    testPath,
  ]);
}

async function runManifest(manifestPath, testPaths) {
  const manifest = await readJson(manifestPath);
  const testPath = testPathFor(manifestPath);
  await accessOrThrow(testPath, "coverage test wasm missing");

  const hits = new Array(manifest.blocks?.length ?? 0).fill(0);
  for (const suiteTestPath of testPaths) {
    mergeHits(hits, await runWithCoverage(manifestPath, [suiteTestPath]));
  }

  for (const args of expectedFailureRunsFor(manifestPath, testPath)) {
    mergeHits(hits, await runWithCoverage(manifestPath, args));
  }

  await fs.writeFile(
    coveragePathFor(manifestPath),
    `${JSON.stringify(
      {
        module: manifest.module,
        hits,
        uncovered_ids: hits
          .map((hit, id) => (hit === 0 ? id : -1))
          .filter((id) => id !== -1),
      },
      null,
      2,
    )}\n`,
  );
}

function usage() {
  console.error("usage: coverage-run [--check] dist/wasm-cov");
}

async function main() {
  const args = process.argv.slice(2);
  const check = args[0] === "--check";
  const [root] = check ? args.slice(1) : args;

  if (!root) {
    usage();
    process.exitCode = 64;
    return;
  }

  const manifests = await findManifests(root);
  const testPaths = await findTestWasms(root);

  if (manifests.length === 0) {
    throw new Error(`no coverage manifests found in ${root}`);
  }

  if (testPaths.length === 0) {
    throw new Error(`no coverage test wasm files found in ${root}`);
  }

  for (const manifestPath of manifests) {
    await runManifest(manifestPath, testPaths);
  }

  if (check) {
    execFileSync(process.execPath, [path.join(__dirname, "coverage-check.js"), root], {
      stdio: "inherit",
    });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
