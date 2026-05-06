import {
  HOST_POINTER_KIND_CANCEL,
  HOST_POINTER_KIND_DOWN,
  HOST_POINTER_KIND_MOVE,
  HOST_POINTER_KIND_UP,
  HOST_POINTER_MOD_ALT,
  HOST_POINTER_MOD_BUTTON_AUXILIARY,
  HOST_POINTER_MOD_BUTTON_PRIMARY,
  HOST_POINTER_MOD_BUTTON_SECONDARY,
  HOST_POINTER_MOD_CTRL,
  HOST_POINTER_MOD_META,
  HOST_POINTER_MOD_PRIMARY,
  HOST_POINTER_MOD_SHIFT,
  HOST_POINTER_RECORD_CAPACITY,
  HOST_POINTER_RECORD_SIZE,
  HOST_POINTER_RECORDS_OFFSET,
  HOST_POINTER_RING_CAPACITY_OFFSET,
  HOST_POINTER_RING_COUNT_OFFSET,
  HOST_POINTER_RING_DROPPED_OFFSET,
  HOST_POINTER_RING_READ_INDEX_OFFSET,
  HOST_POINTER_RING_RECORD_SIZE_OFFSET,
  HOST_POINTER_RING_RESERVED_OFFSET,
  HOST_POINTER_RING_WRITE_INDEX_OFFSET,
  HOST_IMPORT_NAME,
} from "./abi.mjs";

export function makePointerHost(canvas, memoryView) {
  let pointerListenerInstalled = false;

  function resetPointerRing() {
    const scratch = memoryView.view();

    scratch.setUint32(HOST_POINTER_RING_READ_INDEX_OFFSET, 0, true);
    scratch.setUint32(HOST_POINTER_RING_WRITE_INDEX_OFFSET, 0, true);
    scratch.setUint32(HOST_POINTER_RING_COUNT_OFFSET, 0, true);
    scratch.setUint32(HOST_POINTER_RING_DROPPED_OFFSET, 0, true);
    scratch.setUint32(
      HOST_POINTER_RING_CAPACITY_OFFSET,
      HOST_POINTER_RECORD_CAPACITY,
      true,
    );
    scratch.setUint32(
      HOST_POINTER_RING_RECORD_SIZE_OFFSET,
      HOST_POINTER_RECORD_SIZE,
      true,
    );
    scratch.setUint32(HOST_POINTER_RING_RESERVED_OFFSET, 0, true);
    scratch.setUint32(HOST_POINTER_RING_RESERVED_OFFSET + 4, 0, true);
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
    const count = scratch.getUint32(HOST_POINTER_RING_COUNT_OFFSET, true);

    if (count >= HOST_POINTER_RECORD_CAPACITY) {
      const dropped = scratch.getUint32(HOST_POINTER_RING_DROPPED_OFFSET, true);
      scratch.setUint32(HOST_POINTER_RING_DROPPED_OFFSET, dropped + 1, true);
      return;
    }

    const writeIndex = scratch.getUint32(HOST_POINTER_RING_WRITE_INDEX_OFFSET, true);
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
      HOST_POINTER_RING_WRITE_INDEX_OFFSET,
      (writeIndex + 1) % HOST_POINTER_RECORD_CAPACITY,
      true,
    );
    scratch.setUint32(HOST_POINTER_RING_COUNT_OFFSET, count + 1, true);
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

  return { [HOST_IMPORT_NAME.POINTER_LISTEN]: pointerListen };
}
