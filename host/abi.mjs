// Generated from abi/host.json by tools/generate-host-abi.js.
// Do not edit host/abi.mjs by hand.

export const HOST_SCRATCH_BASE = 0x00000000;
export const HOST_CANVAS_SIZE_OFFSET = 0x00000000;
export const HOST_CANVAS_HEIGHT_OFFSET = 0x00000004;
export const HOST_CANVAS_RESIZE_SEQ_OFFSET = 0x00000008;
export const HOST_POINTER_RING_OFFSET = 0x00000040;
export const HOST_POINTER_RING_HEADER_BYTES = 32;
export const HOST_POINTER_RECORD_SIZE = 32;
export const HOST_POINTER_RECORD_CAPACITY = 256;
export const HOST_POINTER_RECORDS_OFFSET = 0x00000060;
export const HOST_POINTER_RECORDS_BYTES = 8192;
export const HOST_POINTER_RING_READ_INDEX_OFFSET = 0x00000040;
export const HOST_POINTER_RING_WRITE_INDEX_OFFSET = 0x00000044;
export const HOST_POINTER_RING_COUNT_OFFSET = 0x00000048;
export const HOST_POINTER_RING_DROPPED_OFFSET = 0x0000004C;
export const HOST_POINTER_RING_CAPACITY_OFFSET = 0x00000050;
export const HOST_POINTER_RING_RECORD_SIZE_OFFSET = 0x00000054;
export const HOST_POINTER_RING_RESERVED_OFFSET = 0x00000058;
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

export const HOST_ASYNC_IMPORTS = Object.freeze(["file_picker_open", "opfs_create_from_file", "opfs_read_chunk", "opfs_source_from_file", "opfs_source_open", "opfs_source_read", "opfs_index_create", "opfs_index_open", "opfs_index_read", "opfs_index_write", "opfs_index_flush"]);

export const HOST_IMPORT_NAME = Object.freeze({
  CANVAS_GET_SIZE: "canvas_get_size",
  CANVAS_LISTEN_RESIZE: "canvas_listen_resize",
  POINTER_LISTEN: "pointer_listen",
  FILE_PICKER_OPEN: "file_picker_open",
  OPFS_CREATE_FROM_FILE: "opfs_create_from_file",
  OPFS_READ_CHUNK: "opfs_read_chunk",
  OPFS_SOURCE_FROM_FILE: "opfs_source_from_file",
  OPFS_SOURCE_OPEN: "opfs_source_open",
  OPFS_SOURCE_NAME_LEN: "opfs_source_name_len",
  OPFS_SOURCE_NAME: "opfs_source_name",
  OPFS_SOURCE_SIZE: "opfs_source_size",
  OPFS_SOURCE_READ: "opfs_source_read",
  OPFS_INDEX_CREATE: "opfs_index_create",
  OPFS_INDEX_OPEN: "opfs_index_open",
  OPFS_INDEX_READ: "opfs_index_read",
  OPFS_INDEX_WRITE: "opfs_index_write",
  OPFS_INDEX_FLUSH: "opfs_index_flush",
  OPFS_INDEX_SIZE: "opfs_index_size",
});

