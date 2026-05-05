import { makeShim } from "./shim.js";

const memory = new WebAssembly.Memory({
  initial: 256,
  maximum: 32768,
  shared: false,
});

async function loadApp() {
  const imports = { env: { memory }, host: makeShim(memory) };
  const { instance } = await WebAssembly.instantiateStreaming(
    fetch("wasm/app.wasm"),
    imports,
  );
  const { tracy_main, tracy_tick } = instance.exports;

  tracy_main();

  const loop = (ts) => {
    tracy_tick(ts);
    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);
}

loadApp();
