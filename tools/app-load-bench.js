#!/usr/bin/env node

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const {
  CACHE_CONTROL,
  browserExecutablePath,
  createDistServer,
} = require("./dist-browser-helpers.js");
const {
  readinessFailureMessage,
  waitForBrowserReadiness,
} = require("./browser-readiness-helpers.js");

const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist");
const RUNTIME_SPEC = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, "abi", "runtime.json"), "utf8"),
);
const PERFORMANCE_MARKS = Object.freeze({ ...RUNTIME_SPEC.performanceMarks });
const PERFORMANCE_MEASURES = Object.freeze({ ...RUNTIME_SPEC.performanceMeasures });
const READINESS_DIAGNOSTIC_MARK_NAMES = Object.freeze(
  Object.values(PERFORMANCE_MARKS),
);
const DEFAULT_TIMEOUT_MS = 15000;
const CORE_READY_REQUEST_EPSILON_MS =
  RUNTIME_SPEC.appLoadBench.startupBoundary.coreReadyRequestEpsilonMs;
const STARTUP_RESOURCE_TIMING_BUFFER_SIZE =
  RUNTIME_SPEC.appLoadBench.startupResourceTimingBufferSize;
const STARTUP_BOUNDARY_SELF_TEST = Object.freeze({
  ...RUNTIME_SPEC.appLoadBench.startupBoundary.selfTest,
  resourceTimingsBeforeCoreReady: Object.freeze(
    RUNTIME_SPEC.appLoadBench.startupBoundary.selfTest.resourceTimingsBeforeCoreReady.map(
      (resource) => Object.freeze({ ...resource }),
    ),
  ),
});
// Warm samples reuse a page, so let post-ready frame callbacks start their
// deferred preload requests and then require a short quiet window before reuse.
const POST_READY_SETTLE_FRAME_COUNT = 2;
const POST_READY_NETWORK_QUIET_MS = 50;
const WARM_NAVIGATION_SAMPLE_COUNT = 3;
const BENIGN_LOADING_FAILURES = Object.freeze([
  Object.freeze({
    canceled: true,
    errorText: "net::ERR_ABORTED",
  }),
]);
const CORE_TRANSFER_RESOURCE_TYPES = new Set([
  "Document",
  "Fetch",
  "Font",
  "Image",
  "Manifest",
  "Media",
  "Prefetch",
  "Script",
  "SignedExchange",
  "Stylesheet",
  "TextTrack",
  "XHR",
]);
const PROTECTED_STARTUP_BOUNDARY_RESOURCE_INITIATOR_TYPES = new Set([
  "fetch",
  "link",
  "script",
  "xmlhttprequest",
]);
const resourceTimingBufferPages = new WeakSet();
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
  const failures = measuredBudgetFailures(metrics, budget);

  if (failures.length > 0) {
    throw new Error(`${name} ${failures[0]}`);
  }
}

function measuredBudgetFailures(metrics, budget) {
  const failures = [];

  for (const [field, limit] of Object.entries(budget)) {
    const value = metrics[field];

    if (!Number.isFinite(value)) {
      failures.push(`missing metric ${field}`);
    } else if (value > limit) {
      failures.push(`${field} ${value.toFixed(1)} > ${limit}`);
    }
  }

  return failures;
}

