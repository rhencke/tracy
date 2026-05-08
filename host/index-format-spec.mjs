// Generated from abi/layout.json by tools/generate-layout.js.
// Do not edit host/index-format-spec.mjs by hand.

export const INDEX_FORMAT = Object.freeze({
  OPFS_PAGE_SIZE: 65536,
});

export const INDEX_DECODE_HINTS = Object.freeze({
  COMPACT_SLICES: 1,
  TRACK_ID_SHIFT: 8,
});

export const INDEX_PAGE_HEADER_OFFSETS = Object.freeze({
  BUCKET_START: 12,
  BUCKET_END: 20,
  RECORD_COUNT: 28,
  DECODE_HINTS: 36,
});
