import { HOST_IMPORT_NAME } from "./abi.mjs";

const MAIN_THREAD = "main";
const WORKER_URL = "worker.js";
const INGEST_WORKER_MESSAGE = Object.freeze({
  COMPLETE: "complete",
  COVERED_RANGE: "covered_range",
  ERROR: "error",
  PROGRESS: "progress",
  START: "start",
});
const DEFAULT_INGEST_NAME_PTR = 4096;
const DEFAULT_INGEST_NAME_MAX_BYTES = 4096;
const DEFAULT_READER_NAME_PTR = 8192;
const DEFAULT_READER_CACHE_SLOTS = 4;
const PROGRESSIVE_TRACE_RENDERER_URL = "./progressive-trace-renderer.mjs";
const PERFORMANCE_MARKS = Object.freeze({
  appReady: "tracy.app.ready",
  bootstrapStart: "tracy.bootstrap.start",
  coreReady: "tracy.core.ready",
  coreStart: "tracy.core.start",
  tracyMainEnd: "tracy.main.end",
  tracyMainStart: "tracy.main.start",
  wasmInstantiateEnd: "tracy.wasm.instantiate.end",
  wasmInstantiateStart: "tracy.wasm.instantiate.start",
});
const PERFORMANCE_MEASURES = Object.freeze({
  appLoad: "tracy.app.load",
  tracyMain: "tracy.main",
  wasmInstantiate: "tracy.wasm.instantiate",
});

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
    catalogPageCount: null,
    error: null,
    exports: null,
    indexId: null,
    indexName: null,
    openPromise: null,
    rebuildSliceCatalog: null,
    state: "idle",
  };

  function cloneReaderStatus() {
    return {
      error: readerState.error,
      indexId: readerState.indexId,
      indexName: readerState.indexName,
      state: readerState.state,
    };
  }

  async function loadIndexExports() {
    if (readerState.exports !== null) {
      return readerState.exports;
    }

    const loaded = await instantiate(
      "index",
      MAIN_THREAD,
      { env: { memory }, host },
      {
        baseUrl: options.baseUrl ?? "wasm/",
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
      if (probed.rebuilt) {
        index.index_reader_init(indexId);
      }
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
    if (rebuilt.rebuilt) {
      index.index_reader_init(indexId);
    }

    return rebuilt.rebuilt;
  }

  async function open(indexName) {
    if (typeof indexName !== "string" || indexName.length === 0) {
      return false;
    }
    if (readerState.state === "ready" && readerState.indexName === indexName) {
      return true;
    }
    if (
      readerState.state === "opening" &&
      readerState.indexName === indexName &&
      readerState.openPromise !== null
    ) {
      return readerState.openPromise;
    }

    readerState.error = null;
    readerState.indexName = indexName;
    readerState.state = "opening";
    readerState.openPromise = (async () => {
      try {
        const index = await loadIndexExports();
        const namePtr = options.readerNamePtr ?? DEFAULT_READER_NAME_PTR;
        const nameLen = writeHostString(
          memory,
          namePtr,
          indexName,
          "main-thread index name",
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
        readerState.state = "ready";
        return true;
      } catch (error) {
        readerState.error = errorMessage(error);
        readerState.state = "error";
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
    queryRange(trackId, tsMin, tsMax, outPtr) {
      if (readerState.state !== "ready" || readerState.exports === null) {
        throw new Error("main-thread index reader is not ready");
      }

      refreshSliceCatalog(readerState.exports, readerState.indexId);
      return readerState.exports.index_query_range(trackId, tsMin, tsMax, outPtr);
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
    state: "idle",
  };

  let worker = null;

  function handleWorkerMessage(event) {
    const message = event?.data ?? event;

    if (message?.type === INGEST_WORKER_MESSAGE.PROGRESS) {
      status.progress = message;
      status.state = "running";
    } else if (message?.type === INGEST_WORKER_MESSAGE.COVERED_RANGE) {
      status.coveredRange = message;
      status.state = "running";
      if (message.valid && typeof status.ingest?.indexName === "string") {
        indexReader?.open(status.ingest.indexName)?.catch((error) => {
          status.error = errorMessage(error);
          status.state = "error";
          notifyWorkerStatus(status, options, null);
        });
      }
    } else if (message?.type === INGEST_WORKER_MESSAGE.COMPLETE) {
      status.result = message;
      status.state = "complete";
    } else if (message?.type === INGEST_WORKER_MESSAGE.ERROR) {
      status.error = message.message ?? "worker ingest failed";
      status.state = "error";
    } else {
      return;
    }

    notifyWorkerStatus(status, options, message);
  }

  function handleWorkerError(event) {
    status.state = "error";
    status.error = event?.message ?? "ingest worker failed";
    notifyWorkerStatus(status, options, event);
  }

  function ensureWorker() {
    if (worker !== null) {
      return worker;
    }
    if (typeof WorkerCtor !== "function") {
      status.state = "unavailable";
      status.error = "module workers are unavailable";
      notifyWorkerStatus(status, options, null);
      return null;
    }

    try {
      worker = new WorkerCtor(options.workerUrl ?? WORKER_URL, { type: "module" });
    } catch (error) {
      status.state = "error";
      status.error = errorMessage(error);
      notifyWorkerStatus(status, options, null);
      return null;
    }

    if (typeof worker.addEventListener === "function") {
      worker.addEventListener("message", handleWorkerMessage);
      worker.addEventListener("error", handleWorkerError);
      worker.addEventListener("messageerror", handleWorkerError);
    } else {
      worker.onmessage = handleWorkerMessage;
      worker.onerror = handleWorkerError;
    }

    return worker;
  }

  return {
    start(data = {}) {
      const activeWorker = ensureWorker();
      if (activeWorker === null) {
        return false;
      }

      status.state = "running";
      status.error = null;
      status.ingest = data;
      status.result = null;
      notifyWorkerStatus(status, options, null);
      activeWorker.postMessage({
        ...data,
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
      status.state = "error";
      notifyWorkerStatus(status, options, null);
    },
    terminate() {
      worker?.terminate?.();
      status.state = "terminated";
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
  error.style.color = "#1f1b16";
  error.style.font = "1rem/1.4 system-ui, sans-serif";
  error.style.textAlign = "center";
  error.style.background = "#fbf8f4";
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
    throw new Error(`OPFS source ${sourceId} did not report a valid name`);
  }

  const namePtr = options.ingestNamePtr ?? DEFAULT_INGEST_NAME_PTR;
  const maxNameBytes = options.ingestNameMaxBytes ?? DEFAULT_INGEST_NAME_MAX_BYTES;

  if (nameLen > maxNameBytes) {
    throw new Error(`OPFS source name is too long: ${nameLen} bytes`);
  }

  const written = host[HOST_IMPORT_NAME.OPFS_SOURCE_NAME]?.(
    sourceId,
    namePtr,
    nameLen,
  );
  if (written !== nameLen) {
    throw new Error(`OPFS source ${sourceId} name read failed`);
  }

  return readHostString(memory, namePtr, nameLen);
}

function indexNameForSource(sourceName) {
  const leaf = sourceName
    .split("/")
    .filter((part) => part.length > 0)
    .at(-1);
  const safeLeaf = (leaf ?? "trace").replace(/[^A-Za-z0-9._-]/g, "_");

  return `indexes/${safeLeaf}.idx`;
}

function sourceNameForSelectedFile(selection) {
  const rawName =
    typeof selection?.file?.name === "string" && selection.file.name.length > 0
      ? selection.file.name
      : "trace";

  return `sources/${rawName}`;
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
  const readerStatus = ingestWorker?.indexReader?.status?.();

  return (
    workerStatus?.coveredRange?.valid === true &&
    readerStatus?.state === "ready"
  );
}

async function loadApp(memory, host, options = {}) {
  markPerformance(PERFORMANCE_MARKS.coreStart, options);

  if (!supportsJSPI()) {
    showError(
      "tracy needs a browser with WebAssembly JavaScript Promise Integration (JSPI) enabled.",
    );
    return;
  }

  const imports = { env: { memory }, host };
  async function defaultInstantiateMainWasm(id, thread, baseImports, {
    baseUrl = "wasm/",
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
  const { exports } = await instantiate("app", MAIN_THREAD, imports, {
    baseUrl: options.baseUrl ?? "wasm/",
    compile: options.compile,
    instantiate: options.instantiate,
  });
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
  markPerformance(PERFORMANCE_MARKS.appReady, options);
  measurePerformance(
    PERFORMANCE_MEASURES.appLoad,
    PERFORMANCE_MARKS.bootstrapStart,
    PERFORMANCE_MARKS.appReady,
    options,
  );

  let progressiveTraceRenderer =
    options.progressiveTraceRenderer === false
      ? null
      : (options.progressiveTraceRenderer ?? null);
  let progressiveTraceRendererPromise = null;

  const loop = (ts) => {
    tracy_tick(ts);
    if (progressiveTraceRenderer !== null) {
      progressiveTraceRenderer.draw?.(ts);
    } else if (
      options.progressiveTraceRenderer !== false &&
      progressiveTraceRendererPromise === null &&
      shouldLoadProgressiveTraceRenderer(options.ingestWorker)
    ) {
      progressiveTraceRendererPromise = (
        options.importProgressiveTraceRenderer?.() ??
        import(PROGRESSIVE_TRACE_RENDERER_URL)
      ).then((module) => {
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
        progressiveTraceRendererPromise = null;
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
    console.error(error);
    globalThis.__TRACY_APP_LOAD_ERROR__ = errorMessage(error);
    showError("tracy failed to load the WebAssembly viewer.");
  });

  return ingestWorker;
}
