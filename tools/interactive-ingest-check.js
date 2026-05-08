#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let FIXTURE_SIZE_BYTES;
let INGEST_WINDOW_BYTES;
let FRAME_BUDGET_MS;

function moduleUrl(relativePath) {
  return pathToFileURL(path.resolve(__dirname, "..", relativePath)).href;
}

function repoPath(relativePath) {
  return path.resolve(__dirname, "..", relativePath);
}

async function loadGeneratedInteractiveIngestCheckSpec() {
  const { INTERACTIVE_INGEST_CHECK } = await import(moduleUrl("host/startup-spec.mjs"));

  FIXTURE_SIZE_BYTES = INTERACTIVE_INGEST_CHECK.FIXTURE_SIZE_BYTES;
  INGEST_WINDOW_BYTES = INTERACTIVE_INGEST_CHECK.INGEST_WINDOW_BYTES;
  FRAME_BUDGET_MS = INTERACTIVE_INGEST_CHECK.FRAME_BUDGET_MS;
}

async function instantiateAppVerifier(memory, host) {
  const bytes = await fs.readFile(repoPath("dist/wasm/app.wasm"));
  const imports = {
    env: { memory },
    host: {
      canvas_get_size() {
        return 0n;
      },
      canvas_listen_resize() {},
      file_picker_open() {
        return 0;
      },
      opfs_create_from_file() {
        return 0;
      },
      opfs_index_create: host.opfs_index_create,
      opfs_index_flush() {
        return 0;
      },
      opfs_index_open: host.opfs_index_open,
      opfs_index_read() {
        return 0;
      },
      opfs_index_size() {
        return 0n;
      },
      opfs_index_write() {
        return 0;
      },
      opfs_read_chunk() {
        return 0;
      },
      opfs_source_from_file: host.opfs_source_from_file,
      opfs_source_name: host.opfs_source_name,
      opfs_source_name_len: host.opfs_source_name_len,
      opfs_source_open: host.opfs_source_open,
      opfs_source_read() {
        return 0;
      },
      opfs_source_size: host.opfs_source_size,
      pointer_listen() {},
    },
  };
  const { instance } = await WebAssembly.instantiate(bytes, imports);

  return instance.exports;
}

function assertInteractiveContractOk(contract, name, args) {
  const fn = contract?.[name];

  assert.equal(typeof fn, "function", `missing Wasm interactive ingest contract export ${name}`);
  assert.equal(fn(...args), 0, `Wasm interactive ingest contract ${name} rejected observations`);
}

