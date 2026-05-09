import { TRACE_RENDERER_LOADER_BRIDGE } from "./trace-renderer-spec.mjs";

const {
  API_METHODS,
  ERROR_STATUS_FIELD,
  LOADING_STATUS_FIELD,
  STATUS_METHOD,
} = TRACE_RENDERER_LOADER_BRIDGE;

let progressiveTraceRendererModulePromise = null;

function loadProgressiveTraceRendererImplementation(options) {
  if (progressiveTraceRendererModulePromise === null) {
    progressiveTraceRendererModulePromise =
      options.importProgressiveTraceRendererImplementation?.() ??
      import("./progressive-trace-renderer.mjs");
  }

  return progressiveTraceRendererModulePromise;
}

function pendingStatus(error) {
  return {
    [ERROR_STATUS_FIELD]: error,
    [LOADING_STATUS_FIELD]: error === null,
  };
}

function createRendererBridge(getRenderer, getError) {
  const bridge = {};

  for (const methodName of API_METHODS) {
    bridge[methodName] = (...args) => getRenderer()?.[methodName]?.(...args);
  }

  bridge[STATUS_METHOD] = () =>
    getRenderer()?.[STATUS_METHOD]?.() ?? pendingStatus(getError());

  return bridge;
}

export function createProgressiveTraceRenderer(memory, ingestWorker, options = {}) {
  let error = null;
  let renderer = null;

  loadProgressiveTraceRendererImplementation(options).then((module) => {
    renderer = module.createProgressiveTraceRenderer(memory, ingestWorker, options);
    return renderer;
  }).catch((loadError) => {
    error = loadError instanceof Error ? loadError.message : String(loadError);
    options.onError?.(loadError);
  });

  return createRendererBridge(
    () => renderer,
    () => error,
  );
}
