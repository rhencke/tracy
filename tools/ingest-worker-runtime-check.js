#!/usr/bin/env node

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

function moduleUrl(relativePath) {
  return pathToFileURL(path.resolve(__dirname, "..", relativePath)).href;
}

function decodeString(memory, ptr, len) {
  return new TextDecoder().decode(new Uint8Array(memory.buffer, ptr, len));
}

function makeParserExports(memory, parserState) {
  const parseOffsets = [16, 32, 48];
  const parseEventCounts = [1, 2, 3];
  const eventsByParse = [[8001], [8002], [8003]];
  let currentEvents = [];
  let parseCalls = 0;
  let nextEvent = 0;
  let extractorInits = 0;
  const outputResets = [];
  let cursorResets = 0;

  function writeParserState(statePtr, index) {
    const view = new DataView(memory.buffer);
    view.setBigUint64(
      statePtr + parserState.PARSER_STATE_FILE_OFFSET_OFFSET,
      BigInt(parseOffsets[index]),
      true,
    );
    view.setInt32(
      statePtr + parserState.PARSER_STATE_EVENT_COUNT_OFFSET,
      parseEventCounts[index],
      true,
    );
  }

  return {
    extractor_init(ptr) {
      assert.equal(ptr, 7000);
      assert.equal(parseCalls, 0);
      extractorInits += 1;
    },
    extractor_next() {
      assert.equal(extractorInits, 1);
      if (nextEvent >= currentEvents.length) {
        return -1;
      }

      const eventPtr = currentEvents[nextEvent];
      nextEvent += 1;
      return eventPtr;
    },
    extractor_reset_cursor() {
      cursorResets += 1;
      currentEvents = [];
      nextEvent = 0;
    },
    parser_parse_with_budget(statePtr, chunkBytes, byteBudget) {
      assert.equal(chunkBytes, 0);
      assert.equal(byteBudget, 9);
      writeParserState(statePtr, parseCalls);
      currentEvents = eventsByParse[parseCalls];
      nextEvent = 0;
      parseCalls += 1;
      return parseCalls < parseOffsets.length
        ? parserState.PARSER_STATUS_YIELDED
        : parserState.PARSER_STATUS_DONE;
    },
    parser_token_output_reset(statePtr, recordCap) {
      assert.equal(statePtr, 1000);
      assert.equal(recordCap, parserState.PARSER_DEFAULT_OUTPUT_RECORD_CAP);
      outputResets.push({ recordCap, statePtr });
      return 1;
    },
    outputResets,
    get cursorResets() {
      return cursorResets;
    },
  };
}

function makeIndexExports() {
  const events = [];
  const partialPublishes = [];
  let coveredRange = null;

  function commitCoveredRange() {
    coveredRange = {
      start: 100,
      end: 100 + events.length * 10,
    };
  }

  return {
    INDEX_INGEST_STATUS_IGNORED: 1,
    INDEX_INGEST_STATUS_OK: 0,
    INDEX_WRITER_STATUS_OK: 0,
    index_add_event(eventPtr) {
      events.push(eventPtr);
      return 0;
    },
    index_writer_committed_events() {
      return events.length;
    },
    index_writer_committed_pages() {
      return events.length === 0 ? 0 : 1;
    },
    index_writer_covered_range_end() {
      return coveredRange?.end ?? 0;
    },
    index_writer_covered_range_start() {
      return coveredRange?.start ?? 0;
    },
    index_writer_covered_range_valid() {
      return coveredRange === null ? 0 : 1;
    },
    index_writer_flush() {
      assert.equal(events.length, 3);
      commitCoveredRange();
      return 0;
    },
    index_writer_init(indexId, writerPagePtr, dictEpoch) {
      assert.equal(indexId, 22);
      assert.equal(writerPagePtr, 6000);
      assert.equal(dictEpoch, 5);
    },
    index_writer_publish_partial() {
      partialPublishes.push(events.length);
      commitCoveredRange();
      return 0;
    },
    partialPublishes,
  };
}

