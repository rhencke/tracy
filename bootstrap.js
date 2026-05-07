const canvas = globalThis.document?.getElementById?.("tracy");
const context = canvas?.getContext?.("2d");
if (context !== undefined) {
  context.fillStyle = "#fbf8f4";
  context.fillRect(0, 0, canvas.width, canvas.height);
}

if ("serviceWorker" in (globalThis.navigator ?? {})) {
  const registerServiceWorker = () =>
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  const registerAfterReady = () => {
    if (performance.getEntriesByName("tracy.app.ready").length > 0) {
      setTimeout(registerServiceWorker, 250);
    } else {
      setTimeout(registerAfterReady, 16);
    }
  };

  globalThis.addEventListener?.("load", registerAfterReady);
}

globalThis.performance?.mark?.("tracy.core.ready");

const [{ makeMainThreadHost }, { runApp }] = await Promise.all([
  import("./host/shim.mjs"),
  import("./host/runtime.mjs"),
]);

globalThis.performance?.mark?.("tracy.bootstrap.start");

const memory = new WebAssembly.Memory({
  initial: 256,
  maximum: 32768,
  shared: false,
});

runApp(memory, makeMainThreadHost(memory));
