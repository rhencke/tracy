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
      return fn;
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
  const ticks = [];
  const memory = new WebAssembly.Memory({ initial: 1 });
  const host = {};
  const workerStatus = [];

  const controller = runtime.runApp(memory, host, {
    ingest: {
      indexName: "indexes/trace.idx",
      sourceName: "sources/trace.json",
    },
    instantiateWasmModuleForThread: async (id, thread, imports) => {
      instantiateCalls.push({ id, thread, memory: imports.env.memory });
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
    worker: {
      Worker: FakeWorker,
      onWorkerStatus(status, message) {
        workerStatus.push({ status, message });
      },
      workerUrl: "worker.bundle.js",
    },
  });

  await Promise.resolve();
  await Promise.resolve();

  assert.equal(FakeWorker.instances.length, 1);
  const worker = FakeWorker.instances[0];
  assert.equal(worker.url, "worker.bundle.js");
  assert.deepEqual(worker.options, { type: "module" });
  assert.deepEqual(instantiateCalls, [
    { id: "app", thread: "main", memory },
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
