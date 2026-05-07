#!/usr/bin/env node

const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

function installBrowserStubs() {
  const canvasContext = {
    set fillStyle(value) {
      this.lastFillStyle = value;
    },
    fillRect() {},
    setTransform() {},
  };
  const canvas = {
    clientWidth: 320,
    clientHeight: 240,
    hidden: false,
    width: 0,
    height: 0,
    getBoundingClientRect() {
      return { left: 0, top: 0 };
    },
    getContext() {
      return canvasContext;
    },
    addEventListener() {},
  };

  globalThis.document = {
    body: {
      appendChild() {},
    },
    createElement() {
      return {
        addEventListener() {},
        removeAttribute() {},
        removeEventListener() {},
        set hidden(value) {
          this.isHidden = value;
        },
      };
    },
    getElementById(id) {
      return id === "tracy" ? canvas : null;
    },
  };
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener() {},
    removeEventListener() {},
  };
}

function hostKeys(host) {
  return new Set(Object.keys(host));
}

async function main() {
  installBrowserStubs();

  const shimUrl = pathToFileURL(path.resolve(__dirname, "../host/shim.mjs")).href;
  const abiUrl = pathToFileURL(path.resolve(__dirname, "../host/abi.mjs")).href;
  const {
    makeMainThreadHost,
    makeShim,
    makeWorkerThreadHost,
  } = await import(shimUrl);
  const { HOST_IMPORT_NAME } = await import(abiUrl);
  const memory = new WebAssembly.Memory({ initial: 1 });

  const mainHost = makeMainThreadHost(memory);
  const workerHost = makeWorkerThreadHost(memory);
  const legacyHost = makeShim(memory);
  const mainKeys = hostKeys(mainHost);
  const workerKeys = hostKeys(workerHost);

  for (const name of [
    HOST_IMPORT_NAME.CANVAS_GET_SIZE,
    HOST_IMPORT_NAME.CANVAS_LISTEN_RESIZE,
    HOST_IMPORT_NAME.FILE_PICKER_OPEN,
    HOST_IMPORT_NAME.POINTER_LISTEN,
  ]) {
    assert(mainKeys.has(name), `main host missing ${name}`);
    assert(!workerKeys.has(name), `worker host should not expose ${name}`);
  }

  for (const name of [
    HOST_IMPORT_NAME.OPFS_SOURCE_OPEN,
    HOST_IMPORT_NAME.OPFS_SOURCE_READ,
    HOST_IMPORT_NAME.OPFS_INDEX_CREATE,
    HOST_IMPORT_NAME.OPFS_INDEX_OPEN,
    HOST_IMPORT_NAME.OPFS_INDEX_READ,
    HOST_IMPORT_NAME.OPFS_INDEX_WRITE,
    HOST_IMPORT_NAME.OPFS_INDEX_FLUSH,
    HOST_IMPORT_NAME.OPFS_INDEX_SIZE,
  ]) {
    assert(workerKeys.has(name), `worker host missing ${name}`);
    assert(Object.hasOwn(legacyHost, name), `legacy host missing ${name}`);
  }

  assert(mainKeys.has(HOST_IMPORT_NAME.OPFS_INDEX_OPEN), "main host missing index open");
  assert(mainKeys.has(HOST_IMPORT_NAME.OPFS_INDEX_READ), "main host missing index read");
  assert(mainKeys.has(HOST_IMPORT_NAME.OPFS_INDEX_CREATE), "main host missing index create");
  assert(mainKeys.has(HOST_IMPORT_NAME.OPFS_INDEX_WRITE), "main host missing index write");
  assert(mainKeys.has(HOST_IMPORT_NAME.OPFS_INDEX_FLUSH), "main host missing index flush");
  assert(mainKeys.has(HOST_IMPORT_NAME.OPFS_INDEX_SIZE), "main host missing index size");

  assert.throws(
    () => workerHost[HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE](1),
    /file handles are owned by the main thread/,
  );
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
