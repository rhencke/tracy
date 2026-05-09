import { makeWorkerThreadHost } from "./shim.mjs";
import { HOST_ASYNC_IMPORTS, HOST_IMPORT_NAME } from "./abi.mjs";
import { RUNTIME_DEFAULTS } from "./startup-spec.mjs";
import {
  compileWasmModuleGraphForThread,
  instantiateWasmModuleForThread,
} from "./wasm-modules.mjs";

export const INGEST_WORKER_MESSAGE = Object.freeze({
  COMPLETE: "complete",
  COVERED_RANGE: "covered_range",
  ERROR: "error",
  PRELOAD: "preload",
  PRELOADED: "preloaded",
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
const {
  DEFAULT_INGEST_ETA_STABLE_MS,
  DEFAULT_INGEST_PROGRESS_WINDOW_MS,
} = RUNTIME_DEFAULTS;
const TOKEN_OUTPUT_BASE = 5 * 1024 * 1024;
let preloadedWorkerWasmModules = null;

function globalValue(value) {
  return value instanceof WebAssembly.Global ? value.value : value;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function supportsWasmJspi() {
  return (
    typeof WebAssembly.Suspending === "function" &&
    typeof WebAssembly.promising === "function"
  );
}

function wasmHostImports(host) {
  if (!supportsWasmJspi()) {
    return host;
  }

  const wrapped = { ...host };
  for (const name of HOST_ASYNC_IMPORTS) {
    if (typeof host[name] === "function") {
      wrapped[name] = new WebAssembly.Suspending(host[name]);
    }
  }
  return wrapped;
}

function promisingWasmExport(fn, receiver = undefined) {
  return typeof WebAssembly.promising === "function"
    ? WebAssembly.promising(fn)
    : fn.bind(receiver);
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

function requireParserExport(parser, name) {
  if (typeof parser?.[name] !== "function") {
    throw new Error(`parser module missing required export ${name}`);
  }
}

function assertParserStreamingAbi(parser) {
  requireParserExport(parser, "parser_token_output_reset");
  requireParserExport(parser, "extractor_reset_cursor");
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

function parserDefaultOutputRecordCap(parserState) {
  const recordCap = Number(
    globalValue(parserState?.PARSER_DEFAULT_OUTPUT_RECORD_CAP),
  );

  if (!Number.isInteger(recordCap) || recordCap <= 0) {
    throw new Error("parser state ABI missing default output record capacity");
  }

  return recordCap;
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

function coveredRangeChanged(previous, next) {
  if (previous === null) {
    return true;
  }
  return (
    previous.valid !== next.valid ||
    previous.start !== next.start ||
    previous.end !== next.end
  );
}

function postCoveredRangeIfDue(state, force = false) {
  const now = state.now();
  const coveredRange = indexCoveredRange(state.index);
  const changed = coveredRangeChanged(state.lastCoveredRange, coveredRange);

  if (
    !force &&
    !changed &&
    now - state.lastCoveredRangeAt < state.coveredRangeIntervalMs
  ) {
    return;
  }

  state.lastCoveredRangeAt = now;
  state.lastCoveredRange = coveredRange;
  state.postMessage({
    type: INGEST_WORKER_MESSAGE.COVERED_RANGE,
    ...coveredRange,
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

async function drainExtractedEvents({ addEvent, index, parser }) {
  let extractedEvents = 0;
  const ingestOk = globalValue(index.INDEX_INGEST_STATUS_OK);
  const ingestIgnored = globalValue(index.INDEX_INGEST_STATUS_IGNORED);

  while (true) {
    const eventPtr = parser.extractor_next();
    if (eventPtr === -1) {
      return extractedEvents;
    }

    const appendStatus = await addEvent(eventPtr);
    if (appendStatus !== ingestOk && appendStatus !== ingestIgnored) {
      throw new Error(`index ingest failed with status ${appendStatus}`);
    }

    extractedEvents += 1;
  }
}

function releaseParserOutput({ parser, parserState, statePtr }) {
  const resetStatus = parser.parser_token_output_reset(
    statePtr,
    parserDefaultOutputRecordCap(parserState),
  );
  if (resetStatus !== 1) {
    throw new Error("parser token output reset failed");
  }

  parser.extractor_reset_cursor();
}

async function instantiateIngestModules(options, memory, host) {
  const instantiate =
    options.instantiateWasmModuleForThread ?? instantiateWasmModuleForThread;
  const moduleOptions = {
    baseUrl: options.baseUrl ?? "wasm/",
    compile: options.compile ?? compilePreloadedWorkerWasmModule,
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
    { env: { memory }, host: wasmHostImports(host) },
    moduleOptions,
  );
  const indexLoaded = await instantiate(
    "index",
    WORKER_THREAD,
    { env: { memory }, host: wasmHostImports(host) },
    moduleOptions,
  );

  initAllocator(parserLoaded.imports);
  assertParserStreamingAbi(parserLoaded.exports);

  return {
    index: indexLoaded.exports,
    parser: parserLoaded.exports,
    parserState: parserLoaded.imports.parser_state,
  };
}

async function preloadWorkerWasmModules(options = {}) {
  if (preloadedWorkerWasmModules !== null) {
    return preloadedWorkerWasmModules;
  }

  preloadedWorkerWasmModules = compileWasmModuleGraphForThread(
    "parser",
    WORKER_THREAD,
    {
      baseUrl: options.baseUrl ?? "wasm/",
      compile: options.compile,
    },
  );
  return preloadedWorkerWasmModules;
}

async function compilePreloadedWorkerWasmModule(url, moduleId) {
  const preloaded = preloadedWorkerWasmModules === null
    ? null
    : await preloadedWorkerWasmModules;

  if (preloaded?.has(moduleId)) {
    return preloaded.get(moduleId);
  }

  return WebAssembly.compileStreaming(fetch(url));
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
    etaStableMs: data.etaStableMs ?? DEFAULT_INGEST_ETA_STABLE_MS,
    index,
    lastCoveredRangeAt: Number.NEGATIVE_INFINITY,
    lastCoveredRange: null,
    memory,
    now: options.now ?? (() => performance.now()),
    parserState,
    postMessage(message) {
      postMessage(
        Number.isInteger(data.ingestId)
          ? { ...message, ingestId: data.ingestId }
          : message,
      );
    },
    progressSamples: [],
    progressWindowMs:
      data.progressWindowMs ?? DEFAULT_INGEST_PROGRESS_WINDOW_MS,
    statePtr,
    totalBytes,
  };

  parserState.parser_state_init(statePtr, sourceId);
  index.index_writer_init(indexId, writerPagePtr, dictEpoch);
  parser.extractor_init(data.tokenOutputPtr ?? TOKEN_OUTPUT_BASE);
  postProgress(workerState, "parse");

  let extractedEvents = 0;
  const parseWithBudget = promisingWasmExport(parser.parser_parse_with_budget, parser);
  const addEvent = promisingWasmExport(index.index_add_event, index);
  const publishPartial = typeof index.index_writer_publish_partial === "function"
    ? promisingWasmExport(index.index_writer_publish_partial, index)
    : null;
  const flushWriter = promisingWasmExport(index.index_writer_flush, index);
  while (true) {
    const parserByteBudget =
      byteBudget > 0
        ? Math.min(byteBudget, DEFAULT_BYTE_BUDGET)
        : byteBudget;
    const status = await parseWithBudget(
      statePtr,
      chunkBytes,
      parserByteBudget,
    );

    extractedEvents += await drainExtractedEvents({ addEvent, index, parser });

    if (status === globalValue(parserState.PARSER_STATUS_DONE)) {
      break;
    }
    if (status !== globalValue(parserState.PARSER_STATUS_YIELDED)) {
      throw new Error(`parser failed with status ${status}`);
    }

    releaseParserOutput({ parser, parserState, statePtr });

    const publishStatus = publishPartial === null ? undefined : await publishPartial();
    if (publishStatus !== globalValue(index.INDEX_WRITER_STATUS_OK)) {
      throw new Error(`index partial publish failed with status ${publishStatus}`);
    }
    postCoveredRangeIfDue(workerState);
    postProgress(workerState, "parse");
    if (typeof options.afterParserYield === "function") {
      await options.afterParserYield(workerState);
    }
  }

  postProgress(workerState, "index");

  const flushStatus = await flushWriter();
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
  workerState.postMessage({
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

    try {
      if (data?.type === INGEST_WORKER_MESSAGE.PRELOAD) {
        await preloadWorkerWasmModules(options);
        postMessage({ type: INGEST_WORKER_MESSAGE.PRELOADED });
        return;
      }
      if (data?.type !== INGEST_WORKER_MESSAGE.START) {
        return;
      }

      await runIngest(data, { ...options, postMessage });
    } catch (error) {
      const message = {
        type: INGEST_WORKER_MESSAGE.ERROR,
        message: errorMessage(error),
      };

      postMessage(
        Number.isInteger(data.ingestId)
          ? { ...message, ingestId: data.ingestId }
          : message,
      );
    }
  };
}
