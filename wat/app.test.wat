(module
  (import "env" "memory" (memory $memory 1))
  (import "watwat" "assert_true"
    (func $assert_true (param i32) (param i32)))
  (import "watwat" "assert_eq_i32"
    (func $assert_eq_i32 (param i32) (param i32) (param i32)))
  (import "watwat" "assert_eq_i64"
    (func $assert_eq_i64 (param i64) (param i64) (param i32)))
  ;; @generated host-imports app:start
  (import "host" "canvas_get_size" (func $canvas_get_size (result i64)))
  (import "host" "canvas_listen_resize" (func $canvas_listen_resize))
  (import "host" "pointer_listen" (func $pointer_listen))
  (import "host" "file_picker_open" (func $file_picker_open (param i32 i32) (result i32)))
  (import "host" "opfs_create_from_file" (func $opfs_create_from_file (param i32) (result i32)))
  (import "host" "opfs_read_chunk" (func $opfs_read_chunk (param i32 i64 i32 i32) (result i32)))
  (import "host" "opfs_source_from_file" (func $opfs_source_from_file (param i32) (result i32)))
  (import "host" "opfs_source_open" (func $opfs_source_open (param i32 i32) (result i32)))
  (import "host" "opfs_source_name_len" (func $opfs_source_name_len (param i32) (result i32)))
  (import "host" "opfs_source_name" (func $opfs_source_name (param i32 i32 i32) (result i32)))
  (import "host" "opfs_source_size" (func $opfs_source_size (param i32) (result i64)))
  (import "host" "opfs_source_read" (func $opfs_source_read (param i32 i64 i32 i32) (result i32)))
  (import "host" "opfs_index_create" (func $opfs_index_create (param i32 i32) (result i32)))
  (import "host" "opfs_index_open" (func $opfs_index_open (param i32 i32) (result i32)))
  (import "host" "opfs_index_read" (func $opfs_index_read (param i32 i64 i32 i32) (result i32)))
  (import "host" "opfs_index_write" (func $opfs_index_write (param i32 i64 i32 i32) (result i32)))
  (import "host" "opfs_index_flush" (func $opfs_index_flush (param i32) (result i32)))
  (import "host" "opfs_index_size" (func $opfs_index_size (param i32) (result i64)))
  ;; @generated host-imports app:end
  (import "app" "tracy_main" (func $tracy_main))
  (import "app" "tracy_tick" (func $tracy_tick))
  (import "app" "trace_render_plan_begin"
    (func $trace_render_plan_begin (param i32 i32 i32 i32 i32)))
  (import "app" "trace_render_plan_next"
    (func $trace_render_plan_next (result i32)))
  (import "app" "trace_render_plan_op_end"
    (func $trace_render_plan_op_end (result i32)))
  (import "app" "trace_render_plan_op_start"
    (func $trace_render_plan_op_start (result i32)))
  (import "app" "trace_render_plan_op_track_id"
    (func $trace_render_plan_op_track_id (result i32)))
  (import "app" "trace_render_query_ranges_per_track"
    (func $trace_render_query_ranges_per_track (param i32 i32) (result i32)))
  (import "app" "trace_render_query_tile_span"
    (func $trace_render_query_tile_span (param i32 i32 i32) (result i32)))
  (import "app" "trace_render_slice_end_x"
    (func $trace_render_slice_end_x (param i32 i32 i32 i32) (result i32)))
  (import "app" "trace_render_slice_x"
    (func $trace_render_slice_x (param i32 i32 i32 i32) (result i32)))
  (import "app" "trace_render_slice_y"
    (func $trace_render_slice_y (param i32 i32 i32 i32) (result i32)))

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

  (func (export "test_trace_render_exports_plan_query_and_layout")
    i32.const 3
    i32.const 2
    call $trace_render_query_ranges_per_track
    i32.const 1
    i32.const 18
    call $assert_eq_i32

    i32.const 100
    i32.const 10
    i32.const 2
    call $trace_render_query_tile_span
    i32.const 50
    i32.const 19
    call $assert_eq_i32

    i32.const 0
    i32.const 100
    i32.const 2
    i32.const 3
    i32.const 10
    call $trace_render_plan_begin

    call $trace_render_plan_next
    i32.const 1
    i32.const 20
    call $assert_eq_i32
    call $trace_render_plan_op_start
    i32.const 0
    i32.const 21
    call $assert_eq_i32
    call $trace_render_plan_op_end
    i32.const 100
    i32.const 22
    call $assert_eq_i32
    call $trace_render_plan_op_track_id
    i32.const 0
    i32.const 23
    call $assert_eq_i32

    call $trace_render_plan_next
    i32.const 1
    i32.const 24
    call $assert_eq_i32
    call $trace_render_plan_op_start
    i32.const 0
    i32.const 25
    call $assert_eq_i32
    call $trace_render_plan_op_end
    i32.const 100
    i32.const 26
    call $assert_eq_i32
    call $trace_render_plan_op_track_id
    i32.const 1
    i32.const 27
    call $assert_eq_i32

    call $trace_render_plan_next
    i32.const 0
    i32.const 28
    call $assert_eq_i32

    i32.const 10
    i32.const 0
    i32.const 100
    i32.const 320
    call $trace_render_slice_x
    i32.const 32
    i32.const 29
    call $assert_eq_i32

    i32.const 30
    i32.const 0
    i32.const 100
    i32.const 320
    call $trace_render_slice_end_x
    i32.const 96
    i32.const 30
    call $assert_eq_i32

    i32.const 1
    i32.const 18
    i32.const 10
    i32.const 3
    call $trace_render_slice_y
    i32.const 31
    i32.const 31
    call $assert_eq_i32
  )

  (func (export "test_trace_render_branch_edges")
    i32.const 5
    i32.const 0
    call $trace_render_query_ranges_per_track
    i32.const 1
    i32.const 32
    call $assert_eq_i32

    i32.const 10
    i32.const 20
    i32.const 2
    call $trace_render_query_tile_span
    i32.const 20
    i32.const 33
    call $assert_eq_i32

    i32.const 10
    i32.const 2
    i32.const 0
    call $trace_render_query_tile_span
    i32.const 10
    i32.const 34
    call $assert_eq_i32

    i32.const 0
    i32.const 100
    i32.const 1
    i32.const 4
    i32.const 10
    call $trace_render_plan_begin

    call $trace_render_plan_next
    i32.const 1
    i32.const 35
    call $assert_eq_i32
    call $trace_render_plan_op_start
    i32.const 0
    i32.const 36
    call $assert_eq_i32
    call $trace_render_plan_op_end
    i32.const 25
    i32.const 37
    call $assert_eq_i32

    i32.const 0
    i32.const 100
    i32.const 2
    i32.const 1
    i32.const 10
    call $trace_render_plan_begin

    call $trace_render_plan_next
    i32.const 1
    i32.const 38
    call $assert_eq_i32

    call $trace_render_plan_next
    i32.const 2
    i32.const 39
    call $assert_eq_i32
    call $trace_render_plan_op_start
    i32.const 0
    i32.const 40
    call $assert_eq_i32
    call $trace_render_plan_op_end
    i32.const 100
    i32.const 41
    call $assert_eq_i32
    call $trace_render_plan_op_track_id
    i32.const 1
    i32.const 42
    call $assert_eq_i32

    i32.const 10
    i32.const 0
    i32.const 0
    i32.const 320
    call $trace_render_slice_x
    i32.const 0
    i32.const 43
    call $assert_eq_i32

    i32.const -50
    i32.const 0
    i32.const 100
    i32.const 320
    call $trace_render_slice_x
    i32.const 0
    i32.const 44
    call $assert_eq_i32

    i32.const 150
    i32.const 0
    i32.const 100
    i32.const 320
    call $trace_render_slice_x
    i32.const 320
    i32.const 45
    call $assert_eq_i32
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

    i32.const 1
    call $opfs_source_from_file
    i32.const 11
    i32.const 6
    call $assert_eq_i32

    i32.const 4096
    i32.const 12
    call $opfs_source_open
    i32.const 12
    i32.const 7
    call $assert_eq_i32

    i32.const 11
    call $opfs_source_name_len
    i32.const 14
    i32.const 8
    call $assert_eq_i32

    i32.const 11
    i32.const 4096
    i32.const 32
    call $opfs_source_name
    i32.const 14
    i32.const 9
    call $assert_eq_i32

    i32.const 11
    call $opfs_source_size
    i64.const 1048576
    i32.const 10
    call $assert_eq_i64

    i32.const 11
    i64.const 1024
    i32.const 64
    i32.const 2048
    call $opfs_source_read
    i32.const 64
    i32.const 11
    call $assert_eq_i32

    i32.const 4096
    i32.const 16
    call $opfs_index_create
    i32.const 21
    i32.const 12
    call $assert_eq_i32

    i32.const 4096
    i32.const 16
    call $opfs_index_open
    i32.const 22
    i32.const 13
    call $assert_eq_i32

    i32.const 21
    i64.const 0
    i32.const 65536
    i32.const 65536
    call $opfs_index_read
    i32.const 65536
    i32.const 14
    call $assert_eq_i32

    i32.const 21
    i64.const 0
    i32.const 65536
    i32.const 65536
    call $opfs_index_write
    i32.const 65536
    i32.const 15
    call $assert_eq_i32

    i32.const 21
    call $opfs_index_flush
    i32.const 0
    i32.const 16
    call $assert_eq_i32

    i32.const 21
    call $opfs_index_size
    i64.const 131072
    i32.const 17
    call $assert_eq_i64
  )
)
