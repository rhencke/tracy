// Generated from abi/runtime.json and abi/palette.json by tools/generate-runtime-spec.js.
// Do not edit host/startup-spec.mjs by hand.

export const RUNTIME_URLS = Object.freeze({
  WORKER_URL: "worker.js",
  SERVICE_WORKER_URL: "service-worker.js",
  PROGRESSIVE_TRACE_RENDERER_URL: "./progressive-trace-renderer.mjs",
  WASM_MODULES_URL: "./wasm-modules.mjs",
});

export const APP_SHELL_COLORS = Object.freeze({
  APP_SHELL_BACKGROUND: "#fbf8f4",
  ERROR_TEXT: "#1f1b16",
});

export const BOOTSTRAP_WASM_MEMORY = Object.freeze({
  BOOTSTRAP_MEMORY_INITIAL_PAGES: 256,
  BOOTSTRAP_MEMORY_MAXIMUM_PAGES: 32768,
});

export const RUNTIME_DEFAULTS = Object.freeze({
  DEFAULT_INGEST_NAME_PTR: 4096,
  DEFAULT_INGEST_NAME_MAX_BYTES: 4096,
  DEFAULT_READER_NAME_PTR: 8192,
  DEFAULT_READER_CACHE_SLOTS: 4,
  DEFAULT_READER_QUERY_ROW_CAP: 1024,
  DEFAULT_INGEST_PROGRESS_WINDOW_MS: 5000,
  DEFAULT_INGEST_ETA_STABLE_MS: 3000,
});

export const INTERACTIVE_INGEST_CHECK = Object.freeze({
  FIXTURE_SIZE_BYTES: 104857600,
  INGEST_WINDOW_BYTES: 10485760,
  FRAME_BUDGET_MS: 16.67,
  FILE_CHOOSER_TIMEOUT_MS: 1000,
  ASYNC_WAIT_TIMEOUT_MS: 2000,
  ASYNC_POLL_INTERVAL_MS: 1,
});

export const RUNTIME_BRIDGE = Object.freeze({
  "threads": {
    "MAIN": "main"
  },
  "modules": {
    "APP": "app",
    "INDEX": "index",
    "DEFAULT_BASE_URL": "wasm/"
  },
  "worker": {
    "MODULE_TYPE": "module",
    "EVENT_MESSAGE": "message",
    "EVENT_ERROR": "error",
    "EVENT_MESSAGE_ERROR": "messageerror"
  },
  "workerMessages": {
    "COMPLETE": "complete",
    "COVERED_RANGE": "covered_range",
    "ERROR": "error",
    "PRELOAD": "preload",
    "PRELOADED": "preloaded",
    "PROGRESS": "progress",
    "START": "start"
  },
  "workerStatus": {
    "COMPLETE": "complete",
    "ERROR": "error",
    "IDLE": "idle",
    "RUNNING": "running",
    "TERMINATED": "terminated",
    "UNAVAILABLE": "unavailable"
  },
  "readerStatus": {
    "ERROR": "error",
    "IDLE": "idle",
    "OPENING": "opening",
    "READY": "ready"
  },
  "fileSelection": {
    "DEFAULT_TRACE_NAME": "trace",
    "INDEX_PREFIX": "indexes/",
    "INDEX_SUFFIX": ".idx",
    "PATH_SEPARATOR": "/",
    "SOURCE_PREFIX": "sources/",
    "UNSAFE_LEAF_PATTERN": "[^A-Za-z0-9._-]",
    "UNSAFE_LEAF_REPLACEMENT": "_"
  },
  "errors": {
    "APP_LOAD_FAILED": "tracy failed to load the WebAssembly viewer.",
    "INGEST_WORKER_FAILED": "ingest worker failed",
    "JSPI_UNAVAILABLE": "tracy needs a browser with WebAssembly JavaScript Promise Integration (JSPI) enabled.",
    "MAIN_THREAD_INDEX_NAME_LABEL": "main-thread index name",
    "MAIN_THREAD_INDEX_READER_NOT_READY": "main-thread index reader is not ready",
    "MODULE_WORKERS_UNAVAILABLE": "module workers are unavailable",
    "OPFS_SOURCE_DID_NOT_REPORT_VALID_NAME_PREFIX": "OPFS source ",
    "OPFS_SOURCE_DID_NOT_REPORT_VALID_NAME_SUFFIX": " did not report a valid name",
    "OPFS_SOURCE_NAME_READ_FAILED_SUFFIX": " name read failed",
    "OPFS_SOURCE_NAME_TOO_LONG_PREFIX": "OPFS source name is too long: ",
    "OPFS_SOURCE_NAME_TOO_LONG_SUFFIX": " bytes",
    "SLICE_CATALOG_FULL_PREFIX": "main-thread slice catalog full while rebuilding index ",
    "SLICE_CATALOG_FULL_PAGE_SEPARATOR": " at page ",
    "WORKER_INGEST_FAILED": "worker ingest failed"
  }
});

export const PERFORMANCE_MARKS = Object.freeze({
  appReady: "tracy.app.ready",
  appShellPaint: "tracy.app.shell.paint",
  bootstrapStart: "tracy.bootstrap.start",
  coreReady: "tracy.core.ready",
  coreStart: "tracy.core.start",
  tracyMainEnd: "tracy.main.end",
  tracyMainStart: "tracy.main.start",
  wasmInstantiateEnd: "tracy.wasm.instantiate.end",
  wasmInstantiateStart: "tracy.wasm.instantiate.start",
});

export const PERFORMANCE_MEASURES = Object.freeze({
  appLoad: "tracy.app.load",
  tracyMain: "tracy.main",
  wasmInstantiate: "tracy.wasm.instantiate",
});
