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
const LEGACY_BOOTSTRAP_ENTRYPOINT = "bootstrap" + ".js";
const LEGACY_BOOTSTRAP_PATTERN = new RegExp(`${"bootstrap"}\\.js`);

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

function assertNoInlinePaletteColor(relativePath) {
  const source = readRepoFile(relativePath);
  const forbiddenColors = [
    "#1f1b16",
    "#3f6ea8",
    "#fbf8f4",
    "rgba(40, 45, 52, 0.35)",
    "rgba(76, 85, 99, 0.38)",
    "rgba(92, 109, 130, 0.58)",
    "rgba(126, 134, 146, 0.18)",
    "rgba(146, 64, 14, 0.42)",
    "rgba(180, 83, 9, 0.16)",
    "rgba(251, 248, 244, 0.92)",
  ];

  for (const color of forbiddenColors) {
    assert(
      !source.includes(color),
      `${relativePath} should read ${color} from abi/palette.json instead of inlining it`,
    );
  }
}

function assertIndexCatalogUsesGeneratedFormatSpec() {
  const source = readRepoFile("host/index-reader-catalog.mjs");

  assert.match(
    source,
    /from "\.\/index-format-spec\.mjs"/,
    "index reader catalog should import generated index format values",
  );
  assert.doesNotMatch(
    source,
    /const\s+OPFS_PAGE_SIZE\s*=/,
    "OPFS page size should live in the generated index format spec",
  );
  assert.doesNotMatch(
    source,
    /const\s+INDEX_DECODE_HINT_[A-Z_]+\s*=/,
    "index decode hint values should live in the generated index format spec",
  );
  assert.doesNotMatch(
    source,
    /const\s+INDEX_PAGE_HEADER_[A-Z_]+_OFFSET\s*=/,
    "index page header offsets should live in the generated index format spec",
  );
  assert.doesNotMatch(
    source,
    /\b0x00010000\b/,
    "index reader catalog should not inline OPFS page size",
  );
}

function assertIngestWorkerProgressPolicyUsesGeneratedSpec() {
  const source = readRepoFile("host/ingest-worker-runtime.mjs");
  const startupSpecSource = readRepoFile("host/startup-spec.mjs");

  assert.match(
    source,
    /from "\.\/startup-spec\.mjs"/,
    "ingest worker runtime should import generated runtime defaults",
  );
  assert.match(
    source,
    /DEFAULT_INGEST_PROGRESS_WINDOW_MS/,
    "ingest progress window should use the generated runtime default",
  );
  assert.match(
    source,
    /DEFAULT_INGEST_ETA_STABLE_MS/,
    "ingest ETA stability delay should use the generated runtime default",
  );
  assert.match(
    startupSpecSource,
    /DEFAULT_INGEST_PROGRESS_WINDOW_MS: 5000/,
    "generated runtime spec should expose the ingest progress window",
  );
  assert.match(
    startupSpecSource,
    /DEFAULT_INGEST_ETA_STABLE_MS: 3000/,
    "generated runtime spec should expose the ingest ETA stability delay",
  );
  assert.doesNotMatch(
    source,
    /const\s+DEFAULT_PROGRESS_WINDOW_MS\s*=/,
    "ingest progress window should not drift back into host literals",
  );
  assert.doesNotMatch(
    source,
    /const\s+DEFAULT_ETA_STABLE_MS\s*=/,
    "ingest ETA stability delay should not drift back into host literals",
  );
  assert.doesNotMatch(
    source,
    /\b5000\b/,
    "ingest progress window should be generated, not an anonymous host literal",
  );
  assert.doesNotMatch(
    source,
    /\b3000\b/,
    "ingest ETA stability delay should be generated, not an anonymous host literal",
  );
}

