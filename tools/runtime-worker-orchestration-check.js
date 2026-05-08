#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let OPFS_PAGE_SIZE;
let INDEX_DECODE_HINT_COMPACT_SLICES;
let INDEX_DECODE_HINT_TRACK_ID_SHIFT;
let INDEX_PAGE_HEADER_BUCKET_START_OFFSET;
let INDEX_PAGE_HEADER_BUCKET_END_OFFSET;
let INDEX_PAGE_HEADER_RECORD_COUNT_OFFSET;
let INDEX_PAGE_HEADER_DECODE_HINTS_OFFSET;

function moduleUrl(relativePath) {
  return pathToFileURL(path.resolve(__dirname, "..", relativePath)).href;
}

async function loadGeneratedIndexFormatSpec() {
  const { INDEX_DECODE_HINTS, INDEX_FORMAT, INDEX_PAGE_HEADER_OFFSETS } = await import(
    moduleUrl("host/index-format-spec.mjs")
  );

  OPFS_PAGE_SIZE = INDEX_FORMAT.OPFS_PAGE_SIZE;
  INDEX_DECODE_HINT_COMPACT_SLICES = INDEX_DECODE_HINTS.COMPACT_SLICES;
  INDEX_DECODE_HINT_TRACK_ID_SHIFT = INDEX_DECODE_HINTS.TRACK_ID_SHIFT;
  INDEX_PAGE_HEADER_BUCKET_START_OFFSET = INDEX_PAGE_HEADER_OFFSETS.BUCKET_START;
  INDEX_PAGE_HEADER_BUCKET_END_OFFSET = INDEX_PAGE_HEADER_OFFSETS.BUCKET_END;
  INDEX_PAGE_HEADER_RECORD_COUNT_OFFSET = INDEX_PAGE_HEADER_OFFSETS.RECORD_COUNT;
  INDEX_PAGE_HEADER_DECODE_HINTS_OFFSET = INDEX_PAGE_HEADER_OFFSETS.DECODE_HINTS;
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

async function flushMicrotasks(count = 8) {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
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
    importProgressiveTraceRenderer: async () => ({
      createProgressiveTraceRenderer() {
        return {
          draw() {},
        };
      },
    }),
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
  ]);
  assert.equal(frames.length, 2, "startup frame gate and draw loop should be scheduled");
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

  frames[0](122);
  frames[1](123);
  await import(moduleUrl("host/trace-renderer-spec.mjs"));
  await flushMicrotasks();
  assert.deepEqual(performanceEntries.slice(-2), [
    { kind: "mark", name: "tracy.app.ready" },
    {
      kind: "measure",
      name: "tracy.app.load",
      start: "tracy.bootstrap.start",
      end: "tracy.app.ready",
    },
  ]);
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
          INDEX_WRITER_STATUS_CATALOG_FULL: 23,
          index_page_catalog_add_page(ptr, len, pageId) {
            assert.equal(ptr, pagePtr);
            assert.equal(len, OPFS_PAGE_SIZE);
            const record = pageRecords[pageId];
            pageCatalog.push({
              bucketEnd: record.bucketEnd,
              bucketStart: record.bucketStart,
              pageId,
              recordCount: record.recordCount,
              trackId: record.trackId,
            });
            return 0;
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
    catalogFull: false,
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
    catalogFull: false,
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
        INDEX_WRITER_STATUS_CATALOG_FULL: 23,
        index_page_catalog_add_page(ptr, len, pageId) {
          assert.equal(ptr, pagePtr);
          assert.equal(len, OPFS_PAGE_SIZE);
          const record = pageRecords[pageId];
          pageCatalog.push({
            bucketEnd: record.bucketEnd,
            bucketStart: record.bucketStart,
            pageId,
            recordCount: record.recordCount,
            trackId: record.trackId,
          });
          return 0;
        },
        index_page_catalog_reset() {
          pageCatalog.length = 0;
        },
        index_reader_init(indexId) {
          assert.equal(indexId, 70);
          readerInitIds.push(indexId);
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

async function checkMainThreadSliceCatalogReportsCapacityOverflow() {
  const catalog = await import(moduleUrl("host/index-reader-catalog.mjs"));
  const abi = await import(moduleUrl("host/abi.mjs"));
  const memory = new WebAssembly.Memory({ initial: 1 });
  const view = new DataView(memory.buffer);
  const pagePtr = 32768;
  const addedPages = [];
  const host = {
    [abi.HOST_IMPORT_NAME.OPFS_INDEX_SIZE](indexId) {
      assert.equal(indexId, 70);
      return BigInt(2 * OPFS_PAGE_SIZE);
    },
  };
  const index = {
    INDEX_STATUS_OK: 0,
    INDEX_WRITER_STATUS_CATALOG_FULL: 23,
    index_page_catalog_add_page(ptr, len, pageId) {
      assert.equal(ptr, pagePtr);
      assert.equal(len, OPFS_PAGE_SIZE);
      if (pageId === 1) {
        return 23;
      }
      addedPages.push({
        bucketEnd: pageId * 40 + 40,
        bucketStart: pageId * 40,
        pageId,
        recordCount: 2,
        trackId: 4,
      });
      return 0;
    },
    index_page_catalog_reset() {
      addedPages.length = 0;
    },
    read_page(level, pageId) {
      assert.equal(level, 0);
      view.setUint32(pagePtr + INDEX_PAGE_HEADER_BUCKET_START_OFFSET, pageId * 40, true);
      view.setUint32(pagePtr + INDEX_PAGE_HEADER_BUCKET_END_OFFSET, pageId * 40 + 40, true);
      view.setUint32(pagePtr + INDEX_PAGE_HEADER_RECORD_COUNT_OFFSET, 2, true);
      view.setUint32(
        pagePtr + INDEX_PAGE_HEADER_DECODE_HINTS_OFFSET,
        INDEX_DECODE_HINT_COMPACT_SLICES | (4 << INDEX_DECODE_HINT_TRACK_ID_SHIFT),
        true,
      );
      return pagePtr;
    },
  };

  const result = catalog.rebuildMainThreadSliceCatalog(memory, host, index, 70);

  assert.deepEqual(result, { catalogFull: true, pageCount: 2, rebuilt: true });
  assert.deepEqual(addedPages, [
    {
      bucketEnd: 40,
      bucketStart: 0,
      pageId: 0,
      recordCount: 2,
      trackId: 4,
    },
  ]);
}

async function checkMainThreadIndexReaderFailsOnCatalogOverflow() {
  const runtime = await import(moduleUrl("host/runtime.mjs"));
  const abi = await import(moduleUrl("host/abi.mjs"));
  const memory = new WebAssembly.Memory({ initial: 1 });
  const view = new DataView(memory.buffer);
  const pagePtr = 32768;
  const host = {
    [abi.HOST_IMPORT_NAME.OPFS_INDEX_OPEN]() {
      return 70;
    },
    [abi.HOST_IMPORT_NAME.OPFS_INDEX_SIZE](indexId) {
      assert.equal(indexId, 70);
      return BigInt(2 * OPFS_PAGE_SIZE);
    },
  };
  const reader = runtime.createMainThreadIndexReaderController(memory, host, {
    instantiateWasmModuleForThread: async () => ({
      exports: {
        INDEX_STATUS_OK: 0,
        INDEX_WRITER_STATUS_CATALOG_FULL: 23,
        index_page_catalog_add_page(ptr, len, pageId) {
          assert.equal(ptr, pagePtr);
          assert.equal(len, OPFS_PAGE_SIZE);
          return pageId === 0 ? 0 : 23;
        },
        index_page_catalog_reset() {},
        index_reader_init(indexId) {
          assert.equal(indexId, 70);
        },
        read_page(level, pageId) {
          assert.equal(level, 0);
          view.setUint32(
            pagePtr + INDEX_PAGE_HEADER_BUCKET_START_OFFSET,
            pageId * 40,
            true,
          );
          view.setUint32(
            pagePtr + INDEX_PAGE_HEADER_BUCKET_END_OFFSET,
            pageId * 40 + 40,
            true,
          );
          view.setUint32(
            pagePtr + INDEX_PAGE_HEADER_RECORD_COUNT_OFFSET,
            2,
            true,
          );
          view.setUint32(
            pagePtr + INDEX_PAGE_HEADER_DECODE_HINTS_OFFSET,
            INDEX_DECODE_HINT_COMPACT_SLICES |
              (4 << INDEX_DECODE_HINT_TRACK_ID_SHIFT),
            true,
          );
          return pagePtr;
        },
      },
    }),
  });

  await assert.rejects(
    reader.open("indexes/trace.idx"),
    /main-thread slice catalog full/,
  );
  assert.deepEqual(reader.status(), {
    catalogFull: true,
    error: "main-thread slice catalog full while rebuilding index 70 at page 2",
    indexId: null,
    indexName: "indexes/trace.idx",
    state: "error",
  });
}

async function checkWorkerStatusReportsReaderCatalogOverflow() {
  const runtime = await import(moduleUrl("host/runtime.mjs"));
  const workerStatus = [];
  const indexReader = {
    open() {
      return Promise.reject(new Error("main-thread slice catalog full"));
    },
  };
  const controller = runtime.createIngestWorkerController({
    Worker: FakeWorker,
    indexReader,
    onWorkerStatus(status, message) {
      workerStatus.push({ message, status });
    },
  });

  controller.start({ indexName: "indexes/trace.idx" });
  const worker = FakeWorker.instances.at(-1);
  const ingestId = worker.posted.at(-1).ingestId;

  worker.emit("message", {
    end: 140,
    ingestId,
    start: 100,
    type: "covered_range",
    valid: true,
  });
  await Promise.resolve();

  assert.equal(controller.status().state, "error");
  assert.equal(controller.status().error, "main-thread slice catalog full");
  assert.equal(workerStatus.at(-1).status.state, "error");
}

async function checkWorkerCoveredRangeOpensReaderBeforeRangeIsValid() {
  const runtime = await import(moduleUrl("host/runtime.mjs"));
  const indexReaderOpenCalls = [];
  const controller = runtime.createIngestWorkerController({
    Worker: FakeWorker,
    indexReader: {
      open(indexName) {
        indexReaderOpenCalls.push(indexName);
        return Promise.resolve(true);
      },
    },
  });

  assert.equal(
    controller.start({
      indexName: "indexes/trace.idx",
      sourceName: "sources/trace.json",
    }),
    true,
  );
  const worker = FakeWorker.instances.at(-1);
  const ingestId = worker.posted.at(-1).ingestId;

  worker.emit("message", {
    end: 0,
    ingestId,
    start: 0,
    type: "covered_range",
    valid: false,
  });
  await Promise.resolve();

  assert.deepEqual(indexReaderOpenCalls, ["indexes/trace.idx"]);
  assert.deepEqual(controller.status().coveredRange, {
    end: 0,
    ingestId,
    start: 0,
    type: "covered_range",
    valid: false,
  });
}

function checkWatWriterPropagatesCatalogOverflow() {
  const constants = fs.readFileSync(
    path.resolve(__dirname, "../wat/index/constants-and-helpers.wat.inc"),
    "utf8",
  );
  const writer = fs.readFileSync(
    path.resolve(__dirname, "../wat/index/page-layout-and-writer-pages.wat.inc"),
    "utf8",
  );

  assert.match(constants, /INDEX_WRITER_STATUS_CATALOG_FULL/);
  assert.match(
    writer,
    /call \$index_page_catalog_add_slice_page\s+local\.set \$status\s+local\.get \$status\s+i32\.eqz\s+if\s+global\.get \$INDEX_WRITER_STATUS_CATALOG_FULL\s+return\s+end/,
  );
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
    incompleteQueryRanges: [],
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
    incompleteQueryRanges: [],
    rows: 2,
    unknownRange: null,
    userInteracted: false,
    viewport: { end: 180, start: 100, valid: true },
  });
}

