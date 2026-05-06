(module
  (import "env" "memory" (memory $memory 1 32768))

  ;; @generated parser-state-globals:start
  (global $PARSER_STATE_MAGIC (export "PARSER_STATE_MAGIC") i32 (i32.const 0x5452504A))
  (global $PARSER_STATE_VERSION (export "PARSER_STATE_VERSION") i32 (i32.const 2))
  (global $PARSER_STATE_BYTES (export "PARSER_STATE_BYTES") i32 (i32.const 512))
  (global $PARSER_STACK_CAP (export "PARSER_STACK_CAP") i32 (i32.const 64))
  (global $PARSER_PARTIAL_TOKEN_CAP (export "PARSER_PARTIAL_TOKEN_CAP") i32 (i32.const 256))
  (global $PARSER_DEFAULT_YIELD_BUDGET_MS (export "PARSER_DEFAULT_YIELD_BUDGET_MS") i32 (i32.const 8))
  (global $PARSER_TOKEN_RECORD_BYTES (export "PARSER_TOKEN_RECORD_BYTES") i32 (i32.const 12))

  (global $PARSER_STATE_MAGIC_OFFSET (export "PARSER_STATE_MAGIC_OFFSET") i32 (i32.const 0))
  (global $PARSER_STATE_VERSION_OFFSET (export "PARSER_STATE_VERSION_OFFSET") i32 (i32.const 4))
  (global $PARSER_STATE_STATUS_OFFSET (export "PARSER_STATE_STATUS_OFFSET") i32 (i32.const 8))
  (global $PARSER_STATE_YIELD_BUDGET_MS_OFFSET (export "PARSER_STATE_YIELD_BUDGET_MS_OFFSET") i32 (i32.const 12))
  (global $PARSER_STATE_SOURCE_ID_OFFSET (export "PARSER_STATE_SOURCE_ID_OFFSET") i32 (i32.const 16))
  (global $PARSER_STATE_FLAGS_OFFSET (export "PARSER_STATE_FLAGS_OFFSET") i32 (i32.const 20))
  (global $PARSER_STATE_FILE_OFFSET_OFFSET (export "PARSER_STATE_FILE_OFFSET_OFFSET") i32 (i32.const 24))
  (global $PARSER_STATE_RING_READ_OFFSET (export "PARSER_STATE_RING_READ_OFFSET") i32 (i32.const 32))
  (global $PARSER_STATE_RING_WRITE_OFFSET (export "PARSER_STATE_RING_WRITE_OFFSET") i32 (i32.const 36))
  (global $PARSER_STATE_RING_COUNT_OFFSET (export "PARSER_STATE_RING_COUNT_OFFSET") i32 (i32.const 40))
  (global $PARSER_STATE_DEPTH_OFFSET (export "PARSER_STATE_DEPTH_OFFSET") i32 (i32.const 44))
  (global $PARSER_STATE_STACK_LEN_OFFSET (export "PARSER_STATE_STACK_LEN_OFFSET") i32 (i32.const 48))
  (global $PARSER_STATE_TOKEN_KIND_OFFSET (export "PARSER_STATE_TOKEN_KIND_OFFSET") i32 (i32.const 52))
  (global $PARSER_STATE_PARTIAL_TOKEN_LEN_OFFSET (export "PARSER_STATE_PARTIAL_TOKEN_LEN_OFFSET") i32 (i32.const 56))
  (global $PARSER_STATE_PARTIAL_TOKEN_HASH_OFFSET (export "PARSER_STATE_PARTIAL_TOKEN_HASH_OFFSET") i32 (i32.const 60))
  (global $PARSER_STATE_STRING_ESCAPE_OFFSET (export "PARSER_STATE_STRING_ESCAPE_OFFSET") i32 (i32.const 64))
  (global $PARSER_STATE_UNICODE_ACCUM_OFFSET (export "PARSER_STATE_UNICODE_ACCUM_OFFSET") i32 (i32.const 68))
  (global $PARSER_STATE_EVENT_FIELD_OFFSET (export "PARSER_STATE_EVENT_FIELD_OFFSET") i32 (i32.const 72))
  (global $PARSER_STATE_EVENT_FIELD_MASK_OFFSET (export "PARSER_STATE_EVENT_FIELD_MASK_OFFSET") i32 (i32.const 76))
  (global $PARSER_STATE_CURRENT_KEY_HASH_OFFSET (export "PARSER_STATE_CURRENT_KEY_HASH_OFFSET") i32 (i32.const 80))
  (global $PARSER_STATE_DFA_STATE_OFFSET (export "PARSER_STATE_DFA_STATE_OFFSET") i32 (i32.const 84))
  (global $PARSER_STATE_EVENT_COUNT_OFFSET (export "PARSER_STATE_EVENT_COUNT_OFFSET") i32 (i32.const 88))
  (global $PARSER_STATE_STACK_OFFSET (export "PARSER_STATE_STACK_OFFSET") i32 (i32.const 96))
  (global $PARSER_STATE_PARTIAL_TOKEN_OFFSET (export "PARSER_STATE_PARTIAL_TOKEN_OFFSET") i32 (i32.const 160))
  (global $PARSER_STATE_OUTPUT_RECORD_CAP_OFFSET (export "PARSER_STATE_OUTPUT_RECORD_CAP_OFFSET") i32 (i32.const 416))
  (global $PARSER_STATE_OUTPUT_WRITE_RECORD_OFFSET (export "PARSER_STATE_OUTPUT_WRITE_RECORD_OFFSET") i32 (i32.const 420))
  (global $PARSER_STATE_OUTPUT_WRITE_OFFSET (export "PARSER_STATE_OUTPUT_WRITE_OFFSET") i32 (i32.const 424))
  (global $PARSER_STATE_OUTPUT_COUNT_OFFSET (export "PARSER_STATE_OUTPUT_COUNT_OFFSET") i32 (i32.const 428))
  (global $PARSER_STATE_LINE_OFFSET (export "PARSER_STATE_LINE_OFFSET") i32 (i32.const 432))
  (global $PARSER_STATE_COLUMN_OFFSET (export "PARSER_STATE_COLUMN_OFFSET") i32 (i32.const 436))
  (global $PARSER_STATE_ERROR_LINE_OFFSET (export "PARSER_STATE_ERROR_LINE_OFFSET") i32 (i32.const 440))
  (global $PARSER_STATE_ERROR_COLUMN_OFFSET (export "PARSER_STATE_ERROR_COLUMN_OFFSET") i32 (i32.const 444))
  (global $PARSER_STATE_TOKEN_START_RING_OFFSET_OFFSET (export "PARSER_STATE_TOKEN_START_RING_OFFSET_OFFSET") i32 (i32.const 448))
  (global $PARSER_STATE_TOKEN_START_FILE_OFFSET_OFFSET (export "PARSER_STATE_TOKEN_START_FILE_OFFSET_OFFSET") i32 (i32.const 456))

  (global $PARSER_STATUS_READY (export "PARSER_STATUS_READY") i32 (i32.const 0))
  (global $PARSER_STATUS_NEED_CHUNK (export "PARSER_STATUS_NEED_CHUNK") i32 (i32.const 1))
  (global $PARSER_STATUS_YIELDED (export "PARSER_STATUS_YIELDED") i32 (i32.const 2))
  (global $PARSER_STATUS_DONE (export "PARSER_STATUS_DONE") i32 (i32.const 3))
  (global $PARSER_STATUS_MALFORMED (export "PARSER_STATUS_MALFORMED") i32 (i32.const 4))
  (global $PARSER_STATUS_STATE_INVALID (export "PARSER_STATUS_STATE_INVALID") i32 (i32.const 5))

  (global $PARSER_TOKEN_NONE (export "PARSER_TOKEN_NONE") i32 (i32.const 0))
  (global $PARSER_TOKEN_STRING (export "PARSER_TOKEN_STRING") i32 (i32.const 1))
  (global $PARSER_TOKEN_NUMBER (export "PARSER_TOKEN_NUMBER") i32 (i32.const 2))
  (global $PARSER_TOKEN_LITERAL (export "PARSER_TOKEN_LITERAL") i32 (i32.const 3))

  (global $PARSER_DFA_DEFAULT (export "PARSER_DFA_DEFAULT") i32 (i32.const 0))
  (global $PARSER_DFA_STRING (export "PARSER_DFA_STRING") i32 (i32.const 1))
  (global $PARSER_DFA_STRING_ESCAPE (export "PARSER_DFA_STRING_ESCAPE") i32 (i32.const 2))
  (global $PARSER_DFA_NUMBER (export "PARSER_DFA_NUMBER") i32 (i32.const 3))
  (global $PARSER_DFA_KEYWORD (export "PARSER_DFA_KEYWORD") i32 (i32.const 4))

  (global $PARSER_JSON_TOKEN_LBRACE (export "PARSER_JSON_TOKEN_LBRACE") i32 (i32.const 1))
  (global $PARSER_JSON_TOKEN_RBRACE (export "PARSER_JSON_TOKEN_RBRACE") i32 (i32.const 2))
  (global $PARSER_JSON_TOKEN_LBRACK (export "PARSER_JSON_TOKEN_LBRACK") i32 (i32.const 3))
  (global $PARSER_JSON_TOKEN_RBRACK (export "PARSER_JSON_TOKEN_RBRACK") i32 (i32.const 4))
  (global $PARSER_JSON_TOKEN_COLON (export "PARSER_JSON_TOKEN_COLON") i32 (i32.const 5))
  (global $PARSER_JSON_TOKEN_COMMA (export "PARSER_JSON_TOKEN_COMMA") i32 (i32.const 6))
  (global $PARSER_JSON_TOKEN_STRING (export "PARSER_JSON_TOKEN_STRING") i32 (i32.const 7))
  (global $PARSER_JSON_TOKEN_NUMBER (export "PARSER_JSON_TOKEN_NUMBER") i32 (i32.const 8))
  (global $PARSER_JSON_TOKEN_TRUE (export "PARSER_JSON_TOKEN_TRUE") i32 (i32.const 9))
  (global $PARSER_JSON_TOKEN_FALSE (export "PARSER_JSON_TOKEN_FALSE") i32 (i32.const 10))
  (global $PARSER_JSON_TOKEN_NULL (export "PARSER_JSON_TOKEN_NULL") i32 (i32.const 11))
  (global $PARSER_JSON_TOKEN_EOF (export "PARSER_JSON_TOKEN_EOF") i32 (i32.const 12))
  (global $PARSER_JSON_TOKEN_NEED_MORE (export "PARSER_JSON_TOKEN_NEED_MORE") i32 (i32.const 13))
  (global $PARSER_JSON_TOKEN_YIELD (export "PARSER_JSON_TOKEN_YIELD") i32 (i32.const 14))
  (global $PARSER_JSON_TOKEN_ERROR (export "PARSER_JSON_TOKEN_ERROR") i32 (i32.const 15))

  (global $PARSER_STACK_ARRAY (export "PARSER_STACK_ARRAY") i32 (i32.const 1))
  (global $PARSER_STACK_OBJECT (export "PARSER_STACK_OBJECT") i32 (i32.const 2))

  (global $PARSER_EVENT_FIELD_NONE (export "PARSER_EVENT_FIELD_NONE") i32 (i32.const 0))
  (global $PARSER_EVENT_FIELD_NAME (export "PARSER_EVENT_FIELD_NAME") i32 (i32.const 1))
  (global $PARSER_EVENT_FIELD_CAT (export "PARSER_EVENT_FIELD_CAT") i32 (i32.const 2))
  (global $PARSER_EVENT_FIELD_PHASE (export "PARSER_EVENT_FIELD_PHASE") i32 (i32.const 3))
  (global $PARSER_EVENT_FIELD_TS (export "PARSER_EVENT_FIELD_TS") i32 (i32.const 4))
  (global $PARSER_EVENT_FIELD_DUR (export "PARSER_EVENT_FIELD_DUR") i32 (i32.const 5))
  (global $PARSER_EVENT_FIELD_PID (export "PARSER_EVENT_FIELD_PID") i32 (i32.const 6))
  (global $PARSER_EVENT_FIELD_TID (export "PARSER_EVENT_FIELD_TID") i32 (i32.const 7))
  (global $PARSER_EVENT_FIELD_ARGS (export "PARSER_EVENT_FIELD_ARGS") i32 (i32.const 8))
  (global $PARSER_EVENT_FIELD_OTHER (export "PARSER_EVENT_FIELD_OTHER") i32 (i32.const 9))
  ;; @generated parser-state-globals:end

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

  (func $field (param $state i32) (param $offset i32) (result i32)
    local.get $state
    local.get $offset
    i32.add
  )

  (func (export "parser_state_init") (param $state i32) (param $source_id i32)
    local.get $state
    global.get $PARSER_STATE_BYTES
    call $zero_bytes

    local.get $state
    global.get $PARSER_STATE_MAGIC_OFFSET
    call $field
    global.get $PARSER_STATE_MAGIC
    i32.store

    local.get $state
    global.get $PARSER_STATE_VERSION_OFFSET
    call $field
    global.get $PARSER_STATE_VERSION
    i32.store

    local.get $state
    global.get $PARSER_STATE_STATUS_OFFSET
    call $field
    global.get $PARSER_STATUS_READY
    i32.store

    local.get $state
    global.get $PARSER_STATE_YIELD_BUDGET_MS_OFFSET
    call $field
    global.get $PARSER_DEFAULT_YIELD_BUDGET_MS
    i32.store

    local.get $state
    global.get $PARSER_STATE_SOURCE_ID_OFFSET
    call $field
    local.get $source_id
    i32.store

    local.get $state
    global.get $PARSER_STATE_DFA_STATE_OFFSET
    call $field
    global.get $PARSER_DFA_DEFAULT
    i32.store

    local.get $state
    global.get $PARSER_STATE_LINE_OFFSET
    call $field
    i32.const 1
    i32.store

    local.get $state
    global.get $PARSER_STATE_COLUMN_OFFSET
    call $field
    i32.const 1
    i32.store
  )

  (func (export "parser_state_is_valid") (param $state i32) (result i32)
    local.get $state
    global.get $PARSER_STATE_MAGIC_OFFSET
    call $field
    i32.load
    global.get $PARSER_STATE_MAGIC
    i32.eq
    local.get $state
    global.get $PARSER_STATE_VERSION_OFFSET
    call $field
    i32.load
    global.get $PARSER_STATE_VERSION
    i32.eq
    i32.and
  )
)
