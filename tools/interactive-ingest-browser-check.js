#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const puppeteer = require("puppeteer-core");
const { repoPath } = require("./acceptance-wasm-helpers.js");
const {
  CACHE_CONTROL,
  browserExecutablePath: findBrowserExecutablePath,
  cachedPlaywrightChromes,
  createDistServer,
} = require("./dist-browser-helpers.js");
const {
  waitForBrowserReadiness,
} = require("./browser-readiness-helpers.js");

const DIST_DIR = repoPath("dist");
const RUNTIME_SPEC = JSON.parse(
  fs.readFileSync(repoPath("abi/runtime.json"), "utf8"),
);
const {
  FIRST_PRESENTED_BUDGET_MS,
  FIXTURE_SIZE_BYTES,
  FRAME_BUDGET_MS,
  FILE_CHOOSER_TIMEOUT_MS,
} = RUNTIME_SPEC.interactiveIngestCheck;
const TRACE_SIZE_BYTES = FIXTURE_SIZE_BYTES.value;
const FRAME_BUDGET = FRAME_BUDGET_MS.value;
const FILE_CHOOSER_TIMEOUT = FILE_CHOOSER_TIMEOUT_MS.value;
const FIRST_PRESENTED_BUDGET = FIRST_PRESENTED_BUDGET_MS.value;
const BROWSER_TIMEOUT_MS = 15_000;

function browserExecutablePath() {
  return findBrowserExecutablePath({
    envNames: [
      "TRACY_INTERACTIVE_INGEST_BROWSER",
      "PUPPETEER_EXECUTABLE_PATH",
      "CHROME_PATH",
    ],
    errorMessage: "Chrome/Chromium not found for interactive ingest browser check",
    playwrightChromes: cachedPlaywrightChromes(),
  });
}

async function serveDist() {
  return createDistServer(DIST_DIR, {
    cacheControl: CACHE_CONTROL.NO_STORE,
    gzip: false,
  });
}

async function writeTraceFile(file) {
  const encoder = new TextEncoder();
  const firstEvents = [
    { ph: "X", name: "first", ts: 100, dur: 900, pid: 1, tid: 1 },
    { ph: "X", name: "second", ts: 140, dur: 60, pid: 1, tid: 2 },
    { ph: "X", name: "third", ts: 260, dur: 80, pid: 1, tid: 1 },
  ].map((event) => JSON.stringify(event)).join(",");
  const prefix = encoder.encode(`[${firstEvents},`);
  const tail = encoder.encode(`${JSON.stringify({
    ph: "X",
    name: "tail",
    ts: 980,
    dur: 20,
    pid: 1,
    tid: 2,
  })}]`);
  const paddingEnd = TRACE_SIZE_BYTES - tail.byteLength;
  const spaces = Buffer.alloc(1024 * 1024, 0x20);

  assert.ok(paddingEnd > prefix.byteLength, "interactive ingest browser fixture is too small");

  const handle = await fsp.open(file, "w");
  try {
    await handle.write(prefix, 0, prefix.byteLength, 0);
    for (let offset = prefix.byteLength; offset < paddingEnd;) {
      const len = Math.min(spaces.byteLength, paddingEnd - offset);
      await handle.write(spaces, 0, len, offset);
      offset += len;
    }
    await handle.write(tail, 0, tail.byteLength, paddingEnd);
  } finally {
    await handle.close();
  }
}

