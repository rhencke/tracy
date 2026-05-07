#!/usr/bin/env node

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

function moduleUrl(relativePath) {
  return pathToFileURL(path.resolve(__dirname, "..", relativePath)).href;
}

function installBrowserStubs() {
  const frames = [];

  globalThis.document = {
    body: {
      appendChild() {},
    },
    createElement() {
      return {
        setAttribute() {},
        style: {},
      };
    },
    getElementById() {
      return {
        hidden: false,
      };
    },
  };
  globalThis.requestAnimationFrame = (callback) => {
    frames.push(callback);
    return frames.length;
  };
  globalThis.WebAssembly.Suspending = class Suspending {
    constructor(fn) {
      return { fn };
    }
  };

  return { frames };
}

class FakeWorker {
  static instances = [];

  constructor(url, options) {
    this.events = new Map();
    this.options = options;
    this.posted = [];
    this.url = url;
    FakeWorker.instances.push(this);
  }

  addEventListener(type, callback) {
    this.events.set(type, callback);
  }

  emit(type, data) {
    this.events.get(type)?.({ data });
  }

  postMessage(message) {
    this.posted.push(message);
  }

  terminate() {
    this.terminated = true;
  }
}

async function checkRuntimeOrchestratesWorker() {
  const { frames } = installBrowserStubs();
  const runtime = await import(moduleUrl("host/runtime.mjs"));
  const workerMessages = [];
  const instantiateCalls = [];
  const performanceEntries = [];
  const ticks = [];
  const memory = new WebAssembly.Memory({ initial: 1 });
  const host = {
    opfs_index_create() {
      return 0;
    },
  };
  const workerStatus = [];
  const performance = {
    mark(name) {
      performanceEntries.push({ kind: "mark", name });
    },
    measure(name, start, end) {
      performanceEntries.push({ kind: "measure", name, start, end });
    },
  };

  const controller = runtime.runApp(memory, host, {
    ingest: {
      indexName: "indexes/trace.idx",
      sourceName: "sources/trace.json",
    },
    instantiateWasmModuleForThread: async (id, thread, imports) => {
      instantiateCalls.push({
        hostImport: imports.host.opfs_index_create,
        id,
        memory: imports.env.memory,
        thread,
      });
      return {
        exports: {
          tracy_main() {
            ticks.push("main");
          },
          tracy_tick(ts) {
            ticks.push(ts);
          },
        },
      };
    },
    performance,
    worker: {
      Worker: FakeWorker,
      onWorkerStatus(status, message) {
        workerStatus.push({ status, message });
      },
      workerUrl: "worker.js",
    },
  });

  await Promise.resolve();
  await Promise.resolve();

  assert.equal(FakeWorker.instances.length, 1);
  const worker = FakeWorker.instances[0];
  assert.equal(worker.url, "worker.js");
  assert.deepEqual(worker.options, { type: "module" });
  assert.deepEqual(instantiateCalls, [
    { hostImport: host.opfs_index_create, id: "app", memory, thread: "main" },
  ]);
  assert.deepEqual(performanceEntries, [
    { kind: "mark", name: "tracy.wasm.instantiate.start" },
    { kind: "mark", name: "tracy.wasm.instantiate.end" },
    {
      kind: "measure",
      name: "tracy.wasm.instantiate",
      start: "tracy.wasm.instantiate.start",
      end: "tracy.wasm.instantiate.end",
    },
    { kind: "mark", name: "tracy.main.start" },
    { kind: "mark", name: "tracy.main.end" },
    {
      kind: "measure",
      name: "tracy.main",
      start: "tracy.main.start",
      end: "tracy.main.end",
    },
    { kind: "mark", name: "tracy.app.ready" },
    {
      kind: "measure",
      name: "tracy.app.load",
      start: "tracy.bootstrap.start",
      end: "tracy.app.ready",
    },
  ]);
  assert.equal(frames.length, 1, "requestAnimationFrame should be scheduled");
  assert.deepEqual(worker.posted, [
    {
      indexName: "indexes/trace.idx",
      sourceName: "sources/trace.json",
      type: "start",
    },
  ]);
  assert.equal(controller.status().state, "running");

  worker.emit("message", {
    type: "progress",
    committedPages: 2,
    etaSeconds: null,
    phase: "parse",
    fileOffset: 32,
    indexedEvents: 4,
    parsedEvents: 5,
    throughputBytesPerSecond: 8000,
    totalBytes: 64,
  });
  worker.emit("message", {
    type: "covered_range",
    valid: true,
    start: 100,
    end: 132,
  });
  worker.emit("message", {
    type: "complete",
    committedEvents: 7,
  });

  frames[0](123);
  assert.deepEqual(ticks, ["main", 123]);
  assert.equal(controller.status().state, "complete");
  assert.equal(controller.status().progress.fileOffset, 32);
  assert.equal(controller.status().progress.committedPages, 2);
  assert.equal(controller.status().coveredRange.start, 100);
  assert.equal(controller.status().coveredRange.end, 132);
  assert.equal(controller.status().result.committedEvents, 7);
  assert.equal(workerStatus.at(-1).status.state, "complete");

  const controllerWithError = runtime.createIngestWorkerController({
    Worker: FakeWorker,
    onWorkerStatus(status, message) {
      workerMessages.push({ status, message });
    },
  });
  const errorWorker = FakeWorker.instances.at(-1);

  errorWorker.events.get("error")({ message: "worker crashed" });
  assert.equal(controllerWithError.status().state, "error");
  assert.equal(controllerWithError.status().error, "worker crashed");
  assert.equal(workerMessages.at(-1).status.state, "error");
}

