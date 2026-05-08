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

  (global $TRACE_RENDER_OP_END i32 (i32.const 0))
  (global $TRACE_RENDER_OP_QUERY_RANGE i32 (i32.const 1))
  (global $TRACE_RENDER_OP_INCOMPLETE_QUERY_RANGE i32 (i32.const 2))
  (global $trace_render_viewport_start (mut i32) (i32.const 0))
  (global $trace_render_viewport_end (mut i32) (i32.const 0))
  (global $trace_render_track_count (mut i32) (i32.const 0))
  (global $trace_render_query_range_budget (mut i32) (i32.const 0))
  (global $trace_render_query_window (mut i32) (i32.const 0))
  (global $trace_render_tile_span (mut i32) (i32.const 1))
  (global $trace_render_track_id (mut i32) (i32.const 0))
  (global $trace_render_query_start (mut i32) (i32.const 0))
  (global $trace_render_query_count (mut i32) (i32.const 0))
  (global $trace_render_op_start (mut i32) (i32.const 0))
  (global $trace_render_op_end (mut i32) (i32.const 0))
  (global $trace_render_op_track_id (mut i32) (i32.const 0))

  (func $max_i32 (param $a i32) (param $b i32) (result i32)
    local.get $a
    local.get $b
    i32.gt_s
    if (result i32)
      local.get $a
    else
      local.get $b
    end
  )

  (func $min_i32 (param $a i32) (param $b i32) (result i32)
    local.get $a
    local.get $b
    i32.lt_s
    if (result i32)
      local.get $a
    else
      local.get $b
    end
  )

  (func $trace_render_query_ranges_per_track (export "trace_render_query_ranges_per_track")
    (param $query_range_budget i32)
    (param $track_count i32)
    (result i32)
    local.get $track_count
    i32.eqz
    if
      i32.const 1
      return
    end

    i32.const 1
    local.get $query_range_budget
    local.get $track_count
    i32.div_u
    call $max_i32
  )

  (func $trace_render_query_tile_span (export "trace_render_query_tile_span")
    (param $viewport_span i32)
    (param $query_window i32)
    (param $ranges_per_track i32)
    (result i32)
    (local $range_span i32)

    local.get $ranges_per_track
    i32.eqz
    if
      i32.const 1
      local.set $ranges_per_track
    end

    local.get $viewport_span
    local.get $ranges_per_track
    i32.add
    i32.const 1
    i32.sub
    local.get $ranges_per_track
    i32.div_u
    local.set $range_span

    i32.const 1
    local.get $query_window
    local.get $range_span
    call $max_i32
    call $max_i32
  )

  (func $trace_render_plan_begin (export "trace_render_plan_begin")
    (param $viewport_start i32)
    (param $viewport_end i32)
    (param $track_count i32)
    (param $query_range_budget i32)
    (param $query_window i32)
    (local $ranges_per_track i32)

    local.get $viewport_start
    global.set $trace_render_viewport_start
    local.get $viewport_end
    global.set $trace_render_viewport_end
    local.get $track_count
    global.set $trace_render_track_count
    local.get $query_range_budget
    global.set $trace_render_query_range_budget
    local.get $query_window
    global.set $trace_render_query_window
    i32.const 0
    global.set $trace_render_track_id
    local.get $viewport_start
    global.set $trace_render_query_start
    i32.const 0
    global.set $trace_render_query_count

    local.get $query_range_budget
    local.get $track_count
    call $trace_render_query_ranges_per_track
    local.set $ranges_per_track
    local.get $viewport_end
    local.get $viewport_start
    i32.sub
    local.get $query_window
    local.get $ranges_per_track
    call $trace_render_query_tile_span
    global.set $trace_render_tile_span
  )

  (func $trace_render_plan_next (export "trace_render_plan_next") (result i32)
    (local $query_end i32)

    block $done
      loop $skip_empty
        global.get $trace_render_track_id
        global.get $trace_render_track_count
        i32.ge_u
        if
          global.get $TRACE_RENDER_OP_END
          return
        end

        global.get $trace_render_query_start
        global.get $trace_render_viewport_end
        i32.lt_s
        br_if $done

        global.get $trace_render_track_id
        i32.const 1
        i32.add
        global.set $trace_render_track_id
        global.get $trace_render_viewport_start
        global.set $trace_render_query_start
        br $skip_empty
      end
    end

    global.get $trace_render_query_count
    global.get $trace_render_query_range_budget
    i32.ge_u
    if
      global.get $trace_render_query_start
      global.get $trace_render_viewport_end
      call $min_i32
      global.set $trace_render_op_start
      global.get $trace_render_viewport_end
      global.set $trace_render_op_end
      global.get $trace_render_track_id
      global.set $trace_render_op_track_id

      global.get $trace_render_track_id
      i32.const 1
      i32.add
      global.set $trace_render_track_id
      global.get $trace_render_viewport_start
      global.set $trace_render_query_start
      global.get $TRACE_RENDER_OP_INCOMPLETE_QUERY_RANGE
      return
    end

    global.get $trace_render_query_start
    global.get $trace_render_tile_span
    i32.add
    global.get $trace_render_viewport_end
    call $min_i32
    local.set $query_end

    global.get $trace_render_query_start
    global.set $trace_render_op_start
    local.get $query_end
    global.set $trace_render_op_end
    global.get $trace_render_track_id
    global.set $trace_render_op_track_id

    local.get $query_end
    global.set $trace_render_query_start
    global.get $trace_render_query_count
    i32.const 1
    i32.add
    global.set $trace_render_query_count
    global.get $TRACE_RENDER_OP_QUERY_RANGE
  )

  (func $trace_render_plan_op_start (export "trace_render_plan_op_start") (result i32)
    global.get $trace_render_op_start
  )

  (func $trace_render_plan_op_end (export "trace_render_plan_op_end") (result i32)
    global.get $trace_render_op_end
  )

  (func $trace_render_plan_op_track_id (export "trace_render_plan_op_track_id") (result i32)
    global.get $trace_render_op_track_id
  )

  (func $trace_render_slice_x (export "trace_render_slice_x")
    (param $slice_start i32)
    (param $viewport_start i32)
    (param $viewport_span i32)
    (param $canvas_width i32)
    (result i32)
    local.get $viewport_span
    i32.eqz
    if
      i32.const 0
      return
    end

    local.get $slice_start
    local.get $viewport_start
    i32.sub
    local.get $canvas_width
    i32.mul
    local.get $viewport_span
    i32.div_s
  )

  (func $trace_render_slice_end_x (export "trace_render_slice_end_x")
    (param $slice_end i32)
    (param $viewport_start i32)
    (param $viewport_span i32)
    (param $canvas_width i32)
    (result i32)
    local.get $slice_end
    local.get $viewport_start
    local.get $viewport_span
    local.get $canvas_width
    call $trace_render_slice_x
  )

  (func $trace_render_slice_y (export "trace_render_slice_y")
    (param $depth i32)
    (param $top i32)
    (param $lane_height i32)
    (param $lane_gap i32)
    (result i32)
    local.get $top
    local.get $depth
    local.get $lane_height
    local.get $lane_gap
    i32.add
    i32.mul
    i32.add
  )

  (func (export "tracy_main"))
  (func (export "tracy_tick"))
)
