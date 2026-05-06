(module
  (import "env" "memory" (memory $memory 1 32768))
  (import "watwat" "assert_eq_i32"
    (func $assert_eq_i32 (param i32) (param i32) (param i32)))
  (import "watwat" "assert_true"
    (func $assert_true (param i32) (param i32)))
  (import "parser_state" "PARSER_STATE_MAGIC" (global $PARSER_STATE_MAGIC i32))
  (import "parser_state" "PARSER_STATE_VERSION" (global $PARSER_STATE_VERSION i32))
  (import "parser_state" "PARSER_STATE_BYTES" (global $PARSER_STATE_BYTES i32))
  (import "parser_state" "PARSER_STACK_CAP" (global $PARSER_STACK_CAP i32))
  (import "parser_state" "PARSER_PARTIAL_TOKEN_CAP" (global $PARSER_PARTIAL_TOKEN_CAP i32))
  (import "parser_state" "PARSER_DEFAULT_YIELD_BUDGET_MS" (global $PARSER_DEFAULT_YIELD_BUDGET_MS i32))
  (import "parser_state" "PARSER_STATE_MAGIC_OFFSET" (global $PARSER_STATE_MAGIC_OFFSET i32))
  (import "parser_state" "PARSER_STATE_VERSION_OFFSET" (global $PARSER_STATE_VERSION_OFFSET i32))
  (import "parser_state" "PARSER_STATE_STATUS_OFFSET" (global $PARSER_STATE_STATUS_OFFSET i32))
  (import "parser_state" "PARSER_STATE_YIELD_BUDGET_MS_OFFSET" (global $PARSER_STATE_YIELD_BUDGET_MS_OFFSET i32))
  (import "parser_state" "PARSER_STATE_SOURCE_ID_OFFSET" (global $PARSER_STATE_SOURCE_ID_OFFSET i32))
  (import "parser_state" "PARSER_STATE_FILE_OFFSET_OFFSET" (global $PARSER_STATE_FILE_OFFSET_OFFSET i32))
  (import "parser_state" "PARSER_STATE_STACK_OFFSET" (global $PARSER_STATE_STACK_OFFSET i32))
  (import "parser_state" "PARSER_STATE_PARTIAL_TOKEN_OFFSET" (global $PARSER_STATE_PARTIAL_TOKEN_OFFSET i32))
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
  (import "parser_state" "PARSER_STACK_ARRAY" (global $PARSER_STACK_ARRAY i32))
  (import "parser_state" "PARSER_STACK_OBJECT" (global $PARSER_STACK_OBJECT i32))
  (import "parser_state" "PARSER_EVENT_FIELD_NONE" (global $PARSER_EVENT_FIELD_NONE i32))
  (import "parser_state" "PARSER_EVENT_FIELD_ARGS" (global $PARSER_EVENT_FIELD_ARGS i32))
  (import "parser_state" "PARSER_EVENT_FIELD_OTHER" (global $PARSER_EVENT_FIELD_OTHER i32))
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
    global.get $PARSER_STATE_MAGIC
    i32.const 0x5452504A
    i32.const 1
    call $assert_eq_i32

    global.get $PARSER_STATE_VERSION
    i32.const 1
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

    global.get $PARSER_STATE_MAGIC_OFFSET
    i32.const 0
    i32.const 6
    call $assert_eq_i32

    global.get $PARSER_STATE_VERSION_OFFSET
    i32.const 4
    i32.const 7
    call $assert_eq_i32

    global.get $PARSER_STATE_STATUS_OFFSET
    i32.const 8
    i32.const 8
    call $assert_eq_i32

    global.get $PARSER_STATE_YIELD_BUDGET_MS_OFFSET
    i32.const 12
    i32.const 9
    call $assert_eq_i32

    global.get $PARSER_STATE_SOURCE_ID_OFFSET
    i32.const 16
    i32.const 10
    call $assert_eq_i32

    global.get $PARSER_STATE_FILE_OFFSET_OFFSET
    i32.const 24
    i32.const 11
    call $assert_eq_i32

    global.get $PARSER_STATE_STACK_OFFSET
    i32.const 96
    i32.const 12
    call $assert_eq_i32

    global.get $PARSER_STATE_PARTIAL_TOKEN_OFFSET
    i32.const 160
    i32.const 13
    call $assert_eq_i32
  )

  (func (export "test_parser_state_status_and_enums")
    global.get $PARSER_STATUS_READY
    i32.const 0
    i32.const 20
    call $assert_eq_i32

    global.get $PARSER_STATUS_NEED_CHUNK
    i32.const 1
    i32.const 21
    call $assert_eq_i32

    global.get $PARSER_STATUS_YIELDED
    i32.const 2
    i32.const 22
    call $assert_eq_i32

    global.get $PARSER_STATUS_DONE
    i32.const 3
    i32.const 23
    call $assert_eq_i32

    global.get $PARSER_STATUS_MALFORMED
    i32.const 4
    i32.const 24
    call $assert_eq_i32

    global.get $PARSER_STATUS_STATE_INVALID
    i32.const 5
    i32.const 25
    call $assert_eq_i32

    global.get $PARSER_TOKEN_NONE
    i32.const 0
    i32.const 26
    call $assert_eq_i32

    global.get $PARSER_TOKEN_STRING
    i32.const 1
    i32.const 27
    call $assert_eq_i32

    global.get $PARSER_TOKEN_NUMBER
    i32.const 2
    i32.const 28
    call $assert_eq_i32

    global.get $PARSER_TOKEN_LITERAL
    i32.const 3
    i32.const 29
    call $assert_eq_i32

    global.get $PARSER_STACK_ARRAY
    i32.const 1
    i32.const 30
    call $assert_eq_i32

    global.get $PARSER_STACK_OBJECT
    i32.const 2
    i32.const 31
    call $assert_eq_i32

    global.get $PARSER_EVENT_FIELD_NONE
    i32.const 0
    i32.const 32
    call $assert_eq_i32

    global.get $PARSER_EVENT_FIELD_ARGS
    i32.const 8
    i32.const 33
    call $assert_eq_i32

    global.get $PARSER_EVENT_FIELD_OTHER
    i32.const 9
    i32.const 34
    call $assert_eq_i32
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
  )
)
