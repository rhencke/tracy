import { makeMainThreadHost } from "./host/shim.mjs";
import { runApp } from "./host/runtime.mjs";

globalThis.performance?.mark?.("tracy.bootstrap.start");

if ("serviceWorker" in (globalThis.navigator ?? {})) {
  globalThis.addEventListener?.("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}

const memory = new WebAssembly.Memory({
  initial: 256,
  maximum: 32768,
  shared: false,
});

runApp(memory, makeMainThreadHost(memory));
