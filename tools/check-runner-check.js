#!/usr/bin/env node

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const MIGRATED_CHECK_FILES = Object.freeze([
  "tools/host-shim-check.js",
  "tools/service-worker-check.js",
]);

function runInlineCheck(source) {
  return childProcess.spawnSync(process.execPath, ["-e", source], {
    cwd: ROOT_DIR,
    encoding: "utf8",
  });
}

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), "utf8");
}

function assertSuccessfulCheck() {
  const result = runInlineCheck(`
    const { runCheck } = require("./tools/check-runner.js");

    runCheck(() => {});
  `);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
}

function assertSyncCheckRunsImmediately() {
  const result = runInlineCheck(`
    const assert = require("node:assert/strict");
    const { runCheck } = require("./tools/check-runner.js");
    const events = [];

    runCheck(() => {
      events.push("check");
    });
    events.push("after");

    assert.deepEqual(events, ["check", "after"]);
  `);

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
}

function assertSyncFailureReportsStackAndExitCode() {
  const result = runInlineCheck(`
    const { runCheck } = require("./tools/check-runner.js");

    runCheck(() => {
      const error = new Error("sync failure");
      error.stack = "sync stack";
      throw error;
    });
  `);

  assert.equal(result.status, 1);
  assert.equal(result.stderr, "sync stack\n");
}

function assertAsyncFailureReportsStackAndExitCode() {
  const result = runInlineCheck(`
    const { runCheck } = require("./tools/check-runner.js");

    runCheck(async () => {
      const error = new Error("async failure");
      error.stack = "async stack";
      throw error;
    });
  `);

  assert.equal(result.status, 1);
  assert.equal(result.stderr, "async stack\n");
}

function assertFailureFallsBackToString() {
  const result = runInlineCheck(`
    const { runCheck } = require("./tools/check-runner.js");

    runCheck(() => {
      throw null;
    });
  `);

  assert.equal(result.status, 1);
  assert.equal(result.stderr, "null\n");
}

function assertMigratedChecksUseSharedRunner() {
  for (const relativePath of MIGRATED_CHECK_FILES) {
    const source = readRepoFile(relativePath);

    assert.match(
      source,
      /const\s+\{\s*runCheck\s*\}\s*=\s*require\("\.\/check-runner\.js"\);/,
      `${relativePath} should import the shared check runner`,
    );
    assert.match(
      source,
      /\brunCheck\(main\);/,
      `${relativePath} should execute main through the shared check runner`,
    );
    assert.doesNotMatch(
      source,
      /\bmain\(\)\.catch\(/,
      `${relativePath} should not own async failure boilerplate`,
    );
    assert.doesNotMatch(
      source,
      /try\s*\{\s*main\(\);\s*\}\s*catch\s*\(/,
      `${relativePath} should not own sync failure boilerplate`,
    );
    assert.doesNotMatch(
      source,
      /console\.error\(error\.stack\s*\|\|\s*error\.message\s*\|\|\s*String\(error\)\);/,
      `${relativePath} should report failures through the shared check runner`,
    );
    assert.doesNotMatch(
      source,
      /process\.exitCode\s*=\s*1;/,
      `${relativePath} should set failure exit code through the shared check runner`,
    );
  }
}

function main() {
  assertSuccessfulCheck();
  assertSyncCheckRunsImmediately();
  assertSyncFailureReportsStackAndExitCode();
  assertAsyncFailureReportsStackAndExitCode();
  assertFailureFallsBackToString();
  assertMigratedChecksUseSharedRunner();
}

main();
