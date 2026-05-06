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

    local.get $encoding
    global.get $INDEX_ENCODING_FIXED64
    i32.eq
    if
      i32.const 8
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
