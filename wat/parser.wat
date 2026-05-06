(module
  (import "env" "memory" (memory $memory 1 32768))
  ;; @generated host-imports parser:start
  (import "host" "opfs_source_read" (func $opfs_source_read (param i32 i64 i32 i32) (result i32)))
  ;; @generated host-imports parser:end
  (import "mem" "MEM_RING_BASE" (global $MEM_RING_BASE i32))
  (import "mem" "MEM_RING_SIZE" (global $MEM_RING_SIZE i32))
  ;; @generated parser-state-imports parser:start
  (import "parser_state" "PARSER_STACK_CAP" (global $PARSER_STACK_CAP i32))
  (import "parser_state" "PARSER_PARTIAL_TOKEN_CAP" (global $PARSER_PARTIAL_TOKEN_CAP i32))
  (import "parser_state" "PARSER_STATE_STATUS_OFFSET" (global $PARSER_STATE_STATUS_OFFSET i32))
  (import "parser_state" "PARSER_STATE_YIELD_BUDGET_MS_OFFSET" (global $PARSER_STATE_YIELD_BUDGET_MS_OFFSET i32))
  (import "parser_state" "PARSER_STATE_SOURCE_ID_OFFSET" (global $PARSER_STATE_SOURCE_ID_OFFSET i32))
  (import "parser_state" "PARSER_STATE_FLAGS_OFFSET" (global $PARSER_STATE_FLAGS_OFFSET i32))
  (import "parser_state" "PARSER_STATE_FILE_OFFSET_OFFSET" (global $PARSER_STATE_FILE_OFFSET_OFFSET i32))
  (import "parser_state" "PARSER_STATE_RING_READ_OFFSET" (global $PARSER_STATE_RING_READ_OFFSET i32))
  (import "parser_state" "PARSER_STATE_RING_WRITE_OFFSET" (global $PARSER_STATE_RING_WRITE_OFFSET i32))
  (import "parser_state" "PARSER_STATE_RING_COUNT_OFFSET" (global $PARSER_STATE_RING_COUNT_OFFSET i32))
  (import "parser_state" "PARSER_STATE_DEPTH_OFFSET" (global $PARSER_STATE_DEPTH_OFFSET i32))
  (import "parser_state" "PARSER_STATE_STACK_LEN_OFFSET" (global $PARSER_STATE_STACK_LEN_OFFSET i32))
  (import "parser_state" "PARSER_STATE_TOKEN_KIND_OFFSET" (global $PARSER_STATE_TOKEN_KIND_OFFSET i32))
  (import "parser_state" "PARSER_STATE_PARTIAL_TOKEN_LEN_OFFSET" (global $PARSER_STATE_PARTIAL_TOKEN_LEN_OFFSET i32))
  (import "parser_state" "PARSER_STATE_STRING_ESCAPE_OFFSET" (global $PARSER_STATE_STRING_ESCAPE_OFFSET i32))
  (import "parser_state" "PARSER_STATE_UNICODE_ACCUM_OFFSET" (global $PARSER_STATE_UNICODE_ACCUM_OFFSET i32))
  (import "parser_state" "PARSER_STATE_EVENT_FIELD_OFFSET" (global $PARSER_STATE_EVENT_FIELD_OFFSET i32))
  (import "parser_state" "PARSER_STATE_EVENT_FIELD_MASK_OFFSET" (global $PARSER_STATE_EVENT_FIELD_MASK_OFFSET i32))
  (import "parser_state" "PARSER_STATE_CURRENT_KEY_HASH_OFFSET" (global $PARSER_STATE_CURRENT_KEY_HASH_OFFSET i32))
  (import "parser_state" "PARSER_STATE_EVENT_COUNT_OFFSET" (global $PARSER_STATE_EVENT_COUNT_OFFSET i32))
  (import "parser_state" "PARSER_STATE_STACK_OFFSET" (global $PARSER_STATE_STACK_OFFSET i32))
  (import "parser_state" "PARSER_STATE_PARTIAL_TOKEN_OFFSET" (global $PARSER_STATE_PARTIAL_TOKEN_OFFSET i32))
  (import "parser_state" "PARSER_STATUS_DONE" (global $PARSER_STATUS_DONE i32))
  (import "parser_state" "PARSER_STATUS_YIELDED" (global $PARSER_STATUS_YIELDED i32))
  (import "parser_state" "PARSER_STATUS_MALFORMED" (global $PARSER_STATUS_MALFORMED i32))
  (import "parser_state" "PARSER_STATUS_STATE_INVALID" (global $PARSER_STATUS_STATE_INVALID i32))
  (import "parser_state" "PARSER_TOKEN_NONE" (global $PARSER_TOKEN_NONE i32))
  (import "parser_state" "PARSER_TOKEN_STRING" (global $PARSER_TOKEN_STRING i32))
  (import "parser_state" "PARSER_TOKEN_NUMBER" (global $PARSER_TOKEN_NUMBER i32))
  (import "parser_state" "PARSER_TOKEN_LITERAL" (global $PARSER_TOKEN_LITERAL i32))
  (import "parser_state" "PARSER_STACK_ARRAY" (global $PARSER_STACK_ARRAY i32))
  (import "parser_state" "PARSER_STACK_OBJECT" (global $PARSER_STACK_OBJECT i32))
  (import "parser_state" "PARSER_EVENT_FIELD_NONE" (global $PARSER_EVENT_FIELD_NONE i32))
  (import "parser_state" "PARSER_EVENT_FIELD_NAME" (global $PARSER_EVENT_FIELD_NAME i32))
  (import "parser_state" "PARSER_EVENT_FIELD_CAT" (global $PARSER_EVENT_FIELD_CAT i32))
  (import "parser_state" "PARSER_EVENT_FIELD_PHASE" (global $PARSER_EVENT_FIELD_PHASE i32))
  (import "parser_state" "PARSER_EVENT_FIELD_TS" (global $PARSER_EVENT_FIELD_TS i32))
  (import "parser_state" "PARSER_EVENT_FIELD_DUR" (global $PARSER_EVENT_FIELD_DUR i32))
  (import "parser_state" "PARSER_EVENT_FIELD_PID" (global $PARSER_EVENT_FIELD_PID i32))
  (import "parser_state" "PARSER_EVENT_FIELD_TID" (global $PARSER_EVENT_FIELD_TID i32))
  (import "parser_state" "PARSER_EVENT_FIELD_ARGS" (global $PARSER_EVENT_FIELD_ARGS i32))
  (import "parser_state" "PARSER_EVENT_FIELD_OTHER" (global $PARSER_EVENT_FIELD_OTHER i32))
  ;; @generated parser-state-imports parser:end
  (import "parser_state" "parser_state_is_valid"
    (func $parser_state_is_valid (param i32) (result i32)))

  (global $FLAG_EXPECT_KEY i32 (i32.const 1))
  (global $FLAG_AFTER_KEY i32 (i32.const 2))
  (global $DEFAULT_CHUNK_BYTES i32 (i32.const 4096))

  (func $field (param $state i32) (param $offset i32) (result i32)
    local.get $state
    local.get $offset
    i32.add
  )

  (func $load_i32 (param $state i32) (param $offset i32) (result i32)
    local.get $state
    local.get $offset
    call $field
    i32.load
  )

  (func $store_i32 (param $state i32) (param $offset i32) (param $value i32)
    local.get $state
    local.get $offset
    call $field
    local.get $value
    i32.store
  )

  (func $set_status (param $state i32) (param $status i32) (result i32)
    local.get $state
    global.get $PARSER_STATE_STATUS_OFFSET
    local.get $status
    call $store_i32
    local.get $status
  )

  (func $set_flag (param $state i32) (param $flag i32)
    local.get $state
    global.get $PARSER_STATE_FLAGS_OFFSET
    local.get $state
    global.get $PARSER_STATE_FLAGS_OFFSET
    call $load_i32
    local.get $flag
    i32.or
    call $store_i32
  )

  (func $clear_flag (param $state i32) (param $flag i32)
    local.get $state
    global.get $PARSER_STATE_FLAGS_OFFSET
    local.get $state
    global.get $PARSER_STATE_FLAGS_OFFSET
    call $load_i32
    local.get $flag
    i32.const -1
    i32.xor
    i32.and
    call $store_i32
  )

  (func $has_flag (param $state i32) (param $flag i32) (result i32)
    local.get $state
    global.get $PARSER_STATE_FLAGS_OFFSET
    call $load_i32
    local.get $flag
    i32.and
    i32.const 0
    i32.ne
  )

  (func $clear_token_buffer (param $state i32)
    local.get $state
    global.get $PARSER_STATE_PARTIAL_TOKEN_LEN_OFFSET
    i32.const 0
    call $store_i32
    local.get $state
    global.get $PARSER_STATE_STRING_ESCAPE_OFFSET
    i32.const 0
    call $store_i32
    local.get $state
    global.get $PARSER_STATE_UNICODE_ACCUM_OFFSET
    i32.const 0
    call $store_i32
  )

  (func $append_token_byte (param $state i32) (param $byte i32)
    (local $len i32)

    local.get $state
    global.get $PARSER_STATE_PARTIAL_TOKEN_LEN_OFFSET
    call $load_i32
    local.set $len

    local.get $len
    global.get $PARSER_PARTIAL_TOKEN_CAP
    i32.lt_u
    if
      local.get $state
      global.get $PARSER_STATE_PARTIAL_TOKEN_OFFSET
      call $field
      local.get $len
      i32.add
      local.get $byte
      i32.store8

      local.get $state
      global.get $PARSER_STATE_PARTIAL_TOKEN_LEN_OFFSET
      local.get $len
      i32.const 1
      i32.add
      call $store_i32
    end
  )

  (func $token_byte (param $state i32) (param $index i32) (result i32)
    local.get $state
    global.get $PARSER_STATE_PARTIAL_TOKEN_OFFSET
    call $field
    local.get $index
    i32.add
    i32.load8_u
  )

  (func $top_stack (param $state i32) (result i32)
    (local $len i32)

    local.get $state
    global.get $PARSER_STATE_STACK_LEN_OFFSET
    call $load_i32
    local.tee $len
    i32.eqz
    if
      i32.const 0
      return
    end

    local.get $state
    global.get $PARSER_STATE_STACK_OFFSET
    call $field
    local.get $len
    i32.add
    i32.const 1
    i32.sub
    i32.load8_u
  )

  (func $push_stack (param $state i32) (param $kind i32) (result i32)
    (local $len i32)

    local.get $state
    global.get $PARSER_STATE_STACK_LEN_OFFSET
    call $load_i32
    local.tee $len
    global.get $PARSER_STACK_CAP
    i32.ge_u
    if
      local.get $state
      global.get $PARSER_STATUS_MALFORMED
      call $set_status
      return
    end

    local.get $state
    global.get $PARSER_STATE_STACK_OFFSET
    call $field
    local.get $len
    i32.add
    local.get $kind
    i32.store8

    local.get $state
    global.get $PARSER_STATE_STACK_LEN_OFFSET
    local.get $len
    i32.const 1
    i32.add
    call $store_i32

    local.get $state
    global.get $PARSER_STATE_DEPTH_OFFSET
    local.get $state
    global.get $PARSER_STATE_DEPTH_OFFSET
    call $load_i32
    i32.const 1
    i32.add
    call $store_i32

    local.get $kind
    global.get $PARSER_STACK_OBJECT
    i32.eq
    if
      local.get $state
      global.get $FLAG_EXPECT_KEY
      call $set_flag
    end

    i32.const 0
  )

  (func $pop_stack (param $state i32) (param $kind i32) (result i32)
    (local $len i32)
    (local $depth i32)
    (local $mask i32)

    local.get $state
    call $top_stack
    local.get $kind
    i32.ne
    if
      local.get $state
      global.get $PARSER_STATUS_MALFORMED
      call $set_status
      return
    end

    local.get $state
    global.get $PARSER_STATE_STACK_LEN_OFFSET
    call $load_i32
    local.set $len
    local.get $state
    global.get $PARSER_STATE_DEPTH_OFFSET
    call $load_i32
    local.set $depth

    local.get $kind
    global.get $PARSER_STACK_OBJECT
    i32.eq
    if
      local.get $state
      global.get $FLAG_EXPECT_KEY
      call $clear_flag
      local.get $state
      global.get $FLAG_AFTER_KEY
      call $clear_flag

      local.get $depth
      i32.const 3
      i32.eq
      if
        local.get $state
        global.get $PARSER_STATE_EVENT_FIELD_MASK_OFFSET
        call $load_i32
        local.tee $mask
        i32.const 0
        i32.ne
        if
          local.get $state
          global.get $PARSER_STATE_EVENT_COUNT_OFFSET
          local.get $state
          global.get $PARSER_STATE_EVENT_COUNT_OFFSET
          call $load_i32
          i32.const 1
          i32.add
          call $store_i32

          local.get $state
          global.get $PARSER_STATE_EVENT_FIELD_MASK_OFFSET
          i32.const 0
          call $store_i32
        end
      end
    end

    local.get $state
    global.get $PARSER_STATE_STACK_LEN_OFFSET
    local.get $len
    i32.const 1
    i32.sub
    call $store_i32

    local.get $state
    global.get $PARSER_STATE_DEPTH_OFFSET
    local.get $depth
    i32.const 1
    i32.sub
    call $store_i32

    i32.const 0
  )

  (func $is_ws (param $byte i32) (result i32)
    local.get $byte
    i32.const 32
    i32.eq
    local.get $byte
    i32.const 9
    i32.eq
    i32.or
    local.get $byte
    i32.const 10
    i32.eq
    i32.or
    local.get $byte
    i32.const 13
    i32.eq
    i32.or
  )

  (func $is_delim (param $byte i32) (result i32)
    local.get $byte
    call $is_ws
    local.get $byte
    i32.const 44
    i32.eq
    i32.or
    local.get $byte
    i32.const 93
    i32.eq
    i32.or
    local.get $byte
    i32.const 125
    i32.eq
    i32.or
  )

  (func $is_number_byte (param $byte i32) (result i32)
    local.get $byte
    i32.const 48
    i32.ge_u
    local.get $byte
    i32.const 57
    i32.le_u
    i32.and
    local.get $byte
    i32.const 45
    i32.eq
    i32.or
    local.get $byte
    i32.const 43
    i32.eq
    i32.or
    local.get $byte
    i32.const 46
    i32.eq
    i32.or
    local.get $byte
    i32.const 69
    i32.eq
    i32.or
    local.get $byte
    i32.const 101
    i32.eq
    i32.or
  )

  (func $is_alpha (param $byte i32) (result i32)
    local.get $byte
    i32.const 65
    i32.ge_u
    local.get $byte
    i32.const 90
    i32.le_u
    i32.and
    local.get $byte
    i32.const 97
    i32.ge_u
    local.get $byte
    i32.const 122
    i32.le_u
    i32.and
    i32.or
  )

  (func $is_hex (param $byte i32) (result i32)
    local.get $byte
    i32.const 48
    i32.ge_u
    local.get $byte
    i32.const 57
    i32.le_u
    i32.and
    local.get $byte
    i32.const 65
    i32.ge_u
    local.get $byte
    i32.const 70
    i32.le_u
    i32.and
    i32.or
    local.get $byte
    i32.const 97
    i32.ge_u
    local.get $byte
    i32.const 102
    i32.le_u
    i32.and
    i32.or
  )

  (func $mark_value_seen (param $state i32)
    (local $field i32)

    local.get $state
    global.get $PARSER_STATE_EVENT_FIELD_OFFSET
    call $load_i32
    local.tee $field
    global.get $PARSER_EVENT_FIELD_NONE
    i32.ne
    if
      local.get $state
      global.get $PARSER_STATE_EVENT_FIELD_MASK_OFFSET
      local.get $state
      global.get $PARSER_STATE_EVENT_FIELD_MASK_OFFSET
      call $load_i32
      i32.const 1
      local.get $field
      i32.shl
      i32.or
      call $store_i32

      local.get $state
      global.get $PARSER_STATE_EVENT_FIELD_OFFSET
      global.get $PARSER_EVENT_FIELD_NONE
      call $store_i32
    end
  )

  (func $token_matches4 (param $state i32) (param $a i32) (param $b i32) (param $c i32) (param $d i32) (result i32)
    local.get $state
    i32.const 0
    call $token_byte
    local.get $a
    i32.eq
    local.get $state
    i32.const 1
    call $token_byte
    local.get $b
    i32.eq
    i32.and
    local.get $state
    i32.const 2
    call $token_byte
    local.get $c
    i32.eq
    i32.and
    local.get $state
    i32.const 3
    call $token_byte
    local.get $d
    i32.eq
    i32.and
  )

  (func $token_matches3 (param $state i32) (param $a i32) (param $b i32) (param $c i32) (result i32)
    local.get $state
    i32.const 0
    call $token_byte
    local.get $a
    i32.eq
    local.get $state
    i32.const 1
    call $token_byte
    local.get $b
    i32.eq
    i32.and
    local.get $state
    i32.const 2
    call $token_byte
    local.get $c
    i32.eq
    i32.and
  )

  (func $classify_key (param $state i32) (result i32)
    (local $len i32)

    local.get $state
    global.get $PARSER_STATE_PARTIAL_TOKEN_LEN_OFFSET
    call $load_i32
    local.set $len

    local.get $len
    i32.const 2
    i32.eq
    if
      local.get $state
      i32.const 0
      call $token_byte
      i32.const 112
      i32.eq
      local.get $state
      i32.const 1
      call $token_byte
      i32.const 104
      i32.eq
      i32.and
      if
        global.get $PARSER_EVENT_FIELD_PHASE
        return
      end

      local.get $state
      i32.const 0
      call $token_byte
      i32.const 116
      i32.eq
      local.get $state
      i32.const 1
      call $token_byte
      i32.const 115
      i32.eq
      i32.and
      if
        global.get $PARSER_EVENT_FIELD_TS
        return
      end
    end

    local.get $len
    i32.const 3
    i32.eq
    if
      local.get $state
      i32.const 99
      i32.const 97
      i32.const 116
      call $token_matches3
      if
        global.get $PARSER_EVENT_FIELD_CAT
        return
      end

      local.get $state
      i32.const 100
      i32.const 117
      i32.const 114
      call $token_matches3
      if
        global.get $PARSER_EVENT_FIELD_DUR
        return
      end

      local.get $state
      i32.const 112
      i32.const 105
      i32.const 100
      call $token_matches3
      if
        global.get $PARSER_EVENT_FIELD_PID
        return
      end

      local.get $state
      i32.const 116
      i32.const 105
      i32.const 100
      call $token_matches3
      if
        global.get $PARSER_EVENT_FIELD_TID
        return
      end
    end

    local.get $len
    i32.const 4
    i32.eq
    if
      local.get $state
      i32.const 110
      i32.const 97
      i32.const 109
      i32.const 101
      call $token_matches4
      if
        global.get $PARSER_EVENT_FIELD_NAME
        return
      end

      local.get $state
      i32.const 97
      i32.const 114
      i32.const 103
      i32.const 115
      call $token_matches4
      if
        global.get $PARSER_EVENT_FIELD_ARGS
        return
      end
    end

    global.get $PARSER_EVENT_FIELD_OTHER
  )

  (func $close_string (param $state i32) (result i32)
    (local $field i32)

    local.get $state
    global.get $PARSER_STATE_TOKEN_KIND_OFFSET
    global.get $PARSER_TOKEN_NONE
    call $store_i32

    local.get $state
    call $top_stack
    global.get $PARSER_STACK_OBJECT
    i32.eq
    local.get $state
    global.get $FLAG_EXPECT_KEY
    call $has_flag
    i32.and
    if
      local.get $state
      call $classify_key
      local.set $field
      local.get $state
      global.get $PARSER_STATE_EVENT_FIELD_OFFSET
      local.get $field
      call $store_i32

      local.get $state
      global.get $PARSER_STATE_CURRENT_KEY_HASH_OFFSET
      local.get $field
      call $store_i32

      local.get $state
      global.get $FLAG_EXPECT_KEY
      call $clear_flag
      local.get $state
      global.get $FLAG_AFTER_KEY
      call $set_flag

      i32.const 0
      return
    end

    local.get $state
    call $mark_value_seen
    i32.const 0
  )

  (func $process_string_byte (param $state i32) (param $byte i32) (result i32)
    (local $unicode i32)

    local.get $state
    global.get $PARSER_STATE_UNICODE_ACCUM_OFFSET
    call $load_i32
    local.tee $unicode
    i32.const 0
    i32.gt_u
    if
      local.get $byte
      call $is_hex
      i32.eqz
      if
        local.get $state
        global.get $PARSER_STATUS_MALFORMED
        call $set_status
        return
      end

      local.get $state
      global.get $PARSER_STATE_UNICODE_ACCUM_OFFSET
      local.get $unicode
      i32.const 1
      i32.sub
      call $store_i32
      i32.const 0
      return
    end

    local.get $state
    global.get $PARSER_STATE_STRING_ESCAPE_OFFSET
    call $load_i32
    if
      local.get $state
      global.get $PARSER_STATE_STRING_ESCAPE_OFFSET
      i32.const 0
      call $store_i32

      local.get $byte
      i32.const 117
      i32.eq
      if
        local.get $state
        global.get $PARSER_STATE_UNICODE_ACCUM_OFFSET
        i32.const 4
        call $store_i32
        i32.const 0
        return
      end

      local.get $byte
      i32.const 34
      i32.eq
      local.get $byte
      i32.const 92
      i32.eq
      i32.or
      local.get $byte
      i32.const 47
      i32.eq
      i32.or
      local.get $byte
      i32.const 98
      i32.eq
      i32.or
      local.get $byte
      i32.const 102
      i32.eq
      i32.or
      local.get $byte
      i32.const 110
      i32.eq
      i32.or
      local.get $byte
      i32.const 114
      i32.eq
      i32.or
      local.get $byte
      i32.const 116
      i32.eq
      i32.or
      i32.eqz
      if
        local.get $state
        global.get $PARSER_STATUS_MALFORMED
        call $set_status
        return
      end

      local.get $state
      local.get $byte
      call $append_token_byte
      i32.const 0
      return
    end

    local.get $byte
    i32.const 92
    i32.eq
    if
      local.get $state
      global.get $PARSER_STATE_STRING_ESCAPE_OFFSET
      i32.const 1
      call $store_i32
      i32.const 0
      return
    end

    local.get $byte
    i32.const 34
    i32.eq
    if
      local.get $state
      call $close_string
      return
    end

    local.get $byte
    i32.const 32
    i32.lt_u
    if
      local.get $state
      global.get $PARSER_STATUS_MALFORMED
      call $set_status
      return
    end

    local.get $state
    local.get $byte
    call $append_token_byte
    i32.const 0
  )

  (func $start_token (param $state i32) (param $token i32)
    local.get $state
    call $clear_token_buffer
    local.get $state
    global.get $PARSER_STATE_TOKEN_KIND_OFFSET
    local.get $token
    call $store_i32
  )

  (func $process_structural_byte (param $state i32) (param $byte i32) (result i32)
    local.get $byte
    call $is_ws
    if
      i32.const 0
      return
    end

    local.get $byte
    i32.const 34
    i32.eq
    if
      local.get $state
      call $top_stack
      global.get $PARSER_STACK_OBJECT
      i32.eq
      local.get $state
      global.get $FLAG_EXPECT_KEY
      call $has_flag
      i32.and
      i32.eqz
      if
        local.get $state
        call $mark_value_seen
      end
      local.get $state
      global.get $PARSER_TOKEN_STRING
      call $start_token
      i32.const 0
      return
    end

    local.get $byte
    i32.const 123
    i32.eq
    if
      local.get $state
      call $mark_value_seen
      local.get $state
      global.get $PARSER_STACK_OBJECT
      call $push_stack
      return
    end

    local.get $byte
    i32.const 91
    i32.eq
    if
      local.get $state
      call $mark_value_seen
      local.get $state
      global.get $PARSER_STACK_ARRAY
      call $push_stack
      return
    end

    local.get $byte
    i32.const 125
    i32.eq
    if
      local.get $state
      global.get $FLAG_AFTER_KEY
      call $has_flag
      if
        local.get $state
        global.get $PARSER_STATUS_MALFORMED
        call $set_status
        return
      end
      local.get $state
      global.get $PARSER_STACK_OBJECT
      call $pop_stack
      return
    end

    local.get $byte
    i32.const 93
    i32.eq
    if
      local.get $state
      global.get $PARSER_STACK_ARRAY
      call $pop_stack
      return
    end

    local.get $byte
    i32.const 58
    i32.eq
    if
      local.get $state
      global.get $FLAG_AFTER_KEY
      call $has_flag
      i32.eqz
      if
        local.get $state
        global.get $PARSER_STATUS_MALFORMED
        call $set_status
        return
      end
      local.get $state
      global.get $FLAG_AFTER_KEY
      call $clear_flag
      i32.const 0
      return
    end

    local.get $byte
    i32.const 44
    i32.eq
    if
      local.get $state
      call $top_stack
      global.get $PARSER_STACK_OBJECT
      i32.eq
      if
        local.get $state
        global.get $FLAG_EXPECT_KEY
        call $set_flag
        i32.const 0
        return
      end

      local.get $state
      call $top_stack
      global.get $PARSER_STACK_ARRAY
      i32.eq
      if
        i32.const 0
        return
      end

      local.get $state
      global.get $PARSER_STATUS_MALFORMED
      call $set_status
      return
    end

    local.get $byte
    call $is_number_byte
    if
      local.get $state
      call $mark_value_seen
      local.get $state
      global.get $PARSER_TOKEN_NUMBER
      call $start_token
      i32.const 0
      return
    end

    local.get $byte
    call $is_alpha
    if
      local.get $state
      call $mark_value_seen
      local.get $state
      global.get $PARSER_TOKEN_LITERAL
      call $start_token
      i32.const 0
      return
    end

    local.get $state
    global.get $PARSER_STATUS_MALFORMED
    call $set_status
  )

  (func $process_byte (param $state i32) (param $byte i32) (result i32)
    (local $token i32)

    local.get $state
    global.get $PARSER_STATE_TOKEN_KIND_OFFSET
    call $load_i32
    local.tee $token
    global.get $PARSER_TOKEN_STRING
    i32.eq
    if
      local.get $state
      local.get $byte
      call $process_string_byte
      return
    end

    local.get $token
    global.get $PARSER_TOKEN_NUMBER
    i32.eq
    if
      local.get $byte
      call $is_number_byte
      if
        i32.const 0
        return
      end

      local.get $byte
      call $is_delim
      if
        local.get $state
        global.get $PARSER_STATE_TOKEN_KIND_OFFSET
        global.get $PARSER_TOKEN_NONE
        call $store_i32
        local.get $state
        local.get $byte
        call $process_structural_byte
        return
      end

      local.get $state
      global.get $PARSER_STATUS_MALFORMED
      call $set_status
      return
    end

    local.get $token
    global.get $PARSER_TOKEN_LITERAL
    i32.eq
    if
      local.get $byte
      call $is_alpha
      if
        i32.const 0
        return
      end

      local.get $byte
      call $is_delim
      if
        local.get $state
        global.get $PARSER_STATE_TOKEN_KIND_OFFSET
        global.get $PARSER_TOKEN_NONE
        call $store_i32
        local.get $state
        local.get $byte
        call $process_structural_byte
        return
      end

      local.get $state
      global.get $PARSER_STATUS_MALFORMED
      call $set_status
      return
    end

    local.get $state
    local.get $byte
    call $process_structural_byte
  )

  (func $ensure_ring_memory (param $chunk_len i32)
    (local $needed i32)
    (local $current i32)
    (local $pages i32)

    global.get $MEM_RING_BASE
    local.get $chunk_len
    i32.add
    local.set $needed

    memory.size
    i32.const 65536
    i32.mul
    local.tee $current
    local.get $needed
    i32.lt_u
    if
      local.get $needed
      local.get $current
      i32.sub
      i32.const 65535
      i32.add
      i32.const 16
      i32.shr_u
      local.set $pages

      local.get $pages
      memory.grow
      drop
    end
  )

  (func $normal_chunk_len (param $requested i32) (result i32)
    local.get $requested
    i32.eqz
    if
      global.get $DEFAULT_CHUNK_BYTES
      return
    end

    local.get $requested
    global.get $MEM_RING_SIZE
    i32.gt_u
    if
      global.get $DEFAULT_CHUNK_BYTES
      return
    end

    local.get $requested
  )

  (func $finish_eof (param $state i32) (result i32)
    (local $token i32)

    local.get $state
    global.get $PARSER_STATE_TOKEN_KIND_OFFSET
    call $load_i32
    local.tee $token
    global.get $PARSER_TOKEN_STRING
    i32.eq
    if
      local.get $state
      global.get $PARSER_STATUS_MALFORMED
      call $set_status
      return
    end

    local.get $state
    global.get $PARSER_STATE_TOKEN_KIND_OFFSET
    global.get $PARSER_TOKEN_NONE
    call $store_i32

    local.get $state
    global.get $PARSER_STATE_DEPTH_OFFSET
    call $load_i32
    i32.eqz
    if
      local.get $state
      global.get $PARSER_STATUS_DONE
      call $set_status
      return
    end

    local.get $state
    global.get $PARSER_STATUS_MALFORMED
    call $set_status
  )

  (func $parser_parse_core (param $state i32) (param $requested_chunk_len i32) (param $byte_budget i32) (result i32)
    (local $chunk_len i32)
    (local $read_len i32)
    (local $i i32)
    (local $next_i i32)
    (local $status i32)
    (local $byte i32)
    (local $processed i32)

    local.get $state
    call $parser_state_is_valid
    i32.eqz
    if
      local.get $state
      global.get $PARSER_STATUS_STATE_INVALID
      call $set_status
      return
    end

    local.get $requested_chunk_len
    call $normal_chunk_len
    local.tee $chunk_len
    call $ensure_ring_memory

    block $done
      loop $read_loop
        local.get $state
        global.get $PARSER_STATE_SOURCE_ID_OFFSET
        call $load_i32
        local.get $state
        global.get $PARSER_STATE_FILE_OFFSET_OFFSET
        call $field
        i64.load
        local.get $chunk_len
        global.get $MEM_RING_BASE
        call $opfs_source_read
        local.tee $read_len
        i32.const 0
        i32.lt_s
        if
          local.get $state
          global.get $PARSER_STATUS_MALFORMED
          call $set_status
          return
        end

        local.get $read_len
        i32.eqz
        if
          local.get $state
          call $finish_eof
          return
        end

        local.get $state
        global.get $PARSER_STATE_RING_READ_OFFSET
        i32.const 0
        call $store_i32
        local.get $state
        global.get $PARSER_STATE_RING_WRITE_OFFSET
        local.get $read_len
        call $store_i32
        local.get $state
        global.get $PARSER_STATE_RING_COUNT_OFFSET
        local.get $read_len
        call $store_i32

        i32.const 0
        local.set $i

        block $chunk_done
          loop $chunk_loop
            local.get $i
            local.get $read_len
            i32.ge_u
            br_if $chunk_done

            global.get $MEM_RING_BASE
            local.get $i
            i32.add
            i32.load8_u
            local.set $byte
            local.get $state
            local.get $byte
            call $process_byte
            local.tee $status
            i32.const 0
            i32.ne
            if
              local.get $status
              return
            end

            local.get $state
            global.get $PARSER_STATE_FILE_OFFSET_OFFSET
            call $field
            local.get $state
            global.get $PARSER_STATE_FILE_OFFSET_OFFSET
            call $field
            i64.load
            i64.const 1
            i64.add
            i64.store

            local.get $i
            i32.const 1
            i32.add
            local.tee $next_i
            local.set $i

            local.get $state
            global.get $PARSER_STATE_RING_READ_OFFSET
            local.get $next_i
            call $store_i32

            local.get $state
            global.get $PARSER_STATE_RING_COUNT_OFFSET
            local.get $read_len
            local.get $next_i
            i32.sub
            call $store_i32

            local.get $processed
            i32.const 1
            i32.add
            local.set $processed

            local.get $byte_budget
            i32.const 0
            i32.ne
            local.get $processed
            local.get $byte_budget
            i32.ge_u
            i32.and
            if
              local.get $state
              global.get $PARSER_STATUS_YIELDED
              call $set_status
              return
            end

            br $chunk_loop
          end
        end

        br $read_loop
      end
    end

    unreachable
  )

  (func (export "parser_parse") (param $state i32) (param $requested_chunk_len i32) (result i32)
    local.get $state
    local.get $requested_chunk_len
    i32.const 0
    call $parser_parse_core
  )

  (func (export "parser_parse_with_budget") (param $state i32) (param $requested_chunk_len i32) (param $byte_budget i32) (result i32)
    local.get $state
    local.get $requested_chunk_len
    local.get $byte_budget
    call $parser_parse_core
  )
)
