#!/usr/bin/env node

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const puppeteer = require("puppeteer-core");

const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const RUNTIME_SPEC = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, "abi", "runtime.json"), "utf8"),
);
const { FIXTURE_SIZE_BYTES, FRAME_BUDGET_MS } =
  RUNTIME_SPEC.interactiveIngestCheck;
const TRACE_SIZE_BYTES = FIXTURE_SIZE_BYTES.value;
const FRAME_BUDGET = FRAME_BUDGET_MS.value;
const FIRST_EVENTS_BUDGET_MS = 100;
const BROWSER_TIMEOUT_MS = 15_000;

function contentType(file) {
  switch (path.extname(file)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".wasm":
      return "application/wasm";
    case ".webmanifest":
      return "application/manifest+json";
    default:
      return "application/octet-stream";
  }
}

function commandPath(command) {
  const result = childProcess.spawnSync(
    "bash",
    ["-lc", `command -v ${JSON.stringify(command)}`],
    { encoding: "utf8" },
  );

  return result.status === 0 ? result.stdout.trim() : "";
}

function cachedPlaywrightChromes() {
  const cacheRoot = path.join(os.homedir(), ".cache", "ms-playwright");
  if (!fs.existsSync(cacheRoot)) {
    return [];
  }

  return fs.readdirSync(cacheRoot)
    .filter((entry) => /^chromium-\d+$/.test(entry))
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
    .flatMap((entry) => [
      path.join(cacheRoot, entry, "chrome-linux64", "chrome"),
      path.join(cacheRoot, entry, "chrome-linux", "chrome"),
    ]);
}

function browserExecutablePath() {
  const candidates = [
    process.env.TRACY_INTERACTIVE_INGEST_BROWSER,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    commandPath("google-chrome"),
    commandPath("google-chrome-stable"),
    commandPath("chromium"),
    commandPath("chromium-browser"),
    ...cachedPlaywrightChromes(),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("Chrome/Chromium not found for interactive ingest browser check");
}

function resolveDistPath(requestUrl) {
  const url = new URL(requestUrl, "http://127.0.0.1");
  const relativePath =
    url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.replace(/^\//, ""));
  const file = path.resolve(DIST_DIR, relativePath);
  const root = path.resolve(DIST_DIR);

  return file === root || file.startsWith(`${root}${path.sep}`) ? file : null;
}

async function serveDist() {
  const server = http.createServer(async (request, response) => {
    const file = resolveDistPath(request.url);
    if (file === null) {
      response.writeHead(404);
      response.end("not found");
      return;
    }

    try {
      const body = await fsp.readFile(file);
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Length": body.byteLength,
        "Content-Type": contentType(file),
      });
      response.end(body);
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") {
        response.writeHead(404);
        response.end("not found");
        return;
      }
      response.destroy(error);
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  return {
    close: () => new Promise((resolve) => server.close(resolve)),
    origin: `http://127.0.0.1:${server.address().port}`,
  };
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
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await page.evaluate(predicate)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(
    `${label}; browser ingest state=${JSON.stringify(
      await browserState(page, { diagnoseReader: true }),
    )}`,
  );
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

    const chooserPromise = page.waitForFileChooser({ timeout: 1000 });
    const clickStartedAt = await page.evaluate(() => performance.now());
    await page.mouse.click(box.x + 12, box.y + 12);
    const chooser = await chooserPromise;
    const chooserOpenedAt = await page.evaluate(() => performance.now());
    assert.ok(
      chooserOpenedAt - clickStartedAt < 500,
      `file chooser opened after ${chooserOpenedAt - clickStartedAt}ms`,
    );

    await new Promise((resolve) => setTimeout(resolve, 250));
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
      result.firstPresentedAt - result.fileSelectionAt <= FIRST_EVENTS_BUDGET_MS,
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

checkBrowserInteractiveIngest().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
