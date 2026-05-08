#!/usr/bin/env node

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const RUNTIME_SPEC = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, "abi", "runtime.json"), "utf8"),
);
const DEFAULT_TIMEOUT_MS = 15000;
const CORE_READY_REQUEST_EPSILON_MS = 0.5;
const FAST_3G = Object.freeze({
  downloadThroughput: RUNTIME_SPEC.appLoadBench.fast3g.downloadThroughputBytesPerSecond,
  latency: RUNTIME_SPEC.appLoadBench.fast3g.latencyMs,
  uploadThroughput: RUNTIME_SPEC.appLoadBench.fast3g.uploadThroughputBytesPerSecond,
});
const BUDGETS = Object.freeze(
  Object.fromEntries(
    Object.entries(RUNTIME_SPEC.appLoadBench.budgets).map(([name, budget]) => [
      name,
      Object.freeze({ ...budget }),
    ]),
  ),
);
const MIME_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json",
});
const REQUIRED_DIST_FILES = Object.freeze([
  "bootstrap.mjs",
  "build-info.js",
  "host/abi.mjs",
  "host/progressive-trace-renderer-loader.mjs",
  "host/startup-spec.mjs",
  "host/trace-renderer-spec.mjs",
  "host/wasm-modules.mjs",
  "index.html",
  "manifest.webmanifest",
  "precache-manifest.js",
  "service-worker.js",
  "wasm/app.wasm",
  "wasm/index.wasm",
  "wasm/parser.wasm",
  "wasm/parser_state.wasm",
  "worker.js",
]);

