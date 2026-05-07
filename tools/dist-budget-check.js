#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");

const DEFAULT_BUDGET_BYTES = 200000;
const ROOT_DIR = path.resolve(__dirname, "..");

function compressedBytes(file) {
  return zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length;
}

function totalCompressedBytes(files) {
  return files.reduce((total, file) => total + compressedBytes(file), 0);
}

function parseArgs(argv) {
  const options = {
    budget: Number.parseInt(
      process.env.TRACY_DIST_COMPRESSED_BUDGET_BYTES ?? String(DEFAULT_BUDGET_BYTES),
      10,
    ),
    files: [],
    selfTest: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--budget") {
      index += 1;
      options.budget = Number.parseInt(argv[index] ?? "", 10);
    } else {
      options.files.push(arg);
    }
  }

  return options;
}

function assertBudget({ budget, files }) {
  if (!Number.isInteger(budget) || budget <= 0) {
    throw new Error("--budget must be a positive integer byte count");
  }
  if (files.length === 0) {
    throw new Error("at least one dist file is required");
  }

  const missing = files.filter((file) => !fs.existsSync(file));
  if (missing.length > 0) {
    throw new Error(`missing dist files: ${missing.join(", ")}`);
  }

  const total = totalCompressedBytes(files);
  if (total > budget) {
    throw new Error(
      `dist compressed transfer budget exceeded: ${total} bytes > ${budget} bytes`,
    );
  }

  console.log(`dist compressed transfer: ${total} bytes <= ${budget} bytes`);
}

function runSelfTest() {
  const makefile = fs.readFileSync(path.join(ROOT_DIR, "Makefile"), "utf8");
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8"));
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tracy-dist-budget-"));

  try {
    const small = path.join(tmpDir, "small.txt");
    const large = path.join(tmpDir, "large.bin");

    fs.writeFileSync(small, "tracy\n");
    fs.writeFileSync(large, Buffer.alloc(4096, 0xff));

    assert(compressedBytes(small) > 0);
    assert.equal(
      totalCompressedBytes([small, large]),
      compressedBytes(small) + compressedBytes(large),
    );
    assert.doesNotThrow(() =>
      assertBudget({ budget: totalCompressedBytes([small]), files: [small] }),
    );
    assert.throws(
      () => assertBudget({ budget: 1, files: [small, large] }),
      /dist compressed transfer budget exceeded/,
    );
    assert.throws(
      () => assertBudget({ budget: DEFAULT_BUDGET_BYTES, files: [path.join(tmpDir, "missing")] }),
      /missing dist files/,
    );
    assert.equal(packageJson.scripts["test:dist-budget"], "node tools/dist-budget-check.js --self-test");
    assert.match(makefile, /DIST_COMPRESSED_BUDGET_BYTES \?= 200000/);
    assert.match(makefile, /dist-size-budget: \$\(DIST_FILES\) tools\/dist-budget-check\.js/);
    assert.match(makefile, /node tools\/dist-budget-check\.js --budget \$\(DIST_COMPRESSED_BUDGET_BYTES\) \$\(DIST_FILES\)/);
    assert.match(makefile, /node tools\/dist-budget-check\.js --self-test/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

try {
  const options = parseArgs(process.argv.slice(2));

  if (options.selfTest) {
    runSelfTest();
  } else {
    assertBudget(options);
  }
} catch (error) {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
}
