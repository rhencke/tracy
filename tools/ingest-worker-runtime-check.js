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
  let parseCalls = 0;
  let nextEvent = 0;
  let extractorInits = 0;

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
      if (nextEvent >= parseCalls) {
        return -1;
      }

      nextEvent += 1;
      return 8000 + nextEvent;
    },
    parser_parse_with_budget(statePtr, chunkBytes, byteBudget) {
      assert.equal(chunkBytes, 0);
      assert.equal(byteBudget, 9);
      writeParserState(statePtr, parseCalls);
      parseCalls += 1;
      return parseCalls < parseOffsets.length
        ? parserState.PARSER_STATUS_YIELDED
        : parserState.PARSER_STATUS_DONE;
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
  let indexExports;
  const host = {
    [abi.HOST_IMPORT_NAME.OPFS_SOURCE_OPEN](namePtr, nameLen) {
      hostCalls.push(["source", decodeString(memory, namePtr, nameLen)]);
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
      indexName: "indexes/trace.idx",
      progressWindowMs: 50,
      statePtr: 1000,
      sourceName: "sources/trace.json",
      tokenOutputPtr: 7000,
      writerPagePtr: 6000,
      type: runtime.INGEST_WORKER_MESSAGE.START,
    },
    {
      hostFactory: () => host,
      instantiateWasmModuleForThread: async (id, thread, imports) => {
        instantiated.push({ id, thread, hasMemory: imports.env.memory === memory });
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
    ["source", "sources/trace.json"],
    ["index", "indexes/trace.idx"],
  ]);
  assert.equal(result.committedEvents, 3);
  assert.equal(result.extractedEvents, 3);
  assert.deepEqual(indexExports.partialPublishes, [1, 2]);

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
      { end: 130, start: 100, valid: true },
    ],
  );
  assert.equal(
    messages.at(-1).type,
    runtime.INGEST_WORKER_MESSAGE.COMPLETE,
    "complete should be the final worker message",
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

  await handleMessage({ data: { type: runtime.INGEST_WORKER_MESSAGE.START } });
  assert.equal(handled.length, 1);
  assert.deepEqual(messages, [
    {
      type: runtime.INGEST_WORKER_MESSAGE.ERROR,
      message: "kaboom",
    },
  ]);
}

async function main() {
  await checkWorkerRuntime();
  await checkMessageHandler();
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
