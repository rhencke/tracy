(module
  (import "env" "memory" (memory $memory 1 32768))
  (import "host" "opfs_index_read" (func $opfs_index_read (param i32 i64 i32 i32) (result i32)))
  (import "host" "opfs_index_write" (func $opfs_index_write (param i32 i64 i32 i32) (result i32)))
  (import "host" "opfs_index_flush" (func $opfs_index_flush (param i32) (result i32)))
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

  (global $INDEX_ENCODING_ABSENT (export "INDEX_ENCODING_ABSENT") i32 (i32.const 0))
  (global $INDEX_ENCODING_UVARINT (export "INDEX_ENCODING_UVARINT") i32 (i32.const 1))
  (global $INDEX_ENCODING_ZIGZAG_VARINT (export "INDEX_ENCODING_ZIGZAG_VARINT") i32 (i32.const 2))
  (global $INDEX_ENCODING_DICT8 (export "INDEX_ENCODING_DICT8") i32 (i32.const 3))
  (global $INDEX_ENCODING_DICT16 (export "INDEX_ENCODING_DICT16") i32 (i32.const 4))
  (global $INDEX_ENCODING_FIXED8 (export "INDEX_ENCODING_FIXED8") i32 (i32.const 5))
  (global $INDEX_ENCODING_RLE (export "INDEX_ENCODING_RLE") i32 (i32.const 6))
  (global $INDEX_ENCODING_SIDE_REF (export "INDEX_ENCODING_SIDE_REF") i32 (i32.const 7))
  (global $INDEX_ENCODING_FIXED32 (export "INDEX_ENCODING_FIXED32") i32 (i32.const 8))

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
  (global $INDEX_READER_SLOT_META_BASE i32 (i32.const 0x00080000))
  (global $INDEX_READER_SLOT_META_BYTES i32 (i32.const 16))

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
  (global $index_reader_configured_slots (mut i32) (i32.const 0))
  (global $index_reader_clock (mut i32) (i32.const 0))
  (global $index_reader_last_slot (mut i32) (i32.const -1))

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

  (func $index_zigzag_encode_i32 (export "index_zigzag_encode_i32") (param $value i32) (result i32)
    local.get $value
    i32.const 1
    i32.shl
    local.get $value
    i32.const 31
    i32.shr_s
    i32.xor
  )

  (func $index_zigzag_decode_i32 (export "index_zigzag_decode_i32") (param $value i32) (result i32)
    local.get $value
    i32.const 1
    i32.shr_u
    i32.const 0
    local.get $value
    i32.const 1
    i32.and
    i32.sub
    i32.xor
  )

  (func $index_uvarint_size (export "index_uvarint_size") (param $value i32) (result i32)
    local.get $value
    i32.const 128
    i32.lt_u
    if (result i32)
      i32.const 1
    else
      local.get $value
      i32.const 16384
      i32.lt_u
      if (result i32)
        i32.const 2
      else
        local.get $value
        i32.const 2097152
        i32.lt_u
        if (result i32)
          i32.const 3
        else
          local.get $value
          i32.const 268435456
          i32.lt_u
          if (result i32)
            i32.const 4
          else
            i32.const 5
          end
        end
      end
    end
  )

  (func $index_uvarint_write (export "index_uvarint_write") (param $ptr i32) (param $value i32) (result i32)
    (local $written i32)

    block $done
      loop $loop
        local.get $value
        i32.const 128
        i32.lt_u
        if
          local.get $ptr
          local.get $written
          i32.add
          local.get $value
          i32.store8

          local.get $written
          i32.const 1
          i32.add
          return
        end

        local.get $ptr
        local.get $written
        i32.add
        local.get $value
        i32.const 0x7F
        i32.and
        i32.const 0x80
        i32.or
        i32.store8

        local.get $value
        i32.const 7
        i32.shr_u
        local.set $value

        local.get $written
        i32.const 1
        i32.add
        local.set $written
        br $loop
      end
    end

    i32.const 0
  )

  (func $index_uvarint_read (export "index_uvarint_read") (param $ptr i32) (param $len i32) (result i32 i32 i32)
    (local $i i32)
    (local $byte i32)
    (local $value i32)
    (local $shift i32)

    block $bad
      loop $loop
        local.get $i
        local.get $len
        i32.ge_u
        br_if $bad

        local.get $i
        i32.const 5
        i32.ge_u
        br_if $bad

        local.get $ptr
        local.get $i
        i32.add
        i32.load8_u
        local.set $byte

        local.get $i
        i32.const 4
        i32.eq
        local.get $byte
        i32.const 0x70
        i32.and
        i32.const 0
        i32.ne
        i32.and
        br_if $bad

        local.get $value
        local.get $byte
        i32.const 0x7F
        i32.and
        local.get $shift
        i32.shl
        i32.or
        local.set $value

        local.get $byte
        i32.const 0x80
        i32.and
        i32.eqz
        if
          local.get $value
          call $index_uvarint_size
          local.get $i
          i32.const 1
          i32.add
          i32.ne
          br_if $bad

          local.get $value
          local.get $i
          i32.const 1
          i32.add
          global.get $INDEX_CODEC_STATUS_OK
          return
        end

        local.get $shift
        i32.const 7
        i32.add
        local.set $shift

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      end
    end

    i32.const 0
    i32.const 0
    global.get $INDEX_CODEC_STATUS_BAD_VARINT
  )

  (func $index_fixed_value_width (param $encoding i32) (result i32)
    local.get $encoding
    global.get $INDEX_ENCODING_DICT8
    i32.eq
    local.get $encoding
    global.get $INDEX_ENCODING_FIXED8
    i32.eq
    i32.or
    if
      i32.const 1
      return
    end

    local.get $encoding
    global.get $INDEX_ENCODING_DICT16
    i32.eq
    if
      i32.const 2
      return
    end

    local.get $encoding
    global.get $INDEX_ENCODING_FIXED32
    i32.eq
    if
      i32.const 4
      return
    end

    i32.const 0
  )

  (func $index_skip_side_ref (param $ptr i32) (param $len i32) (result i32 i32)
    (local $i i32)
    (local $value i32)
    (local $bytes i32)
    (local $status i32)
    (local $total i32)

    block $bad
      loop $loop
        local.get $i
        i32.const 4
        i32.ge_u
        if
          local.get $total
          global.get $INDEX_CODEC_STATUS_OK
          return
        end

        local.get $ptr
        local.get $total
        i32.add
        local.get $len
        local.get $total
        i32.sub
        call $index_uvarint_read
        local.set $status
        local.set $bytes
        local.set $value

        local.get $status
        global.get $INDEX_CODEC_STATUS_OK
        i32.ne
        br_if $bad

        local.get $total
        local.get $bytes
        i32.add
        local.set $total

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      end
    end

    i32.const 0
    global.get $INDEX_CODEC_STATUS_BAD_VARINT
  )

  (func $index_skip_encoded_value (param $ptr i32) (param $len i32) (param $encoding i32) (result i32 i32)
    (local $width i32)
    (local $value i32)
    (local $bytes i32)
    (local $status i32)

    local.get $encoding
    global.get $INDEX_ENCODING_UVARINT
    i32.eq
    local.get $encoding
    global.get $INDEX_ENCODING_ZIGZAG_VARINT
    i32.eq
    i32.or
    if
      local.get $ptr
      local.get $len
      call $index_uvarint_read
      local.set $status
      local.set $bytes
      local.set $value
      local.get $status
      global.get $INDEX_CODEC_STATUS_OK
      i32.ne
      if
        i32.const 0
        local.get $status
        return
      end

      local.get $bytes
      global.get $INDEX_CODEC_STATUS_OK
      return
    end

    local.get $encoding
    global.get $INDEX_ENCODING_SIDE_REF
    i32.eq
    if
      local.get $ptr
      local.get $len
      call $index_skip_side_ref
      return
    end

    local.get $encoding
    call $index_fixed_value_width
    local.set $width

    local.get $width
    i32.eqz
    if
      i32.const 0
      global.get $INDEX_CODEC_STATUS_BAD_ENCODING
      return
    end

    local.get $len
    local.get $width
    i32.lt_u
    if
      i32.const 0
      global.get $INDEX_CODEC_STATUS_BAD_VARINT
      return
    end

    local.get $width
    global.get $INDEX_CODEC_STATUS_OK
  )

  (func $index_column_fixed_width (export "index_column_fixed_width") (param $encoding i32) (result i32)
    local.get $encoding
    call $index_fixed_value_width
  )

  (func $index_dict8_value (export "index_dict8_value") (param $ptr i32) (param $rows i32) (param $row i32) (result i32 i32)
    local.get $row
    local.get $rows
    i32.ge_u
    if
      i32.const 0
      global.get $INDEX_CODEC_STATUS_BAD_ENCODING
      return
    end

    local.get $ptr
    local.get $row
    i32.add
    i32.load8_u
    global.get $INDEX_CODEC_STATUS_OK
  )

  (func $index_dict16_value (export "index_dict16_value") (param $ptr i32) (param $rows i32) (param $row i32) (result i32 i32)
    local.get $row
    local.get $rows
    i32.ge_u
    if
      i32.const 0
      global.get $INDEX_CODEC_STATUS_BAD_ENCODING
      return
    end

    local.get $ptr
    local.get $row
    i32.const 2
    i32.mul
    i32.add
    i32.load16_u
    global.get $INDEX_CODEC_STATUS_OK
  )

  (func $index_fixed8_value (export "index_fixed8_value") (param $ptr i32) (param $rows i32) (param $row i32) (result i32 i32)
    local.get $ptr
    local.get $rows
    local.get $row
    call $index_dict8_value
  )

  (func $index_rle_validate (export "index_rle_validate") (param $ptr i32) (param $len i32) (param $rows i32) (param $value_encoding i32) (result i32)
    (local $cursor i32)
    (local $decoded i32)
    (local $header i32)
    (local $header_bytes i32)
    (local $status i32)
    (local $run_len i32)
    (local $mode i32)
    (local $i i32)
    (local $bytes i32)

    local.get $rows
    i32.eqz
    if
      local.get $len
      i32.eqz
      if (result i32)
        global.get $INDEX_CODEC_STATUS_OK
      else
        global.get $INDEX_CODEC_STATUS_BAD_RLE
      end
      return
    end

    block $bad
      loop $packets
        local.get $decoded
        local.get $rows
        i32.ge_u
        if
          local.get $decoded
          local.get $rows
          i32.ne
          br_if $bad

          local.get $cursor
          local.get $len
          i32.ne
          br_if $bad

          global.get $INDEX_CODEC_STATUS_OK
          return
        end

        local.get $ptr
        local.get $cursor
        i32.add
        local.get $len
        local.get $cursor
        i32.sub
        call $index_uvarint_read
        local.set $status
        local.set $header_bytes
        local.set $header

        local.get $status
        global.get $INDEX_CODEC_STATUS_OK
        i32.ne
        br_if $bad

        local.get $cursor
        local.get $header_bytes
        i32.add
        local.set $cursor

        local.get $header
        i32.const 2
        i32.shr_u
        local.set $run_len

        local.get $header
        i32.const 3
        i32.and
        local.set $mode

        local.get $run_len
        i32.eqz
        br_if $bad

        local.get $decoded
        local.get $run_len
        i32.add
        local.get $rows
        i32.gt_u
        br_if $bad

        local.get $mode
        i32.const 1
        i32.eq
        if
          i32.const 0
          local.set $i
          block $literal_done
            loop $literal
              local.get $i
              local.get $run_len
              i32.ge_u
              br_if $literal_done

              local.get $ptr
              local.get $cursor
              i32.add
              local.get $len
              local.get $cursor
              i32.sub
              local.get $value_encoding
              call $index_skip_encoded_value
              local.set $status
              local.set $bytes

              local.get $status
              global.get $INDEX_CODEC_STATUS_OK
              i32.ne
              br_if $bad

              local.get $cursor
              local.get $bytes
              i32.add
              local.set $cursor

              local.get $i
              i32.const 1
              i32.add
              local.set $i
              br $literal
            end
          end
        else
          local.get $mode
          i32.const 2
          i32.eq
          local.get $mode
          i32.const 3
          i32.eq
          i32.or
          if
            local.get $ptr
            local.get $cursor
            i32.add
            local.get $len
            local.get $cursor
            i32.sub
            local.get $mode
            i32.const 3
            i32.eq
            if (result i32)
              global.get $INDEX_ENCODING_SIDE_REF
            else
              local.get $value_encoding
            end
            call $index_skip_encoded_value
            local.set $status
            local.set $bytes

            local.get $status
            global.get $INDEX_CODEC_STATUS_OK
            i32.ne
            br_if $bad

            local.get $cursor
            local.get $bytes
            i32.add
            local.set $cursor
          end
        end

        local.get $decoded
        local.get $run_len
        i32.add
        local.set $decoded

        br $packets
      end
    end

    global.get $INDEX_CODEC_STATUS_BAD_RLE
  )

  (func $index_column_payload_status (param $ptr i32) (param $len i32) (param $encoding i32) (param $flags i32) (param $rows i32) (result i32)
    (local $width i32)
    (local $cursor i32)
    (local $i i32)
    (local $bytes i32)
    (local $status i32)

    local.get $encoding
    global.get $INDEX_ENCODING_ABSENT
    i32.eq
    if
      local.get $len
      i32.eqz
      local.get $rows
      i32.eqz
      i32.and
      if (result i32)
        global.get $INDEX_CODEC_STATUS_OK
      else
        global.get $INDEX_CODEC_STATUS_BAD_ENCODING
      end
      return
    end

    local.get $encoding
    global.get $INDEX_ENCODING_UVARINT
    i32.eq
    local.get $encoding
    global.get $INDEX_ENCODING_ZIGZAG_VARINT
    i32.eq
    i32.or
    if
      block $bad
        block $done
          loop $values
            local.get $i
            local.get $rows
            i32.ge_u
            br_if $done

            local.get $ptr
            local.get $cursor
            i32.add
            local.get $len
            local.get $cursor
            i32.sub
            call $index_uvarint_read
            local.set $status
            local.set $bytes
            drop

            local.get $status
            global.get $INDEX_CODEC_STATUS_OK
            i32.ne
            br_if $bad

            local.get $cursor
            local.get $bytes
            i32.add
            local.set $cursor

            local.get $i
            i32.const 1
            i32.add
            local.set $i
            br $values
          end
        end

        local.get $cursor
        local.get $len
        i32.eq
        if (result i32)
          global.get $INDEX_CODEC_STATUS_OK
        else
          global.get $INDEX_CODEC_STATUS_BAD_VARINT
        end
        return
      end

      global.get $INDEX_CODEC_STATUS_BAD_VARINT
      return
    end

    local.get $encoding
    global.get $INDEX_ENCODING_RLE
    i32.eq
    if
      local.get $ptr
      local.get $len
      local.get $rows
      local.get $flags
      i32.const 0xFF
      i32.and
      call $index_rle_validate
      return
    end

    local.get $encoding
    global.get $INDEX_ENCODING_SIDE_REF
    i32.eq
    if
      block $bad
        block $done
          loop $refs
            local.get $i
            local.get $rows
            i32.ge_u
            br_if $done

            local.get $ptr
            local.get $cursor
            i32.add
            local.get $len
            local.get $cursor
            i32.sub
            call $index_skip_side_ref
            local.set $status
            local.set $bytes

            local.get $status
            global.get $INDEX_CODEC_STATUS_OK
            i32.ne
            br_if $bad

            local.get $cursor
            local.get $bytes
            i32.add
            local.set $cursor

            local.get $i
            i32.const 1
            i32.add
            local.set $i
            br $refs
          end
        end

        local.get $cursor
        local.get $len
        i32.eq
        if (result i32)
          global.get $INDEX_CODEC_STATUS_OK
        else
          global.get $INDEX_CODEC_STATUS_BAD_VARINT
        end
        return
      end

      global.get $INDEX_CODEC_STATUS_BAD_VARINT
      return
    end

    local.get $encoding
    call $index_fixed_value_width
    local.set $width

    local.get $width
    i32.eqz
    if
      global.get $INDEX_CODEC_STATUS_BAD_ENCODING
      return
    end

    local.get $len
    local.get $rows
    local.get $width
    i32.mul
    i32.eq
    if (result i32)
      global.get $INDEX_CODEC_STATUS_OK
    else
      global.get $INDEX_CODEC_STATUS_BAD_ENCODING
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
    call $index_reader_clear_cache
  )

  (func (export "read_page") (param $level i32) (param $page_id i32) (result i32)
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
    call $index_reader_choose_slot
    local.tee $slot
    global.set $index_reader_last_slot
    local.get $slot
    call $index_reader_slot_ptr
    local.set $page_ptr

    global.get $index_reader_file
    local.get $page_id
    i64.extend_i32_u
    i64.const 65536
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