async function installIngestInstrumentation(page) {
  await page.evaluateOnNewDocument(() => {
    const state = {
      fileSelectionAt: null,
      firstDrawAt: null,
      firstPresentedAt: null,
      fillRectCount: 0,
      fillRectSamples: [],
      frameDurations: [],
      maxFrameDuration: 0,
      promisingType: typeof WebAssembly.promising,
      selectedFileName: null,
      selectedFileSize: null,
      suspendingType: typeof WebAssembly.Suspending,
      workerMessages: [],
      workerPosts: [],
    };
    globalThis.__TRACY_BROWSER_INGEST__ = state;

    const addEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function addInstrumentedListener(
      type,
      listener,
      options,
    ) {
      if (
        this instanceof HTMLInputElement &&
        this.type === "file" &&
        type === "change" &&
        typeof listener === "function"
      ) {
        return addEventListener.call(
          this,
          type,
          function instrumentedChange(event) {
            state.fileSelectionAt ??= performance.now();
            state.selectedFileName = this.files?.[0]?.name ?? null;
            state.selectedFileSize = this.files?.[0]?.size ?? null;
            return listener.call(this, event);
          },
          options,
        );
      }

      return addEventListener.call(this, type, listener, options);
    };

    const requestAnimationFrame = globalThis.requestAnimationFrame.bind(globalThis);
    globalThis.requestAnimationFrame = (callback) =>
      requestAnimationFrame((timestamp) => {
        const startedAt = performance.now();
        try {
          return callback(timestamp);
        } finally {
          if (state.fileSelectionAt !== null) {
            const duration = performance.now() - startedAt;
            state.frameDurations.push(duration);
            state.maxFrameDuration = Math.max(state.maxFrameDuration, duration);
          }
        }
      });

    const fillRect = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function instrumentedFillRect(
      x,
      y,
      width,
      height,
    ) {
      const result = fillRect.apply(this, arguments);
      if (this.canvas?.id === "tracy" && state.fileSelectionAt !== null) {
        state.fillRectCount += 1;
        if (state.fillRectSamples.length < 16) {
          state.fillRectSamples.push({ height, width, x, y });
        }
      }
      if (
        this.canvas?.id === "tracy" &&
        state.fileSelectionAt !== null &&
        state.firstDrawAt === null &&
        y > 0 &&
        height > 0 &&
        width > 0
      ) {
        state.firstDrawAt = performance.now();
        requestAnimationFrame(() => {
          state.firstPresentedAt ??= performance.now();
        });
      }
      return result;
    };

    const NativeWorker = globalThis.Worker;
    globalThis.Worker = function InstrumentedWorker(...args) {
      const worker = new NativeWorker(...args);
      const postMessage = worker.postMessage;
      worker.postMessage = function instrumentedPostMessage(message, transfer) {
        state.workerPosts.push({
          indexName: message?.indexName ?? null,
          sourceFile: message?.sourceFile?.name ?? null,
          sourceFileHandle: message?.sourceFileHandle ?? null,
          sourceName: message?.sourceName ?? null,
          sourceSize: message?.sourceSize ?? null,
          type: message?.type ?? null,
        });
        return postMessage.call(this, message, transfer);
      };
      worker.addEventListener("message", (event) => {
        state.workerMessages.push({
          committedEvents: event.data?.committedEvents ?? null,
          end: event.data?.end ?? null,
          error: event.data?.message ?? null,
          fileOffset: event.data?.fileOffset ?? null,
          indexedEvents: event.data?.indexedEvents ?? null,
          parsedEvents: event.data?.parsedEvents ?? null,
          start: event.data?.start ?? null,
          totalBytes: event.data?.totalBytes ?? null,
          type: event.data?.type ?? null,
          valid: event.data?.valid ?? null,
        });
      });
      worker.addEventListener("error", (event) => {
        state.workerMessages.push({
          error: event.message,
          fileOffset: null,
          type: "worker-error",
        });
      });
      return worker;
    };
  });
}

