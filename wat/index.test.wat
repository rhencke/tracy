(module
  (import "env" "memory" (memory $memory 1))
  (import "watwat" "assert_eq_i32"
    (func $assert_eq_i32 (param i32) (param i32) (param i32)))
  (import "watwat" "assert_eq_i64"
    (func $assert_eq_i64 (param i64) (param i64) (param i32)))
  (import "index" "INDEX_PAGE_MAGIC_TRCI" (global $INDEX_PAGE_MAGIC_TRCI i32))
  (import "index" "INDEX_FOOTER_MAGIC_DONE" (global $INDEX_FOOTER_MAGIC_DONE i32))
  (import "index" "INDEX_HEADER_BYTES" (global $INDEX_HEADER_BYTES i32))
  (import "index" "INDEX_FOOTER_BYTES" (global $INDEX_FOOTER_BYTES i32))
  (import "index" "INDEX_STATUS_OK" (global $INDEX_STATUS_OK i32))
  (import "index" "INDEX_STATUS_BAD_PAGE_SIZE" (global $INDEX_STATUS_BAD_PAGE_SIZE i32))
  (import "index" "INDEX_STATUS_BAD_MAGIC" (global $INDEX_STATUS_BAD_MAGIC i32))
  (import "index" "INDEX_STATUS_BAD_VERSION" (global $INDEX_STATUS_BAD_VERSION i32))
  (import "index" "INDEX_STATUS_BAD_HEADER_SIZE" (global $INDEX_STATUS_BAD_HEADER_SIZE i32))
  (import "index" "INDEX_STATUS_BAD_PAYLOAD_BOUNDS" (global $INDEX_STATUS_BAD_PAYLOAD_BOUNDS i32))
  (import "index" "INDEX_STATUS_BAD_HEADER_CRC" (global $INDEX_STATUS_BAD_HEADER_CRC i32))
  (import "index" "INDEX_STATUS_BAD_FOOTER" (global $INDEX_STATUS_BAD_FOOTER i32))
  (import "index" "INDEX_STATUS_BAD_PAYLOAD_CRC" (global $INDEX_STATUS_BAD_PAYLOAD_CRC i32))
  (import "index" "INDEX_STATUS_BAD_DIRECTORY" (global $INDEX_STATUS_BAD_DIRECTORY i32))
  (import "index" "INDEX_STATUS_MISSING_REQUIRED_COLUMN" (global $INDEX_STATUS_MISSING_REQUIRED_COLUMN i32))
  (import "index" "INDEX_STATUS_UNUSED_NOT_ZERO" (global $INDEX_STATUS_UNUSED_NOT_ZERO i32))
  (import "index" "INDEX_WRITER_STATUS_OK" (global $INDEX_WRITER_STATUS_OK i32))
  (import "index" "INDEX_WRITER_STATUS_NOT_INITIALIZED" (global $INDEX_WRITER_STATUS_NOT_INITIALIZED i32))
  (import "index" "INDEX_WRITER_STATUS_HOST_WRITE_FAILED" (global $INDEX_WRITER_STATUS_HOST_WRITE_FAILED i32))
  (import "index" "INDEX_WRITER_STATUS_HOST_FLUSH_FAILED" (global $INDEX_WRITER_STATUS_HOST_FLUSH_FAILED i32))
  (import "index" "INDEX_READER_STATUS_OK" (global $INDEX_READER_STATUS_OK i32))
  (import "index" "INDEX_READER_STATUS_NOT_INITIALIZED" (global $INDEX_READER_STATUS_NOT_INITIALIZED i32))
  (import "index" "INDEX_READER_STATUS_MISSING_PAGE" (global $INDEX_READER_STATUS_MISSING_PAGE i32))
  (import "index" "INDEX_READER_STATUS_CORRUPT_PAGE" (global $INDEX_READER_STATUS_CORRUPT_PAGE i32))
  (import "index" "INDEX_READER_STATUS_LEVEL_MISMATCH" (global $INDEX_READER_STATUS_LEVEL_MISMATCH i32))
  (import "index" "INDEX_WRITER_ROWS_PER_PAGE" (global $INDEX_WRITER_ROWS_PER_PAGE i32))
  (import "index" "INDEX_RAW_COLUMN_TRACK_ID" (global $INDEX_RAW_COLUMN_TRACK_ID i32))
  (import "index" "INDEX_RAW_COLUMN_TS_DELTA" (global $INDEX_RAW_COLUMN_TS_DELTA i32))
  (import "index" "INDEX_RAW_COLUMN_DUR" (global $INDEX_RAW_COLUMN_DUR i32))
  (import "index" "INDEX_RAW_COLUMN_NAME_ID" (global $INDEX_RAW_COLUMN_NAME_ID i32))
  (import "index" "INDEX_RAW_COLUMN_CAT_ID" (global $INDEX_RAW_COLUMN_CAT_ID i32))
  (import "index" "INDEX_RAW_COLUMN_PHASE" (global $INDEX_RAW_COLUMN_PHASE i32))
  (import "index" "INDEX_RAW_COLUMN_FLAGS" (global $INDEX_RAW_COLUMN_FLAGS i32))
  (import "index" "index_crc32c"
    (func $index_crc32c (param i32) (param i32) (result i32)))
  (import "index" "index_header_crc"
    (func $index_header_crc (param i32) (result i32)))
  (import "index" "index_update_header_crc"
    (func $index_update_header_crc (param i32) (result i32)))
  (import "index" "index_write_header"
    (func $index_write_header (param i32 i32 i64 i64 i32 i32 i32 i32 i64)))
  (import "index" "index_write_footer"
    (func $index_write_footer (param i32 i32 i32 i32 i32)))
  (import "index" "index_column_span"
    (func $index_column_span (param i32 i32) (result i32 i32 i32 i32)))
  (import "index" "index_validate_page"
    (func $index_validate_page (param i32 i32) (result i32)))
  (import "index" "index_writer_init"
    (func $index_writer_init (param i32 i32 i32)))
  (import "index" "index_writer_append_event"
    (func $index_writer_append_event (param i32) (result i32)))
  (import "index" "index_writer_flush"
    (func $index_writer_flush (result i32)))
  (import "index" "index_writer_pending_rows"
    (func $index_writer_pending_rows (result i32)))
  (import "index" "index_writer_committed_pages"
    (func $index_writer_committed_pages (result i32)))
  (import "index" "index_writer_committed_events"
    (func $index_writer_committed_events (result i32)))
  (import "index" "index_writer_next_page_id"
    (func $index_writer_next_page_id (result i32)))
  (import "index" "index_reader_init"
    (func $index_reader_init (param i32)))
  (import "index" "read_page"
    (func $read_page (param i32 i32) (result i32)))
  (import "index" "index_reader_status"
    (func $index_reader_status (result i32)))
  (import "index" "index_reader_cache_hit"
    (func $index_reader_cache_hit (result i32)))
  (import "index" "index_reader_cached_page_id"
    (func $index_reader_cached_page_id (result i32)))
  (import "index" "index_reader_cache_slots"
    (func $index_reader_cache_slots (result i32)))
  (import "index" "index_reader_last_slot"
    (func $index_reader_last_slot (result i32)))
  (import "index" "index_reader_configure_cache"
    (func $index_reader_configure_cache (param i32) (result i32)))
  (import "index" "index_reader_evict_cold_pages"
    (func $index_reader_evict_cold_pages (param i32) (result i32)))
  (import "mem" "MEM_INDEX_CACHE_BASE" (global $MEM_INDEX_CACHE_BASE i32))
  (import "mem" "MEM_INDEX_CACHE_SIZE" (global $MEM_INDEX_CACHE_SIZE i32))

  (global $PAGE i32 (i32.const 0))
  (global $ALT_PAGE i32 (i32.const 65536))
  (global $ALT_PAGE_2 i32 (i32.const 131072))
  (global $ALT_PAGE_3 i32 (i32.const 196608))
  (global $PAGE_BYTES i32 (i32.const 65536))
  (global $PAYLOAD_LEN i32 (i32.const 135))
  (global $DIR_PTR i32 (i32.const 64))
  (global $DIR_BYTES i32 (i32.const 116))
  (global $COL_PAYLOAD_BASE i32 (i32.const 192))
  (global $EVENT i32 (i32.const 4096))

  (func (export "message_for") (param $code i32) (result i32 i32)
    i32.const 0
    i32.const 0
  )

  (func $zero_page
    (local $i i32)

    block $done
      loop $loop
        local.get $i
        global.get $PAGE_BYTES
        i32.ge_u
        br_if $done

        global.get $PAGE
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

  (func $write_entry (param $index i32) (param $column_id i32)
    (local $entry i32)

    global.get $DIR_PTR
    i32.const 4
    i32.add
    local.get $index
    i32.const 16
    i32.mul
    i32.add
    local.set $entry

    local.get $entry
    local.get $column_id
    i32.store8

    local.get $entry
    i32.const 1
    i32.add
    i32.const 5
    i32.store8

    local.get $entry
    i32.const 2
    i32.add
    i32.const 0
    i32.store16

    local.get $entry
    i32.const 4
    i32.add
    global.get $COL_PAYLOAD_BASE
    local.get $index
    i32.add
    i32.store

    local.get $entry
    i32.const 8
    i32.add
    i32.const 1
    i32.store

    local.get $entry
    i32.const 12
    i32.add
    i32.const 1
    i32.store

    global.get $COL_PAYLOAD_BASE
    local.get $index
    i32.add
    local.get $column_id
    i32.store8
  )

  (func $write_directory
    (local $i i32)

    global.get $DIR_PTR
    i32.const 1
    i32.store8

    global.get $DIR_PTR
    i32.const 1
    i32.add
    i32.const 7
    i32.store8

    global.get $DIR_PTR
    i32.const 2
    i32.add
    global.get $DIR_BYTES
    i32.store16

    block $done
      loop $loop
        local.get $i
        i32.const 7
        i32.ge_u
        br_if $done

        local.get $i
        local.get $i
        i32.const 1
        i32.add
        call $write_entry

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      end
    end
  )

  (func $commit_footer
    global.get $PAGE
    global.get $PAGE_BYTES
    global.get $PAGE
    global.get $INDEX_HEADER_BYTES
    i32.add
    global.get $PAGE
    i32.const 32
    i32.add
    i32.load
    call $index_crc32c
    i32.const -1
    i32.const 1
    call $index_write_footer
  )

  (func $fill_valid_page
    call $zero_page
    call $write_directory

    global.get $PAGE
    i32.const 0
    i64.const 100
    i64.const 200
    i32.const 1
    global.get $PAYLOAD_LEN
    i32.const 0
    i32.const 1
    i64.const 42
    call $index_write_header

    call $commit_footer
  )

  (func $copy_page_to_alt
    (local $i i32)

    i32.const 1
    memory.grow
    drop

    block $done
      loop $loop
        local.get $i
        global.get $PAGE_BYTES
        i32.ge_u
        br_if $done

        global.get $ALT_PAGE
        local.get $i
        i32.add
        global.get $PAGE
        local.get $i
        i32.add
        i32.load8_u
        i32.store8

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      end
    end
  )

  (func $grow_to_index_cache
    (local $needed i32)

    global.get $MEM_INDEX_CACHE_BASE
    global.get $PAGE_BYTES
    i32.const 3
    i32.mul
    i32.add
    i32.const 65535
    i32.add
    i32.const 16
    i32.shr_u
    local.set $needed

    local.get $needed
    memory.size
    i32.gt_u
    if
      local.get $needed
      memory.size
      i32.sub
      memory.grow
      drop
    end
  )

  (func $write_event
    (param $phase i32)
    (param $name i32)
    (param $ts f64)
    (param $dur f64)
    (param $pid i32)
    (param $tid i32)
    (param $args_len i32)
    global.get $EVENT
    local.get $phase
    i32.store8

    global.get $EVENT
    i32.const 4
    i32.add
    local.get $name
    i32.store

    global.get $EVENT
    i32.const 8
    i32.add
    local.get $ts
    f64.store

    global.get $EVENT
    i32.const 16
    i32.add
    local.get $dur
    f64.store

    global.get $EVENT
    i32.const 24
    i32.add
    local.get $pid
    i32.store

    global.get $EVENT
    i32.const 28
    i32.add
    local.get $tid
    i32.store

    global.get $EVENT
    i32.const 32
    i32.add
    i32.const 8192
    i32.store

    global.get $EVENT
    i32.const 36
    i32.add
    local.get $args_len
    i32.store
  )

  (func $write_reader_fixture_page (param $page_ptr i32) (param $name i32) (param $dict_epoch i32)
    i32.const 21
    local.get $page_ptr
    local.get $dict_epoch
    call $index_writer_init

    i32.const 88
    local.get $name
    f64.const 1000
    f64.const 25
    i32.const 7
    i32.const 9
    i32.const 12
    call $write_event

    global.get $EVENT
    call $index_writer_append_event
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 94
    call $assert_eq_i32

    call $index_writer_flush
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 95
    call $assert_eq_i32
  )

  (func (export "test_index_constants")
    global.get $INDEX_PAGE_MAGIC_TRCI
    i32.const 0x49435254
    i32.const 1
    call $assert_eq_i32

    global.get $INDEX_FOOTER_MAGIC_DONE
    i32.const 0x454E4F44
    i32.const 2
    call $assert_eq_i32

    global.get $INDEX_HEADER_BYTES
    i32.const 64
    i32.const 3
    call $assert_eq_i32

    global.get $INDEX_FOOTER_BYTES
    i32.const 16
    i32.const 4
    call $assert_eq_i32
  )

  (func (export "test_crc32c_known_vector")
    i32.const 3000
    i64.const 0x3837363534333231
    i64.store

    i32.const 3008
    i32.const 0x00000039
    i32.store8

    i32.const 3000
    i32.const 9
    call $index_crc32c
    i32.const 0xE3069283
    i32.const 5
    call $assert_eq_i32
  )

  (func (export "test_header_footer_and_validation")
    call $fill_valid_page

    global.get $PAGE
    i32.load
    global.get $INDEX_PAGE_MAGIC_TRCI
    i32.const 6
    call $assert_eq_i32

    global.get $PAGE
    i32.const 48
    i32.add
    i64.load
    i64.const 42
    i32.const 7
    call $assert_eq_i64

    global.get $PAGE
    i32.const 44
    i32.add
    i32.load
    global.get $PAGE
    call $index_header_crc
    i32.const 8
    call $assert_eq_i32

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_OK
    i32.const 9
    call $assert_eq_i32
  )

  (func (export "test_column_span_finds_required_column")
    (local $ptr i32)
    (local $len i32)
    (local $encoding i32)
    (local $rows i32)

    call $fill_valid_page

    global.get $PAGE
    i32.const 4
    call $index_column_span
    local.set $rows
    local.set $encoding
    local.set $len
    local.set $ptr

    local.get $ptr
    i32.const 195
    i32.const 10
    call $assert_eq_i32

    local.get $len
    i32.const 1
    i32.const 11
    call $assert_eq_i32

    local.get $encoding
    i32.const 5
    i32.const 12
    call $assert_eq_i32

    local.get $rows
    i32.const 1
    i32.const 13
    call $assert_eq_i32
  )

  (func (export "test_validation_rejects_header_damage")
    call $fill_valid_page

    global.get $PAGE
    i32.const 1024
    call $index_validate_page
    global.get $INDEX_STATUS_BAD_PAGE_SIZE
    i32.const 23
    call $assert_eq_i32

    call $fill_valid_page

    global.get $PAGE
    i32.const 0
    i32.store

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_BAD_MAGIC
    i32.const 14
    call $assert_eq_i32

    call $fill_valid_page
    global.get $PAGE
    i32.const 28
    i32.add
    i32.const 2
    i32.store

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_BAD_HEADER_CRC
    i32.const 15
    call $assert_eq_i32

    call $fill_valid_page
    global.get $PAGE
    i32.const 4
    i32.add
    i32.const 2
    i32.store16

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_BAD_VERSION
    i32.const 24
    call $assert_eq_i32

    call $fill_valid_page
    global.get $PAGE
    i32.const 6
    i32.add
    i32.const 32
    i32.store16

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_BAD_HEADER_SIZE
    i32.const 25
    call $assert_eq_i32

    call $fill_valid_page
    global.get $PAGE
    i32.const 32
    i32.add
    i32.const 65520
    i32.store

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_BAD_PAYLOAD_BOUNDS
    i32.const 16
    call $assert_eq_i32
  )

  (func (export "test_validation_rejects_footer_payload_and_unused_damage")
    call $fill_valid_page

    global.get $PAGE
    global.get $PAGE_BYTES
    i32.add
    i32.const 4
    i32.sub
    i32.const 0
    i32.store

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_BAD_FOOTER
    i32.const 17
    call $assert_eq_i32

    call $fill_valid_page
    i32.const 192
    i32.const 99
    i32.store8

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_BAD_PAYLOAD_CRC
    i32.const 18
    call $assert_eq_i32

    call $fill_valid_page
    global.get $PAGE
    global.get $INDEX_HEADER_BYTES
    i32.add
    global.get $PAYLOAD_LEN
    i32.add
    i32.const 1
    i32.store8

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_UNUSED_NOT_ZERO
    i32.const 19
    call $assert_eq_i32
  )

  (func (export "test_validation_rejects_bad_directory_and_missing_required")
    call $fill_valid_page

    global.get $DIR_PTR
    i32.const 0
    i32.store8
    call $commit_footer

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_BAD_DIRECTORY
    i32.const 20
    call $assert_eq_i32

    call $fill_valid_page
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 6
    i32.const 16
    i32.mul
    i32.add
    i32.const 8
    i32.store8
    call $commit_footer

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_MISSING_REQUIRED_COLUMN
    i32.const 21
    call $assert_eq_i32

    call $fill_valid_page
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 16
    i32.add
    i32.const 4
    i32.add
    global.get $COL_PAYLOAD_BASE
    i32.store
    call $commit_footer

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_BAD_DIRECTORY
    i32.const 22
    call $assert_eq_i32
  )

  (func (export "test_validation_rejects_directory_shape_errors")
    call $fill_valid_page
    global.get $PAGE
    i32.const 32
    i32.add
    i32.const 3
    i32.store
    global.get $PAGE
    call $index_update_header_crc
    drop
    call $commit_footer

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_BAD_DIRECTORY
    i32.const 26
    call $assert_eq_i32

    call $fill_valid_page
    global.get $DIR_PTR
    i32.const 2
    i32.add
    i32.const 4
    i32.store16
    call $commit_footer

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_BAD_DIRECTORY
    i32.const 27
    call $assert_eq_i32

    call $fill_valid_page
    global.get $PAGE
    i32.const 32
    i32.add
    i32.const 100
    i32.store
    global.get $PAGE
    call $index_update_header_crc
    drop
    call $commit_footer

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_BAD_DIRECTORY
    i32.const 28
    call $assert_eq_i32

    call $fill_valid_page
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 4
    i32.add
    i32.const 100
    i32.store
    call $commit_footer

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_BAD_DIRECTORY
    i32.const 29
    call $assert_eq_i32

    call $fill_valid_page
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 4
    i32.add
    i32.const 198
    i32.store
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 8
    i32.add
    i32.const 10
    i32.store
    call $commit_footer

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_BAD_DIRECTORY
    i32.const 30
    call $assert_eq_i32
  )

  (func (export "test_validation_accepts_nonzero_page_base")
    call $fill_valid_page
    call $copy_page_to_alt

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_OK
    i32.const 31
    call $assert_eq_i32
  )

  (func (export "test_index_writer_flushes_partial_page")
    (local $ptr i32)
    (local $len i32)
    (local $encoding i32)
    (local $rows i32)

    i32.const 1
    memory.grow
    drop

    global.get $EVENT
    call $index_writer_append_event
    global.get $INDEX_WRITER_STATUS_NOT_INITIALIZED
    i32.const 32
    call $assert_eq_i32

    i32.const 21
    global.get $ALT_PAGE
    i32.const 3
    call $index_writer_init

    i32.const 88
    i32.const 1234
    f64.const 1000
    f64.const 25
    i32.const 7
    i32.const 9
    i32.const 12
    call $write_event

    global.get $EVENT
    call $index_writer_append_event
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 33
    call $assert_eq_i32

    call $index_writer_pending_rows
    i32.const 1
    i32.const 34
    call $assert_eq_i32

    call $index_writer_flush
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 35
    call $assert_eq_i32

    call $index_writer_pending_rows
    i32.const 0
    i32.const 36
    call $assert_eq_i32

    call $index_writer_committed_pages
    i32.const 1
    i32.const 37
    call $assert_eq_i32

    call $index_writer_committed_events
    i32.const 1
    i32.const 38
    call $assert_eq_i32

    call $index_writer_next_page_id
    i32.const 1
    i32.const 39
    call $assert_eq_i32

    global.get $ALT_PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_OK
    i32.const 40
    call $assert_eq_i32

    global.get $ALT_PAGE
    i32.const 28
    i32.add
    i32.load
    i32.const 1
    i32.const 41
    call $assert_eq_i32

    global.get $ALT_PAGE
    i32.const 40
    i32.add
    i32.load
    i32.const 3
    i32.const 42
    call $assert_eq_i32

    global.get $ALT_PAGE
    i32.const 48
    i32.add
    i64.load
    i64.const 0
    i32.const 43
    call $assert_eq_i64

    global.get $ALT_PAGE
    global.get $PAGE_BYTES
    i32.add
    i32.const 12
    i32.sub
    i32.load
    i32.const -1
    i32.const 44
    call $assert_eq_i32

    global.get $ALT_PAGE
    global.get $PAGE_BYTES
    i32.add
    i32.const 8
    i32.sub
    i32.load
    i32.const 1
    i32.const 45
    call $assert_eq_i32

    global.get $ALT_PAGE
    global.get $INDEX_RAW_COLUMN_TRACK_ID
    call $index_column_span
    local.set $rows
    local.set $encoding
    local.set $len
    local.set $ptr

    local.get $rows
    i32.const 1
    i32.const 46
    call $assert_eq_i32

    local.get $len
    i32.const 4
    i32.const 47
    call $assert_eq_i32

    local.get $ptr
    i32.load
    i32.const 458766
    i32.const 48
    call $assert_eq_i32

    global.get $ALT_PAGE
    global.get $INDEX_RAW_COLUMN_TS_DELTA
    call $index_column_span
    local.set $rows
    local.set $encoding
    local.set $len
    local.set $ptr

    local.get $ptr
    i32.load
    i32.const 0
    i32.const 49
    call $assert_eq_i32

    global.get $ALT_PAGE
    global.get $INDEX_RAW_COLUMN_DUR
    call $index_column_span
    local.set $rows
    local.set $encoding
    local.set $len
    local.set $ptr

    local.get $ptr
    i32.load
    i32.const 25
    i32.const 50
    call $assert_eq_i32

    global.get $ALT_PAGE
    global.get $INDEX_RAW_COLUMN_NAME_ID
    call $index_column_span
    local.set $rows
    local.set $encoding
    local.set $len
    local.set $ptr

    local.get $ptr
    i32.load
    i32.const 1234
    i32.const 51
    call $assert_eq_i32

    global.get $ALT_PAGE
    global.get $INDEX_RAW_COLUMN_CAT_ID
    call $index_column_span
    local.set $rows
    local.set $encoding
    local.set $len
    local.set $ptr

    local.get $ptr
    i32.load
    i32.const 0
    i32.const 52
    call $assert_eq_i32

    global.get $ALT_PAGE
    global.get $INDEX_RAW_COLUMN_PHASE
    call $index_column_span
    local.set $rows
    local.set $encoding
    local.set $len
    local.set $ptr

    local.get $ptr
    i32.load8_u
    i32.const 88
    i32.const 53
    call $assert_eq_i32

    global.get $ALT_PAGE
    global.get $INDEX_RAW_COLUMN_FLAGS
    call $index_column_span
    local.set $rows
    local.set $encoding
    local.set $len
    local.set $ptr

    local.get $ptr
    i32.load8_u
    i32.const 1
    i32.const 54
    call $assert_eq_i32
  )

  (func (export "test_index_writer_commits_full_pages_immediately")
    (local $i i32)

    i32.const 1
    memory.grow
    drop

    i32.const 21
    global.get $ALT_PAGE
    i32.const 4
    call $index_writer_init

    i32.const 88
    i32.const 10
    f64.const 1000
    f64.const 1
    i32.const 1
    i32.const 2
    i32.const 0
    call $write_event

    block $done
      loop $loop
        local.get $i
        global.get $INDEX_WRITER_ROWS_PER_PAGE
        i32.const 1
        i32.add
        i32.ge_u
        br_if $done

        global.get $EVENT
        call $index_writer_append_event
        global.get $INDEX_WRITER_STATUS_OK
        i32.const 55
        call $assert_eq_i32

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      end
    end

    call $index_writer_committed_pages
    i32.const 1
    i32.const 56
    call $assert_eq_i32

    call $index_writer_committed_events
    global.get $INDEX_WRITER_ROWS_PER_PAGE
    i32.const 57
    call $assert_eq_i32

    call $index_writer_pending_rows
    i32.const 1
    i32.const 58
    call $assert_eq_i32

    call $index_writer_next_page_id
    i32.const 1
    i32.const 59
    call $assert_eq_i32
  )

  (func (export "test_index_writer_flush_empty_and_uninitialized")
    i32.const 1
    memory.grow
    drop

    i32.const 0
    global.get $ALT_PAGE
    i32.const 0
    call $index_writer_init

    call $index_writer_flush
    global.get $INDEX_WRITER_STATUS_NOT_INITIALIZED
    i32.const 60
    call $assert_eq_i32

    i32.const 21
    global.get $ALT_PAGE
    i32.const 0
    call $index_writer_init

    call $index_writer_flush
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 61
    call $assert_eq_i32

    call $index_writer_committed_pages
    i32.const 0
    i32.const 62
    call $assert_eq_i32
  )

  (func (export "test_index_writer_reports_host_write_failure_on_flush")
    i32.const 1
    memory.grow
    drop

    i32.const 111
    global.get $ALT_PAGE
    i32.const 0
    call $index_writer_init

    i32.const 88
    i32.const 10
    f64.const 1000
    f64.const 1
    i32.const 1
    i32.const 2
    i32.const 0
    call $write_event

    global.get $EVENT
    call $index_writer_append_event
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 63
    call $assert_eq_i32

    call $index_writer_flush
    global.get $INDEX_WRITER_STATUS_HOST_WRITE_FAILED
    i32.const 64
    call $assert_eq_i32
  )

  (func (export "test_index_writer_reports_host_flush_failure")
    i32.const 1
    memory.grow
    drop

    i32.const 112
    global.get $ALT_PAGE
    i32.const 0
    call $index_writer_init

    i32.const 88
    i32.const 10
    f64.const 1000
    f64.const 1
    i32.const 1
    i32.const 2
    i32.const 0
    call $write_event

    global.get $EVENT
    call $index_writer_append_event
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 65
    call $assert_eq_i32

    call $index_writer_flush
    global.get $INDEX_WRITER_STATUS_HOST_FLUSH_FAILED
    i32.const 66
    call $assert_eq_i32
  )

  (func (export "test_index_writer_append_propagates_full_page_write_failure")
    (local $i i32)

    i32.const 1
    memory.grow
    drop

    i32.const 111
    global.get $ALT_PAGE
    i32.const 0
    call $index_writer_init

    i32.const 88
    i32.const 10
    f64.const 1000
    f64.const 1
    i32.const 1
    i32.const 2
    i32.const 0
    call $write_event

    block $done
      loop $loop
        local.get $i
        global.get $INDEX_WRITER_ROWS_PER_PAGE
        i32.lt_u
        i32.eqz
        br_if $done

        global.get $EVENT
        call $index_writer_append_event
        global.get $INDEX_WRITER_STATUS_OK
        i32.const 67
        call $assert_eq_i32

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      end
    end

    global.get $EVENT
    call $index_writer_append_event
    global.get $INDEX_WRITER_STATUS_HOST_WRITE_FAILED
    i32.const 68
    call $assert_eq_i32
  )

  (func (export "test_index_writer_clamps_reversed_timestamp_delta")
    (local $ptr i32)
    (local $len i32)
    (local $encoding i32)
    (local $rows i32)

    i32.const 1
    memory.grow
    drop

    i32.const 21
    global.get $ALT_PAGE
    i32.const 0
    call $index_writer_init

    i32.const 88
    i32.const 10
    f64.const 1000
    f64.const 1
    i32.const 1
    i32.const 2
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_writer_append_event
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 69
    call $assert_eq_i32

    i32.const 88
    i32.const 11
    f64.const 900
    f64.const 1
    i32.const 1
    i32.const 2
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_writer_append_event
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 70
    call $assert_eq_i32

    call $index_writer_flush
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 71
    call $assert_eq_i32

    global.get $ALT_PAGE
    global.get $INDEX_RAW_COLUMN_TS_DELTA
    call $index_column_span
    local.set $rows
    local.set $encoding
    local.set $len
    local.set $ptr

    local.get $ptr
    i32.const 4
    i32.add
    i32.load
    i32.const 0
    i32.const 72
    call $assert_eq_i32
  )

  (func (export "test_index_reader_loads_miss_and_hits_cache")
    (local $page i32)
    (local $ptr i32)
    (local $len i32)
    (local $encoding i32)
    (local $rows i32)

    call $grow_to_index_cache

    i32.const 21
    global.get $ALT_PAGE
    i32.const 6
    call $index_writer_init

    i32.const 88
    i32.const 1234
    f64.const 1000
    f64.const 25
    i32.const 7
    i32.const 9
    i32.const 12
    call $write_event

    global.get $EVENT
    call $index_writer_append_event
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 73
    call $assert_eq_i32

    call $index_writer_flush
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 74
    call $assert_eq_i32

    i32.const 21
    call $index_reader_init

    i32.const 0
    i32.const 0
    call $read_page
    local.tee $page
    global.get $MEM_INDEX_CACHE_BASE
    i32.const 75
    call $assert_eq_i32

    call $index_reader_status
    global.get $INDEX_READER_STATUS_OK
    i32.const 76
    call $assert_eq_i32

    call $index_reader_cache_hit
    i32.const 0
    i32.const 77
    call $assert_eq_i32

    call $index_reader_cached_page_id
    i32.const 0
    i32.const 78
    call $assert_eq_i32

    local.get $page
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_OK
    i32.const 79
    call $assert_eq_i32

    local.get $page
    global.get $INDEX_RAW_COLUMN_NAME_ID
    call $index_column_span
    local.set $rows
    local.set $encoding
    local.set $len
    local.set $ptr

    local.get $ptr
    i32.load
    i32.const 1234
    i32.const 80
    call $assert_eq_i32

    i32.const 0
    i32.const 0
    call $read_page
    global.get $MEM_INDEX_CACHE_BASE
    i32.const 81
    call $assert_eq_i32

    call $index_reader_cache_hit
    i32.const 1
    i32.const 82
    call $assert_eq_i32
  )

  (func (export "test_index_reader_reports_not_initialized")
    i32.const 0
    call $index_reader_init

    i32.const 0
    i32.const 0
    call $read_page
    i32.const 0
    i32.const 83
    call $assert_eq_i32

    call $index_reader_status
    global.get $INDEX_READER_STATUS_NOT_INITIALIZED
    i32.const 84
    call $assert_eq_i32

    call $index_reader_cache_hit
    i32.const 0
    i32.const 85
    call $assert_eq_i32
  )

  (func (export "test_index_reader_reports_missing_page")
    call $grow_to_index_cache

    i32.const 113
    call $index_reader_init

    i32.const 0
    i32.const 0
    call $read_page
    i32.const 0
    i32.const 86
    call $assert_eq_i32

    call $index_reader_status
    global.get $INDEX_READER_STATUS_MISSING_PAGE
    i32.const 87
    call $assert_eq_i32
  )

  (func (export "test_index_reader_reports_corrupt_page")
    call $grow_to_index_cache

    i32.const 114
    call $index_reader_init

    i32.const 0
    i32.const 0
    call $read_page
    i32.const 0
    i32.const 88
    call $assert_eq_i32

    call $index_reader_status
    global.get $INDEX_READER_STATUS_CORRUPT_PAGE
    i32.const 89
    call $assert_eq_i32
  )

  (func (export "test_index_reader_reports_level_mismatch")
    call $grow_to_index_cache

    i32.const 21
    global.get $ALT_PAGE
    i32.const 7
    call $index_writer_init

    i32.const 88
    i32.const 20
    f64.const 1000
    f64.const 1
    i32.const 1
    i32.const 2
    i32.const 0
    call $write_event

    global.get $EVENT
    call $index_writer_append_event
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 90
    call $assert_eq_i32

    call $index_writer_flush
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 91
    call $assert_eq_i32

    i32.const 21
    call $index_reader_init

    i32.const 1
    i32.const 0
    call $read_page
    i32.const 0
    i32.const 92
    call $assert_eq_i32

    call $index_reader_status
    global.get $INDEX_READER_STATUS_LEVEL_MISMATCH
    i32.const 93
    call $assert_eq_i32
  )

  (func (export "test_index_reader_configures_cache_slots")
    i32.const 2
    call $index_reader_configure_cache
    i32.const 2
    i32.const 96
    call $assert_eq_i32

    call $index_reader_cache_slots
    i32.const 2
    i32.const 97
    call $assert_eq_i32

    i32.const 0
    call $index_reader_configure_cache
    i32.const 1
    i32.const 98
    call $assert_eq_i32

    global.get $MEM_INDEX_CACHE_SIZE
    global.get $PAGE_BYTES
    i32.div_u
    i32.const 1
    i32.add
    call $index_reader_configure_cache
    global.get $MEM_INDEX_CACHE_SIZE
    global.get $PAGE_BYTES
    i32.div_u
    i32.const 99
    call $assert_eq_i32
  )

  (func (export "test_index_reader_lru_eviction_keeps_hot_page")
    (local $page i32)

    call $grow_to_index_cache

    global.get $ALT_PAGE
    i32.const 100
    i32.const 1
    call $write_reader_fixture_page

    global.get $ALT_PAGE_2
    i32.const 200
    i32.const 2
    call $write_reader_fixture_page

    global.get $ALT_PAGE_3
    i32.const 300
    i32.const 3
    call $write_reader_fixture_page

    i32.const 2
    call $index_reader_configure_cache
    i32.const 2
    i32.const 100
    call $assert_eq_i32

    i32.const 21
    call $index_reader_init

    i32.const 0
    i32.const 0
    call $read_page
    local.tee $page
    global.get $MEM_INDEX_CACHE_BASE
    i32.const 101
    call $assert_eq_i32

    call $index_reader_last_slot
    i32.const 0
    i32.const 102
    call $assert_eq_i32

    i32.const 0
    i32.const 1
    call $read_page
    global.get $MEM_INDEX_CACHE_BASE
    global.get $PAGE_BYTES
    i32.add
    i32.const 103
    call $assert_eq_i32

    call $index_reader_last_slot
    i32.const 1
    i32.const 104
    call $assert_eq_i32

    i32.const 0
    i32.const 0
    call $read_page
    local.get $page
    i32.const 105
    call $assert_eq_i32

    call $index_reader_cache_hit
    i32.const 1
    i32.const 106
    call $assert_eq_i32

    i32.const 0
    i32.const 2
    call $read_page
    global.get $MEM_INDEX_CACHE_BASE
    global.get $PAGE_BYTES
    i32.add
    i32.const 107
    call $assert_eq_i32

    call $index_reader_cache_hit
    i32.const 0
    i32.const 108
    call $assert_eq_i32

    i32.const 0
    i32.const 0
    call $read_page
    local.get $page
    i32.const 109
    call $assert_eq_i32

    call $index_reader_cache_hit
    i32.const 1
    i32.const 110
    call $assert_eq_i32

    i32.const 0
    i32.const 1
    call $read_page
    global.get $MEM_INDEX_CACHE_BASE
    global.get $PAGE_BYTES
    i32.add
    i32.const 111
    call $assert_eq_i32

    call $index_reader_cache_hit
    i32.const 0
    i32.const 112
    call $assert_eq_i32
  )

  (func (export "test_index_reader_memory_pressure_eviction_hook")
    call $grow_to_index_cache

    global.get $ALT_PAGE
    i32.const 100
    i32.const 1
    call $write_reader_fixture_page

    global.get $ALT_PAGE_2
    i32.const 200
    i32.const 2
    call $write_reader_fixture_page

    i32.const 2
    call $index_reader_configure_cache
    drop

    i32.const 21
    call $index_reader_init

    i32.const 0
    i32.const 0
    call $read_page
    drop

    i32.const 0
    i32.const 1
    call $read_page
    drop

    i32.const 1
    call $index_reader_evict_cold_pages
    i32.const 1
    i32.const 113
    call $assert_eq_i32

    i32.const 0
    i32.const 0
    call $read_page
    drop

    call $index_reader_cache_hit
    i32.const 0
    i32.const 114
    call $assert_eq_i32

    i32.const 0
    call $index_reader_evict_cold_pages
    i32.const 2
    i32.const 115
    call $assert_eq_i32

    i32.const 0
    i32.const 1
    call $read_page
    drop

    call $index_reader_cache_hit
    i32.const 0
    i32.const 116
    call $assert_eq_i32
  )
)
