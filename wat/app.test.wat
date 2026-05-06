(module
  (import "env" "memory" (memory $memory 1))
  (import "watwat" "assert_true"
    (func $assert_true (param i32) (param i32)))
  (import "watwat" "assert_eq_i32"
    (func $assert_eq_i32 (param i32) (param i32) (param i32)))
  (import "watwat" "assert_eq_i64"
    (func $assert_eq_i64 (param i64) (param i64) (param i32)))
  (import "host" "canvas_get_size" (func $canvas_get_size (result i64)))
  (import "host" "canvas_listen_resize" (func $canvas_listen_resize))
  (import "host" "pointer_listen" (func $pointer_listen))
  (import "host" "file_picker_open"
    (func $file_picker_open (param i32) (param i32) (result i32)))
  (import "host" "opfs_create_from_file"
    (func $opfs_create_from_file (param i32) (result i32)))
  (import "host" "opfs_read_chunk"
    (func $opfs_read_chunk (param i32) (param i64) (param i32) (param i32) (result i32)))
  (import "app" "tracy_main" (func $tracy_main))
  (import "app" "tracy_tick" (func $tracy_tick))

  (data (i32.const 1024) "app test failed")

  (func (export "message_for") (param $code i32) (result i32 i32)
    i32.const 1024
    i32.const 15
  )

  (func (export "test_app_exports_are_callable")
    call $tracy_main
    call $tracy_tick

    i32.const 1
    i32.const 1
    call $assert_true
  )

  (func (export "test_host_stubs_are_deterministic")
    call $canvas_get_size
    i64.const 0x0000025800000320
    i32.const 2
    call $assert_eq_i64

    call $canvas_listen_resize
    call $pointer_listen

    i32.const 0
    i32.const 0
    call $file_picker_open
    i32.const 7
    i32.const 3
    call $assert_eq_i32

    i32.const 1
    call $opfs_create_from_file
    i32.const 11
    i32.const 4
    call $assert_eq_i32

    i32.const 1
    i64.const 0
    i32.const 16
    i32.const 2048
    call $opfs_read_chunk
    i32.const 16
    i32.const 5
    call $assert_eq_i32
  )
)
