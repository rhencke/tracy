"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");

const CACHE_CONTROL = Object.freeze({
  IMMUTABLE: "public, max-age=31536000, immutable",
  NO_STORE: "no-store",
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
const GZIP_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".json",
  ".mjs",
  ".svg",
  ".wasm",
  ".webmanifest",
]);
const CHROME_COMMANDS = Object.freeze([
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
]);
const SHARED_BROWSER_ENV = Object.freeze([
  "PUPPETEER_EXECUTABLE_PATH",
  "CHROME_PATH",
]);
const DEFAULT_BROWSER_READINESS_POLL_INTERVAL_MS = 25;

function contentType(file, mimeTypes = MIME_TYPES) {
  return mimeTypes[path.extname(file)] ?? "application/octet-stream";
}

function acceptsGzip(request) {
  return /\bgzip\b/.test(request.headers["accept-encoding"] ?? "");
}

function shouldGzip(file, gzipExtensions = GZIP_EXTENSIONS) {
  return gzipExtensions.has(path.extname(file));
}

function hasUnsafeDotSegment(requestUrl) {
  const pathname = String(requestUrl).split(/[?#]/, 1)[0];

  for (const segment of pathname.split("/")) {
    try {
      if (decodeURIComponent(segment) === "..") {
        return true;
      }
    } catch {
      return true;
    }
  }

  return false;
}

function resolveDistPath(distDir, requestUrl) {
  if (hasUnsafeDotSegment(requestUrl)) {
    return null;
  }

  let url;
  try {
    url = new URL(requestUrl, "http://127.0.0.1");
  } catch {
    return null;
  }

  let relativePath;
  try {
    relativePath =
      url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.replace(/^\//, ""));
  } catch {
    return null;
  }

  const root = path.resolve(distDir);
  const file = path.resolve(root, relativePath);

  return file === root || file.startsWith(`${root}${path.sep}`) ? file : null;
}

function sendNotFound(response) {
  response.writeHead(404);
  response.end("not found");
}

function destroyResponse(response, error) {
  response.destroy(error);
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server.address().port;
}

async function serveFile(request, response, file, options) {
  let stat;
  try {
    stat = await options.fsPromises.stat(file);
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

  try {
    const source = await options.fsPromises.readFile(file);
    const body =
      options.gzip && acceptsGzip(request) && shouldGzip(file, options.gzipExtensions)
        ? options.gzipSync(source)
        : source;
    const headers = {
      "Content-Length": body.byteLength,
      "Content-Type": contentType(file, options.mimeTypes),
    };

    if (options.cacheControl !== null) {
      headers["Cache-Control"] = options.cacheControl;
    }
    if (body !== source) {
      headers["Content-Encoding"] = "gzip";
      headers.Vary = "Accept-Encoding";
    }

    response.writeHead(200, headers);
    response.end(body);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      sendNotFound(response);
      return;
    }
    destroyResponse(response, error);
  }
}

async function createDistServer(distDir, options = {}) {
  const serverOptions = {
    cacheControl: options.cacheControl ?? null,
    fsPromises: options.fsPromises ?? fsp,
    gzip: options.gzip === true,
    gzipExtensions: options.gzipExtensions ?? GZIP_EXTENSIONS,
    gzipSync: options.gzipSync ?? zlib.gzipSync,
    mimeTypes: options.mimeTypes ?? MIME_TYPES,
  };
  const server = http.createServer(async (request, response) => {
    const file = resolveDistPath(distDir, request.url);
    if (file === null) {
      sendNotFound(response);
      return;
    }

    await serveFile(request, response, file, serverOptions);
  });
  const port = await listen(server);

  return {
    close: () => new Promise((resolve) => server.close(resolve)),
    origin: `http://127.0.0.1:${port}`,
  };
}

function isExecutableFile(file, options = {}) {
  const accessSync = options.accessSync ?? fs.accessSync;
  const statSync = options.statSync ?? fs.statSync;

  try {
    if (!statSync(file).isFile()) {
      return false;
    }
    accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function commandPath(command, options = {}) {
  if (path.isAbsolute(command) || command.includes(path.sep)) {
    return "";
  }

  const env = options.env ?? process.env;
  const isExecutableFileFn =
    options.isExecutableFile ?? ((file) => isExecutableFile(file, options));
  const pathEnv = options.pathEnv ?? env.PATH ?? "";
  const pathDelimiter = options.pathDelimiter ?? path.delimiter;

  for (const entry of String(pathEnv).split(pathDelimiter)) {
    const dir = entry === "" ? "." : entry;
    const file = path.resolve(dir, command);
    if (isExecutableFileFn(file)) {
      return file;
    }
  }

  return "";
}

function cachedPlaywrightChromes(options = {}) {
  const cacheRoot = options.cacheRoot ?? path.join(options.homeDir ?? os.homedir(), ".cache", "ms-playwright");
  const existsSync = options.existsSync ?? fs.existsSync;
  const readdirSync = options.readdirSync ?? fs.readdirSync;

  if (!existsSync(cacheRoot)) {
    return [];
  }

  return readdirSync(cacheRoot)
    .filter((entry) => /^chromium-\d+$/.test(entry))
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
    .flatMap((entry) => [
      path.join(cacheRoot, entry, "chrome-linux64", "chrome"),
      path.join(cacheRoot, entry, "chrome-linux", "chrome"),
    ]);
}

function browserExecutablePath(options = {}) {
  const env = options.env ?? process.env;
  const commandPathFn = options.commandPath ?? commandPath;
  const isExecutableFileFn =
    options.isExecutableFile ?? ((file) => isExecutableFile(file, options));
  const candidates = [
    options.explicitPath,
    ...(options.envNames ?? SHARED_BROWSER_ENV).map((name) => env[name]),
    ...(options.commandNames ?? CHROME_COMMANDS),
    ...(options.playwrightChromes ?? []),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const isPathCandidate = path.isAbsolute(candidate) || candidate.includes(path.sep);
    const resolved = isPathCandidate ? path.resolve(candidate) : commandPathFn(candidate);
    if (path.isAbsolute(resolved) && isExecutableFileFn(resolved)) {
      return resolved;
    }
  }

  throw new Error(options.errorMessage ?? "Chrome/Chromium not found");
}

function browserReadinessState() {
  const frameDurationSampleCount = 16;
  const workerMessageSampleCount = 8;
  const ingestState = globalThis.__TRACY_BROWSER_INGEST__ ?? {};
  const workerMessages = Array.isArray(ingestState.workerMessages)
    ? ingestState.workerMessages
    : [];
  const frameDurations = Array.isArray(ingestState.frameDurations)
    ? ingestState.frameDurations
    : [];
  const traceCanvas = globalThis.document?.querySelector?.("#tracy") ?? null;
  const traceCanvasState = traceCanvas === null
    ? null
    : {
        height: traceCanvas.height ?? null,
        width: traceCanvas.width ?? null,
        clientHeight: traceCanvas.clientHeight ?? null,
        clientWidth: traceCanvas.clientWidth ?? null,
      };

  return {
    appLoadError: globalThis.__TRACY_APP_LOAD_ERROR__ ?? "",
    alertText: globalThis.document?.querySelector?.('[role="alert"]')?.textContent ?? "",
    documentReadyState: globalThis.document?.readyState ?? null,
    frameDurationsSample: frameDurations.slice(0, frameDurationSampleCount),
    locationHref: globalThis.location?.href ?? "",
    performanceMarks:
      globalThis.performance?.getEntriesByType?.("mark")?.map((entry) => entry.name) ?? [],
    traceCanvas: traceCanvasState,
    workerMessageCount: workerMessages.length,
    workerMessagesHead: workerMessages.slice(0, workerMessageSampleCount),
    workerMessagesTail: workerMessages.slice(-workerMessageSampleCount),
    ...Object.fromEntries(
      Object.entries(ingestState).filter(
        ([key]) => key !== "frameDurations" && key !== "workerMessages",
      ),
    ),
  };
}

async function collectBrowserReadinessState(evaluate) {
  return evaluate(browserReadinessState);
}

function formatBrowserReadinessTimeout(label, state) {
  return `${label}; browser readiness state=${JSON.stringify(state)}`;
}

async function waitForBrowserReadiness(options) {
  const evaluate = options.evaluate;
  const predicate = options.predicate;
  const timeoutMs = options.timeoutMs;
  const pollIntervalMs =
    options.pollIntervalMs ?? DEFAULT_BROWSER_READINESS_POLL_INTERVAL_MS;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = await evaluate(predicate);
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    formatBrowserReadinessTimeout(
      options.label,
      options.collectState === undefined
        ? await collectBrowserReadinessState(evaluate)
        : await options.collectState(),
    ),
  );
}

module.exports = {
  CACHE_CONTROL,
  CHROME_COMMANDS,
  GZIP_EXTENSIONS,
  MIME_TYPES,
  SHARED_BROWSER_ENV,
  acceptsGzip,
  browserExecutablePath,
  browserReadinessState,
  cachedPlaywrightChromes,
  collectBrowserReadinessState,
  commandPath,
  contentType,
  createDistServer,
  formatBrowserReadinessTimeout,
  isExecutableFile,
  resolveDistPath,
  shouldGzip,
  waitForBrowserReadiness,
};
