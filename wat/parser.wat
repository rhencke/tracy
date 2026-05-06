(module
  (import "env" "memory" (memory $memory 1 32768))
  ;; @generated host-imports parser:start
  (import "host" "opfs_source_read" (func $opfs_source_read (param i32 i64 i32 i32) (result i32)))
  ;; @generated host-imports parser:end
  (import "mem" "MEM_RING_BASE" (global $MEM_RING_BASE i32))
  (import "mem" "MEM_RING_SIZE" (global $MEM_RING_SIZE i32))
  ;; @generated parser-state-imports parser:start
  (import "parser_state" "PARSER_STATE_BYTES" (global $PARSER_STATE_BYTES i32))
  (import "parser_state" "PARSER_STACK_CAP" (global $PARSER_STACK_CAP i32))
  (import "parser_state" "PARSER_PARTIAL_TOKEN_CAP" (global $PARSER_PARTIAL_TOKEN_CAP i32))
  (import "parser_state" "PARSER_TOKEN_RECORD_BYTES" (global $PARSER_TOKEN_RECORD_BYTES i32))
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
  (import "parser_state" "PARSER_STATE_DFA_STATE_OFFSET" (global $PARSER_STATE_DFA_STATE_OFFSET i32))
  (import "parser_state" "PARSER_STATE_EVENT_FIELD_OFFSET" (global $PARSER_STATE_EVENT_FIELD_OFFSET i32))
  (import "parser_state" "PARSER_STATE_EVENT_FIELD_MASK_OFFSET" (global $PARSER_STATE_EVENT_FIELD_MASK_OFFSET i32))
  (import "parser_state" "PARSER_STATE_CURRENT_KEY_HASH_OFFSET" (global $PARSER_STATE_CURRENT_KEY_HASH_OFFSET i32))
  (import "parser_state" "PARSER_STATE_EVENT_COUNT_OFFSET" (global $PARSER_STATE_EVENT_COUNT_OFFSET i32))
  (import "parser_state" "PARSER_STATE_STACK_OFFSET" (global $PARSER_STATE_STACK_OFFSET i32))
  (import "parser_state" "PARSER_STATE_PARTIAL_TOKEN_OFFSET" (global $PARSER_STATE_PARTIAL_TOKEN_OFFSET i32))
  (import "parser_state" "PARSER_STATE_OUTPUT_RECORD_CAP_OFFSET" (global $PARSER_STATE_OUTPUT_RECORD_CAP_OFFSET i32))
  (import "parser_state" "PARSER_STATE_OUTPUT_WRITE_RECORD_OFFSET" (global $PARSER_STATE_OUTPUT_WRITE_RECORD_OFFSET i32))
  (import "parser_state" "PARSER_STATE_OUTPUT_WRITE_OFFSET" (global $PARSER_STATE_OUTPUT_WRITE_OFFSET i32))
  (import "parser_state" "PARSER_STATE_OUTPUT_COUNT_OFFSET" (global $PARSER_STATE_OUTPUT_COUNT_OFFSET i32))
  (import "parser_state" "PARSER_STATE_LINE_OFFSET" (global $PARSER_STATE_LINE_OFFSET i32))
  (import "parser_state" "PARSER_STATE_COLUMN_OFFSET" (global $PARSER_STATE_COLUMN_OFFSET i32))
  (import "parser_state" "PARSER_STATE_ERROR_LINE_OFFSET" (global $PARSER_STATE_ERROR_LINE_OFFSET i32))
  (import "parser_state" "PARSER_STATE_ERROR_COLUMN_OFFSET" (global $PARSER_STATE_ERROR_COLUMN_OFFSET i32))
  (import "parser_state" "PARSER_STATE_TOKEN_START_RING_OFFSET_OFFSET" (global $PARSER_STATE_TOKEN_START_RING_OFFSET_OFFSET i32))
  (import "parser_state" "PARSER_STATE_TOKEN_START_FILE_OFFSET_OFFSET" (global $PARSER_STATE_TOKEN_START_FILE_OFFSET_OFFSET i32))
  (import "parser_state" "PARSER_STATUS_DONE" (global $PARSER_STATUS_DONE i32))
  (import "parser_state" "PARSER_STATUS_YIELDED" (global $PARSER_STATUS_YIELDED i32))
  (import "parser_state" "PARSER_STATUS_MALFORMED" (global $PARSER_STATUS_MALFORMED i32))
  (import "parser_state" "PARSER_STATUS_STATE_INVALID" (global $PARSER_STATUS_STATE_INVALID i32))
  (import "parser_state" "PARSER_TOKEN_NONE" (global $PARSER_TOKEN_NONE i32))
  (import "parser_state" "PARSER_TOKEN_STRING" (global $PARSER_TOKEN_STRING i32))
  (import "parser_state" "PARSER_TOKEN_NUMBER" (global $PARSER_TOKEN_NUMBER i32))
  (import "parser_state" "PARSER_TOKEN_LITERAL" (global $PARSER_TOKEN_LITERAL i32))
  (import "parser_state" "PARSER_DFA_DEFAULT" (global $PARSER_DFA_DEFAULT i32))
  (import "parser_state" "PARSER_DFA_STRING" (global $PARSER_DFA_STRING i32))
  (import "parser_state" "PARSER_DFA_STRING_ESCAPE" (global $PARSER_DFA_STRING_ESCAPE i32))
  (import "parser_state" "PARSER_DFA_NUMBER" (global $PARSER_DFA_NUMBER i32))
  (import "parser_state" "PARSER_DFA_KEYWORD" (global $PARSER_DFA_KEYWORD i32))
  (import "parser_state" "PARSER_JSON_TOKEN_LBRACE" (global $PARSER_JSON_TOKEN_LBRACE i32))
  (import "parser_state" "PARSER_JSON_TOKEN_RBRACE" (global $PARSER_JSON_TOKEN_RBRACE i32))
  (import "parser_state" "PARSER_JSON_TOKEN_LBRACK" (global $PARSER_JSON_TOKEN_LBRACK i32))
  (import "parser_state" "PARSER_JSON_TOKEN_RBRACK" (global $PARSER_JSON_TOKEN_RBRACK i32))
  (import "parser_state" "PARSER_JSON_TOKEN_COLON" (global $PARSER_JSON_TOKEN_COLON i32))
  (import "parser_state" "PARSER_JSON_TOKEN_COMMA" (global $PARSER_JSON_TOKEN_COMMA i32))
  (import "parser_state" "PARSER_JSON_TOKEN_STRING" (global $PARSER_JSON_TOKEN_STRING i32))
  (import "parser_state" "PARSER_JSON_TOKEN_NUMBER" (global $PARSER_JSON_TOKEN_NUMBER i32))
  (import "parser_state" "PARSER_JSON_TOKEN_TRUE" (global $PARSER_JSON_TOKEN_TRUE i32))
  (import "parser_state" "PARSER_JSON_TOKEN_FALSE" (global $PARSER_JSON_TOKEN_FALSE i32))
  (import "parser_state" "PARSER_JSON_TOKEN_NULL" (global $PARSER_JSON_TOKEN_NULL i32))
  (import "parser_state" "PARSER_JSON_TOKEN_EOF" (global $PARSER_JSON_TOKEN_EOF i32))
  (import "parser_state" "PARSER_JSON_TOKEN_NEED_MORE" (global $PARSER_JSON_TOKEN_NEED_MORE i32))
  (import "parser_state" "PARSER_JSON_TOKEN_YIELD" (global $PARSER_JSON_TOKEN_YIELD i32))
  (import "parser_state" "PARSER_JSON_TOKEN_ERROR" (global $PARSER_JSON_TOKEN_ERROR i32))
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
  (global $DEFAULT_PARSE_OUTPUT_RECORDS i32 (i32.const 4096))
  (global $active_state (mut i32) (i32.const 0))

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

  (func $copy_bytes (param $src i32) (param $dst i32) (param $len i32)
    (local $i i32)

    block $done
      loop $loop
        local.get $i
        local.get $len
        i32.ge_u
        br_if $done

        local.get $dst
        local.get $i
        i32.add
        local.get $src
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

  (func (export "parser_save_state") (param $out_ptr i32)
    global.get $active_state
    local.get $out_ptr
    global.get $PARSER_STATE_BYTES
    call $copy_bytes
  )

  (func (export "parser_restore_state") (param $in_ptr i32)
    local.get $in_ptr
    call $parser_state_is_valid
    i32.eqz
    if
      global.get $active_state
      global.get $PARSER_STATUS_STATE_INVALID
      call $set_status
      drop
      return
    end

    local.get $in_ptr
    global.get $active_state
    global.get $PARSER_STATE_BYTES
    call $copy_bytes
  )

  (func $require_valid_state (param $state i32) (result i32)
    local.get $state
    call $parser_state_is_valid
    if (result i32)
      i32.const 1
    else
      local.get $state
      global.get $PARSER_STATUS_STATE_INVALID
      call $set_status
      drop
      i32.const 0
    end
  )

  (func $token_record_ptr (param $out_ptr i32) (param $record_index i32) (result i32)
    local.get $out_ptr
    local.get $record_index
    global.get $PARSER_TOKEN_RECORD_BYTES
    i32.mul
    i32.add
  )

  (func $reset_token_output (param $state i32) (param $record_cap i32)
    local.get $state
    global.get $PARSER_STATE_OUTPUT_RECORD_CAP_OFFSET
    local.get $record_cap
    call $store_i32

    local.get $state
    global.get $PARSER_STATE_OUTPUT_WRITE_RECORD_OFFSET
    i32.const 0
    call $store_i32

    local.get $state
    global.get $PARSER_STATE_OUTPUT_WRITE_OFFSET
    i32.const 0
    call $store_i32

    local.get $state
    global.get $PARSER_STATE_OUTPUT_COUNT_OFFSET
    i32.const 0
    call $store_i32
  )

  (func $emit_token_record (param $state i32) (param $out_ptr i32) (param $kind i32) (param $payload_ptr i32) (param $payload_len i32) (result i32)
    (local $record_index i32)
    (local $record_ptr i32)
    (local $next_record i32)

    local.get $state
    call $require_valid_state
    i32.eqz
    if
      i32.const 0
      return
    end

    local.get $state
    global.get $PARSER_STATE_OUTPUT_WRITE_RECORD_OFFSET
    call $load_i32
    local.tee $record_index
    local.get $state
    global.get $PARSER_STATE_OUTPUT_RECORD_CAP_OFFSET
    call $load_i32
    i32.ge_u
    if
      i32.const 0
      return
    end

    local.get $out_ptr
    local.get $record_index
    call $token_record_ptr
    local.tee $record_ptr
    local.get $kind
    i32.store

    local.get $record_ptr
    i32.const 4
    i32.add
    local.get $payload_ptr
    i32.store

    local.get $record_ptr
    i32.const 8
    i32.add
    local.get $payload_len
    i32.store

    local.get $record_index
    i32.const 1
    i32.add
    local.set $next_record

    local.get $state
    global.get $PARSER_STATE_OUTPUT_WRITE_RECORD_OFFSET
    local.get $next_record
    call $store_i32

    local.get $state
    global.get $PARSER_STATE_OUTPUT_WRITE_OFFSET
    local.get $next_record
    global.get $PARSER_TOKEN_RECORD_BYTES
    i32.mul
    call $store_i32

    local.get $state
    global.get $PARSER_STATE_OUTPUT_COUNT_OFFSET
    local.get $state
    global.get $PARSER_STATE_OUTPUT_COUNT_OFFSET
    call $load_i32
    i32.const 1
    i32.add
    call $store_i32

    i32.const 1
  )

  (func (export "parser_token_output_reset") (param $state i32) (param $record_cap i32) (result i32)
    local.get $state
    call $require_valid_state
    i32.eqz
    if
      i32.const 0
      return
    end

    local.get $state
    global.set $active_state

    local.get $state
    local.get $record_cap
    call $reset_token_output
    i32.const 1
  )

  (func (export "parser_emit_token") (param $state i32) (param $out_ptr i32) (param $kind i32) (param $payload_ptr i32) (param $payload_len i32) (result i32)
    local.get $state
    local.get $out_ptr
    local.get $kind
    local.get $payload_ptr
    local.get $payload_len
    call $emit_token_record
  )

  (func (export "parser_emit_structural_token") (param $state i32) (param $out_ptr i32) (param $kind i32) (result i32)
    local.get $state
    local.get $out_ptr
    local.get $kind
    i32.const 0
    i32.const 0
    call $emit_token_record
  )

  (func (export "parser_emit_eof_token") (param $state i32) (param $out_ptr i32) (result i32)
    local.get $state
    local.get $out_ptr
    global.get $PARSER_JSON_TOKEN_EOF
    i32.const 0
    i32.const 0
    call $emit_token_record
  )

  (func (export "parser_emit_need_more_token") (param $state i32) (param $out_ptr i32) (result i32)
    local.get $state
    local.get $out_ptr
    global.get $PARSER_JSON_TOKEN_NEED_MORE
    i32.const 0
    i32.const 0
    call $emit_token_record
  )

  (func (export "parser_emit_yield_token") (param $state i32) (param $out_ptr i32) (result i32)
    local.get $state
    local.get $out_ptr
    global.get $PARSER_JSON_TOKEN_YIELD
    i32.const 0
    i32.const 0
    call $emit_token_record
  )

  (func $parser_emit_error_token (export "parser_emit_error_token") (param $state i32) (param $out_ptr i32) (param $line i32) (param $column i32) (result i32)
    local.get $state
    global.get $PARSER_STATE_ERROR_LINE_OFFSET
    local.get $line
    call $store_i32

    local.get $state
    global.get $PARSER_STATE_ERROR_COLUMN_OFFSET
    local.get $column
    call $store_i32

    local.get $state
    local.get $out_ptr
    global.get $PARSER_JSON_TOKEN_ERROR
    local.get $line
    local.get $column
    call $emit_token_record
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

  (func $start_token (param $state i32) (param $token i32)
    local.get $state
    call $clear_token_buffer
    local.get $state
    global.get $PARSER_STATE_TOKEN_KIND_OFFSET
    local.get $token
    call $store_i32
  )

  (func $set_dfa_state (param $state i32) (param $dfa i32)
    local.get $state
    global.get $PARSER_STATE_DFA_STATE_OFFSET
    local.get $dfa
    call $store_i32
  )

  (func $advance_position (param $state i32) (param $byte i32)
    local.get $byte
    i32.const 10
    i32.eq
    if
      local.get $state
      global.get $PARSER_STATE_LINE_OFFSET
      local.get $state
      global.get $PARSER_STATE_LINE_OFFSET
      call $load_i32
      i32.const 1
      i32.add
      call $store_i32

      local.get $state
      global.get $PARSER_STATE_COLUMN_OFFSET
      i32.const 1
      call $store_i32
      return
    end

    local.get $state
    global.get $PARSER_STATE_COLUMN_OFFSET
    local.get $state
    global.get $PARSER_STATE_COLUMN_OFFSET
    call $load_i32
    i32.const 1
    i32.add
    call $store_i32
  )

  (func $tokenizer_error_at_current (param $state i32) (param $out_ptr i32) (result i32)
    local.get $state
    local.get $out_ptr
    local.get $state
    global.get $PARSER_STATE_LINE_OFFSET
    call $load_i32
    local.get $state
    global.get $PARSER_STATE_COLUMN_OFFSET
    call $load_i32
    call $parser_emit_error_token
    drop

    local.get $state
    global.get $PARSER_STATUS_MALFORMED
    call $set_status
  )

  (func $emit_checked_token (param $state i32) (param $out_ptr i32) (param $kind i32) (param $payload_ptr i32) (param $payload_len i32) (result i32)
    local.get $state
    local.get $out_ptr
    local.get $kind
    local.get $payload_ptr
    local.get $payload_len
    call $emit_token_record
    i32.eqz
    if
      local.get $state
      global.get $PARSER_STATUS_YIELDED
      call $set_status
      return
    end

    i32.const 0
  )

  (func $emit_checked_structural_token (param $state i32) (param $out_ptr i32) (param $kind i32) (result i32)
    local.get $state
    local.get $out_ptr
    local.get $kind
    i32.const 0
    i32.const 0
    call $emit_checked_token
  )

  (func $token_output_base (result i32)
    global.get $MEM_RING_BASE
    global.get $MEM_RING_SIZE
    i32.add
  )

  (func $is_digit (param $byte i32) (result i32)
    local.get $byte
    i32.const 48
    i32.ge_u
    local.get $byte
    i32.const 57
    i32.le_u
    i32.and
  )

  (func $is_nonzero_digit (param $byte i32) (result i32)
    local.get $byte
    i32.const 49
    i32.ge_u
    local.get $byte
    i32.const 57
    i32.le_u
    i32.and
  )

  (func $is_exp_byte (param $byte i32) (result i32)
    local.get $byte
    i32.const 69
    i32.eq
    local.get $byte
    i32.const 101
    i32.eq
    i32.or
  )

  (func $token_matches5 (param $state i32) (param $a i32) (param $b i32) (param $c i32) (param $d i32) (param $e i32) (result i32)
    local.get $state
    local.get $a
    local.get $b
    local.get $c
    local.get $d
    call $token_matches4
    local.get $state
    i32.const 4
    call $token_byte
    local.get $e
    i32.eq
    i32.and
  )

  (func $begin_tokenizer_token (param $state i32) (param $dfa i32) (param $token i32) (param $start_ptr i32)
    local.get $state
    local.get $token
    call $start_token

    local.get $state
    local.get $dfa
    call $set_dfa_state

    local.get $state
    global.get $PARSER_STATE_TOKEN_START_RING_OFFSET_OFFSET
    local.get $start_ptr
    call $store_i32
  )

  (func $finish_string_token (param $state i32) (param $out_ptr i32) (param $end_ptr i32) (result i32)
    (local $start_ptr i32)
    (local $status i32)

    local.get $state
    global.get $PARSER_STATE_TOKEN_START_RING_OFFSET_OFFSET
    call $load_i32
    local.set $start_ptr

    local.get $state
    call $close_string
    drop

    local.get $state
    global.get $PARSER_DFA_DEFAULT
    call $set_dfa_state

    local.get $state
    local.get $out_ptr
    global.get $PARSER_JSON_TOKEN_STRING
    local.get $start_ptr
    local.get $end_ptr
    local.get $start_ptr
    i32.sub
    call $emit_checked_token
    local.tee $status
    i32.const 0
    i32.ne
    if
      local.get $status
      return
    end

    local.get $state
    call $clear_token_buffer

    i32.const 0
  )

  (func $is_valid_number_token (param $state i32) (result i32)
    (local $i i32)
    (local $len i32)
    (local $phase i32)
    (local $byte i32)

    local.get $state
    global.get $PARSER_STATE_PARTIAL_TOKEN_LEN_OFFSET
    call $load_i32
    local.tee $len
    i32.eqz
    if
      i32.const 0
      return
    end

    i32.const 0
    local.set $phase

    block $done
      loop $loop
        local.get $i
        local.get $len
        i32.ge_u
        br_if $done

        local.get $state
        local.get $i
        call $token_byte
        local.set $byte

        local.get $phase
        i32.const 0
        i32.eq
        if
          local.get $byte
          i32.const 45
          i32.eq
          if
            i32.const 1
            local.set $phase
          else
            local.get $byte
            i32.const 48
            i32.eq
            if
              i32.const 2
              local.set $phase
            else
              local.get $byte
              call $is_nonzero_digit
              if
                i32.const 3
                local.set $phase
              else
                i32.const 0
                return
              end
            end
          end
        else
          local.get $phase
          i32.const 1
          i32.eq
          if
            local.get $byte
            i32.const 48
            i32.eq
            if
              i32.const 2
              local.set $phase
            else
              local.get $byte
              call $is_nonzero_digit
              if
                i32.const 3
                local.set $phase
              else
                i32.const 0
                return
              end
            end
          else
            local.get $phase
            i32.const 2
            i32.eq
            if
              local.get $byte
              i32.const 46
              i32.eq
              if
                i32.const 4
                local.set $phase
              else
                local.get $byte
                call $is_exp_byte
                if
                  i32.const 6
                  local.set $phase
                else
                  i32.const 0
                  return
                end
              end
            else
              local.get $phase
              i32.const 3
              i32.eq
              if
                local.get $byte
                call $is_digit
                if
                  i32.const 3
                  local.set $phase
                else
                  local.get $byte
                  i32.const 46
                  i32.eq
                  if
                    i32.const 4
                    local.set $phase
                  else
                    local.get $byte
                    call $is_exp_byte
                    if
                      i32.const 6
                      local.set $phase
                    else
                      i32.const 0
                      return
                    end
                  end
                end
              else
                local.get $phase
                i32.const 4
                i32.eq
                if
                  local.get $byte
                  call $is_digit
                  if
                    i32.const 5
                    local.set $phase
                  else
                    i32.const 0
                    return
                  end
                else
                  local.get $phase
                  i32.const 5
                  i32.eq
                  if
                    local.get $byte
                    call $is_digit
                    if
                      i32.const 5
                      local.set $phase
                    else
                      local.get $byte
                      call $is_exp_byte
                      if
                        i32.const 6
                        local.set $phase
                      else
                        i32.const 0
                        return
                      end
                    end
                  else
                    local.get $phase
                    i32.const 6
                    i32.eq
                    if
                      local.get $byte
                      i32.const 43
                      i32.eq
                      local.get $byte
                      i32.const 45
                      i32.eq
                      i32.or
                      if
                        i32.const 7
                        local.set $phase
                      else
                        local.get $byte
                        call $is_digit
                        if
                          i32.const 8
                          local.set $phase
                        else
                          i32.const 0
                          return
                        end
                      end
                    else
                      local.get $phase
                      i32.const 7
                      i32.eq
                      if
                        local.get $byte
                        call $is_digit
                        if
                          i32.const 8
                          local.set $phase
                        else
                          i32.const 0
                          return
                        end
                      else
                        local.get $byte
                        call $is_digit
                        i32.eqz
                        if
                          i32.const 0
                          return
                        end
                      end
                    end
                  end
                end
              end
            end
          end
        end

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      end
    end

    local.get $phase
    i32.const 2
    i32.eq
    local.get $phase
    i32.const 3
    i32.eq
    i32.or
    local.get $phase
    i32.const 5
    i32.eq
    i32.or
    local.get $phase
    i32.const 8
    i32.eq
    i32.or
  )

  (func $finish_number_token (param $state i32) (param $out_ptr i32) (param $end_ptr i32) (result i32)
    (local $start_ptr i32)

    local.get $state
    call $is_valid_number_token
    i32.eqz
    if
      local.get $state
      local.get $out_ptr
      call $tokenizer_error_at_current
      return
    end

    local.get $state
    global.get $PARSER_STATE_TOKEN_START_RING_OFFSET_OFFSET
    call $load_i32
    local.set $start_ptr

    local.get $state
    global.get $PARSER_TOKEN_NONE
    call $start_token
    local.get $state
    global.get $PARSER_DFA_DEFAULT
    call $set_dfa_state

    local.get $state
    local.get $out_ptr
    global.get $PARSER_JSON_TOKEN_NUMBER
    local.get $start_ptr
    local.get $end_ptr
    local.get $start_ptr
    i32.sub
    call $emit_checked_token
  )

  (func $keyword_token_kind (param $state i32) (result i32)
    (local $len i32)

    local.get $state
    global.get $PARSER_STATE_PARTIAL_TOKEN_LEN_OFFSET
    call $load_i32
    local.set $len

    local.get $len
    i32.const 4
    i32.eq
    if
      local.get $state
      i32.const 116
      i32.const 114
      i32.const 117
      i32.const 101
      call $token_matches4
      if
        global.get $PARSER_JSON_TOKEN_TRUE
        return
      end

      local.get $state
      i32.const 110
      i32.const 117
      i32.const 108
      i32.const 108
      call $token_matches4
      if
        global.get $PARSER_JSON_TOKEN_NULL
        return
      end
    end

    local.get $len
    i32.const 5
    i32.eq
    if
      local.get $state
      i32.const 102
      i32.const 97
      i32.const 108
      i32.const 115
      i32.const 101
      call $token_matches5
      if
        global.get $PARSER_JSON_TOKEN_FALSE
        return
      end
    end

    i32.const 0
  )

  (func $finish_keyword_token (param $state i32) (param $out_ptr i32) (param $end_ptr i32) (result i32)
    (local $start_ptr i32)
    (local $kind i32)

    local.get $state
    call $keyword_token_kind
    local.tee $kind
    i32.eqz
    if
      local.get $state
      local.get $out_ptr
      call $tokenizer_error_at_current
      return
    end

    local.get $state
    global.get $PARSER_STATE_TOKEN_START_RING_OFFSET_OFFSET
    call $load_i32
    local.set $start_ptr

    local.get $state
    global.get $PARSER_TOKEN_NONE
    call $start_token
    local.get $state
    global.get $PARSER_DFA_DEFAULT
    call $set_dfa_state

    local.get $state
    local.get $out_ptr
    local.get $kind
    local.get $start_ptr
    local.get $end_ptr
    local.get $start_ptr
    i32.sub
    call $emit_checked_token
  )

  (func $process_default_token_byte (param $state i32) (param $out_ptr i32) (param $byte i32) (param $byte_ptr i32) (result i32)
    local.get $byte
    call $is_ws
    if
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
      local.tee $byte
      i32.const 0
      i32.ne
      if
        local.get $state
        local.get $out_ptr
        call $tokenizer_error_at_current
        return
      end

      local.get $state
      local.get $out_ptr
      global.get $PARSER_JSON_TOKEN_LBRACE
      call $emit_checked_structural_token
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
        local.get $out_ptr
        call $tokenizer_error_at_current
        return
      end

      local.get $state
      global.get $PARSER_STACK_OBJECT
      call $pop_stack
      local.tee $byte
      i32.const 0
      i32.ne
      if
        local.get $state
        local.get $out_ptr
        call $tokenizer_error_at_current
        return
      end

      local.get $state
      local.get $out_ptr
      global.get $PARSER_JSON_TOKEN_RBRACE
      call $emit_checked_structural_token
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
      local.tee $byte
      i32.const 0
      i32.ne
      if
        local.get $state
        local.get $out_ptr
        call $tokenizer_error_at_current
        return
      end

      local.get $state
      local.get $out_ptr
      global.get $PARSER_JSON_TOKEN_LBRACK
      call $emit_checked_structural_token
      return
    end

    local.get $byte
    i32.const 93
    i32.eq
    if
      local.get $state
      global.get $PARSER_STACK_ARRAY
      call $pop_stack
      local.tee $byte
      i32.const 0
      i32.ne
      if
        local.get $state
        local.get $out_ptr
        call $tokenizer_error_at_current
        return
      end

      local.get $state
      local.get $out_ptr
      global.get $PARSER_JSON_TOKEN_RBRACK
      call $emit_checked_structural_token
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
        local.get $out_ptr
        call $tokenizer_error_at_current
        return
      end

      local.get $state
      global.get $FLAG_AFTER_KEY
      call $clear_flag

      local.get $state
      local.get $out_ptr
      global.get $PARSER_JSON_TOKEN_COLON
      call $emit_checked_structural_token
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
      else
        local.get $state
        call $top_stack
        global.get $PARSER_STACK_ARRAY
        i32.ne
        if
          local.get $state
          local.get $out_ptr
          call $tokenizer_error_at_current
          return
        end
      end

      local.get $state
      local.get $out_ptr
      global.get $PARSER_JSON_TOKEN_COMMA
      call $emit_checked_structural_token
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
      global.get $PARSER_DFA_STRING
      global.get $PARSER_TOKEN_STRING
      local.get $byte_ptr
      i32.const 1
      i32.add
      call $begin_tokenizer_token
      i32.const 0
      return
    end

    local.get $byte
    i32.const 45
    i32.eq
    local.get $byte
    call $is_digit
    i32.or
    if
      local.get $state
      call $mark_value_seen
      local.get $state
      global.get $PARSER_DFA_NUMBER
      global.get $PARSER_TOKEN_NUMBER
      local.get $byte_ptr
      call $begin_tokenizer_token
      local.get $state
      local.get $byte
      call $append_token_byte
      i32.const 0
      return
    end

    local.get $byte
    i32.const 116
    i32.eq
    local.get $byte
    i32.const 102
    i32.eq
    i32.or
    local.get $byte
    i32.const 110
    i32.eq
    i32.or
    if
      local.get $state
      call $mark_value_seen
      local.get $state
      global.get $PARSER_DFA_KEYWORD
      global.get $PARSER_TOKEN_LITERAL
      local.get $byte_ptr
      call $begin_tokenizer_token
      local.get $state
      local.get $byte
      call $append_token_byte
      i32.const 0
      return
    end

    local.get $state
    local.get $out_ptr
    call $tokenizer_error_at_current
  )

  (func $process_string_token_byte (param $state i32) (param $out_ptr i32) (param $byte i32) (param $byte_ptr i32) (result i32)
    local.get $byte
    i32.const 92
    i32.eq
    if
      local.get $state
      global.get $PARSER_DFA_STRING_ESCAPE
      call $set_dfa_state
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
      local.get $out_ptr
      local.get $byte_ptr
      call $finish_string_token
      return
    end

    local.get $byte
    i32.const 32
    i32.lt_u
    if
      local.get $state
      local.get $out_ptr
      call $tokenizer_error_at_current
      return
    end

    local.get $state
    local.get $byte
    call $append_token_byte

    i32.const 0
  )

  (func $process_string_escape_token_byte (param $state i32) (param $out_ptr i32) (param $byte i32) (result i32)
    (local $remaining i32)

    local.get $state
    global.get $PARSER_STATE_UNICODE_ACCUM_OFFSET
    call $load_i32
    local.tee $remaining
    i32.const 0
    i32.ne
    if
      local.get $byte
      call $is_hex
      i32.eqz
      if
        local.get $state
        local.get $out_ptr
        call $tokenizer_error_at_current
        return
      end

      local.get $remaining
      i32.const 1
      i32.sub
      local.set $remaining
      local.get $state
      global.get $PARSER_STATE_UNICODE_ACCUM_OFFSET
      local.get $remaining
      call $store_i32

      local.get $remaining
      i32.eqz
      if
        local.get $state
        global.get $PARSER_DFA_STRING
        call $set_dfa_state
        local.get $state
        global.get $PARSER_STATE_STRING_ESCAPE_OFFSET
        i32.const 0
        call $store_i32
      end

      i32.const 0
      return
    end

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
    if
      local.get $state
      global.get $PARSER_DFA_STRING
      call $set_dfa_state
      local.get $state
      global.get $PARSER_STATE_STRING_ESCAPE_OFFSET
      i32.const 0
      call $store_i32
      i32.const 0
      return
    end

    local.get $state
    local.get $out_ptr
    call $tokenizer_error_at_current
  )

  (func $finish_tokenizer_eof (param $state i32) (param $out_ptr i32) (param $end_ptr i32) (result i32)
    (local $status i32)
    (local $dfa i32)

    local.get $state
    global.get $PARSER_STATE_DFA_STATE_OFFSET
    call $load_i32
    local.set $dfa

    local.get $dfa
    global.get $PARSER_DFA_NUMBER
    i32.eq
    if
      local.get $state
      local.get $out_ptr
      local.get $end_ptr
      call $finish_number_token
      local.tee $status
      i32.const 0
      i32.ne
      if
        local.get $status
        return
      end
    else
      local.get $dfa
      global.get $PARSER_DFA_KEYWORD
      i32.eq
      if
        local.get $state
        local.get $out_ptr
        local.get $end_ptr
        call $finish_keyword_token
        local.tee $status
        i32.const 0
        i32.ne
        if
          local.get $status
          return
        end
      else
        local.get $dfa
        global.get $PARSER_DFA_DEFAULT
        i32.ne
        if
          local.get $state
          local.get $out_ptr
          call $tokenizer_error_at_current
          return
        end
      end
    end

    local.get $state
    global.get $PARSER_STATE_DEPTH_OFFSET
    call $load_i32
    i32.const 0
    i32.ne
    if
      local.get $state
      local.get $out_ptr
      call $tokenizer_error_at_current
      return
    end

    local.get $state
    local.get $out_ptr
    global.get $PARSER_JSON_TOKEN_EOF
    i32.const 0
    i32.const 0
    call $emit_checked_token
    local.tee $status
    i32.const 0
    i32.ne
    if
      local.get $status
      return
    end

    local.get $state
    global.get $PARSER_STATUS_DONE
    call $set_status
  )

  (func $process_tokenizer_byte (param $state i32) (param $out_ptr i32) (param $byte i32) (param $byte_ptr i32) (result i32)
    (local $dfa i32)

    local.get $state
    global.get $PARSER_STATE_DFA_STATE_OFFSET
    call $load_i32
    local.set $dfa

    local.get $dfa
    global.get $PARSER_DFA_DEFAULT
    i32.eq
    if
      local.get $state
      local.get $out_ptr
      local.get $byte
      local.get $byte_ptr
      call $process_default_token_byte
      return
    end

    local.get $dfa
    global.get $PARSER_DFA_STRING
    i32.eq
    if
      local.get $state
      local.get $out_ptr
      local.get $byte
      local.get $byte_ptr
      call $process_string_token_byte
      return
    end

    local.get $dfa
    global.get $PARSER_DFA_STRING_ESCAPE
    i32.eq
    if
      local.get $state
      local.get $out_ptr
      local.get $byte
      call $process_string_escape_token_byte
      return
    end

    local.get $dfa
    global.get $PARSER_DFA_NUMBER
    i32.eq
    if
      local.get $byte
      call $is_number_byte
      if
        local.get $state
        local.get $byte
        call $append_token_byte
        i32.const 0
        return
      end

      local.get $byte
      call $is_delim
      if
        local.get $state
        local.get $out_ptr
        local.get $byte_ptr
        call $finish_number_token
        local.tee $dfa
        i32.eqz
        if
          local.get $state
          local.get $out_ptr
          local.get $byte
          local.get $byte_ptr
          call $process_default_token_byte
          return
        end

        local.get $dfa
        return
      end

      local.get $state
      local.get $out_ptr
      call $tokenizer_error_at_current
      return
    end

    local.get $dfa
    global.get $PARSER_DFA_KEYWORD
    i32.eq
    if
      local.get $byte
      call $is_alpha
      if
        local.get $state
        local.get $byte
        call $append_token_byte
        i32.const 0
        return
      end

      local.get $byte
      call $is_delim
      if
        local.get $state
        local.get $out_ptr
        local.get $byte_ptr
        call $finish_keyword_token
        local.tee $dfa
        i32.eqz
        if
          local.get $state
          local.get $out_ptr
          local.get $byte
          local.get $byte_ptr
          call $process_default_token_byte
          return
        end

        local.get $dfa
        return
      end

      local.get $state
      local.get $out_ptr
      call $tokenizer_error_at_current
      return
    end

    local.get $state
    local.get $out_ptr
    call $tokenizer_error_at_current
  )

  (func (export "parser_tokenize_bytes") (param $state i32) (param $input_ptr i32) (param $input_len i32) (param $out_ptr i32) (param $record_cap i32) (result i32)
    (local $i i32)
    (local $byte_ptr i32)
    (local $byte i32)
    (local $status i32)

    local.get $state
    call $require_valid_state
    i32.eqz
    if
      global.get $PARSER_STATUS_STATE_INVALID
      return
    end

    local.get $state
    global.set $active_state

    local.get $state
    local.get $record_cap
    call $reset_token_output

    block $done
      loop $loop
        local.get $i
        local.get $input_len
        i32.ge_u
        br_if $done

        local.get $input_ptr
        local.get $i
        i32.add
        local.tee $byte_ptr
        i32.load8_u
        local.set $byte

        local.get $state
        local.get $out_ptr
        local.get $byte
        local.get $byte_ptr
        call $process_tokenizer_byte
        local.tee $status
        i32.const 0
        i32.ne
        if
          local.get $status
          return
        end

        local.get $state
        local.get $byte
        call $advance_position

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      end
    end

    local.get $state
    local.get $out_ptr
    local.get $input_ptr
    local.get $input_len
    i32.add
    call $finish_tokenizer_eof
  )

  (func $ensure_absolute_memory (param $needed i32)
    (local $current i32)
    (local $pages i32)

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

  (func $ensure_ring_memory (param $record_cap i32)
    (local $needed i32)

    global.get $MEM_RING_BASE
    global.get $MEM_RING_SIZE
    i32.add
    call $ensure_absolute_memory

    call $token_output_base
    local.get $record_cap
    global.get $PARSER_TOKEN_RECORD_BYTES
    i32.mul
    i32.add
    local.set $needed

    local.get $needed
    call $ensure_absolute_memory
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

  (func $parser_parse_core (param $state i32) (param $requested_chunk_len i32) (param $byte_budget i32) (result i32)
    (local $chunk_len i32)
    (local $read_len i32)
    (local $read_pos i32)
    (local $write_pos i32)
    (local $ring_count i32)
    (local $fill_len i32)
    (local $contiguous_free i32)
    (local $next_pos i32)
    (local $status i32)
    (local $byte i32)
    (local $byte_ptr i32)
    (local $processed i32)
    (local $out_ptr i32)

    local.get $state
    call $parser_state_is_valid
    i32.eqz
    if
      local.get $state
      global.get $PARSER_STATUS_STATE_INVALID
      call $set_status
      return
    end

    local.get $state
    global.set $active_state

    local.get $requested_chunk_len
    call $normal_chunk_len
    local.tee $chunk_len
    drop

    global.get $DEFAULT_PARSE_OUTPUT_RECORDS
    call $ensure_ring_memory

    call $token_output_base
    local.set $out_ptr

    local.get $state
    global.get $PARSER_STATE_STATUS_OFFSET
    call $load_i32
    global.get $PARSER_STATUS_YIELDED
    i32.ne
    if
      local.get $state
      global.get $DEFAULT_PARSE_OUTPUT_RECORDS
      call $reset_token_output
    end

    block $done
      loop $parse_loop
        local.get $state
        global.get $PARSER_STATE_RING_COUNT_OFFSET
        call $load_i32
        i32.eqz
        if
          local.get $state
          global.get $PARSER_STATE_RING_READ_OFFSET
          call $load_i32
          local.set $read_pos

          local.get $state
          global.get $PARSER_STATE_RING_WRITE_OFFSET
          call $load_i32
          local.set $write_pos

          global.get $MEM_RING_SIZE
          local.get $write_pos
          i32.sub
          local.set $contiguous_free

          local.get $chunk_len
          global.get $MEM_RING_SIZE
          i32.lt_u
          if
            local.get $chunk_len
            local.set $fill_len
          else
            global.get $MEM_RING_SIZE
            local.set $fill_len
          end

          local.get $contiguous_free
          local.get $fill_len
          i32.lt_u
          if
            local.get $contiguous_free
            local.set $fill_len
          end

          local.get $state
          global.get $PARSER_STATE_SOURCE_ID_OFFSET
          call $load_i32
          local.get $state
          global.get $PARSER_STATE_FILE_OFFSET_OFFSET
          call $field
          i64.load
          local.get $fill_len
          global.get $MEM_RING_BASE
          local.get $write_pos
          i32.add
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
            local.get $out_ptr
            global.get $MEM_RING_BASE
            local.get $write_pos
            i32.add
            call $finish_tokenizer_eof
            return
          end

          local.get $write_pos
          local.get $read_len
          i32.add
          global.get $MEM_RING_SIZE
          i32.rem_u
          local.set $next_pos

          local.get $state
          global.get $PARSER_STATE_RING_WRITE_OFFSET
          local.get $next_pos
          call $store_i32

          local.get $state
          global.get $PARSER_STATE_RING_COUNT_OFFSET
          local.get $read_len
          call $store_i32
        end

        local.get $state
        global.get $PARSER_STATE_RING_READ_OFFSET
        call $load_i32
        local.set $read_pos

        global.get $MEM_RING_BASE
        local.get $read_pos
        i32.add
        local.tee $byte_ptr
        i32.load8_u
        local.set $byte

        local.get $state
        local.get $out_ptr
        local.get $byte
        local.get $byte_ptr
        call $process_tokenizer_byte
        local.tee $status
        i32.const 0
        i32.ne
        if
          local.get $status
          return
        end

        local.get $state
        local.get $byte
        call $advance_position

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

        local.get $read_pos
        i32.const 1
        i32.add
        global.get $MEM_RING_SIZE
        i32.rem_u
        local.set $next_pos

        local.get $state
        global.get $PARSER_STATE_RING_READ_OFFSET
        local.get $next_pos
        call $store_i32

        local.get $state
        global.get $PARSER_STATE_RING_COUNT_OFFSET
        local.get $state
        global.get $PARSER_STATE_RING_COUNT_OFFSET
        call $load_i32
        i32.const 1
        i32.sub
        local.tee $ring_count
        call $store_i32

        local.get $ring_count
        i32.eqz
        if
          local.get $state
          local.get $out_ptr
          global.get $PARSER_JSON_TOKEN_NEED_MORE
          i32.const 0
          i32.const 0
          call $emit_checked_token
          local.tee $status
          i32.const 0
          i32.ne
          if
            local.get $status
            return
          end
        end

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
          local.get $out_ptr
          global.get $PARSER_JSON_TOKEN_YIELD
          i32.const 0
          i32.const 0
          call $emit_checked_token
          drop

          local.get $state
          global.get $PARSER_STATUS_YIELDED
          call $set_status
          return
        end

        br $parse_loop
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
    (local $effective_budget i32)

    local.get $byte_budget
    local.set $effective_budget

    local.get $effective_budget
    i32.eqz
    if
      local.get $state
      global.get $PARSER_STATE_YIELD_BUDGET_MS_OFFSET
      call $load_i32
      local.set $effective_budget
    end

    local.get $state
    local.get $requested_chunk_len
    local.get $effective_budget
    call $parser_parse_core
  )
)
