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
  (import "app" "trace_render_range_x"
    (func $trace_render_range_x (param i32 i32 i32 i32 i32) (result i32)))
  (import "app" "trace_render_range_width"
    (func $trace_render_range_width (param i32 i32 i32 i32 i32) (result i32)))
  (import "app" "trace_render_unknown_x"
    (func $trace_render_unknown_x (param i32 i32) (result i32)))
  (import "app" "trace_render_unknown_width"
    (func $trace_render_unknown_width (param i32 i32) (result i32)))
  (import "app" "trace_render_stripe_start"
    (func $trace_render_stripe_start (param i32 i32) (result i32)))
  (import "app" "trace_render_stripe_end"
    (func $trace_render_stripe_end (param i32 i32 i32) (result i32)))
  (import "app" "trace_render_commands_begin"
    (func $trace_render_commands_begin
      (param i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i32)
      (result i32)))
  (import "app" "trace_render_commands_overflow"
    (func $trace_render_commands_overflow (result i32)))
  (import "app" "trace_render_append_query_rows"
    (func $trace_render_append_query_rows
      (param i32 i32 i32 i32 i32)
      (result i32)))

  ;; @include trace-renderer-abi.wat.inc

  (data (i32.const 1024) "app test failed")

  (func (export "message_for") (param $code i32) (result i32 i32)
    i32.const 1024
    i32.const 15
  )

  (func $command_field (param $base i32) (param $index i32) (param $offset i32) (result i32)
    local.get $base
    local.get $index
    global.get $TRACE_RENDER_COMMAND_BYTES
    i32.mul
    i32.add
    local.get $offset
    i32.add
    i32.load
  )

  (func $row_field (param $base i32) (param $index i32) (param $offset i32) (result i32)
    local.get $base
    local.get $index
    global.get $INDEX_QUERY_RESULT_BYTES
    i32.mul
    i32.add
    local.get $offset
    i32.add
    i32.load
  )

  (func $store_row_field (param $base i32) (param $index i32) (param $offset i32) (param $value i32)
    local.get $base
    local.get $index
    global.get $INDEX_QUERY_RESULT_BYTES
    i32.mul
    i32.add
    local.get $offset
    i32.add
    local.get $value
    i32.store
  )

  (func $store_incomplete_range_field (param $base i32) (param $index i32) (param $offset i32) (param $value i32)
    local.get $base
    local.get $index
    global.get $TRACE_RENDER_INCOMPLETE_RANGE_BYTES
    i32.mul
    i32.add
    local.get $offset
    i32.add
    local.get $value
    i32.store
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
    global.get $TRACE_RENDER_OP_QUERY_RANGE
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
    global.get $TRACE_RENDER_OP_QUERY_RANGE
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
    global.get $TRACE_RENDER_OP_END
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
    global.get $TRACE_RENDER_DEFAULT_TRACE_TOP
    global.get $TRACE_RENDER_DEFAULT_LANE_HEIGHT
    global.get $TRACE_RENDER_DEFAULT_LANE_GAP
    call $trace_render_slice_y
    i32.const 31
    i32.const 31
    call $assert_eq_i32

    i32.const 10
    i32.const 30
    i32.const 0
    i32.const 100
    i32.const 320
    call $trace_render_range_x
    i32.const 32
    i32.const 46
    call $assert_eq_i32

    i32.const 10
    i32.const 30
    i32.const 0
    i32.const 100
    i32.const 320
    call $trace_render_range_width
    i32.const 64
    i32.const 47
    call $assert_eq_i32

    i32.const 320
    global.get $TRACE_RENDER_DEFAULT_UNKNOWN_AFFORDANCE_WIDTH
    call $trace_render_unknown_width
    i32.const 72
    i32.const 48
    call $assert_eq_i32

    i32.const 320
    global.get $TRACE_RENDER_DEFAULT_UNKNOWN_AFFORDANCE_WIDTH
    call $trace_render_unknown_x
    i32.const 248
    i32.const 49
    call $assert_eq_i32

    i32.const 248
    i32.const 20
    call $trace_render_stripe_start
    i32.const 228
    i32.const 50
    call $assert_eq_i32

    i32.const 248
    global.get $TRACE_RENDER_DEFAULT_UNKNOWN_AFFORDANCE_WIDTH
    i32.const 20
    call $trace_render_stripe_end
    i32.const 340
    i32.const 51
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
    global.get $TRACE_RENDER_OP_QUERY_RANGE
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
    global.get $TRACE_RENDER_OP_QUERY_RANGE
    i32.const 38
    call $assert_eq_i32

    call $trace_render_plan_next
    global.get $TRACE_RENDER_OP_INCOMPLETE_QUERY_RANGE
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

    i32.const 150
    i32.const 160
    i32.const 0
    i32.const 100
    i32.const 320
    call $trace_render_range_width
    i32.const 0
    i32.const 52
    call $assert_eq_i32

    i32.const 1
    i32.const 2
    i32.const 0
    i32.const 1000
    i32.const 320
    call $trace_render_range_width
    i32.const 1
    i32.const 53
    call $assert_eq_i32

    i32.const 0
    global.get $TRACE_RENDER_DEFAULT_UNKNOWN_AFFORDANCE_WIDTH
    call $trace_render_unknown_width
    i32.const 0
    i32.const 69
    call $assert_eq_i32

    i32.const 320
    i32.const 0
    call $trace_render_unknown_width
    i32.const 0
    i32.const 70
    call $assert_eq_i32
  )

  (func (export "test_trace_render_append_query_rows")
    ;; source row 0
    i32.const 2048
    i32.const 0
    global.get $INDEX_QUERY_RESULT_START_OFFSET
    i32.const 11
    call $store_row_field
    i32.const 2048
    i32.const 0
    global.get $INDEX_QUERY_RESULT_DUR_OFFSET
    i32.const 12
    call $store_row_field
    i32.const 2048
    i32.const 0
    global.get $INDEX_QUERY_RESULT_NAME_OFFSET
    i32.const 13
    call $store_row_field
    i32.const 2048
    i32.const 0
    global.get $INDEX_QUERY_RESULT_DEPTH_OFFSET
    i32.const 14
    call $store_row_field
    i32.const 2048
    i32.const 0
    global.get $INDEX_QUERY_RESULT_CAT_OFFSET
    i32.const 15
    call $store_row_field
    i32.const 2048
    i32.const 0
    global.get $INDEX_QUERY_RESULT_COLOR_OFFSET
    i32.const 16
    call $store_row_field
    i32.const 2048
    i32.const 0
    global.get $INDEX_QUERY_RESULT_PARTIAL_OFFSET
    i32.const 17
    call $store_row_field

    ;; source row 1
    i32.const 2048
    i32.const 1
    global.get $INDEX_QUERY_RESULT_START_OFFSET
    i32.const 21
    call $store_row_field
    i32.const 2048
    i32.const 1
    global.get $INDEX_QUERY_RESULT_DUR_OFFSET
    i32.const 22
    call $store_row_field
    i32.const 2048
    i32.const 1
    global.get $INDEX_QUERY_RESULT_NAME_OFFSET
    i32.const 23
    call $store_row_field
    i32.const 2048
    i32.const 1
    global.get $INDEX_QUERY_RESULT_DEPTH_OFFSET
    i32.const 24
    call $store_row_field
    i32.const 2048
    i32.const 1
    global.get $INDEX_QUERY_RESULT_CAT_OFFSET
    i32.const 25
    call $store_row_field
    i32.const 2048
    i32.const 1
    global.get $INDEX_QUERY_RESULT_COLOR_OFFSET
    i32.const 26
    call $store_row_field
    i32.const 2048
    i32.const 1
    global.get $INDEX_QUERY_RESULT_PARTIAL_OFFSET
    i32.const 27
    call $store_row_field

    i32.const 2048 ;; source ptr
    i32.const 2 ;; source count
    i32.const 4096 ;; dest ptr
    i32.const 1 ;; existing dest count
    i32.const 3 ;; dest cap
    call $trace_render_append_query_rows
    i32.const 2
    i32.const 77
    call $assert_eq_i32

    i32.const 4096
    i32.const 1
    global.get $INDEX_QUERY_RESULT_START_OFFSET
    call $row_field
    i32.const 11
    i32.const 78
    call $assert_eq_i32
    i32.const 4096
    i32.const 1
    global.get $INDEX_QUERY_RESULT_PARTIAL_OFFSET
    call $row_field
    i32.const 17
    i32.const 79
    call $assert_eq_i32
    i32.const 4096
    i32.const 2
    global.get $INDEX_QUERY_RESULT_START_OFFSET
    call $row_field
    i32.const 21
    i32.const 80
    call $assert_eq_i32
    i32.const 4096
    i32.const 2
    global.get $INDEX_QUERY_RESULT_COLOR_OFFSET
    call $row_field
    i32.const 26
    i32.const 81
    call $assert_eq_i32

    i32.const 2048
    i32.const 2
    i32.const 4096
    i32.const 2
    i32.const 3
    call $trace_render_append_query_rows
    i32.const 1
    i32.const 82
    call $assert_eq_i32
  )

  (func (export "test_trace_render_command_buffer_emits_canvas_ops")
    ;; row 0: colored complete slice from 10..30 at depth 1
    i32.const 2048
    i32.const 0
    global.get $INDEX_QUERY_RESULT_START_OFFSET
    i32.const 10
    call $store_row_field
    i32.const 2048
    i32.const 0
    global.get $INDEX_QUERY_RESULT_DUR_OFFSET
    i32.const 20
    call $store_row_field
    i32.const 2048
    i32.const 0
    global.get $INDEX_QUERY_RESULT_DEPTH_OFFSET
    i32.const 1
    call $store_row_field
    i32.const 2048
    i32.const 0
    global.get $INDEX_QUERY_RESULT_COLOR_OFFSET
    i32.const 0x112233
    call $store_row_field
    i32.const 2048
    i32.const 0
    global.get $INDEX_QUERY_RESULT_PARTIAL_OFFSET
    i32.const 0
    call $store_row_field

    ;; row 1: partial default-color slice from 50..60 at depth 0
    i32.const 2048
    i32.const 1
    global.get $INDEX_QUERY_RESULT_START_OFFSET
    i32.const 50
    call $store_row_field
    i32.const 2048
    i32.const 1
    global.get $INDEX_QUERY_RESULT_DUR_OFFSET
    i32.const 10
    call $store_row_field
    i32.const 2048
    i32.const 1
    global.get $INDEX_QUERY_RESULT_DEPTH_OFFSET
    i32.const 0
    call $store_row_field
    i32.const 2048
    i32.const 1
    global.get $INDEX_QUERY_RESULT_COLOR_OFFSET
    i32.const 0
    call $store_row_field
    i32.const 2048
    i32.const 1
    global.get $INDEX_QUERY_RESULT_PARTIAL_OFFSET
    i32.const 1
    call $store_row_field

    ;; one incomplete range from 80..100
    i32.const 3072
    i32.const 0
    global.get $TRACE_RENDER_INCOMPLETE_RANGE_START_OFFSET
    i32.const 80
    call $store_incomplete_range_field
    i32.const 3072
    i32.const 0
    global.get $TRACE_RENDER_INCOMPLETE_RANGE_END_OFFSET
    i32.const 100
    call $store_incomplete_range_field
    i32.const 3072
    i32.const 0
    global.get $TRACE_RENDER_INCOMPLETE_RANGE_TRACK_ID_OFFSET
    i32.const 0
    call $store_incomplete_range_field

    i32.const 4096 ;; command ptr
    i32.const 64 ;; command cap
    i32.const 2048 ;; row ptr
    i32.const 2 ;; row count
    i32.const 3072 ;; incomplete ptr
    i32.const 1 ;; incomplete count
    i32.const 0 ;; viewport start
    i32.const 100 ;; viewport end
    i32.const 100 ;; covered end
    i32.const 320 ;; canvas width
    i32.const 160 ;; canvas height
    global.get $TRACE_RENDER_DEFAULT_LANE_HEIGHT
    global.get $TRACE_RENDER_DEFAULT_LANE_GAP
    global.get $TRACE_RENDER_DEFAULT_TRACE_TOP
    global.get $TRACE_RENDER_DEFAULT_BAND_PADDING
    i32.const 1 ;; ingest active
    global.get $TRACE_RENDER_DEFAULT_PARTIAL_HATCH_SPACING
    global.get $TRACE_RENDER_DEFAULT_UNKNOWN_AFFORDANCE_WIDTH
    global.get $TRACE_RENDER_DEFAULT_UNKNOWN_STRIPE_SPACING
    global.get $TRACE_RENDER_DEFAULT_INCOMPLETE_QUERY_STRIPE_SPACING
    call $trace_render_commands_begin
    i32.const 9
    i32.const 54
    call $assert_eq_i32

    call $trace_render_commands_overflow
    i32.const 0
    i32.const 55
    call $assert_eq_i32

    i32.const 4096
    i32.const 0
    global.get $TRACE_RENDER_COMMAND_TAG_OFFSET
    call $command_field
    global.get $TRACE_RENDER_COMMAND_CLEAR_RECT
    i32.const 56
    call $assert_eq_i32
    i32.const 4096
    i32.const 0
    global.get $TRACE_RENDER_COMMAND_WIDTH_OFFSET
    call $command_field
    i32.const 320
    i32.const 57
    call $assert_eq_i32
    i32.const 4096
    i32.const 0
    global.get $TRACE_RENDER_COMMAND_HEIGHT_OFFSET
    call $command_field
    i32.const 52
    i32.const 58
    call $assert_eq_i32

    i32.const 4096
    i32.const 2
    global.get $TRACE_RENDER_COMMAND_STYLE_KIND_OFFSET
    call $command_field
    global.get $TRACE_RENDER_STYLE_RGB
    i32.const 59
    call $assert_eq_i32
    i32.const 4096
    i32.const 2
    global.get $TRACE_RENDER_COMMAND_STYLE_VALUE_OFFSET
    call $command_field
    i32.const 0x112233
    i32.const 60
    call $assert_eq_i32
    i32.const 4096
    i32.const 2
    global.get $TRACE_RENDER_COMMAND_X_OFFSET
    call $command_field
    i32.const 32
    i32.const 61
    call $assert_eq_i32
    i32.const 4096
    i32.const 2
    global.get $TRACE_RENDER_COMMAND_Y_OFFSET
    call $command_field
    i32.const 31
    i32.const 62
    call $assert_eq_i32
    i32.const 4096
    i32.const 2
    global.get $TRACE_RENDER_COMMAND_WIDTH_OFFSET
    call $command_field
    i32.const 64
    i32.const 63
    call $assert_eq_i32

    i32.const 4096
    i32.const 3
    global.get $TRACE_RENDER_COMMAND_STYLE_VALUE_OFFSET
    call $command_field
    global.get $TRACE_RENDER_ROLE_PARTIAL_SLICE
    i32.const 64
    call $assert_eq_i32
    i32.const 4096
    i32.const 4
    global.get $TRACE_RENDER_COMMAND_TAG_OFFSET
    call $command_field
    global.get $TRACE_RENDER_COMMAND_HATCH_RECT
    i32.const 65
    call $assert_eq_i32
    i32.const 4096
    i32.const 4
    global.get $TRACE_RENDER_COMMAND_X_OFFSET
    call $command_field
    i32.const 160
    i32.const 66
    call $assert_eq_i32
    i32.const 4096
    i32.const 4
    global.get $TRACE_RENDER_COMMAND_X2_OFFSET
    call $command_field
    i32.const 6
    i32.const 67
    call $assert_eq_i32
    i32.const 4096
    i32.const 5
    global.get $TRACE_RENDER_COMMAND_STYLE_VALUE_OFFSET
    call $command_field
    global.get $TRACE_RENDER_ROLE_INCOMPLETE_FILL
    i32.const 68
    call $assert_eq_i32
    i32.const 4096
    i32.const 7
    global.get $TRACE_RENDER_COMMAND_STYLE_VALUE_OFFSET
    call $command_field
    global.get $TRACE_RENDER_ROLE_UNKNOWN_FILL
    i32.const 69
    call $assert_eq_i32
  )

  (func (export "test_trace_render_command_buffer_edge_guards")
    ;; Command cap 0 forces the overflow path before any command is written.
    i32.const 4096 ;; command ptr
    i32.const 0 ;; command cap
    i32.const 2048 ;; row ptr
    i32.const 0 ;; row count
    i32.const 3072 ;; incomplete ptr
    i32.const 0 ;; incomplete count
    i32.const 0 ;; viewport start
    i32.const 100 ;; viewport end
    i32.const 100 ;; covered end
    i32.const 320 ;; canvas width
    i32.const 160 ;; canvas height
    global.get $TRACE_RENDER_DEFAULT_LANE_HEIGHT
    global.get $TRACE_RENDER_DEFAULT_LANE_GAP
    global.get $TRACE_RENDER_DEFAULT_TRACE_TOP
    global.get $TRACE_RENDER_DEFAULT_BAND_PADDING
    i32.const 0 ;; ingest active
    global.get $TRACE_RENDER_DEFAULT_PARTIAL_HATCH_SPACING
    global.get $TRACE_RENDER_DEFAULT_UNKNOWN_AFFORDANCE_WIDTH
    global.get $TRACE_RENDER_DEFAULT_UNKNOWN_STRIPE_SPACING
    global.get $TRACE_RENDER_DEFAULT_INCOMPLETE_QUERY_STRIPE_SPACING
    call $trace_render_commands_begin
    i32.const 0
    i32.const 71
    call $assert_eq_i32

    call $trace_render_commands_overflow
    i32.const 1
    i32.const 72
    call $assert_eq_i32

    ;; Zero canvas width covers clear/fill width guards.
    i32.const 4096
    i32.const 8
    i32.const 2048
    i32.const 0
    i32.const 3072
    i32.const 0
    i32.const 0
    i32.const 100
    i32.const 100
    i32.const 0 ;; canvas width
    i32.const 160
    global.get $TRACE_RENDER_DEFAULT_LANE_HEIGHT
    global.get $TRACE_RENDER_DEFAULT_LANE_GAP
    global.get $TRACE_RENDER_DEFAULT_TRACE_TOP
    global.get $TRACE_RENDER_DEFAULT_BAND_PADDING
    i32.const 0
    global.get $TRACE_RENDER_DEFAULT_PARTIAL_HATCH_SPACING
    global.get $TRACE_RENDER_DEFAULT_UNKNOWN_AFFORDANCE_WIDTH
    global.get $TRACE_RENDER_DEFAULT_UNKNOWN_STRIPE_SPACING
    global.get $TRACE_RENDER_DEFAULT_INCOMPLETE_QUERY_STRIPE_SPACING
    call $trace_render_commands_begin
    i32.const 0
    i32.const 73
    call $assert_eq_i32

    ;; Zero canvas height covers clear/fill height guards.
    i32.const 4096
    i32.const 8
    i32.const 2048
    i32.const 0
    i32.const 3072
    i32.const 0
    i32.const 0
    i32.const 100
    i32.const 100
    i32.const 320
    i32.const 0 ;; canvas height
    global.get $TRACE_RENDER_DEFAULT_LANE_HEIGHT
    global.get $TRACE_RENDER_DEFAULT_LANE_GAP
    global.get $TRACE_RENDER_DEFAULT_TRACE_TOP
    global.get $TRACE_RENDER_DEFAULT_BAND_PADDING
    i32.const 0
    global.get $TRACE_RENDER_DEFAULT_PARTIAL_HATCH_SPACING
    global.get $TRACE_RENDER_DEFAULT_UNKNOWN_AFFORDANCE_WIDTH
    global.get $TRACE_RENDER_DEFAULT_UNKNOWN_STRIPE_SPACING
    global.get $TRACE_RENDER_DEFAULT_INCOMPLETE_QUERY_STRIPE_SPACING
    call $trace_render_commands_begin
    i32.const 0
    i32.const 74
    call $assert_eq_i32

    ;; A non-partial row without RGB color emits the default-slice role.
    i32.const 5120
    i32.const 0
    global.get $INDEX_QUERY_RESULT_START_OFFSET
    i32.const 10
    call $store_row_field
    i32.const 5120
    i32.const 0
    global.get $INDEX_QUERY_RESULT_DUR_OFFSET
    i32.const 20
    call $store_row_field
    i32.const 5120
    i32.const 0
    global.get $INDEX_QUERY_RESULT_DEPTH_OFFSET
    i32.const 0
    call $store_row_field
    i32.const 5120
    i32.const 0
    global.get $INDEX_QUERY_RESULT_COLOR_OFFSET
    i32.const 0
    call $store_row_field
    i32.const 5120
    i32.const 0
    global.get $INDEX_QUERY_RESULT_PARTIAL_OFFSET
    i32.const 0
    call $store_row_field

    i32.const 4096
    i32.const 8
    i32.const 5120
    i32.const 1
    i32.const 3072
    i32.const 0
    i32.const 0
    i32.const 100
    i32.const 100
    i32.const 320
    i32.const 160
    global.get $TRACE_RENDER_DEFAULT_LANE_HEIGHT
    global.get $TRACE_RENDER_DEFAULT_LANE_GAP
    global.get $TRACE_RENDER_DEFAULT_TRACE_TOP
    global.get $TRACE_RENDER_DEFAULT_BAND_PADDING
    i32.const 0
    global.get $TRACE_RENDER_DEFAULT_PARTIAL_HATCH_SPACING
    global.get $TRACE_RENDER_DEFAULT_UNKNOWN_AFFORDANCE_WIDTH
    global.get $TRACE_RENDER_DEFAULT_UNKNOWN_STRIPE_SPACING
    global.get $TRACE_RENDER_DEFAULT_INCOMPLETE_QUERY_STRIPE_SPACING
    call $trace_render_commands_begin
    i32.const 3
    i32.const 75
    call $assert_eq_i32

    i32.const 4096
    i32.const 2
    global.get $TRACE_RENDER_COMMAND_STYLE_VALUE_OFFSET
    call $command_field
    global.get $TRACE_RENDER_ROLE_DEFAULT_SLICE
    i32.const 76
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
