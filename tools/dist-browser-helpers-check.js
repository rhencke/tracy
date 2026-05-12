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
  commandPath: safeCommandPath,
  contentType,
  createDistServer,
  resolveDistPath,
} = require("./dist-browser-helpers.js");

const ROOT_DIR = path.resolve(__dirname, "..");

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), "utf8");
}

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

async function withoutUnhandledRejection(run) {
  let unhandled = null;
  const onUnhandledRejection = (error) => {
    unhandled = error;
  };

  process.on("unhandledRejection", onUnhandledRejection);
  try {
    await run();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(unhandled, null);
  } finally {
    process.off("unhandledRejection", onUnhandledRejection);
  }
}

async function assertServerFailureModes() {
  await withTempDist(async (distDir) => {
    const disappearingFile = await createDistServer(distDir, {
      fsPromises: {
        readFile: async () => {
          const error = new Error("missing after stat");
          error.code = "ENOENT";
          throw error;
        },
        stat: async () => ({ isFile: () => true }),
      },
    });
    try {
      const response = await request(`${disappearingFile.origin}/index.html`);
      assert.equal(response.statusCode, 404);
      assert.equal(response.body.toString("utf8"), "not found");
    } finally {
      await disappearingFile.close();
    }

    const unreadableFile = await createDistServer(distDir, {
      fsPromises: {
        readFile: async () => {
          const error = new Error("permission denied");
          error.code = "EACCES";
          throw error;
        },
        stat: async () => ({ isFile: () => true }),
      },
    });
    try {
      await withoutUnhandledRejection(async () => {
        await assert.rejects(
          request(`${unreadableFile.origin}/index.html`),
          /socket hang up|aborted/,
        );
      });
    } finally {
      await unreadableFile.close();
    }

    const brokenGzip = await createDistServer(distDir, {
      fsPromises: {
        readFile: async () => Buffer.from("<!doctype html>\n"),
        stat: async () => ({ isFile: () => true }),
      },
      gzip: true,
      gzipSync: () => {
        throw new Error("gzip failed");
      },
    });
    try {
      await withoutUnhandledRejection(async () => {
        await assert.rejects(
          request(`${brokenGzip.origin}/index.html`, {
            headers: { "Accept-Encoding": "gzip" },
          }),
          /socket hang up|aborted/,
        );
      });
    } finally {
      await brokenGzip.close();
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
  const commandPathStub = (command) => {
    commands.push(command);
    return command === "chromium" ? "/usr/bin/chromium" : "";
  };
  const exists = new Set([
    "/custom/chrome",
    "/env/chrome",
    "/usr/bin/chromium",
    "/pw/chromium-120/chrome-linux64/chrome",
  ]);
  const existsSync = (file) => exists.has(file);
  const isExecutableFile = existsSync;

  assert.equal(
    browserExecutablePath({
      commandPath: commandPathStub,
      env: { PUPPETEER_EXECUTABLE_PATH: "/env/chrome" },
      explicitPath: "/custom/chrome",
      isExecutableFile,
    }),
    "/custom/chrome",
  );
  assert.equal(
    browserExecutablePath({
      commandPath: commandPathStub,
      env: { TRACY_INTERACTIVE_INGEST_BROWSER: "/env/chrome" },
      envNames: ["TRACY_INTERACTIVE_INGEST_BROWSER"],
      isExecutableFile,
    }),
    "/env/chrome",
  );
  assert.equal(
    browserExecutablePath({
      commandPath: commandPathStub,
      env: {},
      isExecutableFile,
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
      commandPath: commandPathStub,
      env: {},
      isExecutableFile,
      playwrightChromes: ["/pw/chromium-120/chrome-linux64/chrome"],
    }),
    "/pw/chromium-120/chrome-linux64/chrome",
  );

  const commandLookupAttempts = [];
  const statLookupAttempts = [];
  assert.equal(
    safeCommandPath("chromium", {
      accessSync: (file) => {
        commandLookupAttempts.push(file);
        if (file !== "/tools/chromium") {
          const error = new Error("missing");
          error.code = "ENOENT";
          throw error;
        }
      },
      env: { PATH: "/missing:/tools" },
      pathDelimiter: ":",
      statSync: (file) => {
        statLookupAttempts.push(file);
        return {
          isFile: () => file === "/tools/chromium",
        };
      },
    }),
    "/tools/chromium",
  );
  assert.deepEqual(statLookupAttempts, [
    "/missing/chromium",
    "/tools/chromium",
  ]);
  assert.deepEqual(commandLookupAttempts, ["/tools/chromium"]);

  const safeLookupDir = fs.mkdtempSync(path.join(os.tmpdir(), "tracy-browser-path-"));
  try {
    const browserPath = path.join(safeLookupDir, "chromium");
    const markerPath = path.join(safeLookupDir, "shell-candidate-ran");
    fs.writeFileSync(browserPath, "#!/bin/sh\nexit 0\n");
    fs.chmodSync(browserPath, 0o755);

    assert.equal(
      browserExecutablePath({
        commandNames: ["chromium"],
        commandPath: (command) =>
          safeCommandPath(command, {
            env: { PATH: safeLookupDir },
          }),
        env: {
          TRACY_INTERACTIVE_INGEST_BROWSER: `$(touch ${markerPath})`,
        },
        envNames: ["TRACY_INTERACTIVE_INGEST_BROWSER"],
      }),
      browserPath,
    );
    assert.equal(fs.existsSync(markerPath), false);
  } finally {
    fs.rmSync(safeLookupDir, {
      force: true,
      maxRetries: 5,
      recursive: true,
      retryDelay: 100,
    });
  }

  const directoryLookupRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tracy-browser-dir-"));
  try {
    const directoryEntry = path.join(directoryLookupRoot, "directory");
    const binaryEntry = path.join(directoryLookupRoot, "binary");
    const browserDirectory = path.join(directoryEntry, "chromium");
    const browserPath = path.join(binaryEntry, "chromium");
    fs.mkdirSync(browserDirectory, { recursive: true });
    fs.mkdirSync(binaryEntry, { recursive: true });
    fs.writeFileSync(browserPath, "#!/bin/sh\nexit 0\n");
    fs.chmodSync(browserPath, 0o755);

    assert.equal(
      safeCommandPath("chromium", {
        env: { PATH: `${directoryEntry}:${binaryEntry}` },
        pathDelimiter: ":",
      }),
      browserPath,
    );
    assert.equal(
      browserExecutablePath({
        commandNames: ["chromium"],
        commandPath: (command) =>
          safeCommandPath(command, {
            env: { PATH: `${directoryEntry}:${binaryEntry}` },
            pathDelimiter: ":",
          }),
        env: {},
      }),
      browserPath,
    );
  } finally {
    fs.rmSync(directoryLookupRoot, {
      force: true,
      maxRetries: 5,
      recursive: true,
      retryDelay: 100,
    });
  }

  const relativeLookupRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tracy-browser-relative-"));
  try {
    const browserPath = path.join(relativeLookupRoot, "chromium");
    const relativeBrowserPath = path.relative(process.cwd(), browserPath);
    fs.writeFileSync(browserPath, "#!/bin/sh\nexit 0\n");
    fs.chmodSync(browserPath, 0o755);

    assert.equal(
      browserExecutablePath({
        commandNames: ["chromium"],
        env: {},
        explicitPath: relativeBrowserPath,
      }),
      path.resolve(relativeBrowserPath),
    );
    assert.equal(
      browserExecutablePath({
        commandNames: ["chromium"],
        env: { TRACY_INTERACTIVE_INGEST_BROWSER: relativeBrowserPath },
        envNames: ["TRACY_INTERACTIVE_INGEST_BROWSER"],
      }),
      path.resolve(relativeBrowserPath),
    );
  } finally {
    fs.rmSync(relativeLookupRoot, {
      force: true,
      maxRetries: 5,
      recursive: true,
      retryDelay: 100,
    });
  }

  assert.equal(
    browserExecutablePath({
      commandNames: ["chromium"],
      commandPath: () => "chromium",
      env: {},
      isExecutableFile,
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
        isExecutableFile,
        playwrightChromes: [],
      }),
    /Chrome\/Chromium not found/,
  );
}

function assertAppLoadUsesSharedHelpers() {
  const source = readRepoFile("tools/app-load-bench.js");

  assert.match(source, /require\("\.\/dist-browser-helpers\.js"\)/);
  assert.match(source, /browserExecutablePath\(\{\s*errorMessage: "Chrome\/Chromium not found; set TRACY_APP_LOAD_BROWSER",\s*explicitPath,/);
  assert.match(source, /createDistServer\(distDir,\s*\{\s*cacheControl: CACHE_CONTROL\.IMMUTABLE,\s*gzip: true,/);
  assert.doesNotMatch(source, /const http = require\("node:http"\)/);
  assert.doesNotMatch(source, /const zlib = require\("node:zlib"\)/);
  assert.doesNotMatch(source, /\bconst MIME_TYPES\b/);
  assert.doesNotMatch(source, /\bconst GZIP_EXTENSIONS\b/);
  assert.doesNotMatch(source, /\bfunction acceptsGzip\b/);
  assert.doesNotMatch(source, /\bfunction contentType\b/);
  assert.doesNotMatch(source, /\bfunction resolveDistPath\b/);
  assert.doesNotMatch(source, /\bfunction shouldGzip\b/);
}

function assertInteractiveCheckUsesSharedHelpers() {
  const source = readRepoFile("tools/interactive-ingest-browser-check.js");
  const browserEnvOffset = source.indexOf('"TRACY_INTERACTIVE_INGEST_BROWSER"');
  const puppeteerEnvOffset = source.indexOf('"PUPPETEER_EXECUTABLE_PATH"');
  const chromeEnvOffset = source.indexOf('"CHROME_PATH"');

  assert.match(source, /require\("\.\/dist-browser-helpers\.js"\)/);
  assert.match(source, /browserExecutablePath: findBrowserExecutablePath/);
  assert.match(source, /cachedPlaywrightChromes/);
  assert.match(source, /findBrowserExecutablePath\(\{\s*envNames: \[/);
  assert.ok(browserEnvOffset >= 0, "interactive browser env override must stay configured");
  assert.ok(puppeteerEnvOffset > browserEnvOffset, "TRACY_INTERACTIVE_INGEST_BROWSER must precede Puppeteer fallback");
  assert.ok(chromeEnvOffset > puppeteerEnvOffset, "PUPPETEER_EXECUTABLE_PATH must precede CHROME_PATH fallback");
  assert.match(source, /createDistServer\(DIST_DIR,\s*\{\s*cacheControl: CACHE_CONTROL\.NO_STORE,\s*gzip: false,/);
  assert.doesNotMatch(source, /const childProcess = require\("node:child_process"\)/);
  assert.doesNotMatch(source, /const http = require\("node:http"\)/);
  assert.doesNotMatch(source, /\bfunction commandPath\b/);
  assert.doesNotMatch(source, /\bfunction contentType\b/);
  assert.doesNotMatch(source, /\bfunction resolveDistPath\b/);
  assert.doesNotMatch(source, /\bfunction cachedPlaywrightChromes\b/);
}

function assertDelayedWasmImportBoundary() {
  const bootstrap = readRepoFile("bootstrap.mjs");
  const coreReadyOffset = bootstrap.indexOf("await coreReadyPromise");
  const wasmModulesUrlOffset = bootstrap.indexOf("const wasmModulesUrl");
  const dynamicImportOffset = bootstrap.indexOf("return import(wasmModulesUrl)");

  assert.match(bootstrap, /const coreReadyPromise = new Promise/);
  assert.ok(coreReadyOffset >= 0, "Wasm module graph import must await core readiness");
  assert.ok(
    wasmModulesUrlOffset > coreReadyOffset,
    "Wasm module graph URL must be discovered after core readiness",
  );
  assert.ok(
    dynamicImportOffset > wasmModulesUrlOffset,
    "Wasm module graph import must use the post-ready URL variable",
  );
  assert.doesNotMatch(
    bootstrap,
    /import\(`\.\/host\/\$\{RUNTIME_URLS\.WASM_MODULES_URL\.replace/,
  );
}

async function main() {
  assertPathAndMimeHelpers();
  assertBrowserDiscovery();
  assertAppLoadUsesSharedHelpers();
  assertInteractiveCheckUsesSharedHelpers();
  assertDelayedWasmImportBoundary();
  await assertServerResponseModes();
  await assertServerFailureModes();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
