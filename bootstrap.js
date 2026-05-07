import { makeMainThreadHost } from "./host/shim.mjs";
import { runApp } from "./host/runtime.mjs";

const memory = new WebAssembly.Memory({
  initial: 256,
  maximum: 32768,
  shared: false,
});

runApp(memory, makeMainThreadHost(memory));
