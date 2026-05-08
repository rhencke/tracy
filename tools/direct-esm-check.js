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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  assert.match(
    source,
    /index_page_catalog_add_page/,
    "index reader catalog should use the Wasm-owned page catalog contract",
  );
  assert.match(
    source,
    /INDEX_WRITER_STATUS_CATALOG_FULL/,
    "index reader catalog should consume Wasm catalog overflow status",
  );
  assert.doesNotMatch(
    source,
    /new DataView/,
    "index reader catalog should not decode page headers in host JavaScript",
  );
  assert.doesNotMatch(
    source,
    /getUint32/,
    "index reader catalog should not classify catalog pages in host JavaScript",
  );
  assert.doesNotMatch(
    source,
    /index_page_catalog_add_slice_page/,
    "host JavaScript should not own slice page catalog insertion policy",
  );

  const watSource = readRepoFile("wat/index/catalog-and-tracks.wat.inc");
  assert.match(
    watSource,
    /\(func \$index_page_catalog_add_page \(export "index_page_catalog_add_page"\)/,
    "Wasm index code should own catalog page validation and classification",
  );
  assert.match(
    watSource,
    /call \$index_validate_page[\s\S]+call \$index_page_catalog_add_slice_page/,
    "Wasm catalog contract should validate pages before adding slice pages",
  );
}

function assertRuntimeWorkerCheckUsesGeneratedIndexFormatSpec() {
  const source = readRepoFile("tools/runtime-worker-orchestration-check.js");

  assert.match(
    source,
    /host\/index-format-spec\.mjs/,
    "runtime worker orchestration check should import generated index format values",
  );

  for (const [pattern, message] of [
    [/const\s+OPFS_PAGE_SIZE\s*=/, "OPFS page size"],
    [/const\s+INDEX_DECODE_HINT_[A-Z_]+\s*=/, "index decode hints"],
    [/const\s+INDEX_PAGE_HEADER_[A-Z_]+_OFFSET\s*=/, "index page header offsets"],
    [/\b0x00010000\b/, "OPFS page size literal"],
  ]) {
    assert.doesNotMatch(
      source,
      pattern,
      `runtime worker orchestration check should read ${message} from generated index format values`,
    );
  }

  for (const [pattern, message] of [
    [/INDEX_FORMAT\.OPFS_PAGE_SIZE/, "OPFS page size"],
    [/INDEX_DECODE_HINTS\.COMPACT_SLICES/, "compact-slice decode hint"],
    [/INDEX_DECODE_HINTS\.TRACK_ID_SHIFT/, "track-id decode hint shift"],
    [/INDEX_PAGE_HEADER_OFFSETS\.BUCKET_START/, "bucket start offset"],
    [/INDEX_PAGE_HEADER_OFFSETS\.BUCKET_END/, "bucket end offset"],
    [/INDEX_PAGE_HEADER_OFFSETS\.RECORD_COUNT/, "record count offset"],
    [/INDEX_PAGE_HEADER_OFFSETS\.DECODE_HINTS/, "decode hints offset"],
  ]) {
    assert.match(
      source,
      pattern,
      `runtime worker orchestration check should consume generated ${message}`,
    );
  }
}

