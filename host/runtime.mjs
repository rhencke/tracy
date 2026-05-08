import { HOST_IMPORT_NAME } from "./abi.mjs";
import {
  APP_SHELL_COLORS,
  PERFORMANCE_MARKS,
  PERFORMANCE_MEASURES,
  RUNTIME_BRIDGE,
  RUNTIME_DEFAULTS,
  RUNTIME_URLS,
} from "./startup-spec.mjs";

const {
  errors: RUNTIME_ERRORS,
  fileSelection: FILE_SELECTION,
  modules: RUNTIME_MODULES,
  readerStatus: READER_STATUS,
  threads: RUNTIME_THREADS,
  worker: WORKER_CONTRACT,
  workerMessages: INGEST_WORKER_MESSAGE,
  workerStatus: WORKER_STATUS,
} = RUNTIME_BRIDGE;
const MAIN_THREAD = RUNTIME_THREADS.MAIN;
const {
  DEFAULT_INGEST_NAME_MAX_BYTES,
  DEFAULT_INGEST_NAME_PTR,
  DEFAULT_READER_CACHE_SLOTS,
  DEFAULT_READER_NAME_PTR,
  DEFAULT_READER_QUERY_ROW_CAP,
} = RUNTIME_DEFAULTS;

let defaultProgressiveTraceRendererModulePromise = null;

function preloadDefaultProgressiveTraceRendererModule() {
  if (defaultProgressiveTraceRendererModulePromise === null) {
    defaultProgressiveTraceRendererModulePromise =
      import(RUNTIME_URLS.PROGRESSIVE_TRACE_RENDERER_URL);
  }

  return defaultProgressiveTraceRendererModulePromise;
}

function markPerformance(name, options) {
  const performance = options.performance ?? globalThis.performance;

  performance?.mark?.(name);
}

function measurePerformance(name, start, end, options) {
  const performance = options.performance ?? globalThis.performance;

  try {
    performance?.measure?.(name, start, end);
  } catch {}
}

function reportAppLoadError(error) {
  console.error(error);
  globalThis.__TRACY_APP_LOAD_ERROR__ = errorMessage(error);
  showError(RUNTIME_ERRORS.APP_LOAD_FAILED);
}

function cloneWorkerStatus(status) {
  return {
    coveredRange: status.coveredRange,
    error: status.error,
    ingest: status.ingest,
    progress: status.progress,
    result: status.result,
    state: status.state,
  };
}

function notifyWorkerStatus(status, options, message) {
  const snapshot = cloneWorkerStatus(status);

  options.onWorkerStatus?.(snapshot, message);
  return snapshot;
}

function globalValue(value) {
  return value instanceof WebAssembly.Global ? value.value : value;
}

function normalizedRowCap(value, fallback) {
  const numeric = Number(value);

  return Number.isFinite(numeric) && numeric >= 0
    ? Math.floor(numeric)
    : fallback;
}

function readCoveredRange(index) {
  const valid =
    globalValue(index?.index_reader_covered_range_valid?.() ?? 0) !== 0;

  return {
    valid,
    start: valid
      ? globalValue(index.index_reader_covered_range_start?.() ?? 0)
      : 0,
    end: valid
      ? globalValue(index.index_reader_covered_range_end?.() ?? 0)
      : 0,
  };
}

async function defaultCompileWasm(url) {
  return WebAssembly.compileStreaming(fetch(url));
}

async function defaultInstantiateWasm(module, imports) {
  const instance = await WebAssembly.instantiate(module, imports);

  return instance.exports;
}

function writeHostString(memory, ptr, value, label) {
  const encoded = new TextEncoder().encode(value);
  const bytes = new Uint8Array(memory.buffer);
  const end = ptr + encoded.byteLength;

  if (end > bytes.byteLength) {
    throw new Error(`${label} does not fit in memory at ${ptr}`);
  }

  bytes.set(encoded, ptr);
  return encoded.byteLength;
}