function parseArgs(argv) {
  const options = {
    browser: process.env.TRACY_APP_LOAD_BROWSER ?? "",
    distDir: DIST_DIR,
    selfTest: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--self-test") {
      options.selfTest = true;
    } else if (arg === "--browser") {
      index += 1;
      options.browser = argv[index] ?? "";
    } else if (arg === "--dist") {
      index += 1;
      options.distDir = path.resolve(argv[index] ?? "");
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  return options;
}

function assertMeasuredBudget(name, metrics, budget) {
  for (const [field, limit] of Object.entries(budget)) {
    const value = metrics[field];

    if (!Number.isFinite(value)) {
      throw new Error(`${name} missing metric ${field}`);
    }
    if (value > limit) {
      throw new Error(`${name} ${field} ${value.toFixed(1)} > ${limit}`);
    }
  }
}

function findBrowser(explicitPath) {
  const candidates = [
    explicitPath,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const result = childProcess.spawnSync("bash", ["-lc", `command -v ${JSON.stringify(candidate)}`], {
      encoding: "utf8",
    });

    if (result.status === 0) {
      return result.stdout.trim();
    }
    if (path.isAbsolute(candidate) && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("Chrome/Chromium not found; set TRACY_APP_LOAD_BROWSER");
}

function contentType(file) {
  return MIME_TYPES[path.extname(file)] ?? "application/octet-stream";
}

function sendNotFound(response) {
  response.writeHead(404);
  response.end("not found");
}

function assertDistReady(distDir) {
  const missing = REQUIRED_DIST_FILES.filter((file) =>
    !fs.existsSync(path.join(distDir, file)),
  );

  if (missing.length > 0) {
    throw new Error(`app-load bench dist is incomplete; missing ${missing.join(", ")}`);
  }

  const buildInfo = fs.readFileSync(path.join(distDir, "build-info.js"), "utf8");
  if (!/TRACY_BUILD_HASH = "[0-9a-f]{64}"/.test(buildInfo)) {
    throw new Error("app-load bench dist is incomplete; build-info.js lacks TRACY_BUILD_HASH");
  }

  const precache = fs.readFileSync(path.join(distDir, "precache-manifest.js"), "utf8");
  const precacheUrls = precache.match(/urls: Object\.freeze\((\[[\s\S]*?\])\),/);
  if (precacheUrls === null) {
    throw new Error("app-load bench dist is incomplete; precache-manifest.js lacks urls");
  }

  const precacheFiles = JSON.parse(precacheUrls[1]);
  if (!Array.isArray(precacheFiles)) {
    throw new Error("app-load bench dist is incomplete; precache-manifest.js urls is not an array");
  }

  for (const file of REQUIRED_DIST_FILES.filter((entry) => entry !== "precache-manifest.js")) {
    if (!precacheFiles.includes(file)) {
      throw new Error(`app-load bench dist is incomplete; precache-manifest.js missing ${file}`);
    }
  }
}

function resolveDistPath(distDir, requestUrl) {
  const url = new URL(requestUrl, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const file = path.resolve(distDir, relativePath);

  if (!file.startsWith(`${path.resolve(distDir)}${path.sep}`) && file !== path.resolve(distDir)) {
    return null;
  }

  return file;
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server.address().port;
}

async function createServer(distDir) {
  const server = http.createServer(async (request, response) => {
    const file = resolveDistPath(distDir, request.url);

    if (file === null) {
      sendNotFound(response);
      return;
    }

    let stat;
    try {
      stat = await fs.promises.stat(file);
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") {
        sendNotFound(response);
        return;
      }
      response.destroy(error);
      return;
    }

    if (!stat.isFile()) {
      sendNotFound(response);
      return;
    }

    const stream = fs.createReadStream(file);
    stream.on("error", (error) => response.destroy(error));
    response.writeHead(200, {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": stat.size,
      "Content-Type": contentType(file),
    });
    stream.pipe(response);
  });
  const port = await listen(server);

  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function connectWebSocket(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const key = crypto.randomBytes(16).toString("base64");
    const socket = net.connect(Number(parsed.port), parsed.hostname);
    let handshake = "";
    let buffer = Buffer.alloc(0);

    socket.once("error", reject);
    socket.write(
      [
        `GET ${parsed.pathname}${parsed.search} HTTP/1.1`,
        `Host: ${parsed.host}`,
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Key: ${key}`,
        "Sec-WebSocket-Version: 13",
        "",
        "",
      ].join("\r\n"),
    );

    socket.on("data", (chunk) => {
      if (handshake !== null) {
        handshake += chunk.toString("binary");
        const end = handshake.indexOf("\r\n\r\n");

        if (end === -1) {
          return;
        }

        const rest = Buffer.from(handshake.slice(end + 4), "binary");
        if (!/^HTTP\/1\.1 101 /.test(handshake)) {
          reject(new Error("DevTools WebSocket handshake failed"));
          return;
        }
        handshake = null;
        buffer = Buffer.concat([buffer, rest]);
        resolve({ buffer, socket });
      }
    });
  });
}

function encodeFrame(payload) {
  const body = Buffer.from(payload);
  let header;

  if (body.length < 126) {
    header = Buffer.from([0x81, 0x80 | body.length]);
  } else {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(body.length, 2);
  }

  const mask = Buffer.from([1, 2, 3, 4]);
  const masked = Buffer.from(body);
  for (let index = 0; index < masked.length; index += 1) {
    masked[index] ^= mask[index % mask.length];
  }

  return Buffer.concat([header, mask, masked]);
}

function decodeFrames(state, onMessage) {
  while (state.buffer.length >= 2) {
    const first = state.buffer[0];
    const second = state.buffer[1];
    let offset = 2;
    let length = second & 0x7f;

    if (length === 126) {
      if (state.buffer.length < 4) {
        return;
      }
      length = state.buffer.readUInt16BE(2);
      offset = 4;
    } else if (length === 127) {
      if (state.buffer.length < 10) {
        return;
      }
      const high = state.buffer.readUInt32BE(2);
      const low = state.buffer.readUInt32BE(6);
      if (high !== 0) {
        throw new Error("DevTools WebSocket frame is too large");
      }
      length = low;
      offset = 10;
    }
    if (state.buffer.length < offset + length) {
      return;
    }

    const payload = state.buffer.subarray(offset, offset + length);
    state.buffer = state.buffer.subarray(offset + length);

    if ((first & 0x0f) === 1) {
      onMessage(JSON.parse(payload.toString("utf8")));
    }
  }
}

async function connectCdp(webSocketUrl) {
  const state = await connectWebSocket(webSocketUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();

  state.socket.on("data", (chunk) => {
    state.buffer = Buffer.concat([state.buffer, chunk]);
    decodeFrames(state, (message) => {
      if (message.id !== undefined) {
        const pendingRequest = pending.get(message.id);
        pending.delete(message.id);
        if (message.error !== undefined) {
          pendingRequest.reject(new Error(message.error.message));
        } else {
          pendingRequest.resolve(message.result ?? {});
        }
      } else if (message.method !== undefined) {
        listeners
          .get(message.method)
          ?.forEach((listener) => listener(message.params ?? {}, message.sessionId));
      }
    });
  });

  return {
    close() {
      state.socket.destroy();
    },
    on(method, listener) {
      if (!listeners.has(method)) {
        listeners.set(method, new Set());
      }
      listeners.get(method).add(listener);
      return () => {
        listeners.get(method)?.delete(listener);
      };
    },
    send(method, params = {}, sessionId = undefined) {
      const id = nextId;
      nextId += 1;

      const message = { id, method, params };
      if (sessionId !== undefined) {
        message.sessionId = sessionId;
      }

      state.socket.write(encodeFrame(JSON.stringify(message)));
      return new Promise((resolve, reject) => {
        pending.set(id, { reject, resolve });
      });
    },
  };
}

function waitForSessionEvent(cdp, sessionId, method, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      off();
      reject(new Error(`timed out waiting for ${method}`));
    }, timeoutMs);
    const off = cdp.on(method, (params, eventSessionId) => {
      if (eventSessionId !== sessionId) {
        return;
      }

      clearTimeout(timeout);
      off();
      resolve(params);
    });
  });
}

function launchBrowser(browserPath) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tracy-app-load-browser-"));
  const child = childProcess.spawn(browserPath, [
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-sync",
    "--enable-experimental-webassembly-features",
    "--enable-features=WebAssemblyJSPI",
    "--js-flags=--experimental-wasm-jspi --experimental-wasm-stack-switching",
    "--remote-debugging-port=0",
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  let settled = false;

  function waitForExit(timeoutMs = DEFAULT_TIMEOUT_MS) {
    if (child.exitCode !== null || child.signalCode !== null) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      let forceKillTimeout;
      let failTimeout;

      function cleanup() {
        clearTimeout(forceKillTimeout);
        clearTimeout(failTimeout);
      }

      forceKillTimeout = setTimeout(() => {
        child.kill("SIGKILL");
      }, timeoutMs);

      failTimeout = setTimeout(() => {
        cleanup();
        reject(new Error(`browser did not exit within ${timeoutMs}ms after close`));
      }, timeoutMs + 5000);

      child.once("exit", () => {
        cleanup();
        resolve();
      });
    });
  }

  return new Promise((resolve, reject) => {
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("timed out waiting for browser DevTools endpoint"));
    }, DEFAULT_TIMEOUT_MS);

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match !== null) {
        clearTimeout(timeout);
        settled = true;
        resolve({
          async close() {
            if (child.exitCode === null && child.signalCode === null) {
              child.kill();
            }
            await waitForExit();
            fs.rmSync(userDataDir, { recursive: true, force: true });
          },
          webSocketUrl: match[1],
        });
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      if (!settled) {
        reject(new Error(`browser exited before DevTools endpoint: ${code}`));
      }
    });
  });
}

async function waitUntil(predicate, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const value = await predicate();
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error("timed out waiting for page condition");
}

function unfinishedTransferRequestIds(requestIds, cachedRequestIds, loadingBytes) {
  return [...requestIds].filter(
    (requestId) => !cachedRequestIds.has(requestId) && !loadingBytes.has(requestId),
  );
}

function coreTransferBytesForRequests(requestIds, cachedRequestIds, loadingBytes) {
  return [...requestIds]
    .filter((requestId) => !cachedRequestIds.has(requestId))
    .reduce((total, requestId) => total + (loadingBytes.get(requestId) ?? 0), 0);
}

function requestIdsStartedAtOrBefore(requestStartWallMs, wallTimeMs, fallbackRequestIds) {
  if (!Number.isFinite(wallTimeMs)) {
    return new Set(fallbackRequestIds);
  }

  const cutoffMs = wallTimeMs + CORE_READY_REQUEST_EPSILON_MS;
  const requestIds = new Set();

  for (const [requestId, startedAtMs] of requestStartWallMs) {
    if (Number.isFinite(startedAtMs) && startedAtMs <= cutoffMs) {
      requestIds.add(requestId);
    }
  }

  for (const requestId of fallbackRequestIds) {
    if (!requestStartWallMs.has(requestId)) {
      requestIds.add(requestId);
    }
  }

  return requestIds;
}

async function performanceMarkWallMs(cdp, page, markName) {
  const result = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const marks = performance.getEntriesByName(${JSON.stringify(markName)}, "mark");
      const mark = marks[marks.length - 1];
      if (!mark) {
        return null;
      }
      return performance.timeOrigin + mark.startTime;
    })()`,
    returnByValue: true,
  }, page.sessionId);

  const wallTimeMs = result.result?.value;

  if (!Number.isFinite(wallTimeMs)) {
    throw new Error(`missing performance mark ${markName}`);
  }

  return wallTimeMs;
}

async function createPage(cdp) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", {
    flatten: true,
    targetId,
  });

  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Network.enable", {}, sessionId);
  await cdp.send("Performance.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);

  return { sessionId, targetId };
}

async function navigateAndMeasure(cdp, page, url, options = {}) {
  const requestIds = new Set();
  const requestStartWallMs = new Map();
  const cachedRequestIds = new Set();
  const loadingBytes = new Map();
  let coreRequestIds = null;

  const offRequest = cdp.on("Network.requestWillBeSent", (event, sessionId) => {
    if (sessionId !== page.sessionId) {
      return;
    }
    requestIds.add(event.requestId);
    if (Number.isFinite(event.wallTime) && !requestStartWallMs.has(event.requestId)) {
      requestStartWallMs.set(event.requestId, event.wallTime * 1000);
    }
  });
  const offCache = cdp.on("Network.requestServedFromCache", (event, sessionId) => {
    if (sessionId !== page.sessionId) {
      return;
    }
    cachedRequestIds.add(event.requestId);
  });
  const offResponse = cdp.on("Network.responseReceived", (event, sessionId) => {
    if (sessionId !== page.sessionId) {
      return;
    }
    if (event.response.fromServiceWorker || event.response.fromDiskCache) {
      cachedRequestIds.add(event.requestId);
    }
  });
  const offLoading = cdp.on("Network.loadingFinished", (event, sessionId) => {
    if (sessionId !== page.sessionId) {
      return;
    }
    loadingBytes.set(event.requestId, event.encodedDataLength ?? 0);
  });

  if (options.fast3g) {
    await cdp.send("Network.emulateNetworkConditions", {
      connectionType: "cellular3g",
      downloadThroughput: FAST_3G.downloadThroughput,
      latency: FAST_3G.latency,
      offline: false,
      uploadThroughput: FAST_3G.uploadThroughput,
    }, page.sessionId);
  }
  await cdp.send("Network.setBypassServiceWorker", {
    bypass: options.bypassServiceWorker === true,
  }, page.sessionId);

  const loaded = waitForSessionEvent(cdp, page.sessionId, "Page.loadEventFired");
  await cdp.send("Page.navigate", { url }, page.sessionId);
  await loaded;
  await waitUntil(async () => {
    const result = await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const error = document.querySelector('[role="alert"]')?.textContent ?? "";
        const detail = globalThis.__TRACY_APP_LOAD_ERROR__ ?? "";
        return {
          coreReady: performance.getEntriesByName("tracy.core.ready").length > 0,
          detail,
          error,
        };
      })()`,
      returnByValue: true,
    }, page.sessionId);
    const status = result.result?.value ?? {};

    if (status.error) {
      const detail = status.detail ? ` (${status.detail})` : "";
      throw new Error(`page reported app-load failure: ${status.error}${detail}`);
    }
    return status.coreReady === true;
  });
  const coreReadyWallMs = await performanceMarkWallMs(cdp, page, "tracy.core.ready");
  coreRequestIds = requestIdsStartedAtOrBefore(
    requestStartWallMs,
    coreReadyWallMs,
    requestIds,
  );
  await waitUntil(async () => {
    const result = await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const error = document.querySelector('[role="alert"]')?.textContent ?? "";
        const detail = globalThis.__TRACY_APP_LOAD_ERROR__ ?? "";
        return {
          detail,
          error,
          fullReady: performance.getEntriesByName("tracy.app.ready").length > 0,
        };
      })()`,
      returnByValue: true,
    }, page.sessionId);
    const status = result.result?.value ?? {};

    if (status.error) {
      const detail = status.detail ? ` (${status.detail})` : "";
      throw new Error(`page reported app-load failure: ${status.error}${detail}`);
    }

    return status.fullReady === true;
  });
  await waitUntil(() =>
    unfinishedTransferRequestIds(coreRequestIds, cachedRequestIds, loadingBytes).length === 0,
  );
  const coreTransferBytes = coreTransferBytesForRequests(
    coreRequestIds,
    cachedRequestIds,
    loadingBytes,
  );

  const result = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
      const coreStart = performance.getEntriesByName("tracy.core.start")[0]?.startTime;
      const coreReady = performance.getEntriesByName("tracy.core.ready")[0]?.startTime;
      const appLoad = performance.getEntriesByName("tracy.app.load")[0]?.duration;
      const wasm = performance.getEntriesByName("tracy.wasm.instantiate")[0]?.duration;
      return {
        coreTtiMs: coreReady - coreStart,
        fcpMs: fcp,
        fullLoadMs: appLoad,
        wasmInstantiateMs: wasm,
      };
    })()`,
    returnByValue: true,
  }, page.sessionId);
  const metrics = result.result.value;

  metrics.transferBytes = coreTransferBytes;

  offRequest();
  offCache();
  offResponse();
  offLoading();

  return metrics;
}

async function primeServiceWorker(cdp, page, url) {
  await navigateAndMeasure(cdp, page, url);
  await waitUntil(async () => {
    const result = await cdp.send("Runtime.evaluate", {
      expression: "navigator.serviceWorker?.controller !== null",
      returnByValue: true,
    }, page.sessionId);

    return result.result?.value === true;
  });
}

async function runBench(options) {
  assertDistReady(options.distDir);

  const browserPath = findBrowser(options.browser);
  const server = await createServer(options.distDir);
  const browser = await launchBrowser(browserPath);
  const cdp = await connectCdp(browser.webSocketUrl);
  const url = `${server.origin}/`;

  try {
    const coldPage = await createPage(cdp);
    const cold = await navigateAndMeasure(cdp, coldPage, url, { fast3g: true });

    const swPage = await createPage(cdp);
    await primeServiceWorker(cdp, swPage, url);
    const warmSw = await navigateAndMeasure(cdp, swPage, url);

    const httpPage = await createPage(cdp);
    await navigateAndMeasure(cdp, httpPage, url, { bypassServiceWorker: true });
    const warmHttp = await navigateAndMeasure(cdp, httpPage, url, { bypassServiceWorker: true });

    assertMeasuredBudget("cold", cold, BUDGETS.cold);
    assertMeasuredBudget("warmSw", warmSw, BUDGETS.warmSw);
    assertMeasuredBudget("warmHttp", warmHttp, BUDGETS.warmHttp);

    console.log(JSON.stringify({ cold, warmHttp, warmSw }, null, 2));
  } finally {
    cdp.close();
    await browser.close();
    await server.close();
  }
}

function runSelfTest() {
  assert.deepEqual(FAST_3G, {
    downloadThroughput: RUNTIME_SPEC.appLoadBench.fast3g.downloadThroughputBytesPerSecond,
    latency: RUNTIME_SPEC.appLoadBench.fast3g.latencyMs,
    uploadThroughput: RUNTIME_SPEC.appLoadBench.fast3g.uploadThroughputBytesPerSecond,
  });
  assert.deepEqual(BUDGETS, RUNTIME_SPEC.appLoadBench.budgets);
  assert.doesNotThrow(() =>
    assertMeasuredBudget("fixture", {
      coreTtiMs: 1,
      fcpMs: 1,
      fullLoadMs: 2,
      transferBytes: 0,
      wasmInstantiateMs: 3,
    }, {
      coreTtiMs: 1,
      fcpMs: 1,
      fullLoadMs: 2,
      transferBytes: 0,
      wasmInstantiateMs: 3,
    }),
  );
  assert.throws(
    () => assertMeasuredBudget("fixture", { fcpMs: 2 }, { fcpMs: 1 }),
    /fixture fcpMs 2.0 > 1/,
  );
  const transferRequestIds = new Set(["bootstrap", "renderer", "cached"]);
  const cachedTransferRequestIds = new Set(["cached"]);
  const loadingTransferBytes = new Map([["bootstrap", 12]]);
  assert.deepEqual(
    unfinishedTransferRequestIds(transferRequestIds, cachedTransferRequestIds, loadingTransferBytes),
    ["renderer"],
  );
  assert.equal(
    coreTransferBytesForRequests(
      transferRequestIds,
      cachedTransferRequestIds,
      loadingTransferBytes,
    ),
    12,
  );
  loadingTransferBytes.set("renderer", 34);
  assert.deepEqual(
    unfinishedTransferRequestIds(transferRequestIds, cachedTransferRequestIds, loadingTransferBytes),
    [],
  );
  assert.equal(
    coreTransferBytesForRequests(
      transferRequestIds,
      cachedTransferRequestIds,
      loadingTransferBytes,
    ),
    46,
  );
  assert.deepEqual(
    requestIdsStartedAtOrBefore(
      new Map([
        ["bootstrap", 1000],
        ["renderer", 1002],
        ["trace-spec", 999.75],
      ]),
      1000,
      new Set(["bootstrap", "renderer", "trace-spec", "unknown"]),
    ),
    new Set(["bootstrap", "trace-spec", "unknown"]),
  );
  assert.deepEqual(
    requestIdsStartedAtOrBefore(
      new Map([
        ["bootstrap", 1000],
        ["renderer", 1002],
      ]),
      Number.NaN,
      new Set(["bootstrap", "renderer"]),
    ),
    new Set(["bootstrap", "renderer"]),
  );
  const staticServerSource = createServer.toString();
  assert.match(staticServerSource, /fs\.promises\.stat/);
  assert.match(staticServerSource, /fs\.createReadStream/);
  assert.doesNotMatch(staticServerSource, /fs\.(existsSync|statSync|readFileSync)/);

  const tmpDist = fs.mkdtempSync(path.join(os.tmpdir(), "tracy-app-load-dist-"));
  try {
    assert.throws(() => assertDistReady(tmpDist), /dist is incomplete; missing/);

    for (const file of REQUIRED_DIST_FILES) {
      const absolute = path.join(tmpDist, file);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, "");
    }
    fs.writeFileSync(
      path.join(tmpDist, "build-info.js"),
      `export const TRACY_BUILD_HASH = "${"a".repeat(64)}";\n`,
    );
    fs.writeFileSync(
      path.join(tmpDist, "precache-manifest.js"),
      [
        "self.TRACY_PRECACHE = Object.freeze({",
        `  urls: Object.freeze(${JSON.stringify(
          REQUIRED_DIST_FILES.filter((entry) => entry !== "precache-manifest.js"),
        )}),`,
        "});",
        "",
      ].join("\n"),
    );
    assert.doesNotThrow(() => assertDistReady(tmpDist));
  } finally {
    fs.rmSync(tmpDist, { recursive: true, force: true });
  }

  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8"));
  const runtimeSpecJson = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, "abi", "runtime.json"), "utf8"),
  );
  const makefile = fs.readFileSync(path.join(ROOT_DIR, "Makefile"), "utf8");
  const indexHtml = fs.readFileSync(path.join(ROOT_DIR, "index.html"), "utf8");
  const bootstrap = fs.readFileSync(path.join(ROOT_DIR, "bootstrap.mjs"), "utf8");
  const rendererLoader = fs.readFileSync(
    path.join(ROOT_DIR, "host", "progressive-trace-renderer-loader.mjs"),
    "utf8",
  );
  const runtime = fs.readFileSync(path.join(ROOT_DIR, "host", "runtime.mjs"), "utf8");
  const startupSpec = fs.readFileSync(path.join(ROOT_DIR, "host", "startup-spec.mjs"), "utf8");
  const traceRendererSpec = fs.readFileSync(path.join(ROOT_DIR, "host", "trace-renderer-spec.mjs"), "utf8");
  const bootstrapStartOffset = bootstrap.indexOf("performance?.mark?.(PERFORMANCE_MARKS.bootstrapStart)");
  const bootstrapCoreReadyOffset = bootstrap.indexOf("PERFORMANCE_MARKS.coreReady");
  const bootstrapRendererPreloadOffset = bootstrap.indexOf(
    "const importProgressiveTraceRenderer = () =>",
  );
  const bootstrapRuntimeImportOffset = bootstrap.indexOf('import("./host/runtime.mjs")');
  const runtimeCoreStartOffset = runtime.indexOf(
    "markPerformance(PERFORMANCE_MARKS.coreStart",
  );
  const runtimeWasmStartOffset = runtime.indexOf(
    "markPerformance(PERFORMANCE_MARKS.wasmInstantiateStart",
  );
  const defaultRendererPreloadOffset = runtime.indexOf(
    "const deferredRendererReadyPromise",
  );
  const runtimeCoreReadyOffset = runtime.indexOf(
    "markPerformance(PERFORMANCE_MARKS.coreReady",
  );
  const firstFramePromiseOffset = runtime.indexOf("firstFramePromise");
  const rendererModuleLoadOffset = runtime.indexOf("const deferredRendererReadyPromise");
  const tracyMainOffset = runtime.indexOf("tracy_main();");
  const appReadyOffset = runtime.indexOf(
    "markPerformance(PERFORMANCE_MARKS.appReady",
  );

  assert.equal(packageJson.scripts["bench:app-load"], "node tools/app-load-bench.js");
  assert.equal(packageJson.scripts["test:app-load-bench"], "node tools/app-load-bench.js --self-test");
  assert.equal(packageJson.scripts["test:runtime-spec"], "node tools/generate-runtime-spec.js --check");
  assert.equal(
    runtimeSpecJson.urls.PROGRESSIVE_TRACE_RENDERER_URL.value,
    "./progressive-trace-renderer.mjs",
  );
  assert.doesNotMatch(indexHtml, /host\/progressive-trace-renderer-loader\.mjs/);
  assert.notEqual(bootstrapStartOffset, -1);
  assert.equal(bootstrapCoreReadyOffset, -1);
  assert.notEqual(bootstrapRendererPreloadOffset, -1);
  assert.notEqual(bootstrapRuntimeImportOffset, -1);
  assert.notEqual(runtimeCoreStartOffset, -1);
  assert.notEqual(runtimeWasmStartOffset, -1);
  assert.notEqual(defaultRendererPreloadOffset, -1);
  assert.notEqual(runtimeCoreReadyOffset, -1);
  assert.notEqual(firstFramePromiseOffset, -1);
  assert.notEqual(rendererModuleLoadOffset, -1);
  assert.notEqual(tracyMainOffset, -1);
  assert.notEqual(appReadyOffset, -1);
  assert.ok(
    runtimeCoreReadyOffset < defaultRendererPreloadOffset,
    "default deferred renderer import should start after core readiness",
  );
  assert.ok(
    bootstrapRendererPreloadOffset < bootstrapRuntimeImportOffset,
    "bootstrap should define the renderer implementation importer before waiting on runtime import",
  );
  assert.ok(runtimeCoreStartOffset < tracyMainOffset);
  assert.ok(tracyMainOffset < runtimeCoreReadyOffset);
  assert.ok(runtimeCoreReadyOffset < firstFramePromiseOffset);
  assert.ok(firstFramePromiseOffset < appReadyOffset);
  assert.ok(runtimeCoreReadyOffset < appReadyOffset);
  assert.match(
    runtime,
    /const deferredRendererReadyPromise =[\s\S]+loadProgressiveTraceRendererModule\(\)/,
  );
  assert.match(
    runtime,
    /Promise\.all\(\[firstFramePromise, deferredRendererReadyPromise\]\)\.then/,
  );
  assert.match(runtime, /loadProgressiveTraceRendererModule\(\)/);
  assert.match(runtime, /\.catch\(reportAppLoadError\)/);
  assert.match(runtime, /from "\.\/startup-spec\.mjs"/);
  assert.doesNotMatch(runtime, /from "\.\/runtime-spec\.mjs"/);
  assert.match(runtime, /RUNTIME_URLS\.PROGRESSIVE_TRACE_RENDERER_URL/);
  assert.match(
    runtime,
    /const deferredRendererReadyPromise =[\s\S]+loadProgressiveTraceRendererModule\(\)/,
  );
  assert.match(startupSpec, /progressive-trace-renderer\.mjs/);
  assert.doesNotMatch(startupSpec, /progressive-trace-renderer-loader\.mjs/);
  assert.match(rendererLoader, /import\("\.\/progressive-trace-renderer\.mjs"\)/);
  assert(!fs.existsSync(path.join(ROOT_DIR, "host", "runtime-spec.mjs")));
  assert.match(startupSpec, /Generated from abi\/runtime\.json and abi\/palette\.json/);
  assert.match(traceRendererSpec, /Generated from abi\/palette\.json/);
  assert.match(bootstrap, /from "\.\/host\/startup-spec\.mjs"/);
  assert.doesNotMatch(bootstrap, /runtime-spec\.mjs/);
  assert.match(bootstrap, /RUNTIME_URLS\.PROGRESSIVE_TRACE_RENDERER_URL/);
  assert.match(
    bootstrap,
    /const serviceWorkerController =[\s\S]+navigator\?\.serviceWorker\?\.controller \?\? null/,
  );
  assert.match(
    bootstrap,
    /const warmProgressiveTraceRendererPromise =[\s\S]+serviceWorkerController === null[\s\S]+\? null[\s\S]+import/,
  );
  assert.match(
    bootstrap,
    /warmProgressiveTraceRendererPromise \?\?[\s\S]+import/,
  );
  assert.doesNotMatch(bootstrap, /setTimeout\(resolve/);
  assert.match(bootstrap, /const wasmModulesPromise = import\("\.\/host\/wasm-modules\.mjs"\)/);
  assert.match(bootstrap, /import\("\.\/host\/wasm-modules\.mjs"\)/);
  assert.match(
    bootstrap,
    /const instantiateWasmModuleForThread = async \(\.\.\.args\) =>[\s\S]+\(await wasmModulesPromise\)\.instantiateWasmModuleForThread\(\.\.\.args\)/,
  );
  assert.match(
    bootstrap,
    /importProgressiveTraceRenderer,/,
  );
  assert.match(
    bootstrap,
    /instantiateWasmModuleForThread/,
  );
  assert.doesNotMatch(bootstrap, /progressive-trace-renderer-loader/);
  assert.doesNotMatch(bootstrap, /startup-palette\.mjs/);
  assert.match(startupSpec, /APP_SHELL_COLORS/);
  assert.doesNotMatch(startupSpec, /TRACE_RENDERER_COLORS/);
  assert.match(traceRendererSpec, /TRACE_RENDERER_COLORS/);
  assert.doesNotMatch(traceRendererSpec, /APP_SHELL_COLORS/);
  assert.match(bootstrap, /BOOTSTRAP_WASM_MEMORY\.BOOTSTRAP_MEMORY_INITIAL_PAGES/);
  assert.match(bootstrap, /BOOTSTRAP_TIMING\.SERVICE_WORKER_READY_DELAY_MS/);
  assert.match(
    navigateAndMeasure.toString(),
    /coreReady: performance\.getEntriesByName\("tracy\.core\.ready"\)\.length > 0/,
  );
  assert.match(
    navigateAndMeasure.toString(),
    /performanceMarkWallMs\(cdp, page, "tracy\.core\.ready"\)/,
  );
  assert.match(
    navigateAndMeasure.toString(),
    /requestIdsStartedAtOrBefore\([\s\S]+requestStartWallMs,[\s\S]+coreReadyWallMs,[\s\S]+requestIds/,
  );
  assert.match(
    navigateAndMeasure.toString(),
    /unfinishedTransferRequestIds\(coreRequestIds, cachedRequestIds, loadingBytes\)/,
  );
  assert.match(
    navigateAndMeasure.toString(),
    /coreTransferBytesForRequests\([\s\S]+coreRequestIds,[\s\S]+cachedRequestIds,[\s\S]+loadingBytes/,
  );
  assert.match(
    navigateAndMeasure.toString(),
    /metrics\.transferBytes = coreTransferBytes/,
  );
  assert.match(
    navigateAndMeasure.toString(),
    /fullReady: performance\.getEntriesByName\("tracy\.app\.ready"\)\.length > 0/,
  );
  assert.match(navigateAndMeasure.toString(), /return status\.fullReady === true/);
  assert.match(
    indexHtml,
    /<link rel="modulepreload" href="bootstrap\.mjs">/,
  );
  assert.deepEqual(
    [...indexHtml.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map(
      (match) => match[1],
    ),
    ["bootstrap.mjs"],
  );
  assert.doesNotMatch(
    indexHtml,
    /<link rel="modulepreload" href="host\/wasm-modules\.mjs">/,
  );
  assert.match(makefile, /app-load-bench: dist tools\/app-load-bench\.js/);
  assert.match(
    makefile,
    /dist\/precache-manifest\.js: \$\(filter-out dist\/precache-manifest\.js,\$\(DIST_FILES\)\) tools\/generate-precache-manifest\.js/,
  );
  assert.match(
    makefile,
    /dist\/build-info\.js: \$\(filter-out dist\/build-info\.js \$\(SERVICE_WORKER_FILES\),\$\(DIST_FILES\)\)/,
  );
  assert.match(makefile, /node tools\/app-load-bench\.js --self-test/);
  assert.match(makefile, /node tools\/generate-runtime-spec\.js --check/);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.selfTest) {
    runSelfTest();
  } else {
    await runBench(options);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
