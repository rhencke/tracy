// Generated from abi/runtime.json by tools/generate-runtime-spec.js.
// Do not edit host/runtime-spec.mjs by hand.

export const RUNTIME_URLS = Object.freeze({
  WORKER_URL: "worker.js",
  SERVICE_WORKER_URL: "service-worker.js",
  PROGRESSIVE_TRACE_RENDERER_URL: "./progressive-trace-renderer.mjs",
});

export const BOOTSTRAP_WASM_MEMORY = Object.freeze({
  BOOTSTRAP_MEMORY_INITIAL_PAGES: 256,
  BOOTSTRAP_MEMORY_MAXIMUM_PAGES: 32768,
});

export const BOOTSTRAP_TIMING = Object.freeze({
  SERVICE_WORKER_READY_POLL_MS: 16,
  SERVICE_WORKER_READY_DELAY_MS: 250,
});

export const RUNTIME_DEFAULTS = Object.freeze({
  DEFAULT_INGEST_NAME_PTR: 4096,
  DEFAULT_INGEST_NAME_MAX_BYTES: 4096,
  DEFAULT_READER_NAME_PTR: 8192,
  DEFAULT_READER_CACHE_SLOTS: 4,
  DEFAULT_READER_QUERY_ROW_CAP: 1024,
});

export const PERFORMANCE_MARKS = Object.freeze({
  appReady: "tracy.app.ready",
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
