// Generated from abi/layout.json by tools/generate-layout.js.
// Do not edit host/index-format-spec.mjs by hand.

export const INDEX_FORMAT_CONTRACT = Object.freeze({
  OWNER: "index-wasm",
  SOURCE: "abi/layout.json#index",
  WASM_MODULE: "index",
});

export const INDEX_FORMAT = Object.freeze({
  OPFS_PAGE_SIZE: 65536,
});

export const INDEX_DECODE_HINTS = Object.freeze({
  COMPACT_SLICES: 1,
  PARTIAL: 4,
  TRACK_ID_SHIFT: 8,
});

export const INDEX_PAGE_HEADER_OFFSETS = Object.freeze({
  BUCKET_START: 12,
  BUCKET_END: 20,
  RECORD_COUNT: 28,
  DECODE_HINTS: 36,
});

export const INDEX_QUERY_RESULT_LAYOUT = Object.freeze({
  BYTES: 28,
  FIELD_BYTES: 4,
  START: 0,
  DUR: 4,
  NAME: 8,
  DEPTH: 12,
  CAT: 16,
  COLOR: 20,
  PARTIAL: 24,
});
