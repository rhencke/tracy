  (func $index_page_catalog_ptr (param $entry_id i32) (result i32)
    global.get $MEM_DICT_BASE
    local.get $entry_id
    global.get $INDEX_PAGE_CATALOG_ENTRY_BYTES
    i32.mul
    i32.add
  )

  (func $index_page_catalog_ensure_memory
    (local $needed_pages i32)

    global.get $MEM_DICT_BASE
    global.get $INDEX_PAGE_CATALOG_CAPACITY
    global.get $INDEX_PAGE_CATALOG_ENTRY_BYTES
    i32.mul
    i32.add
    i32.const 65535
    i32.add
    i32.const 16
    i32.shr_u
    local.set $needed_pages

    local.get $needed_pages
    memory.size
    i32.gt_u
    if
      local.get $needed_pages
      memory.size
      i32.sub
      memory.grow
      drop
    end
  )

  (func $index_page_catalog_reset (export "index_page_catalog_reset")
    call $index_page_catalog_ensure_memory
    i32.const 0
    global.set $index_slice_page_count
    i32.const 0
    global.set $index_covered_range_valid
    i32.const 0
    global.set $index_covered_range_start
    i32.const 0
    global.set $index_covered_range_end
  )

  (func $index_covered_range_add (param $ts_min i32) (param $ts_max i32)
    global.get $index_covered_range_valid
    i32.eqz
    if
      i32.const 1
      global.set $index_covered_range_valid
      local.get $ts_min
      global.set $index_covered_range_start
      local.get $ts_max
      global.set $index_covered_range_end
      return
    end

    local.get $ts_min
    global.get $index_covered_range_end
    i32.le_u
    local.get $ts_max
    global.get $index_covered_range_end
    i32.gt_u
    i32.and
    if
      local.get $ts_max
      global.set $index_covered_range_end
    end

    local.get $ts_max
    global.get $index_covered_range_start
    i32.ge_u
    local.get $ts_min
    global.get $index_covered_range_start
    i32.lt_u
    i32.and
    if
      local.get $ts_min
      global.set $index_covered_range_start
    end
  )

  (func $index_covered_range_recompute_from_catalog
    (local $entry i32)
    (local $i i32)
    (local $changed i32)
    (local $ts_min i32)
    (local $ts_max i32)

    i32.const 0
    call $index_page_catalog_ptr
    local.set $entry

    i32.const 1
    global.set $index_covered_range_valid
    local.get $entry
    i32.const 8
    i32.add
    i32.load
    global.set $index_covered_range_start
    local.get $entry
    i32.const 12
    i32.add
    i32.load
    global.set $index_covered_range_end

    block $done
      loop $expand
        i32.const 0
        local.set $changed
        i32.const 0
        local.set $i

        loop $scan
          local.get $i
          global.get $index_slice_page_count
          i32.lt_u
          if
            local.get $i
            call $index_page_catalog_ptr
            local.set $entry
            local.get $entry
            i32.const 8
            i32.add
            i32.load
            local.set $ts_min
            local.get $entry
            i32.const 12
            i32.add
            i32.load
            local.set $ts_max

            local.get $ts_min
            global.get $index_covered_range_end
            i32.le_u
            local.get $ts_max
            global.get $index_covered_range_end
            i32.gt_u
            i32.and
            if
              local.get $ts_max
              global.set $index_covered_range_end
              i32.const 1
              local.set $changed
            end

            local.get $ts_max
            global.get $index_covered_range_start
            i32.ge_u
            local.get $ts_min
            global.get $index_covered_range_start
            i32.lt_u
            i32.and
            if
              local.get $ts_min
              global.set $index_covered_range_start
              i32.const 1
              local.set $changed
            end

            local.get $i
            i32.const 1
            i32.add
            local.set $i
            br $scan
          end
        end

        local.get $changed
        i32.eqz
        br_if $done
        br $expand
      end
    end
  )

  (func $index_page_catalog_add_slice_page (export "index_page_catalog_add_slice_page")
    (param $track_id i32)
    (param $page_id i32)
    (param $ts_min i32)
    (param $ts_max i32)
    (param $event_count i32)
    (local $entry i32)

    global.get $index_slice_page_count
    global.get $INDEX_PAGE_CATALOG_CAPACITY
    i32.ge_u
    if
      return
    end

    global.get $index_slice_page_count
    call $index_page_catalog_ptr
    local.set $entry

    local.get $entry
    local.get $track_id
    i32.store

    local.get $entry
    i32.const 4
    i32.add
    local.get $page_id
    i32.store

    local.get $entry
    i32.const 8
    i32.add
    local.get $ts_min
    i32.store

    local.get $entry
    i32.const 12
    i32.add
    local.get $ts_max
    i32.store

    local.get $entry
    i32.const 16
    i32.add
    local.get $event_count
    i32.store

    global.get $index_slice_page_count
    i32.const 1
    i32.add
    global.set $index_slice_page_count

    local.get $ts_min
    local.get $ts_max
    call $index_covered_range_add
    call $index_covered_range_recompute_from_catalog
  )

  (func (export "index_covered_range_valid") (result i32)
    global.get $index_covered_range_valid
  )

  (func (export "index_covered_range_start") (result i32)
    global.get $index_covered_range_start
  )

  (func (export "index_covered_range_end") (result i32)
    global.get $index_covered_range_end
  )

  (func (export "index_writer_covered_range_valid") (result i32)
    global.get $index_covered_range_valid
  )

  (func (export "index_writer_covered_range_start") (result i32)
    global.get $index_covered_range_start
  )

  (func (export "index_writer_covered_range_end") (result i32)
    global.get $index_covered_range_end
  )

  (func (export "index_reader_covered_range_valid") (result i32)
    global.get $index_covered_range_valid
  )

  (func (export "index_reader_covered_range_start") (result i32)
    global.get $index_covered_range_start
  )

  (func (export "index_reader_covered_range_end") (result i32)
    global.get $index_covered_range_end
  )

  (func $index_track_entry_ptr (param $track_id i32) (result i32)
    global.get $INDEX_TRACK_TABLE_BASE
    local.get $track_id
    global.get $INDEX_TRACK_ENTRY_BYTES
    i32.mul
    i32.add
  )

  (func $index_track_ensure_memory
    (local $needed_pages i32)

    global.get $INDEX_SLICE_STACK_BASE
    global.get $INDEX_TRACK_CAPACITY
    global.get $INDEX_SLICE_STACK_MAX_DEPTH
    i32.mul
    global.get $INDEX_SLICE_STACK_ENTRY_BYTES
    i32.mul
    i32.add
    i32.const 65535
    i32.add
    i32.const 16
    i32.shr_u
    local.set $needed_pages

    local.get $needed_pages
    memory.size
    i32.gt_u
    if
      local.get $needed_pages
      memory.size
      i32.sub
      memory.grow
      drop
    end
  )

  (func $index_track_valid (param $track_id i32) (result i32)
    local.get $track_id
    i32.const 0
    i32.lt_s
    if
      i32.const 0
      return
    end

    local.get $track_id
    global.get $index_track_count
    i32.lt_u
  )

  (func $index_track_load_i32 (param $track_id i32) (param $offset i32) (result i32)
    local.get $track_id
    call $index_track_valid
    if (result i32)
      local.get $track_id
      call $index_track_entry_ptr
      local.get $offset
      i32.add
      i32.load
    else
      i32.const 0
    end
  )

  (func $index_slice_stack_ptr (param $track_id i32) (param $depth i32) (result i32)
    global.get $INDEX_SLICE_STACK_BASE
    local.get $track_id
    global.get $INDEX_SLICE_STACK_MAX_DEPTH
    i32.mul
    local.get $depth
    i32.add
    global.get $INDEX_SLICE_STACK_ENTRY_BYTES
    i32.mul
    i32.add
  )

  (func $index_tracks_reset (export "index_tracks_reset")
    call $index_track_ensure_memory
    i32.const 0
    global.set $index_track_count
  )

  (func (export "index_track_count") (result i32)
    global.get $index_track_count
  )

  (func $index_track_for_pid_tid (export "index_track_for_pid_tid") (param $pid i32) (param $tid i32) (result i32)
    (local $i i32)
    (local $entry i32)

    call $index_track_ensure_memory

    block $not_found
      loop $tracks
        local.get $i
        global.get $index_track_count
        i32.ge_u
        br_if $not_found

        local.get $i
        call $index_track_entry_ptr
        local.set $entry

        local.get $entry
        i32.load
        local.get $pid
        i32.eq
        local.get $entry
        i32.const 4
        i32.add
        i32.load
        local.get $tid
        i32.eq
        i32.and
        if
          local.get $i
          return
        end

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $tracks
      end
    end

    global.get $index_track_count
    global.get $INDEX_TRACK_CAPACITY
    i32.ge_u
    if
      i32.const -1
      return
    end

    global.get $index_track_count
    call $index_track_entry_ptr
    local.set $entry

    local.get $entry
    local.get $pid
    i32.store

    local.get $entry
    i32.const 4
    i32.add
    local.get $tid
    i32.store

    local.get $entry
    i32.const 8
    i32.add
    i32.const 0
    i32.store

    local.get $entry
    i32.const 12
    i32.add
    i32.const 0
    i32.store

    local.get $entry
    i32.const 16
    i32.add
    i32.const 0
    i32.store

    local.get $entry
    i32.const 20
    i32.add
    i32.const 0
    i32.store

    local.get $entry
    i32.const 24
    i32.add
    i32.const 0
    i32.store

    local.get $entry
    i32.const 28
    i32.add
    i32.const 0
    i32.store

    global.get $index_track_count
    local.set $i

    global.get $index_track_count
    i32.const 1
    i32.add
    global.set $index_track_count

    local.get $i
  )

  (func $index_track_for_event (export "index_track_for_event") (param $event_ptr i32) (result i32)
    local.get $event_ptr
    i32.const 24
    i32.add
    i32.load
    local.get $event_ptr
    i32.const 28
    i32.add
    i32.load
    call $index_track_for_pid_tid
  )

  (func $index_track_set_name (param $track_id i32) (param $name_id i32)
    local.get $track_id
    call $index_track_entry_ptr
    i32.const 8
    i32.add
    local.get $name_id
    i32.store
  )

  (func $index_apply_metadata_event (export "index_apply_metadata_event") (param $event_ptr i32) (result i32)
    (local $track_id i32)

    local.get $event_ptr
    call $index_track_for_event
    local.tee $track_id
    i32.const -1
    i32.eq
    if
      i32.const -1
      return
    end

    local.get $event_ptr
    i32.load8_u
    i32.const 77
    i32.eq
    if
      local.get $track_id
      local.get $event_ptr
      i32.const 4
      i32.add
      i32.load
      call $index_track_set_name
    end

    local.get $track_id
  )

  (func $index_track_record_slice (export "index_track_record_slice") (param $track_id i32) (param $start_ts i32) (param $dur i32) (param $depth i32) (result i32)
    (local $entry i32)
    (local $slice_count i32)
    (local $end_ts i32)

    local.get $track_id
    call $index_track_valid
    i32.eqz
    if
      global.get $INDEX_TRACK_STATUS_INVALID
      return
    end

    local.get $track_id
    call $index_track_entry_ptr
    local.set $entry

    local.get $start_ts
    local.get $dur
    i32.add
    local.set $end_ts

    local.get $entry
    i32.const 12
    i32.add
    i32.load
    local.tee $slice_count
    i32.eqz
    if
      local.get $entry
      i32.const 16
      i32.add
      local.get $start_ts
      i32.store

      local.get $entry
      i32.const 20
      i32.add
      local.get $end_ts
      i32.store

      local.get $entry
      i32.const 24
      i32.add
      local.get $depth
      i32.store
    else
      local.get $start_ts
      local.get $entry
      i32.const 16
      i32.add
      i32.load
      i32.lt_u
      if
        local.get $entry
        i32.const 16
        i32.add
        local.get $start_ts
        i32.store
      end

      local.get $end_ts
      local.get $entry
      i32.const 20
      i32.add
      i32.load
      i32.gt_u
      if
        local.get $entry
        i32.const 20
        i32.add
        local.get $end_ts
        i32.store
      end

      local.get $depth
      local.get $entry
      i32.const 24
      i32.add
      i32.load
      i32.gt_u
      if
        local.get $entry
        i32.const 24
        i32.add
        local.get $depth
        i32.store
      end
    end

    local.get $entry
    i32.const 12
    i32.add
    local.get $slice_count
    i32.const 1
    i32.add
    i32.store

    global.get $INDEX_TRACK_STATUS_OK
  )

  (func (export "track_pid") (param $track_id i32) (result i32)
    local.get $track_id
    i32.const 0
    call $index_track_load_i32
  )

  (func (export "track_tid") (param $track_id i32) (result i32)
    local.get $track_id
    i32.const 4
    call $index_track_load_i32
  )

  (func (export "track_name_id") (param $track_id i32) (result i32)
    local.get $track_id
    i32.const 8
    call $index_track_load_i32
  )

  (func (export "track_slice_count") (param $track_id i32) (result i32)
    local.get $track_id
    i32.const 12
    call $index_track_load_i32
  )

  (func (export "track_min_ts") (param $track_id i32) (result i32)
    local.get $track_id
    i32.const 16
    call $index_track_load_i32
  )

  (func (export "track_max_ts") (param $track_id i32) (result i32)
    local.get $track_id
    i32.const 20
    call $index_track_load_i32
  )

  (func (export "track_max_depth") (param $track_id i32) (result i32)
    local.get $track_id
    i32.const 24
    call $index_track_load_i32
  )

  (func $track_open_depth (export "track_open_depth") (param $track_id i32) (result i32)
    local.get $track_id
    i32.const 28
    call $index_track_load_i32
  )

  (func $index_track_set_open_depth (param $track_id i32) (param $depth i32)
    local.get $track_id
    call $index_track_entry_ptr
    i32.const 28
    i32.add
    local.get $depth
    i32.store
  )