async function checkProgressiveTraceRendererClampsToSliceCatalogCoverage() {
  const rendererModule = await import(moduleUrl("host/progressive-trace-renderer.mjs"));
  const memory = new WebAssembly.Memory({ initial: 1 });
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
  const workerCoveredRange = {
    end: 1000,
    start: 0,
    type: "covered_range",
    valid: true,
  };
  let sliceCoveredRange = {
    end: 320,
    start: 200,
    valid: true,
  };
  const queryCalls = [];
  const reader = {
    coveredRange() {
      return sliceCoveredRange;
    },
    queryRange(trackId, tsMin, tsMax, outPtr, maxRows) {
      queryCalls.push({ maxRows, outPtr, trackId, tsMax, tsMin });
      return 0;
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
      return { coveredRange: workerCoveredRange, state: "running" };
    },
  };
  const renderer = rendererModule.createProgressiveTraceRenderer(memory, ingestWorker, {
    canvas,
    queryOutPtr: 2048,
    queryWindow: 1000,
  });

  renderer.draw(1);
  assert.deepEqual(queryCalls, [
    { maxRows: 1024, outPtr: 2048, trackId: 0, tsMax: 320, tsMin: 200 },
  ]);
  assert.deepEqual(renderer.status().viewport, {
    end: 320,
    start: 200,
    valid: true,
  });

  sliceCoveredRange = { end: 0, start: 0, valid: false };
  queryCalls.length = 0;
  const emptyRenderer = rendererModule.createProgressiveTraceRenderer(
    memory,
    ingestWorker,
    {
      canvas,
      queryOutPtr: 2048,
      queryWindow: 1000,
    },
  );

  const rows = emptyRenderer.draw(2);

  assert.equal(rows.length, 0);
  assert.deepEqual(queryCalls, []);
  assert.equal(emptyRenderer.status().viewport, null);
}

