const canvas = document.getElementById("tracy-canvas");
const context = canvas.getContext("2d", { alpha: false });

function resizeCanvas() {
  const scale = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(canvas.clientWidth * scale));
  const height = Math.max(1, Math.floor(canvas.clientHeight * scale));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.fillStyle = "#fbf8f4";
  context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
}

async function loadApp() {
  resizeCanvas();
  const imports = { env: {} };
  const { instance } = await WebAssembly.instantiateStreaming(fetch("wasm/app.wasm"), imports);

  instance.exports.tracy_main?.();

  function tick() {
    resizeCanvas();
    instance.exports.tracy_tick?.();
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

window.addEventListener("resize", resizeCanvas);
loadApp();
