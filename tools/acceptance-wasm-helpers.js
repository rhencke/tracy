const fs = require("node:fs/promises");
const path = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");

const REPO_ROOT = path.resolve(__dirname, "..");
const DIST_WASM_BASE_URL = "dist/wasm/";

function repoPath(relativePath = "") {
  return path.resolve(REPO_ROOT, relativePath);
}

function moduleUrl(relativePath) {
  return pathToFileURL(repoPath(relativePath)).href;
}

function localPathFromUrl(value) {
  const text = String(value);

  try {
    const url = new URL(text);
    if (url.protocol === "file:") {
      return fileURLToPath(url);
    }
  } catch {
    // Plain repo-relative paths are expected for dist wasm loads.
  }

  return path.isAbsolute(text) ? text : repoPath(text);
}

async function compileDistWasmModule(url) {
  const bytes = await fs.readFile(localPathFromUrl(url));

  return WebAssembly.compile(bytes);
}

async function instantiateDistWasmModule(module, imports) {
  const instance = await WebAssembly.instantiate(module, imports);

  return instance.exports;
}

function distWasmModuleOptions(options = {}) {
  return {
    baseUrl: DIST_WASM_BASE_URL,
    compile: compileDistWasmModule,
    instantiate: instantiateDistWasmModule,
    ...options,
  };
}

module.exports = {
  DIST_WASM_BASE_URL,
  REPO_ROOT,
  compileDistWasmModule,
  distWasmModuleOptions,
  instantiateDistWasmModule,
  localPathFromUrl,
  moduleUrl,
  repoPath,
};
