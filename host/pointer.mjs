export const HOST_POINTER_RING_OFFSET = 0x00000040;
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

const POINTER_RING_READ_INDEX_OFFSET = HOST_POINTER_RING_OFFSET;
const POINTER_RING_WRITE_INDEX_OFFSET = HOST_POINTER_RING_OFFSET + 4;
const POINTER_RING_COUNT_OFFSET = HOST_POINTER_RING_OFFSET + 8;
const POINTER_RING_DROPPED_OFFSET = HOST_POINTER_RING_OFFSET + 12;
const POINTER_RING_CAPACITY_OFFSET = HOST_POINTER_RING_OFFSET + 16;
const POINTER_RING_RECORD_SIZE_OFFSET = HOST_POINTER_RING_OFFSET + 20;

export function makePointerHost(canvas, memoryView) {
  let pointerListenerInstalled = false;

  function resetPointerRing() {
    const scratch = memoryView.view();

    scratch.setUint32(POINTER_RING_READ_INDEX_OFFSET, 0, true);
    scratch.setUint32(POINTER_RING_WRITE_INDEX_OFFSET, 0, true);
    scratch.setUint32(POINTER_RING_COUNT_OFFSET, 0, true);
    scratch.setUint32(POINTER_RING_DROPPED_OFFSET, 0, true);
    scratch.setUint32(POINTER_RING_CAPACITY_OFFSET, HOST_POINTER_RECORD_CAPACITY, true);
    scratch.setUint32(POINTER_RING_RECORD_SIZE_OFFSET, HOST_POINTER_RECORD_SIZE, true);
    scratch.setUint32(HOST_POINTER_RING_OFFSET + 24, 0, true);
    scratch.setUint32(HOST_POINTER_RING_OFFSET + 28, 0, true);
  }

  function pointerKind(type) {
    switch (type) {
      case "pointerdown":
        return HOST_POINTER_KIND_DOWN;
      case "pointermove":
        return HOST_POINTER_KIND_MOVE;
      case "pointerup":
        return HOST_POINTER_KIND_UP;
      case "pointercancel":
        return HOST_POINTER_KIND_CANCEL;
      default:
        return 0;
    }
  }

  function pointerModifiers(event) {
    let modifiers = 0;

    if (event.shiftKey) {
      modifiers |= HOST_POINTER_MOD_SHIFT;
    }
    if (event.ctrlKey) {
      modifiers |= HOST_POINTER_MOD_CTRL;
    }
    if (event.altKey) {
      modifiers |= HOST_POINTER_MOD_ALT;
    }
    if (event.metaKey) {
      modifiers |= HOST_POINTER_MOD_META;
    }
    if (event.isPrimary) {
      modifiers |= HOST_POINTER_MOD_PRIMARY;
    }
    if ((event.buttons & 1) !== 0) {
      modifiers |= HOST_POINTER_MOD_BUTTON_PRIMARY;
    }
    if ((event.buttons & 2) !== 0) {
      modifiers |= HOST_POINTER_MOD_BUTTON_SECONDARY;
    }
    if ((event.buttons & 4) !== 0) {
      modifiers |= HOST_POINTER_MOD_BUTTON_AUXILIARY;
    }

    return modifiers;
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function appendPointerEvent(event) {
    const kind = pointerKind(event.type);

    if (kind === 0) {
      return;
    }

    const scratch = memoryView.view();
    const count = scratch.getUint32(POINTER_RING_COUNT_OFFSET, true);

    if (count >= HOST_POINTER_RECORD_CAPACITY) {
      const dropped = scratch.getUint32(POINTER_RING_DROPPED_OFFSET, true);
      scratch.setUint32(POINTER_RING_DROPPED_OFFSET, dropped + 1, true);
      return;
    }

    const writeIndex = scratch.getUint32(POINTER_RING_WRITE_INDEX_OFFSET, true);
    const recordOffset =
      HOST_POINTER_RECORDS_OFFSET + writeIndex * HOST_POINTER_RECORD_SIZE;
    const { x, y } = pointerPosition(event);

    scratch.setUint8(recordOffset, kind);
    scratch.setUint8(recordOffset + 1, 0);
    scratch.setUint8(recordOffset + 2, 0);
    scratch.setUint8(recordOffset + 3, 0);
    scratch.setUint32(recordOffset + 4, event.pointerId >>> 0, true);
    scratch.setFloat32(recordOffset + 8, x, true);
    scratch.setFloat32(recordOffset + 12, y, true);
    scratch.setFloat64(recordOffset + 16, event.timeStamp, true);
    scratch.setFloat32(recordOffset + 24, event.pressure || 0, true);
    scratch.setUint32(recordOffset + 28, pointerModifiers(event), true);

    scratch.setUint32(
      POINTER_RING_WRITE_INDEX_OFFSET,
      (writeIndex + 1) % HOST_POINTER_RECORD_CAPACITY,
      true,
    );
    scratch.setUint32(POINTER_RING_COUNT_OFFSET, count + 1, true);
  }

  function pointerListen() {
    if (pointerListenerInstalled) {
      return;
    }

    pointerListenerInstalled = true;
    resetPointerRing();

    for (const type of [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
    ]) {
      canvas.addEventListener(type, appendPointerEvent);
    }
  }

  return { pointer_listen: pointerListen };
}
