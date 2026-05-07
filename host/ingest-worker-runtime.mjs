import { makeWorkerThreadHost } from "./shim.mjs";
import { HOST_IMPORT_NAME } from "./abi.mjs";
import { instantiateWasmModuleForThread } from "./wasm-modules.mjs";

export const INGEST_WORKER_MESSAGE = Object.freeze({
  COMPLETE: "complete",
  COVERED_RANGE: "covered_range",
  ERROR: "error",
  PROGRESS: "progress",
  START: "start",
});

const WORKER_THREAD = "worker";
const DEFAULT_MEMORY_INITIAL_PAGES = 8272;
const DEFAULT_MEMORY_MAXIMUM_PAGES = 32768;
const DEFAULT_STATE_PTR = 4096;
const DEFAULT_WRITER_PAGE_PTR = 65536;
const DEFAULT_DICT_EPOCH = 1;
const DEFAULT_CHUNK_BYTES = 0;
const DEFAULT_BYTE_BUDGET = 8192;
const DEFAULT_NAME_PTR = 2048;
const DEFAULT_COVERED_RANGE_INTERVAL_MS = 33;
const DEFAULT_PROGRESS_WINDOW_MS = 5000;
const DEFAULT_ETA_STABLE_MS = 3000;
const DEFAULT_PARSE_OUTPUT_RECORDS = 4096;
const TOKEN_OUTPUT_BASE = 5 * 1024 * 1024;