export const HOST_IMPORTS = Object.freeze([
  Object.freeze({
    name: "canvas_get_size",
    params: Object.freeze([]),
    result: "i64",
    async: false,
  }),
  Object.freeze({
    name: "canvas_listen_resize",
    params: Object.freeze([]),
    result: null,
    async: false,
  }),
  Object.freeze({
    name: "pointer_listen",
    params: Object.freeze([]),
    result: null,
    async: false,
  }),
  Object.freeze({
    name: "file_picker_open",
    params: Object.freeze(["i32", "i32"]),
    result: "i32",
    async: true,
  }),
  Object.freeze({
    name: "opfs_create_from_file",
    params: Object.freeze(["i32"]),
    result: "i32",
    async: true,
  }),
  Object.freeze({
    name: "opfs_read_chunk",
    params: Object.freeze(["i32", "i64", "i32", "i32"]),
    result: "i32",
    async: true,
  }),
  Object.freeze({
    name: "opfs_source_from_file",
    params: Object.freeze(["i32"]),
    result: "i32",
    async: true,
  }),
  Object.freeze({
    name: "opfs_source_open",
    params: Object.freeze(["i32", "i32"]),
    result: "i32",
    async: true,
  }),
  Object.freeze({
    name: "opfs_source_name_len",
    params: Object.freeze(["i32"]),
    result: "i32",
    async: false,
  }),
  Object.freeze({
    name: "opfs_source_name",
    params: Object.freeze(["i32", "i32", "i32"]),
    result: "i32",
    async: false,
  }),
  Object.freeze({
    name: "opfs_source_size",
    params: Object.freeze(["i32"]),
    result: "i64",
    async: false,
  }),
  Object.freeze({
    name: "opfs_source_read",
    params: Object.freeze(["i32", "i64", "i32", "i32"]),
    result: "i32",
    async: true,
  }),
  Object.freeze({
    name: "opfs_index_create",
    params: Object.freeze(["i32", "i32"]),
    result: "i32",
    async: true,
  }),
  Object.freeze({
    name: "opfs_index_open",
    params: Object.freeze(["i32", "i32"]),
    result: "i32",
    async: true,
  }),
  Object.freeze({
    name: "opfs_index_read",
    params: Object.freeze(["i32", "i64", "i32", "i32"]),
    result: "i32",
    async: true,
  }),
  Object.freeze({
    name: "opfs_index_write",
    params: Object.freeze(["i32", "i64", "i32", "i32"]),
    result: "i32",
    async: true,
  }),
  Object.freeze({
    name: "opfs_index_flush",
    params: Object.freeze(["i32"]),
    result: "i32",
    async: true,
  }),
  Object.freeze({
    name: "opfs_index_size",
    params: Object.freeze(["i32"]),
    result: "i64",
    async: false,
  }),
]);

export const OPFS_BRIDGE_CONTRACT = Object.freeze({
  sourceImports: Object.freeze(["opfs_create_from_file", "opfs_read_chunk", "opfs_source_from_file", "opfs_source_name", "opfs_source_name_len", "opfs_source_open", "opfs_source_read", "opfs_source_size"]),
  indexReaderImports: Object.freeze(["opfs_index_open", "opfs_index_read", "opfs_index_size"]),
  indexWriterImports: Object.freeze(["opfs_index_create", "opfs_index_flush", "opfs_index_write"]),
  workerUnsupportedFileImports: Object.freeze(["opfs_create_from_file", "opfs_source_from_file"]),
  indexSizeMayBeStaleMarker: "tracy.opfsIndexSizeMayBeStale",
  workerUnsupportedFileReason: "file handles are owned by the main thread",
  fileSourceName: Object.freeze({
    prefix: "trace-",
    separator: "-",
    suffix: ".bin",
  }),
  fixtureOperations: Object.freeze({
    filePickerOpen: "file-picker-open",
    indexCreate: "index-create",
    indexFlush: "index-flush",
    indexOpen: "index-open",
    indexRead: "index-read",
    indexWrite: "index-write",
    mainThreadIndexOpen: "main-thread-index-open",
    mainThreadIndexRead: "main-thread-index-read",
    sameHostTestShortcut: "same-host-test-shortcut",
    setFileSelectedCallback: "set-file-selected-callback",
    selectedFileIngest: "selected-file-ingest",
    sourceFromFile: "source-from-file",
    sourceOpen: "source-open",
    workerMessageDelivery: "worker-message-delivery",
    workerPublication: "worker-publication",
  }),
  mainIndexSizeMayBeStale: true,
  workerPersistsFileSources: false,
  defaultPersistsFileSources: true,
});