export function createMainThreadIndexReaderController(memory, host, options = {}) {
  async function defaultInstantiateIndexWasm(...args) {
    const { instantiateWasmModuleForThread } = await import("./wasm-modules.mjs");

    return instantiateWasmModuleForThread(...args);
  }

  const instantiate =
    options.instantiateWasmModuleForThread ?? defaultInstantiateIndexWasm;
  const readerState = {
    catalogFull: false,
    catalogPageCount: null,
    error: null,
    exports: null,
    indexId: null,
    indexName: null,
    openPromise: null,
    rebuildSliceCatalog: null,
    state: READER_STATUS.IDLE,
  };

  function cloneReaderStatus() {
    return {
      catalogFull: readerState.catalogFull,
      error: readerState.error,
      indexId: readerState.indexId,
      indexName: readerState.indexName,
      state: readerState.state,
    };
  }

  function failSliceCatalogOverflow(indexId, pageCount) {
    const message =
      `${RUNTIME_ERRORS.SLICE_CATALOG_FULL_PREFIX}${indexId}` +
      `${RUNTIME_ERRORS.SLICE_CATALOG_FULL_PAGE_SEPARATOR}${pageCount}`;

    readerState.catalogFull = true;
    readerState.error = message;
    readerState.state = READER_STATUS.ERROR;
    throw new Error(message);
  }

  async function loadIndexExports() {
    if (readerState.exports !== null) {
      return readerState.exports;
    }

    const loaded = await instantiate(
      RUNTIME_MODULES.INDEX,
      MAIN_THREAD,
      { env: { memory }, host },
      {
        baseUrl: options.baseUrl ?? RUNTIME_MODULES.DEFAULT_BASE_URL,
        compile: options.compile,
        instantiate: options.instantiate,
      },
    );
    readerState.exports = loaded.exports;
    return readerState.exports;
  }

  async function loadSliceCatalogRebuild() {
    if (readerState.rebuildSliceCatalog !== null) {
      return readerState.rebuildSliceCatalog;
    }
    if (typeof host[HOST_IMPORT_NAME.OPFS_INDEX_SIZE] !== "function") {
      return null;
    }

    readerState.rebuildSliceCatalog = await import("./index-reader-catalog.mjs");
    return readerState.rebuildSliceCatalog;
  }

  function refreshSliceCatalog(index, indexId, { force = false } = {}) {
    if (readerState.rebuildSliceCatalog === null) {
      return false;
    }

    const pageCount =
      readerState.rebuildSliceCatalog.mainThreadSliceCatalogPageCount(
        host,
        indexId,
      );
    const previousPageCount = readerState.catalogPageCount;
    const shouldProbe =
      readerState.rebuildSliceCatalog.shouldProbeMainThreadSliceCatalog(host);
    if (
      !force &&
      shouldProbe &&
      previousPageCount !== null &&
      pageCount <= previousPageCount
    ) {
      const probed =
        readerState.rebuildSliceCatalog.rebuildMainThreadSliceCatalog(
          memory,
          host,
          index,
          indexId,
          {
            pageCount,
            probeUntilMissing: true,
            reset: false,
            startPage: previousPageCount,
          },
        );
      readerState.catalogPageCount = probed.pageCount;
      if (probed.catalogFull === true) {
        failSliceCatalogOverflow(indexId, probed.pageCount);
      }
      if (probed.rebuilt) {
        index.index_reader_init(indexId);
      }
      readerState.catalogFull = false;
      return probed.rebuilt;
    }
    if (!force && previousPageCount === pageCount) {
      return false;
    }
    if (pageCount <= 0) {
      readerState.catalogPageCount = pageCount;
      return false;
    }

    const resetCatalog =
      force || previousPageCount === null || pageCount < previousPageCount;
    const startPage = resetCatalog ? 0 : previousPageCount;
    const rebuilt =
      readerState.rebuildSliceCatalog.rebuildMainThreadSliceCatalog(
        memory,
        host,
        index,
        indexId,
        {
          pageCount,
          reset: resetCatalog,
          startPage,
        },
      );
    readerState.catalogPageCount = rebuilt.pageCount;
    if (rebuilt.catalogFull === true) {
      failSliceCatalogOverflow(indexId, rebuilt.pageCount);
    }
    if (rebuilt.rebuilt) {
      index.index_reader_init(indexId);
    }

    readerState.catalogFull = false;
    return rebuilt.rebuilt;
  }

  async function open(indexName) {
    if (typeof indexName !== "string" || indexName.length === 0) {
      return false;
    }
    if (
      readerState.state === READER_STATUS.READY &&
      readerState.indexName === indexName
    ) {
      return true;
    }
    if (
      readerState.state === READER_STATUS.OPENING &&
      readerState.indexName === indexName &&
      readerState.openPromise !== null
    ) {
      return readerState.openPromise;
    }

    readerState.error = null;
    readerState.catalogFull = false;
    readerState.indexName = indexName;
    readerState.state = READER_STATUS.OPENING;
    readerState.openPromise = (async () => {
      try {
        const index = await loadIndexExports();
        const namePtr = options.readerNamePtr ?? DEFAULT_READER_NAME_PTR;
        const nameLen = writeHostString(
          memory,
          namePtr,
          indexName,
          RUNTIME_ERRORS.MAIN_THREAD_INDEX_NAME_LABEL,
        );
        const indexId = await host[HOST_IMPORT_NAME.OPFS_INDEX_OPEN](
          namePtr,
          nameLen,
        );

        index.index_reader_configure_cache?.(
          options.readerCacheSlots ?? DEFAULT_READER_CACHE_SLOTS,
        );
        index.index_reader_init(indexId);
        await loadSliceCatalogRebuild();
        refreshSliceCatalog(index, indexId, { force: true });
        readerState.indexId = indexId;
        readerState.state = READER_STATUS.READY;
        return true;
      } catch (error) {
        readerState.error = errorMessage(error);
        readerState.state = READER_STATUS.ERROR;
        throw error;
      } finally {
        readerState.openPromise = null;
      }
    })();

    return readerState.openPromise;
  }

  return {
    coveredRange() {
      return readerState.exports === null
        ? { valid: false, start: 0, end: 0 }
        : readCoveredRange(readerState.exports);
    },
    exports() {
      return readerState.exports;
    },
    async open(indexName) {
      return open(indexName);
    },
    queryRange(
      trackId,
      tsMin,
      tsMax,
      outPtr,
      maxRows = options.queryRowCap ?? DEFAULT_READER_QUERY_ROW_CAP,
    ) {
      if (
        readerState.state !== READER_STATUS.READY ||
        readerState.exports === null
      ) {
        throw new Error(RUNTIME_ERRORS.MAIN_THREAD_INDEX_READER_NOT_READY);
      }

      refreshSliceCatalog(readerState.exports, readerState.indexId);
      const rowCap = normalizedRowCap(maxRows, DEFAULT_READER_QUERY_ROW_CAP);
      const count = readerState.exports.index_query_range(
        trackId,
        tsMin,
        tsMax,
        outPtr,
        rowCap,
      );

      return {
        capped:
          globalValue(readerState.exports.index_query_range_capped?.() ?? 0) !== 0,
        count,
        matchedRows: Number(
          globalValue(
            readerState.exports.index_query_range_matched_rows?.() ?? count,
          ),
        ),
        writtenRows: Number(
          globalValue(
            readerState.exports.index_query_range_written_rows?.() ?? count,
          ),
        ),
      };
    },
    status() {
      return cloneReaderStatus();
    },
    trackCount() {
      return readerState.exports === null
        ? 0
        : Number(globalValue(readerState.exports.index_track_count?.() ?? 0));
    },
  };
}

