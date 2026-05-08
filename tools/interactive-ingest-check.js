#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let FIXTURE_SIZE_BYTES;
let INGEST_WINDOW_BYTES;
let FRAME_BUDGET_MS;

const FIRST_EVENTS_BUDGET_MS = 100;

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

async function instantiateInteractiveIngestVerifier(memory) {
  const bytes = await fs.readFile(
    repoPath("dist/wasm/interactive_ingest_contract.test.wasm"),
  );
  const imports = {
    env: { memory },
    watwat: {
      assert_eq_i32() {},
    },
  };
  const { instance } = await WebAssembly.instantiate(bytes, imports);

  return instance.exports;
}

async function compileDistWasmModule(url) {
  const bytes = await fs.readFile(
    path.resolve(__dirname, "..", url.replace(/^file:\/\//, "")),
  );

  return WebAssembly.compile(bytes);
}

async function instantiateDistWasmModule(module, imports) {
  const instance = await WebAssembly.instantiate(module, imports);

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

function makeElapsedClock() {
  let elapsedMs = 0;
  let running = false;

  return {
    elapsedMs() {
      return elapsedMs;
    },
    frame(ts) {
      if (running) {
        elapsedMs = Math.max(elapsedMs, ts);
      }
    },
    start() {
      elapsedMs = 0;
      running = true;
    },
    wait(ms) {
      if (running) {
        elapsedMs += ms;
      }
    },
  };
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

function makeTraceFile() {
  const encoder = new TextEncoder();
  const firstChunkEvents = [
    { ph: "X", name: "first", ts: 100, dur: 900, pid: 1, tid: 1 },
    { ph: "X", name: "second", ts: 140, dur: 60, pid: 1, tid: 2 },
    { ph: "X", name: "third", ts: 260, dur: 80, pid: 1, tid: 1 },
  ].map((event) => JSON.stringify(event)).join(",");
  const firstChunkPrefix = `{"traceEvents":[${firstChunkEvents},`;
  const secondChunkEvent = JSON.stringify({
    ph: "X",
    name: "tail",
    ts: 980,
    dur: 20,
    pid: 1,
    tid: 2,
  });
  const targetLength = 2 * INGEST_WINDOW_BYTES;
  const paddingLength =
    targetLength -
    firstChunkPrefix.length -
    secondChunkEvent.length -
    "]}".length;

  assert.ok(paddingLength > 0, "interactive ingest fixture padding must be positive");
  const bytes = encoder.encode(
    `${firstChunkPrefix}${" ".repeat(paddingLength)}${secondChunkEvent}]}`,
  );

  return {
    name: "throttled-100mb.json",
    size: FIXTURE_SIZE_BYTES,
    readAt(offset, len) {
      return bytes.subarray(offset, Math.min(bytes.byteLength, offset + len));
    },
  };
}

function makeProductionTopologyOpfsHarness(memory, HOST_IMPORT_NAME) {
  const mainFiles = new Map();
  const durableIndexes = new Map();
  const calls = [];
  let fileSelectedCallback = null;
  let pendingFilePickerOpen = null;
  let nextMainSourceId = 112;
  let nextMainIndexId = 122;
  let nextWorkerSourceId = 212;
  let nextWorkerIndexId = 222;
  const createdWorkerHosts = [];

  function putName(ptr, len) {
    return decodeString(memory, ptr, len);
  }

  function copyToMemory(src, destPtr, len) {
    const dest = new Uint8Array(memory.buffer, destPtr, len);

    dest.fill(0);
    dest.set(src.subarray(0, len));
  }

  function durableIndex(name) {
    const index = durableIndexes.get(name);

    assert.ok(index !== undefined, `OPFS index ${name} should exist before open`);
    return index;
  }

  function makeMainHost() {
    const sources = new Map();
    const indexes = new Map();

    function requireSource(sourceId) {
      const source = sources.get(sourceId);

      assert.ok(source !== undefined, `unknown main OPFS source id ${sourceId}`);
      return source;
    }

    function requireIndex(indexId) {
      const index = indexes.get(indexId);

      assert.ok(index !== undefined, `unknown main OPFS index id ${indexId}`);
      return index;
    }

    const mainHost = {
      calls,
      createdWorkerHosts,
      selectPickedFile(handle, file) {
        assert.notEqual(
          pendingFilePickerOpen,
          null,
          "interactive ingest gate must start from a production file_picker_open call",
        );
        const callback =
          typeof fileSelectedCallback === "function"
            ? fileSelectedCallback
            : fileSelectedCallback?.fn;
        assert.equal(
          typeof callback,
          "function",
          `interactive ingest gate must install the production file-selection callback; calls=${JSON.stringify(calls)}`,
        );
        mainFiles.set(handle, file);
        queueMicrotask(() => callback({ file, handle }));
        pendingFilePickerOpen.resolve(handle);
        pendingFilePickerOpen = null;
      },
      setFileSelectedCallback(callback) {
        calls.push({
          callbackType: typeof callback,
          host: "main",
          op: "set-file-selected-callback",
        });
        fileSelectedCallback = callback;
      },
      [HOST_IMPORT_NAME.FILE_PICKER_OPEN](acceptPtr, acceptLen) {
        assert.equal(
          pendingFilePickerOpen,
          null,
          "interactive ingest gate should not open multiple file pickers at once",
        );
        calls.push({
          accept: putName(acceptPtr, acceptLen),
          host: "main",
          op: "file-picker-open",
        });
        return new Promise((resolve) => {
          pendingFilePickerOpen = { resolve };
        });
      },
      [HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE](fileHandle) {
        const file = mainFiles.get(fileHandle);
        const sourceId = nextMainSourceId;

        assert.ok(file !== undefined, `unknown selected file handle ${fileHandle}`);
        nextMainSourceId += 1;
        calls.push({ handle: fileHandle, host: "main", op: "source-from-file" });
        sources.set(sourceId, {
          file,
          name: `sources/${file.name}`,
          size: file.size,
        });
        return sourceId;
      },
      [HOST_IMPORT_NAME.OPFS_SOURCE_NAME_LEN](sourceId) {
        return new TextEncoder().encode(requireSource(sourceId).name).byteLength;
      },
      [HOST_IMPORT_NAME.OPFS_SOURCE_NAME](sourceId, destPtr, destLen) {
        const encoded = new TextEncoder().encode(requireSource(sourceId).name);

        assert.ok(destLen >= encoded.byteLength);
        new Uint8Array(memory.buffer, destPtr, destLen).set(encoded);
        return encoded.byteLength;
      },
      [HOST_IMPORT_NAME.OPFS_SOURCE_OPEN](namePtr, nameLen) {
        const name = putName(namePtr, nameLen);
        const sourceId = nextMainSourceId;

        nextMainSourceId += 1;
        calls.push({ host: "main", name, op: "source-open" });
        sources.set(sourceId, {
          file: makeTraceFile(),
          name,
          size: FIXTURE_SIZE_BYTES,
        });
        return sourceId;
      },
      [HOST_IMPORT_NAME.OPFS_SOURCE_SIZE](sourceId) {
        return BigInt(requireSource(sourceId).size);
      },
      [HOST_IMPORT_NAME.OPFS_SOURCE_READ](sourceId, offset, len, destPtr) {
        const source = requireSource(sourceId);
        const start = Number(offset);
        const chunk = source.file.readAt(start, len);

        copyToMemory(chunk, destPtr, len);
        return chunk.byteLength;
      },
      [HOST_IMPORT_NAME.OPFS_INDEX_CREATE](namePtr, nameLen) {
        const name = putName(namePtr, nameLen);
        const indexId = nextMainIndexId;

        nextMainIndexId += 1;
        calls.push({ host: "main", id: indexId, name, op: "index-create" });
        durableIndexes.set(name, { bytes: new Uint8Array(0), name });
        indexes.set(indexId, { id: indexId, name });
        return indexId;
      },
      [HOST_IMPORT_NAME.OPFS_INDEX_OPEN](namePtr, nameLen) {
        const name = putName(namePtr, nameLen);
        const indexId = nextMainIndexId;

        durableIndex(name);
        nextMainIndexId += 1;
        calls.push({ host: "main", id: indexId, name, op: "index-open" });
        indexes.set(indexId, { id: indexId, name });
        return indexId;
      },
      [HOST_IMPORT_NAME.OPFS_INDEX_SIZE](indexId) {
        const index = requireIndex(indexId);

        return BigInt(durableIndex(index.name).bytes.byteLength);
      },
      [HOST_IMPORT_NAME.OPFS_INDEX_READ](indexId, offset, len, destPtr) {
        const index = requireIndex(indexId);
        const start = Number(offset);
        const bytes = durableIndex(index.name).bytes;
        const chunk = bytes.subarray(start, Math.min(bytes.byteLength, start + len));

        calls.push({
          host: "main",
          id: indexId,
          len,
          name: index.name,
          offset: start,
          op: "index-read",
        });
        copyToMemory(chunk, destPtr, len);
        return chunk.byteLength;
      },
      [HOST_IMPORT_NAME.OPFS_INDEX_WRITE](indexId, offset, srcPtr, len) {
        const index = requireIndex(indexId);
        const start = Number(offset);
        const end = start + len;
        const durable = durableIndex(index.name);
        const nextBytes =
          end > durable.bytes.byteLength
            ? new Uint8Array(end)
            : new Uint8Array(durable.bytes);

        if (end > durable.bytes.byteLength) {
          nextBytes.set(durable.bytes);
        }
        nextBytes.set(new Uint8Array(memory.buffer, srcPtr, len), start);
        durable.bytes = nextBytes;
        calls.push({
          host: "main",
          id: indexId,
          len,
          name: index.name,
          offset: start,
          op: "index-write",
        });
        return len;
      },
      [HOST_IMPORT_NAME.OPFS_INDEX_FLUSH](indexId) {
        const index = requireIndex(indexId);

        calls.push({ host: "main", id: indexId, name: index.name, op: "index-flush" });
        return 0;
      },
    };

    return mainHost;
  }

  function makeWorkerHost(files) {
    const sources = new Map();
    const indexes = new Map();

    function requireSource(sourceId) {
      const source = sources.get(sourceId);

      assert.ok(source !== undefined, `unknown worker OPFS source id ${sourceId}`);
      return source;
    }

    function requireIndex(indexId) {
      const index = indexes.get(indexId);

      assert.ok(index !== undefined, `unknown worker OPFS index id ${indexId}`);
      return index;
    }

    const workerHost = {
      [HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE](fileHandle) {
        const file = files.get(fileHandle);
        const sourceId = nextWorkerSourceId;

        assert.ok(file !== undefined, `unknown worker selected file handle ${fileHandle}`);
        nextWorkerSourceId += 1;
        calls.push({ handle: fileHandle, host: "worker", op: "source-from-file" });
        sources.set(sourceId, {
          file,
          name: `sources/${file.name}`,
          size: file.size,
        });
        return sourceId;
      },
      [HOST_IMPORT_NAME.OPFS_SOURCE_NAME_LEN](sourceId) {
        return new TextEncoder().encode(requireSource(sourceId).name).byteLength;
      },
      [HOST_IMPORT_NAME.OPFS_SOURCE_NAME](sourceId, destPtr, destLen) {
        const encoded = new TextEncoder().encode(requireSource(sourceId).name);

        assert.ok(destLen >= encoded.byteLength);
        new Uint8Array(memory.buffer, destPtr, destLen).set(encoded);
        return encoded.byteLength;
      },
      [HOST_IMPORT_NAME.OPFS_SOURCE_OPEN](namePtr, nameLen) {
        const name = putName(namePtr, nameLen);

        calls.push({ host: "worker", name, op: "source-open" });
        throw new Error(`worker OPFS source ${name} should come from selected File`);
      },
      [HOST_IMPORT_NAME.OPFS_SOURCE_SIZE](sourceId) {
        return BigInt(requireSource(sourceId).size);
      },
      [HOST_IMPORT_NAME.OPFS_SOURCE_READ](sourceId, offset, len, destPtr) {
        const source = requireSource(sourceId);
        const start = Number(offset);
        const chunk = source.file.readAt(start, len);

        copyToMemory(chunk, destPtr, len);
        return chunk.byteLength;
      },
      [HOST_IMPORT_NAME.OPFS_INDEX_CREATE](namePtr, nameLen) {
        const name = putName(namePtr, nameLen);
        const indexId = nextWorkerIndexId;

        nextWorkerIndexId += 1;
        durableIndexes.set(name, { bytes: new Uint8Array(0), name });
        indexes.set(indexId, { id: indexId, name });
        calls.push({ host: "worker", id: indexId, name, op: "index-create" });
        return indexId;
      },
      [HOST_IMPORT_NAME.OPFS_INDEX_OPEN](namePtr, nameLen) {
        const name = putName(namePtr, nameLen);
        const indexId = nextWorkerIndexId;

        durableIndex(name);
        nextWorkerIndexId += 1;
        indexes.set(indexId, { id: indexId, name });
        calls.push({ host: "worker", id: indexId, name, op: "index-open" });
        return indexId;
      },
      [HOST_IMPORT_NAME.OPFS_INDEX_SIZE](indexId) {
        const index = requireIndex(indexId);

        return BigInt(durableIndex(index.name).bytes.byteLength);
      },
      [HOST_IMPORT_NAME.OPFS_INDEX_READ](indexId, offset, len, destPtr) {
        const index = requireIndex(indexId);
        const start = Number(offset);
        const bytes = durableIndex(index.name).bytes;
        const chunk = bytes.subarray(start, Math.min(bytes.byteLength, start + len));

        calls.push({ host: "worker", id: indexId, len, name: index.name, offset: start, op: "index-read" });
        copyToMemory(chunk, destPtr, len);
        return chunk.byteLength;
      },
      [HOST_IMPORT_NAME.OPFS_INDEX_WRITE](indexId, offset, srcPtr, len) {
        const index = requireIndex(indexId);
        const start = Number(offset);
        const end = start + len;
        const durable = durableIndex(index.name);
        const nextBytes =
          end > durable.bytes.byteLength
            ? new Uint8Array(end)
            : new Uint8Array(durable.bytes);

        if (end > durable.bytes.byteLength) {
          nextBytes.set(durable.bytes);
        }
        nextBytes.set(new Uint8Array(memory.buffer, srcPtr, len), start);
        durable.bytes = nextBytes;
        calls.push({ host: "worker", id: indexId, len, name: index.name, offset: start, op: "index-write" });
        return len;
      },
      [HOST_IMPORT_NAME.OPFS_INDEX_FLUSH](indexId) {
        const index = requireIndex(indexId);

        calls.push({ host: "worker", id: indexId, name: index.name, op: "index-flush" });
        return 0;
      },
    };

    createdWorkerHosts.push(workerHost);
    return workerHost;
  }

  const mainHost = makeMainHost();

  return {
    calls,
    mainHost,
    makeWorkerHost,
  };
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
        y > 0 &&
        height > 0
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

async function flushMicrotasks(count = 32) {
  for (let i = 0; i < count; i += 1) {
    await Promise.resolve();
  }
}

async function flushAsyncWork(elapsedClock = null) {
  await flushMicrotasks();
  await new Promise((resolve) => setImmediate(resolve));
  elapsedClock?.wait(1);
  await flushMicrotasks();
}

function makeTraceRenderPlannerExports() {
  const state = {
    ops: [],
    viewportEnd: 0,
    viewportStart: 0,
  };

  return {
    trace_render_plan_begin(viewportStart, viewportEnd, trackCount, queryRangeBudget, queryWindow) {
      state.viewportStart = viewportStart;
      state.viewportEnd = viewportEnd;
      const rangesPerTrack = Math.max(1, Math.floor(queryRangeBudget / trackCount));
      const tileSpan = Math.max(
        1,
        queryWindow,
        Math.ceil((viewportEnd - viewportStart) / rangesPerTrack),
      );
      const ops = [];
      let queryRangeCount = 0;

      queryLoop:
      for (let trackId = 0; trackId < trackCount; trackId += 1) {
        for (
          let queryStart = viewportStart;
          queryStart < viewportEnd;
          queryStart = Math.min(viewportEnd, queryStart + tileSpan)
        ) {
          if (queryRangeCount >= queryRangeBudget) {
            if (queryStart < viewportEnd) {
              ops.push({ end: viewportEnd, start: queryStart, tag: 2, trackId });
            }
            for (
              let skippedTrackId = trackId + 1;
              skippedTrackId < trackCount;
              skippedTrackId += 1
            ) {
              ops.push({
                end: viewportEnd,
                start: viewportStart,
                tag: 2,
                trackId: skippedTrackId,
              });
            }
            break queryLoop;
          }

          ops.push({
            end: Math.min(viewportEnd, queryStart + tileSpan),
            start: queryStart,
            tag: 1,
            trackId,
          });
          queryRangeCount += 1;
        }
      }

      state.ops = ops;
    },
    trace_render_plan_next() {
      const op = state.ops.shift();

      if (op === undefined) {
        return 0;
      }

      state.currentOp = op;
      return op.tag;
    },
    trace_render_plan_op_end() {
      return state.currentOp?.end ?? state.viewportEnd;
    },
    trace_render_plan_op_start() {
      return state.currentOp?.start ?? state.viewportStart;
    },
    trace_render_plan_op_track_id() {
      return state.currentOp?.trackId ?? 0;
    },
    trace_render_query_ranges_per_track(queryRangeBudget, trackCount) {
      return Math.max(1, Math.floor(queryRangeBudget / trackCount));
    },
    trace_render_query_tile_span(viewportSpan, queryWindow, rangesPerTrack) {
      return Math.max(1, queryWindow, Math.ceil(viewportSpan / rangesPerTrack));
    },
    trace_render_slice_end_x(sliceEnd, viewportStart, viewportSpan, canvasWidth) {
      return Math.min(canvasWidth, ((sliceEnd - viewportStart) / viewportSpan) * canvasWidth);
    },
    trace_render_slice_x(sliceStart, viewportStart, viewportSpan, canvasWidth) {
      return Math.max(0, ((sliceStart - viewportStart) / viewportSpan) * canvasWidth);
    },
    trace_render_slice_y(depth, top, laneHeight, laneGap) {
      return top + depth * (laneHeight + laneGap);
    },
  };
}

async function waitForAsyncCondition(callback, label, timeoutMs = 2000, elapsedClock = null) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (callback()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
    elapsedClock?.wait(1);
    await flushAsyncWork();
  }

  assert.ok(callback(), label);
}

async function runIngestFrame(frames, canvasHarness, ts, elapsedClock) {
  await waitForAsyncCondition(
    () => frames.length > 0,
    `expected a frame callback at ${ts} ms`,
    2000,
    elapsedClock,
  );
  await flushAsyncWork(elapsedClock);
  await runFrame(frames, canvasHarness, ts, elapsedClock);
}

async function checkInteractiveIngestGate() {
  await loadGeneratedInteractiveIngestCheckSpec();
  const runtime = await import(moduleUrl("host/runtime.mjs"));
  const ingestRuntime = await import(moduleUrl("host/ingest-worker-runtime.mjs"));
  const wasmModules = await import(moduleUrl("host/wasm-modules.mjs"));
  const abi = await import(moduleUrl("host/abi.mjs"));
  const rendererModule = await import(moduleUrl("host/progressive-trace-renderer.mjs"));
  const memory = new WebAssembly.Memory({ initial: 8272, maximum: 32768 });
  const canvasHarness = makeCanvasHarness();
  const { frames } = installBrowserHarness(canvasHarness.canvas);
  const sourceName = "sources/throttled-100mb.json";
  const workerStatuses = [];
  const ticks = [];
  const importCalls = [];
  const elapsedClock = makeElapsedClock();
  let rendererInstance = null;
  const interactiveContract = await instantiateInteractiveIngestVerifier(memory);
  const opfsHarness = makeProductionTopologyOpfsHarness(memory, abi.HOST_IMPORT_NAME);
  const host = {
    ...opfsHarness.mainHost,
    [abi.OPFS_BRIDGE_CONTRACT.indexSizeMayBeStaleMarker]: true,
  };
  assert.equal(typeof host.setFileSelectedCallback, "function");
  assert.equal(
    typeof host[abi.HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE],
    "function",
  );
  const wasmModuleCalls = [];

  class RunningIngestWorker extends FakeWorker {
    constructor(url, options) {
      super(url, options);
      this.handler = ingestRuntime.createIngestWorkerMessageHandler({
        hostFactory: (workerMemory, files) => {
          assert.equal(workerMemory, memory);
          assert.ok(files instanceof Map, "worker host should receive selected files");
          assert.equal(files.size, 1, "worker host should receive the selected File by handle");
          const workerHost = opfsHarness.makeWorkerHost(files);

          assert.notEqual(
            workerHost,
            host,
            "interactive ingest gate must use separate main and worker OPFS hosts",
          );
          return workerHost;
        },
        instantiateWasmModuleForThread: async (id, thread, imports) => {
          wasmModuleCalls.push({ id, thread });
          assert.equal(imports.env.memory, memory);
          return wasmModules.instantiateWasmModuleForThread(
            id,
            thread,
            imports,
            {
              baseUrl: "dist/wasm/",
              compile: compileDistWasmModule,
              instantiate: instantiateDistWasmModule,
            },
          );
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
      this.handler({
        data: {
          ...message,
          byteBudget: INGEST_WINDOW_BYTES,
          chunkBytes: INGEST_WINDOW_BYTES / 10,
        },
      }).catch((error) => {
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
        wasmModuleCalls.push({ id, thread });
        return wasmModules.instantiateWasmModuleForThread(
          id,
          thread,
          { env: { memory }, host },
          {
            baseUrl: "dist/wasm/",
            compile: compileDistWasmModule,
            instantiate: instantiateDistWasmModule,
          },
        );
      }

      assert.equal(id, "app");
      assert.equal(thread, "main");
      return {
        exports: {
          ...interactiveContract,
          ...makeTraceRenderPlannerExports(),
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

  await flushAsyncWork();
  assert.ok(
    opfsHarness.calls.some(
      (call) => call.host === "main" && call.op === "file-picker-open",
    ),
    "interactive ingest gate should open the production file picker path",
  );
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

  const selectedFile = makeTraceFile();
  elapsedClock.start();

  host.selectPickedFile(77, selectedFile);
  await flushAsyncWork(elapsedClock);
  await waitForAsyncCondition(
    () =>
      opfsHarness.calls.some(
        (call) => call.host === "worker" &&
          call.op === "index-create" &&
          call.name === "indexes/throttled-100mb.json.idx",
      ) || controller.status().state === "error",
    `worker should create the real OPFS index before the start contract is checked; calls=${JSON.stringify(opfsHarness.calls)} status=${JSON.stringify(controller.status())} posted=${JSON.stringify(controller.worker?.posted ?? [])}`,
    2000,
    elapsedClock,
  );
  assert.notEqual(controller.status().state, "error", controller.status().error);

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
        opfsHarness.calls.some(
          (call) => call.host === "worker" &&
            call.op === "source-from-file" &&
            call.handle === 77,
        ),
      ),
      flag(
        opfsHarness.calls.some(
          (call) => call.host === "worker" &&
            call.op === "index-create" &&
            call.name === "indexes/throttled-100mb.json.idx",
        ),
      ),
    ],
  );

  await runFrame(frames, canvasHarness, 10, elapsedClock);
  assert.equal(importCalls.length, 1);

  let nextFrameAt = 16;
  while (
    nextFrameAt <= 96 &&
    (
      rendererInstance === null ||
      canvasHarness.firstTraceDrawAt() === null
    ) &&
    controller.status().state !== "error"
  ) {
    await runIngestFrame(frames, canvasHarness, nextFrameAt, elapsedClock);
    nextFrameAt += 16;
  }
  if (
    (
      rendererInstance === null ||
      canvasHarness.firstTraceDrawAt() === null
    ) &&
    controller.status().state !== "error"
  ) {
    await runIngestFrame(frames, canvasHarness, 100, elapsedClock);
    nextFrameAt = 116;
  }
  await flushAsyncWork(elapsedClock);
  assert.notEqual(controller.status().state, "error", controller.status().error);
  assert.notEqual(rendererInstance, null, "progressive renderer should be created");
  const firstTraceDrawElapsedMs = elapsedClock.elapsedMs();
  assertInteractiveContractOk(
    interactiveContract,
    "interactive_ingest_expect_first_events",
    [
      canvasHarness.firstTraceDrawAt() ?? -1,
      firstTraceDrawElapsedMs,
      rendererInstance.status().rows,
    ],
  );
  assert.ok(
    firstTraceDrawElapsedMs <= FIRST_EVENTS_BUDGET_MS,
    `first visible events took ${firstTraceDrawElapsedMs}ms after file selection`,
  );
  assert.ok(
    opfsHarness.calls.some(
      (call) => call.host === "main" &&
        call.op === "index-open" &&
        call.name === "indexes/throttled-100mb.json.idx",
    ),
    "main-thread reader should open the worker-written OPFS index",
  );
  assert.ok(
    opfsHarness.mainHost.createdWorkerHosts.length > 0,
    "interactive ingest gate should create an isolated worker OPFS host",
  );
  assert.ok(
    opfsHarness.mainHost.createdWorkerHosts.every((workerHost) => workerHost !== host),
    "main-thread reader must not share its OPFS host object with the worker",
  );
  assert.ok(
    opfsHarness.calls.some(
      (call) => call.host === "worker" &&
        call.op === "index-write" &&
        call.name === "indexes/throttled-100mb.json.idx",
    ),
    "worker should publish index bytes through the named OPFS index",
  );
  assert.ok(
    opfsHarness.calls.some(
      (call) => call.host === "main" &&
        call.op === "index-read" &&
        call.name === "indexes/throttled-100mb.json.idx",
    ),
    "main thread should read worker-published bytes through the named OPFS index",
  );
  assert.ok(
    opfsHarness.calls.findIndex(
      (call) => call.host === "worker" &&
        call.op === "index-write" &&
        call.name === "indexes/throttled-100mb.json.idx",
    ) <
      opfsHarness.calls.findIndex(
        (call) => call.host === "main" &&
          call.op === "index-open" &&
          call.name === "indexes/throttled-100mb.json.idx",
      ),
    "main-thread reader should discover the named index after worker publication",
  );
  assert.equal(
    controller.indexReader.status().state,
    "ready",
    "main-thread reader should be ready for the worker-written OPFS index",
  );
  assert.ok(
    wasmModuleCalls.some((call) => call.id === "parser" && call.thread === "worker"),
    "interactive ingest gate should instantiate the real worker parser module",
  );
  assert.ok(
    wasmModuleCalls.some((call) => call.id === "index" && call.thread === "worker"),
    "interactive ingest gate should instantiate the real worker index module",
  );
  assert.ok(
    wasmModuleCalls.some((call) => call.id === "index" && call.thread === "main"),
    "interactive ingest gate should instantiate the real main-thread index reader module",
  );

  await runFrame(frames, canvasHarness, nextFrameAt);
  nextFrameAt += 16;

  const queryableCoveredRange = controller.indexReader.coveredRange();
  assertInteractiveContractOk(
    interactiveContract,
    "interactive_ingest_expect_covered_partial_unknown",
    [
      queryableCoveredRange.end,
      rendererInstance.status().viewport.end,
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
  await runFrame(frames, canvasHarness, nextFrameAt);
  nextFrameAt += 16;
  const zoomedViewport = rendererInstance.status().viewport;
  assertInteractiveContractOk(
    interactiveContract,
    "interactive_ingest_expect_zoom_clamped",
    [
      flag(rendererInstance.status().userInteracted),
      zoomedViewport.start,
      zoomedViewport.end,
      queryableCoveredRange.start,
      queryableCoveredRange.end,
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
  await runFrame(frames, canvasHarness, nextFrameAt);
  nextFrameAt += 16;
  assertInteractiveContractOk(
    interactiveContract,
    "interactive_ingest_expect_pan_clamped",
    [
      rendererInstance.status().viewport.end,
      queryableCoveredRange.end,
      rendererInstance.status().viewport.end,
    ],
  );

  await runFrame(frames, canvasHarness, nextFrameAt);
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

async function runFrame(frames, canvasHarness, ts, elapsedClock = null) {
  const frame = frames.shift();

  assert.equal(typeof frame, "function", `expected a frame callback at ${ts} ms`);
  elapsedClock?.frame(ts);
  canvasHarness.setFrameAt(ts);
  frame(ts);
  await flushMicrotasks();
}

checkInteractiveIngestGate().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
