"use strict";

const childProcess = require("node:child_process");
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

function commandPath(command, options = {}) {
  const spawnSync = options.spawnSync ?? childProcess.spawnSync;
  const result = spawnSync(
    "bash",
    ["-lc", `command -v ${JSON.stringify(command)}`],
    { encoding: "utf8" },
  );

  return result.status === 0 ? result.stdout.trim() : "";
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
  const existsSync = options.existsSync ?? fs.existsSync;
  const commandPathFn = options.commandPath ?? commandPath;
  const candidates = [
    options.explicitPath,
    ...(options.envNames ?? SHARED_BROWSER_ENV).map((name) => env[name]),
    ...(options.commandNames ?? CHROME_COMMANDS),
    ...(options.playwrightChromes ?? []),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const resolved = path.isAbsolute(candidate) ? "" : commandPathFn(candidate);
    if (resolved) {
      return resolved;
    }
    if (path.isAbsolute(candidate) && existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(options.errorMessage ?? "Chrome/Chromium not found");
}

module.exports = {
  CACHE_CONTROL,
  CHROME_COMMANDS,
  GZIP_EXTENSIONS,
  MIME_TYPES,
  SHARED_BROWSER_ENV,
  acceptsGzip,
  browserExecutablePath,
  cachedPlaywrightChromes,
  commandPath,
  contentType,
  createDistServer,
  resolveDistPath,
  shouldGzip,
};