export function createIngestWorkerController(options = {}) {
  const WorkerCtor = options.Worker ?? globalThis.Worker;
  const indexReader = options.indexReader ?? null;
  const status = {
    coveredRange: null,
    error: null,
    ingest: null,
    progress: null,
    result: null,
    state: WORKER_STATUS.IDLE,
  };

  let worker = null;
  let activeIngestId = null;
  let nextIngestId = 1;

  function isActiveIngestMessage(message) {
    return Number.isInteger(message?.ingestId) && message.ingestId === activeIngestId;
  }

  function handleWorkerMessage(event) {
    const message = event?.data ?? event;

    if (!isActiveIngestMessage(message)) {
      return;
    }

    if (message?.type === INGEST_WORKER_MESSAGE.PROGRESS) {
      status.progress = message;
      status.state = WORKER_STATUS.RUNNING;
    } else if (message?.type === INGEST_WORKER_MESSAGE.COVERED_RANGE) {
      status.coveredRange = message;
      status.state = WORKER_STATUS.RUNNING;
      if (typeof status.ingest?.indexName === "string") {
        indexReader?.open(status.ingest.indexName)?.catch((error) => {
          status.error = errorMessage(error);
          status.state = WORKER_STATUS.ERROR;
          notifyWorkerStatus(status, options, null);
        });
      }
    } else if (message?.type === INGEST_WORKER_MESSAGE.COMPLETE) {
      status.result = message;
      status.state = WORKER_STATUS.COMPLETE;
    } else if (message?.type === INGEST_WORKER_MESSAGE.ERROR) {
      status.error = message.message ?? RUNTIME_ERRORS.WORKER_INGEST_FAILED;
      status.state = WORKER_STATUS.ERROR;
    } else {
      return;
    }

    notifyWorkerStatus(status, options, message);
  }

  function handleWorkerError(event, eventWorker = event?.target) {
    if (eventWorker !== undefined && eventWorker !== worker) {
      return;
    }

    status.state = WORKER_STATUS.ERROR;
    status.error = event?.message ?? RUNTIME_ERRORS.INGEST_WORKER_FAILED;
    notifyWorkerStatus(status, options, event);
  }

  function cancelActiveWorker() {
    worker?.terminate?.();
    worker = null;
  }

  function ensureWorker() {
    if (worker !== null) {
      return worker;
    }
    if (typeof WorkerCtor !== "function") {
      status.state = WORKER_STATUS.UNAVAILABLE;
      status.error = RUNTIME_ERRORS.MODULE_WORKERS_UNAVAILABLE;
      notifyWorkerStatus(status, options, null);
      return null;
    }

    try {
      worker = new WorkerCtor(options.workerUrl ?? RUNTIME_URLS.WORKER_URL, {
        type: WORKER_CONTRACT.MODULE_TYPE,
      });
    } catch (error) {
      status.state = WORKER_STATUS.ERROR;
      status.error = errorMessage(error);
      notifyWorkerStatus(status, options, null);
      return null;
    }

    const installedWorker = worker;
    if (typeof worker.addEventListener === "function") {
      worker.addEventListener(
        WORKER_CONTRACT.EVENT_MESSAGE,
        handleWorkerMessage,
      );
      worker.addEventListener(WORKER_CONTRACT.EVENT_ERROR, (event) =>
        handleWorkerError(event, installedWorker),
      );
      worker.addEventListener(WORKER_CONTRACT.EVENT_MESSAGE_ERROR, (event) =>
        handleWorkerError(event, installedWorker),
      );
    } else {
      worker.onmessage = handleWorkerMessage;
      worker.onerror = (event) => handleWorkerError(event, installedWorker);
    }

    return worker;
  }

  return {
    start(data = {}) {
      if (status.state === WORKER_STATUS.RUNNING) {
        cancelActiveWorker();
      }

      const activeWorker = ensureWorker();
      if (activeWorker === null) {
        return false;
      }

      const ingestId = nextIngestId;
      nextIngestId += 1;
      activeIngestId = ingestId;
      status.state = WORKER_STATUS.RUNNING;
      status.error = null;
      status.coveredRange = null;
      status.ingest = { ...data, ingestId };
      status.progress = null;
      status.result = null;
      notifyWorkerStatus(status, options, null);
      activeWorker.postMessage({
        ...data,
        ingestId,
        type: INGEST_WORKER_MESSAGE.START,
      });
      return true;
    },
    status() {
      return cloneWorkerStatus(status);
    },
    indexReader,
    fail(error) {
      status.error = errorMessage(error);
      status.state = WORKER_STATUS.ERROR;
      notifyWorkerStatus(status, options, null);
    },
    terminate() {
      cancelActiveWorker();
      activeIngestId = null;
      status.state = WORKER_STATUS.TERMINATED;
      notifyWorkerStatus(status, options, null);
    },
    get worker() {
      return worker;
    },
  };
}