async function checkWorkerRuntime() {
  const runtime = await import(moduleUrl("host/ingest-worker-runtime.mjs"));
  const abi = await import(moduleUrl("host/abi.mjs"));
  const memory = new WebAssembly.Memory({ initial: 2 });
  const parserState = {
    PARSER_DEFAULT_OUTPUT_RECORD_CAP: 8192,
    PARSER_STATE_EVENT_COUNT_OFFSET: 8,
    PARSER_STATE_FILE_OFFSET_OFFSET: 0,
    PARSER_STATUS_DONE: 2,
    PARSER_STATUS_YIELDED: 1,
    parser_state_init(statePtr, sourceId) {
      assert.equal(statePtr, 1000);
      assert.equal(sourceId, 11);
    },
  };
  const instantiated = [];
  const hostCalls = [];
  const selectedFile = { name: "trace.json", size: 64 };
  let indexExports;
  let parserExports;
  const host = {
    [abi.HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE](fileHandle) {
      assert.equal(fileHandle, 77);
      hostCalls.push(["source-file", fileHandle]);
      return 11;
    },
    [abi.HOST_IMPORT_NAME.OPFS_SOURCE_SIZE](sourceId) {
      assert.equal(sourceId, 11);
      return 64n;
    },
    [abi.HOST_IMPORT_NAME.OPFS_INDEX_CREATE](namePtr, nameLen) {
      hostCalls.push(["index", decodeString(memory, namePtr, nameLen)]);
      return 22;
    },
  };
  const messages = [];
  const times = [0, 10, 20, 34, 35, 36];

  const result = await runtime.runWorkerIngest(
    {
      byteBudget: 9,
      coveredRangeIntervalMs: 33,
      dictEpoch: 5,
      etaStableMs: 30,
      ingestId: 42,
      indexName: "indexes/trace.idx",
      progressWindowMs: 50,
      statePtr: 1000,
      sourceFile: selectedFile,
      sourceFileHandle: 77,
      sourceSize: selectedFile.size,
      tokenOutputPtr: 7000,
      writerPagePtr: 6000,
      type: runtime.INGEST_WORKER_MESSAGE.START,
    },
    {
      hostFactory: (nextMemory, sourceFiles) => {
        assert.equal(nextMemory, memory);
        assert.equal(sourceFiles.get(77), selectedFile);
        return host;
      },
      instantiateWasmModuleForThread: async (id, thread, imports) => {
        instantiated.push({ id, thread, hasMemory: imports.env.memory === memory });
        if (id === "parser") {
          parserExports = makeParserExports(memory, parserState);
          return {
            exports: parserExports,
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
          indexExports = makeIndexExports();
          return {
            exports: indexExports,
            imports: {},
          };
        }

        throw new Error(`unexpected module ${id}`);
      },
      memoryFactory: () => memory,
      now: () => times.shift() ?? 100,
      postMessage: (message) => messages.push(message),
    },
  );

  assert.deepEqual(instantiated, [
    { id: "parser", thread: "worker", hasMemory: true },
    { id: "index", thread: "worker", hasMemory: true },
  ]);
  assert.deepEqual(hostCalls, [
    ["source-file", 77],
    ["index", "indexes/trace.idx"],
  ]);
  assert.equal(result.committedEvents, 3);
  assert.equal(result.extractedEvents, 3);
  assert.deepEqual(indexExports.partialPublishes, [1, 2]);
  assert.deepEqual(parserExports.outputResets, [
    { recordCap: 8192, statePtr: 1000 },
    { recordCap: 8192, statePtr: 1000 },
  ]);
  assert.equal(parserExports.cursorResets, 2);

  const coveredRangeMessages = messages.filter(
    (message) => message.type === runtime.INGEST_WORKER_MESSAGE.COVERED_RANGE,
  );
  assert.deepEqual(
    coveredRangeMessages.map((message) => ({
      end: message.end,
      start: message.start,
      valid: message.valid,
    })),
    [
      { end: 110, start: 100, valid: true },
      { end: 120, start: 100, valid: true },
      { end: 130, start: 100, valid: true },
    ],
  );
  assert.equal(
    messages.at(-1).type,
    runtime.INGEST_WORKER_MESSAGE.COMPLETE,
    "complete should be the final worker message",
  );
  assert.equal(
    messages.every((message) => message.ingestId === 42),
    true,
    "worker should echo ingest id on every response",
  );
  const progressMessages = messages.filter(
    (message) => message.type === runtime.INGEST_WORKER_MESSAGE.PROGRESS,
  );
  assert.deepEqual(
    progressMessages.map((message) => message.phase),
    ["parse", "parse", "parse", "index", "complete"],
  );
  assert.deepEqual(
    progressMessages.map((message) => ({
      committedPages: message.committedPages,
      fileOffset: message.fileOffset,
      indexedEvents: message.indexedEvents,
      parsedEvents: message.parsedEvents,
      totalBytes: message.totalBytes,
    })),
    [
      {
        committedPages: 0,
        fileOffset: 0,
        indexedEvents: 0,
        parsedEvents: 0,
        totalBytes: 64,
      },
      {
        committedPages: 1,
        fileOffset: 16,
        indexedEvents: 1,
        parsedEvents: 1,
        totalBytes: 64,
      },
      {
        committedPages: 1,
        fileOffset: 32,
        indexedEvents: 2,
        parsedEvents: 2,
        totalBytes: 64,
      },
      {
        committedPages: 1,
        fileOffset: 48,
        indexedEvents: 3,
        parsedEvents: 3,
        totalBytes: 64,
      },
      {
        committedPages: 1,
        fileOffset: 48,
        indexedEvents: 3,
        parsedEvents: 3,
        totalBytes: 64,
      },
    ],
  );
  assert.equal(progressMessages[1].etaSeconds, null);
  assert.ok(progressMessages[2].throughputBytesPerSecond > 0);
  assert.ok(progressMessages[2].etaSeconds > 0);
}

async function checkWorkerRuntimeReleasesFullParserTokenBuffer() {
  const runtime = await import(moduleUrl("host/ingest-worker-runtime.mjs"));
  const abi = await import(moduleUrl("host/abi.mjs"));
  const memory = new WebAssembly.Memory({ initial: 2 });
  const parserState = {
    PARSER_DEFAULT_OUTPUT_RECORD_CAP: 4096,
    PARSER_STATE_EVENT_COUNT_OFFSET: 8,
    PARSER_STATE_FILE_OFFSET_OFFSET: 0,
    PARSER_STATUS_DONE: 2,
    PARSER_STATUS_YIELDED: 1,
    parser_state_init(statePtr, sourceId) {
      assert.equal(statePtr, 1000);
      assert.equal(sourceId, 11);
    },
  };
  const eventBatches = [
    Array.from({ length: 4096 }, (_, index) => 9000 + index),
    [14096],
  ];
  const parserExports = {
    currentEvents: [],
    cursor: 0,
    parseCalls: 0,
    released: true,
    extractor_init(ptr) {
      assert.equal(ptr, 7000);
    },
    extractor_next() {
      if (this.cursor >= this.currentEvents.length) {
        return -1;
      }

      const eventPtr = this.currentEvents[this.cursor];
      this.cursor += 1;
      return eventPtr;
    },
    extractor_reset_cursor() {
      this.currentEvents = [];
      this.cursor = 0;
      this.released = true;
    },
    parser_parse_with_budget(statePtr) {
      assert.equal(statePtr, 1000);
      assert.equal(this.released, true, "parse resumed without released token output");
      const view = new DataView(memory.buffer);
      view.setBigUint64(
        statePtr + parserState.PARSER_STATE_FILE_OFFSET_OFFSET,
        BigInt((this.parseCalls + 1) * 4096),
        true,
      );
      view.setInt32(
        statePtr + parserState.PARSER_STATE_EVENT_COUNT_OFFSET,
        this.parseCalls === 0 ? 4096 : 4097,
        true,
      );
      this.currentEvents = eventBatches[this.parseCalls];
      this.cursor = 0;
      this.released = false;
      this.parseCalls += 1;
      return this.parseCalls === 1
        ? parserState.PARSER_STATUS_YIELDED
        : parserState.PARSER_STATUS_DONE;
    },
    parser_token_output_reset(statePtr, recordCap) {
      assert.equal(statePtr, 1000);
      assert.equal(recordCap, parserState.PARSER_DEFAULT_OUTPUT_RECORD_CAP);
      return 1;
    },
  };
  const indexedEvents = [];
  const indexExports = {
    INDEX_INGEST_STATUS_OK: 0,
    INDEX_WRITER_STATUS_OK: 0,
    index_add_event(eventPtr) {
      indexedEvents.push(eventPtr);
      return 0;
    },
    index_writer_committed_events() {
      return indexedEvents.length;
    },
    index_writer_committed_pages() {
      return indexedEvents.length === 0 ? 0 : 1;
    },
    index_writer_covered_range_end() {
      return indexedEvents.length;
    },
    index_writer_covered_range_start() {
      return 0;
    },
    index_writer_covered_range_valid() {
      return indexedEvents.length === 0 ? 0 : 1;
    },
    index_writer_flush() {
      assert.equal(indexedEvents.length, 4097);
      return 0;
    },
    index_writer_init() {},
    index_writer_publish_partial() {
      assert.equal(indexedEvents.length, 4096);
      return 0;
    },
  };
  const host = {
    [abi.HOST_IMPORT_NAME.OPFS_SOURCE_OPEN]() {
      return 11;
    },
    [abi.HOST_IMPORT_NAME.OPFS_INDEX_CREATE]() {
      return 22;
    },
  };

  const result = await runtime.runWorkerIngest(
    {
      byteBudget: 9,
      indexName: "indexes/trace.idx",
      sourceName: "sources/trace.json",
      statePtr: 1000,
      tokenOutputPtr: 7000,
      type: runtime.INGEST_WORKER_MESSAGE.START,
    },
    {
      hostFactory: () => host,
      instantiateWasmModuleForThread: async (id) => {
        if (id === "parser") {
          return {
            exports: parserExports,
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

        throw new Error(`unexpected module ${id}`);
      },
      memoryFactory: () => memory,
      now: () => 0,
      postMessage() {},
    },
  );

  assert.equal(result.extractedEvents, 4097);
  assert.equal(result.committedEvents, 4097);
  assert.equal(indexedEvents.at(4095), 13095);
  assert.equal(indexedEvents.at(4096), 14096);
}

async function checkWorkerRuntimeSkipsIgnoredParserEvents() {
  const runtime = await import(moduleUrl("host/ingest-worker-runtime.mjs"));
  const memory = new WebAssembly.Memory({ initial: 2 });
  const parserState = {
    PARSER_DEFAULT_OUTPUT_RECORD_CAP: 4096,
    PARSER_STATE_EVENT_COUNT_OFFSET: 8,
    PARSER_STATE_FILE_OFFSET_OFFSET: 0,
    PARSER_STATUS_DONE: 2,
    PARSER_STATUS_YIELDED: 1,
    parser_state_init() {},
  };
  const events = [8001, 8002, 8003];
  const parserExports = {
    cursor: 0,
    extractor_init() {},
    extractor_next() {
      if (this.cursor >= events.length) {
        return -1;
      }

      const eventPtr = events[this.cursor];
      this.cursor += 1;
      return eventPtr;
    },
    extractor_reset_cursor() {},
    parser_parse_with_budget(statePtr) {
      const view = new DataView(memory.buffer);
      view.setBigUint64(
        statePtr + parserState.PARSER_STATE_FILE_OFFSET_OFFSET,
        64n,
        true,
      );
      view.setInt32(
        statePtr + parserState.PARSER_STATE_EVENT_COUNT_OFFSET,
        events.length,
        true,
      );
      return parserState.PARSER_STATUS_DONE;
    },
    parser_token_output_reset() {
      return 1;
    },
  };
  const acceptedEvents = [];
  const indexExports = {
    INDEX_INGEST_STATUS_IGNORED: 1,
    INDEX_INGEST_STATUS_OK: 0,
    INDEX_WRITER_STATUS_OK: 0,
    index_add_event(eventPtr) {
      if (eventPtr === 8002) {
        return 1;
      }

      acceptedEvents.push(eventPtr);
      return 0;
    },
    index_writer_committed_events() {
      return acceptedEvents.length;
    },
    index_writer_committed_pages() {
      return acceptedEvents.length === 0 ? 0 : 1;
    },
    index_writer_covered_range_end() {
      return acceptedEvents.length;
    },
    index_writer_covered_range_start() {
      return 0;
    },
    index_writer_covered_range_valid() {
      return acceptedEvents.length === 0 ? 0 : 1;
    },
    index_writer_flush() {
      return 0;
    },
    index_writer_init() {},
    index_writer_publish_partial() {
      return 0;
    },
  };

  const result = await runtime.runWorkerIngest(
    {
      indexId: 22,
      sourceId: 11,
      statePtr: 1000,
      type: runtime.INGEST_WORKER_MESSAGE.START,
    },
    {
      hostFactory: () => ({}),
      instantiateWasmModuleForThread: async (id) => {
        if (id === "parser") {
          return {
            exports: parserExports,
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

        throw new Error(`unexpected module ${id}`);
      },
      memoryFactory: () => memory,
      now: () => 0,
      postMessage() {},
    },
  );

  assert.equal(result.extractedEvents, 3);
  assert.equal(result.committedEvents, 2);
  assert.deepEqual(acceptedEvents, [8001, 8003]);
}

async function checkWorkerRuntimeRequiresParserResetAbi() {
  const runtime = await import(moduleUrl("host/ingest-worker-runtime.mjs"));
  const memory = new WebAssembly.Memory({ initial: 2 });
  const parserState = {
    PARSER_DEFAULT_OUTPUT_RECORD_CAP: 4096,
    PARSER_STATE_EVENT_COUNT_OFFSET: 8,
    PARSER_STATE_FILE_OFFSET_OFFSET: 0,
    PARSER_STATUS_DONE: 2,
    PARSER_STATUS_YIELDED: 1,
    parser_state_init() {},
  };
  const requiredParserExports = makeParserExports(memory, parserState);

  async function runWithParserExports(parserExports) {
    await runtime.runWorkerIngest(
      {
        indexId: 22,
        sourceId: 11,
        statePtr: 1000,
        tokenOutputPtr: 7000,
        type: runtime.INGEST_WORKER_MESSAGE.START,
      },
      {
        hostFactory: () => ({}),
        instantiateWasmModuleForThread: async (id) => {
          if (id === "parser") {
            return {
              exports: parserExports,
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
            return { exports: makeIndexExports(), imports: {} };
          }

          throw new Error(`unexpected module ${id}`);
        },
        memoryFactory: () => memory,
        now: () => 0,
        postMessage() {},
      },
    );
  }

  await assert.rejects(
    () =>
      runWithParserExports({
        ...requiredParserExports,
        parser_token_output_reset: undefined,
      }),
    /parser module missing required export parser_token_output_reset/,
  );
  await assert.rejects(
    () =>
      runWithParserExports({
        ...requiredParserExports,
        extractor_reset_cursor: undefined,
      }),
    /parser module missing required export extractor_reset_cursor/,
  );
}

async function checkMessageHandler() {
  const runtime = await import(moduleUrl("host/ingest-worker-runtime.mjs"));
  const messages = [];
  const handled = [];
  const handleMessage = runtime.createIngestWorkerMessageHandler({
    postMessage: (message) => messages.push(message),
    runWorkerIngest: async (data) => {
      handled.push(data);
      throw new Error("kaboom");
    },
  });

  await handleMessage({ data: { type: "ignored" } });
  assert.equal(handled.length, 0);
  assert.equal(messages.length, 0);

  await handleMessage({
    data: { ingestId: 7, type: runtime.INGEST_WORKER_MESSAGE.START },
  });
  assert.equal(handled.length, 1);
  assert.equal(handled[0].ingestId, 7);
  assert.deepEqual(messages, [
    {
      ingestId: 7,
      type: runtime.INGEST_WORKER_MESSAGE.ERROR,
      message: "kaboom",
    },
  ]);
}

async function main() {
  await checkWorkerRuntime();
  await checkWorkerRuntimeReleasesFullParserTokenBuffer();
  await checkWorkerRuntimeSkipsIgnoredParserEvents();
  await checkWorkerRuntimeRequiresParserResetAbi();
  await checkMessageHandler();
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
