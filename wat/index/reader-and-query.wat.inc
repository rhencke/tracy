  (func $index_reader_max_slots (result i32)
    global.get $MEM_INDEX_CACHE_SIZE
    global.get $OPFS_PAGE_SIZE
    i32.div_u
  )

  (func $index_reader_slot_meta (param $slot i32) (result i32)
    global.get $INDEX_READER_SLOT_META_BASE
    local.get $slot
    global.get $INDEX_READER_SLOT_META_BYTES
    i32.mul
    i32.add
  )

  (func $index_reader_slot_ptr (param $slot i32) (result i32)
    global.get $MEM_INDEX_CACHE_BASE
    local.get $slot
    global.get $OPFS_PAGE_SIZE
    i32.mul
    i32.add
  )

  (func $index_reader_slot_valid (param $slot i32) (result i32)
    local.get $slot
    call $index_reader_slot_meta
    i32.load8_u
  )

  (func $index_reader_slot_level (param $slot i32) (result i32)
    local.get $slot
    call $index_reader_slot_meta
    i32.const 4
    i32.add
    i32.load
  )

  (func $index_reader_slot_page_id (param $slot i32) (result i32)
    local.get $slot
    call $index_reader_slot_meta
    i32.const 8
    i32.add
    i32.load
  )

  (func $index_reader_slot_stamp (param $slot i32) (result i32)
    local.get $slot
    call $index_reader_slot_meta
    i32.const 12
    i32.add
    i32.load
  )

  (func $index_reader_set_slot_valid (param $slot i32) (param $valid i32)
    local.get $slot
    call $index_reader_slot_meta
    local.get $valid
    i32.store8
  )

  (func $index_reader_next_stamp (result i32)
    global.get $index_reader_clock
    i32.const 1
    i32.add
    global.set $index_reader_clock
    global.get $index_reader_clock
  )

  (func $index_reader_touch_slot (param $slot i32)
    local.get $slot
    call $index_reader_slot_meta
    i32.const 12
    i32.add
    call $index_reader_next_stamp
    i32.store
  )

  (func $index_reader_store_slot (param $slot i32) (param $level i32) (param $page_id i32)
    (local $meta i32)

    local.get $slot
    call $index_reader_slot_meta
    local.set $meta

    local.get $meta
    i32.const 1
    i32.store8

    local.get $meta
    i32.const 4
    i32.add
    local.get $level
    i32.store

    local.get $meta
    i32.const 8
    i32.add
    local.get $page_id
    i32.store

    local.get $meta
    i32.const 12
    i32.add
    call $index_reader_next_stamp
    i32.store
  )

  (func $index_reader_find_hit (param $level i32) (param $page_id i32) (result i32)
    (local $slot i32)

    block $miss
      loop $loop
        local.get $slot
        global.get $index_reader_configured_slots
        i32.ge_u
        br_if $miss

        local.get $slot
        call $index_reader_slot_valid
        if
          local.get $slot
          call $index_reader_slot_level
          local.get $level
          i32.eq
          local.get $slot
          call $index_reader_slot_page_id
          local.get $page_id
          i32.eq
          i32.and
          if
            local.get $slot
            return
          end
        end

        local.get $slot
        i32.const 1
        i32.add
        local.set $slot
        br $loop
      end
    end

    i32.const -1
  )

  (func $index_reader_find_free_slot (result i32)
    (local $slot i32)

    block $miss
      loop $loop
        local.get $slot
        global.get $index_reader_configured_slots
        i32.ge_u
        br_if $miss

        local.get $slot
        call $index_reader_slot_valid
        i32.eqz
        if
          local.get $slot
          return
        end

        local.get $slot
        i32.const 1
        i32.add
        local.set $slot
        br $loop
      end
    end

    i32.const -1
  )

  (func $index_reader_find_lru_slot (result i32)
    (local $slot i32)
    (local $best_slot i32)
    (local $best_stamp i32)
    (local $stamp i32)

    i32.const -1
    local.set $best_slot
    i32.const -1
    local.set $best_stamp

    block $done
      loop $loop
        local.get $slot
        global.get $index_reader_configured_slots
        i32.ge_u
        br_if $done

        local.get $slot
        call $index_reader_slot_valid
        if
          local.get $slot
          call $index_reader_slot_stamp
          local.set $stamp

          local.get $best_slot
          i32.const -1
          i32.eq
          local.get $stamp
          local.get $best_stamp
          i32.lt_u
          i32.or
          if
            local.get $slot
            local.set $best_slot
            local.get $stamp
            local.set $best_stamp
          end
        end

        local.get $slot
        i32.const 1
        i32.add
        local.set $slot
        br $loop
      end
    end

    local.get $best_slot
  )

  (func $index_reader_choose_slot (result i32)
    (local $slot i32)

    call $index_reader_find_free_slot
    local.tee $slot
    i32.const -1
    i32.ne
    if (result i32)
      local.get $slot
    else
      call $index_reader_find_lru_slot
    end
  )

  (func $index_reader_clear_cache
    (local $slot i32)

    block $done
      loop $loop
        local.get $slot
        global.get $index_reader_configured_slots
        i32.ge_u
        br_if $done

        local.get $slot
        i32.const 0
        call $index_reader_set_slot_valid

        local.get $slot
        i32.const 1
        i32.add
        local.set $slot
        br $loop
      end
    end

    i32.const -1
    global.set $index_reader_cached_level
    i32.const -1
    global.set $index_reader_cached_page_id
    i32.const 0
    global.set $index_reader_last_hit
    i32.const -1
    global.set $index_reader_last_slot
  )

  (func $index_reader_ensure_configured
    global.get $index_reader_configured_slots
    i32.eqz
    if
      call $index_reader_max_slots
      global.set $index_reader_configured_slots
    end
  )

  (func (export "index_reader_configure_cache") (param $slot_count i32) (result i32)
    (local $max_slots i32)

    call $index_reader_max_slots
    local.set $max_slots

    local.get $slot_count
    i32.eqz
    if
      i32.const 1
      local.set $slot_count
    end

    local.get $slot_count
    local.get $max_slots
    i32.gt_u
    if
      local.get $max_slots
      local.set $slot_count
    end

    local.get $slot_count
    global.set $index_reader_configured_slots
    call $index_reader_clear_cache
    local.get $slot_count
  )

  (func (export "index_reader_init") (param $index_file i32)
    call $index_reader_ensure_configured
    local.get $index_file
    global.set $index_reader_file
    global.get $INDEX_READER_STATUS_OK
    global.set $index_reader_last_status
    i32.const 0
    global.set $index_reader_cache_hits
    i32.const 0
    global.set $index_reader_cache_misses
    i32.const 0
    global.set $index_reader_cache_evictions
    call $index_reader_clear_cache
  )

  (func $read_page (export "read_page") (param $level i32) (param $page_id i32) (result i32)
    (local $read_bytes i32)
    (local $status i32)
    (local $slot i32)
    (local $page_ptr i32)

    call $index_reader_ensure_configured

    global.get $index_reader_file
    i32.eqz
    if
      global.get $INDEX_READER_STATUS_NOT_INITIALIZED
      global.set $index_reader_last_status
      call $index_reader_clear_cache
      i32.const 0
      return
    end

    local.get $level
    local.get $page_id
    call $index_reader_find_hit
    local.tee $slot
    i32.const -1
    i32.ne
    if
      global.get $INDEX_READER_STATUS_OK
      global.set $index_reader_last_status
      i32.const 1
      global.set $index_reader_last_hit
      global.get $index_reader_cache_hits
      i32.const 1
      i32.add
      global.set $index_reader_cache_hits
      local.get $slot
      global.set $index_reader_last_slot
      local.get $slot
      call $index_reader_touch_slot
      local.get $level
      global.set $index_reader_cached_level
      local.get $page_id
      global.set $index_reader_cached_page_id
      local.get $slot
      call $index_reader_slot_ptr
      return
    end

    i32.const 0
    global.set $index_reader_last_hit
    global.get $index_reader_cache_misses
    i32.const 1
    i32.add
    global.set $index_reader_cache_misses
    call $index_reader_choose_slot
    local.tee $slot
    global.set $index_reader_last_slot
    local.get $slot
    call $index_reader_slot_valid
    if
      global.get $index_reader_cache_evictions
      i32.const 1
      i32.add
      global.set $index_reader_cache_evictions
    end
    local.get $slot
    call $index_reader_slot_ptr
    local.set $page_ptr

    global.get $index_reader_file
    local.get $page_id
    i64.extend_i32_u
    global.get $OPFS_PAGE_SIZE
    i64.extend_i32_u
    i64.mul
    global.get $OPFS_PAGE_SIZE
    local.get $page_ptr
    call $opfs_index_read
    local.set $read_bytes

    local.get $read_bytes
    global.get $OPFS_PAGE_SIZE
    i32.ne
    if
      global.get $INDEX_READER_STATUS_MISSING_PAGE
      global.set $index_reader_last_status
      local.get $slot
      i32.const 0
      call $index_reader_set_slot_valid
      i32.const 0
      return
    end

    local.get $page_ptr
    global.get $OPFS_PAGE_SIZE
    call $index_validate_page
    local.tee $status
    global.get $INDEX_STATUS_OK
    i32.ne
    if
      global.get $INDEX_READER_STATUS_CORRUPT_PAGE
      global.set $index_reader_last_status
      local.get $slot
      i32.const 0
      call $index_reader_set_slot_valid
      i32.const 0
      return
    end

    local.get $page_ptr
    i32.const 8
    i32.add
    i32.load
    local.get $level
    i32.ne
    if
      global.get $INDEX_READER_STATUS_LEVEL_MISMATCH
      global.set $index_reader_last_status
      local.get $slot
      i32.const 0
      call $index_reader_set_slot_valid
      i32.const 0
      return
    end

    local.get $slot
    local.get $level
    local.get $page_id
    call $index_reader_store_slot
    local.get $level
    global.set $index_reader_cached_level
    local.get $page_id
    global.set $index_reader_cached_page_id
    global.get $INDEX_READER_STATUS_OK
    global.set $index_reader_last_status
    local.get $page_ptr
  )

  (func (export "index_reader_status") (result i32)
    global.get $index_reader_last_status
  )

  (func (export "index_reader_cache_hit") (result i32)
    global.get $index_reader_last_hit
  )

  (func (export "index_reader_cached_page_id") (result i32)
    global.get $index_reader_cached_page_id
  )

  (func (export "index_reader_cache_slots") (result i32)
    call $index_reader_ensure_configured
    global.get $index_reader_configured_slots
  )

  (func (export "index_reader_last_slot") (result i32)
    global.get $index_reader_last_slot
  )

  (func (export "index_reader_cache_hits") (result i32)
    global.get $index_reader_cache_hits
  )

  (func (export "index_reader_cache_misses") (result i32)
    global.get $index_reader_cache_misses
  )

  (func (export "index_reader_cache_evictions") (result i32)
    global.get $index_reader_cache_evictions
  )

  (func (export "index_slice_page_count") (result i32)
    global.get $index_slice_page_count
  )

  (func $index_query_result_ptr (param $out_buf i32) (param $row i32) (result i32)
    local.get $out_buf
    local.get $row
    global.get $INDEX_QUERY_RESULT_BYTES
    i32.mul
    i32.add
  )

  (func (export "index_query_range")
    (param $track_id i32)
    (param $ts_min i32)
    (param $ts_max i32)
    (param $out_buf i32)
    (result i32)
    (local $catalog_i i32)
    (local $entry i32)
    (local $page i32)
    (local $row i32)
    (local $count i32)
    (local $start_ptr i32)
    (local $start_len i32)
    (local $start_cursor i32)
    (local $dur_ptr i32)
    (local $dur_len i32)
    (local $dur_cursor i32)
    (local $name_ptr i32)
    (local $depth_ptr i32)
    (local $cat_ptr i32)
    (local $color_ptr i32)
    (local $color_len i32)
    (local $color_cursor i32)
    (local $encoding i32)
    (local $rows i32)
    (local $value i32)
    (local $bytes i32)
    (local $status i32)
    (local $start_ts i32)
    (local $dur i32)
    (local $color i32)
    (local $result i32)
    (local $page_hints i32)

    global.get $index_reader_file
    i32.eqz
    if
      global.get $INDEX_READER_STATUS_NOT_INITIALIZED
      global.set $index_reader_last_status
      i32.const 0
      return
    end

    block $catalog_done
      loop $catalog
        local.get $catalog_i
        global.get $index_slice_page_count
        i32.ge_u
        br_if $catalog_done

        local.get $catalog_i
        call $index_page_catalog_ptr
        local.set $entry

        local.get $entry
        i32.load
        local.get $track_id
        i32.eq
        local.get $entry
        i32.const 12
        i32.add
        i32.load
        local.get $ts_min
        i32.ge_u
        i32.and
        local.get $entry
        i32.const 8
        i32.add
        i32.load
        local.get $ts_max
        i32.le_u
        i32.and
        if
          i32.const 0
          local.get $entry
          i32.const 4
          i32.add
          i32.load
          call $read_page
          local.tee $page
          i32.eqz
          if
            local.get $count
            return
          end

          local.get $page
          i32.const 36
          i32.add
          i32.load
          local.tee $page_hints
          global.get $INDEX_DECODE_HINT_COMPACT_SLICES
          i32.and
          i32.eqz
          if
            global.get $INDEX_READER_STATUS_CORRUPT_PAGE
            global.set $index_reader_last_status
            local.get $count
            return
          end

          local.get $page
          global.get $INDEX_SLICE_COLUMN_START_TS
          call $index_column_span
          local.set $rows
          local.set $encoding
          local.set $start_len
          local.set $start_ptr

          local.get $page
          global.get $INDEX_SLICE_COLUMN_DUR
          call $index_column_span
          local.set $rows
          local.set $encoding
          local.set $dur_len
          local.set $dur_ptr

          local.get $page
          global.get $INDEX_SLICE_COLUMN_NAME_ID
          call $index_column_span
          local.set $rows
          local.set $encoding
          drop
          local.set $name_ptr

          local.get $page
          global.get $INDEX_SLICE_COLUMN_DEPTH
          call $index_column_span
          local.set $rows
          local.set $encoding
          drop
          local.set $depth_ptr

          local.get $page
          global.get $INDEX_SLICE_COLUMN_CAT_ID
          call $index_column_span
          local.set $rows
          local.set $encoding
          drop
          local.set $cat_ptr

          local.get $page
          global.get $INDEX_SLICE_COLUMN_COLOR
          call $index_column_span
          local.set $rows
          local.set $encoding
          local.set $color_len
          local.set $color_ptr

          i32.const 0
          local.set $row
          i32.const 0
          local.set $start_cursor
          i32.const 0
          local.set $dur_cursor
          i32.const 0
          local.set $color_cursor

          block $rows_done
            loop $rows_loop
              local.get $row
              local.get $rows
              i32.ge_u
              br_if $rows_done

              local.get $start_ptr
              local.get $start_cursor
              i32.add
              local.get $start_len
              local.get $start_cursor
              i32.sub
              call $index_uvarint_read
              local.set $status
              local.set $bytes
              local.set $value

              local.get $status
              global.get $INDEX_CODEC_STATUS_OK
              i32.ne
              if
                global.get $INDEX_READER_STATUS_CORRUPT_PAGE
                global.set $index_reader_last_status
                local.get $count
                return
              end

              local.get $start_cursor
              local.get $bytes
              i32.add
              local.set $start_cursor

              local.get $page
              i32.const 12
              i32.add
              i32.load
              local.get $value
              i32.add
              local.set $start_ts

              local.get $dur_ptr
              local.get $dur_cursor
              i32.add
              local.get $dur_len
              local.get $dur_cursor
              i32.sub
              call $index_uvarint_read
              local.set $status
              local.set $bytes
              local.set $dur

              local.get $status
              global.get $INDEX_CODEC_STATUS_OK
              i32.ne
              if
                global.get $INDEX_READER_STATUS_CORRUPT_PAGE
                global.set $index_reader_last_status
                local.get $count
                return
              end

              local.get $dur_cursor
              local.get $bytes
              i32.add
              local.set $dur_cursor

              local.get $color_ptr
              local.get $color_cursor
              i32.add
              local.get $color_len
              local.get $color_cursor
              i32.sub
              call $index_uvarint_read
              local.set $status
              local.set $bytes
              local.set $color

              local.get $status
              global.get $INDEX_CODEC_STATUS_OK
              i32.ne
              if
                global.get $INDEX_READER_STATUS_CORRUPT_PAGE
                global.set $index_reader_last_status
                local.get $count
                return
              end

              local.get $color_cursor
              local.get $bytes
              i32.add
              local.set $color_cursor

              local.get $start_ts
              local.get $ts_max
              i32.le_u
              local.get $start_ts
              local.get $dur
              i32.add
              local.get $ts_min
              i32.ge_u
              i32.and
              if
                local.get $out_buf
                local.get $count
                call $index_query_result_ptr
                local.set $result

                local.get $result
                local.get $start_ts
                i32.store

                local.get $result
                i32.const 4
                i32.add
                local.get $dur
                i32.store

                local.get $result
                i32.const 8
                i32.add
                local.get $name_ptr
                local.get $row
                i32.const 2
                i32.mul
                i32.add
                i32.load16_u
                i32.store

                local.get $result
                i32.const 12
                i32.add
                local.get $depth_ptr
                local.get $row
                i32.add
                i32.load8_u
                i32.store

                local.get $result
                i32.const 16
                i32.add
                local.get $cat_ptr
                local.get $row
                i32.const 2
                i32.mul
                i32.add
                i32.load16_u
                i32.store

                local.get $result
                i32.const 20
                i32.add
                local.get $color
                i32.store

                local.get $result
                i32.const 24
                i32.add
                local.get $page_hints
                global.get $INDEX_DECODE_HINT_PARTIAL
                i32.and
                i32.eqz
                i32.eqz
                i32.store

                local.get $count
                i32.const 1
                i32.add
                local.set $count
              end

              local.get $row
              i32.const 1
              i32.add
              local.set $row
              br $rows_loop
            end
          end
        end

        local.get $catalog_i
        i32.const 1
        i32.add
        local.set $catalog_i
        br $catalog
      end
    end

    global.get $INDEX_READER_STATUS_OK
    global.set $index_reader_last_status
    local.get $count
  )

  (func (export "index_reader_evict_cold_pages") (param $count i32) (result i32)
    (local $evicted i32)
    (local $slot i32)

    call $index_reader_ensure_configured

    local.get $count
    i32.eqz
    if
      global.get $index_reader_configured_slots
      local.set $count
    end

    block $done
      loop $loop
        local.get $evicted
        local.get $count
        i32.ge_u
        br_if $done

        call $index_reader_find_lru_slot
        local.tee $slot
        i32.const -1
        i32.eq
        br_if $done

        local.get $slot
        i32.const 0
        call $index_reader_set_slot_valid
        global.get $index_reader_cache_evictions
        i32.const 1
        i32.add
        global.set $index_reader_cache_evictions

        local.get $evicted
        i32.const 1
        i32.add
        local.set $evicted
        br $loop
      end
    end

    local.get $evicted
    if
      i32.const -1
      global.set $index_reader_cached_level
      i32.const -1
      global.set $index_reader_cached_page_id
      i32.const -1
      global.set $index_reader_last_slot
      i32.const 0
      global.set $index_reader_last_hit
    end

    local.get $evicted
  )

  (func $index_column_span (export "index_column_span") (param $page i32) (param $column_id i32) (result i32 i32 i32 i32)
    (local $count i32)
    (local $i i32)
    (local $entry i32)

    local.get $page
    global.get $INDEX_HEADER_BYTES
    i32.add
    i32.const 1
    i32.add
    i32.load8_u
    local.set $count

    block $not_found
      loop $loop
        local.get $i
        local.get $count
        i32.ge_u
        br_if $not_found

        local.get $page
        local.get $i
        call $entry_ptr
        local.set $entry

        local.get $entry
        i32.load8_u
        local.get $column_id
        i32.eq
        if
          local.get $page
          local.get $entry
          i32.const 4
          i32.add
          i32.load
          i32.add

          local.get $entry
          i32.const 8
          i32.add
          i32.load

          local.get $entry
          i32.const 1
          i32.add
          i32.load8_u

          local.get $entry
          i32.const 12
          i32.add
          i32.load
          return
        end

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      end
    end

    i32.const 0
    i32.const 0
    i32.const 0
    i32.const 0
  )

  (func $unused_zero (param $page i32) (param $page_len i32) (result i32)
    (local $ptr i32)
    (local $end i32)

    local.get $page
    global.get $INDEX_HEADER_BYTES
    i32.add
    local.get $page
    call $load_payload_len
    i32.add
    local.set $ptr

    local.get $page
    local.get $page_len
    call $footer_start
    local.set $end

    block $done
      loop $loop
        local.get $ptr
        local.get $end
        i32.ge_u
        br_if $done

        local.get $ptr
        i32.load8_u
        if
          i32.const 0
          return
        end

        local.get $ptr
        i32.const 1
        i32.add
        local.set $ptr
        br $loop
      end
    end

    i32.const 1
  )

  (func $directory_status (param $page i32) (param $page_len i32) (result i32)
    (local $payload_len i32)
    (local $payload_end i32)
    (local $dir i32)
    (local $dir_len i32)
    (local $count i32)
    (local $expected_dir_len i32)
    (local $i i32)
    (local $j i32)
    (local $entry i32)
    (local $other i32)
    (local $offset i32)
    (local $len i32)
    (local $other_offset i32)
    (local $other_len i32)
    (local $col i32)
    (local $span_ptr i32)
    (local $span_len i32)
    (local $encoding i32)
    (local $rows i32)
    (local $record_count i32)
    (local $required_count i32)

    local.get $page
    call $load_payload_len
    local.set $payload_len

    local.get $payload_len
    i32.const 4
    i32.lt_u
    if
      global.get $INDEX_STATUS_BAD_DIRECTORY
      return
    end

    local.get $page
    call $payload_start
    local.set $dir

    local.get $dir
    i32.load8_u
    global.get $INDEX_DIRECTORY_VERSION
    i32.ne
    if
      global.get $INDEX_STATUS_BAD_DIRECTORY
      return
    end

    local.get $dir
    i32.const 1
    i32.add
    i32.load8_u
    local.set $count

    local.get $dir
    i32.const 2
    i32.add
    i32.load16_u
    local.set $dir_len

    i32.const 4
    local.get $count
    global.get $INDEX_COLUMN_ENTRY_BYTES
    i32.mul
    i32.add
    local.set $expected_dir_len

    local.get $dir_len
    local.get $expected_dir_len
    i32.ne
    if
      global.get $INDEX_STATUS_BAD_DIRECTORY
      return
    end

    local.get $dir_len
    local.get $payload_len
    i32.gt_u
    if
      global.get $INDEX_STATUS_BAD_DIRECTORY
      return
    end

    local.get $page
    global.get $INDEX_HEADER_BYTES
    i32.add
    local.get $payload_len
    i32.add
    local.set $payload_end

    block $entries_done
      loop $entries
        local.get $i
        local.get $count
        i32.ge_u
        br_if $entries_done

        local.get $page
        local.get $i
        call $entry_ptr
        local.set $entry

        local.get $entry
        i32.const 4
        i32.add
        i32.load
        local.set $offset

        local.get $entry
        i32.const 8
        i32.add
        i32.load
        local.set $len

        local.get $offset
        global.get $INDEX_HEADER_BYTES
        local.get $dir_len
        i32.add
        i32.lt_u
        if
          global.get $INDEX_STATUS_BAD_DIRECTORY
          return
        end

        local.get $page
        local.get $offset
        i32.add
        local.get $len
        call $range_end
        local.get $payload_end
        i32.gt_u
        if
          global.get $INDEX_STATUS_BAD_DIRECTORY
          return
        end

        local.get $page
        local.get $offset
        i32.add
        local.get $len
        local.get $entry
        i32.const 1
        i32.add
        i32.load8_u
        local.get $entry
        i32.const 2
        i32.add
        i32.load16_u
        local.get $entry
        i32.const 12
        i32.add
        i32.load
        call $index_column_payload_status
        global.get $INDEX_CODEC_STATUS_OK
        i32.ne
        if
          global.get $INDEX_STATUS_BAD_DIRECTORY
          return
        end

        local.get $i
        i32.const 1
        i32.add
        local.set $j
        block $overlaps_done
          loop $overlaps
            local.get $j
            local.get $count
            i32.ge_u
            br_if $overlaps_done

            local.get $page
            local.get $j
            call $entry_ptr
            local.set $other

            local.get $other
            i32.const 4
            i32.add
            i32.load
            local.set $other_offset

            local.get $other
            i32.const 8
            i32.add
            i32.load
            local.set $other_len

            local.get $len
            i32.eqz
            local.get $other_len
            i32.eqz
            i32.or
            i32.eqz
            if
              local.get $offset
              local.get $other_offset
              local.get $other_len
              i32.add
              i32.lt_u
              local.get $other_offset
              local.get $offset
              local.get $len
              i32.add
              i32.lt_u
              i32.and
              if
                global.get $INDEX_STATUS_BAD_DIRECTORY
                return
              end
            end

            local.get $j
            i32.const 1
            i32.add
            local.set $j
            br $overlaps
          end
        end

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $entries
      end
    end

    local.get $page
    i32.const 28
    i32.add
    i32.load
    local.set $record_count

    local.get $page
    i32.const 36
    i32.add
    i32.load
    global.get $INDEX_DECODE_HINT_COMPACT_SLICES
    i32.and
    if (result i32)
      i32.const 6
    else
      local.get $page
      i32.const 36
      i32.add
      i32.load
      global.get $INDEX_DECODE_HINT_COUNTERS
      i32.and
      if (result i32)
        i32.const 3
      else
        i32.const 7
      end
    end
    local.set $required_count

    i32.const 1
    local.set $col
    block $required_done
      loop $required
        local.get $col
        local.get $required_count
        i32.gt_u
        br_if $required_done

        local.get $page
        local.get $col
        call $index_column_span
        local.set $rows
        local.set $encoding
        local.set $span_len
        local.set $span_ptr

        local.get $span_ptr
        i32.eqz
        local.get $rows
        local.get $record_count
        i32.ne
        i32.or
        if
          global.get $INDEX_STATUS_MISSING_REQUIRED_COLUMN
          return
        end

        local.get $col
        i32.const 1
        i32.add
        local.set $col
        br $required
      end
    end

    global.get $INDEX_STATUS_OK
  )

  (func $index_validate_page (export "index_validate_page") (param $page i32) (param $page_len i32) (result i32)
    (local $payload_len i32)
    (local $status i32)

    local.get $page_len
    global.get $OPFS_PAGE_SIZE
    i32.ne
    if
      global.get $INDEX_STATUS_BAD_PAGE_SIZE
      return
    end

    local.get $page
    i32.load
    global.get $INDEX_PAGE_MAGIC_TRCI
    i32.ne
    if
      global.get $INDEX_STATUS_BAD_MAGIC
      return
    end

    local.get $page
    i32.const 4
    i32.add
    i32.load16_u
    global.get $INDEX_FORMAT_VERSION
    i32.ne
    if
      global.get $INDEX_STATUS_BAD_VERSION
      return
    end

    local.get $page
    i32.const 6
    i32.add
    i32.load16_u
    global.get $INDEX_HEADER_BYTES
    i32.ne
    if
      global.get $INDEX_STATUS_BAD_HEADER_SIZE
      return
    end

    local.get $page
    call $load_payload_len
    local.set $payload_len

    global.get $INDEX_HEADER_BYTES
    local.get $payload_len
    i32.add
    local.get $page_len
    global.get $INDEX_FOOTER_BYTES
    i32.sub
    i32.gt_u
    if
      global.get $INDEX_STATUS_BAD_PAYLOAD_BOUNDS
      return
    end

    local.get $page
    i32.const 44
    i32.add
    i32.load
    local.get $page
    call $index_header_crc
    i32.ne
    if
      global.get $INDEX_STATUS_BAD_HEADER_CRC
      return
    end

    local.get $page
    local.get $page_len
    call $footer_start
    i32.const 12
    i32.add
    i32.load
    global.get $INDEX_FOOTER_MAGIC_DONE
    i32.ne
    if
      global.get $INDEX_STATUS_BAD_FOOTER
      return
    end

    local.get $page
    local.get $page_len
    call $footer_start
    i32.load
    local.get $page
    global.get $INDEX_HEADER_BYTES
    i32.add
    local.get $payload_len
    call $index_crc32c
    i32.ne
    if
      global.get $INDEX_STATUS_BAD_PAYLOAD_CRC
      return
    end

    local.get $page
    local.get $page_len
    call $directory_status
    local.set $status
    local.get $status
    global.get $INDEX_STATUS_OK
    i32.ne
    if
      local.get $status
      return
    end

    local.get $page
    local.get $page_len
    call $unused_zero
    i32.eqz
    if
      global.get $INDEX_STATUS_UNUSED_NOT_ZERO
      return
    end

    global.get $INDEX_STATUS_OK
  )
