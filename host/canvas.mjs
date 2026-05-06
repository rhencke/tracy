export const HOST_SCRATCH_BASE = 0x00000000;
export const HOST_CANVAS_SIZE_OFFSET = HOST_SCRATCH_BASE + 0x0000;
export const HOST_CANVAS_RESIZE_SEQ_OFFSET = HOST_SCRATCH_BASE + 0x0008;

export function makeCanvasHost(canvas, memoryView) {
  const context = canvas.getContext("2d", { alpha: false });
  let resizeObserver = null;
  let resizeListenerInstalled = false;

  function canvasSize() {
    const scale = window.devicePixelRatio || 1;

    return {
      scale,
      width: Math.max(1, Math.floor(canvas.clientWidth * scale)),
      height: Math.max(1, Math.floor(canvas.clientHeight * scale)),
    };
  }

  function writeCanvasSize(width, height) {
    const scratch = memoryView.view();
    const seq = scratch.getUint32(HOST_CANVAS_RESIZE_SEQ_OFFSET, true);

    scratch.setUint32(HOST_CANVAS_SIZE_OFFSET, width, true);
    scratch.setUint32(HOST_CANVAS_SIZE_OFFSET + 4, height, true);
    scratch.setUint32(HOST_CANVAS_RESIZE_SEQ_OFFSET, seq + 1, true);
  }

  function resize() {
    const { scale, width, height } = canvasSize();

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.fillStyle = "#fbf8f4";
    context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    writeCanvasSize(width, height);
  }

  function canvasGetSize() {
    const { width, height } = canvasSize();

    return (BigInt(height) << 32n) | BigInt(width);
  }

  function canvasListenResize() {
    if (resizeListenerInstalled) {
      resize();
      return;
    }

    resizeListenerInstalled = true;

    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
    } else {
      window.addEventListener("resize", resize);
    }

    window.addEventListener("orientationchange", resize);
    resize();
  }

  resize();

  return {
    canvas_get_size: canvasGetSize,
    canvas_listen_resize: canvasListenResize,
  };
}
