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
  (import "index" "INDEX_DECODE_HINT_COMPACT_SLICES" (global $INDEX_DECODE_HINT_COMPACT_SLICES i32))
  (import "index" "INDEX_ENCODING_UVARINT" (global $INDEX_ENCODING_UVARINT i32))
  (import "index" "INDEX_ENCODING_ZIGZAG_VARINT" (global $INDEX_ENCODING_ZIGZAG_VARINT i32))
  (import "index" "INDEX_ENCODING_DICT8" (global $INDEX_ENCODING_DICT8 i32))
  (import "index" "INDEX_ENCODING_DICT16" (global $INDEX_ENCODING_DICT16 i32))
  (import "index" "INDEX_ENCODING_FIXED8" (global $INDEX_ENCODING_FIXED8 i32))
  (import "index" "INDEX_ENCODING_RLE" (global $INDEX_ENCODING_RLE i32))
  (import "index" "INDEX_ENCODING_SIDE_REF" (global $INDEX_ENCODING_SIDE_REF i32))
  (import "index" "INDEX_ENCODING_FIXED32" (global $INDEX_ENCODING_FIXED32 i32))
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

  (func (export "test_index_add_event_ignores_async_instant_and_counters")
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

    i32.const 67
    i32.const 3
    f64.const 3
    f64.const 0
    i32.const 1
    i32.const 2
    i32.const 0
    call $write_event
    global.get $EVENT
    call $index_add_event
    global.get $INDEX_INGEST_STATUS_IGNORED
    i32.const 327
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

    i32.const 21
    global.get $ALT_PAGE
    i32.const 10
    call $index_writer_init

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

  (func (export "test_validation_checks_compact_column_codecs")
    call $fill_valid_page
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 16
    i32.add
    i32.const 1
    i32.add
    global.get $INDEX_ENCODING_UVARINT
    i32.store8
    i32.const 193
    i32.const 127
    i32.store8
    call $commit_footer

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_OK
    i32.const 230
    call $assert_eq_i32

    call $fill_valid_page
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 16
    i32.add
    i32.const 1
    i32.add
    global.get $INDEX_ENCODING_UVARINT
    i32.store8
    i32.const 193
    i32.const 0x80
    i32.store8
    call $commit_footer

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_BAD_DIRECTORY
    i32.const 231
    call $assert_eq_i32

    call $fill_valid_page
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 16
    i32.add
    i32.const 1
    i32.add
    i32.const 99
    i32.store8
    call $commit_footer

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_BAD_DIRECTORY
    i32.const 232
    call $assert_eq_i32

    call $fill_valid_page
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 16
    i32.add
    i32.const 1
    i32.add
    i32.const 0
    i32.store8
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 16
    i32.add
    i32.const 8
    i32.add
    i32.const 0
    i32.store
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 16
    i32.add
    i32.const 12
    i32.add
    i32.const 0
    i32.store
    call $commit_footer

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_MISSING_REQUIRED_COLUMN
    i32.const 243
    call $assert_eq_i32

    call $fill_valid_page
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 16
    i32.add
    i32.const 1
    i32.add
    i32.const 0
    i32.store8
    call $commit_footer

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_BAD_DIRECTORY
    i32.const 248
    call $assert_eq_i32

    call $fill_valid_page
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 16
    i32.add
    i32.const 1
    i32.add
    global.get $INDEX_ENCODING_SIDE_REF
    i32.store8
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 16
    i32.add
    i32.const 4
    i32.add
    i32.const 200
    i32.store
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 16
    i32.add
    i32.const 8
    i32.add
    i32.const 4
    i32.store
    i32.const 200
    i32.const 1
    i32.store8
    i32.const 201
    i32.const 2
    i32.store8
    i32.const 202
    i32.const 3
    i32.store8
    i32.const 203
    i32.const 4
    i32.store8
    global.get $PAGE
    i32.const 32
    i32.add
    i32.const 140
    i32.store
    global.get $PAGE
    call $index_update_header_crc
    drop
    call $commit_footer

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_OK
    i32.const 244
    call $assert_eq_i32

    call $fill_valid_page
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 16
    i32.add
    i32.const 1
    i32.add
    global.get $INDEX_ENCODING_SIDE_REF
    i32.store8
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 16
    i32.add
    i32.const 4
    i32.add
    i32.const 200
    i32.store
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 16
    i32.add
    i32.const 8
    i32.add
    i32.const 5
    i32.store
    i32.const 200
    i32.const 1
    i32.store8
    i32.const 201
    i32.const 2
    i32.store8
    i32.const 202
    i32.const 3
    i32.store8
    i32.const 203
    i32.const 4
    i32.store8
    i32.const 204
    i32.const 0
    i32.store8
    global.get $PAGE
    i32.const 32
    i32.add
    i32.const 141
    i32.store
    global.get $PAGE
    call $index_update_header_crc
    drop
    call $commit_footer

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_BAD_DIRECTORY
    i32.const 249
    call $assert_eq_i32

    call $fill_valid_page
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 16
    i32.add
    i32.const 1
    i32.add
    global.get $INDEX_ENCODING_RLE
    i32.store8
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 16
    i32.add
    i32.const 2
    i32.add
    global.get $INDEX_ENCODING_DICT8
    i32.store16
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 16
    i32.add
    i32.const 4
    i32.add
    i32.const 200
    i32.store
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 16
    i32.add
    i32.const 8
    i32.add
    i32.const 2
    i32.store
    i32.const 200
    i32.const 6
    i32.store8
    i32.const 201
    i32.const 7
    i32.store8
    global.get $PAGE
    i32.const 32
    i32.add
    i32.const 140
    i32.store
    global.get $PAGE
    call $index_update_header_crc
    drop
    call $commit_footer

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_OK
    i32.const 245
    call $assert_eq_i32

    call $fill_valid_page
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 16
    i32.add
    i32.const 1
    i32.add
    global.get $INDEX_ENCODING_UVARINT
    i32.store8
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 16
    i32.add
    i32.const 4
    i32.add
    i32.const 200
    i32.store
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 16
    i32.add
    i32.const 8
    i32.add
    i32.const 2
    i32.store
    i32.const 200
    i32.const 127
    i32.store8
    i32.const 201
    i32.const 0
    i32.store8
    global.get $PAGE
    i32.const 32
    i32.add
    i32.const 140
    i32.store
    global.get $PAGE
    call $index_update_header_crc
    drop
    call $commit_footer

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_BAD_DIRECTORY
    i32.const 246
    call $assert_eq_i32

    call $fill_valid_page
    global.get $DIR_PTR
    i32.const 4
    i32.add
    i32.const 16
    i32.add
    i32.const 1
    i32.add
    global.get $INDEX_ENCODING_DICT16
    i32.store8
    call $commit_footer

    global.get $PAGE
    global.get $PAGE_BYTES
    call $index_validate_page
    global.get $INDEX_STATUS_BAD_DIRECTORY
    i32.const 247
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
    i32.const 0
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
    (local $i i32)

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

    i32.const 21
    global.get $ALT_PAGE
    i32.const 5
    call $index_writer_init

    block $writer_done
      loop $writer_fill
        local.get $i
        global.get $INDEX_TRACK_CAPACITY
        i32.ge_u
        br_if $writer_done

        i32.const 200
        local.get $i
        call $index_track_for_pid_tid
        drop

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $writer_fill
      end
    end

    i32.const 88
    i32.const 1000
    f64.const 1
    f64.const 1
    i32.const 200
    global.get $INDEX_TRACK_CAPACITY
    i32.const 0
    call $write_event

    global.get $EVENT
    call $index_writer_append_event
    global.get $INDEX_WRITER_STATUS_HOST_WRITE_FAILED
    i32.const 297
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
