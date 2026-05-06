(module
  (import "env" "memory" (memory $memory 1 32768))
  (import "host" "opfs_index_read" (func $opfs_index_read (param i32 i64 i32 i32) (result i32)))
  (import "host" "opfs_index_write" (func $opfs_index_write (param i32 i64 i32 i32) (result i32)))
  (import "host" "opfs_index_flush" (func $opfs_index_flush (param i32) (result i32)))
  (import "mem" "MEM_INDEX_CACHE_BASE" (global $MEM_INDEX_CACHE_BASE i32))
  (import "mem" "OPFS_PAGE_SIZE" (global $OPFS_PAGE_SIZE i32))

  (global $INDEX_PAGE_MAGIC_TRCI (export "INDEX_PAGE_MAGIC_TRCI") i32 (i32.const 0x49435254))
  (global $INDEX_FOOTER_MAGIC_DONE (export "INDEX_FOOTER_MAGIC_DONE") i32 (i32.const 0x454E4F44))
  (global $INDEX_FORMAT_VERSION (export "INDEX_FORMAT_VERSION") i32 (i32.const 1))
  (global $INDEX_HEADER_BYTES (export "INDEX_HEADER_BYTES") i32 (i32.const 64))
  (global $INDEX_FOOTER_BYTES (export "INDEX_FOOTER_BYTES") i32 (i32.const 16))
  (global $INDEX_COLUMN_ENTRY_BYTES (export "INDEX_COLUMN_ENTRY_BYTES") i32 (i32.const 16))
  (global $INDEX_DIRECTORY_VERSION (export "INDEX_DIRECTORY_VERSION") i32 (i32.const 1))

  (global $INDEX_STATUS_OK (export "INDEX_STATUS_OK") i32 (i32.const 0))
  (global $INDEX_STATUS_BAD_PAGE_SIZE (export "INDEX_STATUS_BAD_PAGE_SIZE") i32 (i32.const 1))
  (global $INDEX_STATUS_BAD_MAGIC (export "INDEX_STATUS_BAD_MAGIC") i32 (i32.const 2))
  (global $INDEX_STATUS_BAD_VERSION (export "INDEX_STATUS_BAD_VERSION") i32 (i32.const 3))
  (global $INDEX_STATUS_BAD_HEADER_SIZE (export "INDEX_STATUS_BAD_HEADER_SIZE") i32 (i32.const 4))
  (global $INDEX_STATUS_BAD_PAYLOAD_BOUNDS (export "INDEX_STATUS_BAD_PAYLOAD_BOUNDS") i32 (i32.const 5))
  (global $INDEX_STATUS_BAD_HEADER_CRC (export "INDEX_STATUS_BAD_HEADER_CRC") i32 (i32.const 6))
  (global $INDEX_STATUS_BAD_FOOTER (export "INDEX_STATUS_BAD_FOOTER") i32 (i32.const 7))
  (global $INDEX_STATUS_BAD_PAYLOAD_CRC (export "INDEX_STATUS_BAD_PAYLOAD_CRC") i32 (i32.const 8))
  (global $INDEX_STATUS_BAD_DIRECTORY (export "INDEX_STATUS_BAD_DIRECTORY") i32 (i32.const 9))
  (global $INDEX_STATUS_MISSING_REQUIRED_COLUMN (export "INDEX_STATUS_MISSING_REQUIRED_COLUMN") i32 (i32.const 10))
  (global $INDEX_STATUS_UNUSED_NOT_ZERO (export "INDEX_STATUS_UNUSED_NOT_ZERO") i32 (i32.const 11))

  (global $INDEX_WRITER_STATUS_OK (export "INDEX_WRITER_STATUS_OK") i32 (i32.const 0))
  (global $INDEX_WRITER_STATUS_NOT_INITIALIZED (export "INDEX_WRITER_STATUS_NOT_INITIALIZED") i32 (i32.const 20))
  (global $INDEX_WRITER_STATUS_HOST_WRITE_FAILED (export "INDEX_WRITER_STATUS_HOST_WRITE_FAILED") i32 (i32.const 21))
  (global $INDEX_WRITER_STATUS_HOST_FLUSH_FAILED (export "INDEX_WRITER_STATUS_HOST_FLUSH_FAILED") i32 (i32.const 22))

  (global $INDEX_READER_STATUS_OK (export "INDEX_READER_STATUS_OK") i32 (i32.const 0))
  (global $INDEX_READER_STATUS_NOT_INITIALIZED (export "INDEX_READER_STATUS_NOT_INITIALIZED") i32 (i32.const 30))
  (global $INDEX_READER_STATUS_MISSING_PAGE (export "INDEX_READER_STATUS_MISSING_PAGE") i32 (i32.const 31))
  (global $INDEX_READER_STATUS_CORRUPT_PAGE (export "INDEX_READER_STATUS_CORRUPT_PAGE") i32 (i32.const 32))
  (global $INDEX_READER_STATUS_LEVEL_MISMATCH (export "INDEX_READER_STATUS_LEVEL_MISMATCH") i32 (i32.const 33))

  (global $INDEX_RAW_COLUMN_TRACK_ID (export "INDEX_RAW_COLUMN_TRACK_ID") i32 (i32.const 1))
  (global $INDEX_RAW_COLUMN_TS_DELTA (export "INDEX_RAW_COLUMN_TS_DELTA") i32 (i32.const 2))
  (global $INDEX_RAW_COLUMN_DUR (export "INDEX_RAW_COLUMN_DUR") i32 (i32.const 3))
  (global $INDEX_RAW_COLUMN_NAME_ID (export "INDEX_RAW_COLUMN_NAME_ID") i32 (i32.const 4))
  (global $INDEX_RAW_COLUMN_CAT_ID (export "INDEX_RAW_COLUMN_CAT_ID") i32 (i32.const 5))
  (global $INDEX_RAW_COLUMN_PHASE (export "INDEX_RAW_COLUMN_PHASE") i32 (i32.const 6))
  (global $INDEX_RAW_COLUMN_FLAGS (export "INDEX_RAW_COLUMN_FLAGS") i32 (i32.const 7))

  (global $INDEX_ENCODING_FIXED8 (export "INDEX_ENCODING_FIXED8") i32 (i32.const 5))
  (global $INDEX_ENCODING_FIXED32 (export "INDEX_ENCODING_FIXED32") i32 (i32.const 8))

  (global $INDEX_WRITER_ROWS_PER_PAGE (export "INDEX_WRITER_ROWS_PER_PAGE") i32 (i32.const 2900))
  (global $INDEX_WRITER_DIRECTORY_BYTES i32 (i32.const 116))
  (global $INDEX_WRITER_COLUMN_BASE i32 (i32.const 180))
  (global $INDEX_WRITER_TRACK_OFFSET i32 (i32.const 180))
  (global $INDEX_WRITER_TS_OFFSET i32 (i32.const 11780))
  (global $INDEX_WRITER_DUR_OFFSET i32 (i32.const 23380))
  (global $INDEX_WRITER_NAME_OFFSET i32 (i32.const 34980))
  (global $INDEX_WRITER_CAT_OFFSET i32 (i32.const 46580))
  (global $INDEX_WRITER_PHASE_OFFSET i32 (i32.const 58180))
  (global $INDEX_WRITER_FLAGS_OFFSET i32 (i32.const 61080))

  (global $index_writer_file (mut i32) (i32.const 0))
  (global $index_writer_page (mut i32) (i32.const 0))
  (global $index_writer_dict_epoch (mut i32) (i32.const 0))
  (global $index_writer_count (mut i32) (i32.const 0))
  (global $index_writer_next_page_id (mut i32) (i32.const 0))
  (global $index_writer_committed_pages (mut i32) (i32.const 0))
  (global $index_writer_committed_events (mut i32) (i32.const 0))
  (global $index_writer_previous_page_id (mut i32) (i32.const -1))
  (global $index_writer_commit_sequence (mut i32) (i32.const 0))
  (global $index_writer_bucket_start (mut i32) (i32.const 0))

  (global $index_reader_file (mut i32) (i32.const 0))
  (global $index_reader_cached_level (mut i32) (i32.const -1))
  (global $index_reader_cached_page_id (mut i32) (i32.const -1))
  (global $index_reader_last_status (mut i32) (i32.const 0))
  (global $index_reader_last_hit (mut i32) (i32.const 0))

  (func $load_payload_len (param $page i32) (result i32)
    local.get $page
    i32.const 32
    i32.add
    i32.load
  )

  (func $payload_start (param $page i32) (result i32)
    local.get $page
    global.get $INDEX_HEADER_BYTES
    i32.add
  )

  (func $footer_start (param $page i32) (param $page_len i32) (result i32)
    local.get $page
    local.get $page_len
    i32.add
    global.get $INDEX_FOOTER_BYTES
    i32.sub
  )

  (func $entry_ptr (param $page i32) (param $index i32) (result i32)
    local.get $page
    global.get $INDEX_HEADER_BYTES
    i32.add
    i32.const 4
    i32.add
    local.get $index
    global.get $INDEX_COLUMN_ENTRY_BYTES
    i32.mul
    i32.add
  )

  (func $range_end (param $offset i32) (param $len i32) (result i32)
    local.get $offset
    local.get $len
    i32.add
  )

  (func $zero_bytes (param $ptr i32) (param $len i32)
    (local $i i32)

    block $done
      loop $loop
        local.get $i
        local.get $len
        i32.ge_u
        br_if $done

        local.get $ptr
        local.get $i
        i32.add
        i32.const 0
        i32.store8

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      end
    end
  )

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

  (func $index_writer_prepare_page
    global.get $index_writer_page
    global.get $OPFS_PAGE_SIZE
    call $zero_bytes
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

    call $index_writer_write_directory
    call $index_writer_payload_len
    local.set $payload_len

    global.get $index_writer_page
    i32.const 0
    global.get $index_writer_bucket_start
    i64.extend_i32_u
    global.get $index_writer_bucket_start
    global.get $index_writer_page
    global.get $INDEX_WRITER_TS_OFFSET
    i32.add
    global.get $index_writer_count
    i32.const 1
    i32.sub
    i32.const 4
    i32.mul
    i32.add
    i32.load
    i32.add
    i64.extend_i32_u
    global.get $index_writer_count
    local.get $payload_len
    i32.const 0
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
    i64.const 65536
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
    call $index_writer_prepare_page
  )

  (func (export "index_writer_append_event") (param $event_ptr i32) (result i32)
    (local $status i32)
    (local $ts i32)
    (local $dur i32)
    (local $track i32)
    (local $flags i32)

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
    i32.const 24
    i32.add
    i32.load
    i32.const 65537
    i32.mul
    local.get $event_ptr
    i32.const 28
    i32.add
    i32.load
    i32.xor
    local.set $track

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

    global.get $index_writer_count
    i32.eqz
    if
      local.get $ts
      global.set $index_writer_bucket_start
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
    local.get $event_ptr
    i32.const 4
    i32.add
    i32.load
    call $index_writer_append_u32

    global.get $INDEX_WRITER_CAT_OFFSET
    i32.const 0
    call $index_writer_append_u32

    global.get $INDEX_WRITER_PHASE_OFFSET
    local.get $event_ptr
    i32.load8_u
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

  (func $index_reader_clear_cache
    i32.const -1
    global.set $index_reader_cached_level
    i32.const -1
    global.set $index_reader_cached_page_id
    i32.const 0
    global.set $index_reader_last_hit
  )

  (func (export "index_reader_init") (param $index_file i32)
    local.get $index_file
    global.set $index_reader_file
    global.get $INDEX_READER_STATUS_OK
    global.set $index_reader_last_status
    call $index_reader_clear_cache
  )

  (func (export "read_page") (param $level i32) (param $page_id i32) (result i32)
    (local $read_bytes i32)
    (local $status i32)

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
    global.get $index_reader_cached_level
    i32.eq
    local.get $page_id
    global.get $index_reader_cached_page_id
    i32.eq
    i32.and
    if
      global.get $INDEX_READER_STATUS_OK
      global.set $index_reader_last_status
      i32.const 1
      global.set $index_reader_last_hit
      global.get $MEM_INDEX_CACHE_BASE
      return
    end

    i32.const 0
    global.set $index_reader_last_hit

    global.get $index_reader_file
    local.get $page_id
    i64.extend_i32_u
    i64.const 65536
    i64.mul
    global.get $OPFS_PAGE_SIZE
    global.get $MEM_INDEX_CACHE_BASE
    call $opfs_index_read
    local.set $read_bytes

    local.get $read_bytes
    global.get $OPFS_PAGE_SIZE
    i32.ne
    if
      global.get $INDEX_READER_STATUS_MISSING_PAGE
      global.set $index_reader_last_status
      call $index_reader_clear_cache
      i32.const 0
      return
    end

    global.get $MEM_INDEX_CACHE_BASE
    global.get $OPFS_PAGE_SIZE
    call $index_validate_page
    local.tee $status
    global.get $INDEX_STATUS_OK
    i32.ne
    if
      global.get $INDEX_READER_STATUS_CORRUPT_PAGE
      global.set $index_reader_last_status
      call $index_reader_clear_cache
      i32.const 0
      return
    end

    global.get $MEM_INDEX_CACHE_BASE
    i32.const 8
    i32.add
    i32.load
    local.get $level
    i32.ne
    if
      global.get $INDEX_READER_STATUS_LEVEL_MISMATCH
      global.set $index_reader_last_status
      call $index_reader_clear_cache
      i32.const 0
      return
    end

    local.get $level
    global.set $index_reader_cached_level
    local.get $page_id
    global.set $index_reader_cached_page_id
    global.get $INDEX_READER_STATUS_OK
    global.set $index_reader_last_status
    global.get $MEM_INDEX_CACHE_BASE
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

    i32.const 1
    local.set $col
    block $required_done
      loop $required
        local.get $col
        i32.const 7
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
)
