export function makeShim(memory) {
  const canvas = document.getElementById("tracy");
  const context = canvas.getContext("2d", { alpha: false });

  function resize() {
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

  resize();
  window.addEventListener("resize", resize);

  return {};
}
