#!/usr/bin/env node

const assert = require("node:assert/strict");
const { performance } = require("node:perf_hooks");
const {
  compileDistWasmModule,
  distWasmModuleOptions,
  instantiateDistWasmModule,
} = require("./acceptance-wasm-helpers.js");
const {
  createFakeWorkerClass,
  flushAsyncWork,
  flushMicrotasks,
  importRepoModule,
  installRuntimeBrowserGlobals,
  makeFakeCanvas,
  makeFakeCanvasContext,
  runAnimationFrame,
} = require("./browser-harness.js");
const {
  FIXTURE_OPERATION: OP,
  makeProductionTopologyFixture,
} = require("./production-topology-fixture.js");
const { constantValue: layoutConstantValue } = require("./layout-spec.js");

let FIXTURE_SIZE_BYTES;
let INGEST_WINDOW_BYTES;
let FRAME_BUDGET_MS;
let FIRST_EVENTS_BUDGET_MS;
let ASYNC_WAIT_TIMEOUT_MS;
let ASYNC_POLL_INTERVAL_MS;
let INTERACTIVE_INGEST_MEMORY_MAXIMUM_PAGES;
let FILE_SELECTION;
let REQUIRED_TRACE_RENDER_PLANNER_EXPORTS;

const INTERACTIVE_INGEST_MEMORY_INITIAL_PAGES = layoutConstantValue("MEM_INITIAL_PAGES");
// The fixture name is deliberately browser-file shaped so the generated
// file-selection contract can derive the source and index paths under test.
const INTERACTIVE_TRACE_FILE_NAME = "throttled-100mb.json";
// Non-zero handle proves selected-file ingest preserves the browser File
// identity through the production handoff instead of accepting a placeholder.
const SELECTED_FILE_HANDLE = 77;
// A single byte is enough to prove the main thread read from the published
// worker index while keeping the observation independent of index encoding.
const MAIN_THREAD_INDEX_READ_PROBE_BYTES = 1;

async function loadGeneratedInteractiveIngestCheckSpec() {
  const { BOOTSTRAP_WASM_MEMORY, INTERACTIVE_INGEST_CHECK, RUNTIME_BRIDGE } =
    await importRepoModule("host/startup-spec.mjs");
  const { TRACE_RENDERER_REQUIRED_EXPORTS } =
    await importRepoModule("host/trace-renderer-spec.mjs");

  FIXTURE_SIZE_BYTES = INTERACTIVE_INGEST_CHECK.FIXTURE_SIZE_BYTES;
  INGEST_WINDOW_BYTES = INTERACTIVE_INGEST_CHECK.INGEST_WINDOW_BYTES;
  FRAME_BUDGET_MS = INTERACTIVE_INGEST_CHECK.FRAME_BUDGET_MS;
  FIRST_EVENTS_BUDGET_MS = INTERACTIVE_INGEST_CHECK.FIRST_EVENTS_BUDGET_MS;
  ASYNC_WAIT_TIMEOUT_MS = INTERACTIVE_INGEST_CHECK.ASYNC_WAIT_TIMEOUT_MS;
  ASYNC_POLL_INTERVAL_MS = INTERACTIVE_INGEST_CHECK.ASYNC_POLL_INTERVAL_MS;
  INTERACTIVE_INGEST_MEMORY_MAXIMUM_PAGES =
    BOOTSTRAP_WASM_MEMORY.BOOTSTRAP_MEMORY_MAXIMUM_PAGES;
  FILE_SELECTION = RUNTIME_BRIDGE.fileSelection;
  REQUIRED_TRACE_RENDER_PLANNER_EXPORTS = TRACE_RENDERER_REQUIRED_EXPORTS;
}

async function instantiateInteractiveIngestVerifier(memory) {
  const imports = {
    env: { memory },
    watwat: {
      assert_eq_i32() {},
    },
  };
  const module = await compileDistWasmModule(
    "dist/wasm/interactive_ingest_contract.test.wasm",
  );

  return instantiateDistWasmModule(module, imports);
}

function assertInteractiveContractOk(contract, name, args) {
  const fn = contract?.[name];

  assert.equal(typeof fn, "function", `missing Wasm interactive ingest contract export ${name}`);
  assert.equal(
    fn(...args),
    0,
    `Wasm interactive ingest contract ${name} rejected observations ${JSON.stringify(args)}`,
  );
}