function assertInteractiveIngestCheckUsesGeneratedVerificationSpec() {
  const source = readRepoFile("tools/interactive-ingest-check.js");
  const startupSpecSource = readRepoFile("host/startup-spec.mjs");
  const appSource = readRepoFile("wat/app.wat");

  assert.match(
    startupSpecSource,
    /export const INTERACTIVE_INGEST_CHECK = Object\.freeze/,
    "generated startup spec should expose interactive ingest verification constants",
  );
  assert.match(
    source,
    /host\/startup-spec\.mjs/,
    "interactive ingest check should import generated verification constants",
  );

  for (const [pattern, message] of [
    [/const\s+HUNDRED_MB\s*=/, "100 MB fixture size"],
    [/const\s+TEN_MB\s*=/, "10 MB ingest window"],
    [/const\s+FRAME_BUDGET_MS\s*=\s*16\.67/, "60 fps frame budget"],
    [/100\s*\*\s*1024\s*\*\s*1024/, "100 MB fixture size expression"],
    [/10\s*\*\s*1024\s*\*\s*1024/, "10 MB ingest window expression"],
  ]) {
    assert.doesNotMatch(
      source,
      pattern,
      `interactive ingest check should read ${message} from generated verification constants`,
    );
  }

  assert.match(
    source,
    /dist\/wasm\/app\.wasm/,
    "interactive ingest check should load the Wasm-owned app contract",
  );
  assert.match(
    source,
    /assertInteractiveContractOk/,
    "interactive ingest check should assert Wasm-owned verification results",
  );

  for (const [pattern, message] of [
    [/INTERACTIVE_INGEST_CHECK\.FIXTURE_SIZE_BYTES/, "fixture size"],
    [/INTERACTIVE_INGEST_CHECK\.INGEST_WINDOW_BYTES/, "ingest window"],
    [/INTERACTIVE_INGEST_CHECK\.FRAME_BUDGET_MS/, "frame budget"],
  ]) {
    assert.match(
      source,
      pattern,
      `interactive ingest check should consume generated ${message}`,
    );
  }

  for (const exportName of [
    "interactive_ingest_expect_renderer_preload",
    "interactive_ingest_expect_worker_start",
    "interactive_ingest_expect_first_events",
    "interactive_ingest_expect_covered_partial_unknown",
    "interactive_ingest_expect_zoom_clamped",
    "interactive_ingest_expect_pan_clamped",
    "interactive_ingest_expect_progress_eta",
    "interactive_ingest_expect_frame_interval",
  ]) {
    assert.match(
      appSource,
      new RegExp(`\\(func \\(export "${exportName}"\\)`),
      `app Wasm should own ${exportName}`,
    );
    assert.match(
      source,
      new RegExp(JSON.stringify(exportName)),
      `interactive ingest check should feed observations to ${exportName}`,
    );
  }

  for (const [pattern, message] of [
    [/first indexed events should become visible/, "first-events timing rule"],
    [/partial pages should keep unfinished styling/, "partial-page affordance rule"],
    [/unknown time should draw a striped progress affordance/, "unknown-range affordance rule"],
    [/early ETA should stay hidden/, "early ETA rule"],
    [/stable ETA should be surfaced/, "stable ETA rule"],
    [/pan\/zoom frames should stay inside/, "frame-budget rule"],
  ]) {
    assert.doesNotMatch(
      source,
      pattern,
      `interactive ingest check should leave ${message} in the Wasm contract`,
    );
  }
}

function assertIngestWorkerProgressPolicyUsesGeneratedSpec() {
  const source = readRepoFile("host/ingest-worker-runtime.mjs");
  const startupSpecSource = readRepoFile("host/startup-spec.mjs");
  const parserStateAbiSource = readRepoFile("abi/parser-state.json");

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
  assert.match(
    source,
    /PARSER_DEFAULT_OUTPUT_RECORD_CAP/,
    "parse output record capacity should come from the parser state ABI",
  );
  assert.match(
    parserStateAbiSource,
    /"name": "PARSER_DEFAULT_OUTPUT_RECORD_CAP"[\s\S]+"value": 4096/,
    "parser state ABI should define the parser output record capacity",
  );
  assert.doesNotMatch(
    source,
    /const\s+DEFAULT_PARSE_OUTPUT_RECORDS\s*=/,
    "parse output record capacity should not live in host ingest runtime",
  );
}

function stripGeneratedTraceRendererContract(source) {
  return source.replace(
    /\/\/ @generated trace-renderer-contract:start[\s\S]*?\/\/ @generated trace-renderer-contract:end/g,
    "",
  );
}