async function checkRuntimeStartsIngestFromFileSelection() {
  installBrowserStubs();

  const runtime = await import(moduleUrl("host/runtime.mjs"));
  const abi = await import(moduleUrl("host/abi.mjs"));
  const memory = new WebAssembly.Memory({ initial: 1 });
  const sourceName = "sources/selected trace.json";
  const sourceNameBytes = new TextEncoder().encode(sourceName);
  const callbacks = [];
  const workerStatus = [];
  const host = {
    [abi.HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE](fileHandle) {
      assert.equal(fileHandle, 9);
      return Promise.resolve(41);
    },
    [abi.HOST_IMPORT_NAME.OPFS_SOURCE_NAME_LEN](sourceId) {
      assert.equal(sourceId, 41);
      return sourceNameBytes.byteLength;
    },
    [abi.HOST_IMPORT_NAME.OPFS_SOURCE_NAME](sourceId, destPtr, destLen) {
      assert.equal(sourceId, 41);
      assert.equal(destLen, sourceNameBytes.byteLength);
      new Uint8Array(memory.buffer, destPtr, destLen).set(sourceNameBytes);
      return sourceNameBytes.byteLength;
    },
    opfs_index_create() {
      return 0;
    },
    setFileSelectedCallback(callback) {
      callbacks.push(callback);
    },
  };

  const controller = runtime.runApp(memory, host, {
    instantiateWasmModuleForThread: async () => ({
      exports: {
        tracy_main() {},
        tracy_tick() {},
      },
    }),
    worker: {
      Worker: FakeWorker,
      onWorkerStatus(status, message) {
        workerStatus.push({ status, message });
      },
      workerUrl: "worker.js",
    },
  });

  await Promise.resolve();
  await Promise.resolve();

  const worker = controller.worker;
  assert.equal(callbacks.length, 1);
  assert.deepEqual(worker.posted, []);

  callbacks[0]({ file: { size: 1234 }, handle: 9 });
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(worker.posted, [
    {
      indexName: "indexes/selected_trace.json.idx",
      sourceName,
      sourceSize: 1234,
      type: "start",
    },
  ]);
  assert.equal(controller.status().state, "running");
  assert.equal(workerStatus.at(-1).status.state, "running");

  callbacks[0]({ handle: -1 });
  await Promise.resolve();
  assert.equal(worker.posted.length, 1, "cancelled picker should not start ingest");
}

async function checkFileSelectionSetupErrorsReportStatus() {
  installBrowserStubs();

  const runtime = await import(moduleUrl("host/runtime.mjs"));
  const abi = await import(moduleUrl("host/abi.mjs"));
  const memory = new WebAssembly.Memory({ initial: 1 });
  let callback;
  const workerStatus = [];
  const host = {
    [abi.HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE]() {
      return Promise.reject(new Error("OPFS write failed"));
    },
    opfs_index_create() {
      return 0;
    },
    setFileSelectedCallback(nextCallback) {
      callback = nextCallback;
    },
  };

  const controller = runtime.runApp(memory, host, {
    instantiateWasmModuleForThread: async () => ({
      exports: {
        tracy_main() {},
        tracy_tick() {},
      },
    }),
    worker: {
      Worker: FakeWorker,
      onWorkerStatus(status, message) {
        workerStatus.push({ status, message });
      },
      workerUrl: "worker.js",
    },
  });

  await Promise.resolve();
  await Promise.resolve();

  callback({ handle: 10 });
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(controller.status().state, "error");
  assert.equal(controller.status().error, "OPFS write failed");
  assert.equal(workerStatus.at(-1).status.state, "error");
}

async function main() {
  await checkRuntimeOrchestratesWorker();
  await checkRuntimeStartsIngestFromFileSelection();
  await checkFileSelectionSetupErrorsReportStatus();
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
