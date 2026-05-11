#!/usr/bin/env node

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");

function runInlineCheck(source) {
  return childProcess.spawnSync(process.execPath, ["-e", source], {
    cwd: ROOT_DIR,
    encoding: "utf8",
  });
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

function main() {
  assertSuccessfulCheck();
  assertSyncCheckRunsImmediately();
  assertSyncFailureReportsStackAndExitCode();
  assertAsyncFailureReportsStackAndExitCode();
  assertFailureFallsBackToString();
}

main();
