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

function decodeString(memory, ptr, len) {
  return new TextDecoder().decode(new Uint8Array(memory.buffer, ptr, len));
}

function makeParserState() {
  return {
    PARSER_DEFAULT_OUTPUT_RECORD_CAP: 4096,
    PARSER_STATE_EVENT_COUNT_OFFSET: 8,
    PARSER_STATE_FILE_OFFSET_OFFSET: 0,
    PARSER_STATUS_DONE: 2,
    PARSER_STATUS_YIELDED: 1,
    parser_state_init(statePtr, sourceId) {
      assert.equal(sourceId, 12);
      const view = new DataView(this.memory.buffer);
      view.setBigUint64(statePtr + this.PARSER_STATE_FILE_OFFSET_OFFSET, 0n, true);
      view.setInt32(statePtr + this.PARSER_STATE_EVENT_COUNT_OFFSET, 0, true);
    },
  };
}

function makeParserExports(memory, parserState) {
  const parseOffsets = [TEN_MB / 10, TEN_MB, 2 * TEN_MB];
  let parseCalls = 0;
  let extracted = 0;
  parserState.memory = memory;

  return {
    extractor_init() {},
    extractor_next() {
      if (extracted >= parseCalls) {
        return -1;
      }

      extracted += 1;
      return 8192 + extracted * 32;
    },
    extractor_reset_cursor() {},
    parser_parse_with_budget(statePtr) {
      const view = new DataView(memory.buffer);

      view.setBigUint64(
        statePtr + parserState.PARSER_STATE_FILE_OFFSET_OFFSET,
        BigInt(parseOffsets[parseCalls]),
        true,
      );
      view.setInt32(
        statePtr + parserState.PARSER_STATE_EVENT_COUNT_OFFSET,
        parseCalls + 1,
        true,
      );
      parseCalls += 1;

      return parseCalls < parseOffsets.length
        ? parserState.PARSER_STATUS_YIELDED
        : parserState.PARSER_STATUS_DONE;
    },
    parser_token_output_reset() {
      return 1;
    },
  };
}

