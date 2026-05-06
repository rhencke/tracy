(module
  (import "host" "canvas_get_size" (func $canvas_get_size (result i64)))
  (import "host" "canvas_listen_resize" (func $canvas_listen_resize))
  (import "host" "pointer_listen" (func $pointer_listen))
  (import "host" "file_picker_open"
    (func $file_picker_open (param i32) (param i32) (result i32)))
  (import "host" "opfs_create_from_file"
    (func $opfs_create_from_file (param i32) (result i32)))
  (import "host" "opfs_read_chunk"
    (func $opfs_read_chunk (param i32) (param i64) (param i32) (param i32) (result i32)))
  (import "host" "opfs_source_from_file"
    (func $opfs_source_from_file (param i32) (result i32)))
  (import "host" "opfs_source_open"
    (func $opfs_source_open (param i32) (param i32) (result i32)))
  (import "host" "opfs_source_name_len"
    (func $opfs_source_name_len (param i32) (result i32)))
  (import "host" "opfs_source_name"
    (func $opfs_source_name (param i32) (param i32) (param i32) (result i32)))
  (import "host" "opfs_source_size"
    (func $opfs_source_size (param i32) (result i64)))
  (import "host" "opfs_source_read"
    (func $opfs_source_read (param i32) (param i64) (param i32) (param i32) (result i32)))

  (func (export "tracy_main"))
  (func (export "tracy_tick"))
)
