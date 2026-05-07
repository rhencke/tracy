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
    phase: "parse",
    fileOffset: 32,
  });
  worker.emit("message", {
    type: "covered_range",
    start: 0,
    end: 32,
  });
  worker.emit("message", {
    type: "complete",
    committedEvents: 7,
  });

  frames[0](123);
  assert.deepEqual(ticks, ["main", 123]);
  assert.equal(controller.status().state, "complete");
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

checkRuntimeOrchestratesWorker().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
