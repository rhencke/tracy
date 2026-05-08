import { APP_SHELL_COLORS, BOOTSTRAP_TIMING, BOOTSTRAP_WASM_MEMORY, PERFORMANCE_MARKS, RUNTIME_URLS } from "./host/startup-spec.mjs";

globalThis.performance?.mark?.(PERFORMANCE_MARKS.bootstrapStart);

const wasmModulesPromise = import("./host/wasm-modules.mjs");
const progressiveTraceRendererModulePromise = import(
  `./host/${RUNTIME_URLS.PROGRESSIVE_TRACE_RENDERER_URL.replace(/^\.\//, "")}`,
);
progressiveTraceRendererModulePromise.catch(() => {});
const importProgressiveTraceRenderer = () =>
  progressiveTraceRendererModulePromise;
const instantiateWasmModuleForThread = async (...args) =>
  (await wasmModulesPromise).instantiateWasmModuleForThread(...args);

const canvas = globalThis.document?.getElementById?.("tracy");
const context = canvas?.getContext?.("2d");
if (context !== undefined) {
  context.fillStyle = APP_SHELL_COLORS.APP_SHELL_BACKGROUND;
  context.fillRect(0, 0, canvas.width, canvas.height);
}

if ("serviceWorker" in (globalThis.navigator ?? {})) {
  const registerServiceWorker = () =>
    navigator.serviceWorker.register(RUNTIME_URLS.SERVICE_WORKER_URL).catch(() => {});
  const registerAfterReady = () => {
    if (performance.getEntriesByName(PERFORMANCE_MARKS.appReady).length > 0) {
      setTimeout(registerServiceWorker, BOOTSTRAP_TIMING.SERVICE_WORKER_READY_DELAY_MS);
    } else {
      setTimeout(registerAfterReady, BOOTSTRAP_TIMING.SERVICE_WORKER_READY_POLL_MS);
    }
  };

  globalThis.addEventListener?.("load", registerAfterReady);
}

const [{ makeMainThreadHost }, { runApp }] = await Promise.all([import("./host/shim.mjs"), import("./host/runtime.mjs")]);

const memory = new WebAssembly.Memory({
  initial: BOOTSTRAP_WASM_MEMORY.BOOTSTRAP_MEMORY_INITIAL_PAGES,
  maximum: BOOTSTRAP_WASM_MEMORY.BOOTSTRAP_MEMORY_MAXIMUM_PAGES, shared: false,
});

runApp(memory, makeMainThreadHost(memory), { importProgressiveTraceRenderer, instantiateWasmModuleForThread });
