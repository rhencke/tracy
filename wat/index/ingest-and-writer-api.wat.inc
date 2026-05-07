  (func $index_writer_append_row
    (param $track i32)
    (param $ts i32)
    (param $dur i32)
    (param $name i32)
    (param $phase i32)
    (param $flags i32)
    (result i32)
    (local $status i32)

    global.get $index_writer_file
    i32.eqz
    if
      global.get $INDEX_WRITER_STATUS_NOT_INITIALIZED
      return
    end

    global.get $index_writer_count
    global.get $INDEX_WRITER_ROWS_PER_PAGE
    i32.ge_u
    if
      call $index_writer_commit_page
      local.tee $status
      global.get $INDEX_WRITER_STATUS_OK
      i32.ne
      if
        local.get $status
        return
      end
    end

    global.get $index_writer_count
    i32.eqz
    if
      call $index_writer_prepare_page
    end

    global.get $index_writer_count
    i32.eqz
    if
      local.get $ts
      global.set $index_writer_bucket_start
      local.get $ts
      global.set $index_writer_bucket_end
    end

    local.get $ts
    global.get $index_writer_bucket_end
    i32.gt_u
    if
      local.get $ts
      global.set $index_writer_bucket_end
    end

    global.get $INDEX_WRITER_TRACK_OFFSET
    local.get $track
    call $index_writer_append_u32

    global.get $INDEX_WRITER_TS_OFFSET
    local.get $ts
    global.get $index_writer_bucket_start
    i32.ge_u
    if (result i32)
      local.get $ts
      global.get $index_writer_bucket_start
      i32.sub
    else
      i32.const 0
    end
    call $index_writer_append_u32

    global.get $INDEX_WRITER_DUR_OFFSET
    local.get $dur
    call $index_writer_append_u32

    global.get $INDEX_WRITER_NAME_OFFSET
    local.get $name
    call $index_writer_append_u32

    global.get $INDEX_WRITER_CAT_OFFSET
    i32.const 0
    call $index_writer_append_u32

    global.get $INDEX_WRITER_PHASE_OFFSET
    local.get $phase
    call $index_writer_append_u8

    global.get $INDEX_WRITER_FLAGS_OFFSET
    local.get $flags
    call $index_writer_append_u8

    global.get $index_writer_count
    i32.const 1
    i32.add
    global.set $index_writer_count

    global.get $INDEX_WRITER_STATUS_OK
  )

  (func $index_writer_append_compact_slice
    (param $track i32)
    (param $ts i32)
    (param $dur i32)
    (param $name i32)
    (param $depth i32)
    (param $cat i32)
    (param $color i32)
    (result i32)
    (local $status i32)
    (local $written i32)

    global.get $index_writer_count
    i32.const 0
    i32.gt_u
    global.get $index_writer_page_track
    local.get $track
    i32.ne
    global.get $index_writer_mode
    i32.const 1
    i32.ne
    i32.or
    i32.and
    if
      call $index_writer_commit_page
      local.tee $status
      global.get $INDEX_WRITER_STATUS_OK
      i32.ne
      if
        local.get $status
        return
      end
    end

    global.get $index_writer_count
    global.get $INDEX_WRITER_ROWS_PER_PAGE
    i32.ge_u
    if
      call $index_writer_commit_page
      local.tee $status
      global.get $INDEX_WRITER_STATUS_OK
      i32.ne
      if
        local.get $status
        return
      end
    end

    global.get $index_writer_count
    i32.eqz
    if
      call $index_writer_prepare_page
      i32.const 1
      global.set $index_writer_mode
      local.get $track
      global.set $index_writer_page_track
      local.get $ts
      global.set $index_writer_bucket_start
      local.get $ts
      local.get $dur
      i32.add
      global.set $index_writer_bucket_end
    end

    local.get $ts
    local.get $dur
    i32.add
    global.get $index_writer_bucket_end
    i32.gt_u
    if
      local.get $ts
      local.get $dur
      i32.add
      global.set $index_writer_bucket_end
    end

    global.get $index_writer_page
    global.get $INDEX_SLICE_WRITER_START_OFFSET
    i32.add
    global.get $index_slice_writer_start_len
    i32.add
    local.get $ts
    global.get $index_writer_bucket_start
    i32.ge_u
    if (result i32)
      local.get $ts
      global.get $index_writer_bucket_start
      i32.sub
    else
      i32.const 0
    end
    call $index_uvarint_write
    local.tee $written
    global.get $index_slice_writer_start_len
    i32.add
    global.set $index_slice_writer_start_len

    global.get $index_writer_page
    global.get $INDEX_SLICE_WRITER_DUR_OFFSET
    i32.add
    global.get $index_slice_writer_dur_len
    i32.add
    local.get $dur
    call $index_uvarint_write
    local.tee $written
    global.get $index_slice_writer_dur_len
    i32.add
    global.set $index_slice_writer_dur_len

    global.get $index_writer_page
    global.get $INDEX_SLICE_WRITER_NAME_OFFSET
    i32.add
    global.get $index_writer_count
    i32.const 2
    i32.mul
    i32.add
    local.get $name
    i32.store16

    global.get $index_writer_page
    global.get $INDEX_SLICE_WRITER_DEPTH_OFFSET
    i32.add
    global.get $index_writer_count
    i32.add
    local.get $depth
    i32.store8

    global.get $index_writer_page
    global.get $INDEX_SLICE_WRITER_CAT_OFFSET
    i32.add
    global.get $index_writer_count
    i32.const 2
    i32.mul
    i32.add
    local.get $cat
    i32.store16

    global.get $index_writer_page
    global.get $INDEX_SLICE_WRITER_COLOR_OFFSET
    i32.add
    global.get $index_slice_writer_color_len
    i32.add
    local.get $color
    call $index_uvarint_write
    global.get $index_slice_writer_color_len
    i32.add
    global.set $index_slice_writer_color_len

    global.get $index_writer_count
    i32.const 1
    i32.add
    global.set $index_writer_count

    global.get $INDEX_WRITER_STATUS_OK
  )

  (func $index_writer_append_counter
    (param $track i32)
    (param $ts i32)
    (param $name i32)
    (param $value f64)
    (result i32)
    (local $status i32)
    (local $written i32)

    global.get $index_writer_count
    i32.const 0
    i32.gt_u
    global.get $index_writer_page_track
    local.get $track
    i32.ne
    global.get $index_writer_mode
    i32.const 2
    i32.ne
    i32.or
    i32.and
    if
      call $index_writer_commit_page
      local.tee $status
      global.get $INDEX_WRITER_STATUS_OK
      i32.ne
      if
        local.get $status
        return
      end
    end

    global.get $index_writer_count
    global.get $INDEX_WRITER_ROWS_PER_PAGE
    i32.ge_u
    if
      call $index_writer_commit_page
      local.tee $status
      global.get $INDEX_WRITER_STATUS_OK
      i32.ne
      if
        local.get $status
        return
      end
    end

    global.get $index_writer_count
    i32.eqz
    if
      call $index_writer_prepare_page
      i32.const 2
      global.set $index_writer_mode
      local.get $track
      global.set $index_writer_page_track
      local.get $ts
      global.set $index_writer_bucket_start
      local.get $ts
      global.set $index_writer_bucket_end
    end

    local.get $ts
    global.get $index_writer_bucket_end
    i32.gt_u
    if
      local.get $ts
      global.set $index_writer_bucket_end
    end

    global.get $index_writer_page
    global.get $INDEX_COUNTER_WRITER_TS_OFFSET
    i32.add
    global.get $index_counter_writer_ts_len
    i32.add
    local.get $ts
    global.get $index_writer_bucket_start
    i32.ge_u
    if (result i32)
      local.get $ts
      global.get $index_writer_bucket_start
      i32.sub
    else
      i32.const 0
    end
    call $index_uvarint_write
    local.tee $written
    global.get $index_counter_writer_ts_len
    i32.add
    global.set $index_counter_writer_ts_len

    global.get $index_writer_page
    global.get $INDEX_COUNTER_WRITER_NAME_OFFSET
    i32.add
    global.get $index_writer_count
    i32.const 2
    i32.mul
    i32.add
    local.get $name
    i32.store16

    global.get $index_writer_page
    global.get $INDEX_COUNTER_WRITER_VALUE_OFFSET
    i32.add
    global.get $index_writer_count
    i32.const 8
    i32.mul
    i32.add
    local.get $value
    f64.store

    global.get $index_writer_count
    i32.const 1
    i32.add
    global.set $index_writer_count

    global.get $INDEX_WRITER_STATUS_OK
  )

  (func (export "index_writer_init")
    (param $index_file i32)
    (param $page_ptr i32)
    (param $dict_epoch i32)
    local.get $index_file
    global.set $index_writer_file
    local.get $page_ptr
    global.set $index_writer_page
    local.get $dict_epoch
    global.set $index_writer_dict_epoch
    i32.const 0
    global.set $index_writer_count
    i32.const 0
    global.set $index_writer_next_page_id
    i32.const 0
    global.set $index_writer_committed_pages
    i32.const 0
    global.set $index_writer_committed_events
    i32.const -1
    global.set $index_writer_previous_page_id
    i32.const 0
    global.set $index_writer_commit_sequence
    i32.const 0
    global.set $index_writer_bucket_end
    i32.const 0
    global.set $index_writer_mode
    i32.const 0
    global.set $index_writer_partial_commit
    call $index_tracks_reset
    call $index_page_catalog_reset
    call $index_writer_prepare_page
  )

  (func (export "index_writer_append_event") (param $event_ptr i32) (result i32)
    (local $ts i32)
    (local $dur i32)
    (local $track i32)
    (local $flags i32)

    i32.const 0
    global.set $index_writer_mode

    local.get $event_ptr
    i32.const 8
    i32.add
    f64.load
    i32.trunc_f64_u
    local.set $ts

    local.get $event_ptr
    i32.const 16
    i32.add
    f64.load
    i32.trunc_f64_u
    local.set $dur

    local.get $event_ptr
    call $index_apply_metadata_event
    local.tee $track
    i32.const -1
    i32.eq
    if
      global.get $INDEX_WRITER_STATUS_HOST_WRITE_FAILED
      return
    end

    local.get $event_ptr
    i32.const 36
    i32.add
    i32.load
    i32.const 0
    i32.gt_u
    if
      i32.const 1
      local.set $flags
    end

    local.get $track
    local.get $ts
    local.get $dur
    local.get $event_ptr
    i32.const 4
    i32.add
    i32.load
    local.get $event_ptr
    i32.load8_u
    local.get $flags
    call $index_writer_append_row
  )

  (func (export "index_add_event") (param $event_ptr i32) (result i32)
    (local $phase i32)
    (local $track i32)
    (local $ts i32)
    (local $dur i32)
    (local $name i32)
    (local $depth i32)
    (local $stack_ptr i32)

    local.get $event_ptr
    i32.load8_u
    local.set $phase

    local.get $phase
    i32.const 77
    i32.eq
    if
      local.get $event_ptr
      call $index_apply_metadata_event
      i32.const -1
      i32.eq
      if (result i32)
        global.get $INDEX_INGEST_STATUS_TRACK_FULL
      else
        global.get $INDEX_INGEST_STATUS_OK
      end
      return
    end

    local.get $phase
    i32.const 67
    i32.eq
    if
      global.get $index_writer_file
      i32.eqz
      if
        global.get $INDEX_WRITER_STATUS_NOT_INITIALIZED
        return
      end

      local.get $event_ptr
      call $index_track_for_event
      local.tee $track
      i32.const -1
      i32.eq
      if
        global.get $INDEX_INGEST_STATUS_TRACK_FULL
        return
      end

      local.get $event_ptr
      i32.const 8
      i32.add
      f64.load
      i32.trunc_f64_u
      local.set $ts

      local.get $event_ptr
      i32.const 4
      i32.add
      i32.load
      local.set $name

      local.get $track
      local.get $ts
      local.get $name
      local.get $event_ptr
      i32.const 16
      i32.add
      f64.load
      call $index_writer_append_counter
      return
    end

    local.get $phase
    i32.const 88
    i32.eq
    local.get $phase
    i32.const 66
    i32.eq
    i32.or
    local.get $phase
    i32.const 69
    i32.eq
    i32.or
    i32.eqz
    if
      global.get $INDEX_INGEST_STATUS_IGNORED
      return
    end

    global.get $index_writer_file
    i32.eqz
    if
      global.get $INDEX_WRITER_STATUS_NOT_INITIALIZED
      return
    end

    local.get $event_ptr
    call $index_track_for_event
    local.tee $track
    i32.const -1
    i32.eq
    if
      global.get $INDEX_INGEST_STATUS_TRACK_FULL
      return
    end

    local.get $event_ptr
    i32.const 8
    i32.add
    f64.load
    i32.trunc_f64_u
    local.set $ts

    local.get $event_ptr
    i32.const 4
    i32.add
    i32.load
    local.set $name

    local.get $phase
    i32.const 88
    i32.eq
    if
      local.get $event_ptr
      i32.const 16
      i32.add
      f64.load
      i32.trunc_f64_u
      local.set $dur

      local.get $track
      call $track_open_depth
      local.set $depth

      local.get $track
      local.get $ts
      local.get $dur
      local.get $depth
      call $index_track_record_slice
      drop

      local.get $track
      local.get $ts
      local.get $dur
      local.get $name
      local.get $depth
      i32.const 0
      i32.const 0
      call $index_writer_append_compact_slice
      return
    end

    local.get $phase
    i32.const 66
    i32.eq
    if
      local.get $track
      call $track_open_depth
      local.tee $depth
      global.get $INDEX_SLICE_STACK_MAX_DEPTH
      i32.ge_u
      if
        global.get $INDEX_INGEST_STATUS_STACK_OVERFLOW
        return
      end

      local.get $track
      local.get $depth
      call $index_slice_stack_ptr
      local.set $stack_ptr

      local.get $stack_ptr
      local.get $ts
      i32.store

      local.get $stack_ptr
      i32.const 4
      i32.add
      local.get $name
      i32.store

      local.get $track
      local.get $depth
      i32.const 1
      i32.add
      call $index_track_set_open_depth

      global.get $INDEX_INGEST_STATUS_OK
      return
    end

    local.get $track
    call $track_open_depth
    local.tee $depth
    i32.eqz
    if
      global.get $INDEX_INGEST_STATUS_STACK_UNDERFLOW
      return
    end

    local.get $depth
    i32.const 1
    i32.sub
    local.set $depth

    local.get $track
    local.get $depth
    call $index_track_set_open_depth

    local.get $track
    local.get $depth
    call $index_slice_stack_ptr
    local.set $stack_ptr

    local.get $ts
    local.get $stack_ptr
    i32.load
    i32.ge_u
    if (result i32)
      local.get $ts
      local.get $stack_ptr
      i32.load
      i32.sub
    else
      i32.const 0
    end
    local.set $dur

    local.get $stack_ptr
    i32.const 4
    i32.add
    i32.load
    local.set $name

    local.get $track
    local.get $stack_ptr
    i32.load
    local.get $dur
    local.get $depth
    call $index_track_record_slice
    drop

    local.get $track
    local.get $stack_ptr
    i32.load
    local.get $dur
    local.get $name
    local.get $depth
    i32.const 0
    i32.const 0
    call $index_writer_append_compact_slice
  )

  (func (export "index_writer_flush") (result i32)
    (local $status i32)

    global.get $index_writer_file
    i32.eqz
    if
      global.get $INDEX_WRITER_STATUS_NOT_INITIALIZED
      return
    end

    call $index_writer_commit_page
    local.tee $status
    i32.const 0
    global.set $index_writer_partial_commit
    global.get $INDEX_WRITER_STATUS_OK
    i32.ne
    if
      local.get $status
      return
    end

    global.get $index_writer_file
    call $opfs_index_flush
    i32.const 0
    i32.ne
    if
      global.get $INDEX_WRITER_STATUS_HOST_FLUSH_FAILED
      return
    end

    global.get $INDEX_WRITER_STATUS_OK
  )

  (func (export "index_writer_publish_partial") (result i32)
    (local $status i32)

    global.get $index_writer_file
    i32.eqz
    if
      global.get $INDEX_WRITER_STATUS_NOT_INITIALIZED
      return
    end

    i32.const 1
    global.set $index_writer_partial_commit
    call $index_writer_commit_page
    local.tee $status
    i32.const 0
    global.set $index_writer_partial_commit
    global.get $INDEX_WRITER_STATUS_OK
    i32.ne
    if
      local.get $status
      return
    end

    global.get $index_writer_file
    call $opfs_index_flush
    i32.const 0
    i32.ne
    if
      global.get $INDEX_WRITER_STATUS_HOST_FLUSH_FAILED
      return
    end

    global.get $INDEX_WRITER_STATUS_OK
  )

  (func (export "index_writer_pending_rows") (result i32)
    global.get $index_writer_count
  )

  (func (export "index_writer_committed_pages") (result i32)
    global.get $index_writer_committed_pages
  )

  (func (export "index_writer_committed_events") (result i32)
    global.get $index_writer_committed_events
  )

  (func (export "index_writer_next_page_id") (result i32)
    global.get $index_writer_next_page_id
  )
