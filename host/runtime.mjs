import { INGEST_WORKER_MESSAGE } from "./ingest-worker-runtime.mjs";
import { HOST_IMPORT_NAME } from "./abi.mjs";
import { instantiateWasmModuleForThread } from "./wasm-modules.mjs";

const MAIN_THREAD = "main";
const WORKER_URL = "worker.js";
const DEFAULT_INGEST_NAME_PTR = 4096;
const DEFAULT_INGEST_NAME_MAX_BYTES = 4096;
const PERFORMANCE_MARKS = Object.freeze({
  appReady: "tracy.app.ready",
  bootstrapStart: "tracy.bootstrap.start",
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

export function createIngestWorkerController(options = {}) {
  const WorkerCtor = options.Worker ?? globalThis.Worker;
  const status = {
    coveredRange: null,
    error: null,
    progress: null,
    result: null,
    state: "idle",
  };

  if (typeof WorkerCtor !== "function") {
    status.state = "unavailable";
    status.error = "module workers are unavailable";
    notifyWorkerStatus(status, options, null);

    return {
      start() {
        notifyWorkerStatus(status, options, null);
        return false;
      },
      status() {
        return cloneWorkerStatus(status);
      },
      terminate() {},
      worker: null,
    };
  }

  let worker;
  try {
    worker = new WorkerCtor(options.workerUrl ?? WORKER_URL, { type: "module" });
  } catch (error) {
    status.state = "error";
    status.error = error instanceof Error ? error.message : String(error);
    notifyWorkerStatus(status, options, null);

    return {
      start() {
        notifyWorkerStatus(status, options, null);
        return false;
      },
      status() {
        return cloneWorkerStatus(status);
      },
      terminate() {},
      worker: null,
    };
  }

  function handleWorkerMessage(event) {
    const message = event?.data ?? event;

    if (message?.type === INGEST_WORKER_MESSAGE.PROGRESS) {
      status.progress = message;
      status.state = "running";
    } else if (message?.type === INGEST_WORKER_MESSAGE.COVERED_RANGE) {
      status.coveredRange = message;
      status.state = "running";
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

  if (typeof worker.addEventListener === "function") {
    worker.addEventListener("message", handleWorkerMessage);
    worker.addEventListener("error", handleWorkerError);
    worker.addEventListener("messageerror", handleWorkerError);
  } else {
    worker.onmessage = handleWorkerMessage;
    worker.onerror = handleWorkerError;
  }

  return {
    start(data = {}) {
      status.state = "running";
      status.error = null;
      status.result = null;
      notifyWorkerStatus(status, options, null);
      worker.postMessage({
        ...data,
        type: INGEST_WORKER_MESSAGE.START,
      });
      return true;
    },
    status() {
      return cloneWorkerStatus(status);
    },
    fail(error) {
      status.error = errorMessage(error);
      status.state = "error";
      notifyWorkerStatus(status, options, null);
    },
    terminate() {
      worker.terminate?.();
      status.state = "terminated";
      notifyWorkerStatus(status, options, null);
    },
    worker,
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

async function startIngestForSelectedFile(selection, context) {
  const fileHandle = selection?.handle ?? selection?.fileHandle;

  if (!Number.isInteger(fileHandle) || fileHandle < 0) {
    return false;
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

async function loadApp(memory, host, options = {}) {
  if (!supportsJSPI()) {
    showError(
      "tracy needs a browser with WebAssembly JavaScript Promise Integration (JSPI) enabled.",
    );
    return;
  }

  const imports = { env: { memory }, host };
  const instantiate = options.instantiateWasmModuleForThread ?? instantiateWasmModuleForThread;
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
  markPerformance(PERFORMANCE_MARKS.appReady, options);
  measurePerformance(
    PERFORMANCE_MEASURES.appLoad,
    PERFORMANCE_MARKS.bootstrapStart,
    PERFORMANCE_MARKS.appReady,
    options,
  );

  const loop = (ts) => {
    tracy_tick(ts);
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
  const ingestWorker =
    options.ingestWorker ?? createIngestWorkerController(options.worker ?? {});

  installFileSelectionIngest(memory, host, ingestWorker, options);

  loadApp(memory, host, { ...options, ingestWorker }).catch((error) => {
    console.error(error);
    globalThis.__TRACY_APP_LOAD_ERROR__ = errorMessage(error);
    showError("tracy failed to load the WebAssembly viewer.");
  });

  return ingestWorker;
}
