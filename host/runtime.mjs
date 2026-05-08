import { INGEST_WORKER_MESSAGE } from "./ingest-worker-runtime.mjs";
import {
  CORE_SHELL_MODULE_ID,
  CORE_SHELL_THREAD,
  instantiateWasmModuleForThread,
} from "./wasm-modules.mjs";

const WORKER_URL = "worker.js";
const PERFORMANCE_MARKS = Object.freeze({
  appReady: "tracy.app.ready",
  bootstrapStart: "tracy.bootstrap.start",
  coreReady: "tracy.core.ready",
  tracyMainEnd: "tracy.main.end",
  tracyMainStart: "tracy.main.start",
  wasmInstantiateEnd: "tracy.wasm.instantiate.end",
  wasmInstantiateStart: "tracy.wasm.instantiate.start",
});
const PERFORMANCE_MEASURES = Object.freeze({
  appLoad: "tracy.app.load",
  coreLoad: "tracy.core.load",
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

function requestInteractiveFrame(options) {
  const requestFrame = options.requestAnimationFrame ?? globalThis.requestAnimationFrame;

  return new Promise((resolve) => {
    requestFrame(resolve);
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
  const { exports } = await instantiate(CORE_SHELL_MODULE_ID, CORE_SHELL_THREAD, imports, {
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
  await requestInteractiveFrame(options);
  markPerformance(PERFORMANCE_MARKS.coreReady, options);
  measurePerformance(
    PERFORMANCE_MEASURES.coreLoad,
    PERFORMANCE_MARKS.bootstrapStart,
    PERFORMANCE_MARKS.coreReady,
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

  const requestFrame = options.requestAnimationFrame ?? globalThis.requestAnimationFrame;
  const loop = (ts) => {
    tracy_tick(ts);
    requestFrame(loop);
  };

  requestFrame(loop);

  if (options.ingest !== undefined) {
    options.ingestWorker?.start(
      options.ingest === true ? {} : options.ingest,
    );
  }
}

export function runApp(memory, host, options = {}) {
  const ingestWorker =
    options.ingestWorker ?? createIngestWorkerController(options.worker ?? {});

  loadApp(memory, host, { ...options, ingestWorker }).catch((error) => {
    console.error(error);
    globalThis.__TRACY_APP_LOAD_ERROR__ = errorMessage(error);
    showError("tracy failed to load the WebAssembly viewer.");
  });

  return ingestWorker;
}