async function checkProgressiveTraceRendererSurfacesCappedQueries() {
  const rendererModule = await import(moduleUrl("host/progressive-trace-renderer.mjs"));
  const memory = new WebAssembly.Memory({ initial: 1 });
  const queryCalls = [];
  const decoded = [];
  const operations = [];
  const canvas = {
    height: 120,
    width: 240,
    getContext() {
      return {
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
      return [{ dur: 8, depth: 0, start: 110, trackId }];
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
  assert.deepEqual(renderer.status().incompleteQueryRanges, [
    { end: 200, start: 100, trackId: 0 },
  ]);
  assert.equal(
    operations.some(
      (operation) =>
        operation.op === "fillRect" &&
        operation.fillStyle === "rgba(180, 83, 9, 0.16)" &&
        operation.x === 0 &&
        operation.width === 240,
    ),
    true,
    "capped query ranges should be visibly marked incomplete",
  );
  assert.equal(
    operations.some(
      (operation) =>
        operation.op === "stroke" &&
        operation.strokeStyle === "rgba(146, 64, 14, 0.42)",
    ),
    true,
    "capped query ranges should include an incomplete-range stripe overlay",
  );
}

async function checkProgressiveTraceRendererTilesFullVisibleViewport() {
  const rendererModule = await import(moduleUrl("host/progressive-trace-renderer.mjs"));
  const memory = new WebAssembly.Memory({ initial: 1 });
  const queryCalls = [];
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

      view.setUint32(outPtr, tsMin >= 2000 ? 2200 : tsMin + 10, true);
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
      return {
        coveredRange: { end: 2500, start: 0, type: "covered_range", valid: true },
        state: "running",
      };
    },
  };
  const renderer = rendererModule.createProgressiveTraceRenderer(memory, ingestWorker, {
    canvas,
    queryOutPtr: 2048,
  });

  const rows = renderer.draw(123);

  assert.deepEqual(queryCalls, [
    { maxRows: 1024, outPtr: 2048, trackId: 0, tsMax: 1000, tsMin: 0 },
    { maxRows: 1024, outPtr: 2048, trackId: 0, tsMax: 2000, tsMin: 1000 },
    { maxRows: 1024, outPtr: 2048, trackId: 0, tsMax: 2500, tsMin: 2000 },
  ]);
  assert.equal(rows.length, 3);
  assert.equal(
    rows.some((row) => row.start === 2200),
    true,
    "later visible rows should still render when the viewport exceeds the default query window",
  );
}

async function checkProgressiveTraceRendererBoundsLargeViewportQueries() {
  const rendererModule = await import(moduleUrl("host/progressive-trace-renderer.mjs"));
  const memory = new WebAssembly.Memory({ initial: 1 });
  const queryCalls = [];
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

      view.setUint32(outPtr, Math.floor(tsMin), true);
      view.setUint32(outPtr + 4, 8, true);
      view.setUint32(outPtr + 12, trackId, true);
      view.setUint32(outPtr + 20, 0x2d74da, true);
      view.setUint32(outPtr + 24, 0, true);
      return 1;
    },
    status() {
      return { state: "ready" };
    },
    trackCount() {
      return 2;
    },
  };
  const ingestWorker = {
    indexReader: reader,
    status() {
      return {
        coveredRange: {
          end: 10_000_000,
          start: 0,
          type: "covered_range",
          valid: true,
        },
        state: "running",
      };
    },
  };
  const renderer = rendererModule.createProgressiveTraceRenderer(memory, ingestWorker, {
    canvas,
    queryOutPtr: 2048,
    queryRangeBudget: 8,
    queryWindow: 1000,
  });

  const rows = renderer.draw(123);

  assert.equal(queryCalls.length, 8);
  assert.deepEqual(queryCalls, [
    { maxRows: 1024, outPtr: 2048, trackId: 0, tsMax: 2500000, tsMin: 0 },
    { maxRows: 1024, outPtr: 2048, trackId: 0, tsMax: 5000000, tsMin: 2500000 },
    { maxRows: 1024, outPtr: 2048, trackId: 0, tsMax: 7500000, tsMin: 5000000 },
    { maxRows: 1024, outPtr: 2048, trackId: 0, tsMax: 10000000, tsMin: 7500000 },
    { maxRows: 1024, outPtr: 2048, trackId: 1, tsMax: 2500000, tsMin: 0 },
    { maxRows: 1024, outPtr: 2048, trackId: 1, tsMax: 5000000, tsMin: 2500000 },
    { maxRows: 1024, outPtr: 2048, trackId: 1, tsMax: 7500000, tsMin: 5000000 },
    { maxRows: 1024, outPtr: 2048, trackId: 1, tsMax: 10000000, tsMin: 7500000 },
  ]);
  assert.equal(rows.length, 8);
  assert.equal(
    rows.some((row) => row.start === 7500000 && row.trackId === 1),
    true,
    "large viewports should still represent later visible data within the query budget",
  );
}

