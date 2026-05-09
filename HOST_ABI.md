# Host ABI

Generated from `abi/host.json` by `tools/generate-host-abi.js`.
Do not edit generated ABI values by hand.

## Host Imports

| Name | Params | Result | Async |
|---|---|---|---|
| `canvas_get_size` |  | `i64` | no |
| `canvas_listen_resize` |  |  | no |
| `pointer_listen` |  |  | no |
| `file_picker_open` | `i32`, `i32` | `i32` | yes |
| `opfs_create_from_file` | `i32` | `i32` | yes |
| `opfs_read_chunk` | `i32`, `i64`, `i32`, `i32` | `i32` | yes |
| `opfs_source_from_file` | `i32` | `i32` | yes |
| `opfs_source_open` | `i32`, `i32` | `i32` | yes |
| `opfs_source_name_len` | `i32` | `i32` | no |
| `opfs_source_name` | `i32`, `i32`, `i32` | `i32` | no |
| `opfs_source_size` | `i32` | `i64` | no |
| `opfs_source_read` | `i32`, `i64`, `i32`, `i32` | `i32` | yes |
| `opfs_index_create` | `i32`, `i32` | `i32` | yes |
| `opfs_index_open` | `i32`, `i32` | `i32` | yes |
| `opfs_index_read` | `i32`, `i64`, `i32`, `i32` | `i32` | yes |
| `opfs_index_write` | `i32`, `i64`, `i32`, `i32` | `i32` | yes |
| `opfs_index_flush` | `i32` | `i32` | yes |
| `opfs_index_size` | `i32` | `i64` | no |

## Host Constants

| Constant | Value | Description |
|---|---:|---|
| `HOST_SCRATCH_BASE` | `0x00000000` | Host-owned scratch base. |
| `HOST_CANVAS_SIZE_OFFSET` | `0x00000000` | Canvas width, u32. |
| `HOST_CANVAS_HEIGHT_OFFSET` | `0x00000004` | Canvas height, u32. |
| `HOST_CANVAS_RESIZE_SEQ_OFFSET` | `0x00000008` | Incremented after each resize write. |
| `HOST_POINTER_RING_OFFSET` | `0x00000040` | Pointer ring header base. |
| `HOST_POINTER_RING_HEADER_BYTES` | `32` | Pointer ring header byte length. |
| `HOST_POINTER_RECORD_SIZE` | `32` | Pointer event record byte length. |
| `HOST_POINTER_RECORD_CAPACITY` | `256` | Pointer event record capacity. |
| `HOST_POINTER_RECORDS_OFFSET` | `0x00000060` | Pointer event records base. |
| `HOST_POINTER_RECORDS_BYTES` | `8192` | Pointer event record storage byte length. |
| `HOST_POINTER_RING_READ_INDEX_OFFSET` | `0x00000040` | Unread pointer ring read index, u32. |
| `HOST_POINTER_RING_WRITE_INDEX_OFFSET` | `0x00000044` | Pointer ring write index, u32. |
| `HOST_POINTER_RING_COUNT_OFFSET` | `0x00000048` | Unread pointer record count, u32. |
| `HOST_POINTER_RING_DROPPED_OFFSET` | `0x0000004C` | Dropped pointer event count, u32. |
| `HOST_POINTER_RING_CAPACITY_OFFSET` | `0x00000050` | Pointer ring capacity field, u32. |
| `HOST_POINTER_RING_RECORD_SIZE_OFFSET` | `0x00000054` | Pointer ring record size field, u32. |
| `HOST_POINTER_RING_RESERVED_OFFSET` | `0x00000058` | Pointer ring reserved bytes base. |
| `HOST_POINTER_KIND_DOWN` | `1` | Pointer down event kind. |
| `HOST_POINTER_KIND_MOVE` | `2` | Pointer move event kind. |
| `HOST_POINTER_KIND_UP` | `3` | Pointer up event kind. |
| `HOST_POINTER_KIND_CANCEL` | `4` | Pointer cancel event kind. |
| `HOST_POINTER_MOD_SHIFT` | `0x00000001` | Shift key active. |
| `HOST_POINTER_MOD_CTRL` | `0x00000002` | Control key active. |
| `HOST_POINTER_MOD_ALT` | `0x00000004` | Alt key active. |
| `HOST_POINTER_MOD_META` | `0x00000008` | Meta key active. |
| `HOST_POINTER_MOD_PRIMARY` | `0x00000010` | Event is the primary pointer. |
| `HOST_POINTER_MOD_BUTTON_PRIMARY` | `0x00000020` | Primary pointer button is down. |
| `HOST_POINTER_MOD_BUTTON_SECONDARY` | `0x00000040` | Secondary pointer button is down. |
| `HOST_POINTER_MOD_BUTTON_AUXILIARY` | `0x00000080` | Auxiliary pointer button is down. |

## OPFS Bridge Contract

Generated from `abi/host.json`. JavaScript owns only browser OPFS/File API
mechanics; import grouping, bridge markers, unsupported worker capabilities,
and generated source-name shape live in this shared contract.

- Main OPFS index size marker: `tracy.opfsIndexSizeMayBeStale`
- Worker file-handle unsupported reason: `file handles are owned by the main thread`
- File source name shape: `trace-<base36-time>-<source-id>.bin`