function supportsJSPI() {
  return typeof WebAssembly.Suspending === "function";
}

function showError(message) {
  const canvas = document.getElementById("tracy");
  const error = document.createElement("div");

  error.setAttribute("role", "alert");
  error.style.position = "fixed";
  error.style.inset = "0";
  error.style.display = "grid";
  error.style.placeItems = "center";
  error.style.padding = "2rem";
  error.style.color = APP_SHELL_COLORS.ERROR_TEXT;
  error.style.font = "1rem/1.4 system-ui, sans-serif";
  error.style.textAlign = "center";
  error.style.background = APP_SHELL_COLORS.APP_SHELL_BACKGROUND;
  error.textContent = message;

  if (canvas !== null) {
    canvas.hidden = true;
  }

  document.body.appendChild(error);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function readHostString(memory, ptr, len) {
  return new TextDecoder().decode(new Uint8Array(memory.buffer, ptr, len));
}

function sourceNameForId(memory, host, sourceId, options) {
  const nameLen = host[HOST_IMPORT_NAME.OPFS_SOURCE_NAME_LEN]?.(sourceId);

  if (!Number.isInteger(nameLen) || nameLen <= 0) {
    throw new Error(
      `${RUNTIME_ERRORS.OPFS_SOURCE_DID_NOT_REPORT_VALID_NAME_PREFIX}` +
        `${sourceId}${RUNTIME_ERRORS.OPFS_SOURCE_DID_NOT_REPORT_VALID_NAME_SUFFIX}`,
    );
  }

  const namePtr = options.ingestNamePtr ?? DEFAULT_INGEST_NAME_PTR;
  const maxNameBytes = options.ingestNameMaxBytes ?? DEFAULT_INGEST_NAME_MAX_BYTES;

  if (nameLen > maxNameBytes) {
    throw new Error(
      `${RUNTIME_ERRORS.OPFS_SOURCE_NAME_TOO_LONG_PREFIX}${nameLen}` +
        RUNTIME_ERRORS.OPFS_SOURCE_NAME_TOO_LONG_SUFFIX,
    );
  }

  const written = host[HOST_IMPORT_NAME.OPFS_SOURCE_NAME]?.(
    sourceId,
    namePtr,
    nameLen,
  );
  if (written !== nameLen) {
    throw new Error(
      `${RUNTIME_ERRORS.OPFS_SOURCE_DID_NOT_REPORT_VALID_NAME_PREFIX}` +
        `${sourceId}${RUNTIME_ERRORS.OPFS_SOURCE_NAME_READ_FAILED_SUFFIX}`,
    );
  }

  return readHostString(memory, namePtr, nameLen);
}

function indexNameForSource(sourceName) {
  const leaf = sourceName
    .split(FILE_SELECTION.PATH_SEPARATOR)
    .filter((part) => part.length > 0)
    .at(-1);
  const safeLeaf = (leaf ?? FILE_SELECTION.DEFAULT_TRACE_NAME).replace(
    new RegExp(FILE_SELECTION.UNSAFE_LEAF_PATTERN, "g"),
    FILE_SELECTION.UNSAFE_LEAF_REPLACEMENT,
  );

  return (
    `${FILE_SELECTION.INDEX_PREFIX}${safeLeaf}` +
    FILE_SELECTION.INDEX_SUFFIX
  );
}

function sourceNameForSelectedFile(selection) {
  const rawName =
    typeof selection?.file?.name === "string" && selection.file.name.length > 0
      ? selection.file.name
      : FILE_SELECTION.DEFAULT_TRACE_NAME;

  return `${FILE_SELECTION.SOURCE_PREFIX}${rawName}`;
}

async function startIngestForSelectedFile(selection, context) {
  const fileHandle = selection?.handle ?? selection?.fileHandle;

  if (!Number.isInteger(fileHandle) || fileHandle < 0) {
    return false;
  }

  if (
    selection?.file !== null &&
    typeof selection?.file === "object" &&
    typeof selection.file.size === "number"
  ) {
    const sourceName = sourceNameForSelectedFile(selection);

    return context.ingestWorker.start({
      indexName: indexNameForSource(sourceName),
      sourceFile: selection.file,
      sourceFileHandle: fileHandle,
      sourceName,
      sourceSize: selection.file.size,
    });
  }

  const sourceId = await context.host[HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE](
    fileHandle,
  );
  const sourceName = sourceNameForId(
    context.memory,
    context.host,
    sourceId,
    context.options,
  );
  const sourceSize =
    typeof selection.file?.size === "number" ? selection.file.size : undefined;

  return context.ingestWorker.start({
    indexName: indexNameForSource(sourceName),
    sourceName,
    sourceSize,
  });
}

function installFileSelectionIngest(memory, host, ingestWorker, options) {
  if (
    options.ingestFromFileSelection === false ||
    typeof host.setFileSelectedCallback !== "function" ||
    typeof host[HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE] !== "function"
  ) {
    return;
  }

  host.setFileSelectedCallback((selection) => {
    startIngestForSelectedFile(selection, {
      host,
      ingestWorker,
      memory,
      options,
    }).catch((error) => ingestWorker.fail?.(error));
  });
}

function shouldLoadProgressiveTraceRenderer(ingestWorker) {
  const workerStatus = ingestWorker?.status?.();
  const reader = ingestWorker?.indexReader;
  const readerStatus = reader?.status?.();
  const readerCoveredRange =
    readerStatus?.state === READER_STATUS.READY &&
      typeof reader?.coveredRange === "function"
      ? reader.coveredRange()
      : null;

  return (
    readerStatus?.state === READER_STATUS.READY &&
    (
      workerStatus?.coveredRange?.valid === true ||
      readerCoveredRange?.valid === true
    )
  );
}

async function loadApp(memory, host, options = {}) {
  markPerformance(PERFORMANCE_MARKS.coreStart, options);

  if (!supportsJSPI()) {
    showError(
      RUNTIME_ERRORS.JSPI_UNAVAILABLE,
    );
    return;
  }

  const imports = { env: { memory }, host };
  let progressiveTraceRenderer =
    options.progressiveTraceRenderer === false
      ? null
      : (options.progressiveTraceRenderer ?? null);
  let progressiveTraceRendererModule = null;
  let progressiveTraceRendererPromise = null;
  let progressiveTraceRendererCreatePromise = null;
  let firstFrameResolve = null;
  let firstFrameSeen = false;
  const firstFramePromise = new Promise((resolve) => {
    firstFrameResolve = resolve;
  });
  requestAnimationFrame(() => {
    firstFrameSeen = true;
    firstFrameResolve();
  });

  function loadProgressiveTraceRendererModule() {
    if (options.progressiveTraceRenderer === false) {
      return Promise.resolve(null);
    }
    if (progressiveTraceRendererModule !== null) {
      return Promise.resolve(progressiveTraceRendererModule);
    }
    if (progressiveTraceRendererPromise !== null) {
      return progressiveTraceRendererPromise;
    }

    progressiveTraceRendererPromise = (
      options.importProgressiveTraceRenderer?.() ??
      preloadDefaultProgressiveTraceRendererModule()
    ).then((module) => {
      progressiveTraceRendererModule = module;
      return module;
    });

    return progressiveTraceRendererPromise;
  }

  async function defaultInstantiateMainWasm(id, thread, baseImports, {
    baseUrl = RUNTIME_MODULES.DEFAULT_BASE_URL,
    compile = defaultCompileWasm,
    instantiate = defaultInstantiateWasm,
  } = {}) {
    const { instantiateWasmModuleForThread } = await import("./wasm-modules.mjs");

    return instantiateWasmModuleForThread(id, thread, baseImports, {
      baseUrl,
      compile,
      instantiate,
    });
  }

  const instantiate =
    options.instantiateWasmModuleForThread ?? defaultInstantiateMainWasm;
  markPerformance(PERFORMANCE_MARKS.wasmInstantiateStart, options);
  const { exports } = await instantiate(
    RUNTIME_MODULES.APP,
    MAIN_THREAD,
    imports,
    {
      baseUrl: options.baseUrl ?? RUNTIME_MODULES.DEFAULT_BASE_URL,
      compile: options.compile,
      instantiate: options.instantiate,
    },
  );
  markPerformance(PERFORMANCE_MARKS.wasmInstantiateEnd, options);
  measurePerformance(
    PERFORMANCE_MEASURES.wasmInstantiate,
    PERFORMANCE_MARKS.wasmInstantiateStart,
    PERFORMANCE_MARKS.wasmInstantiateEnd,
    options,
  );
  const { tracy_main, tracy_tick } = exports;

  markPerformance(PERFORMANCE_MARKS.tracyMainStart, options);
  tracy_main();
  markPerformance(PERFORMANCE_MARKS.tracyMainEnd, options);
  measurePerformance(
    PERFORMANCE_MEASURES.tracyMain,
    PERFORMANCE_MARKS.tracyMainStart,
    PERFORMANCE_MARKS.tracyMainEnd,
    options,
  );
  markPerformance(PERFORMANCE_MARKS.coreReady, options);

  const deferredRendererReadyPromise =
    progressiveTraceRenderer === null
      ? loadProgressiveTraceRendererModule()
      : Promise.resolve(null);

  Promise.all([firstFramePromise, deferredRendererReadyPromise]).then(() => {
    markPerformance(PERFORMANCE_MARKS.appReady, options);
    globalThis.dispatchEvent?.(new Event(PERFORMANCE_MARKS.appReady));
    measurePerformance(
      PERFORMANCE_MEASURES.appLoad,
      PERFORMANCE_MARKS.bootstrapStart,
      PERFORMANCE_MARKS.appReady,
      options,
    );
  }).catch(reportAppLoadError);

  const loop = (ts) => {
    tracy_tick(ts);
    if (!firstFrameSeen) {
      firstFrameSeen = true;
      firstFrameResolve();
    }
    if (progressiveTraceRenderer !== null) {
      progressiveTraceRenderer.draw?.(ts);
    } else if (
      options.progressiveTraceRenderer !== false &&
      progressiveTraceRendererCreatePromise === null &&
      shouldLoadProgressiveTraceRenderer(options.ingestWorker)
    ) {
      progressiveTraceRendererCreatePromise = loadProgressiveTraceRendererModule().then((module) => {
        progressiveTraceRenderer = module.createProgressiveTraceRenderer(
          memory,
          options.ingestWorker,
          {
            ...options.progressiveTraceRendererOptions,
            document: options.document,
          },
        );
        return progressiveTraceRenderer;
      }).catch((error) => {
        options.ingestWorker?.fail?.(error);
        reportAppLoadError(error);
      });
    }
    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);

  if (options.ingest !== undefined) {
    options.ingestWorker?.start(
      options.ingest === true ? {} : options.ingest,
    );
  }
}

export function runApp(memory, host, options = {}) {
  const indexReader =
    options.indexReader === false
      ? null
      : options.indexReader ??
        createMainThreadIndexReaderController(memory, host, {
          ...options.indexReaderOptions,
          baseUrl: options.baseUrl,
          compile: options.compile,
          instantiate: options.instantiate,
          instantiateWasmModuleForThread: options.instantiateWasmModuleForThread,
        });
  const ingestWorker =
    options.ingestWorker ??
    createIngestWorkerController({
      ...(options.worker ?? {}),
      indexReader,
    });

  installFileSelectionIngest(memory, host, ingestWorker, options);

  loadApp(memory, host, { ...options, ingestWorker }).catch((error) => {
    reportAppLoadError(error);
  });

  return ingestWorker;
}
