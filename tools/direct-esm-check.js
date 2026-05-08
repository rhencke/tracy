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
const FORBIDDEN_BUNDLE_PATTERNS = [
  new RegExp(`\\b${"es" + "build"}\\b`),
  new RegExp(`${"bootstrap" + ".bundle"}.js`),
  new RegExp(`${"worker" + ".bundle"}.js`),
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

function assertNoBundleReferences(relativePath) {
  const source = readRepoFile(relativePath);

  for (const pattern of FORBIDDEN_BUNDLE_PATTERNS) {
    assert(
      !pattern.test(source),
      `${relativePath} should not reference ${pattern.source}`,
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

function assertDistCopy(relativePath) {
  const source = path.join(ROOT_DIR, relativePath);
  const dist = path.join(ROOT_DIR, "dist", relativePath);

  assert(fs.existsSync(dist), `dist/${relativePath} should be emitted by build`);
  assert.equal(
    fs.readFileSync(dist, "utf8"),
    fs.readFileSync(source, "utf8"),
    `dist/${relativePath} should be an unminified copy of ${relativePath}`,
  );
}

function main() {
  const buildScript = readRepoFile("tools/build.sh");
  const makefile = readRepoFile("Makefile");
  const indexHtml = readRepoFile("index.html");
  const runtimeSource = readRepoFile("host/runtime.mjs");
  const runtimeSpecSource = readRepoFile("host/runtime-spec.mjs");
  const workerSource = readRepoFile("worker.js");
  const packageJson = JSON.parse(readRepoFile("package.json"));

  assert.match(
    buildScript,
    /exec make -C "\$\{ROOT_DIR\}" -j"\$\{jobs\}" dist/,
    "build shim should delegate to make dist",
  );
  assert.match(makefile, /dist\/bootstrap\.js: bootstrap\.js[\s\S]+cp \$< \$@/);
  assert.match(makefile, /dist\/worker\.js: worker\.js[\s\S]+cp \$< \$@/);
  assert.match(makefile, /dist\/host\/%\.mjs: host\/%\.mjs[\s\S]+cp \$< \$@/);
  assert.match(indexHtml, /<script type="module" src="bootstrap\.js"><\/script>/);
  assert.match(runtimeSpecSource, /WORKER_URL: "worker\.js"/);
  assert.match(runtimeSource, /RUNTIME_URLS\.WORKER_URL/);
  assert.match(
    runtimeSource,
    /new WorkerCtor\(options\.workerUrl \?\? RUNTIME_URLS\.WORKER_URL, \{ type: "module" \}\)/,
  );
  assert.match(
    workerSource,
    /createIngestWorkerMessageHandler/,
    "worker entrypoint should install the ingest message handler",
  );
  assert.equal(
    packageJson.scripts["test:direct-esm"],
    "node tools/direct-esm-check.js",
  );
  assert.equal(packageJson.scripts.test, "make test");
  assert.equal(packageJson.devDependencies?.["es" + "build"], undefined);
  assert.match(makefile, /node tools\/direct-esm-check\.js/);

  assert(fs.existsSync(path.join(ROOT_DIR, "tools/direct-esm-check.js")));

  for (const relativePath of [
    "tools/ingest-worker-runtime-check.js",
    "tools/runtime-worker-orchestration-check.js",
  ]) {
    assertTracked(relativePath);
  }

  for (const relativePath of [
    "Makefile",
    "README.md",
    "host/runtime.mjs",
    "host/runtime-spec.mjs",
    "index.html",
    "package.json",
  ]) {
    assertNoBundleReferences(relativePath);
  }

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
    "bootstrap.js",
    "worker.js",
    "host/runtime.mjs",
    "host/runtime-spec.mjs",
    "host/ingest-worker-runtime.mjs",
  ]) {
    if (fs.existsSync(path.join(ROOT_DIR, "dist", relativePath))) {
      assertDistCopy(relativePath);
      assertNoIsolationRequirement(path.join("dist", relativePath));
    }
  }
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
}
