(module
  ;; @thread main
  (import "env" "memory" (memory $memory 1 32768))
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

  ;; @include trace-renderer-abi.wat.inc
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
  (global $trace_render_command_ptr (mut i32) (i32.const 0))
  (global $trace_render_command_cap (mut i32) (i32.const 0))
  (global $trace_render_command_count (mut i32) (i32.const 0))
  (global $trace_render_command_overflow (mut i32) (i32.const 0))

  ;; Trace rendering uses a command-buffer boundary: Wasm decides what to draw,
  ;; JS only interprets compact Canvas2D opcodes. Keep this shaped like a small
  ;; VM so later passes can add style registers, clipping state, and repeat/loop
  ;; opcodes instead of growing new JS-side renderer policy.

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
    (local $x i32)
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
    local.set $x

    local.get $x
    i32.const 0
    i32.lt_s
    if
      i32.const 0
      return
    end

    local.get $x
    local.get $canvas_width
    i32.gt_s
    if
      local.get $canvas_width
      return
    end

    local.get $x
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

  (func $trace_render_range_x (export "trace_render_range_x")
    (param $range_start i32)
    (param $range_end i32)
    (param $viewport_start i32)
    (param $viewport_span i32)
    (param $canvas_width i32)
    (result i32)
    (local $viewport_end i32)
    (local $clipped_start i32)

    local.get $viewport_start
    local.get $viewport_span
    i32.add
    local.set $viewport_end

    local.get $range_start
    local.get $viewport_start
    call $max_i32
    local.get $viewport_end
    call $min_i32
    local.set $clipped_start

    local.get $clipped_start
    local.get $viewport_start
    local.get $viewport_span
    local.get $canvas_width
    call $trace_render_slice_x
  )

  (func $trace_render_range_width (export "trace_render_range_width")
    (param $range_start i32)
    (param $range_end i32)
    (param $viewport_start i32)
    (param $viewport_span i32)
    (param $canvas_width i32)
    (result i32)
    (local $viewport_end i32)
    (local $clipped_start i32)
    (local $clipped_end i32)
    (local $x i32)
    (local $end_x i32)
    (local $width i32)

    local.get $viewport_start
    local.get $viewport_span
    i32.add
    local.set $viewport_end

    local.get $range_start
    local.get $viewport_start
    call $max_i32
    local.set $clipped_start

    local.get $range_end
    local.get $viewport_end
    call $min_i32
    local.set $clipped_end

    local.get $clipped_end
    local.get $clipped_start
    i32.le_s
    if
      i32.const 0
      return
    end

    local.get $clipped_start
    local.get $viewport_start
    local.get $viewport_span
    local.get $canvas_width
    call $trace_render_slice_x
    local.set $x

    local.get $clipped_end
    local.get $viewport_start
    local.get $viewport_span
    local.get $canvas_width
    call $trace_render_slice_x
    local.set $end_x

    local.get $end_x
    local.get $x
    i32.sub
    local.set $width

    local.get $width
    i32.const 0
    i32.le_s
    if
      i32.const 1
      return
    end

    local.get $width
  )

  (func $trace_render_unknown_width (export "trace_render_unknown_width")
    (param $canvas_width i32)
    (param $affordance_width i32)
    (result i32)
    local.get $canvas_width
    i32.const 0
    i32.le_s
    if
      i32.const 0
      return
    end

    local.get $affordance_width
    i32.const 0
    i32.le_s
    if
      i32.const 0
      return
    end

    local.get $canvas_width
    local.get $affordance_width
    call $min_i32
  )

  (func $trace_render_unknown_x (export "trace_render_unknown_x")
    (param $canvas_width i32)
    (param $affordance_width i32)
    (result i32)
    (local $width i32)
    local.get $canvas_width
    local.get $affordance_width
    call $trace_render_unknown_width
    local.set $width

    local.get $canvas_width
    local.get $width
    i32.sub
    i32.const 0
    call $max_i32
  )

  (func $trace_render_stripe_start (export "trace_render_stripe_start")
    (param $x i32)
    (param $height i32)
    (result i32)
    local.get $x
    local.get $height
    i32.sub
  )

  (func $trace_render_stripe_end (export "trace_render_stripe_end")
    (param $x i32)
    (param $width i32)
    (param $height i32)
    (result i32)
    local.get $x
    local.get $width
    i32.add
    local.get $height
    i32.add
  )

  (func $trace_render_row_field
    (param $row_ptr i32)
    (param $row_index i32)
    (param $offset i32)
    (result i32)
    local.get $row_ptr
    local.get $row_index
    global.get $INDEX_QUERY_RESULT_BYTES
    i32.mul
    i32.add
    local.get $offset
    i32.add
    i32.load
  )

  (func $trace_render_range_field
    (param $range_ptr i32)
    (param $range_index i32)
    (param $offset i32)
    (result i32)
    local.get $range_ptr
    local.get $range_index
    global.get $TRACE_RENDER_INCOMPLETE_RANGE_BYTES
    i32.mul
    i32.add
    local.get $offset
    i32.add
    i32.load
  )

  (func $trace_render_copy_query_row
    (param $source_ptr i32)
    (param $dest_ptr i32)
    (local $offset i32)

    i32.const 0
    local.set $offset
    block $done
      loop $fields
        local.get $offset
        global.get $INDEX_QUERY_RESULT_BYTES
        i32.ge_u
        br_if $done

        local.get $dest_ptr
        local.get $offset
        i32.add
        local.get $source_ptr
        local.get $offset
        i32.add
        i32.load
        i32.store

        local.get $offset
        i32.const 4
        i32.add
        local.set $offset
        br $fields
      end
    end
  )

  (func $trace_render_append_query_rows (export "trace_render_append_query_rows")
    (param $source_ptr i32)
    (param $source_count i32)
    (param $dest_ptr i32)
    (param $dest_count i32)
    (param $dest_cap i32)
    (result i32)
    (local $copied i32)

    i32.const 0
    local.set $copied
    block $done
      loop $rows
        local.get $copied
        local.get $source_count
        i32.ge_u
        br_if $done
        local.get $dest_count
        local.get $copied
        i32.add
        local.get $dest_cap
        i32.ge_u
        br_if $done

        local.get $source_ptr
        local.get $copied
        global.get $INDEX_QUERY_RESULT_BYTES
        i32.mul
        i32.add
        local.get $dest_ptr
        local.get $dest_count
        local.get $copied
        i32.add
        global.get $INDEX_QUERY_RESULT_BYTES
        i32.mul
        i32.add
        call $trace_render_copy_query_row

        local.get $copied
        i32.const 1
        i32.add
        local.set $copied
        br $rows
      end
    end

    local.get $copied
  )

  (func $trace_render_emit_command
    (param $tag i32)
    (param $style_kind i32)
    (param $style_value i32)
    (param $x i32)
    (param $y i32)
    (param $width i32)
    (param $height i32)
    (param $x2 i32)
    (param $y2 i32)
    (local $ptr i32)

    global.get $trace_render_command_count
    global.get $trace_render_command_cap
    i32.ge_u
    if
      i32.const 1
      global.set $trace_render_command_overflow
      return
    end

    global.get $trace_render_command_ptr
    global.get $trace_render_command_count
    global.get $TRACE_RENDER_COMMAND_BYTES
    i32.mul
    i32.add
    local.set $ptr

    local.get $ptr
    global.get $TRACE_RENDER_COMMAND_TAG_OFFSET
    i32.add
    local.get $tag
    i32.store
    local.get $ptr
    global.get $TRACE_RENDER_COMMAND_STYLE_KIND_OFFSET
    i32.add
    local.get $style_kind
    i32.store
    local.get $ptr
    global.get $TRACE_RENDER_COMMAND_STYLE_VALUE_OFFSET
    i32.add
    local.get $style_value
    i32.store
    local.get $ptr
    global.get $TRACE_RENDER_COMMAND_X_OFFSET
    i32.add
    local.get $x
    i32.store
    local.get $ptr
    global.get $TRACE_RENDER_COMMAND_Y_OFFSET
    i32.add
    local.get $y
    i32.store
    local.get $ptr
    global.get $TRACE_RENDER_COMMAND_WIDTH_OFFSET
    i32.add
    local.get $width
    i32.store
    local.get $ptr
    global.get $TRACE_RENDER_COMMAND_HEIGHT_OFFSET
    i32.add
    local.get $height
    i32.store
    local.get $ptr
    global.get $TRACE_RENDER_COMMAND_X2_OFFSET
    i32.add
    local.get $x2
    i32.store
    local.get $ptr
    global.get $TRACE_RENDER_COMMAND_Y2_OFFSET
    i32.add
    local.get $y2
    i32.store

    global.get $trace_render_command_count
    i32.const 1
    i32.add
    global.set $trace_render_command_count
  )

  (func $trace_render_emit_fill_rect
    (param $style_kind i32)
    (param $style_value i32)
    (param $x i32)
    (param $y i32)
    (param $width i32)
    (param $height i32)
    local.get $width
    i32.const 0
    i32.le_s
    if
      return
    end
    local.get $height
    i32.const 0
    i32.le_s
    if
      return
    end

    global.get $TRACE_RENDER_COMMAND_FILL_RECT
    local.get $style_kind
    local.get $style_value
    local.get $x
    local.get $y
    local.get $width
    local.get $height
    i32.const 0
    i32.const 0
    call $trace_render_emit_command
  )

  (func $trace_render_emit_clear_rect
    (param $x i32)
    (param $y i32)
    (param $width i32)
    (param $height i32)
    local.get $width
    i32.const 0
    i32.le_s
    if
      return
    end
    local.get $height
    i32.const 0
    i32.le_s
    if
      return
    end

    global.get $TRACE_RENDER_COMMAND_CLEAR_RECT
    i32.const 0
    i32.const 0
    local.get $x
    local.get $y
    local.get $width
    local.get $height
    i32.const 0
    i32.const 0
    call $trace_render_emit_command
  )

  (func $trace_render_emit_hatches
    (param $x i32)
    (param $y i32)
    (param $width i32)
    (param $height i32)
    (param $spacing i32)
    (param $style_value i32)
    local.get $spacing
    i32.const 1
    call $max_i32
    local.set $spacing

    global.get $TRACE_RENDER_COMMAND_HATCH_RECT
    global.get $TRACE_RENDER_STYLE_ROLE
    local.get $style_value
    local.get $x
    local.get $y
    local.get $width
    local.get $height
    local.get $spacing
    i32.const 0
    call $trace_render_emit_command
  )

  (func $trace_render_commands_overflow (export "trace_render_commands_overflow")
    (result i32)
    global.get $trace_render_command_overflow
  )

  (func $trace_render_commands_begin (export "trace_render_commands_begin")
    (param $command_ptr i32)
    (param $command_cap i32)
    (param $row_ptr i32)
    (param $row_count i32)
    (param $incomplete_ptr i32)
    (param $incomplete_count i32)
    (param $viewport_start i32)
    (param $viewport_end i32)
    (param $covered_end i32)
    (param $canvas_width i32)
    (param $canvas_height i32)
    (param $lane_height i32)
    (param $lane_gap i32)
    (param $top i32)
    (param $band_padding i32)
    (param $ingest_active i32)
    (param $partial_hatch_spacing i32)
    (param $unknown_affordance_width i32)
    (param $unknown_stripe_spacing i32)
    (param $incomplete_stripe_spacing i32)
    (result i32)
    (local $viewport_span i32)
    (local $i i32)
    (local $max_depth i32)
    (local $band_height i32)
    (local $row_start i32)
    (local $row_dur i32)
    (local $row_depth i32)
    (local $row_color i32)
    (local $row_partial i32)
    (local $slice_end i32)
    (local $x i32)
    (local $end_x i32)
    (local $width i32)
    (local $y i32)
    (local $range_start i32)
    (local $range_end i32)

    local.get $command_ptr
    global.set $trace_render_command_ptr
    local.get $command_cap
    global.set $trace_render_command_cap
    i32.const 0
    global.set $trace_render_command_count
    i32.const 0
    global.set $trace_render_command_overflow

    local.get $viewport_end
    local.get $viewport_start
    i32.sub
    i32.const 1
    call $max_i32
    local.set $viewport_span

    i32.const 0
    local.set $max_depth
    i32.const 0
    local.set $i
    block $depth_done
      loop $depth_loop
        local.get $i
        local.get $row_count
        i32.ge_u
        br_if $depth_done

        local.get $row_ptr
        local.get $i
        global.get $INDEX_QUERY_RESULT_DEPTH_OFFSET
        call $trace_render_row_field
        local.get $max_depth
        call $max_i32
        local.set $max_depth

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $depth_loop
      end
    end

    local.get $top
    local.get $max_depth
    i32.const 1
    i32.add
    local.get $lane_height
    local.get $lane_gap
    i32.add
    i32.mul
    i32.add
    local.get $band_padding
    i32.add
    local.get $canvas_height
    call $min_i32
    local.set $band_height

    i32.const 0
    i32.const 0
    local.get $canvas_width
    local.get $band_height
    call $trace_render_emit_clear_rect

    global.get $TRACE_RENDER_STYLE_ROLE
    global.get $TRACE_RENDER_ROLE_BACKGROUND
    i32.const 0
    i32.const 0
    local.get $canvas_width
    local.get $band_height
    call $trace_render_emit_fill_rect

    i32.const 0
    local.set $i
    block $rows_done
      loop $rows
        local.get $i
        local.get $row_count
        i32.ge_u
        br_if $rows_done

        local.get $row_ptr
        local.get $i
        global.get $INDEX_QUERY_RESULT_START_OFFSET
        call $trace_render_row_field
        local.set $row_start
        local.get $row_ptr
        local.get $i
        global.get $INDEX_QUERY_RESULT_DUR_OFFSET
        call $trace_render_row_field
        i32.const 1
        call $max_i32
        local.set $row_dur
        local.get $row_ptr
        local.get $i
        global.get $INDEX_QUERY_RESULT_DEPTH_OFFSET
        call $trace_render_row_field
        local.set $row_depth
        local.get $row_ptr
        local.get $i
        global.get $INDEX_QUERY_RESULT_COLOR_OFFSET
        call $trace_render_row_field
        local.set $row_color
        local.get $row_ptr
        local.get $i
        global.get $INDEX_QUERY_RESULT_PARTIAL_OFFSET
        call $trace_render_row_field
        local.set $row_partial

        local.get $row_start
        local.get $row_dur
        i32.add
        local.get $viewport_end
        call $min_i32
        local.set $slice_end
        local.get $row_start
        local.get $viewport_start
        local.get $viewport_span
        local.get $canvas_width
        call $trace_render_slice_x
        local.set $x
        local.get $slice_end
        local.get $viewport_start
        local.get $viewport_span
        local.get $canvas_width
        call $trace_render_slice_end_x
        local.set $end_x
        local.get $end_x
        local.get $x
        i32.sub
        i32.const 1
        call $max_i32
        local.set $width
        local.get $row_depth
        local.get $top
        local.get $lane_height
        local.get $lane_gap
        call $trace_render_slice_y
        local.set $y

        local.get $row_partial
        i32.const 0
        i32.ne
        local.get $ingest_active
        i32.const 0
        i32.ne
        i32.and
        if
          global.get $TRACE_RENDER_STYLE_ROLE
          global.get $TRACE_RENDER_ROLE_PARTIAL_SLICE
          local.get $x
          local.get $y
          local.get $width
          local.get $lane_height
          call $trace_render_emit_fill_rect

          local.get $x
          local.get $y
          local.get $width
          local.get $lane_height
          local.get $partial_hatch_spacing
          global.get $TRACE_RENDER_ROLE_PARTIAL_HATCH
          call $trace_render_emit_hatches
        else
          local.get $row_color
          i32.eqz
          if
            global.get $TRACE_RENDER_STYLE_ROLE
            global.get $TRACE_RENDER_ROLE_DEFAULT_SLICE
            local.get $x
            local.get $y
            local.get $width
            local.get $lane_height
            call $trace_render_emit_fill_rect
          else
            global.get $TRACE_RENDER_STYLE_RGB
            local.get $row_color
            local.get $x
            local.get $y
            local.get $width
            local.get $lane_height
            call $trace_render_emit_fill_rect
          end
        end

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $rows
      end
    end

    i32.const 0
    local.set $i
    block $incomplete_done
      loop $incomplete
        local.get $i
        local.get $incomplete_count
        i32.ge_u
        br_if $incomplete_done

        local.get $incomplete_ptr
        local.get $i
        global.get $TRACE_RENDER_INCOMPLETE_RANGE_START_OFFSET
        call $trace_render_range_field
        local.set $range_start
        local.get $incomplete_ptr
        local.get $i
        global.get $TRACE_RENDER_INCOMPLETE_RANGE_END_OFFSET
        call $trace_render_range_field
        local.set $range_end

        local.get $range_start
        local.get $range_end
        local.get $viewport_start
        local.get $viewport_span
        local.get $canvas_width
        call $trace_render_range_width
        local.set $width

        local.get $width
        i32.const 0
        i32.gt_s
        if
          local.get $range_start
          local.get $range_end
          local.get $viewport_start
          local.get $viewport_span
          local.get $canvas_width
          call $trace_render_range_x
          local.set $x

          global.get $TRACE_RENDER_STYLE_ROLE
          global.get $TRACE_RENDER_ROLE_INCOMPLETE_FILL
          local.get $x
          i32.const 0
          local.get $width
          local.get $band_height
          call $trace_render_emit_fill_rect

          local.get $x
          i32.const 0
          local.get $width
          local.get $band_height
          local.get $incomplete_stripe_spacing
          global.get $TRACE_RENDER_ROLE_INCOMPLETE_STRIPE
          call $trace_render_emit_hatches
        end

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $incomplete
      end
    end

    local.get $ingest_active
    i32.const 0
    i32.ne
    local.get $covered_end
    local.get $viewport_end
    i32.le_s
    i32.and
    if
      local.get $canvas_width
      local.get $unknown_affordance_width
      call $trace_render_unknown_width
      local.set $width

      local.get $width
      i32.const 0
      i32.gt_s
      if
        local.get $canvas_width
        local.get $unknown_affordance_width
        call $trace_render_unknown_x
        local.set $x

        global.get $TRACE_RENDER_STYLE_ROLE
        global.get $TRACE_RENDER_ROLE_UNKNOWN_FILL
        local.get $x
        i32.const 0
        local.get $width
        local.get $band_height
        call $trace_render_emit_fill_rect

        local.get $x
        i32.const 0
        local.get $width
        local.get $band_height
        local.get $unknown_stripe_spacing
        global.get $TRACE_RENDER_ROLE_UNKNOWN_STRIPE
        call $trace_render_emit_hatches
      end
    end

    global.get $trace_render_command_count
  )

  (func (export "tracy_main"))
  (func (export "tracy_tick"))
)
