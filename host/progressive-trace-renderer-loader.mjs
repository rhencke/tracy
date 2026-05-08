let progressiveTraceRendererModulePromise = null;

function loadProgressiveTraceRendererImplementation(options) {
  if (progressiveTraceRendererModulePromise === null) {
    progressiveTraceRendererModulePromise =
      options.importProgressiveTraceRendererImplementation?.() ??
      import("./progressive-trace-renderer.mjs");
  }

  return progressiveTraceRendererModulePromise;
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

  return {
    draw(ts) {
      return renderer?.draw?.(ts);
    },
    panByPixels(...args) {
      return renderer?.panByPixels?.(...args);
    },
    status() {
      return renderer?.status?.() ?? {
        error,
        loading: error === null,
      };
    },
    zoomAtPixel(...args) {
      return renderer?.zoomAtPixel?.(...args);
    },
  };
}
