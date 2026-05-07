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
const DEFAULT_TIMEOUT_MS = 15000;
const FAST_3G = Object.freeze({
  downloadThroughput: Math.floor((1.6 * 1024 * 1024) / 8),
  latency: 150,
  uploadThroughput: Math.floor((750 * 1024) / 8),
});
const BUDGETS = Object.freeze({
  cold: Object.freeze({
    fcpMs: 1000,
    transferBytes: 200000,
    ttiMs: 1500,
    wasmInstantiateMs: 300,
  }),
  warmHttp: Object.freeze({
    fcpMs: 200,
    transferBytes: 0,
    ttiMs: 300,
    wasmInstantiateMs: 80,
  }),
  warmSw: Object.freeze({
    fcpMs: 50,
    transferBytes: 0,
    ttiMs: 100,
    wasmInstantiateMs: 30,
  }),
});
const MIME_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
  ".webmanifest": "application/manifest+json",
});

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
  const server = http.createServer((request, response) => {
    const file = resolveDistPath(distDir, request.url);

    if (file === null || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404);
      response.end("not found");
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": contentType(file),
    });
    fs.createReadStream(file).pipe(response);
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
    "--js-flags=--experimental-wasm-jspi",
    "--remote-debugging-port=0",
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], {
    stdio: ["ignore", "ignore", "pipe"],
  });

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
        resolve({
          close() {
            child.kill();
            fs.rmSync(userDataDir, { recursive: true, force: true });
          },
          webSocketUrl: match[1],
        });
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`browser exited before DevTools endpoint: ${code}`));
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

async function createPage(cdp) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", {
    flatten: true,
    targetId,
  });

  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Network.enable", {}, sessionId);
  await cdp.send("Performance.enable", {}, sessionId);

  return { sessionId, targetId };
}

async function navigateAndMeasure(cdp, page, url, options = {}) {
  const requestIds = new Set();
  const cachedRequestIds = new Set();
  const loadingBytes = new Map();

  const offRequest = cdp.on("Network.requestWillBeSent", (event, sessionId) => {
    if (sessionId !== page.sessionId) {
      return;
    }
    requestIds.add(event.requestId);
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
      expression: "performance.getEntriesByName('tracy.app.ready').length > 0",
      returnByValue: true,
    }, page.sessionId);

    return result.result?.value === true;
  });

  const result = await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
      const appLoad = performance.getEntriesByName("tracy.app.load")[0]?.duration;
      const wasm = performance.getEntriesByName("tracy.wasm.instantiate")[0]?.duration;
      return { fcpMs: fcp, ttiMs: appLoad, wasmInstantiateMs: wasm };
    })()`,
    returnByValue: true,
  }, page.sessionId);
  const metrics = result.result.value;

  metrics.transferBytes = [...loadingBytes]
    .filter(([requestId]) => requestIds.has(requestId) && !cachedRequestIds.has(requestId))
    .reduce((total, [, bytes]) => total + bytes, 0);

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
    browser.close();
    await server.close();
  }
}

function runSelfTest() {
  assert.doesNotThrow(() =>
    assertMeasuredBudget("fixture", {
      fcpMs: 1,
      transferBytes: 0,
      ttiMs: 2,
      wasmInstantiateMs: 3,
    }, {
      fcpMs: 1,
      transferBytes: 0,
      ttiMs: 2,
      wasmInstantiateMs: 3,
    }),
  );
  assert.throws(
    () => assertMeasuredBudget("fixture", { fcpMs: 2 }, { fcpMs: 1 }),
    /fixture fcpMs 2.0 > 1/,
  );

  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8"));
  const makefile = fs.readFileSync(path.join(ROOT_DIR, "Makefile"), "utf8");

  assert.equal(packageJson.scripts["bench:app-load"], "node tools/app-load-bench.js");
  assert.equal(packageJson.scripts["test:app-load-bench"], "node tools/app-load-bench.js --self-test");
  assert.match(makefile, /app-load-bench: dist tools\/app-load-bench\.js/);
  assert.match(makefile, /node tools\/app-load-bench\.js --self-test/);
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
