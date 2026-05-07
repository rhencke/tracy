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

function postCoveredRangeIfDue(state, force = false) {
  const now = state.now();
  if (!force && now - state.lastCoveredRangeAt < state.coveredRangeIntervalMs) {
    return;
  }

  state.lastCoveredRangeAt = now;
  state.postMessage({
    type: INGEST_WORKER_MESSAGE.COVERED_RANGE,
    start: 0,
    end: parserFileOffset(state.memory, state.parserState, state.statePtr),
  });
}

function postProgress(state, phase) {
  state.postMessage({
    type: INGEST_WORKER_MESSAGE.PROGRESS,
    phase,
    fileOffset: parserFileOffset(state.memory, state.parserState, state.statePtr),
    parsedEvents: parserEventCount(state.memory, state.parserState, state.statePtr),
    indexedEvents: state.index?.index_writer_committed_events?.() ?? 0,
    committedPages: state.index?.index_writer_committed_pages?.() ?? 0,
  });
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

export async function runWorkerIngest(data, options = {}) {
  const memory = (options.memoryFactory ?? makeDefaultMemory)();
  const host = (options.hostFactory ?? makeWorkerThreadHost)(memory);
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
  const workerState = {
    coveredRangeIntervalMs:
      data.coveredRangeIntervalMs ?? DEFAULT_COVERED_RANGE_INTERVAL_MS,
    index,
    lastCoveredRangeAt: Number.NEGATIVE_INFINITY,
    memory,
    now: options.now ?? (() => performance.now()),
    parserState,
    postMessage,
    statePtr,
  };

  parserState.parser_state_init(statePtr, sourceId);
  index.index_writer_init(indexId, writerPagePtr, dictEpoch);
  postProgress(workerState, "parse");

  while (true) {
    const status = parser.parser_parse_with_budget(
      statePtr,
      chunkBytes,
      byteBudget,
    );

    postCoveredRangeIfDue(workerState);
    if (status === globalValue(parserState.PARSER_STATUS_DONE)) {
      break;
    }
    if (status !== globalValue(parserState.PARSER_STATUS_YIELDED)) {
      throw new Error(`parser failed with status ${status}`);
    }
  }

  postCoveredRangeIfDue(workerState, true);
  postProgress(workerState, "index");
  parser.extractor_init(data.tokenOutputPtr ?? TOKEN_OUTPUT_BASE);

  let extractedEvents = 0;
  while (true) {
    const eventPtr = parser.extractor_next();
    if (eventPtr === -1) {
      break;
    }

    const appendStatus = index.index_add_event(eventPtr);
    if (appendStatus !== globalValue(index.INDEX_INGEST_STATUS_OK)) {
      throw new Error(`index ingest failed with status ${appendStatus}`);
    }

    extractedEvents += 1;
  }

  const flushStatus = index.index_writer_flush();
  if (flushStatus !== globalValue(index.INDEX_WRITER_STATUS_OK)) {
    throw new Error(`index flush failed with status ${flushStatus}`);
  }

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
