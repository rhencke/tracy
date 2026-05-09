(module
  (import "env" "memory" (memory $memory 1 32768))
  (import "watwat" "assert_eq_i32"
    (func $assert_eq_i32 (param i32) (param i32) (param i32)))
  (import "watwat" "assert_true"
    (func $assert_true (param i32) (param i32)))
  ;; @generated parser-state-imports parser-state-test:start
  (import "parser_state" "PARSER_STATE_MAGIC" (global $PARSER_STATE_MAGIC i32))
  (import "parser_state" "PARSER_STATE_VERSION" (global $PARSER_STATE_VERSION i32))
  (import "parser_state" "PARSER_STATE_BYTES" (global $PARSER_STATE_BYTES i32))
  (import "parser_state" "PARSER_STACK_CAP" (global $PARSER_STACK_CAP i32))
  (import "parser_state" "PARSER_PARTIAL_TOKEN_CAP" (global $PARSER_PARTIAL_TOKEN_CAP i32))
  (import "parser_state" "PARSER_DEFAULT_YIELD_BUDGET_MS" (global $PARSER_DEFAULT_YIELD_BUDGET_MS i32))
  (import "parser_state" "PARSER_TOKEN_RECORD_BYTES" (global $PARSER_TOKEN_RECORD_BYTES i32))
  (import "parser_state" "PARSER_DEFAULT_OUTPUT_RECORD_CAP" (global $PARSER_DEFAULT_OUTPUT_RECORD_CAP i32))
  (import "parser_state" "PARSER_STATE_MAGIC_OFFSET" (global $PARSER_STATE_MAGIC_OFFSET i32))
  (import "parser_state" "PARSER_STATE_VERSION_OFFSET" (global $PARSER_STATE_VERSION_OFFSET i32))
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
  (import "parser_state" "PARSER_STATE_PARTIAL_TOKEN_HASH_OFFSET" (global $PARSER_STATE_PARTIAL_TOKEN_HASH_OFFSET i32))
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
  (import "parser_state" "PARSER_STATUS_READY" (global $PARSER_STATUS_READY i32))
  (import "parser_state" "PARSER_STATUS_NEED_CHUNK" (global $PARSER_STATUS_NEED_CHUNK i32))
  (import "parser_state" "PARSER_STATUS_YIELDED" (global $PARSER_STATUS_YIELDED i32))
  (import "parser_state" "PARSER_STATUS_DONE" (global $PARSER_STATUS_DONE i32))
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
  ;; @generated parser-state-imports parser-state-test:end
  (import "parser_state" "parser_state_init"
    (func $parser_state_init (param i32) (param i32)))
  (import "parser_state" "parser_state_is_valid"
    (func $parser_state_is_valid (param i32) (result i32)))

  (data (i32.const 1024) "parser state test failed")

  (func (export "message_for") (param $code i32) (result i32 i32)
    i32.const 1024
    i32.const 24
  )

  (func $field (param $state i32) (param $offset i32) (result i32)
    local.get $state
    local.get $offset
    i32.add
  )

  (func (export "test_parser_state_layout")
    ;; @generated parser-state-layout-assertions:start
    global.get $PARSER_STATE_MAGIC
    i32.const 0x5452504A
    i32.const 1
    call $assert_eq_i32

    global.get $PARSER_STATE_VERSION
    i32.const 2
    i32.const 2
    call $assert_eq_i32

    global.get $PARSER_STATE_BYTES
    i32.const 512
    i32.const 3
    call $assert_eq_i32

    global.get $PARSER_STACK_CAP
    i32.const 64
    i32.const 4
    call $assert_eq_i32

    global.get $PARSER_PARTIAL_TOKEN_CAP
    i32.const 256
    i32.const 5
    call $assert_eq_i32

    global.get $PARSER_DEFAULT_YIELD_BUDGET_MS
    i32.const 8
    i32.const 6
    call $assert_eq_i32

    global.get $PARSER_TOKEN_RECORD_BYTES
    i32.const 12
    i32.const 7
    call $assert_eq_i32

    global.get $PARSER_DEFAULT_OUTPUT_RECORD_CAP
    i32.const 4096
    i32.const 8
    call $assert_eq_i32

    global.get $PARSER_STATE_MAGIC_OFFSET
    i32.const 0
    i32.const 9
    call $assert_eq_i32

    global.get $PARSER_STATE_VERSION_OFFSET
    i32.const 4
    i32.const 10
    call $assert_eq_i32

    global.get $PARSER_STATE_STATUS_OFFSET
    i32.const 8
    i32.const 11
    call $assert_eq_i32

    global.get $PARSER_STATE_YIELD_BUDGET_MS_OFFSET
    i32.const 12
    i32.const 12
    call $assert_eq_i32

    global.get $PARSER_STATE_SOURCE_ID_OFFSET
    i32.const 16
    i32.const 13
    call $assert_eq_i32

    global.get $PARSER_STATE_FLAGS_OFFSET
    i32.const 20
    i32.const 14
    call $assert_eq_i32

    global.get $PARSER_STATE_FILE_OFFSET_OFFSET
    i32.const 24
    i32.const 15
    call $assert_eq_i32

    global.get $PARSER_STATE_RING_READ_OFFSET
    i32.const 32
    i32.const 16
    call $assert_eq_i32

    global.get $PARSER_STATE_RING_WRITE_OFFSET
    i32.const 36
    i32.const 17
    call $assert_eq_i32

    global.get $PARSER_STATE_RING_COUNT_OFFSET
    i32.const 40
    i32.const 18
    call $assert_eq_i32

    global.get $PARSER_STATE_DEPTH_OFFSET
    i32.const 44
    i32.const 19
    call $assert_eq_i32

    global.get $PARSER_STATE_STACK_LEN_OFFSET
    i32.const 48
    i32.const 20
    call $assert_eq_i32

    global.get $PARSER_STATE_TOKEN_KIND_OFFSET
    i32.const 52
    i32.const 21
    call $assert_eq_i32

    global.get $PARSER_STATE_PARTIAL_TOKEN_LEN_OFFSET
    i32.const 56
    i32.const 22
    call $assert_eq_i32

    global.get $PARSER_STATE_PARTIAL_TOKEN_HASH_OFFSET
    i32.const 60
    i32.const 23
    call $assert_eq_i32

    global.get $PARSER_STATE_STRING_ESCAPE_OFFSET
    i32.const 64
    i32.const 24
    call $assert_eq_i32

    global.get $PARSER_STATE_UNICODE_ACCUM_OFFSET
    i32.const 68
    i32.const 25
    call $assert_eq_i32

    global.get $PARSER_STATE_EVENT_FIELD_OFFSET
    i32.const 72
    i32.const 26
    call $assert_eq_i32

    global.get $PARSER_STATE_EVENT_FIELD_MASK_OFFSET
    i32.const 76
    i32.const 27
    call $assert_eq_i32

    global.get $PARSER_STATE_CURRENT_KEY_HASH_OFFSET
    i32.const 80
    i32.const 28
    call $assert_eq_i32

    global.get $PARSER_STATE_DFA_STATE_OFFSET
    i32.const 84
    i32.const 29
    call $assert_eq_i32

    global.get $PARSER_STATE_EVENT_COUNT_OFFSET
    i32.const 88
    i32.const 30
    call $assert_eq_i32

    global.get $PARSER_STATE_STACK_OFFSET
    i32.const 96
    i32.const 31
    call $assert_eq_i32

    global.get $PARSER_STATE_PARTIAL_TOKEN_OFFSET
    i32.const 160
    i32.const 32
    call $assert_eq_i32

    global.get $PARSER_STATE_OUTPUT_RECORD_CAP_OFFSET
    i32.const 416
    i32.const 33
    call $assert_eq_i32

    global.get $PARSER_STATE_OUTPUT_WRITE_RECORD_OFFSET
    i32.const 420
    i32.const 34
    call $assert_eq_i32

    global.get $PARSER_STATE_OUTPUT_WRITE_OFFSET
    i32.const 424
    i32.const 35
    call $assert_eq_i32

    global.get $PARSER_STATE_OUTPUT_COUNT_OFFSET
    i32.const 428
    i32.const 36
    call $assert_eq_i32

    global.get $PARSER_STATE_LINE_OFFSET
    i32.const 432
    i32.const 37
    call $assert_eq_i32

    global.get $PARSER_STATE_COLUMN_OFFSET
    i32.const 436
    i32.const 38
    call $assert_eq_i32

    global.get $PARSER_STATE_ERROR_LINE_OFFSET
    i32.const 440
    i32.const 39
    call $assert_eq_i32

    global.get $PARSER_STATE_ERROR_COLUMN_OFFSET
    i32.const 444
    i32.const 40
    call $assert_eq_i32

    global.get $PARSER_STATE_TOKEN_START_RING_OFFSET_OFFSET
    i32.const 448
    i32.const 41
    call $assert_eq_i32

    global.get $PARSER_STATE_TOKEN_START_FILE_OFFSET_OFFSET
    i32.const 456
    i32.const 42
    call $assert_eq_i32
    ;; @generated parser-state-layout-assertions:end
  )

  (func (export "test_parser_state_status_and_enums")
    ;; @generated parser-state-enum-assertions:start
    global.get $PARSER_STATUS_READY
    i32.const 0
    i32.const 70
    call $assert_eq_i32

    global.get $PARSER_STATUS_NEED_CHUNK
    i32.const 1
    i32.const 71
    call $assert_eq_i32

    global.get $PARSER_STATUS_YIELDED
    i32.const 2
    i32.const 72
    call $assert_eq_i32

    global.get $PARSER_STATUS_DONE
    i32.const 3
    i32.const 73
    call $assert_eq_i32

    global.get $PARSER_STATUS_MALFORMED
    i32.const 4
    i32.const 74
    call $assert_eq_i32

    global.get $PARSER_STATUS_STATE_INVALID
    i32.const 5
    i32.const 75
    call $assert_eq_i32

    global.get $PARSER_TOKEN_NONE
    i32.const 0
    i32.const 76
    call $assert_eq_i32

    global.get $PARSER_TOKEN_STRING
    i32.const 1
    i32.const 77
    call $assert_eq_i32

    global.get $PARSER_TOKEN_NUMBER
    i32.const 2
    i32.const 78
    call $assert_eq_i32

    global.get $PARSER_TOKEN_LITERAL
    i32.const 3
    i32.const 79
    call $assert_eq_i32

    global.get $PARSER_DFA_DEFAULT
    i32.const 0
    i32.const 80
    call $assert_eq_i32

    global.get $PARSER_DFA_STRING
    i32.const 1
    i32.const 81
    call $assert_eq_i32

    global.get $PARSER_DFA_STRING_ESCAPE
    i32.const 2
    i32.const 82
    call $assert_eq_i32

    global.get $PARSER_DFA_NUMBER
    i32.const 3
    i32.const 83
    call $assert_eq_i32

    global.get $PARSER_DFA_KEYWORD
    i32.const 4
    i32.const 84
    call $assert_eq_i32

    global.get $PARSER_JSON_TOKEN_LBRACE
    i32.const 1
    i32.const 85
    call $assert_eq_i32

    global.get $PARSER_JSON_TOKEN_RBRACE
    i32.const 2
    i32.const 86
    call $assert_eq_i32

    global.get $PARSER_JSON_TOKEN_LBRACK
    i32.const 3
    i32.const 87
    call $assert_eq_i32

    global.get $PARSER_JSON_TOKEN_RBRACK
    i32.const 4
    i32.const 88
    call $assert_eq_i32

    global.get $PARSER_JSON_TOKEN_COLON
    i32.const 5
    i32.const 89
    call $assert_eq_i32

    global.get $PARSER_JSON_TOKEN_COMMA
    i32.const 6
    i32.const 90
    call $assert_eq_i32

    global.get $PARSER_JSON_TOKEN_STRING
    i32.const 7
    i32.const 91
    call $assert_eq_i32

    global.get $PARSER_JSON_TOKEN_NUMBER
    i32.const 8
    i32.const 92
    call $assert_eq_i32

    global.get $PARSER_JSON_TOKEN_TRUE
    i32.const 9
    i32.const 93
    call $assert_eq_i32

    global.get $PARSER_JSON_TOKEN_FALSE
    i32.const 10
    i32.const 94
    call $assert_eq_i32

    global.get $PARSER_JSON_TOKEN_NULL
    i32.const 11
    i32.const 95
    call $assert_eq_i32

    global.get $PARSER_JSON_TOKEN_EOF
    i32.const 12
    i32.const 96
    call $assert_eq_i32

    global.get $PARSER_JSON_TOKEN_NEED_MORE
    i32.const 13
    i32.const 97
    call $assert_eq_i32

    global.get $PARSER_JSON_TOKEN_YIELD
    i32.const 14
    i32.const 98
    call $assert_eq_i32

    global.get $PARSER_JSON_TOKEN_ERROR
    i32.const 15
    i32.const 99
    call $assert_eq_i32

    global.get $PARSER_STACK_ARRAY
    i32.const 1
    i32.const 100
    call $assert_eq_i32

    global.get $PARSER_STACK_OBJECT
    i32.const 2
    i32.const 101
    call $assert_eq_i32

    global.get $PARSER_EVENT_FIELD_NONE
    i32.const 0
    i32.const 102
    call $assert_eq_i32

    global.get $PARSER_EVENT_FIELD_NAME
    i32.const 1
    i32.const 103
    call $assert_eq_i32

    global.get $PARSER_EVENT_FIELD_CAT
    i32.const 2
    i32.const 104
    call $assert_eq_i32

    global.get $PARSER_EVENT_FIELD_PHASE
    i32.const 3
    i32.const 105
    call $assert_eq_i32

    global.get $PARSER_EVENT_FIELD_TS
    i32.const 4
    i32.const 106
    call $assert_eq_i32

    global.get $PARSER_EVENT_FIELD_DUR
    i32.const 5
    i32.const 107
    call $assert_eq_i32

    global.get $PARSER_EVENT_FIELD_PID
    i32.const 6
    i32.const 108
    call $assert_eq_i32

    global.get $PARSER_EVENT_FIELD_TID
    i32.const 7
    i32.const 109
    call $assert_eq_i32

    global.get $PARSER_EVENT_FIELD_ARGS
    i32.const 8
    i32.const 110
    call $assert_eq_i32

    global.get $PARSER_EVENT_FIELD_OTHER
    i32.const 9
    i32.const 111
    call $assert_eq_i32
    ;; @generated parser-state-enum-assertions:end
  )

  (func (export "test_parser_state_defaults_and_validation")
    i32.const 2048
    i32.const 77
    call $parser_state_init

    i32.const 2048
    call $parser_state_is_valid
    i32.const 40
    call $assert_true

    i32.const 2048
    global.get $PARSER_STATE_STATUS_OFFSET
    call $field
    i32.load
    global.get $PARSER_STATUS_READY
    i32.const 41
    call $assert_eq_i32

    i32.const 2048
    global.get $PARSER_STATE_YIELD_BUDGET_MS_OFFSET
    call $field
    i32.load
    global.get $PARSER_DEFAULT_YIELD_BUDGET_MS
    i32.const 42
    call $assert_eq_i32

    global.get $PARSER_DEFAULT_YIELD_BUDGET_MS
    i32.const 8
    i32.le_u
    i32.const 43
    call $assert_true

    i32.const 2048
    global.get $PARSER_STATE_SOURCE_ID_OFFSET
    call $field
    i32.load
    i32.const 77
    i32.const 44
    call $assert_eq_i32

    i32.const 2048
    global.get $PARSER_STATE_FILE_OFFSET_OFFSET
    call $field
    i64.load
    i64.eqz
    i32.const 45
    call $assert_true

    i32.const 2048
    global.get $PARSER_STATE_DFA_STATE_OFFSET
    call $field
    i32.load
    global.get $PARSER_DFA_DEFAULT
    i32.const 46
    call $assert_eq_i32

    i32.const 2048
    global.get $PARSER_STATE_OUTPUT_RECORD_CAP_OFFSET
    call $field
    i32.load
    i32.const 0
    i32.const 47
    call $assert_eq_i32

    i32.const 2048
    global.get $PARSER_STATE_OUTPUT_COUNT_OFFSET
    call $field
    i32.load
    i32.const 0
    i32.const 48
    call $assert_eq_i32

    i32.const 2048
    global.get $PARSER_STATE_LINE_OFFSET
    call $field
    i32.load
    i32.const 1
    i32.const 49
    call $assert_eq_i32

    i32.const 2048
    global.get $PARSER_STATE_COLUMN_OFFSET
    call $field
    i32.load
    i32.const 1
    i32.const 50
    call $assert_eq_i32
  )
)