function assertTraceRendererUsesGeneratedPolicyDefaults(rendererSource, traceRendererSpecSource) {
  const handMaintainedRendererSource = stripGeneratedTraceRendererContract(rendererSource);

  for (const groupName of [
    "TRACE_RENDERER_CANVAS_OPS",
    "TRACE_RENDERER_DRAW_DEFAULTS",
    "TRACE_RENDERER_INTERACTION_DEFAULTS",
    "TRACE_RENDERER_COLOR_DEFAULTS",
  ]) {
    assert.match(
      rendererSource,
      new RegExp(`const ${groupName} = Object\\.freeze`),
      `progressive trace renderer should inline generated ${groupName}`,
    );
    assert.match(
      traceRendererSpecSource,
      new RegExp(`export const ${groupName} = Object\\.freeze`),
      `trace renderer spec should export generated ${groupName}`,
    );
  }

  for (const [pattern, message] of [
    [/canvasDimension\(canvas, "width", 800\)/, "canvas width fallback"],
    [/canvasDimension\(canvas, "height", 400\)/, "canvas height fallback"],
    [/options\.laneHeight \?\? 10/, "lane height default"],
    [/options\.laneGap \?\? 3/, "lane gap default"],
    [/options\.top \?\? 18/, "trace top default"],
    [/options\.hatchSpacing \?\? 6/, "partial hatch spacing default"],
    [/lineWidth\s*=\s*1/, "affordance stroke width"],
    [/Math\.max\(-500,/, "wheel delta minimum"],
    [/Math\.min\(500, deltaY\)/, "wheel delta maximum"],
    [/\*\s*0\.001/, "wheel delta scale"],
    [/\b0xffffff\b/, "packed RGB mask"],
    [/padStart\(6, "0"\)/, "RGB hex width"],
    [/END:\s*0,/, "canvas-op end tag"],
    [/QUERY_RANGE_TAG:\s*1,/, "canvas-op query-range tag"],
    [/INCOMPLETE_QUERY_RANGE_TAG:\s*2,/, "canvas-op incomplete-range tag"],
  ]) {
    assert.doesNotMatch(
      handMaintainedRendererSource,
      pattern,
      `host/progressive-trace-renderer.mjs should read ${message} from generated renderer contracts`,
    );
  }
}

function assertOpfsSourceUsesGeneratedBridgeContract(opfsSourceSource, hostAbiSource) {
  assert.match(
    hostAbiSource,
    /export const OPFS_BRIDGE_CONTRACT = Object\.freeze/,
    "host ABI should export the generated OPFS bridge contract",
  );
  assert.match(
    opfsSourceSource,
    /import \{ HOST_IMPORT_NAME, OPFS_BRIDGE_CONTRACT \} from "\.\/abi\.mjs"/,
    "OPFS source host should consume the generated OPFS bridge contract",
  );

  for (const [pattern, message] of [
    [/const\s+OPFS_SOURCE_IMPORTS\s*=/, "source import grouping"],
    [/const\s+OPFS_INDEX_READER_IMPORTS\s*=/, "index reader import grouping"],
    [/const\s+OPFS_INDEX_WRITER_IMPORTS\s*=/, "index writer import grouping"],
    [/const\s+WORKER_UNSUPPORTED_FILE_IMPORTS\s*=/, "worker unsupported file imports"],
    [/const\s+OPFS_INDEX_SIZE_MAY_BE_STALE\s*=/, "index size stale marker"],
    [/"tracy\.opfsIndexSizeMayBeStale"/, "index size stale marker string"],
    [/"file handles are owned by the main thread"/, "worker unsupported reason"],
    [/`trace-\$\{Date\.now\(\)\.toString\(36\)\}-\$\{sourceId\}\.bin`/, "file source name shape"],
  ]) {
    assert.doesNotMatch(
      opfsSourceSource,
      pattern,
      `host/opfs-source.mjs should read ${message} from OPFS_BRIDGE_CONTRACT`,
    );
  }
}

function assertRendererLoaderUsesGeneratedBridgeContract(rendererLoaderSource, traceRendererSpecSource) {
  assert.match(
    traceRendererSpecSource,
    /export const TRACE_RENDERER_LOADER_BRIDGE = Object\.freeze/,
    "trace renderer spec should export the generated loader bridge contract",
  );
  assert.match(
    rendererLoaderSource,
    /import \{ TRACE_RENDERER_LOADER_BRIDGE \} from "\.\/trace-renderer-spec\.mjs"/,
    "progressive trace renderer loader should consume the generated loader bridge contract",
  );
  assert.match(
    rendererLoaderSource,
    /for \(const methodName of API_METHODS\)/,
    "progressive trace renderer loader should bridge generated renderer API methods generically",
  );

  for (const [pattern, message] of [
    [/draw\(ts\)/, "draw method wrapper"],
    [/panByPixels\(\.\.\.args\)/, "pan method wrapper"],
    [/zoomAtPixel\(\.\.\.args\)/, "zoom method wrapper"],
    [/status\(\)\s*\{/, "status method wrapper"],
    [/loading:\s*error === null/, "loading status shape"],
    [/error,\s*\n\s*loading/, "pending error/loading status object"],
  ]) {
    assert.doesNotMatch(
      rendererLoaderSource,
      pattern,
      `host/progressive-trace-renderer-loader.mjs should read ${message} from TRACE_RENDERER_LOADER_BRIDGE`,
    );
  }
}

function assertPaletteScopesProtectStartup(paletteSpec, startupSpecSource, traceRendererSpecSource) {
  const initColors = [];
  const fullColors = [];

  for (const palette of Object.values(paletteSpec.palettes ?? {})) {
    for (const group of Object.values(palette)) {
      for (const [name, entry] of Object.entries(group)) {
        if (entry.scope === "init") {
          initColors.push([name, entry.value]);
        } else if (entry.scope === "full") {
          fullColors.push([name, entry.value]);
        } else {
          assert.fail(`${name} should declare palette scope init or full`);
        }
      }
    }
  }

  assert(initColors.length > 0, "palette should define init-scoped colors");
  assert(fullColors.length > 0, "palette should define full-scoped colors");

  for (const [name, value] of initColors) {
    assert.match(
      startupSpecSource,
      new RegExp(`${name}: ${escapeRegExp(JSON.stringify(value))}`),
      `startup spec should export init-scoped color ${name}`,
    );
  }

  for (const [name, value] of fullColors) {
    assert.doesNotMatch(
      startupSpecSource,
      new RegExp(`${name}: ${escapeRegExp(JSON.stringify(value))}`),
      `startup spec should not export full-scoped color ${name}`,
    );
    assert.match(
      traceRendererSpecSource,
      new RegExp(`${name}: ${escapeRegExp(JSON.stringify(value))}`),
      `trace renderer spec should export full-scoped color ${name}`,
    );
  }
}

function assertRuntimeUsesGeneratedBridgeContract(runtimeSource, startupSpecSource) {
  assert.match(
    startupSpecSource,
    /export const RUNTIME_BRIDGE = Object\.freeze/,
    "startup spec should export the generated runtime bridge contract",
  );
  assert.match(
    runtimeSource,
    /RUNTIME_BRIDGE,/,
    "runtime should import the generated runtime bridge contract",
  );
  assert.match(
    runtimeSource,
    /workerMessages: INGEST_WORKER_MESSAGE/,
    "runtime worker message names should come from the generated bridge contract",
  );
  assert.match(
    runtimeSource,
    /workerStatus: WORKER_STATUS/,
    "runtime worker status states should come from the generated bridge contract",
  );
  assert.match(
    runtimeSource,
    /readerStatus: READER_STATUS/,
    "runtime reader status states should come from the generated bridge contract",
  );
  assert.match(
    runtimeSource,
    /type: WORKER_CONTRACT\.MODULE_TYPE/,
    "runtime worker module type should come from the generated bridge contract",
  );
  assert.match(
    runtimeSource,
    /RUNTIME_MODULES\.DEFAULT_BASE_URL/,
    "runtime Wasm base URL should come from the generated bridge contract",
  );

  for (const [pattern, message] of [
    [/const\s+MAIN_THREAD\s*=\s*"main"/, "main thread id"],
    [/COMPLETE:\s*"complete"/, "worker complete message"],
    [/COVERED_RANGE:\s*"covered_range"/, "worker covered-range message"],
    [/state:\s*"idle"/, "idle state"],
    [/state\s*=\s*"running"/, "running state"],
    [/state\s*=\s*"complete"/, "complete state"],
    [/state\s*=\s*"error"/, "error state"],
    [/state\s*=\s*"terminated"/, "terminated state"],
    [/state\s*=\s*"unavailable"/, "unavailable state"],
    [/state\s*===\s*"ready"/, "ready reader state"],
    [/type:\s*"module"/, "worker module type"],
    [/options\.baseUrl \?\? "wasm\/"/, "default Wasm base URL"],
    [/"main-thread index reader is not ready"/, "main-thread reader not-ready message"],
    [/"module workers are unavailable"/, "module worker unavailable message"],
    [/"worker ingest failed"/, "worker ingest failure message"],
    [/"ingest worker failed"/, "ingest worker failure message"],
    [/"tracy failed to load the WebAssembly viewer\."/,
      "app-load failure message"],
    [/"tracy needs a browser with WebAssembly JavaScript Promise Integration/,
      "JSPI unavailable message"],
    [/"main-thread index name"/, "main-thread index-name label"],
    [/`indexes\/\$\{safeLeaf\}\.idx`/, "index name shape"],
    [/`sources\/\$\{rawName\}`/, "source name shape"],
    [/leaf \?\? "trace"/, "default trace leaf"],
    [/:\s*"trace"/, "default selected-file trace name"],
    [/\/\[\^A-Za-z0-9\._-\]\/g/, "source-name sanitizing pattern"],
  ]) {
    assert.doesNotMatch(
      runtimeSource,
      pattern,
      `host/runtime.mjs should read ${message} from RUNTIME_BRIDGE`,
    );
  }
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
  const hostAbiSource = readRepoFile("host/abi.mjs");
  const opfsSourceSource = readRepoFile("host/opfs-source.mjs");
  const startupSpecSource = readRepoFile("host/startup-spec.mjs");
  const traceRendererSpecSource = readRepoFile("host/trace-renderer-spec.mjs");
  const workerSource = readRepoFile("worker.js");
  const packageJson = JSON.parse(readRepoFile("package.json"));
  const paletteSpec = JSON.parse(readRepoFile("abi/palette.json"));
  const readmeSource = readRepoFile("README.md");
  const appLoadBenchSource = readRepoFile("tools/app-load-bench.js");
  const bootstrapLineCheckSource = readRepoFile("tools/check-bootstrap-lines.sh");
  const serviceWorkerCheckSource = readRepoFile("tools/service-worker-check.js");

  assertIngestWorkerProgressPolicyUsesGeneratedSpec();
  assertTraceRendererUsesGeneratedPolicyDefaults(rendererSource, traceRendererSpecSource);
  assertOpfsSourceUsesGeneratedBridgeContract(opfsSourceSource, hostAbiSource);
  assertRendererLoaderUsesGeneratedBridgeContract(rendererLoaderSource, traceRendererSpecSource);
  assertRuntimeUsesGeneratedBridgeContract(runtimeSource, startupSpecSource);
  assertPaletteScopesProtectStartup(paletteSpec, startupSpecSource, traceRendererSpecSource);

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
    /const importProgressiveTraceRenderer = \(\) =>\s+warmProgressiveTraceRendererPromise \?\?\s+import/,
  );
  assert.doesNotMatch(bootstrapSource, /afterProtectedStartupBoundary/);
  assert.doesNotMatch(bootstrapSource, /new MessageChannel\(\)/);
  assert.doesNotMatch(bootstrapSource, /setTimeout\(resolve/);
  assert.match(bootstrapSource, /const appReady = \(\) => new Promise/);
  assert.match(bootstrapSource, /PERFORMANCE_MARKS\.appReady/);
  assert.match(bootstrapSource, /globalThis\.addEventListener\?\.\(PERFORMANCE_MARKS\.appReady, resolve, \{ once: true \}\)/);
  assert.match(bootstrapSource, /const pageLoaded = \(\) => new Promise/);
  assert.match(bootstrapSource, /Promise\.all\(\[appReady\(\), pageLoaded\(\)\]\)\.then\(registerServiceWorker\)/);
  assert.doesNotMatch(bootstrapSource, /registerAfterReady/);
  assert.doesNotMatch(bootstrapSource, /SERVICE_WORKER_READY_/);
  assert.doesNotMatch(bootstrapSource, /setTimeout/);
  assert.doesNotMatch(bootstrapSource, /setTimeout\(register/);
  assert.match(runtimeSource, /globalThis\.dispatchEvent\?\.\(new Event\(PERFORMANCE_MARKS\.appReady\)\)/);
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
  assert.match(indexFormatSpecSource, /INDEX_FORMAT_CONTRACT/);
  assert.match(indexFormatSpecSource, /OWNER: "index-wasm"/);
  assert.match(indexFormatSpecSource, /SOURCE: "abi\/layout\.json#index"/);
  assert.match(indexFormatSpecSource, /WASM_MODULE: "index"/);
  assert.match(indexFormatSpecSource, /INDEX_FORMAT/);
  assert.match(indexFormatSpecSource, /INDEX_DECODE_HINTS/);
  assert.match(indexFormatSpecSource, /PARTIAL: 4/);
  assert.match(indexFormatSpecSource, /INDEX_PAGE_HEADER_OFFSETS/);
  assert.match(indexFormatSpecSource, /INDEX_QUERY_RESULT_LAYOUT/);
  assert.match(indexFormatSpecSource, /BYTES: 28/);
  assert.match(indexFormatSpecSource, /FIELD_BYTES: 4/);
  assert.match(indexFormatSpecSource, /START: 0/);
  assert.match(indexFormatSpecSource, /PARTIAL: 24/);
  assert.match(
    readRepoFile("tools/generate-layout.js"),
    /spec\.index\.queryResult\.fields\.map/,
    "index format bridge should be generated from the shared index contract",
  );
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
    /new WorkerCtor\(options\.workerUrl \?\? RUNTIME_URLS\.WORKER_URL,[\s\S]+WORKER_CONTRACT\.MODULE_TYPE/,
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
  assertRuntimeWorkerCheckUsesGeneratedIndexFormatSpec();
  assertInteractiveIngestCheckUsesGeneratedVerificationSpec();
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
}