async function checkProgressiveTraceRendererMarksSkippedTracksWhenBudgetExhausted() {
  const rendererModule = await import(moduleUrl("host/progressive-trace-renderer.mjs"));
  const memory = new WebAssembly.Memory({ initial: 1 });
  const queryCalls = [];
  const operations = [];
  const canvas = {
    height: 120,
    width: 240,
    getContext() {
      return {
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
    },
  };
  const reader = {
    queryRange(trackId, tsMin, tsMax, outPtr, maxRows) {
      queryCalls.push({ maxRows, outPtr, trackId, tsMax, tsMin });
      const view = new DataView(memory.buffer);

      view.setUint32(outPtr, 10 + trackId * 10, true);
      view.setUint32(outPtr + 4, 8, true);
      view.setUint32(outPtr + 12, trackId, true);
      view.setUint32(outPtr + 20, 0x2d74da, true);
      view.setUint32(outPtr + 24, 0, true);
      return 1;
    },
    status() {
      return { state: "ready" };
    },
    trackCount() {
      return 4;
    },
  };
  const ingestWorker = {
    indexReader: reader,
    status() {
      return {
        coveredRange: { end: 100, start: 0, type: "covered_range", valid: true },
        state: "running",
      };
    },
  };
  const renderer = rendererModule.createProgressiveTraceRenderer(memory, ingestWorker, {
    canvas,
    queryOutPtr: 2048,
    queryRangeBudget: 2,
    queryWindow: 100,
  });

  const rows = renderer.draw(123);

  assert.deepEqual(queryCalls, [
    { maxRows: 1024, outPtr: 2048, trackId: 0, tsMax: 100, tsMin: 0 },
    { maxRows: 1024, outPtr: 2048, trackId: 1, tsMax: 100, tsMin: 0 },
  ]);
  assert.equal(rows.length, 2);
  assert.deepEqual(renderer.status().incompleteQueryRanges, [
    { end: 100, start: 0, trackId: 2 },
    { end: 100, start: 0, trackId: 3 },
  ]);
  assert.equal(
    operations.some(
      (operation) =>
        operation.op === "fillRect" &&
        operation.fillStyle === "rgba(180, 83, 9, 0.16)" &&
        operation.x === 0 &&
        operation.width === 240,
    ),
    true,
    "tracks skipped by query budget exhaustion should be visibly marked incomplete",
  );
  assert.equal(
    operations.some(
      (operation) =>
        operation.op === "stroke" &&
        operation.strokeStyle === "rgba(146, 64, 14, 0.42)",
    ),
    true,
    "tracks skipped by query budget exhaustion should include the incomplete stripe overlay",
  );
}

async function checkProgressiveTraceRendererUsesWasmCanvasOpPlanner() {
  const rendererModule = await import(moduleUrl("host/progressive-trace-renderer.mjs"));
  const calls = [];
  const planner = rendererModule.__test.createWasmCanvasOpPlanner({
    trace_render_query_ranges_per_track(queryRangeBudget, trackCount) {
      calls.push(["ranges", queryRangeBudget, trackCount]);
      return 2;
    },
    trace_render_query_tile_span(viewportSpan, queryWindow, rangesPerTrack) {
      calls.push(["tile", viewportSpan, queryWindow, rangesPerTrack]);
      return 50;
    },
    trace_render_slice_end_x(sliceEnd, viewportStart, viewportSpan, canvasWidth) {
      calls.push(["end-x", sliceEnd, viewportStart, viewportSpan, canvasWidth]);
      return 80;
    },
    trace_render_slice_x(sliceStart, viewportStart, viewportSpan, canvasWidth) {
      calls.push(["x", sliceStart, viewportStart, viewportSpan, canvasWidth]);
      return 32;
    },
    trace_render_slice_y(depth, top, laneHeight, laneGap) {
      calls.push(["y", depth, top, laneHeight, laneGap]);
      return 24;
    },
  });

  assert.deepEqual(
    planner.queryOps({
      queryRangeBudget: 3,
      queryWindow: 1000,
      trackCount: 2,
      viewport: { end: 100, start: 0, valid: true },
    }),
    [
      { end: 50, op: "query_range", start: 0, trackId: 0 },
      { end: 100, op: "query_range", start: 50, trackId: 0 },
      { end: 50, op: "query_range", start: 0, trackId: 1 },
      { end: 100, op: "incomplete_query_range", start: 50, trackId: 1 },
    ],
  );
  assert.deepEqual(
    planner.rowCanvasOp({
      height: 10,
      laneGap: 3,
      laneHeight: 10,
      row: { depth: 1, dur: 20, start: 10 },
      span: 100,
      top: 18,
      viewport: { end: 100, start: 0, valid: true },
      width: 320,
    }),
    { height: 10, op: "slice_rect", width: 48, x: 32, y: 24 },
  );
  assert.deepEqual(calls, [
    ["ranges", 3, 2],
    ["tile", 100, 1000, 2],
    ["x", 10, 0, 100, 320],
    ["end-x", 30, 0, 100, 320],
    ["y", 1, 18, 10, 3],
  ]);

  const streamCalls = [];
  const streamOps = [
    { end: 50, start: 0, tag: 1, trackId: 0 },
    { end: 100, start: 50, tag: 2, trackId: 1 },
    { tag: 0 },
  ];
  let streamIndex = -1;
  const streamPlanner = rendererModule.__test.createWasmCanvasOpPlanner({
    trace_render_plan_begin(viewportStart, viewportEnd, trackCount, queryRangeBudget, queryWindow) {
      streamCalls.push([
        "begin",
        viewportStart,
        viewportEnd,
        trackCount,
        queryRangeBudget,
        queryWindow,
      ]);
      streamIndex = -1;
    },
    trace_render_plan_next() {
      streamIndex += 1;
      streamCalls.push(["next", streamOps[streamIndex].tag]);
      return streamOps[streamIndex].tag;
    },
    trace_render_plan_op_end() {
      return streamOps[streamIndex].end;
    },
    trace_render_plan_op_start() {
      return streamOps[streamIndex].start;
    },
    trace_render_plan_op_track_id() {
      return streamOps[streamIndex].trackId;
    },
  });

  assert.deepEqual(
    streamPlanner.queryOps({
      queryRangeBudget: 3,
      queryWindow: 1000,
      trackCount: 2,
      viewport: { end: 100, start: 0, valid: true },
    }),
    [
      { end: 50, op: "query_range", start: 0, trackId: 0 },
      { end: 100, op: "incomplete_query_range", start: 50, trackId: 1 },
    ],
  );
  assert.deepEqual(streamCalls, [
    ["begin", 0, 100, 2, 3, 1000],
    ["next", 1],
    ["next", 2],
    ["next", 0],
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

async function checkRuntimePreloadsProgressiveTraceRendererImplementation() {
  const { frames } = installBrowserStubs();
  const runtime = await import(moduleUrl("host/runtime.mjs"));
  const memory = new WebAssembly.Memory({ initial: 1 });
  let coveredRange = null;
  let readerCoveredRange = null;
  let readerState = "idle";
  let importCalls = 0;
  let drawCalls = 0;
  const ingestWorker = {
    indexReader: {
      coveredRange() {
        return readerCoveredRange;
      },
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

  await flushMicrotasks();

  assert.equal(
    importCalls,
    1,
    "renderer implementation module import should start before the first animation frame",
  );
  frames[0](1);
  await flushMicrotasks();
  assert.equal(importCalls, 1, "renderer implementation module should be imported once");
  assert.equal(drawCalls, 0, "renderer should not draw before covered pages are queryable");

  coveredRange = { end: 0, start: 0, type: "covered_range", valid: false };
  readerState = "ready";
  frames[1](2);
  await flushMicrotasks();
  assert.equal(
    drawCalls,
    0,
    "renderer should wait a frame for creation after the reader becomes queryable",
  );

  frames[2](3);
  assert.equal(
    drawCalls,
    1,
    "renderer should be created after the reader is ready and a worker handoff exists",
  );

  readerCoveredRange = { end: 120, start: 100, valid: true };
  coveredRange = { end: 120, start: 100, type: "covered_range", valid: true };
  frames[3](4);
  assert.equal(
    importCalls,
    1,
    "first queryable ingest frame should reuse the preloaded renderer implementation module",
  );

  await flushMicrotasks();
  frames[4](5);
  assert.equal(importCalls, 1);
  assert.equal(drawCalls, 3);
}

async function checkRuntimeDrawsProgressiveRendererWhenCreatedQueryable() {
  const { frames } = installBrowserStubs();
  const runtime = await import(moduleUrl("host/runtime.mjs"));
  const memory = new WebAssembly.Memory({ initial: 1 });
  let drawCalls = 0;
  const coveredRange = { end: 120, start: 100, type: "covered_range", valid: true };
  const ingestWorker = {
    indexReader: {
      coveredRange() {
        return coveredRange;
      },
      status() {
        return { state: "ready" };
      },
    },
    status() {
      return { coveredRange, state: "running" };
    },
  };

  runtime.runApp(memory, {}, {
    importProgressiveTraceRenderer: async () => ({
      createProgressiveTraceRenderer() {
        return {
          draw() {
            drawCalls += 1;
          },
        };
      },
    }),
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

  await flushMicrotasks();
  frames[0](1);
  frames[1](2);
  await flushMicrotasks();

  assert.equal(
    drawCalls,
    1,
    "queryable renderer creation should draw in the same frame",
  );
}

async function checkAppReadyWaitsForFirstFrameAndDeferredRenderer() {
  const { frames } = installBrowserStubs();
  const runtime = await import(moduleUrl("host/runtime.mjs"));
  const memory = new WebAssembly.Memory({ initial: 1 });
  const performanceEntries = [];
  const performance = {
    mark(name) {
      performanceEntries.push({ kind: "mark", name });
    },
    measure(name, start, end) {
      performanceEntries.push({ kind: "measure", name, start, end });
    },
  };
  let resolveRendererImport;
  let rendererImportStarted = false;
  const rendererImport = new Promise((resolve) => {
    resolveRendererImport = resolve;
  });

  runtime.runApp(memory, {}, {
    importProgressiveTraceRenderer: () => {
      rendererImportStarted = true;
      return rendererImport;
    },
    instantiateWasmModuleForThread: async () => ({
      exports: {
        tracy_main() {},
        tracy_tick() {},
      },
    }),
    performance,
    worker: {
      Worker: FakeWorker,
    },
  });

  await flushMicrotasks();

  assert.equal(
    performanceEntries.some((entry) => entry.name === "tracy.core.ready"),
    true,
    "core readiness should remain on the tight startup path",
  );
  assert.equal(
    performanceEntries.some((entry) => entry.name === "tracy.app.ready"),
    false,
    "full readiness should not fire before the first frame",
  );
  assert.equal(
    rendererImportStarted,
    true,
    "deferred renderer import should start before the first frame",
  );

  frames[0](1);
  await flushMicrotasks();
  assert.equal(
    performanceEntries.some((entry) => entry.name === "tracy.app.ready"),
    false,
    "full readiness should wait for deferred renderer import",
  );

  resolveRendererImport({
    createProgressiveTraceRenderer() {
      throw new Error("not expected before queryable pages");
    },
  });
  await import(moduleUrl("host/trace-renderer-spec.mjs"));
  await flushMicrotasks();
  assert.deepEqual(performanceEntries.slice(-2), [
    { kind: "mark", name: "tracy.app.ready" },
    {
      kind: "measure",
      name: "tracy.app.load",
      start: "tracy.bootstrap.start",
      end: "tracy.app.ready",
    },
  ]);
}

async function checkAppReadyFailsWhenDeferredRendererFails() {
  const { frames } = installBrowserStubs();
  const runtime = await import(moduleUrl("host/runtime.mjs"));
  const memory = new WebAssembly.Memory({ initial: 1 });
  const performanceEntries = [];
  const previousError = globalThis.__TRACY_APP_LOAD_ERROR__;
  const previousConsoleError = console.error;
  const performance = {
    mark(name) {
      performanceEntries.push({ kind: "mark", name });
    },
    measure(name, start, end) {
      performanceEntries.push({ kind: "measure", name, start, end });
    },
  };

  globalThis.__TRACY_APP_LOAD_ERROR__ = "";
  console.error = () => {};
  runtime.runApp(memory, {}, {
    importProgressiveTraceRenderer: async () => {
      throw new Error("deferred renderer unavailable");
    },
    instantiateWasmModuleForThread: async () => ({
      exports: {
        tracy_main() {},
        tracy_tick() {},
      },
    }),
    performance,
    worker: {
      Worker: FakeWorker,
    },
  });

  await flushMicrotasks();
  frames[0](1);
  await flushMicrotasks();

  assert.equal(
    performanceEntries.some((entry) => entry.name === "tracy.app.ready"),
    false,
    "full readiness should not pass when deferred renderer import fails",
  );
  assert.equal(globalThis.__TRACY_APP_LOAD_ERROR__, "deferred renderer unavailable");
  globalThis.__TRACY_APP_LOAD_ERROR__ = previousError;
  console.error = previousConsoleError;
}

async function main() {
  await loadGeneratedIndexFormatSpec();
  await checkRuntimeOrchestratesWorker();
  await checkRuntimeStartsIngestFromFileSelection();
  await checkRuntimeIgnoresStaleIngestWorkerMessages();
  await checkFileSelectionSetupErrorsReportStatus();
  await checkMainThreadIndexReaderQueriesCommittedPages();
  await checkMainThreadIndexReaderProbesStaleCatalogSize();
  await checkMainThreadSliceCatalogReportsCapacityOverflow();
  await checkMainThreadIndexReaderFailsOnCatalogOverflow();
  await checkWorkerStatusReportsReaderCatalogOverflow();
  await checkWorkerCoveredRangeOpensReaderBeforeRangeIsValid();
  checkWatWriterPropagatesCatalogOverflow();
  await checkProgressiveTraceRendererDrawsCoveredPartialRows();
  await checkProgressiveTraceRendererClampsToSliceCatalogCoverage();
  await checkProgressiveTraceRendererSurfacesCappedQueries();
  await checkProgressiveTraceRendererTilesFullVisibleViewport();
  await checkProgressiveTraceRendererBoundsLargeViewportQueries();
  await checkProgressiveTraceRendererMarksSkippedTracksWhenBudgetExhausted();
  await checkProgressiveTraceRendererUsesWasmCanvasOpPlanner();
  await checkProgressiveTraceRendererClampsPanZoomAndDrawsUnknownRange();
  await checkRuntimePreloadsProgressiveTraceRendererImplementation();
  await checkRuntimeDrawsProgressiveRendererWhenCreatedQueryable();
  await checkAppReadyWaitsForFirstFrameAndDeferredRenderer();
  await checkAppReadyFailsWhenDeferredRendererFails();
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