function flag(value) {
  return value ? 1 : 0;
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
  const parseOffsets = [
    INGEST_WINDOW_BYTES / 10,
    INGEST_WINDOW_BYTES,
    2 * INGEST_WINDOW_BYTES,
  ];
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

async function flushAsyncWork() {
  await flushMicrotasks();
  await new Promise((resolve) => setImmediate(resolve));
  await flushMicrotasks();
}

async function checkInteractiveIngestGate() {
  await loadGeneratedInteractiveIngestCheckSpec();
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
  let interactiveContract = null;
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
      return FIXTURE_SIZE_BYTES;
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
      interactiveContract = await instantiateAppVerifier(memory, host);
      return {
        exports: {
          ...interactiveContract,
          tracy_main() {
            interactiveContract.tracy_main();
            ticks.push("main");
          },
          tracy_tick(ts) {
            interactiveContract.tracy_tick(ts);
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

  await flushAsyncWork();
  assert.equal(fileSelectionCallbacks.length, 1);
  assert.ok(frames.length >= 1);

  await runFrame(frames, canvasHarness, 0);
  await flushAsyncWork();
  if (frames.length > 0) {
    await runFrame(frames, canvasHarness, 0);
  }
  assertInteractiveContractOk(
    interactiveContract,
    "interactive_ingest_expect_renderer_preload",
    [importCalls.length, flag(rendererInstance !== null)],
  );

  const selectedFile = { name: "throttled-100mb.json", size: FIXTURE_SIZE_BYTES };

  fileSelectionCallbacks[0]({
    file: selectedFile,
    handle: 77,
  });
  await flushMicrotasks();
  await flushMicrotasks();

  const startPosted =
    controller.worker.posted.length === 1 &&
    controller.worker.posted[0]?.ingestId === 1 &&
    controller.worker.posted[0]?.indexName === "indexes/throttled-100mb.json.idx" &&
    controller.worker.posted[0]?.sourceFile === selectedFile &&
    controller.worker.posted[0]?.sourceFileHandle === 77 &&
    controller.worker.posted[0]?.sourceName === sourceName &&
    controller.worker.posted[0]?.sourceSize === FIXTURE_SIZE_BYTES &&
    controller.worker.posted[0]?.type === "start";
  assert.deepEqual(controller.worker.posted, [
    {
      ingestId: 1,
      indexName: "indexes/throttled-100mb.json.idx",
      sourceFile: selectedFile,
      sourceFileHandle: 77,
      sourceName,
      sourceSize: FIXTURE_SIZE_BYTES,
      type: "start",
    },
  ]);
  assertInteractiveContractOk(
    interactiveContract,
    "interactive_ingest_expect_worker_start",
    [
      flag(startPosted),
      flag(
        hostCalls[0]?.[0] === "source-from-file" &&
          hostCalls[0]?.[1] === 77,
      ),
      flag(indexBacking.createdNames.includes("indexes/throttled-100mb.json.idx")),
    ],
  );

  await runFrame(frames, canvasHarness, 10);
  assert.equal(importCalls.length, 1);
  assert.deepEqual(indexBacking.openedNames, ["indexes/throttled-100mb.json.idx"]);

  await flushMicrotasks();
  await runFrame(frames, canvasHarness, 16);
  assertInteractiveContractOk(
    interactiveContract,
    "interactive_ingest_expect_first_events",
    [canvasHarness.firstTraceDrawAt() ?? -1, indexBacking.queryCalls.length],
  );

  await runFrame(frames, canvasHarness, 32);

  assertInteractiveContractOk(
    interactiveContract,
    "interactive_ingest_expect_covered_partial_unknown",
    [
      controller.status().coveredRange.end,
      indexBacking.queryCalls.at(-1).tsMax,
      flag(rendererInstance.status().unknownRange.pending),
      flag(
        canvasHarness.operations.some(
          (operation) =>
            operation.op === "fillRect" &&
            operation.fillStyle === "rgba(92, 109, 130, 0.58)",
        ),
      ),
      flag(
        canvasHarness.operations.some(
          (operation) =>
            operation.op === "fillRect" &&
            operation.fillStyle === "rgba(126, 134, 146, 0.18)",
        ),
      ),
    ],
  );

  canvasHarness.listeners.get("wheel")({
    clientX: 180,
    deltaY: -500,
    preventDefault() {},
  });
  await runFrame(frames, canvasHarness, 48);
  const zoomedViewport = rendererInstance.status().viewport;
  assertInteractiveContractOk(
    interactiveContract,
    "interactive_ingest_expect_zoom_clamped",
    [
      flag(rendererInstance.status().userInteracted),
      zoomedViewport.start,
      zoomedViewport.end,
      controller.status().coveredRange.start,
      controller.status().coveredRange.end,
    ],
  );

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
  assertInteractiveContractOk(
    interactiveContract,
    "interactive_ingest_expect_pan_clamped",
    [
      rendererInstance.status().viewport.end,
      controller.status().coveredRange.end,
      indexBacking.queryCalls.at(-1).tsMax,
    ],
  );

  await runFrame(frames, canvasHarness, 80);
  const progressStatuses = workerStatuses.filter(
    (entry) => entry.message?.type === "progress",
  );
  assertInteractiveContractOk(
    interactiveContract,
    "interactive_ingest_expect_progress_eta",
    [
      controller.status().progress.fileOffset,
      2 * INGEST_WINDOW_BYTES,
      flag(progressStatuses.some((entry) => entry.status.progress?.etaSeconds === null)),
      flag(progressStatuses.some((entry) => entry.status.progress?.etaSeconds > 0)),
    ],
  );

  const numericTicks = ticks.filter((tick) => typeof tick === "number");
  const frameIntervals = numericTicks.slice(1).map((tick, index) => tick - numericTicks[index]);
  for (const interval of frameIntervals) {
    assertInteractiveContractOk(
      interactiveContract,
      "interactive_ingest_expect_frame_interval",
      [interval, FRAME_BUDGET_MS],
    );
  }
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
