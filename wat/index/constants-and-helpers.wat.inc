  (import "env" "memory" (memory $memory 1 32768))
  (import "host" "opfs_index_read" (func $opfs_index_read (param i32 i64 i32 i32) (result i32)))
  (import "host" "opfs_index_write" (func $opfs_index_write (param i32 i64 i32 i32) (result i32)))
  (import "host" "opfs_index_flush" (func $opfs_index_flush (param i32) (result i32)))
  (import "mem" "MEM_DICT_BASE" (global $MEM_DICT_BASE i32))
  (import "mem" "MEM_INDEX_CACHE_BASE" (global $MEM_INDEX_CACHE_BASE i32))
  (import "mem" "MEM_INDEX_CACHE_SIZE" (global $MEM_INDEX_CACHE_SIZE i32))
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
  (global $INDEX_SLICE_COLUMN_START_TS (export "INDEX_SLICE_COLUMN_START_TS") i32 (i32.const 1))
  (global $INDEX_SLICE_COLUMN_DUR (export "INDEX_SLICE_COLUMN_DUR") i32 (i32.const 2))
  (global $INDEX_SLICE_COLUMN_NAME_ID (export "INDEX_SLICE_COLUMN_NAME_ID") i32 (i32.const 3))
  (global $INDEX_SLICE_COLUMN_DEPTH (export "INDEX_SLICE_COLUMN_DEPTH") i32 (i32.const 4))
  (global $INDEX_SLICE_COLUMN_CAT_ID (export "INDEX_SLICE_COLUMN_CAT_ID") i32 (i32.const 5))
  (global $INDEX_SLICE_COLUMN_COLOR (export "INDEX_SLICE_COLUMN_COLOR") i32 (i32.const 6))
  (global $INDEX_COUNTER_COLUMN_TS (export "INDEX_COUNTER_COLUMN_TS") i32 (i32.const 1))
  (global $INDEX_COUNTER_COLUMN_NAME_ID (export "INDEX_COUNTER_COLUMN_NAME_ID") i32 (i32.const 2))
  (global $INDEX_COUNTER_COLUMN_VALUE (export "INDEX_COUNTER_COLUMN_VALUE") i32 (i32.const 3))
  (global $INDEX_DECODE_HINT_COMPACT_SLICES (export "INDEX_DECODE_HINT_COMPACT_SLICES") i32 (i32.const 1))
  (global $INDEX_DECODE_HINT_COUNTERS (export "INDEX_DECODE_HINT_COUNTERS") i32 (i32.const 2))
  (global $INDEX_DECODE_HINT_PARTIAL (export "INDEX_DECODE_HINT_PARTIAL") i32 (i32.const 4))

  (global $INDEX_ENCODING_ABSENT (export "INDEX_ENCODING_ABSENT") i32 (i32.const 0))
  (global $INDEX_ENCODING_UVARINT (export "INDEX_ENCODING_UVARINT") i32 (i32.const 1))
  (global $INDEX_ENCODING_ZIGZAG_VARINT (export "INDEX_ENCODING_ZIGZAG_VARINT") i32 (i32.const 2))
  (global $INDEX_ENCODING_DICT8 (export "INDEX_ENCODING_DICT8") i32 (i32.const 3))
  (global $INDEX_ENCODING_DICT16 (export "INDEX_ENCODING_DICT16") i32 (i32.const 4))
  (global $INDEX_ENCODING_FIXED8 (export "INDEX_ENCODING_FIXED8") i32 (i32.const 5))
  (global $INDEX_ENCODING_RLE (export "INDEX_ENCODING_RLE") i32 (i32.const 6))
  (global $INDEX_ENCODING_SIDE_REF (export "INDEX_ENCODING_SIDE_REF") i32 (i32.const 7))
  (global $INDEX_ENCODING_FIXED32 (export "INDEX_ENCODING_FIXED32") i32 (i32.const 8))
  (global $INDEX_ENCODING_FIXED64 (export "INDEX_ENCODING_FIXED64") i32 (i32.const 9))

  (global $INDEX_CODEC_STATUS_OK (export "INDEX_CODEC_STATUS_OK") i32 (i32.const 0))
  (global $INDEX_CODEC_STATUS_BAD_VARINT (export "INDEX_CODEC_STATUS_BAD_VARINT") i32 (i32.const 1))
  (global $INDEX_CODEC_STATUS_BAD_RLE (export "INDEX_CODEC_STATUS_BAD_RLE") i32 (i32.const 2))
  (global $INDEX_CODEC_STATUS_BAD_ENCODING (export "INDEX_CODEC_STATUS_BAD_ENCODING") i32 (i32.const 3))

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
  (global $INDEX_SLICE_WRITER_DIRECTORY_BYTES i32 (i32.const 100))
  (global $INDEX_SLICE_WRITER_COLUMN_BASE i32 (i32.const 164))
  (global $INDEX_SLICE_WRITER_START_OFFSET i32 (i32.const 164))
  (global $INDEX_SLICE_WRITER_DUR_OFFSET i32 (i32.const 14664))
  (global $INDEX_SLICE_WRITER_NAME_OFFSET i32 (i32.const 29164))
  (global $INDEX_SLICE_WRITER_DEPTH_OFFSET i32 (i32.const 34964))
  (global $INDEX_SLICE_WRITER_CAT_OFFSET i32 (i32.const 37864))
  (global $INDEX_SLICE_WRITER_COLOR_OFFSET i32 (i32.const 43664))
  (global $INDEX_COUNTER_WRITER_DIRECTORY_BYTES i32 (i32.const 52))
  (global $INDEX_COUNTER_WRITER_COLUMN_BASE i32 (i32.const 116))
  (global $INDEX_COUNTER_WRITER_TS_OFFSET i32 (i32.const 116))
  (global $INDEX_COUNTER_WRITER_NAME_OFFSET i32 (i32.const 14616))
  (global $INDEX_COUNTER_WRITER_VALUE_OFFSET i32 (i32.const 20416))
  (global $INDEX_PAGE_CATALOG_ENTRY_BYTES (export "INDEX_PAGE_CATALOG_ENTRY_BYTES") i32 (i32.const 20))
  (global $INDEX_PAGE_CATALOG_CAPACITY (export "INDEX_PAGE_CATALOG_CAPACITY") i32 (i32.const 4096))
  (global $INDEX_QUERY_RESULT_BYTES (export "INDEX_QUERY_RESULT_BYTES") i32 (i32.const 24))
  (global $INDEX_READER_SLOT_META_BASE i32 (i32.const 0x00080000))
  (global $INDEX_READER_SLOT_META_BYTES i32 (i32.const 16))
  (global $INDEX_TRACK_TABLE_BASE i32 (i32.const 0x00090000))
  (global $INDEX_TRACK_ENTRY_BYTES (export "INDEX_TRACK_ENTRY_BYTES") i32 (i32.const 32))
  (global $INDEX_TRACK_CAPACITY (export "INDEX_TRACK_CAPACITY") i32 (i32.const 2048))
  (global $INDEX_TRACK_STATUS_OK (export "INDEX_TRACK_STATUS_OK") i32 (i32.const 0))
  (global $INDEX_TRACK_STATUS_INVALID (export "INDEX_TRACK_STATUS_INVALID") i32 (i32.const 1))
  (global $INDEX_TRACK_STATUS_FULL (export "INDEX_TRACK_STATUS_FULL") i32 (i32.const 2))
  (global $INDEX_SLICE_STACK_BASE i32 (i32.const 0x000A0000))
  (global $INDEX_SLICE_STACK_ENTRY_BYTES (export "INDEX_SLICE_STACK_ENTRY_BYTES") i32 (i32.const 16))
  (global $INDEX_SLICE_STACK_MAX_DEPTH (export "INDEX_SLICE_STACK_MAX_DEPTH") i32 (i32.const 12))
  (global $INDEX_INGEST_STATUS_OK (export "INDEX_INGEST_STATUS_OK") i32 (i32.const 0))
  (global $INDEX_INGEST_STATUS_IGNORED (export "INDEX_INGEST_STATUS_IGNORED") i32 (i32.const 1))
  (global $INDEX_INGEST_STATUS_TRACK_FULL (export "INDEX_INGEST_STATUS_TRACK_FULL") i32 (i32.const 2))
  (global $INDEX_INGEST_STATUS_STACK_OVERFLOW (export "INDEX_INGEST_STATUS_STACK_OVERFLOW") i32 (i32.const 3))
  (global $INDEX_INGEST_STATUS_STACK_UNDERFLOW (export "INDEX_INGEST_STATUS_STACK_UNDERFLOW") i32 (i32.const 4))

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
  (global $index_writer_bucket_end (mut i32) (i32.const 0))
  (global $index_writer_mode (mut i32) (i32.const 0))
  (global $index_writer_page_track (mut i32) (i32.const -1))
  (global $index_slice_writer_start_len (mut i32) (i32.const 0))
  (global $index_slice_writer_dur_len (mut i32) (i32.const 0))
  (global $index_slice_writer_color_len (mut i32) (i32.const 0))
  (global $index_counter_writer_ts_len (mut i32) (i32.const 0))

  (global $index_reader_file (mut i32) (i32.const 0))
  (global $index_reader_cached_level (mut i32) (i32.const -1))
  (global $index_reader_cached_page_id (mut i32) (i32.const -1))
  (global $index_reader_last_status (mut i32) (i32.const 0))
  (global $index_reader_last_hit (mut i32) (i32.const 0))
  (global $index_reader_configured_slots (mut i32) (i32.const 0))
  (global $index_reader_clock (mut i32) (i32.const 0))
  (global $index_reader_last_slot (mut i32) (i32.const -1))
  (global $index_reader_cache_hits (mut i32) (i32.const 0))
  (global $index_reader_cache_misses (mut i32) (i32.const 0))
  (global $index_reader_cache_evictions (mut i32) (i32.const 0))
  (global $index_covered_range_valid (mut i32) (i32.const 0))
  (global $index_covered_range_start (mut i32) (i32.const 0))
  (global $index_covered_range_end (mut i32) (i32.const 0))
  (global $index_track_count (mut i32) (i32.const 0))
  (global $index_slice_page_count (mut i32) (i32.const 0))

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