function flag(value) {
  return value ? 1 : 0;
}

function makeInteractiveIngestMemory() {
  return new WebAssembly.Memory({
    initial: INTERACTIVE_INGEST_MEMORY_INITIAL_PAGES,
    maximum: INTERACTIVE_INGEST_MEMORY_MAXIMUM_PAGES,
  });
}

function sourcePathForTraceName(traceName) {
  return `${FILE_SELECTION.SOURCE_PREFIX}${traceName}`;
}

function indexPathForTraceName(traceName) {
  return `${FILE_SELECTION.INDEX_PREFIX}${traceName}${FILE_SELECTION.INDEX_SUFFIX}`;
}

function writeString(memory, ptr, value) {
  const bytes = new TextEncoder().encode(value);

  new Uint8Array(memory.buffer, ptr, bytes.byteLength).set(bytes);
  return bytes.byteLength;
}

const FakeWorker = createFakeWorkerClass();

function makeTraceFile() {
  const encoder = new TextEncoder();
  const firstChunkEvents = [
    { ph: "X", name: "first", ts: 100, dur: 900, pid: 1, tid: 1 },
    { ph: "X", name: "second", ts: 140, dur: 60, pid: 1, tid: 2 },
    { ph: "X", name: "third", ts: 260, dur: 80, pid: 1, tid: 1 },
  ].map((event) => JSON.stringify(event)).join(",");
  const firstChunkPrefix = `[${firstChunkEvents},`;
  const secondChunkEvent = JSON.stringify({
    ph: "X",
    name: "tail",
    ts: 980,
    dur: 20,
    pid: 1,
    tid: 2,
  });
  const prefixBytes = encoder.encode(firstChunkPrefix);
  const tailBytes = encoder.encode(`${secondChunkEvent}]`);
  const paddingLength = FIXTURE_SIZE_BYTES - prefixBytes.byteLength - tailBytes.byteLength;

  assert.ok(paddingLength > 0, "interactive ingest fixture padding must be positive");
  assert.ok(
    INGEST_WINDOW_BYTES < FIXTURE_SIZE_BYTES,
    "interactive ingest fixture should cover a first ingest window within a larger trace",
  );

  function copyRange(target, targetStart, source, sourceStart, sourceEnd) {
    const overlapStart = Math.max(targetStart, sourceStart);
    const overlapEnd = Math.min(targetStart + target.byteLength, sourceEnd);

    if (overlapStart >= overlapEnd) {
      return;
    }

    target.set(
      source.subarray(overlapStart - sourceStart, overlapEnd - sourceStart),
      overlapStart - targetStart,
    );
  }

  return {
    contentBytes: FIXTURE_SIZE_BYTES,
    name: INTERACTIVE_TRACE_FILE_NAME,
    size: FIXTURE_SIZE_BYTES,
    readAt(offset, len) {
      const start = Math.min(Number(offset), FIXTURE_SIZE_BYTES);
      const end = Math.min(FIXTURE_SIZE_BYTES, start + len);
      const bytes = new Uint8Array(Math.max(0, end - start));

      bytes.fill(0x20);
      copyRange(bytes, start, prefixBytes, 0, prefixBytes.byteLength);
      copyRange(
        bytes,
        start,
        tailBytes,
        FIXTURE_SIZE_BYTES - tailBytes.byteLength,
        FIXTURE_SIZE_BYTES,
      );
      return bytes;
    },
  };
}

function makeCanvasHarness() {
  const listeners = new Map();
  const operations = [];
  let currentFrameAt = 0;
  let firstTraceDrawAt = null;
  let firstTraceDrawWallAt = null;
  const context = makeFakeCanvasContext({
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
        fillStyle: this.fillStyle ?? this.lastFillStyle,
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
        firstTraceDrawWallAt = performance.now();
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
  });
  const canvas = makeFakeCanvas({
    context,
    height: 180,
    width: 360,
    elementOverrides: {
      height: 180,
      width: 360,
      addEventListener(type, callback) {
        listeners.set(type, callback);
      },
      getContext(type) {
        assert.equal(type, "2d");
        return context;
      },
      releasePointerCapture() {},
      setPointerCapture() {},
    },
  });

  return {
    canvas,
    firstTraceDrawAt() {
      return firstTraceDrawAt;
    },
    firstTraceDrawWallAt() {
      return firstTraceDrawWallAt;
    },
    listeners,
    operations,
    setFrameAt(value) {
      currentFrameAt = value;
    },
  };
}