function assertAnyMeasuredBudget(name, samples, budget) {
  assert.ok(samples.length > 0, `${name} budget samples must not be empty`);

  if (samples.some((sample) => measuredBudgetFailures(sample, budget).length === 0)) {
    return;
  }

  const sampleFailures = samples.map((sample, index) => {
    const sampleNumber = index + 1;

    return `sample ${sampleNumber}: ${measuredBudgetFailures(sample, budget).join(", ")}`;
  });

  throw new Error(
    `${name} no warm navigation sample satisfied all budget fields; ${sampleFailures.join("; ")}`,
  );
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function medianMetrics(samples) {
  assert.ok(samples.length > 0, "app-load metric samples must not be empty");
  const fields = Object.keys(samples[0]);
  const result = {};

  for (const field of fields) {
    const values = samples.map((sample) => sample[field]);

    assert.ok(
      values.every(Number.isFinite),
      `app-load metric samples must include finite ${field}`,
    );
    result[field] = median(values);
  }

  return result;
}

function findBrowser(explicitPath) {
  return browserExecutablePath({
    errorMessage: "Chrome/Chromium not found; set TRACY_APP_LOAD_BROWSER",
    explicitPath,
  });
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

async function createServer(distDir) {
  return createDistServer(distDir, {
    cacheControl: CACHE_CONTROL.IMMUTABLE,
    gzip: true,
  });
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
            fs.rmSync(userDataDir, {
              force: true,
              maxRetries: 5,
              recursive: true,
              retryDelay: 100,
            });
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

async function readinessPageState(cdp, page, markName) {
  const result = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const markName = ${JSON.stringify(markName)};
      const diagnosticMarkNames = new Set(${JSON.stringify(READINESS_DIAGNOSTIC_MARK_NAMES)});
      const marks = performance.getEntriesByType("mark")
        .filter((entry) => diagnosticMarkNames.has(entry.name))
        .map((entry) => ({
          name: entry.name,
          startTime: entry.startTime,
        }));
      return {
        appLoadError: globalThis.__TRACY_APP_LOAD_ERROR__ ?? "",
        alertText: document.querySelector('[role="alert"]')?.textContent ?? "",
        markName,
        marks,
        page: {
          readyState: document.readyState,
          title: document.title,
          url: location.href,
          visibilityState: document.visibilityState,
        },
        ready: performance.getEntriesByName(markName, "mark").length > 0,
      };
    })()`,
    returnByValue: true,
  }, page.sessionId);

  if (result.exceptionDetails !== undefined) {
    const description =
      result.exceptionDetails.exception?.description ??
      result.exceptionDetails.text ??
      "unknown Runtime.evaluate failure";
    throw new Error(`failed to collect readiness diagnostics: ${description}`);
  }

  return result.result?.value ?? {};
}

function readinessHasAppLoadFailure(state) {
  return Boolean(state.alertText || state.appLoadError);
}

async function waitForReadinessMark(cdp, page, label, markName, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return waitForBrowserReadiness({
    collectState: () => readinessPageState(cdp, page, markName),
    failureReason: (state) =>
      readinessHasAppLoadFailure(state) ? "reported app-load failure" : null,
    isReady: (state) => state.ready === true,
    label,
    timeoutMs,
  });
}

function isBenignLoadingFailure(failure) {
  return BENIGN_LOADING_FAILURES.some(
    (benignFailure) =>
      failure?.canceled === benignFailure.canceled &&
      failure?.errorText === benignFailure.errorText,
  );
}

function unfinishedTransferRequestIds(
  requestIds,
  cachedRequestIds,
  loadingBytes,
  loadingFailures = new Map(),
) {
  return [...requestIds].filter(
    (requestId) =>
      !cachedRequestIds.has(requestId) &&
      !loadingBytes.has(requestId) &&
      !loadingFailures.has(requestId),
  );
}

function coreTransferBytesForRequests(requestIds, cachedRequestIds, loadingBytes) {
  return [...requestIds]
    .filter((requestId) => !cachedRequestIds.has(requestId))
    .reduce((total, requestId) => total + (loadingBytes.get(requestId) ?? 0), 0);
}

function failedCoreRequestReports(requestIds, loadingFailures, requestUrls) {
  return [...requestIds]
    .map((requestId) => {
      const failure = loadingFailures.get(requestId);

      if (failure === undefined || isBenignLoadingFailure(failure)) {
        return null;
      }

      return [
        requestUrls.get(requestId) ?? requestId,
        failure.errorText ?? "unknown loading failure",
      ].join(" ");
    })
    .filter((report) => report !== null);
}

function assertNoFailedCoreRequests(requestIds, loadingFailures, requestUrls) {
  const failures = failedCoreRequestReports(requestIds, loadingFailures, requestUrls);

  if (failures.length > 0) {
    throw new Error(
      `core startup requests failed before app-load transfer accounting completed: ${failures.join(", ")}`,
    );
  }
}

async function waitForAnimationFrames(cdp, page, frameCount) {
  await cdp.send("Runtime.evaluate", {
    awaitPromise: true,
    expression: `new Promise((resolve) => {
      let remainingFrames = ${JSON.stringify(frameCount)};
      const tick = () => {
        remainingFrames -= 1;
        if (remainingFrames <= 0) {
          resolve(true);
        } else {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    })`,
    returnByValue: true,
  }, page.sessionId);
}

async function waitForNetworkStartQuiet(lastRequestStartedAt, quietMs) {
  let quietSince = Date.now();

  await waitUntil(() => {
    const lastStartedAt = lastRequestStartedAt();

    if (lastStartedAt > quietSince) {
      quietSince = lastStartedAt;
    }

    return Date.now() - quietSince >= quietMs;
  });
}

function networkRequestMonotonicWallTimeOffsetMs(event) {
  if (!Number.isFinite(event.wallTime) || !Number.isFinite(event.timestamp)) {
    return null;
  }

  return (event.wallTime * 1000) - (event.timestamp * 1000);
}

function networkRequestStartWallMs(
  event,
  observedWallMs,
  monotonicWallTimeOffsetMs,
) {
  if (Number.isFinite(event.wallTime)) {
    return event.wallTime * 1000;
  }

  if (
    Number.isFinite(event.timestamp) &&
    Number.isFinite(monotonicWallTimeOffsetMs)
  ) {
    return (event.timestamp * 1000) + monotonicWallTimeOffsetMs;
  }

  return observedWallMs;
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

function coreTransferRequestIds(requestIds, requestTypes) {
  return new Set(
    [...requestIds].filter((requestId) => {
      const requestType = requestTypes.get(requestId);

      return requestType === undefined || CORE_TRANSFER_RESOURCE_TYPES.has(requestType);
    }),
  );
}

function navigationFrameRequestIds(requestIds, requestFrameIds, navigationFrameId) {
  if (navigationFrameId === undefined) {
    return new Set(requestIds);
  }

  return new Set(
    [...requestIds].filter(
      (requestId) => requestFrameIds.get(requestId) === navigationFrameId,
    ),
  );
}

function protectedStartupBoundaryViolations(requestIds, requestUrls, protectedPaths) {
  const paths = new Set(protectedPaths);
  const violations = [];

  for (const requestId of requestIds) {
    const requestUrl = requestUrls.get(requestId);
    if (requestUrl === undefined) {
      continue;
    }

    let pathname;
    try {
      pathname = new URL(requestUrl).pathname.replace(/^\//, "");
    } catch {
      pathname = requestUrl.replace(/^\//, "");
    }

    if (paths.has(pathname)) {
      violations.push(pathname);
    }
  }

  return violations;
}

function protectedStartupBoundaryResourceViolations(
  resourceTimings,
  markStartMs,
  protectedPaths,
) {
  const paths = new Set(protectedPaths);
  const violations = [];

  for (const resource of resourceTimings) {
    if (!Number.isFinite(resource.startTime) || resource.startTime > markStartMs) {
      continue;
    }

    if (
      typeof resource.initiatorType === "string" &&
      !PROTECTED_STARTUP_BOUNDARY_RESOURCE_INITIATOR_TYPES.has(resource.initiatorType)
    ) {
      continue;
    }

    let pathname;
    try {
      pathname = new URL(resource.name).pathname.replace(/^\//, "");
    } catch {
      pathname = String(resource.name).replace(/^\//, "");
    }

    if (paths.has(pathname)) {
      violations.push(pathname);
    }
  }

  return violations;
}

function assertNoProtectedStartupBoundaryRequests(requestIds, requestUrls, protectedPaths) {
  const violations = protectedStartupBoundaryViolations(
    requestIds,
    requestUrls,
    protectedPaths,
  );

  if (violations.length > 0) {
    throw new Error(
      `protected startup boundary fetched broad modules before coreReady: ${[
        ...new Set(violations),
      ].join(", ")}`,
    );
  }
}

function assertNoProtectedStartupBoundaryResources(
  resourceTimings,
  markStartMs,
  protectedPaths,
) {
  const violations = protectedStartupBoundaryResourceViolations(
    resourceTimings,
    markStartMs,
    protectedPaths,
  );

  if (violations.length > 0) {
    throw new Error(
      `protected startup boundary fetched broad modules before coreReady: ${[
        ...new Set(violations),
      ].join(", ")}`,
    );
  }
}

async function performanceMarkStartMs(cdp, page, markName) {
  const result = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const marks = performance.getEntriesByName(${JSON.stringify(markName)}, "mark");
      const mark = marks[marks.length - 1];
      return mark?.startTime ?? null;
    })()`,
    returnByValue: true,
  }, page.sessionId);

  const startTimeMs = result.result?.value;

  if (!Number.isFinite(startTimeMs)) {
    throw new Error(`missing performance mark ${markName}`);
  }

  return startTimeMs;
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

async function resourceTimings(cdp, page) {
  const result = await cdp.send("Runtime.evaluate", {
    expression: `performance.getEntriesByType("resource").map((entry) => ({
      initiatorType: entry.initiatorType,
      name: entry.name,
      startTime: entry.startTime,
    }))`,
    returnByValue: true,
  }, page.sessionId);

  return Array.isArray(result.result?.value) ? result.result.value : [];
}

async function ensureStartupResourceTimingBuffer(cdp, page) {
  if (resourceTimingBufferPages.has(page)) {
    return;
  }

  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `performance.setResourceTimingBufferSize?.(${STARTUP_RESOURCE_TIMING_BUFFER_SIZE});`,
  }, page.sessionId);
  resourceTimingBufferPages.add(page);
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
  const requestFrameIds = new Map();
  const requestStartWallMs = new Map();
  const requestTypes = new Map();
  const requestUrls = new Map();
  const cachedRequestIds = new Set();
  const loadingBytes = new Map();
  const loadingFailures = new Map();
  let lastRequestStartedAt = Date.now();
  let monotonicWallTimeOffsetMs = null;
  let coreRequestIds = null;

  const offRequest = cdp.on("Network.requestWillBeSent", (event, sessionId) => {
    if (sessionId !== page.sessionId) {
      return;
    }
    const observedWallMs = Date.now();
    monotonicWallTimeOffsetMs =
      networkRequestMonotonicWallTimeOffsetMs(event) ??
      monotonicWallTimeOffsetMs;
    requestIds.add(event.requestId);
    lastRequestStartedAt = observedWallMs;
    if (event.frameId !== undefined) {
      requestFrameIds.set(event.requestId, event.frameId);
    }
    requestTypes.set(event.requestId, event.type);
    requestUrls.set(event.requestId, event.request.url);
    if (!requestStartWallMs.has(event.requestId)) {
      requestStartWallMs.set(
        event.requestId,
        networkRequestStartWallMs(
          event,
          observedWallMs,
          monotonicWallTimeOffsetMs,
        ),
      );
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
  const offLoadingFailed = cdp.on("Network.loadingFailed", (event, sessionId) => {
    if (sessionId !== page.sessionId) {
      return;
    }
    loadingFailures.set(event.requestId, {
      canceled: event.canceled === true,
      errorText: event.errorText,
    });
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
  await ensureStartupResourceTimingBuffer(cdp, page);

  const loaded = waitForSessionEvent(cdp, page.sessionId, "Page.loadEventFired");
  const navigation = await cdp.send("Page.navigate", { url }, page.sessionId);
  await loaded;
  await waitForReadinessMark(
    cdp,
    page,
    "core readiness",
    PERFORMANCE_MARKS.coreReady,
  );
  const coreReadyWallMs = await performanceMarkWallMs(
    cdp,
    page,
    PERFORMANCE_MARKS.coreReady,
  );
  const coreReadyStartMs = await performanceMarkStartMs(
    cdp,
    page,
    PERFORMANCE_MARKS.coreReady,
  );
  coreRequestIds = navigationFrameRequestIds(
    coreTransferRequestIds(
      requestIdsStartedAtOrBefore(
        requestStartWallMs,
        coreReadyWallMs,
        requestIds,
      ),
      requestTypes,
    ),
    requestFrameIds,
    navigation.frameId,
  );
  await waitForReadinessMark(
    cdp,
    page,
    "app readiness",
    PERFORMANCE_MARKS.appReady,
  );
  await waitUntil(() =>
    unfinishedTransferRequestIds(
      coreRequestIds,
      cachedRequestIds,
      loadingBytes,
      loadingFailures,
    ).length === 0,
  );
  assertNoProtectedStartupBoundaryResources(
    await resourceTimings(cdp, page),
    coreReadyStartMs,
    ["host/wasm-modules.mjs"],
  );
  assertNoFailedCoreRequests(coreRequestIds, loadingFailures, requestUrls);
  const coreTransferBytes = coreTransferBytesForRequests(
    coreRequestIds,
    cachedRequestIds,
    loadingBytes,
  );

  const result = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const shellPaintEntries = performance.getEntriesByName(${JSON.stringify(PERFORMANCE_MARKS.appShellPaint)});
      const shellPaint = shellPaintEntries[0]?.startTime;
      if (shellPaint === undefined) {
        throw new Error("missing shell paint performance entry");
      }
      const coreStart = performance.getEntriesByName(${JSON.stringify(PERFORMANCE_MARKS.coreStart)})[0]?.startTime;
      const coreReady = performance.getEntriesByName(${JSON.stringify(PERFORMANCE_MARKS.coreReady)})[0]?.startTime;
      const appLoad = performance.getEntriesByName(${JSON.stringify(PERFORMANCE_MEASURES.appLoad)})[0]?.duration;
      const wasm = performance.getEntriesByName(${JSON.stringify(PERFORMANCE_MEASURES.wasmInstantiate)})[0]?.duration;
      return {
        coreTtiMs: coreReady - coreStart,
        fullLoadMs: appLoad,
        shellPaintMs: shellPaint,
        wasmInstantiateMs: wasm,
      };
    })()`,
    returnByValue: true,
  }, page.sessionId);
  if (result.exceptionDetails !== undefined) {
    const description =
      result.exceptionDetails.exception?.description ??
      result.exceptionDetails.text ??
      "unknown Runtime.evaluate failure";
    throw new Error(`failed to collect app-load metrics: ${description}`);
  }
  const metrics = result.result.value;

  metrics.transferBytes = coreTransferBytes;

  await waitForAnimationFrames(cdp, page, POST_READY_SETTLE_FRAME_COUNT);
  await waitForNetworkStartQuiet(
    () => lastRequestStartedAt,
    POST_READY_NETWORK_QUIET_MS,
  );

  offRequest();
  offCache();
  offResponse();
  offLoading();
  offLoadingFailed();

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
    const warmSwSamples = [];
    for (let index = 0; index < WARM_NAVIGATION_SAMPLE_COUNT; index += 1) {
      warmSwSamples.push(await navigateAndMeasure(cdp, swPage, url));
    }
    const warmSw = medianMetrics(warmSwSamples);

    const httpPage = await createPage(cdp);
    await navigateAndMeasure(cdp, httpPage, url, { bypassServiceWorker: true });
    const warmHttpSamples = [];
    for (let index = 0; index < WARM_NAVIGATION_SAMPLE_COUNT; index += 1) {
      warmHttpSamples.push(await navigateAndMeasure(cdp, httpPage, url, {
        bypassServiceWorker: true,
      }));
    }
    const warmHttp = medianMetrics(warmHttpSamples);

    assertMeasuredBudget("cold", cold, BUDGETS.cold);
    assertAnyMeasuredBudget("warmSw", warmSwSamples, BUDGETS.warmSw);
    assertAnyMeasuredBudget("warmHttp", warmHttpSamples, BUDGETS.warmHttp);

    console.log(JSON.stringify({
      cold,
      warmHttp,
      warmHttpSamples,
      warmSw,
      warmSwSamples,
    }, null, 2));
  } finally {
    cdp.close();
    await browser.close();
    await server.close();
  }
}

async function runSelfTest() {
  assert.deepEqual(FAST_3G, {
    downloadThroughput: RUNTIME_SPEC.appLoadBench.fast3g.downloadThroughputBytesPerSecond,
    latency: RUNTIME_SPEC.appLoadBench.fast3g.latencyMs,
    uploadThroughput: RUNTIME_SPEC.appLoadBench.fast3g.uploadThroughputBytesPerSecond,
  });
  assert.equal(
    STARTUP_RESOURCE_TIMING_BUFFER_SIZE,
    RUNTIME_SPEC.appLoadBench.startupResourceTimingBufferSize,
  );
  assert.deepEqual(BUDGETS, RUNTIME_SPEC.appLoadBench.budgets);
  assert.doesNotThrow(() =>
    assertMeasuredBudget("fixture", {
      coreTtiMs: 1,
      fullLoadMs: 2,
      shellPaintMs: 1,
      transferBytes: 0,
      wasmInstantiateMs: 3,
    }, {
      coreTtiMs: 1,
      fullLoadMs: 2,
      shellPaintMs: 1,
      transferBytes: 0,
      wasmInstantiateMs: 3,
    }),
  );
  assert.throws(
    () => assertMeasuredBudget("fixture", { shellPaintMs: 2 }, { shellPaintMs: 1 }),
    /fixture shellPaintMs 2.0 > 1/,
  );
  const splitWarmBudget = {
    coreTtiMs: 10,
    fullLoadMs: 10,
    shellPaintMs: 10,
  };
  const splitWarmSamples = [
    { coreTtiMs: 20, fullLoadMs: 5, shellPaintMs: 5 },
    { coreTtiMs: 5, fullLoadMs: 20, shellPaintMs: 5 },
    { coreTtiMs: 5, fullLoadMs: 5, shellPaintMs: 20 },
  ];
  const splitWarmMedian = medianMetrics(splitWarmSamples);

  assert.deepEqual(splitWarmMedian, {
    coreTtiMs: 5,
    fullLoadMs: 5,
    shellPaintMs: 5,
  });
  assert.doesNotThrow(() =>
    assertMeasuredBudget("splitWarmMedian", splitWarmMedian, splitWarmBudget),
  );
  assert.throws(
    () => assertAnyMeasuredBudget("splitWarm", splitWarmSamples, splitWarmBudget),
    /splitWarm no warm navigation sample satisfied all budget fields; sample 1: coreTtiMs 20.0 > 10; sample 2: fullLoadMs 20.0 > 10; sample 3: shellPaintMs 20.0 > 10/,
  );
  assert.doesNotThrow(() =>
    assertAnyMeasuredBudget("splitWarm", [
      ...splitWarmSamples,
      { coreTtiMs: 10, fullLoadMs: 10, shellPaintMs: 10 },
    ], splitWarmBudget),
  );
  assert.deepEqual(
    medianMetrics([
      { shellPaintMs: 53, fullLoadMs: 21, transferBytes: 0 },
      { shellPaintMs: 42, fullLoadMs: 27, transferBytes: 0 },
      { shellPaintMs: 45, fullLoadMs: 24, transferBytes: 0 },
    ]),
    { shellPaintMs: 45, fullLoadMs: 24, transferBytes: 0 },
  );
  assert.throws(
    () => medianMetrics([{ shellPaintMs: Number.NaN }]),
    /app-load metric samples must include finite shellPaintMs/,
  );
  const transferRequestIds = new Set(["bootstrap", "renderer", "cached"]);
  const cachedTransferRequestIds = new Set(["cached"]);
  const loadingTransferBytes = new Map([["bootstrap", 12]]);
  const failedTransferRequests = new Map();
  assert.deepEqual(
    unfinishedTransferRequestIds(
      transferRequestIds,
      cachedTransferRequestIds,
      loadingTransferBytes,
      failedTransferRequests,
    ),
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
  failedTransferRequests.set("renderer", {
    canceled: false,
    errorText: "net::ERR_FAILED",
  });
  assert.deepEqual(
    unfinishedTransferRequestIds(
      transferRequestIds,
      cachedTransferRequestIds,
      loadingTransferBytes,
      failedTransferRequests,
    ),
    [],
  );
  assert.throws(
    () =>
      assertNoFailedCoreRequests(
        transferRequestIds,
        failedTransferRequests,
        new Map([["renderer", "http://127.0.0.1/bootstrap.mjs"]]),
      ),
    /core startup requests failed before app-load transfer accounting completed: http:\/\/127\.0\.0\.1\/bootstrap\.mjs net::ERR_FAILED/,
  );
  failedTransferRequests.set("renderer", {
    canceled: true,
    errorText: "net::ERR_ABORTED",
  });
  assert.doesNotThrow(() =>
    assertNoFailedCoreRequests(
      transferRequestIds,
      failedTransferRequests,
      new Map([["renderer", "http://127.0.0.1/bootstrap.mjs"]]),
    ),
  );
  failedTransferRequests.clear();
  loadingTransferBytes.set("renderer", 34);
  assert.deepEqual(
    unfinishedTransferRequestIds(
      transferRequestIds,
      cachedTransferRequestIds,
      loadingTransferBytes,
      failedTransferRequests,
    ),
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
  assert.equal(
    networkRequestMonotonicWallTimeOffsetMs({
      timestamp: 10,
      wallTime: 100,
    }),
    90000,
  );
  assert.equal(
    networkRequestMonotonicWallTimeOffsetMs({ timestamp: 10 }),
    null,
  );
  assert.equal(
    networkRequestStartWallMs(
      { timestamp: 10, wallTime: 100 },
      123000,
      90000,
    ),
    100000,
  );
  assert.equal(
    networkRequestStartWallMs({ timestamp: 11 }, 123000, 90000),
    101000,
  );
  assert.equal(
    networkRequestStartWallMs({ timestamp: 11 }, 123000, null),
    123000,
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
  assert.deepEqual(
    coreTransferRequestIds(
      new Set(["document", "bootstrap", "favicon", "untyped"]),
      new Map([
        ["document", "Document"],
        ["bootstrap", "Script"],
        ["favicon", "Other"],
      ]),
    ),
    new Set(["document", "bootstrap", "untyped"]),
  );
  assert.deepEqual(
    navigationFrameRequestIds(
      new Set(["document", "bootstrap", "service-worker-cache"]),
      new Map([
        ["document", "main-frame"],
        ["bootstrap", "main-frame"],
        ["service-worker-cache", "worker-frame"],
      ]),
      "main-frame",
    ),
    new Set(["document", "bootstrap"]),
  );
  assert.deepEqual(
    navigationFrameRequestIds(new Set(["document"]), new Map(), undefined),
    new Set(["document"]),
  );
  const requestUrls = new Map([
    ["bootstrap", "http://127.0.0.1/bootstrap.mjs"],
    ["wasm-graph", "http://127.0.0.1/host/wasm-modules.mjs"],
  ]);
  assert.deepEqual(
    protectedStartupBoundaryViolations(
      new Set(["bootstrap", "wasm-graph"]),
      requestUrls,
      ["host/wasm-modules.mjs"],
    ),
    ["host/wasm-modules.mjs"],
  );
  assert.doesNotThrow(() =>
    assertNoProtectedStartupBoundaryRequests(
      new Set(["bootstrap"]),
      requestUrls,
      ["host/wasm-modules.mjs"],
    ),
  );
  assert.throws(
    () =>
      assertNoProtectedStartupBoundaryRequests(
        new Set(["wasm-graph"]),
        requestUrls,
        ["host/wasm-modules.mjs"],
      ),
    /protected startup boundary fetched broad modules before coreReady: host\/wasm-modules\.mjs/,
  );
  const {
    beforeCoreReadyStartMs,
    coreReadyStartMs,
    resourceAfterCoreReadyStartMs,
    resourceTimingsBeforeCoreReady,
    runtimeBeforeCoreReadyStartMs,
    scriptAfterCoreReadyStartMs,
  } = STARTUP_BOUNDARY_SELF_TEST;
  assert.deepEqual(
    resourceTimingsBeforeCoreReady,
    RUNTIME_SPEC.appLoadBench.startupBoundary.selfTest.resourceTimingsBeforeCoreReady,
  );
  assert.equal(
    resourceTimingsBeforeCoreReady.find((resource) =>
      resource.name.endsWith("/host/wasm-modules.mjs"),
    )?.startTime,
    beforeCoreReadyStartMs,
  );
  assert.equal(
    resourceTimingsBeforeCoreReady.find((resource) =>
      resource.name.endsWith("/host/runtime.mjs"),
    )?.startTime,
    runtimeBeforeCoreReadyStartMs,
  );
  assert.deepEqual(
    protectedStartupBoundaryResourceViolations(
      resourceTimingsBeforeCoreReady,
      coreReadyStartMs,
      ["host/wasm-modules.mjs"],
    ),
    ["host/wasm-modules.mjs"],
  );
  assert.deepEqual(
    protectedStartupBoundaryResourceViolations(
      [
        {
          initiatorType: "fetch",
          name: "host/wasm-modules.mjs",
          startTime: beforeCoreReadyStartMs,
        },
        {
          initiatorType: "xmlhttprequest",
          name: "host/wasm-modules.mjs",
          startTime: beforeCoreReadyStartMs,
        },
        {
          initiatorType: "link",
          name: "host/wasm-modules.mjs",
          startTime: beforeCoreReadyStartMs,
        },
        {
          initiatorType: "script",
          name: "http://127.0.0.1/host/wasm-modules.mjs",
          startTime: scriptAfterCoreReadyStartMs,
        },
      ],
      coreReadyStartMs,
      ["host/wasm-modules.mjs"],
    ),
    [
      "host/wasm-modules.mjs",
      "host/wasm-modules.mjs",
      "host/wasm-modules.mjs",
    ],
  );
  for (const initiatorType of ["fetch", "xmlhttprequest"]) {
    assert.throws(
      () =>
        assertNoProtectedStartupBoundaryResources(
          [
            {
              initiatorType,
              name: "host/wasm-modules.mjs",
              startTime: beforeCoreReadyStartMs,
            },
          ],
          coreReadyStartMs,
          ["host/wasm-modules.mjs"],
        ),
      /protected startup boundary fetched broad modules before coreReady: host\/wasm-modules\.mjs/,
    );
  }
  assert.doesNotThrow(() =>
    assertNoProtectedStartupBoundaryResources(
      [
        {
          initiatorType: "script",
          name: "http://127.0.0.1/host/wasm-modules.mjs",
          startTime: coreReadyStartMs + (CORE_READY_REQUEST_EPSILON_MS / 2),
        },
      ],
      coreReadyStartMs,
      ["host/wasm-modules.mjs"],
    ),
  );
  assert.doesNotThrow(() =>
    assertNoProtectedStartupBoundaryResources(
      [
        {
          name: "http://127.0.0.1/host/wasm-modules.mjs",
          startTime: resourceAfterCoreReadyStartMs,
        },
      ],
      coreReadyStartMs,
      ["host/wasm-modules.mjs"],
    ),
  );
  assert.throws(
    () =>
      assertNoProtectedStartupBoundaryResources(
        resourceTimingsBeforeCoreReady,
        coreReadyStartMs,
        ["host/wasm-modules.mjs"],
      ),
    /protected startup boundary fetched broad modules before coreReady: host\/wasm-modules\.mjs/,
  );
  const bufferPage = { sessionId: "buffer-session" };
  const bufferCalls = [];
  const bufferCdp = {
    async send(method, params, sessionId) {
      bufferCalls.push({ method, params, sessionId });
      return {};
    },
  };
  await ensureStartupResourceTimingBuffer(bufferCdp, bufferPage);
  await ensureStartupResourceTimingBuffer(bufferCdp, bufferPage);
  assert.deepEqual(bufferCalls, [
    {
      method: "Page.addScriptToEvaluateOnNewDocument",
      params: {
        source: `performance.setResourceTimingBufferSize?.(${STARTUP_RESOURCE_TIMING_BUFFER_SIZE});`,
      },
      sessionId: bufferPage.sessionId,
    },
  ]);
  const readinessPage = { sessionId: "readiness-session" };
  const readyState = {
    alertText: "",
    appLoadError: "",
    markName: PERFORMANCE_MARKS.coreReady,
    marks: [{ name: PERFORMANCE_MARKS.coreStart, startTime: 1 }],
    page: {
      readyState: "complete",
      title: "tracy",
      url: "http://127.0.0.1/",
      visibilityState: "visible",
    },
    ready: true,
  };
  const readyCdp = {
    async send(method, params, sessionId) {
      assert.equal(method, "Runtime.evaluate");
      assert.equal(params.returnByValue, true);
      assert.equal(sessionId, readinessPage.sessionId);
      return { result: { value: readyState } };
    },
  };
  assert.equal(
    await waitForReadinessMark(
      readyCdp,
      readinessPage,
      "core readiness",
      PERFORMANCE_MARKS.coreReady,
      1,
    ),
    readyState,
  );
  const appLoadFailureState = {
    ...readyState,
    appLoadError: "deferred renderer unavailable",
    page: { ...readyState.page, readyState: "interactive" },
    ready: false,
  };
  const failedCdp = {
    async send() {
      return { result: { value: appLoadFailureState } };
    },
  };
  await assert.rejects(
    () =>
      waitForReadinessMark(
        failedCdp,
        readinessPage,
        "core readiness",
        PERFORMANCE_MARKS.coreReady,
        1,
      ),
    /core readiness reported app-load failure; readiness diagnostics=.*"appLoadError":"deferred renderer unavailable".*"marks":.*"tracy\.core\.start".*"page":.*"readyState":"interactive"/,
  );
  const timedOutState = {
    ...readyState,
    markName: PERFORMANCE_MARKS.appReady,
    ready: false,
  };
  const timedOutCdp = {
    async send() {
      return { result: { value: timedOutState } };
    },
  };
  await assert.rejects(
    () =>
      waitForReadinessMark(
        timedOutCdp,
        readinessPage,
        "app readiness",
        PERFORMANCE_MARKS.appReady,
        0,
      ),
    /app readiness timed out; readiness diagnostics=.*"markName":"tracy\.app\.ready".*"page":/,
  );
  const staticServerSource = createServer.toString();
  assert.match(staticServerSource, /createDistServer\(distDir/);
  assert.match(staticServerSource, /cacheControl: CACHE_CONTROL\.IMMUTABLE/);
  assert.match(staticServerSource, /gzip: true/);

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
    fs.rmSync(tmpDist, {
      force: true,
      maxRetries: 5,
      recursive: true,
      retryDelay: 100,
    });
  }

  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8"));
  const runtimeSpecJson = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, "abi", "runtime.json"), "utf8"),
  );
  const paletteSpecJson = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, "abi", "palette.json"), "utf8"),
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
  const bootstrapShellPaintOffset = bootstrap.indexOf("performance?.mark?.(PERFORMANCE_MARKS.appShellPaint)");
  const bootstrapFirstFramePromiseOffset = bootstrap.indexOf("const firstFramePromise");
  const bootstrapCoreReadyPromiseOffset = bootstrap.indexOf("const coreReadyPromise");
  const bootstrapWasmModuleImportOffset = bootstrap.indexOf("const importWasmModules");
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
  assert.notEqual(bootstrapShellPaintOffset, -1);
  assert.notEqual(bootstrapFirstFramePromiseOffset, -1);
  assert.notEqual(bootstrapCoreReadyPromiseOffset, -1);
  assert.notEqual(bootstrapWasmModuleImportOffset, -1);
  assert.doesNotMatch(bootstrap, /markPerformance\(PERFORMANCE_MARKS\.coreReady/);
  assert.doesNotMatch(bootstrap, /performance\??\.mark\??\.\(PERFORMANCE_MARKS\.coreReady/);
  assert.ok(
    bootstrapStartOffset < bootstrapShellPaintOffset,
    "bootstrap should mark app shell paint after startup begins",
  );
  assert.ok(
    bootstrapStartOffset < bootstrapFirstFramePromiseOffset &&
      bootstrapFirstFramePromiseOffset < bootstrapRuntimeImportOffset,
    "bootstrap should start waiting for the first animation frame before module startup waits",
  );
  assert.notEqual(bootstrapRendererPreloadOffset, -1);
  assert.notEqual(bootstrapRuntimeImportOffset, -1);
  assert.ok(
    bootstrapCoreReadyPromiseOffset < bootstrapWasmModuleImportOffset,
    "bootstrap should prepare the core-ready gate before broad wasm graph imports can run",
  );
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
  assert.ok(firstFramePromiseOffset < runtimeWasmStartOffset);
  assert.ok(firstFramePromiseOffset < appReadyOffset);
  assert.ok(runtimeCoreReadyOffset < appReadyOffset);
  assert.match(
    runtime,
    /const deferredRendererReadyPromise =[\s\S]+loadProgressiveTraceRendererModule\(\)/,
  );
  assert.match(
    runtime,
    /const firstFramePromise =[\s\S]+options\.firstFramePromise[\s\S]+\?\?/,
  );
  assert.match(
    runtime,
    /const appReadyPromise = Promise\.all\(\[[\s\S]+firstFramePromise,[\s\S]+deferredRendererReadyPromise,[\s\S]+\]\)\.then/,
  );
  assert.match(
    runtime,
    /appReadyPromise[\s\S]+then\(afterAppReadyFrame\)[\s\S]+ingestWorker\?\.indexReader\?\.preload/,
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
  assert.match(
    traceRendererSpec,
    /Generated from abi\/runtime\.json, abi\/layout\.json, and abi\/palette\.json/,
  );
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
  assert.match(
    bootstrap,
    /const importProgressiveTraceRenderer = \(\) =>\s+warmProgressiveTraceRendererPromise \?\?\s+import/,
  );
  assert.doesNotMatch(bootstrap, /afterProtectedStartupBoundary/);
  assert.doesNotMatch(bootstrap, /new MessageChannel\(\)/);
  assert.doesNotMatch(bootstrap, /setTimeout\(resolve/);
  assert.match(bootstrap, /const appReady = \(\) => new Promise/);
  assert.match(bootstrap, /PERFORMANCE_MARKS\.appReady/);
  assert.match(bootstrap, /globalThis\.addEventListener\?\.\(PERFORMANCE_MARKS\.appReady, resolve, \{ once: true \}\)/);
  assert.match(bootstrap, /const pageLoaded = \(\) => new Promise/);
  assert.match(bootstrap, /Promise\.all\(\[appReady\(\), pageLoaded\(\)\]\)\.then\(registerServiceWorker\)/);
  assert.doesNotMatch(bootstrap, /registerAfterReady/);
  assert.doesNotMatch(bootstrap, /SERVICE_WORKER_READY_/);
  assert.doesNotMatch(bootstrap, /setTimeout/);
  assert.doesNotMatch(bootstrap, /setTimeout\(register/);
  assert.doesNotMatch(startupSpec, /BOOTSTRAP_TIMING/);
  assert.match(bootstrap, /const coreReadyPromise = new Promise/);
  assert.match(bootstrap, /PERFORMANCE_MARKS\.coreReady/);
  assert.match(
    bootstrap,
    /globalThis\.addEventListener\(PERFORMANCE_MARKS\.coreReady, resolve, \{ once: true \}\)/,
  );
  assert.match(
    bootstrap,
    /const postCoreReadyFramePromise = coreReadyPromise\.then\(\(\) => new Promise\(\(resolve\) => requestAnimationFrame\(resolve\)\)\)/,
  );
  assert.match(runtime, /globalThis\.dispatchEvent\?\.\(new Event\(PERFORMANCE_MARKS\.coreReady\)\)/);
  assert.match(runtime, /globalThis\.dispatchEvent\?\.\(new Event\(PERFORMANCE_MARKS\.appReady\)\)/);
  assert.doesNotMatch(bootstrap, /const wasmModulesPromise = import\("\.\/host\/wasm-modules\.mjs"\)/);
  assert.doesNotMatch(bootstrap, /import\("\.\/host\/wasm-modules\.mjs"\)/);
  assert.doesNotMatch(runtime, /import\("\.\/wasm-modules\.mjs"\)/);
  assert.match(runtime, /import\(RUNTIME_URLS\.WASM_MODULES_URL\)/);
  assert.match(
    runtime,
    /import\(RUNTIME_URLS\.WASM_MODULES_URL\)\.catch\(\(error\) => \{[\s\S]+defaultWasmModulesPromise = null;[\s\S]+throw error;/,
  );
  assert.match(
    bootstrap,
    /id !== "app" \|\| thread !== "main"[\s\S]+app\.wasm/,
  );
  assert.match(
    bootstrap,
    /const importWasmModules = async \(\) =>/,
  );
  assert.match(
    bootstrap,
    /await postCoreReadyFramePromise/,
  );
  assert.match(
    bootstrap,
    /const wasmModulesUrl = `\.\/host\/\$\{RUNTIME_URLS\.WASM_MODULES_URL\.replace/,
  );
  assert.match(
    bootstrap,
    /return import\(wasmModulesUrl\)/,
  );
  assert.match(
    bootstrap,
    /await importWasmModules\(\)/,
  );
  assert.match(
    bootstrap,
    /importProgressiveTraceRenderer,/,
  );
  assert.match(
    bootstrap,
    /firstFramePromise,/,
  );
  assert.match(
    bootstrap,
    /instantiateWasmModuleForThread/,
  );
  assert.match(
    bootstrap,
    /const mainAppWasmPromise = instantiateWasmModuleForThread\("app", "main"/,
  );
  assert.ok(
    bootstrap.indexOf("const mainAppWasmPromise = instantiateWasmModuleForThread") <
      bootstrap.indexOf("const { runApp } = await runtimeModulePromise"),
    "bootstrap should start app wasm instantiation before waiting for runtime.mjs",
  );
  assert.match(
    bootstrap,
    /instantiateWasmModuleForThread: instantiateWasmModuleWithPreloadedApp/,
  );
  assert.doesNotMatch(bootstrap, /progressive-trace-renderer-loader/);
  assert.doesNotMatch(bootstrap, /startup-palette\.mjs/);
  assert.match(startupSpec, /APP_SHELL_COLORS/);
  assert.match(startupSpec, /APP_LOAD_BENCH_STARTUP/);
  assert.match(startupSpec, /startupBoundary/);
  assert.match(startupSpec, /coreReadyRequestEpsilonMs/);
  assert.doesNotMatch(startupSpec, /TRACE_RENDERER_COLORS/);
  assert.match(traceRendererSpec, /TRACE_RENDERER_COLORS/);
  assert.doesNotMatch(traceRendererSpec, /APP_SHELL_COLORS/);
  for (const group of Object.values(paletteSpecJson.palettes.default)) {
    for (const [name, entry] of Object.entries(group)) {
      const colorPattern = new RegExp(
        `${name}: ${escapeRegExp(JSON.stringify(entry.value))}`,
      );

      if (entry.scope === "init") {
        assert.match(startupSpec, colorPattern);
      } else if (entry.scope === "full") {
        assert.doesNotMatch(startupSpec, colorPattern);
        assert.match(traceRendererSpec, colorPattern);
      } else {
        assert.fail(`${name} should declare palette scope init or full`);
      }
    }
  }
  assert.match(bootstrap, /BOOTSTRAP_WASM_MEMORY\.BOOTSTRAP_MEMORY_INITIAL_PAGES/);
  const navigateAndMeasureSource = navigateAndMeasure.toString();
  assert.match(
    navigateAndMeasureSource,
    /waitForReadinessMark\([\s\S]+PERFORMANCE_MARKS\.coreReady/,
  );
  assert.match(
    navigateAndMeasureSource,
    /waitForReadinessMark\([\s\S]+PERFORMANCE_MARKS\.appReady/,
  );
  assert.match(
    waitForReadinessMark.toString(),
    /waitForBrowserReadiness\(\{/,
  );
  assert.match(
    waitForReadinessMark.toString(),
    /collectState: \(\) => readinessPageState\(cdp, page, markName\)/,
  );
  assert.match(
    waitForBrowserReadiness.toString(),
    /readinessFailureMessage\(label, "timed out", state\)/,
  );
  assert.equal(
    readinessFailureMessage("app readiness", "timed out", timedOutState),
    `app readiness timed out; readiness diagnostics=${JSON.stringify(timedOutState)}`,
  );
  assert.match(
    readinessPageState.toString(),
    /__TRACY_APP_LOAD_ERROR__/,
  );
  assert.match(
    readinessPageState.toString(),
    /performance\.getEntriesByType\("mark"\)/,
  );
  assert.match(
    readinessPageState.toString(),
    /readyState: document\.readyState/,
  );
  assert.doesNotMatch(readinessPageState.toString(), /workerMessages|__TRACY_BROWSER_INGEST__/);
  assert.match(
    navigateAndMeasureSource,
    /performanceMarkWallMs\([\s\S]+PERFORMANCE_MARKS\.coreReady/,
  );
  assert.match(
    navigateAndMeasureSource,
    /performanceMarkStartMs\([\s\S]+PERFORMANCE_MARKS\.coreReady/,
  );
  assert.match(
    navigateAndMeasureSource,
    /networkRequestMonotonicWallTimeOffsetMs\(event\)/,
  );
  assert.match(
    navigateAndMeasureSource,
    /networkRequestStartWallMs\([\s\S]+event,[\s\S]+observedWallMs,[\s\S]+monotonicWallTimeOffsetMs/,
  );
  assert.match(
    navigateAndMeasureSource,
    /navigationFrameRequestIds\([\s\S]+coreTransferRequestIds\([\s\S]+requestIdsStartedAtOrBefore\([\s\S]+requestStartWallMs,[\s\S]+coreReadyWallMs,[\s\S]+requestIds,[\s\S]+requestTypes,[\s\S]+requestFrameIds,[\s\S]+navigation\.frameId/,
  );
  assert.match(
    navigateAndMeasureSource,
    /requestFrameIds\.set\(event\.requestId, event\.frameId\)/,
  );
  assert.match(
    navigateAndMeasureSource,
    /ensureStartupResourceTimingBuffer\(cdp, page\)/,
  );
  assert.match(
    ensureStartupResourceTimingBuffer.toString(),
    /Page\.addScriptToEvaluateOnNewDocument[\s\S]+setResourceTimingBufferSize/,
  );
  assert.ok(
    navigateAndMeasureSource.indexOf("await ensureStartupResourceTimingBuffer(cdp, page)") <
      navigateAndMeasureSource.indexOf('const navigation = await cdp.send("Page.navigate"'),
    "startup resource timing buffer should be configured before navigation",
  );
  assert.match(
    navigateAndMeasureSource,
    /const navigation = await cdp\.send\("Page\.navigate"/,
  );
  assert.match(
    navigateAndMeasureSource,
    /requestTypes\.set\(event\.requestId, event\.type\)/,
  );
  assert.match(
    navigateAndMeasureSource,
    /requestUrls\.set\(event\.requestId, event\.request\.url\)/,
  );
  assert.match(
    navigateAndMeasureSource,
    /assertNoProtectedStartupBoundaryResources\([\s\S]+await resourceTimings\(cdp, page\),[\s\S]+coreReadyStartMs,[\s\S]+\["host\/wasm-modules\.mjs"\]/,
  );
  assert.match(
    navigateAndMeasureSource,
    /unfinishedTransferRequestIds\([\s\S]+coreRequestIds,[\s\S]+cachedRequestIds,[\s\S]+loadingBytes,[\s\S]+loadingFailures/,
  );
  assert.ok(
    navigateAndMeasureSource.indexOf("await waitUntil(() =>") <
      navigateAndMeasureSource.indexOf("assertNoProtectedStartupBoundaryResources"),
    "startup boundary resource assertion should run after core transfers finish",
  );
  assert.match(
    navigateAndMeasureSource,
    /Network\.loadingFailed/,
  );
  assert.match(
    navigateAndMeasureSource,
    /loadingFailures\.set\(event\.requestId/,
  );
  assert.match(
    navigateAndMeasureSource,
    /assertNoFailedCoreRequests\(coreRequestIds, loadingFailures, requestUrls\)/,
  );
  assert.match(
    navigateAndMeasureSource,
    /coreTransferBytesForRequests\([\s\S]+coreRequestIds,[\s\S]+cachedRequestIds,[\s\S]+loadingBytes/,
  );
  assert.match(
    navigateAndMeasureSource,
    /metrics\.transferBytes = coreTransferBytes/,
  );
  assert.match(
    navigateAndMeasureSource,
    /performance\.getEntriesByName\(\$\{JSON\.stringify\(PERFORMANCE_MARKS\.appShellPaint\)\}\)/,
  );
  assert.match(
    navigateAndMeasureSource,
    /shellPaintEntries\[0\]\?\.startTime/,
  );
  assert.match(
    navigateAndMeasureSource,
    /shellPaintMs: shellPaint/,
  );
  assert.doesNotMatch(navigateAndMeasureSource, /first-contentful-paint/);
  assert.doesNotMatch(navigateAndMeasureSource, /fcpMs:/);
  assert.doesNotMatch(
    navigateAndMeasureSource,
    /fcpMs: fcp\?\.startTime \?\? shellPaint/,
  );
  assert.doesNotMatch(navigateAndMeasureSource, /fullReady:/);
  assert.match(
    indexHtml,
    /<link rel="modulepreload" href="bootstrap\.mjs">/,
  );
  assert.match(
    indexHtml,
    /<link rel="preload" href="wasm\/app\.wasm" as="fetch" type="application\/wasm" crossorigin>/,
  );
  assert.match(
    indexHtml,
    /performance\?\.mark\?\.\("tracy\.app\.shell\.paint"\)/,
  );
  assert.ok(
    indexHtml.indexOf('performance?.mark?.("tracy.app.shell.paint")') <
      indexHtml.indexOf('<script type="module" src="bootstrap.mjs">'),
    "index shell-paint mark should run before bootstrap module loading",
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
    /dist\/precache-manifest\.js: \$\(PRECACHE_DIST_FILES\) tools\/generate-precache-manifest\.js/,
  );
  assert.match(
    makefile,
    /dist\/build-info\.js: \$\(APP_RUNTIME_DIST_FILES\)/,
  );
  assert.match(makefile, /PRODUCTION_WASM_FILES := \$\(filter-out %\.test\.wasm,\$\(WASM_FILES\)\)/);
  assert.match(makefile, /APP_RUNTIME_DIST_FILES :=[\s\S]+\$\(PRODUCTION_WASM_FILES\)/);
  assert.match(makefile, /PRECACHE_DIST_FILES :=[\s\S]+\$\(APP_RUNTIME_DIST_FILES\)/);
  assert.match(makefile, /find \. -type f[\s\S]+! -name '\*\.test\.wasm'/);
  assert.match(makefile, /node tools\/app-load-bench\.js --self-test/);
  assert.match(makefile, /node tools\/generate-runtime-spec\.js --check/);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.selfTest) {
    await runSelfTest();
  } else {
    await runBench(options);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
