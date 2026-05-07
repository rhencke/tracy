#!/usr/bin/env node

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const FORBIDDEN_ISOLATION_PATTERNS = [
  /\bSharedArrayBuffer\b/,
  /\bCOOP\b/,
  /\bCOEP\b/,
  /Cross-Origin-Opener-Policy/,
  /Cross-Origin-Embedder-Policy/,
];

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), "utf8");
}

function assertNoIsolationRequirement(relativePath) {
  const source = readRepoFile(relativePath);

  for (const pattern of FORBIDDEN_ISOLATION_PATTERNS) {
    assert(
      !pattern.test(source),
      `${relativePath} should not require ${pattern.source}`,
    );
  }
}

function assertTracked(relativePath) {
  const output = childProcess.execFileSync(
    "git",
    ["ls-files", "--error-unmatch", relativePath],
    {
      cwd: ROOT_DIR,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  assert.equal(output.trim(), relativePath);
}

function main() {
  const buildScript = readRepoFile("tools/build.sh");
  const makefile = readRepoFile("Makefile");
  const runtimeSource = readRepoFile("host/runtime.mjs");
  const workerSource = readRepoFile("worker.js");
  const packageJson = JSON.parse(readRepoFile("package.json"));

  assert.match(
    buildScript,
    /exec make -C "\$\{ROOT_DIR\}" -j"\$\{jobs\}" dist/,
    "build shim should delegate to make dist",
  );
  assert.match(
    makefile,
    /dist\/bootstrap\.bundle\.js dist\/bootstrap\.bundle\.js\.map &:[\s\S]+esbuild bootstrap\.js[\s\S]+--outfile=dist\/bootstrap\.bundle\.js/,
    "make should emit the main bootstrap bundle",
  );
  assert.match(
    makefile,
    /dist\/worker\.bundle\.js dist\/worker\.bundle\.js\.map &:[\s\S]+esbuild worker\.js[\s\S]+--format=esm[\s\S]+--outfile=dist\/worker\.bundle\.js/,
    "make should emit the module worker bundle",
  );
  assert.match(runtimeSource, /const WORKER_URL = "worker\.bundle\.js"/);
  assert.match(
    runtimeSource,
    /new WorkerCtor\(options\.workerUrl \?\? WORKER_URL, \{ type: "module" \}\)/,
  );
  assert.match(
    workerSource,
    /createIngestWorkerMessageHandler/,
    "worker entrypoint should install the ingest message handler",
  );
  assert.equal(
    packageJson.scripts["test:worker-bundle"],
    "node tools/worker-bundle-check.js",
  );
  assert.equal(packageJson.scripts.test, "make test");
  assert.match(makefile, /node tools\/worker-bundle-check\.js/);

  for (const relativePath of [
    "tools/ingest-worker-runtime-check.js",
    "tools/runtime-worker-orchestration-check.js",
  ]) {
    assertTracked(relativePath);
  }
  assert(fs.existsSync(path.join(ROOT_DIR, "tools/worker-bundle-check.js")));

  for (const relativePath of [
    "bootstrap.js",
    "host/ingest-worker-runtime.mjs",
    "host/runtime.mjs",
    "index.html",
    "manifest.webmanifest",
    "worker.js",
  ]) {
    assertNoIsolationRequirement(relativePath);
  }

  for (const relativePath of [
    "dist/bootstrap.bundle.js",
    "dist/worker.bundle.js",
  ]) {
    const bundlePath = path.join(ROOT_DIR, relativePath);

    assert(fs.existsSync(bundlePath), `${relativePath} should be emitted by build`);
    assertNoIsolationRequirement(relativePath);
  }
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
}
