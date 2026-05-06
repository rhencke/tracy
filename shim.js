export const HOST_SCRATCH_BASE = 0x00000000;
export const HOST_CANVAS_SIZE_OFFSET = HOST_SCRATCH_BASE + 0x0000;
export const HOST_CANVAS_RESIZE_SEQ_OFFSET = HOST_SCRATCH_BASE + 0x0008;

export const HOST_POINTER_RING_OFFSET = HOST_SCRATCH_BASE + 0x0040;
export const HOST_POINTER_RING_HEADER_BYTES = 32;
export const HOST_POINTER_RECORD_SIZE = 32;
export const HOST_POINTER_RECORD_CAPACITY = 256;
export const HOST_POINTER_RECORDS_OFFSET =
  HOST_POINTER_RING_OFFSET + HOST_POINTER_RING_HEADER_BYTES;

export const HOST_POINTER_KIND_DOWN = 1;
export const HOST_POINTER_KIND_MOVE = 2;
export const HOST_POINTER_KIND_UP = 3;
export const HOST_POINTER_KIND_CANCEL = 4;

export const HOST_POINTER_MOD_SHIFT = 0x00000001;
export const HOST_POINTER_MOD_CTRL = 0x00000002;
export const HOST_POINTER_MOD_ALT = 0x00000004;
export const HOST_POINTER_MOD_META = 0x00000008;
export const HOST_POINTER_MOD_PRIMARY = 0x00000010;
export const HOST_POINTER_MOD_BUTTON_PRIMARY = 0x00000020;
export const HOST_POINTER_MOD_BUTTON_SECONDARY = 0x00000040;
export const HOST_POINTER_MOD_BUTTON_AUXILIARY = 0x00000080;

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
