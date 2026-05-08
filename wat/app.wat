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

  (func $ok (result i32)
    i32.const 0
  )

  (func (export "interactive_ingest_expect_renderer_preload")
    (param $import_count i32)
    (param $renderer_created i32)
    (result i32)
    local.get $import_count
    i32.const 1
    i32.ne
    if (result i32)
      i32.const 1
    else
      local.get $renderer_created
      if (result i32)
        i32.const 2
      else
        call $ok
      end
    end
  )

  (func (export "interactive_ingest_expect_worker_start")
    (param $start_posted i32)
    (param $source_from_file i32)
    (param $index_created i32)
    (result i32)
    local.get $start_posted
    i32.eqz
    if (result i32)
      i32.const 3
    else
      local.get $source_from_file
      i32.eqz
      if (result i32)
        i32.const 4
      else
        local.get $index_created
        i32.eqz
        if (result i32)
          i32.const 5
        else
          call $ok
        end
      end
    end
  )

  (func (export "interactive_ingest_expect_first_events")
    (param $first_draw_at i32)
    (param $query_count i32)
    (result i32)
    local.get $first_draw_at
    i32.const 0
    i32.lt_s
    if (result i32)
      i32.const 6
    else
      local.get $first_draw_at
      i32.const 100
      i32.gt_s
      if (result i32)
        i32.const 7
      else
        local.get $query_count
        i32.eqz
        if (result i32)
          i32.const 8
        else
          call $ok
        end
      end
    end
  )

  (func (export "interactive_ingest_expect_covered_partial_unknown")
    (param $covered_end i32)
    (param $last_query_ts_max i32)
    (param $unknown_pending i32)
    (param $partial_seen i32)
    (param $unknown_seen i32)
    (result i32)
    local.get $covered_end
    i32.const 1000
    i32.ne
    if (result i32)
      i32.const 9
    else
      local.get $last_query_ts_max
      local.get $covered_end
      i32.gt_s
      if (result i32)
        i32.const 10
      else
        local.get $unknown_pending
        i32.eqz
        if (result i32)
          i32.const 11
        else
          local.get $partial_seen
          i32.eqz
          if (result i32)
            i32.const 12
          else
            local.get $unknown_seen
            i32.eqz
            if (result i32)
              i32.const 13
            else
              call $ok
            end
          end
        end
      end
    end
  )

  (func (export "interactive_ingest_expect_zoom_clamped")
    (param $user_interacted i32)
    (param $viewport_start f64)
    (param $viewport_end f64)
    (param $covered_start f64)
    (param $covered_end f64)
    (result i32)
    local.get $user_interacted
    i32.eqz
    if (result i32)
      i32.const 14
    else
      local.get $viewport_start
      local.get $covered_start
      f64.lt
      if (result i32)
        i32.const 15
      else
        local.get $viewport_end
        local.get $covered_end
        f64.gt
        if (result i32)
          i32.const 16
        else
          call $ok
        end
      end
    end
  )

  (func (export "interactive_ingest_expect_pan_clamped")
    (param $viewport_end f64)
    (param $covered_end f64)
    (param $last_query_ts_max f64)
    (result i32)
    local.get $viewport_end
    local.get $covered_end
    f64.ne
    if (result i32)
      i32.const 17
    else
      local.get $last_query_ts_max
      local.get $covered_end
      f64.gt
      if (result i32)
        i32.const 18
      else
        call $ok
      end
    end
  )

  (func (export "interactive_ingest_expect_progress_eta")
    (param $file_offset i32)
    (param $expected_offset i32)
    (param $early_eta_hidden i32)
    (param $stable_eta_visible i32)
    (result i32)
    local.get $file_offset
    local.get $expected_offset
    i32.ne
    if (result i32)
      i32.const 19
    else
      local.get $early_eta_hidden
      i32.eqz
      if (result i32)
        i32.const 20
      else
        local.get $stable_eta_visible
        i32.eqz
        if (result i32)
          i32.const 21
        else
          call $ok
        end
      end
    end
  )

  (func (export "interactive_ingest_expect_frame_interval")
    (param $interval f64)
    (param $budget f64)
    (result i32)
    local.get $interval
    local.get $budget
    f64.gt
    if (result i32)
      i32.const 22
    else
      call $ok
    end
  )
)
