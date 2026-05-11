export function globalValue(value) {
  return value instanceof WebAssembly.Global ? value.value : value;
}

export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function promisingWasmExport(fn, receiver = undefined) {
  return typeof WebAssembly.promising === "function"
    ? WebAssembly.promising(fn)
    : fn.bind(receiver);
}

export function normalizedRowCap(value, fallback) {
  const numeric = Number(value);

  return Number.isFinite(numeric) && numeric >= 0
    ? Math.floor(numeric)
    : fallback;
}

export function normalizedPositiveInteger(value, fallback) {
  const numeric = Number(value);

  return Number.isFinite(numeric) && numeric > 0
    ? Math.floor(numeric)
    : fallback;
}

export function numericSize(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

export function wasmNumber(value, fallback) {
  const numeric = Number(globalValue(value));

  return Number.isFinite(numeric) ? numeric : fallback;
}

export function u64ToNumber(value) {
  const number = typeof value === "bigint" ? Number(value) : value;

  return Number.isSafeInteger(number) && number >= 0 ? number : -1;
}

export function makeMemoryView(memory) {
  const decoder = new TextDecoder();

  function view() {
    return new DataView(memory.buffer);
  }

  function bytes() {
    return new Uint8Array(memory.buffer);
  }

  function decodeString(ptr, len) {
    if (!Number.isInteger(ptr) || !Number.isInteger(len) || ptr < 0 || len < 0) {
      return "";
    }

    const end = ptr + len;

    if (end < ptr || end > memory.buffer.byteLength) {
      return "";
    }

    return decoder.decode(bytes().subarray(ptr, end));
  }

  function span(ptr, len) {
    if (!Number.isInteger(ptr) || !Number.isInteger(len) || ptr < 0 || len < 0) {
      return null;
    }

    const end = ptr + len;

    if (end < ptr || end > memory.buffer.byteLength) {
      return null;
    }

    return bytes().subarray(ptr, end);
  }

  return { bytes, decodeString, span, view };
}
