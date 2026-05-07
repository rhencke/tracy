#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), "utf8");
}

function main() {
  const config = require(path.join(ROOT_DIR, ".lighthouserc.cjs"));
  const makefile = readRepoFile("Makefile");
  const workflow = readRepoFile(".github/workflows/ci.yml");
  const packageJson = JSON.parse(readRepoFile("package.json"));
  const assertions = config.ci.assert.assertions;
  const settings = config.ci.collect.settings;

  assert.equal(config.ci.collect.staticDistDir, "./dist");
  assert.deepEqual(config.ci.collect.url, ["http://localhost/"]);
  assert.equal(config.ci.collect.numberOfRuns, 1);
  assert.deepEqual(settings.onlyCategories, ["performance", "pwa"]);
  assert.equal(settings.throttlingMethod, "simulate");
  assert.equal(settings.throttling.requestLatencyMs, 150);
  assert.equal(settings.throttling.downloadThroughputKbps, 1600);
  assert.equal(settings.throttling.uploadThroughputKbps, 750);
  assert.equal(settings.throttling.cpuSlowdownMultiplier, 1);
  assert.match(settings.chromeFlags, /--enable-experimental-webassembly-features/);
  assert.match(settings.chromeFlags, /WebAssemblyJSPI/);
  assert.match(settings.chromeFlags, /--experimental-wasm-stack-switching/);

  assert.deepEqual(assertions["first-contentful-paint"], [
    "error",
    { maxNumericValue: 950 },
  ]);
  assert.deepEqual(assertions.interactive, [
    "error",
    { maxNumericValue: 1000 },
  ]);
  assert.deepEqual(assertions["total-byte-weight"], [
    "error",
    { maxNumericValue: 65000 },
  ]);
  assert.deepEqual(assertions["categories:pwa"], [
    "error",
    { minScore: 0.9 },
  ]);
  assert.equal(assertions["service-worker"], "error");
  assert.equal(assertions["installable-manifest"], "error");

  assert.equal(
    packageJson.scripts.lhci,
    "make lighthouse-ci",
  );
  assert.equal(packageJson.scripts["test:lighthouse-ci"], "node tools/lighthouse-ci-check.js");
  assert.match(workflow, /run: make lighthouse-ci/);
  assert.match(workflow, /sudo apt-get install -y google-chrome-stable/);
  assert.match(workflow, /google-chrome --version/);
  assert.match(workflow, /make app-load-bench/);
  assert.match(makefile, /lighthouse-ci: dist \.lighthouserc\.cjs/);
  assert.match(makefile, /npx --yes @lhci\/cli@0\.15\.1 autorun --config=\.lighthouserc\.cjs/);
  assert.match(makefile, /node tools\/lighthouse-ci-check\.js/);
  assert.match(workflow, /if: github\.event_name == 'pull_request'[\s\S]+Run Lighthouse CI cold-load gate/);
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
}
