import { APP_SHELL_COLORS, BOOTSTRAP_TIMING, BOOTSTRAP_WASM_MEMORY, PERFORMANCE_MARKS, RUNTIME_URLS } from "./host/startup-spec.mjs";
globalThis.performance?.mark?.(PERFORMANCE_MARKS.bootstrapStart);
const serviceWorkerController = globalThis.navigator?.serviceWorker?.controller ?? null;
const warmProgressiveTraceRendererPromise =
  serviceWorkerController === null
    ? null
    : import(`./host/${RUNTIME_URLS.PROGRESSIVE_TRACE_RENDERER_URL.replace(/^\.\//, "")}`);
const afterProtectedStartupBoundary = () => new Promise((resolve) => {
  const channel = new MessageChannel();
  channel.port1.onmessage = resolve;
  channel.port2.postMessage(undefined);
});
const importProgressiveTraceRenderer = () =>
  warmProgressiveTraceRendererPromise ??
  afterProtectedStartupBoundary().then(() =>
    import(`./host/${RUNTIME_URLS.PROGRESSIVE_TRACE_RENDERER_URL.replace(/^\.\//, "")}`),
  );
const instantiateWasmModuleForThread = async (id, thread, imports, options = {}) => {
  if (id !== "app" || thread !== "main") {
    const { instantiateWasmModuleForThread: instantiateWasmGraph } = await import("./host/wasm-modules.mjs");
    return instantiateWasmGraph(id, thread, imports, options);
  }
  const url = `${(options.baseUrl ?? "wasm/").replace(/\/?$/, "/")}app.wasm`;
  const compile = options.compile ?? ((moduleUrl) => WebAssembly.compileStreaming(fetch(moduleUrl)));
  const instantiate = options.instantiate ?? (async (module, baseImports) => (await WebAssembly.instantiate(module, baseImports)).exports);
  const exports = await instantiate(await compile(url, id), imports, id, url);
  return { exports, imports: { ...imports, app: exports } };
};
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
const memory = new WebAssembly.Memory({ initial: BOOTSTRAP_WASM_MEMORY.BOOTSTRAP_MEMORY_INITIAL_PAGES, maximum: BOOTSTRAP_WASM_MEMORY.BOOTSTRAP_MEMORY_MAXIMUM_PAGES, shared: false });
runApp(memory, makeMainThreadHost(memory), { importProgressiveTraceRenderer, instantiateWasmModuleForThread });