async function browserState(page, { diagnoseReader = false } = {}) {
  return page.evaluate(async (shouldDiagnoseReader) => {
    const state = globalThis.__TRACY_BROWSER_INGEST__ ?? {};
    const workerMessages = state.workerMessages ?? [];
    let readerDiagnostic = null;

    if (shouldDiagnoseReader) {
      const startPost = state.workerPosts?.find((message) => message.indexName !== null);
      if (startPost?.indexName !== undefined && startPost.indexName !== null) {
        try {
          const memory = new WebAssembly.Memory({ initial: 8272, maximum: 32768 });
          const { makeMainThreadHost } = await import("./host/shim.mjs");
          const { createMainThreadIndexReaderController } =
            await import("./host/runtime.mjs");
          const host = makeMainThreadHost(memory);
          const reader = createMainThreadIndexReaderController(memory, host);

          await reader.open(startPost.indexName);
          readerDiagnostic = {
            coveredRange: reader.coveredRange(),
            queryRange: await reader.queryRange(0, 0, 1000, 12288),
            status: reader.status(),
            trackCount: reader.trackCount(),
          };
        } catch (error) {
          readerDiagnostic = {
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }
    }

    return {
      appError: globalThis.__TRACY_APP_LOAD_ERROR__ ?? "",
      frameDurationsSample: state.frameDurations?.slice(0, 16),
      performanceMarks: performance.getEntriesByType("mark").map((entry) => entry.name),
      workerMessageCount: workerMessages.length,
      workerMessagesHead: workerMessages.slice(0, 8),
      workerMessagesTail: workerMessages.slice(-8),
      readerDiagnostic,
      ...Object.fromEntries(
        Object.entries(state).filter(
          ([key]) => key !== "frameDurations" && key !== "workerMessages",
        ),
      ),
    };
  }, diagnoseReader);
}

async function waitForPageCondition(page, predicate, label, timeoutMs = BROWSER_TIMEOUT_MS) {
  return waitForBrowserReadiness({
    collectFailureState: () => browserState(page, { diagnoseReader: true }),
    collectState: async () => ({
      ready: await page.evaluate(predicate),
    }),
    failureReason: () => null,
    isReady: (state) => state.ready === true,
    label,
    pollIntervalMs: 25,
    timeoutMs,
  });
}

async function checkBrowserInteractiveIngest() {
  const server = await serveDist();
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "tracy-ingest-browser-"));
  const tracePath = path.join(tmpDir, "throttled-100mb.json");
  const browser = await puppeteer.launch({
    executablePath: browserExecutablePath(),
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-gpu",
      "--enable-experimental-webassembly-features",
      "--enable-features=WebAssemblyJSPI",
      "--js-flags=--experimental-wasm-jspi --experimental-wasm-stack-switching",
    ],
  });

  try {
    await writeTraceFile(tracePath);
    const page = await browser.newPage();
    page.setDefaultTimeout(BROWSER_TIMEOUT_MS);
    await installIngestInstrumentation(page);
    await page.goto(`${server.origin}/`, { waitUntil: "load" });
    await waitForPageCondition(
      page,
      () =>
        performance.getEntriesByName("tracy.app.ready").length > 0 ||
        globalThis.__TRACY_APP_LOAD_ERROR__ !== undefined,
      "browser app did not become ready",
    );

    const readyState = await browserState(page);
    assert.equal(readyState.appError, "");
    assert.equal(readyState.suspendingType, "function");
    assert.equal(readyState.promisingType, "function");

    const canvas = await page.$("#tracy");
    assert.notEqual(canvas, null, "browser app should expose the trace canvas");
    const box = await canvas.boundingBox();
    assert.notEqual(box, null, "trace canvas should be visible");

    const chooserPromise = page.waitForFileChooser({ timeout: FILE_CHOOSER_TIMEOUT });
    const clickStartedAt = await page.evaluate(() => performance.now());
    await page.mouse.click(box.x + 12, box.y + 12);
    const chooser = await chooserPromise;
    const chooserOpenedAt = await page.evaluate(() => performance.now());
    assert.ok(
      chooserOpenedAt - clickStartedAt < 500,
      `file chooser opened after ${chooserOpenedAt - clickStartedAt}ms`,
    );

    await waitForPageCondition(
      page,
      () =>
        (globalThis.__TRACY_BROWSER_INGEST__?.workerMessages ?? []).some(
          (message) => message?.type === "preloaded",
        ),
      "browser did not preload worker wasm while file picker was open",
      10_000,
    );
    await chooser.accept([tracePath]);
    await waitForPageCondition(
      page,
      () =>
        globalThis.__TRACY_APP_LOAD_ERROR__ !== undefined ||
        globalThis.__TRACY_BROWSER_INGEST__?.firstPresentedAt !== null,
      "browser did not present first ingest draw",
      10_000,
    );

    const result = await browserState(page);
    assert.equal(result.appError, "");
    assert.equal(result.selectedFileName, "throttled-100mb.json");
    assert.equal(result.selectedFileSize, TRACE_SIZE_BYTES);
    assert.notEqual(result.fileSelectionAt, null);
    assert.notEqual(result.firstDrawAt, null);
    assert.notEqual(result.firstPresentedAt, null);
    assert.ok(
      result.firstPresentedAt - result.fileSelectionAt <= FIRST_PRESENTED_BUDGET,
      `first presented ingest draw took ${result.firstPresentedAt - result.fileSelectionAt}ms`,
    );
    assert.ok(
      result.maxFrameDuration <= FRAME_BUDGET,
      `slowest ingest frame took ${result.maxFrameDuration}ms`,
    );
  } finally {
    await browser.close();
    await fsp.rm(tmpDir, { force: true, recursive: true });
    await server.close();
  }
}

async function runSelfTest() {
  const ingestTimeoutState = {
    appError: "",
    performanceMarks: ["tracy.app.ready"],
    page: {
      readyState: "complete",
      title: "tracy",
      url: "http://127.0.0.1/",
      visibilityState: "visible",
    },
    readerDiagnostic: {
      coveredRange: { end: 1000, start: 0 },
      status: { state: "ready" },
    },
    workerMessageCount: 3,
    workerMessagesHead: [
      { fileOffset: 0, type: "preloaded" },
      { fileOffset: 65536, type: "progress" },
    ],
    workerMessagesTail: [
      { fileOffset: 65536, type: "progress" },
      { error: "stalled", type: "worker-error" },
    ],
  };
  const timedOutPage = {
    async evaluate(_callback, ...args) {
      return args.length > 0 ? ingestTimeoutState : false;
    },
  };

  let timeoutError = null;
  try {
    await waitForPageCondition(
      timedOutPage,
      () => globalThis.__TRACY_BROWSER_INGEST__?.firstPresentedAt !== null,
      "browser did not present first ingest draw",
      0,
    );
  } catch (error) {
    timeoutError = error;
  }
  assert.notEqual(timeoutError, null);
  assert.match(
    timeoutError.message,
    /browser did not present first ingest draw timed out; readiness diagnostics=/,
  );
  assert.match(timeoutError.message, /"workerMessagesHead":.*"preloaded"/);
  assert.match(timeoutError.message, /"workerMessagesTail":.*"worker-error"/);
  assert.match(timeoutError.message, /"page":.*"readyState":"complete"/);
  assert.match(timeoutError.message, /"readerDiagnostic":/);
  assert.match(
    waitForPageCondition.toString(),
    /waitForBrowserReadiness\(\{/,
  );
  assert.match(
    waitForPageCondition.toString(),
    /collectFailureState: \(\) => browserState\(page, \{ diagnoseReader: true \}\)/,
  );
  assert.doesNotMatch(
    waitForPageCondition.toString(),
    /browser ingest state|Date\.now\(\) - start/,
  );
}

async function main() {
  if (process.argv.includes("--self-test")) {
    await runSelfTest();
  } else {
    await checkBrowserInteractiveIngest();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
