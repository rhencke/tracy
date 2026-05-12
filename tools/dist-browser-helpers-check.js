#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const {
  CACHE_CONTROL,
  browserExecutablePath,
  cachedPlaywrightChromes,
  contentType,
  createDistServer,
  resolveDistPath,
} = require("./dist-browser-helpers.js");

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers: options.headers ?? {} }, (response) => {
      const chunks = [];

      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () =>
        resolve({
          body: Buffer.concat(chunks),
          headers: response.headers,
          statusCode: response.statusCode,
        }),
      );
    });

    req.once("error", reject);
  });
}

async function withTempDist(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tracy-dist-browser-"));
  try {
    fs.mkdirSync(path.join(dir, "host"), { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html>\n");
    fs.writeFileSync(path.join(dir, "host", "runtime.mjs"), "export {};\n");
    fs.writeFileSync(path.join(dir, "trace.wasm"), Buffer.from([0, 97, 115, 109]));
    fs.writeFileSync(path.join(dir, "plain.bin"), Buffer.from([1, 2, 3]));
    await run(dir);
  } finally {
    fs.rmSync(dir, {
      force: true,
      maxRetries: 5,
      recursive: true,
      retryDelay: 100,
    });
  }
}

async function assertServerResponseModes() {
  await withTempDist(async (distDir) => {
    const cached = await createDistServer(distDir, {
      cacheControl: CACHE_CONTROL.IMMUTABLE,
      gzip: true,
    });
    try {
      const html = await request(`${cached.origin}/`, {
        headers: { "Accept-Encoding": "br, gzip" },
      });
      assert.equal(html.statusCode, 200);
      assert.equal(html.headers["cache-control"], CACHE_CONTROL.IMMUTABLE);
      assert.equal(html.headers["content-encoding"], "gzip");
      assert.equal(html.headers.vary, "Accept-Encoding");
      assert.equal(zlib.gunzipSync(html.body).toString("utf8"), "<!doctype html>\n");

      const bin = await request(`${cached.origin}/plain.bin`, {
        headers: { "Accept-Encoding": "gzip" },
      });
      assert.equal(bin.statusCode, 200);
      assert.equal(bin.headers["content-encoding"], undefined);
      assert.equal(bin.headers["content-type"], "application/octet-stream");

      const traversal = await request(`${cached.origin}/../package.json`);
      assert.equal(traversal.statusCode, 404);
    } finally {
      await cached.close();
    }

    const noStore = await createDistServer(distDir, {
      cacheControl: CACHE_CONTROL.NO_STORE,
      gzip: false,
    });
    try {
      const runtime = await request(`${noStore.origin}/host/runtime.mjs`, {
        headers: { "Accept-Encoding": "gzip" },
      });
      assert.equal(runtime.statusCode, 200);
      assert.equal(runtime.headers["cache-control"], CACHE_CONTROL.NO_STORE);
      assert.equal(runtime.headers["content-encoding"], undefined);
      assert.equal(runtime.body.toString("utf8"), "export {};\n");
    } finally {
      await noStore.close();
    }
  });
}

function assertPathAndMimeHelpers() {
  const distDir = path.resolve("/repo/dist");

  assert.equal(resolveDistPath(distDir, "/"), path.join(distDir, "index.html"));
  assert.equal(resolveDistPath(distDir, "/host/runtime.mjs"), path.join(distDir, "host", "runtime.mjs"));
  assert.equal(resolveDistPath(distDir, "/%2e%2e/package.json"), null);
  assert.equal(resolveDistPath(distDir, "/%E0%A4%A"), null);
  assert.equal(contentType("index.html"), "text/html; charset=utf-8");
  assert.equal(contentType("bootstrap.mjs"), "text/javascript; charset=utf-8");
  assert.equal(contentType("trace.wasm"), "application/wasm");
  assert.equal(contentType("manifest.webmanifest"), "application/manifest+json");
  assert.equal(contentType("unknown.bin"), "application/octet-stream");
}

function assertBrowserDiscovery() {
  const commands = [];
  const commandPath = (command) => {
    commands.push(command);
    return command === "chromium" ? "/usr/bin/chromium" : "";
  };
  const exists = new Set([
    "/custom/chrome",
    "/env/chrome",
    "/pw/chromium-120/chrome-linux64/chrome",
  ]);
  const existsSync = (file) => exists.has(file);

  assert.equal(
    browserExecutablePath({
      commandPath,
      env: { PUPPETEER_EXECUTABLE_PATH: "/env/chrome" },
      existsSync,
      explicitPath: "/custom/chrome",
    }),
    "/custom/chrome",
  );
  assert.equal(
    browserExecutablePath({
      commandPath,
      env: { TRACY_INTERACTIVE_INGEST_BROWSER: "/env/chrome" },
      envNames: ["TRACY_INTERACTIVE_INGEST_BROWSER"],
      existsSync,
    }),
    "/env/chrome",
  );
  assert.equal(
    browserExecutablePath({
      commandPath,
      env: {},
      existsSync,
    }),
    "/usr/bin/chromium",
  );
  assert.deepEqual(commands.slice(-3), [
    "google-chrome",
    "google-chrome-stable",
    "chromium",
  ]);
  assert.equal(
    browserExecutablePath({
      commandNames: [],
      commandPath,
      env: {},
      existsSync,
      playwrightChromes: ["/pw/chromium-120/chrome-linux64/chrome"],
    }),
    "/pw/chromium-120/chrome-linux64/chrome",
  );
  assert.deepEqual(
    cachedPlaywrightChromes({
      cacheRoot: "/pw",
      existsSync: (file) => file === "/pw",
      readdirSync: () => ["firefox-1", "chromium-99", "chromium-120"],
    }),
    [
      "/pw/chromium-120/chrome-linux64/chrome",
      "/pw/chromium-120/chrome-linux/chrome",
      "/pw/chromium-99/chrome-linux64/chrome",
      "/pw/chromium-99/chrome-linux/chrome",
    ],
  );
  assert.throws(
    () =>
      browserExecutablePath({
        commandNames: [],
        env: {},
        existsSync,
        playwrightChromes: [],
      }),
    /Chrome\/Chromium not found/,
  );
}

async function main() {
  assertPathAndMimeHelpers();
  assertBrowserDiscovery();
  await assertServerResponseModes();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
