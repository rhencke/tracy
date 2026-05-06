  (func $index_crc32c (export "index_crc32c") (param $ptr i32) (param $len i32) (result i32)
    (local $crc i32)
    (local $i i32)
    (local $bit i32)

    i32.const -1
    local.set $crc

    block $done
      loop $bytes
        local.get $i
        local.get $len
        i32.ge_u
        br_if $done

        local.get $crc
        local.get $ptr
        local.get $i
        i32.add
        i32.load8_u
        i32.xor
        local.set $crc

        i32.const 0
        local.set $bit
        block $bits_done
          loop $bits
            local.get $bit
            i32.const 8
            i32.ge_u
            br_if $bits_done

            local.get $crc
            i32.const 1
            i32.and
            if
              local.get $crc
              i32.const 1
              i32.shr_u
              i32.const 0x82F63B78
              i32.xor
              local.set $crc
            else
              local.get $crc
              i32.const 1
              i32.shr_u
              local.set $crc
            end

            local.get $bit
            i32.const 1
            i32.add
            local.set $bit
            br $bits
          end
        end

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $bytes
      end
    end

    local.get $crc
    i32.const -1
    i32.xor
  )

  (func $index_header_crc (export "index_header_crc") (param $page i32) (result i32)
    (local $saved i32)
    (local $crc i32)

    local.get $page
    i32.const 44
    i32.add
    i32.load
    local.set $saved

    local.get $page
    i32.const 44
    i32.add
    i32.const 0
    i32.store

    local.get $page
    global.get $INDEX_HEADER_BYTES
    call $index_crc32c
    local.set $crc

    local.get $page
    i32.const 44
    i32.add
    local.get $saved
    i32.store

    local.get $crc
  )

  (func $index_update_header_crc (export "index_update_header_crc") (param $page i32) (result i32)
    local.get $page
    i32.const 44
    i32.add
    local.get $page
    call $index_header_crc
    i32.store

    local.get $page
    i32.const 44
    i32.add
    i32.load
  )

  (func $index_write_header (export "index_write_header")
    (param $page i32)
    (param $level i32)
    (param $bucket_start i64)
    (param $bucket_end i64)
    (param $record_count i32)
    (param $payload_len i32)
    (param $decode_hints i32)
    (param $dict_epoch i32)
    (param $page_id i64)
    local.get $page
    global.get $INDEX_PAGE_MAGIC_TRCI
    i32.store

    local.get $page
    i32.const 4
    i32.add
    global.get $INDEX_FORMAT_VERSION
    i32.store16

    local.get $page
    i32.const 6
    i32.add
    global.get $INDEX_HEADER_BYTES
    i32.store16

    local.get $page
    i32.const 8
    i32.add
    local.get $level
    i32.store

    local.get $page
    i32.const 12
    i32.add
    local.get $bucket_start
    i64.store

    local.get $page
    i32.const 20
    i32.add
    local.get $bucket_end
    i64.store

    local.get $page
    i32.const 28
    i32.add
    local.get $record_count
    i32.store

    local.get $page
    i32.const 32
    i32.add
    local.get $payload_len
    i32.store

    local.get $page
    i32.const 36
    i32.add
    local.get $decode_hints
    i32.store

    local.get $page
    i32.const 40
    i32.add
    local.get $dict_epoch
    i32.store

    local.get $page
    i32.const 48
    i32.add
    local.get $page_id
    i64.store

    local.get $page
    i32.const 56
    i32.add
    i64.const 0
    i64.store

    local.get $page
    call $index_update_header_crc
    drop
  )

  (func $index_write_footer (export "index_write_footer")
    (param $page i32)
    (param $page_len i32)
    (param $payload_crc i32)
    (param $previous_page_id i32)
    (param $commit_sequence i32)
    (local $footer i32)

    local.get $page
    local.get $page_len
    call $footer_start
    local.set $footer

    local.get $footer
    local.get $payload_crc
    i32.store

    local.get $footer
    i32.const 4
    i32.add
    local.get $previous_page_id
    i32.store

    local.get $footer
    i32.const 8
    i32.add
    local.get $commit_sequence
    i32.store

    local.get $footer
    i32.const 12
    i32.add
    global.get $INDEX_FOOTER_MAGIC_DONE
    i32.store
  )

  (func $write_directory_entry
    (param $entry i32)
    (param $column_id i32)
    (param $encoding i32)
    (param $offset i32)
    (param $len i32)
    (param $rows i32)
    local.get $entry
    local.get $column_id
    i32.store8

    local.get $entry
    i32.const 1
    i32.add
    local.get $encoding
    i32.store8

    local.get $entry
    i32.const 2
    i32.add
    i32.const 0
    i32.store16

    local.get $entry
    i32.const 4
    i32.add
    local.get $offset
    i32.store

    local.get $entry
    i32.const 8
    i32.add
    local.get $len
    i32.store

    local.get $entry
    i32.const 12
    i32.add
    local.get $rows
    i32.store
  )

  (func $index_writer_payload_len (result i32)
    global.get $INDEX_WRITER_FLAGS_OFFSET
    global.get $index_writer_count
    i32.add
    global.get $INDEX_HEADER_BYTES
    i32.sub
  )

  (func $index_slice_writer_payload_len (result i32)
    global.get $INDEX_SLICE_WRITER_COLOR_OFFSET
    global.get $index_slice_writer_color_len
    i32.add
    global.get $INDEX_HEADER_BYTES
    i32.sub
  )

  (func $index_counter_writer_payload_len (result i32)
    global.get $INDEX_COUNTER_WRITER_VALUE_OFFSET
    global.get $index_writer_count
    i32.const 8
    i32.mul
    i32.add
    global.get $INDEX_HEADER_BYTES
    i32.sub
  )

  (func $index_writer_row_ptr (param $offset i32) (param $row i32) (param $width i32) (result i32)
    global.get $index_writer_page
    local.get $offset
    i32.add
    local.get $row
    local.get $width
    i32.mul
    i32.add
  )

  (func $index_writer_write_directory
    (local $dir i32)

    global.get $index_writer_page
    global.get $INDEX_HEADER_BYTES
    i32.add
    local.set $dir

    local.get $dir
    global.get $INDEX_DIRECTORY_VERSION
    i32.store8

    local.get $dir
    i32.const 1
    i32.add
    i32.const 7
    i32.store8

    local.get $dir
    i32.const 2
    i32.add
    global.get $INDEX_WRITER_DIRECTORY_BYTES
    i32.store16

    local.get $dir
    i32.const 4
    i32.add
    global.get $INDEX_RAW_COLUMN_TRACK_ID
    global.get $INDEX_ENCODING_FIXED32
    global.get $INDEX_WRITER_TRACK_OFFSET
    global.get $index_writer_count
    i32.const 4
    i32.mul
    global.get $index_writer_count
    call $write_directory_entry

    local.get $dir
    i32.const 20
    i32.add
    global.get $INDEX_RAW_COLUMN_TS_DELTA
    global.get $INDEX_ENCODING_FIXED32
    global.get $INDEX_WRITER_TS_OFFSET
    global.get $index_writer_count
    i32.const 4
    i32.mul
    global.get $index_writer_count
    call $write_directory_entry

    local.get $dir
    i32.const 36
    i32.add
    global.get $INDEX_RAW_COLUMN_DUR
    global.get $INDEX_ENCODING_FIXED32
    global.get $INDEX_WRITER_DUR_OFFSET
    global.get $index_writer_count
    i32.const 4
    i32.mul
    global.get $index_writer_count
    call $write_directory_entry

    local.get $dir
    i32.const 52
    i32.add
    global.get $INDEX_RAW_COLUMN_NAME_ID
    global.get $INDEX_ENCODING_FIXED32
    global.get $INDEX_WRITER_NAME_OFFSET
    global.get $index_writer_count
    i32.const 4
    i32.mul
    global.get $index_writer_count
    call $write_directory_entry

    local.get $dir
    i32.const 68
    i32.add
    global.get $INDEX_RAW_COLUMN_CAT_ID
    global.get $INDEX_ENCODING_FIXED32
    global.get $INDEX_WRITER_CAT_OFFSET
    global.get $index_writer_count
    i32.const 4
    i32.mul
    global.get $index_writer_count
    call $write_directory_entry

    local.get $dir
    i32.const 84
    i32.add
    global.get $INDEX_RAW_COLUMN_PHASE
    global.get $INDEX_ENCODING_FIXED8
    global.get $INDEX_WRITER_PHASE_OFFSET
    global.get $index_writer_count
    global.get $index_writer_count
    call $write_directory_entry

    local.get $dir
    i32.const 100
    i32.add
    global.get $INDEX_RAW_COLUMN_FLAGS
    global.get $INDEX_ENCODING_FIXED8
    global.get $INDEX_WRITER_FLAGS_OFFSET
    global.get $index_writer_count
    global.get $index_writer_count
    call $write_directory_entry
  )

  (func $index_slice_writer_write_directory
    (local $dir i32)

    global.get $index_writer_page
    global.get $INDEX_HEADER_BYTES
    i32.add
    local.set $dir

    local.get $dir
    global.get $INDEX_DIRECTORY_VERSION
    i32.store8

    local.get $dir
    i32.const 1
    i32.add
    i32.const 6
    i32.store8

    local.get $dir
    i32.const 2
    i32.add
    global.get $INDEX_SLICE_WRITER_DIRECTORY_BYTES
    i32.store16

    local.get $dir
    i32.const 4
    i32.add
    global.get $INDEX_SLICE_COLUMN_START_TS
    global.get $INDEX_ENCODING_UVARINT
    global.get $INDEX_SLICE_WRITER_START_OFFSET
    global.get $index_slice_writer_start_len
    global.get $index_writer_count
    call $write_directory_entry

    local.get $dir
    i32.const 20
    i32.add
    global.get $INDEX_SLICE_COLUMN_DUR
    global.get $INDEX_ENCODING_UVARINT
    global.get $INDEX_SLICE_WRITER_DUR_OFFSET
    global.get $index_slice_writer_dur_len
    global.get $index_writer_count
    call $write_directory_entry

    local.get $dir
    i32.const 36
    i32.add
    global.get $INDEX_SLICE_COLUMN_NAME_ID
    global.get $INDEX_ENCODING_DICT16
    global.get $INDEX_SLICE_WRITER_NAME_OFFSET
    global.get $index_writer_count
    i32.const 2
    i32.mul
    global.get $index_writer_count
    call $write_directory_entry

    local.get $dir
    i32.const 52
    i32.add
    global.get $INDEX_SLICE_COLUMN_DEPTH
    global.get $INDEX_ENCODING_FIXED8
    global.get $INDEX_SLICE_WRITER_DEPTH_OFFSET
    global.get $index_writer_count
    global.get $index_writer_count
    call $write_directory_entry

    local.get $dir
    i32.const 68
    i32.add
    global.get $INDEX_SLICE_COLUMN_CAT_ID
    global.get $INDEX_ENCODING_DICT16
    global.get $INDEX_SLICE_WRITER_CAT_OFFSET
    global.get $index_writer_count
    i32.const 2
    i32.mul
    global.get $index_writer_count
    call $write_directory_entry

    local.get $dir
    i32.const 84
    i32.add
    global.get $INDEX_SLICE_COLUMN_COLOR
    global.get $INDEX_ENCODING_UVARINT
    global.get $INDEX_SLICE_WRITER_COLOR_OFFSET
    global.get $index_slice_writer_color_len
    global.get $index_writer_count
    call $write_directory_entry
  )

  (func $index_counter_writer_write_directory
    (local $dir i32)

    global.get $index_writer_page
    global.get $INDEX_HEADER_BYTES
    i32.add
    local.set $dir

    local.get $dir
    global.get $INDEX_DIRECTORY_VERSION
    i32.store8

    local.get $dir
    i32.const 1
    i32.add
    i32.const 3
    i32.store8

    local.get $dir
    i32.const 2
    i32.add
    global.get $INDEX_COUNTER_WRITER_DIRECTORY_BYTES
    i32.store16

    local.get $dir
    i32.const 4
    i32.add
    global.get $INDEX_COUNTER_COLUMN_TS
    global.get $INDEX_ENCODING_UVARINT
    global.get $INDEX_COUNTER_WRITER_TS_OFFSET
    global.get $index_counter_writer_ts_len
    global.get $index_writer_count
    call $write_directory_entry

    local.get $dir
    i32.const 20
    i32.add
    global.get $INDEX_COUNTER_COLUMN_NAME_ID
    global.get $INDEX_ENCODING_DICT16
    global.get $INDEX_COUNTER_WRITER_NAME_OFFSET
    global.get $index_writer_count
    i32.const 2
    i32.mul
    global.get $index_writer_count
    call $write_directory_entry

    local.get $dir
    i32.const 36
    i32.add
    global.get $INDEX_COUNTER_COLUMN_VALUE
    global.get $INDEX_ENCODING_FIXED64
    global.get $INDEX_COUNTER_WRITER_VALUE_OFFSET
    global.get $index_writer_count
    i32.const 8
    i32.mul
    global.get $index_writer_count
    call $write_directory_entry
  )

  (func $index_writer_prepare_page
    global.get $index_writer_page
    global.get $OPFS_PAGE_SIZE
    call $zero_bytes
    i32.const 0
    global.set $index_slice_writer_start_len
    i32.const 0
    global.set $index_slice_writer_dur_len
    i32.const 0
    global.set $index_slice_writer_color_len
    i32.const 0
    global.set $index_counter_writer_ts_len
    i32.const 0
    global.set $index_writer_bucket_end
    i32.const -1
    global.set $index_writer_page_track
  )

  (func $index_writer_commit_page (result i32)
    (local $status i32)
    (local $payload_len i32)
    (local $payload_crc i32)
    (local $written i32)

    global.get $index_writer_count
    i32.eqz
    if
      global.get $INDEX_WRITER_STATUS_OK
      return
    end

    global.get $index_writer_mode
    i32.const 1
    i32.eq
    if (result i32)
      call $index_slice_writer_write_directory
      call $index_slice_writer_payload_len
    else
      global.get $index_writer_mode
      i32.const 2
      i32.eq
      if (result i32)
        call $index_counter_writer_write_directory
        call $index_counter_writer_payload_len
      else
        call $index_writer_write_directory
        call $index_writer_payload_len
      end
    end
    local.set $payload_len

    global.get $index_writer_page
    i32.const 0
    global.get $index_writer_bucket_start
    i64.extend_i32_u
    global.get $index_writer_bucket_end
    i64.extend_i32_u
    global.get $index_writer_count
    local.get $payload_len
    global.get $index_writer_mode
    i32.const 1
    i32.eq
    if (result i32)
      global.get $INDEX_DECODE_HINT_COMPACT_SLICES
      global.get $index_writer_page_track
      i32.const 8
      i32.shl
      i32.or
    else
      global.get $index_writer_mode
      i32.const 2
      i32.eq
      if (result i32)
        global.get $INDEX_DECODE_HINT_COUNTERS
        global.get $index_writer_page_track
        i32.const 8
        i32.shl
        i32.or
      else
        i32.const 0
      end
    end
    global.get $index_writer_dict_epoch
    global.get $index_writer_next_page_id
    i64.extend_i32_u
    call $index_write_header

    global.get $index_writer_page
    global.get $INDEX_HEADER_BYTES
    i32.add
    local.get $payload_len
    call $index_crc32c
    local.set $payload_crc

    global.get $index_writer_page
    global.get $OPFS_PAGE_SIZE
    local.get $payload_crc
    global.get $index_writer_previous_page_id
    global.get $index_writer_commit_sequence
    i32.const 1
    i32.add
    call $index_write_footer

    global.get $index_writer_page
    global.get $OPFS_PAGE_SIZE
    call $index_validate_page
    local.set $status

    global.get $index_writer_file
    global.get $index_writer_next_page_id
    i64.extend_i32_u
    global.get $OPFS_PAGE_SIZE
    i64.extend_i32_u
    i64.mul
    global.get $index_writer_page
    global.get $OPFS_PAGE_SIZE
    call $opfs_index_write
    local.set $written

    local.get $written
    global.get $OPFS_PAGE_SIZE
    i32.ne
    if
      global.get $INDEX_WRITER_STATUS_HOST_WRITE_FAILED
      return
    end

    global.get $index_writer_mode
    i32.const 1
    i32.eq
    if
      global.get $index_writer_page_track
      global.get $index_writer_next_page_id
      global.get $index_writer_bucket_start
      global.get $index_writer_bucket_end
      global.get $index_writer_count
      call $index_page_catalog_add_slice_page
    end

    global.get $index_writer_next_page_id
    global.set $index_writer_previous_page_id
    global.get $index_writer_next_page_id
    i32.const 1
    i32.add
    global.set $index_writer_next_page_id
    global.get $index_writer_committed_pages
    i32.const 1
    i32.add
    global.set $index_writer_committed_pages
    global.get $index_writer_committed_events
    global.get $index_writer_count
    i32.add
    global.set $index_writer_committed_events
    global.get $index_writer_commit_sequence
    i32.const 1
    i32.add
    global.set $index_writer_commit_sequence
    i32.const 0
    global.set $index_writer_count
    i32.const -1
    global.set $index_writer_page_track

    global.get $INDEX_WRITER_STATUS_OK
  )

  (func $index_writer_append_u32 (param $offset i32) (param $value i32)
    local.get $offset
    global.get $index_writer_count
    i32.const 4
    call $index_writer_row_ptr
    local.get $value
    i32.store
  )

  (func $index_writer_append_u8 (param $offset i32) (param $value i32)
    local.get $offset
    global.get $index_writer_count
    i32.const 1
    call $index_writer_row_ptr
    local.get $value
    i32.store8
  )
