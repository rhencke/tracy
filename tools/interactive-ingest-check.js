#!/usr/bin/env node

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const HUNDRED_MB = 100 * 1024 * 1024;
const TEN_MB = 10 * 1024 * 1024;
const FRAME_BUDGET_MS = 16.67;

function moduleUrl(relativePath) {
  return pathToFileURL(path.resolve(__dirname, "..", relativePath)).href;
}

function installBrowserHarness(canvas) {
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
    getElementById(id) {
      return id === "tracy" ? canvas : null;
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
  constructor(url, options) {
    this.events = new Map();
    this.options = options;
    this.posted = [];
    this.url = url;
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

function makeCanvasHarness() {
  const listeners = new Map();
  const operations = [];
  let currentFrameAt = 0;
  let firstTraceDrawAt = null;
  const context = {
    beginPath() {
      operations.push({ at: currentFrameAt, op: "beginPath" });
    },
    clearRect(x, y, width, height) {
      operations.push({ at: currentFrameAt, height, op: "clearRect", width, x, y });
    },
    clip() {
      operations.push({ at: currentFrameAt, op: "clip" });
    },
    fillRect(x, y, width, height) {
      operations.push({
        at: currentFrameAt,
        fillStyle: this.fillStyle,
        height,
        op: "fillRect",
        width,
        x,
        y,
      });
      if (
        firstTraceDrawAt === null &&
        (this.fillStyle === "#2d74da" ||
          this.fillStyle === "rgba(92, 109, 130, 0.58)")
      ) {
        firstTraceDrawAt = currentFrameAt;
      }
    },
    lineTo(x, y) {
      operations.push({ at: currentFrameAt, op: "lineTo", x, y });
    },
    moveTo(x, y) {
      operations.push({ at: currentFrameAt, op: "moveTo", x, y });
    },
    rect(x, y, width, height) {
      operations.push({ at: currentFrameAt, height, op: "rect", width, x, y });
    },
    restore() {
      operations.push({ at: currentFrameAt, op: "restore" });
    },
    save() {
      operations.push({ at: currentFrameAt, op: "save" });
    },
    stroke() {
      operations.push({
        at: currentFrameAt,
        op: "stroke",
        strokeStyle: this.strokeStyle,
      });
    },
  };
  const canvas = {
    height: 180,
    width: 360,
    addEventListener(type, callback) {
      listeners.set(type, callback);
    },
    getBoundingClientRect() {
      return { left: 0, top: 0 };
    },
    getContext(type) {
      assert.equal(type, "2d");
      return context;
    },
    releasePointerCapture() {},
    setPointerCapture() {},
  };

  return {
    canvas,
    firstTraceDrawAt() {
      return firstTraceDrawAt;
    },
    listeners,
    operations,
    setFrameAt(value) {
      currentFrameAt = value;
    },
  };
}

function makeIndexReader(memory, coveredRangeRef) {
  const openCalls = [];
  const queryCalls = [];
  const reader = {
    coveredRange() {
      return coveredRangeRef.current ?? { end: 0, start: 0, valid: false };
    },
    open(indexName) {
      openCalls.push(indexName);
      reader.state = "ready";
      return Promise.resolve(true);
    },
    queryRange(trackId, tsMin, tsMax, outPtr) {
      const coveredRange = coveredRangeRef.current;

      assert.equal(reader.state, "ready");
      assert.equal(coveredRange?.valid, true);
      assert.ok(tsMin >= coveredRange.start, "queries should stay inside covered time");
      assert.ok(tsMax <= coveredRange.end, "queries should not reach unknown time");
      queryCalls.push({ outPtr, trackId, tsMax, tsMin });

      const view = new DataView(memory.buffer);
      view.setUint32(outPtr, Math.max(coveredRange.start, Math.floor(tsMin) + trackId * 8), true);
      view.setUint32(outPtr + 4, trackId === 0 ? 8 : 14, true);
      view.setUint32(outPtr + 12, trackId, true);
      view.setUint32(outPtr + 20, trackId === 0 ? 0x2d74da : 0x6b7280, true);
      view.setUint32(outPtr + 24, trackId === 1 ? 1 : 0, true);
      return 1;
    },
    state: "idle",
    status() {
      return { state: reader.state };
    },
    trackCount() {
      return 2;
    },
  };

  return { openCalls, queryCalls, reader };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

async function checkInteractiveIngestGate() {
  const runtime = await import(moduleUrl("host/runtime.mjs"));
  const abi = await import(moduleUrl("host/abi.mjs"));
  const rendererModule = await import(moduleUrl("host/progressive-trace-renderer.mjs"));
  const memory = new WebAssembly.Memory({ initial: 1 });
  const canvasHarness = makeCanvasHarness();
  const { frames } = installBrowserHarness(canvasHarness.canvas);
  const coveredRangeRef = { current: null };
  const { openCalls, queryCalls, reader } = makeIndexReader(memory, coveredRangeRef);
  const sourceName = "sources/throttled-100mb.json";
  const sourceNameBytes = new TextEncoder().encode(sourceName);
  const fileSelectionCallbacks = [];
  const workerStatuses = [];
  const ticks = [];
  const importCalls = [];
  let rendererInstance = null;

  const host = {
    [abi.HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE](fileHandle) {
      assert.equal(fileHandle, 77);
      return Promise.resolve(12);
    },
    [abi.HOST_IMPORT_NAME.OPFS_SOURCE_NAME_LEN](sourceId) {
      assert.equal(sourceId, 12);
      return sourceNameBytes.byteLength;
    },
    [abi.HOST_IMPORT_NAME.OPFS_SOURCE_NAME](sourceId, destPtr, destLen) {
      assert.equal(sourceId, 12);
      assert.equal(destLen, sourceNameBytes.byteLength);
      new Uint8Array(memory.buffer, destPtr, destLen).set(sourceNameBytes);
      return sourceNameBytes.byteLength;
    },
    opfs_index_create() {
      return 0;
    },
    setFileSelectedCallback(callback) {
      fileSelectionCallbacks.push(callback);
    },
  };

  const controller = runtime.runApp(memory, host, {
    document: globalThis.document,
    importProgressiveTraceRenderer: async () => {
      importCalls.push(ticks.at(-1) ?? 0);
      return {
        createProgressiveTraceRenderer(nextMemory, ingestWorker, options) {
          rendererInstance = rendererModule.createProgressiveTraceRenderer(
            nextMemory,
            ingestWorker,
            {
              ...options,
              canvas: canvasHarness.canvas,
              minViewportSpan: 10,
              queryOutPtr: 2048,
              queryWindow: 2000,
            },
          );
          return rendererInstance;
        },
      };
    },
    indexReader: reader,
    instantiateWasmModuleForThread: async () => ({
      exports: {
        tracy_main() {
          ticks.push("main");
        },
        tracy_tick(ts) {
          ticks.push(ts);
        },
      },
    }),
    worker: {
      Worker: FakeWorker,
      onWorkerStatus(status, message) {
        workerStatuses.push({ message, status });
      },
      workerUrl: "worker.js",
    },
  });

  await flushMicrotasks();
  assert.equal(fileSelectionCallbacks.length, 1);
  assert.equal(frames.length, 1);

  await runFrame(frames, canvasHarness, 0);
  assert.equal(importCalls.length, 0, "renderer should stay off cold startup");

  fileSelectionCallbacks[0]({
    file: { size: HUNDRED_MB },
    handle: 77,
  });
  await flushMicrotasks();

  assert.deepEqual(controller.worker.posted, [
    {
      indexName: "indexes/throttled-100mb.json.idx",
      sourceName,
      sourceSize: HUNDRED_MB,
      type: "start",
    },
  ]);

  emitProgress(controller.worker, {
    committedPages: 1,
    etaSeconds: null,
    fileOffset: TEN_MB / 10,
    indexedEvents: 2,
    parsedEvents: 3,
    throughputBytesPerSecond: 0,
    totalBytes: HUNDRED_MB,
  });
  coveredRangeRef.current = { end: 120, start: 100, valid: true };
  controller.worker.emit("message", {
    type: "covered_range",
    ...coveredRangeRef.current,
  });
  await flushMicrotasks();

  await runFrame(frames, canvasHarness, 10);
  assert.equal(importCalls.length, 1);
  assert.deepEqual(openCalls, ["indexes/throttled-100mb.json.idx"]);

  await flushMicrotasks();
  await runFrame(frames, canvasHarness, 16);
  assert.ok(
    canvasHarness.firstTraceDrawAt() !== null &&
      canvasHarness.firstTraceDrawAt() <= 100,
    "first indexed events should become visible within 100 ms of file pick",
  );
  assert.equal(queryCalls.length > 0, true);

  emitProgress(controller.worker, {
    committedPages: 4,
    etaSeconds: null,
    fileOffset: TEN_MB,
    indexedEvents: 10,
    parsedEvents: 12,
    throughputBytesPerSecond: TEN_MB,
    totalBytes: HUNDRED_MB,
  });
  coveredRangeRef.current = { end: 1000, start: 100, valid: true };
  controller.worker.emit("message", {
    type: "covered_range",
    ...coveredRangeRef.current,
  });
  await flushMicrotasks();
  await runFrame(frames, canvasHarness, 32);

  assert.equal(controller.status().coveredRange.end, 1000);
  assert.equal(queryCalls.at(-1).tsMax <= 1000, true);
  assert.equal(rendererInstance.status().unknownRange.pending, true);
  assert.equal(
    canvasHarness.operations.some(
      (operation) =>
        operation.op === "fillRect" &&
        operation.fillStyle === "rgba(92, 109, 130, 0.58)",
    ),
    true,
    "partial pages should keep unfinished styling in the gate check",
  );
  assert.equal(
    canvasHarness.operations.some(
      (operation) =>
        operation.op === "fillRect" &&
        operation.fillStyle === "rgba(126, 134, 146, 0.18)",
    ),
    true,
    "unknown time should draw a striped progress affordance",
  );

  canvasHarness.listeners.get("wheel")({
    clientX: 180,
    deltaY: -500,
    preventDefault() {},
  });
  await runFrame(frames, canvasHarness, 48);
  const zoomedViewport = rendererInstance.status().viewport;
  assert.equal(rendererInstance.status().userInteracted, true);
  assert.ok(zoomedViewport.start >= coveredRangeRef.current.start);
  assert.ok(zoomedViewport.end <= coveredRangeRef.current.end);

  canvasHarness.listeners.get("pointerdown")({
    button: 0,
    clientX: 180,
    pointerId: 1,
    preventDefault() {},
  });
  canvasHarness.listeners.get("pointermove")({
    clientX: -5000,
    pointerId: 1,
    preventDefault() {},
  });
  canvasHarness.listeners.get("pointerup")({ pointerId: 1 });
  await runFrame(frames, canvasHarness, 64);
  assert.equal(rendererInstance.status().viewport.end, coveredRangeRef.current.end);
  assert.ok(queryCalls.at(-1).tsMax <= coveredRangeRef.current.end);

  emitProgress(controller.worker, {
    committedPages: 20,
    etaSeconds: 8,
    fileOffset: 2 * TEN_MB,
    indexedEvents: 40,
    parsedEvents: 44,
    throughputBytesPerSecond: TEN_MB,
    totalBytes: HUNDRED_MB,
  });
  await runFrame(frames, canvasHarness, 80);
  assert.equal(controller.status().progress.etaSeconds, 8);
  assert.equal(
    workerStatuses
      .filter((entry) => entry.message?.type === "progress")
      .some((entry) => entry.status.progress?.etaSeconds === null),
    true,
    "early ETA should stay hidden until the rate stabilizes",
  );
  assert.equal(
    workerStatuses.at(-1).status.progress.etaSeconds,
    8,
    "stable ETA should be surfaced once available",
  );

  const numericTicks = ticks.filter((tick) => typeof tick === "number");
  const frameIntervals = numericTicks.slice(1).map((tick, index) => tick - numericTicks[index]);
  assert.ok(
    frameIntervals.every((interval) => interval <= FRAME_BUDGET_MS),
    "pan/zoom frames should stay inside the 60 fps gate during ingest",
  );
}

async function runFrame(frames, canvasHarness, ts) {
  const frame = frames.shift();

  assert.equal(typeof frame, "function", `expected a frame callback at ${ts} ms`);
  canvasHarness.setFrameAt(ts);
  frame(ts);
  await flushMicrotasks();
}

function emitProgress(worker, fields) {
  worker.emit("message", {
    phase: "parse",
    type: "progress",
    ...fields,
  });
}

checkInteractiveIngestGate().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