function globalValue(value) {
  return value instanceof WebAssembly.Global ? value.value : value;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function makeDefaultMemory() {
  return new WebAssembly.Memory({
    initial: DEFAULT_MEMORY_INITIAL_PAGES,
    maximum: DEFAULT_MEMORY_MAXIMUM_PAGES,
  });
}

function writeName(memory, ptr, value) {
  const encoded = new TextEncoder().encode(value);
  const bytes = new Uint8Array(memory.buffer);
  const end = ptr + encoded.byteLength;

  if (end > bytes.byteLength) {
    throw new Error(`worker ingest name does not fit in memory at ${ptr}`);
  }

  bytes.set(encoded, ptr);
  return encoded.byteLength;
}

async function openNamedHostResource(memory, host, hostImport, name, namePtr) {
  if (typeof name !== "string" || name.length === 0) {
    throw new Error(`${hostImport} requires a non-empty name`);
  }

  const len = writeName(memory, namePtr, name);
  return host[hostImport](namePtr, len);
}

function initAllocator(imports) {
  const alloc = imports.alloc;
  const mem = imports.mem;

  if (alloc?.bump_init === undefined || mem === undefined) {
    return;
  }

  alloc.bump_init(
    globalValue(mem.MEM_HEAP_BASE),
    globalValue(mem.MEM_STACK_BASE),
  );
}

function readI64AsNumber(view, ptr) {
  return Number(view.getBigUint64(ptr, true));
}

function parserFileOffset(memory, parserState, statePtr) {
  const offset = globalValue(parserState.PARSER_STATE_FILE_OFFSET_OFFSET);
  return readI64AsNumber(new DataView(memory.buffer), statePtr + offset);
}

function parserEventCount(memory, parserState, statePtr) {
  const offset = globalValue(parserState.PARSER_STATE_EVENT_COUNT_OFFSET);
  return new DataView(memory.buffer).getInt32(statePtr + offset, true);
}

function numericSize(size) {
  if (size === undefined || size === null) {
    return null;
  }

  const value = Number(size);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function sourceSize(host, sourceId) {
  const size = host[HOST_IMPORT_NAME.OPFS_SOURCE_SIZE]?.(sourceId);

  return numericSize(size);
}

function indexCoveredRange(index) {
  const valid =
    globalValue(index?.index_writer_covered_range_valid?.() ?? 0) !== 0;

  return {
    valid,
    start: valid
      ? globalValue(index.index_writer_covered_range_start?.() ?? 0)
      : 0,
    end: valid
      ? globalValue(index.index_writer_covered_range_end?.() ?? 0)
      : 0,
  };
}

function postCoveredRangeIfDue(state, force = false) {
  const now = state.now();
  if (!force && now - state.lastCoveredRangeAt < state.coveredRangeIntervalMs) {
    return;
  }

  state.lastCoveredRangeAt = now;
  state.postMessage({
    type: INGEST_WORKER_MESSAGE.COVERED_RANGE,
    ...indexCoveredRange(state.index),
  });
}

function progressStats(state, now, fileOffset) {
  const sample = { fileOffset, time: now };
  state.progressSamples.push(sample);

  while (
    state.progressSamples.length > 1 &&
    now - state.progressSamples[0].time > state.progressWindowMs
  ) {
    state.progressSamples.shift();
  }

  const first = state.progressSamples[0];
  const elapsedMs = sample.time - first.time;
  const elapsedSeconds = elapsedMs / 1000;
  const bytes = sample.fileOffset - first.fileOffset;
  const throughputBytesPerSecond =
    elapsedSeconds > 0 && bytes > 0 ? bytes / elapsedSeconds : 0;
  const remainingBytes =
    state.totalBytes === null ? null : Math.max(0, state.totalBytes - fileOffset);
  const etaSeconds =
    remainingBytes !== null &&
    elapsedMs >= state.etaStableMs &&
    throughputBytesPerSecond > 0
      ? remainingBytes / throughputBytesPerSecond
      : null;

  return {
    etaSeconds,
    throughputBytesPerSecond,
    totalBytes: state.totalBytes,
  };
}

function postProgress(state, phase) {
  const now = state.now();
  const fileOffset = parserFileOffset(state.memory, state.parserState, state.statePtr);

  state.postMessage({
    type: INGEST_WORKER_MESSAGE.PROGRESS,
    phase,
    fileOffset,
    parsedEvents: parserEventCount(state.memory, state.parserState, state.statePtr),
    indexedEvents: state.index?.index_writer_committed_events?.() ?? 0,
    committedPages: state.index?.index_writer_committed_pages?.() ?? 0,
    ...progressStats(state, now, fileOffset),
  });
}

function drainExtractedEvents({ index, parser }) {
  let extractedEvents = 0;

  while (true) {
    const eventPtr = parser.extractor_next();
    if (eventPtr === -1) {
      return extractedEvents;
    }

    const appendStatus = index.index_add_event(eventPtr);
    if (appendStatus !== globalValue(index.INDEX_INGEST_STATUS_OK)) {
      throw new Error(`index ingest failed with status ${appendStatus}`);
    }

    extractedEvents += 1;
  }
}

function releaseParserOutput({ parser, statePtr }) {
  const resetStatus = parser.parser_token_output_reset?.(
    statePtr,
    DEFAULT_PARSE_OUTPUT_RECORDS,
  );
  if (resetStatus !== undefined && resetStatus !== 1) {
    throw new Error("parser token output reset failed");
  }

  parser.extractor_reset_cursor?.();
}

async function instantiateIngestModules(options, memory, host) {
  const instantiate =
    options.instantiateWasmModuleForThread ?? instantiateWasmModuleForThread;
  const moduleOptions = {
    baseUrl: options.baseUrl ?? "wasm/",
  };

  if (options.compile !== undefined) {
    moduleOptions.compile = options.compile;
  }
  if (options.instantiate !== undefined) {
    moduleOptions.instantiate = options.instantiate;
  }

  const parserLoaded = await instantiate(
    "parser",
    WORKER_THREAD,
    { env: { memory }, host },
    moduleOptions,
  );
  const indexLoaded = await instantiate(
    "index",
    WORKER_THREAD,
    { env: { memory }, host },
    moduleOptions,
  );

  initAllocator(parserLoaded.imports);

  return {
    index: indexLoaded.exports,
    parser: parserLoaded.exports,
    parserState: parserLoaded.imports.parser_state,
  };
}

async function resolveSourceId({ data, host, memory, namePtr }) {
  if (Number.isInteger(data.sourceId)) {
    return data.sourceId;
  }

  if (
    data.sourceFile !== null &&
    typeof data.sourceFile === "object" &&
    Number.isInteger(data.sourceFileHandle)
  ) {
    return host[HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE](data.sourceFileHandle);
  }

  return openNamedHostResource(
    memory,
    host,
    HOST_IMPORT_NAME.OPFS_SOURCE_OPEN,
    data.sourceName,
    namePtr,
  );
}

async function resolveIndexId({ data, host, memory, namePtr }) {
  if (Number.isInteger(data.indexId)) {
    return data.indexId;
  }

  if (data.createIndex === false) {
    return openNamedHostResource(
      memory,
      host,
      HOST_IMPORT_NAME.OPFS_INDEX_OPEN,
      data.indexName,
      namePtr,
    );
  }

  return openNamedHostResource(
    memory,
    host,
    HOST_IMPORT_NAME.OPFS_INDEX_CREATE,
    data.indexName,
    namePtr,
  );
}

function sourceFilesForWorker(data) {
  if (
    data?.sourceFile !== null &&
    typeof data?.sourceFile === "object" &&
    Number.isInteger(data.sourceFileHandle)
  ) {
    return new Map([[data.sourceFileHandle, data.sourceFile]]);
  }

  return new Map();
}

export async function runWorkerIngest(data, options = {}) {
  const memory = (options.memoryFactory ?? makeDefaultMemory)();
  const host = (options.hostFactory ?? makeWorkerThreadHost)(
    memory,
    sourceFilesForWorker(data),
  );
  const { parser, parserState, index } = await instantiateIngestModules(
    options,
    memory,
    host,
  );
  const postMessage = options.postMessage ?? globalThis.postMessage?.bind(globalThis);

  if (typeof postMessage !== "function") {
    throw new Error("worker ingest runtime requires postMessage");
  }

  const statePtr = data.statePtr ?? DEFAULT_STATE_PTR;
  const writerPagePtr = data.writerPagePtr ?? DEFAULT_WRITER_PAGE_PTR;
  const dictEpoch = data.dictEpoch ?? DEFAULT_DICT_EPOCH;
  const chunkBytes = data.chunkBytes ?? DEFAULT_CHUNK_BYTES;
  const byteBudget = data.byteBudget ?? DEFAULT_BYTE_BUDGET;
  const namePtr = data.namePtr ?? DEFAULT_NAME_PTR;
  const sourceId = await resolveSourceId({ data, host, memory, namePtr });
  const indexId = await resolveIndexId({ data, host, memory, namePtr });
  const totalBytes =
    numericSize(data.totalBytes ?? data.sourceSize) ?? sourceSize(host, sourceId);
  const workerState = {
    coveredRangeIntervalMs:
      data.coveredRangeIntervalMs ?? DEFAULT_COVERED_RANGE_INTERVAL_MS,
    etaStableMs: data.etaStableMs ?? DEFAULT_ETA_STABLE_MS,
    index,
    lastCoveredRangeAt: Number.NEGATIVE_INFINITY,
    memory,
    now: options.now ?? (() => performance.now()),
    parserState,
    postMessage,
    progressSamples: [],
    progressWindowMs: data.progressWindowMs ?? DEFAULT_PROGRESS_WINDOW_MS,
    statePtr,
    totalBytes,
  };

  parserState.parser_state_init(statePtr, sourceId);
  index.index_writer_init(indexId, writerPagePtr, dictEpoch);
  parser.extractor_init(data.tokenOutputPtr ?? TOKEN_OUTPUT_BASE);
  postProgress(workerState, "parse");

  let extractedEvents = 0;
  while (true) {
    const status = parser.parser_parse_with_budget(
      statePtr,
      chunkBytes,
      byteBudget,
    );

    extractedEvents += drainExtractedEvents({ index, parser });

    if (status === globalValue(parserState.PARSER_STATUS_DONE)) {
      break;
    }
    if (status !== globalValue(parserState.PARSER_STATUS_YIELDED)) {
      throw new Error(`parser failed with status ${status}`);
    }

    releaseParserOutput({ parser, statePtr });

    const publishStatus = index.index_writer_publish_partial?.();
    if (publishStatus !== globalValue(index.INDEX_WRITER_STATUS_OK)) {
      throw new Error(`index partial publish failed with status ${publishStatus}`);
    }
    postCoveredRangeIfDue(workerState);
    postProgress(workerState, "parse");
  }

  postProgress(workerState, "index");

  const flushStatus = index.index_writer_flush();
  if (flushStatus !== globalValue(index.INDEX_WRITER_STATUS_OK)) {
    throw new Error(`index flush failed with status ${flushStatus}`);
  }

  postCoveredRangeIfDue(workerState, true);

  const result = {
    committedEvents: index.index_writer_committed_events(),
    committedPages: index.index_writer_committed_pages(),
    extractedEvents,
    indexedEvents: index.index_writer_committed_events(),
    sourceId,
    indexId,
  };

  postProgress(workerState, "complete");
  postMessage({
    type: INGEST_WORKER_MESSAGE.COMPLETE,
    ...result,
  });

  return result;
}

export function createIngestWorkerMessageHandler(options = {}) {
  const postMessage = options.postMessage ?? globalThis.postMessage?.bind(globalThis);
  const runIngest = options.runWorkerIngest ?? runWorkerIngest;

  return async function handleIngestWorkerMessage(event) {
    const data = event?.data ?? event;

    if (data?.type !== INGEST_WORKER_MESSAGE.START) {
      return;
    }

    try {
      await runIngest(data, { ...options, postMessage });
    } catch (error) {
      postMessage({
        type: INGEST_WORKER_MESSAGE.ERROR,
        message: errorMessage(error),
      });
    }
  };
}
