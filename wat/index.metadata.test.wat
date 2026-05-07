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
  (import "index" "INDEX_SLICE_COLUMN_START_TS" (global $INDEX_SLICE_COLUMN_START_TS i32))
  (import "index" "INDEX_SLICE_COLUMN_DUR" (global $INDEX_SLICE_COLUMN_DUR i32))
  (import "index" "INDEX_SLICE_COLUMN_NAME_ID" (global $INDEX_SLICE_COLUMN_NAME_ID i32))
  (import "index" "INDEX_SLICE_COLUMN_DEPTH" (global $INDEX_SLICE_COLUMN_DEPTH i32))
  (import "index" "INDEX_SLICE_COLUMN_CAT_ID" (global $INDEX_SLICE_COLUMN_CAT_ID i32))
  (import "index" "INDEX_SLICE_COLUMN_COLOR" (global $INDEX_SLICE_COLUMN_COLOR i32))
  (import "index" "INDEX_COUNTER_COLUMN_TS" (global $INDEX_COUNTER_COLUMN_TS i32))
  (import "index" "INDEX_COUNTER_COLUMN_NAME_ID" (global $INDEX_COUNTER_COLUMN_NAME_ID i32))
  (import "index" "INDEX_COUNTER_COLUMN_VALUE" (global $INDEX_COUNTER_COLUMN_VALUE i32))
  (import "index" "INDEX_DECODE_HINT_COMPACT_SLICES" (global $INDEX_DECODE_HINT_COMPACT_SLICES i32))
  (import "index" "INDEX_DECODE_HINT_COUNTERS" (global $INDEX_DECODE_HINT_COUNTERS i32))
  (import "index" "INDEX_PAGE_CATALOG_ENTRY_BYTES" (global $INDEX_PAGE_CATALOG_ENTRY_BYTES i32))
  (import "index" "INDEX_PAGE_CATALOG_CAPACITY" (global $INDEX_PAGE_CATALOG_CAPACITY i32))
  (import "index" "INDEX_QUERY_RESULT_BYTES" (global $INDEX_QUERY_RESULT_BYTES i32))
  (import "index" "INDEX_ENCODING_UVARINT" (global $INDEX_ENCODING_UVARINT i32))
  (import "index" "INDEX_ENCODING_ZIGZAG_VARINT" (global $INDEX_ENCODING_ZIGZAG_VARINT i32))
  (import "index" "INDEX_ENCODING_DICT8" (global $INDEX_ENCODING_DICT8 i32))
  (import "index" "INDEX_ENCODING_DICT16" (global $INDEX_ENCODING_DICT16 i32))
  (import "index" "INDEX_ENCODING_FIXED8" (global $INDEX_ENCODING_FIXED8 i32))
  (import "index" "INDEX_ENCODING_RLE" (global $INDEX_ENCODING_RLE i32))
  (import "index" "INDEX_ENCODING_SIDE_REF" (global $INDEX_ENCODING_SIDE_REF i32))
  (import "index" "INDEX_ENCODING_FIXED32" (global $INDEX_ENCODING_FIXED32 i32))
  (import "index" "INDEX_ENCODING_FIXED64" (global $INDEX_ENCODING_FIXED64 i32))
  (import "index" "INDEX_CODEC_STATUS_OK" (global $INDEX_CODEC_STATUS_OK i32))
  (import "index" "INDEX_CODEC_STATUS_BAD_VARINT" (global $INDEX_CODEC_STATUS_BAD_VARINT i32))
  (import "index" "INDEX_CODEC_STATUS_BAD_RLE" (global $INDEX_CODEC_STATUS_BAD_RLE i32))
  (import "index" "INDEX_CODEC_STATUS_BAD_ENCODING" (global $INDEX_CODEC_STATUS_BAD_ENCODING i32))
  (import "index" "INDEX_TRACK_CAPACITY" (global $INDEX_TRACK_CAPACITY i32))
  (import "index" "INDEX_TRACK_ENTRY_BYTES" (global $INDEX_TRACK_ENTRY_BYTES i32))
  (import "index" "INDEX_TRACK_STATUS_OK" (global $INDEX_TRACK_STATUS_OK i32))
  (import "index" "INDEX_TRACK_STATUS_INVALID" (global $INDEX_TRACK_STATUS_INVALID i32))
  (import "index" "INDEX_TRACK_STATUS_FULL" (global $INDEX_TRACK_STATUS_FULL i32))
  (import "index" "INDEX_SLICE_STACK_ENTRY_BYTES" (global $INDEX_SLICE_STACK_ENTRY_BYTES i32))
  (import "index" "INDEX_SLICE_STACK_MAX_DEPTH" (global $INDEX_SLICE_STACK_MAX_DEPTH i32))
  (import "index" "INDEX_INGEST_STATUS_OK" (global $INDEX_INGEST_STATUS_OK i32))
  (import "index" "INDEX_INGEST_STATUS_IGNORED" (global $INDEX_INGEST_STATUS_IGNORED i32))
  (import "index" "INDEX_INGEST_STATUS_TRACK_FULL" (global $INDEX_INGEST_STATUS_TRACK_FULL i32))
  (import "index" "INDEX_INGEST_STATUS_STACK_OVERFLOW" (global $INDEX_INGEST_STATUS_STACK_OVERFLOW i32))
  (import "index" "INDEX_INGEST_STATUS_STACK_UNDERFLOW" (global $INDEX_INGEST_STATUS_STACK_UNDERFLOW i32))
  (import "index" "index_zigzag_encode_i32"
    (func $index_zigzag_encode_i32 (param i32) (result i32)))
  (import "index" "index_zigzag_decode_i32"
    (func $index_zigzag_decode_i32 (param i32) (result i32)))
  (import "index" "index_uvarint_size"
    (func $index_uvarint_size (param i32) (result i32)))
  (import "index" "index_uvarint_write"
    (func $index_uvarint_write (param i32 i32) (result i32)))
  (import "index" "index_uvarint_read"
    (func $index_uvarint_read (param i32 i32) (result i32 i32 i32)))
  (import "index" "index_column_fixed_width"
    (func $index_column_fixed_width (param i32) (result i32)))
  (import "index" "index_dict8_value"
    (func $index_dict8_value (param i32 i32 i32) (result i32 i32)))
  (import "index" "index_dict16_value"
    (func $index_dict16_value (param i32 i32 i32) (result i32 i32)))
  (import "index" "index_fixed8_value"
    (func $index_fixed8_value (param i32 i32 i32) (result i32 i32)))
  (import "index" "index_rle_validate"
    (func $index_rle_validate (param i32 i32 i32 i32) (result i32)))
  (import "index" "index_tracks_reset"
    (func $index_tracks_reset))
  (import "index" "index_track_count"
    (func $index_track_count (result i32)))
  (import "index" "index_track_for_pid_tid"
    (func $index_track_for_pid_tid (param i32 i32) (result i32)))
  (import "index" "index_track_for_event"
    (func $index_track_for_event (param i32) (result i32)))
  (import "index" "index_apply_metadata_event"
    (func $index_apply_metadata_event (param i32) (result i32)))
  (import "index" "index_track_record_slice"
    (func $index_track_record_slice (param i32 i32 i32 i32) (result i32)))
  (import "index" "track_pid"
    (func $track_pid (param i32) (result i32)))
  (import "index" "track_tid"
    (func $track_tid (param i32) (result i32)))
  (import "index" "track_name_id"
    (func $track_name_id (param i32) (result i32)))
  (import "index" "track_slice_count"
    (func $track_slice_count (param i32) (result i32)))
  (import "index" "track_min_ts"
    (func $track_min_ts (param i32) (result i32)))
  (import "index" "track_max_ts"
    (func $track_max_ts (param i32) (result i32)))
  (import "index" "track_max_depth"
    (func $track_max_depth (param i32) (result i32)))
  (import "index" "track_open_depth"
    (func $track_open_depth (param i32) (result i32)))
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
  (import "index" "index_add_event"
    (func $index_add_event (param i32) (result i32)))
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
  (import "index" "index_reader_cache_hits"
    (func $index_reader_cache_hits (result i32)))
  (import "index" "index_reader_cache_misses"
    (func $index_reader_cache_misses (result i32)))
  (import "index" "index_reader_cache_evictions"
    (func $index_reader_cache_evictions (result i32)))
  (import "index" "index_slice_page_count"
    (func $index_slice_page_count (result i32)))
  (import "index" "index_page_catalog_reset"
    (func $index_page_catalog_reset))
  (import "index" "index_page_catalog_add_slice_page"
    (func $index_page_catalog_add_slice_page (param i32 i32 i32 i32 i32)))
  (import "index" "index_query_range"
    (func $index_query_range (param i32 i32 i32 i32 i32) (result i32)))
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
  (global $QUERY_OUT i32 (i32.const 12288))

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

  (func (export "test_index_codec_constants_and_fixed_widths")
    global.get $INDEX_ENCODING_UVARINT
    i32.const 1
    i32.const 200
    call $assert_eq_i32

    global.get $INDEX_ENCODING_ZIGZAG_VARINT
    i32.const 2
    i32.const 201
    call $assert_eq_i32

    global.get $INDEX_ENCODING_DICT8
    call $index_column_fixed_width
    i32.const 1
    i32.const 202
    call $assert_eq_i32

    global.get $INDEX_ENCODING_DICT16
    call $index_column_fixed_width
    i32.const 2
    i32.const 203
    call $assert_eq_i32

    global.get $INDEX_ENCODING_FIXED8
    call $index_column_fixed_width
    i32.const 1
    i32.const 204
    call $assert_eq_i32

    global.get $INDEX_ENCODING_FIXED32
    call $index_column_fixed_width
    i32.const 4
    i32.const 205
    call $assert_eq_i32

    global.get $INDEX_ENCODING_FIXED64
    call $index_column_fixed_width
    i32.const 8
    i32.const 356
    call $assert_eq_i32

    global.get $INDEX_PAGE_CATALOG_ENTRY_BYTES
    i32.const 20
    i32.const 389
    call $assert_eq_i32

    global.get $INDEX_PAGE_CATALOG_CAPACITY
    i32.const 4096
    i32.const 390
    call $assert_eq_i32

    global.get $INDEX_QUERY_RESULT_BYTES
    i32.const 28
    i32.const 391
    call $assert_eq_i32

    i32.const 20000
    call $index_uvarint_size
    i32.const 3
    i32.const 233
    call $assert_eq_i32

    i32.const 3000000
    call $index_uvarint_size
    i32.const 4
    i32.const 234
    call $assert_eq_i32
  )

  (func (export "test_track_table_constants_and_pid_tid_mapping")
    call $index_tracks_reset

    global.get $INDEX_TRACK_ENTRY_BYTES
    i32.const 32
    i32.const 260
    call $assert_eq_i32

    global.get $INDEX_TRACK_CAPACITY
    i32.const 2048
    i32.const 261
    call $assert_eq_i32

    global.get $INDEX_TRACK_STATUS_OK
    i32.const 0
    i32.const 262
    call $assert_eq_i32

    global.get $INDEX_TRACK_STATUS_INVALID
    i32.const 1
    i32.const 263
    call $assert_eq_i32

    global.get $INDEX_TRACK_STATUS_FULL
    i32.const 2
    i32.const 264
    call $assert_eq_i32

    i32.const 7
    i32.const 9
    call $index_track_for_pid_tid
    i32.const 0
    i32.const 265
    call $assert_eq_i32

    i32.const 7
    i32.const 9
    call $index_track_for_pid_tid
    i32.const 0
    i32.const 266
    call $assert_eq_i32

    i32.const 7
    i32.const 10
    call $index_track_for_pid_tid
    i32.const 1
    i32.const 267
    call $assert_eq_i32

    call $index_track_count
    i32.const 2
    i32.const 268
    call $assert_eq_i32

    i32.const 0
    call $track_pid
    i32.const 7
    i32.const 269
    call $assert_eq_i32

    i32.const 0
    call $track_tid
    i32.const 9
    i32.const 270
    call $assert_eq_i32
  )

  (func (export "test_metadata_events_set_track_names")
    call $index_tracks_reset

    i32.const 77
    i32.const 555
    f64.const 0
    f64.const 0
    i32.const 42
    i32.const 5
    i32.const 0
    call $write_event

    global.get $EVENT
    call $index_track_for_event
    i32.const 0
    i32.const 271
    call $assert_eq_i32

    i32.const 0
    call $track_name_id
    i32.const 0
    i32.const 272
    call $assert_eq_i32

    global.get $EVENT
    call $index_apply_metadata_event
    i32.const 0
    i32.const 273
    call $assert_eq_i32

    i32.const 0
    call $track_name_id
    i32.const 555
    i32.const 274
    call $assert_eq_i32

    i32.const 88
    i32.const 777
    f64.const 0
    f64.const 0
    i32.const 42
    i32.const 5
    i32.const 0
    call $write_event

    global.get $EVENT
    call $index_apply_metadata_event
    i32.const 0
    i32.const 275
    call $assert_eq_i32

    i32.const 0
    call $track_name_id
    i32.const 555
    i32.const 276
    call $assert_eq_i32

    call $index_tracks_reset

    i32.const 77
    i32.const 556
    f64.const 0
    f64.const 0
    i32.const 43
    i32.const 6
    i32.const 0
    call $write_event

    global.get $EVENT
    call $index_add_event
    global.get $INDEX_INGEST_STATUS_OK
    i32.const 337
    call $assert_eq_i32

    i32.const 0
    call $track_name_id
    i32.const 556
    i32.const 338
    call $assert_eq_i32
  )

  (func (export "test_track_slice_stats_update_min_max_and_depth")
    call $index_tracks_reset

    i32.const 1
    i32.const 2
    call $index_track_for_pid_tid
    i32.const 0
    i32.const 277
    call $assert_eq_i32

    i32.const 0
    i32.const 1000
    i32.const 25
    i32.const 3
    call $index_track_record_slice
    global.get $INDEX_TRACK_STATUS_OK
    i32.const 278
    call $assert_eq_i32

    i32.const 0
    call $track_slice_count
    i32.const 1
    i32.const 279
    call $assert_eq_i32

    i32.const 0
    call $track_min_ts
    i32.const 1000
    i32.const 280
    call $assert_eq_i32

    i32.const 0
    call $track_max_ts
    i32.const 1025
    i32.const 281
    call $assert_eq_i32

    i32.const 0
    call $track_max_depth
    i32.const 3
    i32.const 282
    call $assert_eq_i32

    i32.const 0
    i32.const 900
    i32.const 1
    i32.const 2
    call $index_track_record_slice
    global.get $INDEX_TRACK_STATUS_OK
    i32.const 283
    call $assert_eq_i32

    i32.const 0
    i32.const 1100
    i32.const 5
    i32.const 7
    call $index_track_record_slice
    global.get $INDEX_TRACK_STATUS_OK
    i32.const 284
    call $assert_eq_i32

    i32.const 0
    call $track_slice_count
    i32.const 3
    i32.const 285
    call $assert_eq_i32

    i32.const 0
    call $track_min_ts
    i32.const 900
    i32.const 286
    call $assert_eq_i32

    i32.const 0
    call $track_max_ts
    i32.const 1105
    i32.const 287
    call $assert_eq_i32

    i32.const 0
    call $track_max_depth
    i32.const 7
    i32.const 288
    call $assert_eq_i32
  )

  (func (export "test_track_table_invalid_and_full_cases")
    (local $i i32)

    call $index_tracks_reset

    i32.const 0
    i32.const 1
    i32.const 1
    i32.const 0
    call $index_track_record_slice
    global.get $INDEX_TRACK_STATUS_INVALID
    i32.const 289
    call $assert_eq_i32

    i32.const -1
    call $track_pid
    i32.const 0
    i32.const 290
    call $assert_eq_i32

    i32.const 0
    call $track_tid
    i32.const 0
    i32.const 291
    call $assert_eq_i32

    i32.const 0
    call $track_name_id
    i32.const 0
    i32.const 292
    call $assert_eq_i32

    i32.const 21
    global.get $ALT_PAGE
    i32.const 12
    call $index_writer_init

    block $done
      loop $fill
        local.get $i
        global.get $INDEX_TRACK_CAPACITY
        i32.ge_u
        br_if $done

        i32.const 100
        local.get $i
        call $index_track_for_pid_tid
        local.get $i
        i32.const 293
        call $assert_eq_i32

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $fill
      end
    end

    i32.const 100
    global.get $INDEX_TRACK_CAPACITY
    call $index_track_for_pid_tid
    i32.const -1
    i32.const 294
    call $assert_eq_i32

    call $index_track_count
    global.get $INDEX_TRACK_CAPACITY
    i32.const 295
    call $assert_eq_i32

    i32.const 77
    i32.const 999
    f64.const 0
    f64.const 0
    i32.const 100
    global.get $INDEX_TRACK_CAPACITY
    i32.const 0
    call $write_event

    global.get $EVENT
    call $index_apply_metadata_event
    i32.const -1
    i32.const 296
    call $assert_eq_i32

    global.get $EVENT
    call $index_add_event
    global.get $INDEX_INGEST_STATUS_TRACK_FULL
    i32.const 339
    call $assert_eq_i32

    i32.const 88
    i32.const 1000
    f64.const 1
    f64.const 1
    i32.const 100
    global.get $INDEX_TRACK_CAPACITY
    i32.const 0
    call $write_event

    global.get $EVENT
    call $index_add_event
    global.get $INDEX_INGEST_STATUS_TRACK_FULL
    i32.const 340
    call $assert_eq_i32

    i32.const 0
    global.get $ALT_PAGE
    i32.const 0
    call $index_writer_init

  )

  (func (export "test_index_add_event_writes_direct_x_slice")
    (local $ptr i32)
    (local $len i32)
    (local $encoding i32)
    (local $rows i32)

    i32.const 21
    global.get $ALT_PAGE
    i32.const 6
    call $index_writer_init

    global.get $INDEX_SLICE_STACK_ENTRY_BYTES
    i32.const 16
    i32.const 298
    call $assert_eq_i32

    global.get $INDEX_SLICE_STACK_MAX_DEPTH
    i32.const 12
    i32.const 299
    call $assert_eq_i32

    i32.const 88
    i32.const 321
    f64.const 50
    f64.const 7
    i32.const 1
    i32.const 2
    i32.const 0
    call $write_event

    global.get $EVENT
    call $index_add_event
    global.get $INDEX_INGEST_STATUS_OK
    i32.const 300
    call $assert_eq_i32

    i32.const 0
    call $track_slice_count
    i32.const 1
    i32.const 301
    call $assert_eq_i32

    i32.const 0
    call $track_min_ts
    i32.const 50
    i32.const 302
    call $assert_eq_i32

    i32.const 0
    call $track_max_ts
    i32.const 57
    i32.const 303
    call $assert_eq_i32

    call $index_writer_pending_rows
    i32.const 1
    i32.const 304
    call $assert_eq_i32

    call $index_writer_flush
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 305
    call $assert_eq_i32

    global.get $ALT_PAGE
    i32.const 36
    i32.add
    i32.load
    global.get $INDEX_DECODE_HINT_COMPACT_SLICES
    i32.and
    global.get $INDEX_DECODE_HINT_COMPACT_SLICES
    i32.const 341
    call $assert_eq_i32

    global.get $ALT_PAGE
    global.get $INDEX_SLICE_COLUMN_NAME_ID
    call $index_column_span
    local.set $rows
    local.set $encoding
    local.set $len
    local.set $ptr

    local.get $encoding
    global.get $INDEX_ENCODING_DICT16
    i32.const 342
    call $assert_eq_i32

    local.get $ptr
    i32.load16_u
    i32.const 321
    i32.const 306
    call $assert_eq_i32

    global.get $ALT_PAGE
    global.get $INDEX_SLICE_COLUMN_DUR
    call $index_column_span
    local.set $rows
    local.set $encoding
    local.set $len
    local.set $ptr

    local.get $encoding
    global.get $INDEX_ENCODING_UVARINT
    i32.const 343
    call $assert_eq_i32

    local.get $ptr
    i32.load8_u
    i32.const 7
    i32.const 307
    call $assert_eq_i32

    global.get $ALT_PAGE
    global.get $INDEX_SLICE_COLUMN_DEPTH
    call $index_column_span
    local.set $rows
    local.set $encoding
    local.set $len
    local.set $ptr

    local.get $encoding
    global.get $INDEX_ENCODING_FIXED8
    i32.const 344
    call $assert_eq_i32

    local.get $ptr
    i32.load8_u
    i32.const 0
    i32.const 345
    call $assert_eq_i32
  )

  (func (export "test_index_add_event_pairs_begin_end_slices")
    (local $ptr i32)
    (local $len i32)
    (local $encoding i32)
    (local $rows i32)

    i32.const 21
    global.get $ALT_PAGE
    i32.const 7
    call $index_writer_init

    i32.const 66
    i32.const 900
    f64.const 100
    f64.const 0
    i32.const 7
    i32.const 9
    i32.const 0
    call $write_event

    global.get $EVENT
    call $index_add_event
    global.get $INDEX_INGEST_STATUS_OK
    i32.const 308
    call $assert_eq_i32

    i32.const 0
    call $track_open_depth
    i32.const 1
    i32.const 309
    call $assert_eq_i32

    i32.const 69
    i32.const 0
    f64.const 125
    f64.const 0
    i32.const 7
    i32.const 9
    i32.const 0
    call $write_event

    global.get $EVENT
    call $index_add_event
    global.get $INDEX_INGEST_STATUS_OK
    i32.const 310
    call $assert_eq_i32

    i32.const 0
    call $track_open_depth
    i32.const 0
    i32.const 311
    call $assert_eq_i32

    i32.const 0
    call $track_slice_count
    i32.const 1
    i32.const 312
    call $assert_eq_i32

    i32.const 0
    call $track_min_ts
    i32.const 100
    i32.const 313
    call $assert_eq_i32

    i32.const 0
    call $track_max_ts
    i32.const 125
    i32.const 314
    call $assert_eq_i32

    call $index_writer_flush
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 315
    call $assert_eq_i32

    global.get $ALT_PAGE
    global.get $INDEX_SLICE_COLUMN_NAME_ID
    call $index_column_span
    local.set $rows
    local.set $encoding
    local.set $len
    local.set $ptr

    local.get $rows
    i32.const 1
    i32.const 316
    call $assert_eq_i32

    local.get $ptr
    i32.load16_u
    i32.const 900
    i32.const 317
    call $assert_eq_i32

    global.get $ALT_PAGE
    global.get $INDEX_SLICE_COLUMN_DUR
    call $index_column_span
    local.set $rows
    local.set $encoding
    local.set $len
    local.set $ptr

    local.get $ptr
    i32.load8_u
    i32.const 25
    i32.const 318
    call $assert_eq_i32
  )

  (func (export "test_index_add_event_tracks_nested_depth")
    i32.const 21
    global.get $ALT_PAGE
    i32.const 8
    call $index_writer_init

    i32.const 66
    i32.const 10
    f64.const 100
    f64.const 0
    i32.const 1
    i32.const 1
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_INGEST_STATUS_OK
    i32.const 319
    call $assert_eq_i32

    i32.const 66
    i32.const 11
    f64.const 110
    f64.const 0
    i32.const 1
    i32.const 1
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_INGEST_STATUS_OK
    i32.const 320
    call $assert_eq_i32

    i32.const 69
    i32.const 0
    f64.const 130
    f64.const 0
    i32.const 1
    i32.const 1
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_INGEST_STATUS_OK
    i32.const 321
    call $assert_eq_i32

    i32.const 69
    i32.const 0
    f64.const 140
    f64.const 0
    i32.const 1
    i32.const 1
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_INGEST_STATUS_OK
    i32.const 322
    call $assert_eq_i32

    i32.const 0
    call $track_slice_count
    i32.const 2
    i32.const 323
    call $assert_eq_i32

    i32.const 0
    call $track_max_depth
    i32.const 1
    i32.const 324
    call $assert_eq_i32
  )

  (func (export "test_index_add_event_ignores_async_and_instant_events")
    i32.const 21
    global.get $ALT_PAGE
    i32.const 9
    call $index_writer_init

    i32.const 115
    i32.const 1
    f64.const 1
    f64.const 0
    i32.const 1
    i32.const 2
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_INGEST_STATUS_IGNORED
    i32.const 325
    call $assert_eq_i32

    i32.const 105
    i32.const 2
    f64.const 2
    f64.const 0
    i32.const 1
    i32.const 2
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_INGEST_STATUS_IGNORED
    i32.const 326
    call $assert_eq_i32

    call $index_track_count
    i32.const 0
    i32.const 328
    call $assert_eq_i32

    call $index_writer_pending_rows
    i32.const 0
    i32.const 329
    call $assert_eq_i32
  )

  (func (export "test_index_add_event_writes_counter_page")
    (local $ptr i32)
    (local $len i32)
    (local $encoding i32)
    (local $rows i32)

    i32.const 21
    global.get $ALT_PAGE
    i32.const 16
    call $index_writer_init

    i32.const 67
    i32.const 700
    f64.const 25
    f64.const 42
    i32.const 3
    i32.const 4
    i32.const 0
    call $write_event

    global.get $EVENT
    call $index_add_event
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 357
    call $assert_eq_i32

    call $index_track_count
    i32.const 1
    i32.const 358
    call $assert_eq_i32

    call $index_writer_pending_rows
    i32.const 1
    i32.const 359
    call $assert_eq_i32

    call $index_writer_flush
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 360
    call $assert_eq_i32

    global.get $ALT_PAGE
    i32.const 36
    i32.add
    i32.load
    global.get $INDEX_DECODE_HINT_COUNTERS
    i32.and
    global.get $INDEX_DECODE_HINT_COUNTERS
    i32.const 361
    call $assert_eq_i32

    global.get $ALT_PAGE
    i32.const 36
    i32.add
    i32.load
    i32.const 8
    i32.shr_u
    i32.const 0
    i32.const 362
    call $assert_eq_i32

    global.get $ALT_PAGE
    i32.const 20
    i32.add
    i64.load
    i64.const 25
    i32.const 363
    call $assert_eq_i64

    global.get $ALT_PAGE
    global.get $INDEX_COUNTER_COLUMN_TS
    call $index_column_span
    local.set $rows
    local.set $encoding
    local.set $len
    local.set $ptr

    local.get $encoding
    global.get $INDEX_ENCODING_UVARINT
    i32.const 364
    call $assert_eq_i32

    local.get $rows
    i32.const 1
    i32.const 365
    call $assert_eq_i32

    local.get $ptr
    i32.load8_u
    i32.const 0
    i32.const 366
    call $assert_eq_i32

    global.get $ALT_PAGE
    global.get $INDEX_COUNTER_COLUMN_NAME_ID
    call $index_column_span
    local.set $rows
    local.set $encoding
    local.set $len
    local.set $ptr

    local.get $encoding
    global.get $INDEX_ENCODING_DICT16
    i32.const 367
    call $assert_eq_i32

    local.get $ptr
    i32.load16_u
    i32.const 700
    i32.const 368
    call $assert_eq_i32

    global.get $ALT_PAGE
    global.get $INDEX_COUNTER_COLUMN_VALUE
    call $index_column_span
    local.set $rows
    local.set $encoding
    local.set $len
    local.set $ptr

    local.get $encoding
    global.get $INDEX_ENCODING_FIXED64
    i32.const 369
    call $assert_eq_i32

    local.get $ptr
    i64.load
    i64.const 0x4045000000000000
    i32.const 370
    call $assert_eq_i64
  )

  (func (export "test_counter_writer_splits_modes_and_tracks")
    i32.const 21
    global.get $ALT_PAGE
    i32.const 17
    call $index_writer_init

    i32.const 88
    i32.const 1
    f64.const 10
    f64.const 1
    i32.const 1
    i32.const 1
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_INGEST_STATUS_OK
    i32.const 371
    call $assert_eq_i32

    i32.const 67
    i32.const 2
    f64.const 20
    f64.const 2
    i32.const 1
    i32.const 1
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 372
    call $assert_eq_i32

    call $index_writer_committed_pages
    i32.const 1
    i32.const 373
    call $assert_eq_i32

    i32.const 67
    i32.const 3
    f64.const 25
    f64.const 3
    i32.const 1
    i32.const 1
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 374
    call $assert_eq_i32

    i32.const 67
    i32.const 4
    f64.const 18
    f64.const 4
    i32.const 1
    i32.const 1
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 375
    call $assert_eq_i32

    i32.const 67
    i32.const 5
    f64.const 30
    f64.const 5
    i32.const 1
    i32.const 2
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 376
    call $assert_eq_i32

    call $index_writer_committed_pages
    i32.const 2
    i32.const 377
    call $assert_eq_i32
  )

  (func (export "test_counter_writer_propagates_commit_failures")
    (local $i i32)

    i32.const 111
    global.get $ALT_PAGE
    i32.const 18
    call $index_writer_init

    i32.const 67
    i32.const 1
    f64.const 10
    f64.const 1
    i32.const 1
    i32.const 1
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 378
    call $assert_eq_i32

    i32.const 67
    i32.const 2
    f64.const 20
    f64.const 2
    i32.const 1
    i32.const 2
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_WRITER_STATUS_HOST_WRITE_FAILED
    i32.const 379
    call $assert_eq_i32

    i32.const 111
    global.get $ALT_PAGE
    i32.const 19
    call $index_writer_init

    i32.const 67
    i32.const 3
    f64.const 30
    f64.const 3
    i32.const 2
    i32.const 1
    i32.const 0
    call $write_event

    block $done
      loop $fill
        local.get $i
        global.get $INDEX_WRITER_ROWS_PER_PAGE
        i32.ge_u
        br_if $done

        global.get $EVENT
        call $index_add_event
        global.get $INDEX_WRITER_STATUS_OK
        i32.const 380
        call $assert_eq_i32

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $fill
      end
    end

    global.get $EVENT
    call $index_add_event
    global.get $INDEX_WRITER_STATUS_HOST_WRITE_FAILED
    i32.const 381
    call $assert_eq_i32

    i32.const 0
    global.get $ALT_PAGE
    i32.const 0
    call $index_writer_init
  )

  (func (export "test_index_add_event_reports_stack_and_init_errors")
    (local $i i32)

    i32.const 0
    global.get $ALT_PAGE
    i32.const 0
    call $index_writer_init

    i32.const 88
    i32.const 1
    f64.const 1
    f64.const 1
    i32.const 1
    i32.const 2
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_WRITER_STATUS_NOT_INITIALIZED
    i32.const 330
    call $assert_eq_i32

    i32.const 67
    i32.const 2
    f64.const 1
    f64.const 2
    i32.const 1
    i32.const 2
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_WRITER_STATUS_NOT_INITIALIZED
    i32.const 382
    call $assert_eq_i32

    i32.const 21
    global.get $ALT_PAGE
    i32.const 10
    call $index_writer_init

    i32.const 0
    local.set $i

    block $tracks_done
      loop $tracks
        local.get $i
        global.get $INDEX_TRACK_CAPACITY
        i32.ge_u
        br_if $tracks_done

        local.get $i
        i32.const 0
        call $index_track_for_pid_tid
        local.get $i
        i32.const 383
        call $assert_eq_i32

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $tracks
      end
    end

    i32.const 67
    i32.const 3
    f64.const 1
    f64.const 3
    global.get $INDEX_TRACK_CAPACITY
    i32.const 0
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_INGEST_STATUS_TRACK_FULL
    i32.const 388
    call $assert_eq_i32

    i32.const 21
    global.get $ALT_PAGE
    i32.const 10
    call $index_writer_init

    i32.const 0
    local.set $i

    i32.const 69
    i32.const 0
    f64.const 1
    f64.const 0
    i32.const 1
    i32.const 2
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_INGEST_STATUS_STACK_UNDERFLOW
    i32.const 331
    call $assert_eq_i32

    block $done
      loop $loop
        local.get $i
        global.get $INDEX_SLICE_STACK_MAX_DEPTH
        i32.ge_u
        br_if $done

        i32.const 66
        i32.const 10
        f64.const 1
        f64.const 0
        i32.const 1
        i32.const 2
        i32.const 0
        call $write_event
        global.get $EVENT
        call $index_add_event
        global.get $INDEX_INGEST_STATUS_OK
        i32.const 332
        call $assert_eq_i32

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      end
    end

    i32.const 66
    i32.const 11
    f64.const 2
    f64.const 0
    i32.const 1
    i32.const 2
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_INGEST_STATUS_STACK_OVERFLOW
    i32.const 333
    call $assert_eq_i32

    i32.const 0
    global.get $ALT_PAGE
    i32.const 0
    call $index_writer_init
  )

  (func (export "test_index_add_event_clamps_reversed_end")
    i32.const 21
    global.get $ALT_PAGE
    i32.const 11
    call $index_writer_init

    i32.const 66
    i32.const 44
    f64.const 100
    f64.const 0
    i32.const 2
    i32.const 3
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_INGEST_STATUS_OK
    i32.const 334
    call $assert_eq_i32

    i32.const 69
    i32.const 0
    f64.const 90
    f64.const 0
    i32.const 2
    i32.const 3
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_INGEST_STATUS_OK
    i32.const 335
    call $assert_eq_i32

    i32.const 0
    call $track_max_ts
    i32.const 100
    i32.const 336
    call $assert_eq_i32

    i32.const 0
    global.get $ALT_PAGE
    i32.const 0
    call $index_writer_init
  )

  (func (export "test_compact_slice_writer_splits_track_pages")
    i32.const 21
    global.get $ALT_PAGE
    i32.const 13
    call $index_writer_init

    i32.const 88
    i32.const 1
    f64.const 10
    f64.const 1
    i32.const 1
    i32.const 1
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_INGEST_STATUS_OK
    i32.const 346
    call $assert_eq_i32

    i32.const 88
    i32.const 2
    f64.const 20
    f64.const 1
    i32.const 1
    i32.const 2
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_INGEST_STATUS_OK
    i32.const 347
    call $assert_eq_i32

    call $index_writer_committed_pages
    i32.const 1
    i32.const 348
    call $assert_eq_i32

    call $index_writer_pending_rows
    i32.const 1
    i32.const 349
    call $assert_eq_i32

    call $index_writer_flush
    global.get $INDEX_WRITER_STATUS_OK
    i32.const 350
    call $assert_eq_i32

    call $index_writer_committed_pages
    i32.const 2
    i32.const 351
    call $assert_eq_i32
  )

  (func (export "test_compact_slice_writer_propagates_commit_failures")
    (local $i i32)

    i32.const 111
    global.get $ALT_PAGE
    i32.const 14
    call $index_writer_init

    i32.const 88
    i32.const 1
    f64.const 10
    f64.const 1
    i32.const 1
    i32.const 1
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_INGEST_STATUS_OK
    i32.const 352
    call $assert_eq_i32

    i32.const 88
    i32.const 2
    f64.const 20
    f64.const 1
    i32.const 1
    i32.const 2
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_WRITER_STATUS_HOST_WRITE_FAILED
    i32.const 353
    call $assert_eq_i32

    i32.const 111
    global.get $ALT_PAGE
    i32.const 15
    call $index_writer_init

    i32.const 88
    i32.const 3
    f64.const 30
    f64.const 1
    i32.const 2
    i32.const 1
    i32.const 0
    call $write_event

    block $done
      loop $fill
        local.get $i
        global.get $INDEX_WRITER_ROWS_PER_PAGE
        i32.ge_u
        br_if $done

        global.get $EVENT
        call $index_add_event
        global.get $INDEX_INGEST_STATUS_OK
        i32.const 354
        call $assert_eq_i32

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $fill
      end
    end

    global.get $EVENT
    call $index_add_event
    global.get $INDEX_WRITER_STATUS_HOST_WRITE_FAILED
    i32.const 355
    call $assert_eq_i32

    i32.const 0
    global.get $ALT_PAGE
    i32.const 0
    call $index_writer_init
  )

)