function main() {
  const buildScript = readRepoFile("tools/build.sh");
  const makefile = readRepoFile("Makefile");
  const bootstrapSource = readRepoFile("bootstrap.mjs");
  const indexHtml = readRepoFile("index.html");
  const rendererLoaderSource = readRepoFile("host/progressive-trace-renderer-loader.mjs");
  const rendererSource = readRepoFile("host/progressive-trace-renderer.mjs");
  const runtimeSource = readRepoFile("host/runtime.mjs");
  const indexFormatSpecSource = readRepoFile("host/index-format-spec.mjs");
  const startupSpecSource = readRepoFile("host/startup-spec.mjs");
  const traceRendererSpecSource = readRepoFile("host/trace-renderer-spec.mjs");
  const workerSource = readRepoFile("worker.js");
  const packageJson = JSON.parse(readRepoFile("package.json"));
  const readmeSource = readRepoFile("README.md");
  const appLoadBenchSource = readRepoFile("tools/app-load-bench.js");
  const bootstrapLineCheckSource = readRepoFile("tools/check-bootstrap-lines.sh");
  const serviceWorkerCheckSource = readRepoFile("tools/service-worker-check.js");

  assertIngestWorkerProgressPolicyUsesGeneratedSpec();

  assert.match(
    buildScript,
    /exec make -C "\$\{ROOT_DIR\}" -j"\$\{jobs\}" dist/,
    "build shim should delegate to make dist",
  );
  assert.match(makefile, /dist\/bootstrap\.mjs: bootstrap\.mjs[\s\S]+cp \$< \$@/);
  assert.match(makefile, /dist\/worker\.js: worker\.js[\s\S]+cp \$< \$@/);
  assert.match(makefile, /dist\/host\/%\.mjs: host\/%\.mjs[\s\S]+cp \$< \$@/);
  assert.match(indexHtml, /<script type="module" src="bootstrap\.mjs"><\/script>/);
  assert(
    !fs.existsSync(path.join(ROOT_DIR, LEGACY_BOOTSTRAP_ENTRYPOINT)),
    `${LEGACY_BOOTSTRAP_ENTRYPOINT} should stay renamed to bootstrap.mjs`,
  );
  assert.doesNotMatch(makefile, LEGACY_BOOTSTRAP_PATTERN);
  assert.doesNotMatch(indexHtml, LEGACY_BOOTSTRAP_PATTERN);
  assert.doesNotMatch(readmeSource, LEGACY_BOOTSTRAP_PATTERN);
  assert.doesNotMatch(appLoadBenchSource, LEGACY_BOOTSTRAP_PATTERN);
  assert.doesNotMatch(bootstrapLineCheckSource, LEGACY_BOOTSTRAP_PATTERN);
  assert.doesNotMatch(serviceWorkerCheckSource, LEGACY_BOOTSTRAP_PATTERN);
  assert.doesNotMatch(indexHtml, /host\/progressive-trace-renderer-loader\.mjs/);
  assert.match(bootstrapSource, /const importProgressiveTraceRenderer = \(\) =>/);
  assert.match(bootstrapSource, /RUNTIME_URLS\.PROGRESSIVE_TRACE_RENDERER_URL/);
  assert.match(
    bootstrapSource,
    /const serviceWorkerController =[\s\S]+navigator\?\.serviceWorker\?\.controller \?\? null/,
  );
  assert.match(
    bootstrapSource,
    /const warmProgressiveTraceRendererPromise =[\s\S]+serviceWorkerController === null[\s\S]+\? null[\s\S]+import/,
  );
  assert.match(bootstrapSource, /warmProgressiveTraceRendererPromise \?\?[\s\S]+import/);
  assert.match(
    bootstrapSource,
    /const afterProtectedStartupBoundary = \(\) =>[\s\S]+new MessageChannel\(\)/,
  );
  assert.match(bootstrapSource, /afterProtectedStartupBoundary\(\)\.then\(\(\) =>[\s\S]+import/);
  assert.doesNotMatch(bootstrapSource, /setTimeout\(resolve/);
  assert.doesNotMatch(
    bootstrapSource,
    /const wasmModulesPromise = import\("\.\/host\/wasm-modules\.mjs"\)/,
  );
  assert.match(
    bootstrapSource,
    /id !== "app" \|\| thread !== "main"[\s\S]+app\.wasm/,
  );
  assert.match(
    bootstrapSource,
    /await import\("\.\/host\/wasm-modules\.mjs"\)/,
  );
  assert.match(
    bootstrapSource,
    /importProgressiveTraceRenderer,/,
  );
  assert.match(
    bootstrapSource,
    /instantiateWasmModuleForThread/,
  );
  assert.doesNotMatch(bootstrapSource, /progressive-trace-renderer-loader/);
  assert.match(bootstrapSource, /from "\.\/host\/startup-spec\.mjs"/);
  assert.doesNotMatch(bootstrapSource, /runtime-spec\.mjs/);
  assert.match(runtimeSource, /from "\.\/startup-spec\.mjs"/);
  assert.doesNotMatch(runtimeSource, /from "\.\/runtime-spec\.mjs"/);
  assert.match(indexFormatSpecSource, /Generated from abi\/layout\.json/);
  assert.match(indexFormatSpecSource, /INDEX_FORMAT/);
  assert.match(indexFormatSpecSource, /INDEX_DECODE_HINTS/);
  assert.match(indexFormatSpecSource, /INDEX_PAGE_HEADER_OFFSETS/);
  assert.doesNotMatch(runtimeSource, /preloadTraceRendererSpecModule/);
  assert.doesNotMatch(runtimeSource, /deferredTraceRendererSpecPromise/);
  assert.doesNotMatch(rendererSource, /from "\.\/trace-renderer-spec\.mjs"/);
  assert.match(rendererSource, /const TRACE_RENDERER_COLORS = Object\.freeze/);
  assert.doesNotMatch(rendererSource, /from "\.\/runtime-spec\.mjs"/);
  assert(!fs.existsSync(path.join(ROOT_DIR, "host", "runtime-spec.mjs")));
  assert.match(startupSpecSource, /PROGRESSIVE_TRACE_RENDERER_URL: "\.\/progressive-trace-renderer\.mjs"/);
  assert.match(startupSpecSource, /APP_SHELL_COLORS/);
  assert.doesNotMatch(startupSpecSource, /TRACE_RENDERER_COLORS/);
  assert.match(traceRendererSpecSource, /TRACE_RENDERER_COLORS/);
  assert.doesNotMatch(traceRendererSpecSource, /APP_SHELL_COLORS/);
  assert.doesNotMatch(rendererSource, /from "\.\/palette\.mjs"/);
  assert.match(rendererLoaderSource, /import\("\.\/progressive-trace-renderer\.mjs"\)/);
  assert.match(startupSpecSource, /WORKER_URL: "worker\.js"/);
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
  assert.equal(
    packageJson.scripts["test:palette-spec"],
    "node tools/generate-palette-spec.js --check",
  );
  assert.equal(packageJson.scripts.test, "make test");
  assert.equal(packageJson.devDependencies?.["es" + "build"], undefined);
  assert.match(makefile, /node tools\/direct-esm-check\.js/);
  assert.match(makefile, /node tools\/generate-palette-spec\.js --check/);

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
    "host/index-format-spec.mjs",
    "host/progressive-trace-renderer-loader.mjs",
    "host/startup-spec.mjs",
    "host/trace-renderer-spec.mjs",
    "index.html",
    "package.json",
  ]) {
    assertNoBundleReferences(relativePath);
  }

  for (const relativePath of [
    "bootstrap.mjs",
    "host/ingest-worker-runtime.mjs",
    "host/progressive-trace-renderer-loader.mjs",
    "host/runtime.mjs",
    "host/index-format-spec.mjs",
    "host/startup-spec.mjs",
    "host/trace-renderer-spec.mjs",
    "index.html",
    "manifest.webmanifest",
    "worker.js",
  ]) {
    assertNoIsolationRequirement(relativePath);
  }

  for (const relativePath of [
    "bootstrap.mjs",
    "worker.js",
    "host/runtime.mjs",
    "host/index-format-spec.mjs",
    "host/progressive-trace-renderer-loader.mjs",
    "host/startup-spec.mjs",
    "host/trace-renderer-spec.mjs",
    "host/ingest-worker-runtime.mjs",
  ]) {
    if (fs.existsSync(path.join(ROOT_DIR, "dist", relativePath))) {
      assertDistCopy(relativePath);
      assertNoIsolationRequirement(path.join("dist", relativePath));
    }
  }

  assertNoInlinePaletteColor("bootstrap.mjs");
  assertNoInlinePaletteColor("host/canvas.mjs");
  assertNoInlinePaletteColor("host/runtime.mjs");
  assertIndexCatalogUsesGeneratedFormatSpec();
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
}
