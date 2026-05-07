import { makeMainThreadHost } from "./host/shim.mjs";
import { runApp } from "./host/runtime.mjs";

globalThis.performance?.mark?.("tracy.bootstrap.start");

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

const memory = new WebAssembly.Memory({
  initial: 256,
  maximum: 32768,
  shared: false,
});

runApp(memory, makeMainThreadHost(memory));
