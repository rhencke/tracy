#!/usr/bin/env node

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { runCheck } = require("./check-runner.js");

const ROOT_DIR = path.resolve(__dirname, "..");

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), "utf8");
}

function main() {
  const bootstrap = readRepoFile("bootstrap.mjs");
  const makefile = readRepoFile("Makefile");
  const packageJson = JSON.parse(readRepoFile("package.json"));
  const startupSpec = readRepoFile("host/startup-spec.mjs");
  const serviceWorker = readRepoFile("service-worker.js");

  assert.match(startupSpec, /SERVICE_WORKER_URL: "service-worker\.js"/);
  assert.match(bootstrap, /navigator\.serviceWorker\.register\(RUNTIME_URLS\.SERVICE_WORKER_URL\)/);
  assert.match(bootstrap, /Promise\.all\(\[appReady\(\), pageLoaded\(\)\]\)\.then\(registerServiceWorker\)/);
  assert.match(bootstrap, /globalThis\.addEventListener\?\.\(PERFORMANCE_MARKS\.appReady, resolve, \{ once: true \}\)/);
  assert.doesNotMatch(bootstrap, /registerAfterReady/);
  assert.doesNotMatch(bootstrap, /SERVICE_WORKER_READY_/);
  assert.doesNotMatch(bootstrap, /setTimeout/);
  assert.doesNotMatch(bootstrap, /setTimeout\(register/);
  assert.doesNotMatch(startupSpec, /BOOTSTRAP_TIMING/);
  assert.equal(packageJson.scripts["test:service-worker"], "node tools/service-worker-check.js");
  assert.match(makefile, /SERVICE_WORKER_FILES := dist\/service-worker\.js dist\/precache-manifest\.js/);
  assert.match(makefile, /PRODUCTION_WASM_FILES := \$\(filter-out %\.test\.wasm,\$\(WASM_FILES\)\)/);
  assert.match(makefile, /APP_RUNTIME_DIST_FILES :=[\s\S]+\$\(PRODUCTION_WASM_FILES\)/);
  assert.match(makefile, /PRECACHE_DIST_FILES :=[\s\S]+\$\(APP_RUNTIME_DIST_FILES\)/);
  assert.match(makefile, /dist\/precache-manifest\.js: \$\(PRECACHE_DIST_FILES\)/);
  assert.match(makefile, /node tools\/service-worker-check\.js/);
  assert.match(serviceWorker, /importScripts\("precache-manifest\.js"\)/);
  assert.match(serviceWorker, /\.addAll/);
  assert.match(serviceWorker, /const precacheCachePromise = caches\.open\(cacheName\)/);
  assert.match(serviceWorker, /const precacheResponses = new Map\(\)/);
  assert.match(serviceWorker, /warmPrecacheResponses\(cache\)/);
  assert.match(serviceWorker, /precacheResponses\.get\(cacheUrl\)\?\.clone\(\)/);
  assert.match(serviceWorker, /cache\.match\(cacheUrl\)/);

  for (const relativePath of [
    "service-worker.js",
    "tools/generate-precache-manifest.js",
    "tools/service-worker-check.js",
  ]) {
    assert(fs.existsSync(path.join(ROOT_DIR, relativePath)), `${relativePath} should exist`);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tracy-precache-"));
  try {
    const distDir = path.join(tmpDir, "dist");
    const output = path.join(distDir, "precache-manifest.js");
    fs.mkdirSync(path.join(distDir, "host"), { recursive: true });
    fs.mkdirSync(path.join(distDir, "wasm", "std"), { recursive: true });
    fs.writeFileSync(path.join(distDir, "index.html"), "");
    fs.writeFileSync(path.join(distDir, "bootstrap.mjs"), "");
    fs.writeFileSync(path.join(distDir, "host", "runtime.mjs"), "");
    fs.writeFileSync(path.join(distDir, "stale.txt"), "");
    fs.writeFileSync(path.join(distDir, "wasm", "app.wasm"), "");
    fs.writeFileSync(path.join(distDir, "wasm", "std", "mem.wasm"), "");

    childProcess.execFileSync(
      process.execPath,
      [
        "tools/generate-precache-manifest.js",
        distDir,
        output,
        path.join(distDir, "index.html"),
        path.join(distDir, "bootstrap.mjs"),
        path.join(distDir, "host", "runtime.mjs"),
        path.join(distDir, "wasm", "app.wasm"),
        path.join(distDir, "wasm", "std", "mem.wasm"),
      ],
      { cwd: ROOT_DIR },
    );

    const manifest = fs.readFileSync(output, "utf8");
    assert.match(manifest, /cacheName: "tracy-app-shell-[0-9a-f]{16}"/);
    assert.match(manifest, /"index\.html"/);
    assert.match(manifest, /"bootstrap\.mjs"/);
    assert.match(manifest, /"host\/runtime\.mjs"/);
    assert.match(manifest, /"wasm\/app\.wasm"/);
    assert.match(manifest, /"wasm\/std\/mem\.wasm"/);
    assert.doesNotMatch(manifest, /"stale\.txt"/);
    assert.doesNotMatch(manifest, /"precache-manifest\.js"/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

runCheck(main);
