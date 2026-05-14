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
const {
  BROWSER_INGEST_STATE_KEY,
  emptyFileSelectionSnapshot,
  fileSelectionSnapshot,
  installBrowserFileSelectionInstrumentation,
} = require("./browser-file-selection-page-helper.js");
const {
  DRAW_TIMING_SAMPLE_LIMIT,
  drawTimingSnapshot,
  emptyDrawTimingSnapshot,
  installBrowserDrawTimingInstrumentation,
} = require("./browser-draw-timing-page-helper.js");
const {
  WORKER_MESSAGE_DIAGNOSTIC_LIMIT,
  emptyWorkerMessageSnapshot,
  installBrowserWorkerMessageInstrumentation,
  workerMessageSnapshot,
} = require("./browser-worker-message-page-helper.js");

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
  await installBrowserFileSelectionInstrumentation(page);
  await installBrowserWorkerMessageInstrumentation(page);
  await installBrowserDrawTimingInstrumentation(page);
  await page.evaluateOnNewDocument((stateKey) => {
    const state = globalThis[stateKey] ?? {};

    Object.assign(state, {
      promisingType: typeof WebAssembly.promising,
      suspendingType: typeof WebAssembly.Suspending,
    });
    globalThis[stateKey] = state;
  }, BROWSER_INGEST_STATE_KEY);
}

