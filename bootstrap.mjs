import { APP_SHELL_COLORS, BOOTSTRAP_WASM_MEMORY, PERFORMANCE_MARKS, RUNTIME_URLS } from "./host/startup-spec.mjs";
globalThis.performance?.mark?.(PERFORMANCE_MARKS.bootstrapStart);
const firstFramePromise = new Promise((resolve) => requestAnimationFrame(resolve));
const serviceWorkerController = globalThis.navigator?.serviceWorker?.controller ?? null;
const warmProgressiveTraceRendererPromise = serviceWorkerController === null ? null : import(`./host/${RUNTIME_URLS.PROGRESSIVE_TRACE_RENDERER_URL.replace(/^\.\//, "")}`);
const importProgressiveTraceRenderer = () => warmProgressiveTraceRendererPromise ?? import(`./host/${RUNTIME_URLS.PROGRESSIVE_TRACE_RENDERER_URL.replace(/^\.\//, "")}`);
const shimModulePromise = import("./host/shim.mjs"), runtimeModulePromise = import("./host/runtime.mjs");
const instantiateWasmModuleForThread = async (id, thread, imports, options = {}) => {
  if (id !== "app" || thread !== "main") {
    const { instantiateWasmModuleForThread: instantiateWasmGraph } = await import("./host/wasm-modules.mjs");
    return instantiateWasmGraph(id, thread, imports, options);
  }
  const url = `${(options.baseUrl ?? "wasm/").replace(/\/?$/, "/")}app.wasm`;
  const compile = options.compile ?? ((moduleUrl) => WebAssembly.compileStreaming(fetch(moduleUrl)));
  const instantiate = options.instantiate ?? (async (module, baseImports) => (await WebAssembly.instantiate(module, baseImports)).exports);
  const exports = options.compile === undefined && options.instantiate === undefined ? (await WebAssembly.instantiateStreaming(fetch(url), imports)).instance.exports : await instantiate(await compile(url, id), imports, id, url);
  return { exports, imports: { ...imports, app: exports } };
};
const canvas = globalThis.document?.getElementById?.("tracy");
const context = canvas?.getContext?.("2d");
if (context !== undefined) {
  context.fillStyle = APP_SHELL_COLORS.APP_SHELL_BACKGROUND;
  context.fillRect(0, 0, canvas.width, canvas.height);
} globalThis.performance?.mark?.(PERFORMANCE_MARKS.appShellPaint);
if ("serviceWorker" in (globalThis.navigator ?? {})) {
  const appReady = () => new Promise((resolve) => {
    if (performance.getEntriesByName(PERFORMANCE_MARKS.appReady).length > 0) resolve();
    else globalThis.addEventListener?.(PERFORMANCE_MARKS.appReady, resolve, { once: true });
  });
  const pageLoaded = () => new Promise((resolve) => {
    if (document.readyState === "complete") resolve();
    else globalThis.addEventListener?.("load", resolve, { once: true });
  });
  const registerServiceWorker = () => navigator.serviceWorker.register(RUNTIME_URLS.SERVICE_WORKER_URL).catch(() => {});
  Promise.all([appReady(), pageLoaded()]).then(registerServiceWorker);
}
const memory = new WebAssembly.Memory({ initial: BOOTSTRAP_WASM_MEMORY.BOOTSTRAP_MEMORY_INITIAL_PAGES, maximum: BOOTSTRAP_WASM_MEMORY.BOOTSTRAP_MEMORY_MAXIMUM_PAGES, shared: false });
const { makeMainThreadHost } = await shimModulePromise;
const host = makeMainThreadHost(memory);
const mainAppWasmPromise = instantiateWasmModuleForThread("app", "main", { env: { memory }, host });
mainAppWasmPromise.catch(() => {});
const instantiateWasmModuleWithPreloadedApp = (id, thread, imports, options) => id === "app" && thread === "main" ? mainAppWasmPromise : instantiateWasmModuleForThread(id, thread, imports, options);
const { runApp } = await runtimeModulePromise;
runApp(memory, host, { firstFramePromise, importProgressiveTraceRenderer, instantiateWasmModuleForThread: instantiateWasmModuleWithPreloadedApp });