function assertProductionTraceRenderPlannerExports(exports) {
  for (const name of REQUIRED_TRACE_RENDER_PLANNER_EXPORTS) {
    assert.equal(
      typeof exports?.[name],
      "function",
      `production app.wasm missing required renderer planner export ${name}`,
    );
  }
}

async function waitForAsyncCondition(
  callback,
  label,
  timeoutMs = ASYNC_WAIT_TIMEOUT_MS,
) {
  const deadline = performance.now() + timeoutMs;

  while (performance.now() < deadline) {
    if (callback()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, ASYNC_POLL_INTERVAL_MS));
    await flushAsyncWork();
  }

  assert.ok(callback(), label);
}

async function waitForAsyncAction(
  callback,
  label,
  timeoutMs = ASYNC_WAIT_TIMEOUT_MS,
) {
  const deadline = performance.now() + timeoutMs;
  let lastError = null;

  while (performance.now() < deadline) {
    try {
      return await callback();
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, ASYNC_POLL_INTERVAL_MS));
    await flushAsyncWork();
  }

  assert.fail(
    `${label}; lastError=${lastError?.message ?? String(lastError)}`,
  );
}

async function checkInteractiveIngestGate() {
  await loadGeneratedInteractiveIngestCheckSpec();
  const runtime = await importRepoModule("host/runtime.mjs");
  const ingestRuntime = await importRepoModule("host/ingest-worker-runtime.mjs");
  const wasmModules = await importRepoModule("host/wasm-modules.mjs");
  const abi = await importRepoModule("host/abi.mjs");
  const rendererModule = await importRepoModule("host/progressive-trace-renderer.mjs");
  const memory = makeInteractiveIngestMemory();
  const canvasHarness = makeCanvasHarness();
  const { frames } = installRuntimeBrowserGlobals({ canvas: canvasHarness.canvas });
  const sourceName = sourcePathForTraceName(INTERACTIVE_TRACE_FILE_NAME);
  const indexName = indexPathForTraceName(INTERACTIVE_TRACE_FILE_NAME);
  const workerStatuses = [];
  const importCalls = [];
  const frameDurations = [];
  const wasmModuleWarmups = [];
  const workerWasmCompileCache = new Map();
  let rendererInstance = null;
  let workerHostSawIndependentMemory = false;
  let workerImportSawIndependentMemory = false;
  const interactiveContract = await instantiateInteractiveIngestVerifier(memory);
  const opfsHarness = makeProductionTopologyFixture({
    HOST_IMPORT_NAME: abi.HOST_IMPORT_NAME,
    mainMemory: memory,
  });
  const host = {
    ...opfsHarness.mainHost,
    [abi.HOST_IMPORT_NAME.CANVAS_GET_SIZE]() {
      return (BigInt(canvasHarness.canvas.height) << 32n) | BigInt(canvasHarness.canvas.width);
    },
    [abi.HOST_IMPORT_NAME.CANVAS_LISTEN_RESIZE]() {},
    [abi.HOST_IMPORT_NAME.POINTER_LISTEN]() {},
  };
  assert.equal(typeof host.setFileSelectedCallback, "function");
  assert.equal(
    opfsHarness.mainHost[abi.OPFS_BRIDGE_CONTRACT.indexSizeMayBeStaleMarker],
    abi.OPFS_BRIDGE_CONTRACT.mainIndexSizeMayBeStale,
    "production topology fixture main host should expose the OPFS stale-size marker",
  );
  assert.equal(
    host[abi.OPFS_BRIDGE_CONTRACT.indexSizeMayBeStaleMarker],
    abi.OPFS_BRIDGE_CONTRACT.mainIndexSizeMayBeStale,
    "interactive ingest host should inherit the OPFS stale-size marker from the fixture",
  );
  assert.equal(
    typeof host[abi.HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE],
    "function",
  );
  const wasmModuleCalls = [];
  const appWasm = await wasmModules.instantiateWasmModuleForThread(
    "app",
    "main",
    { env: { memory }, host },
    distWasmModuleOptions(),
  );
  assertProductionTraceRenderPlannerExports(appWasm.exports);

  class RunningIngestWorker extends FakeWorker {
    constructor(url, options) {
      super(url, options);
      this.didYieldForFrame = false;
      this.memory = makeInteractiveIngestMemory();
      // COVERED_RANGE delivery opens the main-thread reader, so this queue
      // stays closed until workerPublication records the production handoff.
      this.coveredRangesReleased = false;
      this.pendingCoveredRanges = [];
      assert.notEqual(
        this.memory,
        memory,
        "interactive ingest gate must use independent main and worker Wasm memories",
      );
      this.handler = ingestRuntime.createIngestWorkerMessageHandler({
        afterParserYield: async () => {
          if (this.didYieldForFrame && canvasHarness.firstTraceDrawAt() !== null) {
            return;
          }
          this.didYieldForFrame = true;
          await new Promise((resolve) => setTimeout(resolve, 0));
        },
        ...distWasmModuleOptions({
          compile: (url, id) => {
            wasmModuleWarmups.push({ id, thread: "worker" });
            if (!workerWasmCompileCache.has(id)) {
              workerWasmCompileCache.set(id, compileDistWasmModule(url));
            }
            return workerWasmCompileCache.get(id);
          },
        }),
        hostFactory: (workerMemory, files) => {
          assert.equal(workerMemory, this.memory);
          assert.notEqual(
            workerMemory,
            memory,
            "worker host must not receive the main-thread Wasm memory",
          );
          workerHostSawIndependentMemory = true;
          assert.ok(files instanceof Map, "worker host should receive selected files");
          assert.equal(files.size, 1, "worker host should receive the selected File by handle");
          const workerHost = opfsHarness.createWorkerHost({
            files,
            memory: workerMemory,
          });

          assert.notEqual(
            workerHost,
            opfsHarness.mainHost,
            "interactive ingest gate must use separate main and worker OPFS hosts",
          );
          assert.equal(
            Object.hasOwn(
              workerHost,
              abi.OPFS_BRIDGE_CONTRACT.indexSizeMayBeStaleMarker,
            ),
            false,
            "worker OPFS hosts must not expose the main-thread stale-size marker",
          );
          return workerHost;
        },
        instantiateWasmModuleForThread: async (id, thread, imports) => {
          wasmModuleCalls.push({ id, thread });
          assert.equal(imports.env.memory, this.memory);
          assert.notEqual(
            imports.env.memory,
            memory,
            "worker Wasm modules must not import the main-thread Wasm memory",
          );
          workerImportSawIndependentMemory = true;
          return wasmModules.instantiateWasmModuleForThread(
            id,
            thread,
            imports,
            distWasmModuleOptions({
              compile: (url, moduleId) =>
                workerWasmCompileCache.get(moduleId) ?? compileDistWasmModule(url),
            }),
          );
        },
        memoryFactory: () => this.memory,
        now: nextWorkerTime,
        postMessage: (message) => {
          if (
            message?.type === ingestRuntime.INGEST_WORKER_MESSAGE.COVERED_RANGE &&
            !this.coveredRangesReleased
          ) {
            this.pendingCoveredRanges.push(message);
            return;
          }
          if (message?.type === ingestRuntime.INGEST_WORKER_MESSAGE.COMPLETE) {
            this.pendingComplete = message;
            return;
          }

          opfsHarness.scenario.workerMessageDelivery({ indexName, message, worker: this });
        },
      });
    }

    async flushCoveredRanges() {
      await waitForAsyncAction(
        () =>
          opfsHarness.scenario.workerPublication({
            indexName,
          }),
        `worker should publish the current OPFS index before covered_range delivery; calls=${JSON.stringify(opfsHarness.calls)}`,
      );
      this.coveredRangesReleased = true;
      while (this.pendingCoveredRanges.length > 0) {
        opfsHarness.scenario.workerMessageDelivery({
          indexName,
          message: this.pendingCoveredRanges.shift(),
          worker: this,
        });
      }
      this.coveredRangesReleased = false;
    }

    flushComplete() {
      if (this.pendingComplete !== undefined) {
        opfsHarness.scenario.workerMessageDelivery({
          message: this.pendingComplete,
          worker: this,
        });
        this.pendingComplete = undefined;
      }
    }

    postMessage(message) {
      super.postMessage(message);
      setImmediate(() => {
        this.handler({
          data: {
            ...message,
            byteBudget: INGEST_WINDOW_BYTES / 10,
            chunkBytes: 64 * 1024,
          },
        }).catch((error) => {
          this.emit("message", {
            type: ingestRuntime.INGEST_WORKER_MESSAGE.ERROR,
            message: error.message,
          });
        });
      });
    }
  }

  const controller = runtime.runApp(memory, host, {
    document: globalThis.document,
    importProgressiveTraceRenderer: async () => {
      importCalls.push(performance.now());
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
          distWasmModuleOptions(),
        );
      }

      assert.equal(id, "app");
      assert.equal(thread, "main");
      wasmModuleCalls.push({ id, thread });
      return appWasm;
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
  assert.equal(
    opfsHarness.calls.some(
      (call) => call.host === "main" && call.op === OP.filePickerOpen,
    ),
    false,
    "interactive ingest gate should not open the file picker during app load",
  );
  await waitForAsyncCondition(
    () => frames.length >= 1,
    "interactive ingest gate should schedule frames before production preload",
  );
  await runInteractiveFrame(frames, canvasHarness, 0);
  await flushAsyncWork();
  await waitForAsyncCondition(
    () => frames.length >= 1,
    "interactive ingest gate should schedule an app-ready follow-up frame before ingest preload",
  );
  const appReadyFrameCallbacks = frames.splice(0);
  while (appReadyFrameCallbacks.length > 0) {
    await runInteractiveFrame(appReadyFrameCallbacks, canvasHarness, 16);
  }
  await flushAsyncWork();
  await waitForAsyncCondition(
    () => typeof canvasHarness.listeners.get("click") === "function",
    "interactive ingest gate should wire file picking to a user gesture without waiting for ingest preload",
  );
  await waitForAsyncCondition(
    () => opfsHarness.calls.some(
      (call) => call.host === "main" && call.op === OP.setFileSelectedCallback,
    ),
    "interactive ingest gate should install the production file-selection callback during startup",
  );
  const selectedFile = makeTraceFile();

  canvasHarness.listeners.get("click")({ preventDefault() {} });
  await flushAsyncWork();
  assert.ok(
    opfsHarness.calls.some(
      (call) => call.host === "main" && call.op === OP.filePickerOpen,
    ),
    "interactive ingest gate should open the production file picker path from a user gesture",
  );

  await waitForAsyncCondition(
    () => wasmModuleCalls.some((call) => call.id === "index" && call.thread === "main"),
    "interactive ingest gate should production-preload the main-thread index reader while the file picker is open",
  );
  await waitForAsyncCondition(
    () => wasmModuleWarmups.some((call) => call.id === "parser" && call.thread === "worker") &&
      wasmModuleWarmups.some((call) => call.id === "index" && call.thread === "worker"),
    "interactive ingest gate should production-preload worker parser/index wasm while the file picker is open",
  );
  await waitForAsyncCondition(
    () => frames.length >= 1,
    "interactive ingest gate should schedule frames after production preload",
  );
  if (frames.length > 0) {
    await runInteractiveFrame(frames, canvasHarness, 0);
  }
  assertInteractiveContractOk(
    interactiveContract,
    "interactive_ingest_expect_renderer_preload",
    [importCalls.length, flag(rendererInstance !== null)],
  );

  const fileSelectionStartedAt = performance.now();

  opfsHarness.scenario.selectedFileIngest({
    file: selectedFile,
    handle: SELECTED_FILE_HANDLE,
  });
  await flushMicrotasks(1);
  assert.notEqual(controller.status().state, "error", controller.status().error);

  const ingestStarts = controller.worker.posted.filter(
    (message) => message?.type === "start",
  );
  const startPosted =
    ingestStarts.length === 1 &&
    ingestStarts[0]?.ingestId === 1 &&
    ingestStarts[0]?.indexName === indexName &&
    ingestStarts[0]?.sourceFile === selectedFile &&
    ingestStarts[0]?.sourceFileHandle === SELECTED_FILE_HANDLE &&
    ingestStarts[0]?.sourceName === sourceName &&
    ingestStarts[0]?.sourceSize === FIXTURE_SIZE_BYTES;
  assert.deepEqual(ingestStarts, [
    {
      ingestId: 1,
      indexName,
      sourceFile: selectedFile,
      sourceFileHandle: SELECTED_FILE_HANDLE,
      sourceName,
      sourceSize: FIXTURE_SIZE_BYTES,
      type: "start",
    },
  ]);

  const workerIndexId = await waitForAsyncAction(
    () =>
      opfsHarness.scenario.workerPublication({
        indexName,
      }),
    `worker should publish the real OPFS index through the scenario helper; calls=${JSON.stringify(opfsHarness.calls)} status=${JSON.stringify(controller.status())} posted=${JSON.stringify(controller.worker?.posted ?? [])}`,
  );
  assert.notEqual(controller.status().state, "error", controller.status().error);
  assert.equal(
    workerIndexId,
    opfsHarness.calls.find(
      (call) => call.host === "worker" &&
        call.op === OP.indexCreate &&
        call.name === indexName,
    )?.id,
  );
  await controller.worker.flushCoveredRanges();
  await flushAsyncWork();

  let nextFrameAt = 10;
  while (
    performance.now() - fileSelectionStartedAt <= FIRST_EVENTS_BUDGET_MS &&
    (
      rendererInstance === null ||
      canvasHarness.firstTraceDrawAt() === null
    ) &&
    controller.status().state !== "error"
  ) {
    if (frames.length === 0) {
      await flushAsyncWork();
      if (controller.worker?.pendingCoveredRanges?.length > 0) {
        await controller.worker.flushCoveredRanges();
      }
      continue;
    }

    await runInteractiveFrame(frames, canvasHarness, nextFrameAt, frameDurations);
    await flushAsyncWork();
    if (controller.worker?.pendingCoveredRanges?.length > 0) {
      await controller.worker.flushCoveredRanges();
    }
    nextFrameAt += 16;
  }
  await flushAsyncWork();
  assert.notEqual(controller.status().state, "error", controller.status().error);
  assert.notEqual(
    rendererInstance,
    null,
    `progressive renderer should be created within ${FIRST_EVENTS_BUDGET_MS}ms; elapsed=${performance.now() - fileSelectionStartedAt}ms status=${JSON.stringify(controller.status())} frames=${frames.length} calls=${JSON.stringify(opfsHarness.calls)}`,
  );
  assert.equal(importCalls.length, 1);
  const firstTraceDrawElapsedMs =
    (canvasHarness.firstTraceDrawWallAt() ?? performance.now()) -
    fileSelectionStartedAt;
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
  assert.equal(
    await waitForAsyncAction(
      () =>
        opfsHarness.scenario.workerPublication({
          indexName,
        }),
      `worker should publish the final OPFS index generation before main-thread open; calls=${JSON.stringify(opfsHarness.calls)} status=${JSON.stringify(controller.status())} posted=${JSON.stringify(controller.worker?.posted ?? [])}`,
    ),
    workerIndexId,
  );
  assertInteractiveContractOk(
    interactiveContract,
    "interactive_ingest_expect_worker_start",
    [
      flag(startPosted),
      flag(
        opfsHarness.calls.some(
          (call) => call.host === "worker" &&
            call.op === OP.sourceFromFile &&
            call.handle === SELECTED_FILE_HANDLE,
        ),
      ),
      flag(
        opfsHarness.calls.some(
          (call) => call.host === "worker" &&
            call.op === OP.indexCreate &&
            call.name === indexName,
        ),
      ),
    ],
  );
  assertInteractiveContractOk(
    interactiveContract,
    "interactive_ingest_expect_independent_memories",
    [
      flag(controller.worker.memory !== memory),
      flag(workerHostSawIndependentMemory),
      flag(workerImportSawIndependentMemory),
    ],
  );
  assert.ok(
    opfsHarness.calls.some(
      (call) => call.host === "worker" &&
        call.op === OP.workerMessageDelivery,
    ),
    "worker should deliver progress through the typed message-delivery helper",
  );
  const mainThreadIndexId = opfsHarness.scenario.mainThreadIndexOpen({
    indexName,
    observeOnly: true,
  });
  assert.ok(
    opfsHarness.calls.some(
      (call) => call.host === "main" &&
        call.op === OP.mainThreadIndexOpen &&
        call.name === indexName,
    ),
    "main-thread reader should open the worker-written OPFS index",
  );
  assert.ok(
    opfsHarness.mainHost.createdWorkerHosts.length > 0,
    "interactive ingest gate should create an isolated worker OPFS host",
  );
  assert.ok(
    opfsHarness.mainHost.createdWorkerHosts.every(
      (workerHost) => workerHost !== opfsHarness.mainHost,
    ),
    "main-thread reader must not share its OPFS host object with the worker",
  );
  assert.ok(
    opfsHarness.mainHost.createdWorkerHosts.every(
      (workerHost) =>
        !Object.hasOwn(
          workerHost,
          abi.OPFS_BRIDGE_CONTRACT.indexSizeMayBeStaleMarker,
        ),
    ),
    "worker OPFS hosts must not expose the main-thread stale-size marker",
  );
  assert.ok(
    opfsHarness.calls.some(
      (call) => call.host === "worker" &&
        call.op === OP.workerPublication &&
        call.name === indexName,
    ),
    "worker should publish index bytes through the named OPFS index",
  );
  const observedMainThreadIndexReadCount =
    opfsHarness.scenario.mainThreadIndexRead({
      indexId: mainThreadIndexId,
      len: MAIN_THREAD_INDEX_READ_PROBE_BYTES,
      observeOnly: true,
    });
  assert.ok(
    observedMainThreadIndexReadCount >= MAIN_THREAD_INDEX_READ_PROBE_BYTES,
    "observe-only helper should validate the production main-thread OPFS index read",
  );
  assert.ok(
    opfsHarness.calls.some(
      (call) => call.host === "main" &&
        call.op === OP.mainThreadIndexRead &&
        call.name === indexName,
    ),
    "main thread should read worker-published bytes through the named OPFS index",
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
  assert.ok(
    wasmModuleCalls.some((call) => call.id === "app" && call.thread === "main"),
    "interactive ingest gate should instantiate the real production app renderer planner module",
  );

  await runInteractiveFrame(frames, canvasHarness, nextFrameAt, frameDurations);
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
  await runInteractiveFrame(frames, canvasHarness, nextFrameAt, frameDurations);
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
  await runInteractiveFrame(frames, canvasHarness, nextFrameAt, frameDurations);
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

  await runInteractiveFrame(frames, canvasHarness, nextFrameAt, frameDurations);
  const progressStatuses = workerStatuses.filter(
    (entry) => entry.message?.type === "progress",
  );
  const largeTraceCheckpoint = progressStatuses.find(
    (entry) =>
      entry.message.fileOffset > INGEST_WINDOW_BYTES &&
      entry.message.fileOffset < FIXTURE_SIZE_BYTES,
  );

  assert.ok(
    largeTraceCheckpoint,
    `interactive ingest gate should observe sustained progress around ${INGEST_WINDOW_BYTES} bytes before completion`,
  );
  assertInteractiveContractOk(
    interactiveContract,
    "interactive_ingest_expect_large_trace_checkpoint",
    [
      largeTraceCheckpoint.message.fileOffset,
      largeTraceCheckpoint.message.totalBytes,
      INGEST_WINDOW_BYTES,
      FIXTURE_SIZE_BYTES,
      flag(queryableCoveredRange.end >= 1000),
      selectedFile.contentBytes,
    ],
  );
  assertInteractiveContractOk(
    interactiveContract,
    "interactive_ingest_expect_progress_eta",
    [
      largeTraceCheckpoint.message.fileOffset,
      INGEST_WINDOW_BYTES,
      flag(progressStatuses.some((entry) => entry.status.progress?.etaSeconds === null)),
      flag(progressStatuses.some((entry) => entry.status.progress?.etaSeconds > 0)),
    ],
  );

  controller.worker.flushComplete();
  assert.equal(
    controller.status().state,
    "complete",
    "interactive ingest gate should release the deferred worker completion after active-ingest assertions",
  );

  assert.ok(frameDurations.length > 0, "interactive ingest gate should record real frame durations");
  for (const duration of frameDurations) {
    assertInteractiveContractOk(
      interactiveContract,
      "interactive_ingest_expect_frame_interval",
      [duration, FRAME_BUDGET_MS],
    );
    assert.ok(
      duration <= FRAME_BUDGET_MS,
      `frame callback took ${duration}ms, over ${FRAME_BUDGET_MS}ms budget`,
    );
  }
}

function nextWorkerTime() {
  const value = nextWorkerTime.times.shift();

  return value ?? 9000;
}

nextWorkerTime.times = [0, 10, 20, 34, 3034, 3035];

async function runInteractiveFrame(frames, canvasHarness, ts, frameDurations = null) {
  await runAnimationFrame(frames, ts, {
    beforeFrame: (timestamp) => canvasHarness.setFrameAt(timestamp),
    frameDurations,
    performance,
  });
}

checkInteractiveIngestGate().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
