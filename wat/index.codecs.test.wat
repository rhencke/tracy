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

  (func (export "test_uvarint_codec_roundtrips_and_rejects_overlong")
    (local $value i32)
    (local $bytes i32)
    (local $status i32)

    i32.const 3000
    i32.const 0
    call $index_uvarint_write
    i32.const 1
    i32.const 206
    call $assert_eq_i32

    i32.const 3000
    i32.const 1
    call $index_uvarint_read
    local.set $status
    local.set $bytes
    local.set $value

    local.get $value
    i32.const 0
    i32.const 207
    call $assert_eq_i32

    local.get $bytes
    i32.const 1
    i32.const 208
    call $assert_eq_i32

    local.get $status
    global.get $INDEX_CODEC_STATUS_OK
    i32.const 209
    call $assert_eq_i32

    i32.const 3000
    i32.const 300
    call $index_uvarint_write
    i32.const 2
    i32.const 210
    call $assert_eq_i32

    i32.const 3000
    i32.const 2
    call $index_uvarint_read
    local.set $status
    local.set $bytes
    local.set $value

    local.get $value
    i32.const 300
    i32.const 211
    call $assert_eq_i32

    local.get $bytes
    i32.const 2
    i32.const 212
    call $assert_eq_i32

    local.get $status
    global.get $INDEX_CODEC_STATUS_OK
    i32.const 213
    call $assert_eq_i32

    i32.const 3000
    i32.const -1
    call $index_uvarint_write
    i32.const 5
    i32.const 214
    call $assert_eq_i32

    i32.const 3000
    i32.const 5
    call $index_uvarint_read
    local.set $status
    local.set $bytes
    local.set $value

    local.get $value
    i32.const -1
    i32.const 215
    call $assert_eq_i32

    local.get $bytes
    i32.const 5
    i32.const 216
    call $assert_eq_i32

    local.get $status
    global.get $INDEX_CODEC_STATUS_OK
    i32.const 217
    call $assert_eq_i32

    i32.const 3000
    i32.const 0x80
    i32.store8

    i32.const 3001
    i32.const 0
    i32.store8

    i32.const 3000
    i32.const 2
    call $index_uvarint_read
    local.set $status
    local.set $bytes
    local.set $value

    local.get $status
    global.get $INDEX_CODEC_STATUS_BAD_VARINT
    i32.const 218
    call $assert_eq_i32
  )

  (func (export "test_zigzag_and_fixed_dictionary_codecs")
    (local $value i32)
    (local $status i32)

    i32.const -1
    call $index_zigzag_encode_i32
    i32.const 1
    i32.const 219
    call $assert_eq_i32

    i32.const 1
    call $index_zigzag_decode_i32
    i32.const -1
    i32.const 220
    call $assert_eq_i32

    i32.const -12345
    call $index_zigzag_encode_i32
    call $index_zigzag_decode_i32
    i32.const -12345
    i32.const 221
    call $assert_eq_i32

    i32.const 3100
    i32.const 17
    i32.store8

    i32.const 3101
    i32.const 18
    i32.store8

    i32.const 3100
    i32.const 2
    i32.const 1
    call $index_dict8_value
    local.set $status
    local.set $value

    local.get $value
    i32.const 18
    i32.const 222
    call $assert_eq_i32

    local.get $status
    global.get $INDEX_CODEC_STATUS_OK
    i32.const 223
    call $assert_eq_i32

    i32.const 3104
    i32.const 0x1234
    i32.store16

    i32.const 3104
    i32.const 1
    i32.const 0
    call $index_dict16_value
    local.set $status
    local.set $value

    local.get $value
    i32.const 0x1234
    i32.const 224
    call $assert_eq_i32

    local.get $status
    global.get $INDEX_CODEC_STATUS_OK
    i32.const 225
    call $assert_eq_i32

    i32.const 3104
    i32.const 1
    i32.const 1
    call $index_dict16_value
    local.set $status
    local.set $value

    local.get $status
    global.get $INDEX_CODEC_STATUS_BAD_ENCODING
    i32.const 235
    call $assert_eq_i32

    i32.const 3100
    i32.const 2
    i32.const 2
    call $index_fixed8_value
    local.set $status
    local.set $value

    local.get $status
    global.get $INDEX_CODEC_STATUS_BAD_ENCODING
    i32.const 226
    call $assert_eq_i32
  )

  (func (export "test_rle_codec_validation")
    i32.const 3200
    i32.const 12
    i32.store8

    i32.const 3201
    i32.const 9
    i32.store8

    i32.const 3202
    i32.const 5
    i32.store8

    i32.const 3203
    i32.const 130
    call $index_uvarint_write
    drop

    i32.const 3200
    i32.const 5
    i32.const 5
    global.get $INDEX_ENCODING_UVARINT
    call $index_rle_validate
    global.get $INDEX_CODEC_STATUS_OK
    i32.const 227
    call $assert_eq_i32

    i32.const 3210
    i32.const 18
    i32.store8

    i32.const 3211
    i32.const 7
    i32.store8

    i32.const 3210
    i32.const 2
    i32.const 4
    global.get $INDEX_ENCODING_DICT8
    call $index_rle_validate
    global.get $INDEX_CODEC_STATUS_OK
    i32.const 228
    call $assert_eq_i32

    i32.const 3220
    i32.const 1
    i32.store8

    i32.const 3220
    i32.const 1
    i32.const 1
    global.get $INDEX_ENCODING_UVARINT
    call $index_rle_validate
    global.get $INDEX_CODEC_STATUS_BAD_RLE
    i32.const 229
    call $assert_eq_i32

    i32.const 0
    i32.const 0
    i32.const 0
    global.get $INDEX_ENCODING_UVARINT
    call $index_rle_validate
    global.get $INDEX_CODEC_STATUS_OK
    i32.const 236
    call $assert_eq_i32

    i32.const 3220
    i32.const 1
    i32.const 0
    global.get $INDEX_ENCODING_UVARINT
    call $index_rle_validate
    global.get $INDEX_CODEC_STATUS_BAD_RLE
    i32.const 237
    call $assert_eq_i32

    i32.const 3230
    i32.const 6
    i32.store8

    i32.const 3231
    i32.const 0x80
    i32.store8

    i32.const 3232
    i32.const 0
    i32.store8

    i32.const 3230
    i32.const 3
    i32.const 1
    global.get $INDEX_ENCODING_UVARINT
    call $index_rle_validate
    global.get $INDEX_CODEC_STATUS_BAD_RLE
    i32.const 238
    call $assert_eq_i32

    i32.const 3240
    i32.const 5
    i32.store8

    i32.const 3241
    i32.const 1
    i32.store8

    i32.const 3240
    i32.const 2
    i32.const 1
    i32.const 99
    call $index_rle_validate
    global.get $INDEX_CODEC_STATUS_BAD_RLE
    i32.const 239
    call $assert_eq_i32

    i32.const 3250
    i32.const 6
    i32.store8

    i32.const 3251
    i32.const 1
    i32.store8

    i32.const 3250
    i32.const 2
    i32.const 1
    global.get $INDEX_ENCODING_DICT16
    call $index_rle_validate
    global.get $INDEX_CODEC_STATUS_BAD_RLE
    i32.const 240
    call $assert_eq_i32

    i32.const 3260
    i32.const 7
    i32.store8

    i32.const 3261
    i32.const 1
    i32.store8

    i32.const 3262
    i32.const 2
    i32.store8

    i32.const 3263
    i32.const 3
    i32.store8

    i32.const 3264
    i32.const 4
    i32.store8

    i32.const 3260
    i32.const 5
    i32.const 1
    global.get $INDEX_ENCODING_UVARINT
    call $index_rle_validate
    global.get $INDEX_CODEC_STATUS_OK
    i32.const 241
    call $assert_eq_i32

    i32.const 3260
    i32.const 2
    i32.const 1
    global.get $INDEX_ENCODING_UVARINT
    call $index_rle_validate
    global.get $INDEX_CODEC_STATUS_BAD_RLE
    i32.const 242
    call $assert_eq_i32
  )

)