function makeSharedIndexBacking(memory) {
  const backing = {
    createdNames: [],
    events: [],
    openedNames: [],
    queryCalls: [],
    readerIndexId: null,
    writerIndexId: null,
  };

  function coveredRange() {
    if (backing.events.length === 0) {
      return null;
    }

    return {
      start: 100,
      end: backing.events.length >= 3 ? 1000 : 100 + backing.events.length * 10,
    };
  }

  function writeQueryRow(outPtr, trackId, tsMin) {
    const range = coveredRange();
    const view = new DataView(memory.buffer);

    view.setUint32(outPtr, Math.max(range.start, Math.floor(tsMin) + trackId * 8), true);
    view.setUint32(outPtr + 4, trackId === 0 ? 8 : 14, true);
    view.setUint32(outPtr + 12, trackId, true);
    view.setUint32(outPtr + 20, trackId === 0 ? 0x2d74da : 0x6b7280, true);
    view.setUint32(outPtr + 24, trackId === 1 ? 1 : 0, true);
  }

  const exports = {
    INDEX_INGEST_STATUS_OK: 0,
    INDEX_QUERY_RESULT_BYTES: 28,
    INDEX_WRITER_STATUS_OK: 0,
    index_add_event(eventPtr) {
      backing.events.push(eventPtr);
      return 0;
    },
    index_query_range(trackId, tsMin, tsMax, outPtr, maxRows) {
      const range = coveredRange();

      assert.notEqual(backing.readerIndexId, null, "main reader should be opened before queries");
      assert.notEqual(backing.writerIndexId, null, "worker writer should create the index first");
      assert.ok(range !== null, "query should wait for an indexed covered range");
      assert.ok(tsMin >= range.start, "queries should stay inside covered time");
      assert.ok(tsMax <= range.end, "queries should not reach unknown time");
      backing.queryCalls.push({ maxRows, outPtr, trackId, tsMax, tsMin });
      writeQueryRow(outPtr, trackId, tsMin);
      return 1;
    },
    index_reader_configure_cache(slotCount) {
      return slotCount;
    },
    index_reader_covered_range_end() {
      return coveredRange()?.end ?? 0;
    },
    index_reader_covered_range_start() {
      return coveredRange()?.start ?? 0;
    },
    index_reader_covered_range_valid() {
      return coveredRange() === null ? 0 : 1;
    },
    index_reader_init(indexId) {
      assert.equal(indexId, 22);
      backing.readerIndexId = indexId;
    },
    index_track_count() {
      return 2;
    },
    index_writer_committed_events() {
      return backing.events.length;
    },
    index_writer_committed_pages() {
      return backing.events.length === 0 ? 0 : 1;
    },
    index_writer_covered_range_end() {
      return coveredRange()?.end ?? 0;
    },
    index_writer_covered_range_start() {
      return coveredRange()?.start ?? 0;
    },
    index_writer_covered_range_valid() {
      return coveredRange() === null ? 0 : 1;
    },
    index_writer_flush() {
      assert.equal(backing.events.length, 3);
      return 0;
    },
    index_writer_init(indexId) {
      assert.equal(indexId, 22);
      backing.writerIndexId = indexId;
    },
    index_writer_publish_partial() {
      assert.ok(backing.events.length > 0);
      return 0;
    },
  };

  return { backing, exports };
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

async function flushMicrotasks() {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
}

async function checkInteractiveIngestGate() {
  const runtime = await import(moduleUrl("host/runtime.mjs"));
  const ingestRuntime = await import(moduleUrl("host/ingest-worker-runtime.mjs"));
  const abi = await import(moduleUrl("host/abi.mjs"));
  const rendererModule = await import(moduleUrl("host/progressive-trace-renderer.mjs"));
  const memory = new WebAssembly.Memory({ initial: 1 });
  const canvasHarness = makeCanvasHarness();
  const { frames } = installBrowserHarness(canvasHarness.canvas);
  const { backing: indexBacking, exports: indexExports } = makeSharedIndexBacking(memory);
  const parserState = makeParserState();
  const sourceName = "sources/throttled-100mb.json";
  const sourceNameBytes = new TextEncoder().encode(sourceName);
  const fileSelectionCallbacks = [];
  const workerStatuses = [];
  const ticks = [];
  const importCalls = [];
  let rendererInstance = null;
  const hostCalls = [];

  const host = {
    [abi.HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE](fileHandle) {
      assert.equal(fileHandle, 77);
      hostCalls.push(["source-from-file", fileHandle]);
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
    [abi.HOST_IMPORT_NAME.OPFS_SOURCE_OPEN](namePtr, nameLen) {
      const name = decodeString(memory, namePtr, nameLen);

      assert.equal(name, sourceName);
      hostCalls.push(["source-open", name]);
      return Promise.resolve(12);
    },
    [abi.HOST_IMPORT_NAME.OPFS_SOURCE_SIZE](sourceId) {
      assert.equal(sourceId, 12);
      return HUNDRED_MB;
    },
    [abi.HOST_IMPORT_NAME.OPFS_INDEX_CREATE](namePtr, nameLen) {
      const name = decodeString(memory, namePtr, nameLen);

      hostCalls.push(["index-create", name]);
      indexBacking.createdNames.push(name);
      return Promise.resolve(22);
    },
    [abi.HOST_IMPORT_NAME.OPFS_INDEX_OPEN](namePtr, nameLen) {
      const name = decodeString(memory, namePtr, nameLen);

      hostCalls.push(["index-open", name]);
      indexBacking.openedNames.push(name);
      return Promise.resolve(22);
    },
    setFileSelectedCallback(callback) {
      fileSelectionCallbacks.push(callback);
    },
  };

  class RunningIngestWorker extends FakeWorker {
    constructor(url, options) {
      super(url, options);
      this.handler = ingestRuntime.createIngestWorkerMessageHandler({
        hostFactory: () => host,
        instantiateWasmModuleForThread: async (id, thread, imports) => {
          assert.equal(thread, "worker");
          assert.equal(imports.env.memory, memory);
          if (id === "parser") {
            return {
              exports: makeParserExports(memory, parserState),
              imports: {
                alloc: {
                  bump_init() {},
                },
                mem: {
                  MEM_HEAP_BASE: 1024,
                  MEM_STACK_BASE: 2048,
                },
                parser_state: parserState,
              },
            };
          }
          if (id === "index") {
            return { exports: indexExports, imports: {} };
          }

          throw new Error(`unexpected worker module ${id}`);
        },
        memoryFactory: () => memory,
        now: nextWorkerTime,
        postMessage: (message) => {
          if (message?.type === ingestRuntime.INGEST_WORKER_MESSAGE.COMPLETE) {
            this.pendingComplete = message;
            return;
          }

          this.emit("message", message);
        },
      });
    }

    postMessage(message) {
      super.postMessage(message);
      this.handler({ data: message }).catch((error) => {
        this.emit("message", {
          type: ingestRuntime.INGEST_WORKER_MESSAGE.ERROR,
          message: error.message,
        });
      });
    }
  }

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
    instantiateWasmModuleForThread: async (id, thread) => {
      if (id === "index") {
        assert.equal(thread, "main");
        return { exports: indexExports, imports: {} };
      }

      assert.equal(id, "app");
      assert.equal(thread, "main");
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
      Worker: RunningIngestWorker,
      onWorkerStatus(status, message) {
        workerStatuses.push({ message, status });
      },
      workerUrl: "worker.js",
    },
  });

  await flushMicrotasks();
  assert.equal(fileSelectionCallbacks.length, 1);
  assert.equal(frames.length, 2);

  await runFrame(frames, canvasHarness, 0);
  await runFrame(frames, canvasHarness, 0);
  assert.equal(importCalls.length, 1, "renderer module should preload before trace data is queryable");
  assert.equal(rendererInstance, null, "renderer should stay uncreated before queryable pages");

  const selectedFile = { name: "throttled-100mb.json", size: HUNDRED_MB };

  fileSelectionCallbacks[0]({
    file: selectedFile,
    handle: 77,
  });
  await flushMicrotasks();
  await flushMicrotasks();

  assert.deepEqual(controller.worker.posted, [
    {
      ingestId: 1,
      indexName: "indexes/throttled-100mb.json.idx",
      sourceFile: selectedFile,
      sourceFileHandle: 77,
      sourceName,
      sourceSize: HUNDRED_MB,
      type: "start",
    },
  ]);
  assert.deepEqual(hostCalls.slice(0, 2), [
    ["source-from-file", 77],
    ["index-create", "indexes/throttled-100mb.json.idx"],
  ]);
  assert.deepEqual(indexBacking.createdNames, ["indexes/throttled-100mb.json.idx"]);

  await runFrame(frames, canvasHarness, 10);
  assert.equal(importCalls.length, 1);
  assert.deepEqual(indexBacking.openedNames, ["indexes/throttled-100mb.json.idx"]);

  await flushMicrotasks();
  await runFrame(frames, canvasHarness, 16);
  assert.ok(
    canvasHarness.firstTraceDrawAt() !== null &&
      canvasHarness.firstTraceDrawAt() <= 100,
    "first indexed events should become visible within 100 ms of file pick",
  );
  assert.equal(indexBacking.queryCalls.length > 0, true);

  await runFrame(frames, canvasHarness, 32);

  assert.equal(controller.status().coveredRange.end, 1000);
  assert.equal(indexBacking.queryCalls.at(-1).tsMax <= 1000, true);
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
  assert.ok(zoomedViewport.start >= controller.status().coveredRange.start);
  assert.ok(zoomedViewport.end <= controller.status().coveredRange.end);

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
  assert.equal(rendererInstance.status().viewport.end, controller.status().coveredRange.end);
  assert.ok(indexBacking.queryCalls.at(-1).tsMax <= controller.status().coveredRange.end);

  await runFrame(frames, canvasHarness, 80);
  assert.equal(controller.status().progress.fileOffset, 2 * TEN_MB);
  const progressStatuses = workerStatuses.filter(
    (entry) => entry.message?.type === "progress",
  );
  assert.equal(
    progressStatuses.some((entry) => entry.status.progress?.etaSeconds === null),
    true,
    "early ETA should stay hidden until the rate stabilizes",
  );
  assert.equal(
    progressStatuses.some((entry) => entry.status.progress?.etaSeconds > 0),
    true,
    "stable ETA should be surfaced once available",
  );

  const numericTicks = ticks.filter((tick) => typeof tick === "number");
  const frameIntervals = numericTicks.slice(1).map((tick, index) => tick - numericTicks[index]);
  assert.ok(
    frameIntervals.every((interval) => interval <= FRAME_BUDGET_MS),
    "pan/zoom frames should stay inside the 60 fps gate during ingest",
  );
}

function nextWorkerTime() {
  const value = nextWorkerTime.times.shift();

  return value ?? 9000;
}

nextWorkerTime.times = [0, 10, 20, 34, 3034, 3035];

async function runFrame(frames, canvasHarness, ts) {
  const frame = frames.shift();

  assert.equal(typeof frame, "function", `expected a frame callback at ${ts} ms`);
  canvasHarness.setFrameAt(ts);
  frame(ts);
  await flushMicrotasks();
}

checkInteractiveIngestGate().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
