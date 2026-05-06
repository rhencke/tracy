import { HOST_ASYNC_IMPORTS } from "./abi.mjs";

const asyncHostImports = new Set(HOST_ASYNC_IMPORTS);

function supportsJSPI() {
  return typeof WebAssembly.Suspending === "function";
}

function showError(message) {
  const canvas = document.getElementById("tracy");
  const error = document.createElement("div");

  error.setAttribute("role", "alert");
  error.style.position = "fixed";
  error.style.inset = "0";
  error.style.display = "grid";
  error.style.placeItems = "center";
  error.style.padding = "2rem";
  error.style.color = "#1f1b16";
  error.style.font = "1rem/1.4 system-ui, sans-serif";
  error.style.textAlign = "center";
  error.style.background = "#fbf8f4";
  error.textContent = message;

  if (canvas !== null) {
    canvas.hidden = true;
  }

  document.body.appendChild(error);
}

function wrapAsyncHostImports(host) {
  return Object.fromEntries(
    Object.entries(host).map(([name, value]) => [
      name,
      asyncHostImports.has(name) ? new WebAssembly.Suspending(value) : value,
    ]),
  );
}

async function loadApp(memory, host) {
  if (!supportsJSPI()) {
    showError(
      "tracy needs a browser with WebAssembly JavaScript Promise Integration (JSPI) enabled.",
    );
    return;
  }

  const imports = { env: { memory }, host: wrapAsyncHostImports(host) };
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

export function runApp(memory, host) {
  loadApp(memory, host).catch((error) => {
    console.error(error);
    showError("tracy failed to load the WebAssembly viewer.");
  });
}
