#!/usr/bin/env node

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const OPFS_PAGE_SIZE = 0x00010000;
const INDEX_DECODE_HINT_COMPACT_SLICES = 1;
const INDEX_DECODE_HINT_TRACK_ID_SHIFT = 8;
const INDEX_PAGE_HEADER_BUCKET_START_OFFSET = 12;
const INDEX_PAGE_HEADER_BUCKET_END_OFFSET = 20;
const INDEX_PAGE_HEADER_RECORD_COUNT_OFFSET = 28;
const INDEX_PAGE_HEADER_DECODE_HINTS_OFFSET = 36;

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
  const indexReaderOpenCalls = [];
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
    indexReader: {
      open(indexName) {
        indexReaderOpenCalls.push(indexName);
        return Promise.resolve(true);
      },
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
    { kind: "mark", name: "tracy.core.start" },
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
    { kind: "mark", name: "tracy.core.ready" },
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
      ingestId: 1,
      indexName: "indexes/trace.idx",
      sourceName: "sources/trace.json",
      type: "start",
    },
  ]);
  assert.equal(controller.status().state, "running");

  worker.emit("message", {
    ingestId: 1,
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
    ingestId: 1,
    type: "covered_range",
    valid: true,
    start: 100,
    end: 132,
  });
  worker.emit("message", {
    ingestId: 1,
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
  assert.deepEqual(indexReaderOpenCalls, ["indexes/trace.idx"]);
  assert.equal(controller.status().result.committedEvents, 7);
  assert.equal(workerStatus.at(-1).status.state, "complete");

  const controllerWithError = runtime.createIngestWorkerController({
    Worker: FakeWorker,
    onWorkerStatus(status, message) {
      workerMessages.push({ status, message });
    },
  });
  assert.equal(controllerWithError.worker, null);
  controllerWithError.start();
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
  const callbacks = [];
  const workerStatus = [];
  const selectedFile = { name: "selected trace.json", size: 1234 };
  let opfsCopyStarted = false;
  const host = {
    [abi.HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE]() {
      opfsCopyStarted = true;
      return new Promise(() => {});
    },
    opfs_index_create() {
      return 0;
    },
    setFileSelectedCallback(callback) {
      callbacks.push(callback);
    },
  };

  const controller = runtime.runApp(memory, host, {
    indexReader: false,
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

  assert.equal(callbacks.length, 1);
  assert.equal(controller.worker, null);

  callbacks[0]({ file: selectedFile, handle: 9 });
  await Promise.resolve();
  await Promise.resolve();

  const worker = controller.worker;
  assert.equal(
    opfsCopyStarted,
    false,
    "file selection should post worker ingest before any full OPFS copy",
  );
  assert.deepEqual(worker.posted, [
    {
      ingestId: 1,
      indexName: "indexes/selected_trace.json.idx",
      sourceFile: selectedFile,
      sourceFileHandle: 9,
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

async function checkRuntimeIgnoresStaleIngestWorkerMessages() {
  installBrowserStubs();

  const runtime = await import(moduleUrl("host/runtime.mjs"));
  const indexReaderOpenCalls = [];
  const workerStatus = [];
  const controller = runtime.createIngestWorkerController({
    Worker: FakeWorker,
    indexReader: {
      open(indexName) {
        indexReaderOpenCalls.push(indexName);
        return Promise.resolve(true);
      },
    },
    onWorkerStatus(status, message) {
      workerStatus.push({ message, status });
    },
    workerUrl: "worker.js",
  });

  assert.equal(
    controller.start({
      indexName: "indexes/first.idx",
      sourceName: "sources/first.json",
    }),
    true,
  );
  const firstWorker = controller.worker;

  assert.deepEqual(firstWorker.posted, [
    {
      ingestId: 1,
      indexName: "indexes/first.idx",
      sourceName: "sources/first.json",
      type: "start",
    },
  ]);

  assert.equal(
    controller.start({
      indexName: "indexes/second.idx",
      sourceName: "sources/second.json",
    }),
    true,
  );
  const secondWorker = controller.worker;

  assert.notEqual(secondWorker, firstWorker);
  assert.equal(firstWorker.terminated, true);
  assert.deepEqual(secondWorker.posted, [
    {
      ingestId: 2,
      indexName: "indexes/second.idx",
      sourceName: "sources/second.json",
      type: "start",
    },
  ]);

  firstWorker.emit("message", {
    committedPages: 99,
    fileOffset: 999,
    ingestId: 1,
    type: "progress",
  });
  firstWorker.emit("message", {
    end: 999,
    ingestId: 1,
    start: 900,
    type: "covered_range",
    valid: true,
  });
  firstWorker.emit("message", {
    committedEvents: 999,
    ingestId: 1,
    type: "complete",
  });

  assert.equal(controller.status().state, "running");
  assert.equal(controller.status().progress, null);
  assert.equal(controller.status().coveredRange, null);
  assert.equal(controller.status().result, null);
  assert.deepEqual(indexReaderOpenCalls, []);

  firstWorker.events.get("error")({ message: "old worker crashed" });
  assert.equal(controller.status().state, "running");
  assert.equal(controller.status().error, null);

  secondWorker.emit("message", {
    committedPages: 2,
    fileOffset: 64,
    ingestId: 2,
    type: "progress",
  });
  secondWorker.emit("message", {
    end: 132,
    ingestId: 2,
    start: 100,
    type: "covered_range",
    valid: true,
  });
  secondWorker.emit("message", {
    committedEvents: 7,
    ingestId: 2,
    type: "complete",
  });

  assert.equal(controller.status().state, "complete");
  assert.equal(controller.status().progress.fileOffset, 64);
  assert.equal(controller.status().coveredRange.end, 132);
  assert.equal(controller.status().result.committedEvents, 7);
  assert.deepEqual(indexReaderOpenCalls, ["indexes/second.idx"]);
  assert.equal(workerStatus.at(-1).message.ingestId, 2);
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
    indexReader: false,
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

async function checkMainThreadIndexReaderQueriesCommittedPages() {
  const runtime = await import(moduleUrl("host/runtime.mjs"));
  const abi = await import(moduleUrl("host/abi.mjs"));
  const memory = new WebAssembly.Memory({ initial: 1 });
  const view = new DataView(memory.buffer);
  const pagePtr = 32768;
  const pageCatalog = [];
  const pageRecords = [
    {
      bucketEnd: 140,
      bucketStart: 100,
      recordCount: 3,
      trackId: 4,
    },
    {
      bucketEnd: 180,
      bucketStart: 140,
      recordCount: 2,
      trackId: 4,
    },
    {
      bucketEnd: 220,
      bucketStart: 180,
      recordCount: 4,
      trackId: 4,
    },
  ];
  let visiblePageCount = 1;
  const openedNames = [];
  const calls = [];
  const readerInitIds = [];
  const readPages = [];
  const host = {
    [abi.HOST_IMPORT_NAME.OPFS_INDEX_OPEN](namePtr, nameLen) {
      openedNames.push(
        new TextDecoder().decode(new Uint8Array(memory.buffer, namePtr, nameLen)),
      );
      return 70;
    },
    [abi.HOST_IMPORT_NAME.OPFS_INDEX_SIZE](indexId) {
      assert.equal(indexId, 70);
      return BigInt(visiblePageCount * OPFS_PAGE_SIZE);
    },
  };
  const reader = runtime.createMainThreadIndexReaderController(memory, host, {
    instantiateWasmModuleForThread: async (id, thread, imports, options) => {
      assert.equal(thread, "main");
      calls.push({
        id,
        hasMemory: imports.env.memory === memory,
        baseUrl: options.baseUrl,
      });
      return {
        exports: {
          index_query_range(trackId, tsMin, tsMax, outPtr, maxRows) {
            assert.equal(trackId, 4);
            assert.equal(tsMin, 100);
            assert.equal(outPtr, 4096);
            assert.equal(maxRows, 1024);
            if (tsMax === 140) {
              assert.deepEqual(pageCatalog, [
                {
                  bucketEnd: 140,
                  bucketStart: 100,
                  pageId: 0,
                  recordCount: 3,
                  trackId: 4,
                },
              ]);
              return 3;
            }

            if (tsMax === 180) {
              assert.deepEqual(pageCatalog, [
                {
                  bucketEnd: 140,
                  bucketStart: 100,
                  pageId: 0,
                  recordCount: 3,
                  trackId: 4,
                },
                {
                  bucketEnd: 180,
                  bucketStart: 140,
                  pageId: 1,
                  recordCount: 2,
                  trackId: 4,
                },
              ]);
              return 5;
            }

            assert.equal(tsMax, 220);
            assert.deepEqual(pageCatalog, [
              {
                bucketEnd: 140,
                bucketStart: 100,
                pageId: 0,
                recordCount: 3,
                trackId: 4,
              },
              {
                bucketEnd: 180,
                bucketStart: 140,
                pageId: 1,
                recordCount: 2,
                trackId: 4,
              },
              {
                bucketEnd: 220,
                bucketStart: 180,
                pageId: 2,
                recordCount: 4,
                trackId: 4,
              },
            ]);
            return 9;
          },
          INDEX_STATUS_OK: 0,
          index_page_catalog_add_slice_page(
            trackId,
            pageId,
            bucketStart,
            bucketEnd,
            recordCount,
          ) {
            pageCatalog.push({
              bucketEnd,
              bucketStart,
              pageId,
              recordCount,
              trackId,
            });
          },
          index_page_catalog_reset() {
            pageCatalog.length = 0;
          },
          index_reader_configure_cache(slotCount) {
            assert.equal(slotCount, 2);
            return slotCount;
          },
          index_reader_covered_range_end() {
            return 100 + visiblePageCount * 40;
          },
          index_reader_covered_range_start() {
            return 100;
          },
          index_reader_covered_range_valid() {
            return 1;
          },
          index_reader_init(indexId) {
            assert.equal(indexId, 70);
            readerInitIds.push(indexId);
          },
          index_validate_page(ptr, len) {
            assert.equal(ptr, pagePtr);
            assert.equal(len, OPFS_PAGE_SIZE);
            return 0;
          },
          read_page(level, pageId) {
            assert.equal(level, 0);
            assert.ok(pageId < visiblePageCount);
            readPages.push(pageId);
            const record = pageRecords[pageId];
            view.setUint32(
              pagePtr + INDEX_PAGE_HEADER_BUCKET_START_OFFSET,
              record.bucketStart,
              true,
            );
            view.setUint32(
              pagePtr + INDEX_PAGE_HEADER_BUCKET_END_OFFSET,
              record.bucketEnd,
              true,
            );
            view.setUint32(
              pagePtr + INDEX_PAGE_HEADER_RECORD_COUNT_OFFSET,
              record.recordCount,
              true,
            );
            view.setUint32(
              pagePtr + INDEX_PAGE_HEADER_DECODE_HINTS_OFFSET,
              INDEX_DECODE_HINT_COMPACT_SLICES |
                (record.trackId << INDEX_DECODE_HINT_TRACK_ID_SHIFT),
              true,
            );
            return pagePtr;
          },
        },
      };
    },
    readerCacheSlots: 2,
  });

  assert.deepEqual(reader.status(), {
    error: null,
    indexId: null,
    indexName: null,
    state: "idle",
  });
  assert.deepEqual(reader.coveredRange(), { valid: false, start: 0, end: 0 });

  await reader.open("indexes/trace.idx");

  assert.deepEqual(openedNames, ["indexes/trace.idx"]);
  assert.deepEqual(calls, [
    { id: "index", hasMemory: true, baseUrl: "wasm/" },
  ]);
  assert.deepEqual(reader.status(), {
    error: null,
    indexId: 70,
    indexName: "indexes/trace.idx",
    state: "ready",
  });
  assert.deepEqual(readerInitIds, [70, 70]);
  assert.deepEqual(readPages, [0]);
  assert.deepEqual(reader.coveredRange(), { valid: true, start: 100, end: 140 });
  assert.equal(reader.queryRange(4, 100, 140, 4096).count, 3);
  assert.deepEqual(readPages, [0], "unchanged catalog should not rebuild per query");

  visiblePageCount = 2;
  assert.deepEqual(reader.coveredRange(), { valid: true, start: 100, end: 180 });
  assert.equal(reader.queryRange(4, 100, 180, 4096).count, 5);
  assert.deepEqual(
    readPages,
    [0, 1],
    "query after worker append should refresh only newly published pages",
  );
  assert.deepEqual(readerInitIds, [70, 70, 70]);

  visiblePageCount = 3;
  assert.deepEqual(reader.coveredRange(), { valid: true, start: 100, end: 220 });
  assert.equal(reader.queryRange(4, 100, 220, 4096).count, 9);
  assert.deepEqual(
    readPages,
    [0, 1, 2],
    "later render-time queries should not rescan page 0 through the current page count",
  );
  assert.deepEqual(readerInitIds, [70, 70, 70, 70]);

  await reader.open("indexes/trace.idx");
  assert.deepEqual(openedNames, ["indexes/trace.idx"]);
}

async function checkMainThreadIndexReaderProbesStaleCatalogSize() {
  const runtime = await import(moduleUrl("host/runtime.mjs"));
  const abi = await import(moduleUrl("host/abi.mjs"));
  const memory = new WebAssembly.Memory({ initial: 1 });
  const view = new DataView(memory.buffer);
  const pagePtr = 32768;
  const pageCatalog = [];
  const pageRecords = [
    {
      bucketEnd: 140,
      bucketStart: 100,
      recordCount: 3,
      trackId: 4,
    },
    {
      bucketEnd: 180,
      bucketStart: 140,
      recordCount: 2,
      trackId: 4,
    },
  ];
  let readablePageCount = 1;
  const readPages = [];
  const readerInitIds = [];
  const host = {
    "tracy.opfsIndexSizeMayBeStale": true,
    [abi.HOST_IMPORT_NAME.OPFS_INDEX_OPEN]() {
      return 70;
    },
    [abi.HOST_IMPORT_NAME.OPFS_INDEX_SIZE](indexId) {
      assert.equal(indexId, 70);
      return BigInt(OPFS_PAGE_SIZE);
    },
  };
  const reader = runtime.createMainThreadIndexReaderController(memory, host, {
    instantiateWasmModuleForThread: async () => ({
      exports: {
        index_query_range(trackId, tsMin, tsMax, outPtr, maxRows) {
          assert.equal(trackId, 4);
          assert.equal(tsMin, 100);
          assert.equal(outPtr, 4096);
          assert.equal(maxRows, 1024);
          if (tsMax === 140) {
            assert.deepEqual(pageCatalog, [
              {
                bucketEnd: 140,
                bucketStart: 100,
                pageId: 0,
                recordCount: 3,
                trackId: 4,
              },
            ]);
            return 3;
          }

          assert.equal(tsMax, 180);
          assert.deepEqual(pageCatalog, [
            {
              bucketEnd: 140,
              bucketStart: 100,
              pageId: 0,
              recordCount: 3,
              trackId: 4,
            },
            {
              bucketEnd: 180,
              bucketStart: 140,
              pageId: 1,
              recordCount: 2,
              trackId: 4,
            },
          ]);
          return 5;
        },
        INDEX_STATUS_OK: 0,
        index_page_catalog_add_slice_page(
          trackId,
          pageId,
          bucketStart,
          bucketEnd,
          recordCount,
        ) {
          pageCatalog.push({
            bucketEnd,
            bucketStart,
            pageId,
            recordCount,
            trackId,
          });
        },
        index_page_catalog_reset() {
          pageCatalog.length = 0;
        },
        index_reader_init(indexId) {
          assert.equal(indexId, 70);
          readerInitIds.push(indexId);
        },
        index_validate_page(ptr, len) {
          assert.equal(ptr, pagePtr);
          assert.equal(len, OPFS_PAGE_SIZE);
          return 0;
        },
        read_page(level, pageId) {
          assert.equal(level, 0);
          readPages.push(pageId);
          if (pageId >= readablePageCount) {
            return 0;
          }

          const record = pageRecords[pageId];
          view.setUint32(
            pagePtr + INDEX_PAGE_HEADER_BUCKET_START_OFFSET,
            record.bucketStart,
            true,
          );
          view.setUint32(
            pagePtr + INDEX_PAGE_HEADER_BUCKET_END_OFFSET,
            record.bucketEnd,
            true,
          );
          view.setUint32(
            pagePtr + INDEX_PAGE_HEADER_RECORD_COUNT_OFFSET,
            record.recordCount,
            true,
          );
          view.setUint32(
            pagePtr + INDEX_PAGE_HEADER_DECODE_HINTS_OFFSET,
            INDEX_DECODE_HINT_COMPACT_SLICES |
              (record.trackId << INDEX_DECODE_HINT_TRACK_ID_SHIFT),
            true,
          );
          return pagePtr;
        },
      },
    }),
  });

  await reader.open("indexes/trace.idx");
  assert.deepEqual(readPages, [0]);
  assert.equal(reader.queryRange(4, 100, 140, 4096).count, 3);
  assert.deepEqual(
    readPages,
    [0, 1],
    "stale-size hosts should probe one appended page until a miss",
  );
  assert.deepEqual(readerInitIds, [70, 70]);

  readablePageCount = 2;
  assert.equal(reader.queryRange(4, 100, 180, 4096).count, 5);
  assert.deepEqual(
    readPages,
    [0, 1, 1, 2],
    "stale-size hosts should discover worker-published pages by probing",
  );
  assert.deepEqual(readerInitIds, [70, 70, 70]);

  assert.equal(reader.queryRange(4, 100, 180, 4096).count, 5);
  assert.deepEqual(
    readPages,
    [0, 1, 1, 2, 2],
    "stale-size hosts should not reset below already discovered pages",
  );
  assert.deepEqual(readerInitIds, [70, 70, 70]);
}

async function checkProgressiveTraceRendererDrawsCoveredPartialRows() {
  const rendererModule = await import(moduleUrl("host/progressive-trace-renderer.mjs"));
  const memory = new WebAssembly.Memory({ initial: 1 });
  const operations = [];
  const canvas = {
    height: 160,
    width: 320,
    getContext() {
      return context;
    },
  };
  const context = {
    beginPath() {
      operations.push({ op: "beginPath" });
    },
    clearRect(x, y, width, height) {
      operations.push({ height, op: "clearRect", width, x, y });
    },
    clip() {
      operations.push({ op: "clip" });
    },
    fillRect(x, y, width, height) {
      operations.push({
        fillStyle: this.fillStyle,
        height,
        op: "fillRect",
        width,
        x,
        y,
      });
    },
    lineTo(x, y) {
      operations.push({ op: "lineTo", x, y });
    },
    moveTo(x, y) {
      operations.push({ op: "moveTo", x, y });
    },
    rect(x, y, width, height) {
      operations.push({ height, op: "rect", width, x, y });
    },
    restore() {
      operations.push({ op: "restore" });
    },
    save() {
      operations.push({ op: "save" });
    },
    stroke() {
      operations.push({ op: "stroke", strokeStyle: this.strokeStyle });
    },
  };
  let coveredRange = { end: 140, start: 100, type: "covered_range", valid: true };
  const queryCalls = [];
  const reader = {
    queryRange(trackId, tsMin, tsMax, outPtr, maxRows) {
      queryCalls.push({ maxRows, outPtr, trackId, tsMax, tsMin });
      const view = new DataView(memory.buffer);
      view.setUint32(outPtr, trackId === 0 ? 104 : 120, true);
      view.setUint32(outPtr + 4, trackId === 0 ? 8 : 12, true);
      view.setUint32(outPtr + 12, trackId, true);
      view.setUint32(outPtr + 20, trackId === 0 ? 0x2d74da : 0x6b7280, true);
      view.setUint32(outPtr + 24, trackId === 1 ? 1 : 0, true);
      return 1;
    },
    status() {
      return { state: "ready" };
    },
    trackCount() {
      return 2;
    },
  };
  let workerState = "running";
  const ingestWorker = {
    indexReader: reader,
    status() {
      return { coveredRange, state: workerState };
    },
  };
  const renderer = rendererModule.createProgressiveTraceRenderer(memory, ingestWorker, {
    canvas,
    queryOutPtr: 2048,
    queryWindow: 100,
  });

  const rows = renderer.draw(123);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    queryCalls,
    [
      { maxRows: 1024, outPtr: 2048, trackId: 0, tsMax: 140, tsMin: 100 },
      { maxRows: 1024, outPtr: 2048, trackId: 1, tsMax: 140, tsMin: 100 },
    ],
  );
  assert.equal(
    operations.some((operation) => operation.op === "fillRect" && operation.fillStyle === "#2d74da"),
    true,
    "committed row should draw with its resolved color",
  );
  assert.equal(
    operations.some(
      (operation) =>
        operation.op === "fillRect" &&
        operation.fillStyle === "rgba(92, 109, 130, 0.58)",
    ),
    true,
    "partial row should draw with unfinished styling",
  );
  assert.equal(
    operations.some((operation) => operation.op === "stroke"),
    true,
    "partial row should get a hatch overlay",
  );

  coveredRange = { end: 180, start: 100, type: "covered_range", valid: true };
  renderer.draw(124);
  assert.deepEqual(queryCalls.at(-1), {
    maxRows: 1024,
    outPtr: 2048,
    trackId: 1,
    tsMax: 180,
    tsMin: 100,
  });
  assert.deepEqual(renderer.status(), {
    cappedQueries: [],
    error: null,
    rows: 2,
    unknownRange: { pending: true, start: 180 },
    userInteracted: false,
    viewport: { end: 180, start: 100, valid: true },
  });

  workerState = "complete";
  operations.length = 0;
  renderer.draw(125);
  assert.equal(
    operations.some(
      (operation) =>
        operation.op === "fillRect" &&
        operation.fillStyle === "rgba(92, 109, 130, 0.58)",
    ),
    false,
    "completed ingest should stop drawing partial rows with unfinished styling",
  );
  assert.equal(
    operations.some((operation) => operation.op === "stroke"),
    false,
    "completed ingest should stop drawing partial hatch overlays",
  );
  assert.equal(
    operations.some((operation) => operation.op === "fillRect" && operation.fillStyle === "#6b7280"),
    true,
    "completed ingest should draw formerly partial rows with their resolved color",
  );
  assert.deepEqual(renderer.status(), {
    cappedQueries: [],
    error: null,
    rows: 2,
    unknownRange: null,
    userInteracted: false,
    viewport: { end: 180, start: 100, valid: true },
  });
}

async function checkProgressiveTraceRendererSurfacesCappedQueries() {
  const rendererModule = await import(moduleUrl("host/progressive-trace-renderer.mjs"));
  const memory = new WebAssembly.Memory({ initial: 1 });
  const queryCalls = [];
  const decoded = [];
  const canvas = {
    height: 120,
    width: 240,
    getContext() {
      return {
        clearRect() {},
        fillRect() {},
        restore() {},
        save() {},
      };
    },
  };
  const reader = {
    queryRange(trackId, tsMin, tsMax, outPtr, maxRows) {
      queryCalls.push({ maxRows, outPtr, trackId, tsMax, tsMin });
      const view = new DataView(memory.buffer);

      view.setUint32(outPtr, 110, true);
      view.setUint32(outPtr + 4, 8, true);
      view.setUint32(outPtr + 12, 0, true);
      view.setUint32(outPtr + 20, 0x2d74da, true);
      view.setUint32(outPtr + 24, 0, true);
      return {
        capped: true,
        count: 1,
        matchedRows: 4096,
        writtenRows: 1,
      };
    },
    status() {
      return { state: "ready" };
    },
    trackCount() {
      return 1;
    },
  };
  const ingestWorker = {
    indexReader: reader,
    status() {
      return {
        coveredRange: { end: 200, start: 100, type: "covered_range", valid: true },
        state: "running",
      };
    },
  };
  const renderer = rendererModule.createProgressiveTraceRenderer(memory, ingestWorker, {
    canvas,
    decodeQueryRows({ count, outPtr, trackId }) {
      decoded.push({ count, outPtr, trackId });
      return [{ dur: 8, start: 110, trackId }];
    },
    queryOutPtr: 2048,
    queryRowCap: 1,
    queryWindow: 100,
  });

  const rows = renderer.draw(123);

  assert.equal(rows.length, 1);
  assert.deepEqual(queryCalls, [
    { maxRows: 1, outPtr: 2048, trackId: 0, tsMax: 200, tsMin: 100 },
  ]);
  assert.deepEqual(decoded, [{ count: 1, outPtr: 2048, trackId: 0 }]);
  assert.deepEqual(renderer.status().cappedQueries, [
    { matchedRows: 4096, trackId: 0, writtenRows: 1 },
  ]);
}

async function checkProgressiveTraceRendererClampsPanZoomAndDrawsUnknownRange() {
  const rendererModule = await import(moduleUrl("host/progressive-trace-renderer.mjs"));
  const memory = new WebAssembly.Memory({ initial: 1 });
  const listeners = new Map();
  const operations = [];
  const canvas = {
    height: 160,
    width: 320,
    addEventListener(type, callback) {
      listeners.set(type, callback);
    },
    getBoundingClientRect() {
      return { left: 0, top: 0 };
    },
    getContext() {
      return context;
    },
    releasePointerCapture() {},
    setPointerCapture() {},
  };
  const context = {
    beginPath() {
      operations.push({ op: "beginPath" });
    },
    clearRect(x, y, width, height) {
      operations.push({ height, op: "clearRect", width, x, y });
    },
    clip() {
      operations.push({ op: "clip" });
    },
    fillRect(x, y, width, height) {
      operations.push({
        fillStyle: this.fillStyle,
        height,
        op: "fillRect",
        width,
        x,
        y,
      });
    },
    lineTo(x, y) {
      operations.push({ op: "lineTo", x, y });
    },
    moveTo(x, y) {
      operations.push({ op: "moveTo", x, y });
    },
    rect(x, y, width, height) {
      operations.push({ height, op: "rect", width, x, y });
    },
    restore() {
      operations.push({ op: "restore" });
    },
    save() {
      operations.push({ op: "save" });
    },
    stroke() {
      operations.push({ op: "stroke", strokeStyle: this.strokeStyle });
    },
  };
  const coveredRange = { end: 200, start: 100, type: "covered_range", valid: true };
  const queryCalls = [];
  const reader = {
    queryRange(trackId, tsMin, tsMax, outPtr, maxRows) {
      queryCalls.push({ maxRows, outPtr, trackId, tsMax, tsMin });
      const view = new DataView(memory.buffer);
      view.setUint32(outPtr, Math.max(100, Math.floor(tsMin)), true);
      view.setUint32(outPtr + 4, 8, true);
      view.setUint32(outPtr + 12, 0, true);
      view.setUint32(outPtr + 20, 0x2d74da, true);
      view.setUint32(outPtr + 24, 0, true);
      return 1;
    },
    status() {
      return { state: "ready" };
    },
    trackCount() {
      return 1;
    },
  };
  const ingestWorker = {
    indexReader: reader,
    status() {
      return { coveredRange, state: "running" };
    },
  };
  const renderer = rendererModule.createProgressiveTraceRenderer(memory, ingestWorker, {
    canvas,
    minViewportSpan: 10,
    queryOutPtr: 2048,
    queryWindow: 1000,
  });

  renderer.draw(1);
  assert.equal(
    operations.some(
      (operation) =>
        operation.op === "fillRect" &&
        operation.fillStyle === "rgba(126, 134, 146, 0.18)",
    ),
    true,
    "unknown leading edge should draw as a striped affordance while ingest runs",
  );
  assert.equal(
    operations.some(
      (operation) =>
        operation.op === "stroke" &&
        operation.strokeStyle === "rgba(76, 85, 99, 0.38)",
    ),
    true,
    "unknown leading edge should include stripes",
  );

  listeners.get("wheel")({
    clientX: 160,
    deltaY: -700,
    preventDefault() {
      operations.push({ op: "wheelPrevented" });
    },
  });
  renderer.draw(2);
  const zoomedViewport = renderer.status().viewport;
  assert.equal(renderer.status().userInteracted, true);
  assert.equal(zoomedViewport.start >= coveredRange.start, true);
  assert.equal(zoomedViewport.end <= coveredRange.end, true);
  assert.equal(zoomedViewport.end - zoomedViewport.start < 100, true);

  listeners.get("pointerdown")({
    button: 0,
    clientX: 160,
    pointerId: 1,
    preventDefault() {},
  });
  listeners.get("pointermove")({
    clientX: -10000,
    pointerId: 1,
    preventDefault() {},
  });
  listeners.get("pointerup")({ pointerId: 1 });
  renderer.draw(3);
  assert.equal(renderer.status().viewport.end, coveredRange.end);

  listeners.get("pointerdown")({
    button: 0,
    clientX: 160,
    pointerId: 2,
    preventDefault() {},
  });
  listeners.get("pointermove")({
    clientX: 10000,
    pointerId: 2,
    preventDefault() {},
  });
  listeners.get("pointercancel")({ pointerId: 2 });
  renderer.draw(4);
  assert.equal(renderer.status().viewport.start, coveredRange.start);
  assert.equal(queryCalls.at(-1).tsMin, coveredRange.start);
}

async function checkRuntimeLoadsProgressiveTraceRendererLazily() {
  const { frames } = installBrowserStubs();
  const runtime = await import(moduleUrl("host/runtime.mjs"));
  const memory = new WebAssembly.Memory({ initial: 1 });
  let coveredRange = null;
  let readerState = "idle";
  let importCalls = 0;
  let drawCalls = 0;
  const ingestWorker = {
    indexReader: {
      status() {
        return { state: readerState };
      },
    },
    status() {
      return { coveredRange, state: "running" };
    },
  };

  runtime.runApp(memory, {}, {
    importProgressiveTraceRenderer: async () => {
      importCalls += 1;
      return {
        createProgressiveTraceRenderer() {
          return {
            draw() {
              drawCalls += 1;
            },
          };
        },
      };
    },
    ingestWorker,
    instantiateWasmModuleForThread: async () => ({
      exports: {
        tracy_main() {},
        tracy_tick() {},
      },
    }),
    worker: {
      Worker: FakeWorker,
    },
  });

  await Promise.resolve();
  await Promise.resolve();

  frames[0](1);
  assert.equal(importCalls, 0, "renderer should stay off the cold startup path");

  coveredRange = { end: 120, start: 100, type: "covered_range", valid: true };
  readerState = "ready";
  frames[1](2);
  assert.equal(importCalls, 1, "renderer should load once covered pages are queryable");

  await Promise.resolve();
  frames[2](3);
  assert.equal(importCalls, 1);
  assert.equal(drawCalls, 1);
}

async function main() {
  await checkRuntimeOrchestratesWorker();
  await checkRuntimeStartsIngestFromFileSelection();
  await checkRuntimeIgnoresStaleIngestWorkerMessages();
  await checkFileSelectionSetupErrorsReportStatus();
  await checkMainThreadIndexReaderQueriesCommittedPages();
  await checkMainThreadIndexReaderProbesStaleCatalogSize();
  await checkProgressiveTraceRendererDrawsCoveredPartialRows();
  await checkProgressiveTraceRendererSurfacesCappedQueries();
  await checkProgressiveTraceRendererClampsPanZoomAndDrawsUnknownRange();
  await checkRuntimeLoadsProgressiveTraceRendererLazily();
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
