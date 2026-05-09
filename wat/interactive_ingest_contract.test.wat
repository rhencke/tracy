(module
  (import "env" "memory" (memory $memory 1))
  (import "watwat" "assert_eq_i32"
    (func $assert_eq_i32 (param i32) (param i32) (param i32)))

  (data (i32.const 1024) "interactive ingest contract failed")

  (func (export "message_for") (param $code i32) (result i32 i32)
    i32.const 1024
    i32.const 34
  )

  (func $ok (result i32)
    i32.const 0
  )

  (func $interactive_ingest_expect_renderer_preload
    (export "interactive_ingest_expect_renderer_preload")
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

  (func $interactive_ingest_expect_worker_start
    (export "interactive_ingest_expect_worker_start")
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

  (func $interactive_ingest_expect_independent_memories
    (export "interactive_ingest_expect_independent_memories")
    (param $worker_memory_independent i32)
    (param $worker_host_memory_independent i32)
    (param $worker_import_memory_independent i32)
    (result i32)
    local.get $worker_memory_independent
    i32.eqz
    if (result i32)
      i32.const 28
    else
      local.get $worker_host_memory_independent
      i32.eqz
      if (result i32)
        i32.const 29
      else
        local.get $worker_import_memory_independent
        i32.eqz
        if (result i32)
          i32.const 30
        else
          call $ok
        end
      end
    end
  )

  (func $interactive_ingest_expect_first_events
    (export "interactive_ingest_expect_first_events")
    (param $first_draw_frame_at i32)
    (param $first_draw_elapsed_ms i32)
    (param $query_count i32)
    (result i32)
    local.get $first_draw_frame_at
    i32.const 0
    i32.lt_s
    if (result i32)
      i32.const 6
    else
      local.get $first_draw_frame_at
      i32.const 100
      i32.gt_s
      if (result i32)
        i32.const 7
      else
        local.get $first_draw_elapsed_ms
        i32.const 0
        i32.lt_s
        if (result i32)
          i32.const 8
        else
          local.get $first_draw_elapsed_ms
          i32.const 100
          i32.gt_s
          if (result i32)
            i32.const 9
          else
            local.get $query_count
            i32.eqz
            if (result i32)
              i32.const 10
            else
              call $ok
            end
          end
        end
      end
    end
  )

  (func $interactive_ingest_expect_covered_partial_unknown
    (export "interactive_ingest_expect_covered_partial_unknown")
    (param $covered_end i32)
    (param $last_query_ts_max i32)
    (param $unknown_pending i32)
    (param $partial_seen i32)
    (param $unknown_seen i32)
    (result i32)
    local.get $covered_end
    i32.const 1000
    i32.lt_s
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

  (func $interactive_ingest_expect_zoom_clamped
    (export "interactive_ingest_expect_zoom_clamped")
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

  (func $interactive_ingest_expect_pan_clamped
    (export "interactive_ingest_expect_pan_clamped")
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

  (func $interactive_ingest_expect_progress_eta
    (export "interactive_ingest_expect_progress_eta")
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

  (func $interactive_ingest_expect_large_trace_checkpoint
    (export "interactive_ingest_expect_large_trace_checkpoint")
    (param $file_offset i32)
    (param $total_bytes i32)
    (param $expected_offset i32)
    (param $expected_total_bytes i32)
    (param $queryable_covered i32)
    (param $content_bytes i32)
    (result i32)
    local.get $content_bytes
    local.get $expected_total_bytes
    i32.ne
    if (result i32)
      i32.const 23
    else
      local.get $total_bytes
      local.get $expected_total_bytes
      i32.ne
      if (result i32)
        i32.const 24
      else
        local.get $file_offset
        local.get $expected_offset
        i32.lt_u
        if (result i32)
          i32.const 25
        else
          local.get $file_offset
          local.get $expected_total_bytes
          i32.ge_u
          if (result i32)
            i32.const 26
          else
            local.get $queryable_covered
            i32.eqz
            if (result i32)
              i32.const 27
            else
              call $ok
            end
          end
        end
      end
    end
  )

  (func $interactive_ingest_expect_frame_interval
    (export "interactive_ingest_expect_frame_interval")
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

  (func (export "test_interactive_ingest_contract_accepts_expected_observations")
    i32.const 1
    i32.const 0
    call $interactive_ingest_expect_renderer_preload
    i32.const 0
    i32.const 1
    call $assert_eq_i32

    i32.const 1
    i32.const 1
    i32.const 1
    call $interactive_ingest_expect_worker_start
    i32.const 0
    i32.const 2
    call $assert_eq_i32

    i32.const 1
    i32.const 1
    i32.const 1
    call $interactive_ingest_expect_independent_memories
    i32.const 0
    i32.const 3
    call $assert_eq_i32

    i32.const 16
    i32.const 16
    i32.const 1
    call $interactive_ingest_expect_first_events
    i32.const 0
    i32.const 4
    call $assert_eq_i32

    i32.const 1000
    i32.const 1000
    i32.const 1
    i32.const 1
    i32.const 1
    call $interactive_ingest_expect_covered_partial_unknown
    i32.const 0
    i32.const 5
    call $assert_eq_i32

    i32.const 1
    f64.const 100
    f64.const 1000
    f64.const 100
    f64.const 1000
    call $interactive_ingest_expect_zoom_clamped
    i32.const 0
    i32.const 6
    call $assert_eq_i32

    f64.const 1000
    f64.const 1000
    f64.const 1000
    call $interactive_ingest_expect_pan_clamped
    i32.const 0
    i32.const 7
    call $assert_eq_i32

    i32.const 20971520
    i32.const 20971520
    i32.const 1
    i32.const 1
    call $interactive_ingest_expect_progress_eta
    i32.const 0
    i32.const 8
    call $assert_eq_i32

    i32.const 10485760
    i32.const 104857600
    i32.const 10485760
    i32.const 104857600
    i32.const 1
    i32.const 104857600
    call $interactive_ingest_expect_large_trace_checkpoint
    i32.const 0
    i32.const 9
    call $assert_eq_i32

    f64.const 16
    f64.const 16.67
    call $interactive_ingest_expect_frame_interval
    i32.const 0
    i32.const 10
    call $assert_eq_i32
  )

  (func (export "test_interactive_ingest_contract_reports_failures")
    i32.const 0
    i32.const 0
    call $interactive_ingest_expect_renderer_preload
    i32.const 1
    i32.const 9
    call $assert_eq_i32

    i32.const 101
    i32.const 16
    i32.const 1
    call $interactive_ingest_expect_first_events
    i32.const 7
    i32.const 11
    call $assert_eq_i32

    i32.const 96
    i32.const 2000
    i32.const 1
    call $interactive_ingest_expect_first_events
    i32.const 9
    i32.const 12
    call $assert_eq_i32

    i32.const 1
    i32.const 0
    i32.const 1
    call $interactive_ingest_expect_independent_memories
    i32.const 29
    i32.const 13
    call $assert_eq_i32

    i32.const 1000
    i32.const 1001
    i32.const 1
    i32.const 1
    i32.const 1
    call $interactive_ingest_expect_covered_partial_unknown
    i32.const 10
    i32.const 14
    call $assert_eq_i32

    f64.const 16.68
    f64.const 16.67
    call $interactive_ingest_expect_frame_interval
    i32.const 22
    i32.const 15
    call $assert_eq_i32

    i32.const 10485760
    i32.const 104857600
    i32.const 10485760
    i32.const 104857600
    i32.const 0
    i32.const 104857600
    call $interactive_ingest_expect_large_trace_checkpoint
    i32.const 27
    i32.const 16
    call $assert_eq_i32
  )
)