async function browserState(page, { diagnoseReader = false } = {}) {
  const state = await page.evaluate(
    async (
      shouldDiagnoseReader,
      drawTimingSampleLimit,
      stateKey,
      workerMessageDiagnosticLimit,
    ) => {
      const state = globalThis[stateKey] ?? {};
      const drawTiming = state.drawTiming ?? {};
      const workerMessages = state.workerMessages ?? {};
      const drawTimingSnapshot = {
        fillRectCount: drawTiming.fillRectCount ?? 0,
        fillRectSamples:
          drawTiming.fillRectSamples?.slice(0, drawTimingSampleLimit) ?? [],
        firstDrawAt: drawTiming.firstDrawAt ?? null,
        firstPresentedAt: drawTiming.firstPresentedAt ?? null,
        frameDurationsSample:
          drawTiming.frameDurations?.slice(0, drawTimingSampleLimit) ?? [],
        maxFrameDuration: drawTiming.maxFrameDuration ?? 0,
      };
      const workerMessageSnapshot = {
        messageCount: workerMessages.messages?.length ?? 0,
        messagesHead:
          workerMessages.messages?.slice(0, workerMessageDiagnosticLimit) ?? [],
        messagesTail:
          workerMessages.messages?.slice(-workerMessageDiagnosticLimit) ?? [],
        postCount: workerMessages.posts?.length ?? 0,
        postsHead:
          workerMessages.posts?.slice(0, workerMessageDiagnosticLimit) ?? [],
        postsTail:
          workerMessages.posts?.slice(-workerMessageDiagnosticLimit) ?? [],
      };
      let readerDiagnostic = null;

      if (shouldDiagnoseReader) {
        const startPost = workerMessages.posts?.find(
          (message) => message.indexName !== null,
        );
        if (startPost?.indexName !== undefined && startPost.indexName !== null) {
          try {
            const memory = new WebAssembly.Memory({
              initial: 8272,
              maximum: 32768,
            });
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
        drawTiming: drawTimingSnapshot,
        performanceMarks: performance
          .getEntriesByType("mark")
          .map((entry) => entry.name),
        workerMessages: workerMessageSnapshot,
        readerDiagnostic,
        ...Object.fromEntries(
          Object.entries(state).filter(
            ([key]) => key !== "drawTiming" && key !== "workerMessages",
          ),
        ),
      };
    },
    diagnoseReader,
    DRAW_TIMING_SAMPLE_LIMIT,
    BROWSER_INGEST_STATE_KEY,
    WORKER_MESSAGE_DIAGNOSTIC_LIMIT,
  );

  return {
    ...state,
    drawTiming: drawTimingSnapshot(state.drawTiming),
    fileSelection: fileSelectionSnapshot(state.fileSelection),
    workerMessages: workerMessageSnapshot(state.workerMessages),
  };
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
        (globalThis.__TRACY_BROWSER_INGEST__?.workerMessages?.messages ?? []).some(
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
        globalThis.__TRACY_BROWSER_INGEST__?.drawTiming?.firstPresentedAt !== null,
      "browser did not present first ingest draw",
      10_000,
    );

    const result = await browserState(page);
    const { drawTiming, fileSelection } = result;
    assert.equal(result.appError, "");
    assert.equal(fileSelection.selectedFile.name, "throttled-100mb.json");
    assert.equal(fileSelection.selectedFile.size, TRACE_SIZE_BYTES);
    assert.notEqual(fileSelection.selectedAt, null);
    assert.notEqual(drawTiming.firstDrawAt, null);
    assert.notEqual(drawTiming.firstPresentedAt, null);
    assert.ok(
      drawTiming.firstPresentedAt - fileSelection.selectedAt <= FIRST_PRESENTED_BUDGET,
      `first presented ingest draw took ${drawTiming.firstPresentedAt - fileSelection.selectedAt}ms`,
    );
    assert.ok(
      drawTiming.maxFrameDuration <= FRAME_BUDGET,
      `slowest ingest frame took ${drawTiming.maxFrameDuration}ms`,
    );
  } finally {
    await browser.close();
    await fsp.rm(tmpDir, { force: true, recursive: true });
    await server.close();
  }
}

async function runSelfTest() {
  assert.deepEqual(fileSelectionSnapshot(), emptyFileSelectionSnapshot());
  assert.deepEqual(drawTimingSnapshot(), emptyDrawTimingSnapshot());
  assert.deepEqual(
    drawTimingSnapshot({
      fillRectCount: 2,
      fillRectSamples: [
        { height: 10, width: 20, x: 1, y: 2 },
        { height: 12, width: 22, x: 3, y: 4 },
      ],
      firstDrawAt: 15.5,
      firstPresentedAt: 16.75,
      frameDurations: [1.25, 2.5],
      maxFrameDuration: 2.5,
    }),
    {
      fillRectCount: 2,
      fillRectSamples: [
        { height: 10, width: 20, x: 1, y: 2 },
        { height: 12, width: 22, x: 3, y: 4 },
      ],
      firstDrawAt: 15.5,
      firstPresentedAt: 16.75,
      frameDurationsSample: [1.25, 2.5],
      maxFrameDuration: 2.5,
    },
  );
  assert.deepEqual(
    fileSelectionSnapshot({
      selectedAt: 12.5,
      selectedFile: { name: "trace.json", size: TRACE_SIZE_BYTES },
    }),
    {
      selectedAt: 12.5,
      selectedFile: { name: "trace.json", size: TRACE_SIZE_BYTES },
    },
  );
  assert.deepEqual(workerMessageSnapshot(), emptyWorkerMessageSnapshot());
  assert.deepEqual(
    workerMessageSnapshot({
      messages: [
        { fileOffset: 0, type: "preloaded" },
        { fileOffset: 65536, type: "progress" },
        { error: "stalled", type: "worker-error" },
      ],
      posts: [
        { indexName: "tracy-index", sourceName: "trace.json", type: "start" },
      ],
    }),
    {
      messageCount: 3,
      messagesHead: [
        { fileOffset: 0, type: "preloaded" },
        { fileOffset: 65536, type: "progress" },
        { error: "stalled", type: "worker-error" },
      ],
      messagesTail: [
        { fileOffset: 0, type: "preloaded" },
        { fileOffset: 65536, type: "progress" },
        { error: "stalled", type: "worker-error" },
      ],
      postCount: 1,
      postsHead: [
        { indexName: "tracy-index", sourceName: "trace.json", type: "start" },
      ],
      postsTail: [
        { indexName: "tracy-index", sourceName: "trace.json", type: "start" },
      ],
    },
  );
  assert.deepEqual(
    workerMessageSnapshot({
      messageCount: 12,
      messagesHead: [{ type: "preloaded" }],
      messagesTail: [{ type: "done" }],
      postCount: 2,
      postsHead: [{ type: "start" }],
      postsTail: [{ type: "cancel" }],
    }),
    {
      messageCount: 12,
      messagesHead: [{ type: "preloaded" }],
      messagesTail: [{ type: "done" }],
      postCount: 2,
      postsHead: [{ type: "start" }],
      postsTail: [{ type: "cancel" }],
    },
  );
  const previousIngestState = globalThis[BROWSER_INGEST_STATE_KEY];
  try {
    globalThis[BROWSER_INGEST_STATE_KEY] = {
      drawTiming: {
        fillRectCount: 20,
        fillRectSamples: Array.from({ length: 20 }, (_value, index) => ({
          height: index + 1,
          width: index + 2,
          x: index,
          y: index,
        })),
        frameDurations: Array.from({ length: 20 }, (_value, index) => index + 0.5),
        maxFrameDuration: 19.5,
      },
      workerMessages: {
        messages: Array.from({ length: 12 }, (_value, index) => ({
          fileOffset: index,
          type: "progress",
        })),
        posts: Array.from({ length: 10 }, (_value, index) => ({
          indexName: `tracy-index-${index}`,
          type: "start",
        })),
      },
    };
    const boundedState = await browserState({
      async evaluate(callback, ...args) {
        return callback(...args);
      },
    });
    assert.equal(boundedState.drawTiming.fillRectCount, 20);
    assert.equal(boundedState.drawTiming.fillRectSamples.length, 16);
    assert.equal(boundedState.drawTiming.frameDurationsSample.length, 16);
    assert.equal(boundedState.drawTiming.frameDurations, undefined);
    assert.equal(boundedState.workerMessages.messageCount, 12);
    assert.equal(boundedState.workerMessages.messagesHead.length, 8);
    assert.equal(boundedState.workerMessages.messagesTail.length, 8);
    assert.equal(boundedState.workerMessages.postCount, 10);
    assert.equal(boundedState.workerMessages.postsHead.length, 8);
    assert.equal(boundedState.workerMessages.postsTail.length, 8);
    assert.equal(boundedState.workerMessages.messages, undefined);
    assert.equal(boundedState.workerMessages.posts, undefined);
  } finally {
    if (previousIngestState === undefined) {
      delete globalThis[BROWSER_INGEST_STATE_KEY];
    } else {
      globalThis[BROWSER_INGEST_STATE_KEY] = previousIngestState;
    }
  }

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
    workerMessages: {
      messages: [
        { fileOffset: 0, type: "preloaded" },
        { fileOffset: 65536, type: "progress" },
        { error: "stalled", type: "worker-error" },
      ],
    },
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
      () => globalThis.__TRACY_BROWSER_INGEST__?.drawTiming?.firstPresentedAt !== null,
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
  assert.match(timeoutError.message, /"workerMessages":.*"messagesHead":.*"preloaded"/);
  assert.match(timeoutError.message, /"workerMessages":.*"messagesTail":.*"worker-error"/);
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
