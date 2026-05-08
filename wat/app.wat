(module
  ;; @thread main
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

  (func (export "tracy_main"))
  (func (export "tracy_tick"))

  (global $TRACE_RENDER_OP_END i32 (i32.const 0))
  (global $TRACE_RENDER_OP_QUERY_RANGE i32 (i32.const 1))
  (global $TRACE_RENDER_OP_INCOMPLETE_QUERY_RANGE i32 (i32.const 2))
  (global $trace_render_plan_viewport_start (mut f64) (f64.const 0))
  (global $trace_render_plan_viewport_end (mut f64) (f64.const 0))
  (global $trace_render_plan_tile_span (mut f64) (f64.const 1))
  (global $trace_render_plan_track_count (mut i32) (i32.const 0))
  (global $trace_render_plan_query_budget (mut i32) (i32.const 0))
  (global $trace_render_plan_query_count (mut i32) (i32.const 0))
  (global $trace_render_plan_current_track (mut i32) (i32.const 0))
  (global $trace_render_plan_current_start (mut f64) (f64.const 0))
  (global $trace_render_plan_skip_track (mut i32) (i32.const 0))
  (global $trace_render_plan_skipped_start (mut f64) (f64.const 0))
  (global $trace_render_plan_op_track_id (mut i32) (i32.const 0))
  (global $trace_render_plan_op_start (mut f64) (f64.const 0))
  (global $trace_render_plan_op_end (mut f64) (f64.const 0))

  (func $trace_render_query_ranges_per_track (export "trace_render_query_ranges_per_track")
    (param $query_range_budget i32)
    (param $track_count i32)
    (result i32)
    local.get $track_count
    i32.eqz
    if (result i32)
      i32.const 1
    else
      local.get $query_range_budget
      local.get $track_count
      i32.div_u
      i32.const 1
      i32.max
    end)

  (func $trace_render_query_tile_span (export "trace_render_query_tile_span")
    (param $viewport_span f64)
    (param $query_window f64)
    (param $ranges_per_track i32)
    (result f64)
    local.get $viewport_span
    local.get $ranges_per_track
    f64.convert_i32_u
    f64.div
    f64.ceil
    local.get $query_window
    f64.max
    f64.const 1
    f64.max)

  (func $trace_render_slice_x (export "trace_render_slice_x")
    (param $slice_start f64)
    (param $viewport_start f64)
    (param $viewport_span f64)
    (param $canvas_width f64)
    (result f64)
    f64.const 0
    local.get $slice_start
    local.get $viewport_start
    f64.sub
    local.get $viewport_span
    f64.div
    local.get $canvas_width
    f64.mul
    f64.max)

  (func $trace_render_slice_end_x (export "trace_render_slice_end_x")
    (param $slice_end f64)
    (param $viewport_start f64)
    (param $viewport_span f64)
    (param $canvas_width f64)
    (result f64)
    local.get $canvas_width
    local.get $slice_end
    local.get $viewport_start
    f64.sub
    local.get $viewport_span
    f64.div
    local.get $canvas_width
    f64.mul
    f64.min)

  (func $trace_render_slice_y (export "trace_render_slice_y")
    (param $depth f64)
    (param $top f64)
    (param $lane_height f64)
    (param $lane_gap f64)
    (result f64)
    local.get $top
    local.get $depth
    local.get $lane_height
    local.get $lane_gap
    f64.add
    f64.mul
    f64.add)

  (func (export "trace_render_plan_begin")
    (param $viewport_start f64)
    (param $viewport_end f64)
    (param $track_count i32)
    (param $query_range_budget i32)
    (param $query_window f64)
    global.get $trace_render_plan_viewport_start
    drop
    local.get $viewport_start
    global.set $trace_render_plan_viewport_start
    local.get $viewport_end
    global.set $trace_render_plan_viewport_end
    local.get $track_count
    global.set $trace_render_plan_track_count
    local.get $query_range_budget
    global.set $trace_render_plan_query_budget
    i32.const 0
    global.set $trace_render_plan_query_count
    i32.const 0
    global.set $trace_render_plan_current_track
    local.get $viewport_start
    global.set $trace_render_plan_current_start
    local.get $track_count
    global.set $trace_render_plan_skip_track
    local.get $viewport_start
    global.set $trace_render_plan_skipped_start
    local.get $viewport_end
    local.get $viewport_start
    f64.sub
    local.get $query_window
    local.get $query_range_budget
    local.get $track_count
    call $trace_render_query_ranges_per_track
    call $trace_render_query_tile_span
    global.set $trace_render_plan_tile_span)

  (func (export "trace_render_plan_next")
    (result i32)
    (local $query_end f64)
    block $done
      loop $again
        global.get $trace_render_plan_skip_track
        global.get $trace_render_plan_track_count
        i32.lt_u
        if
          global.get $trace_render_plan_skip_track
          global.set $trace_render_plan_op_track_id
          global.get $trace_render_plan_skipped_start
          global.set $trace_render_plan_op_start
          global.get $trace_render_plan_viewport_end
          global.set $trace_render_plan_op_end
          global.get $trace_render_plan_skip_track
          i32.const 1
          i32.add
          global.set $trace_render_plan_skip_track
          global.get $TRACE_RENDER_OP_INCOMPLETE_QUERY_RANGE
          return
        end

        global.get $trace_render_plan_current_track
        global.get $trace_render_plan_track_count
        i32.ge_u
        if
          br $done
        end

        global.get $trace_render_plan_current_start
        global.get $trace_render_plan_viewport_end
        f64.ge
        if
          global.get $trace_render_plan_current_track
          i32.const 1
          i32.add
          global.set $trace_render_plan_current_track
          global.get $trace_render_plan_viewport_start
          global.set $trace_render_plan_current_start
          br $again
        end

        global.get $trace_render_plan_query_count
        global.get $trace_render_plan_query_budget
        i32.ge_u
        if
          global.get $trace_render_plan_current_track
          global.set $trace_render_plan_op_track_id
          global.get $trace_render_plan_current_start
          global.set $trace_render_plan_op_start
          global.get $trace_render_plan_current_start
          global.set $trace_render_plan_skipped_start
          global.get $trace_render_plan_viewport_end
          global.set $trace_render_plan_op_end
          global.get $trace_render_plan_current_track
          i32.const 1
          i32.add
          global.set $trace_render_plan_skip_track
          global.get $trace_render_plan_track_count
          global.set $trace_render_plan_current_track
          global.get $TRACE_RENDER_OP_INCOMPLETE_QUERY_RANGE
          return
        end

        global.get $trace_render_plan_current_start
        global.get $trace_render_plan_tile_span
        f64.add
        global.get $trace_render_plan_viewport_end
        f64.min
        local.set $query_end
        global.get $trace_render_plan_current_track
        global.set $trace_render_plan_op_track_id
        global.get $trace_render_plan_current_start
        global.set $trace_render_plan_op_start
        local.get $query_end
        global.set $trace_render_plan_op_end
        local.get $query_end
        global.set $trace_render_plan_current_start
        global.get $trace_render_plan_query_count
        i32.const 1
        i32.add
        global.set $trace_render_plan_query_count
        global.get $TRACE_RENDER_OP_QUERY_RANGE
        return
      end
    end
    global.get $TRACE_RENDER_OP_END)

  (func (export "trace_render_plan_op_track_id")
    (result i32)
    global.get $trace_render_plan_op_track_id)

  (func (export "trace_render_plan_op_start")
    (result f64)
    global.get $trace_render_plan_op_start)

  (func (export "trace_render_plan_op_end")
    (result f64)
    global.get $trace_render_plan_op_end)
)
