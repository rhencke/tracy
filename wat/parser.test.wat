(module
  (import "env" "memory" (memory $memory 1 32768))
  (import "watwat" "assert_true"
    (func $assert_true (param i32) (param i32)))
  (import "watwat" "assert_eq_i32"
    (func $assert_eq_i32 (param i32) (param i32) (param i32)))
  (import "watwat" "assert_eq_i64"
    (func $assert_eq_i64 (param i64) (param i64) (param i32)))
  (import "parser" "parser_parse"
    (func $parser_parse (param i32) (param i32) (result i32)))
  (import "parser" "parser_parse_with_budget"
    (func $parser_parse_with_budget (param i32) (param i32) (param i32) (result i32)))
  (import "parser" "parser_tokenize_bytes"
    (func $parser_tokenize_bytes (param i32) (param i32) (param i32) (param i32) (param i32) (result i32)))
  (import "parser" "parser_token_output_reset"
    (func $parser_token_output_reset (param i32) (param i32) (result i32)))
  (import "parser" "parser_emit_token"
    (func $parser_emit_token (param i32) (param i32) (param i32) (param i32) (param i32) (result i32)))
  (import "parser" "parser_emit_structural_token"
    (func $parser_emit_structural_token (param i32) (param i32) (param i32) (result i32)))
  (import "parser" "parser_emit_eof_token"
    (func $parser_emit_eof_token (param i32) (param i32) (result i32)))
  (import "parser" "parser_emit_need_more_token"
    (func $parser_emit_need_more_token (param i32) (param i32) (result i32)))
  (import "parser" "parser_emit_yield_token"
    (func $parser_emit_yield_token (param i32) (param i32) (result i32)))
  (import "parser" "parser_emit_error_token"
    (func $parser_emit_error_token (param i32) (param i32) (param i32) (param i32) (result i32)))
  (import "parser_state" "parser_state_init"
    (func $parser_state_init (param i32) (param i32)))
  ;; @generated parser-state-imports parser-test:start
  (import "parser_state" "PARSER_STATE_BYTES" (global $PARSER_STATE_BYTES i32))
  (import "parser_state" "PARSER_STATE_STATUS_OFFSET" (global $PARSER_STATE_STATUS_OFFSET i32))
  (import "parser_state" "PARSER_STATE_YIELD_BUDGET_MS_OFFSET" (global $PARSER_STATE_YIELD_BUDGET_MS_OFFSET i32))
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
  (import "parser_state" "PARSER_DEFAULT_YIELD_BUDGET_MS" (global $PARSER_DEFAULT_YIELD_BUDGET_MS i32))
  (import "parser_state" "PARSER_TOKEN_RECORD_BYTES" (global $PARSER_TOKEN_RECORD_BYTES i32))
  (import "parser_state" "PARSER_STATUS_DONE" (global $PARSER_STATUS_DONE i32))
  (import "parser_state" "PARSER_STATUS_YIELDED" (global $PARSER_STATUS_YIELDED i32))
  (import "parser_state" "PARSER_STATUS_MALFORMED" (global $PARSER_STATUS_MALFORMED i32))
  (import "parser_state" "PARSER_STATUS_STATE_INVALID" (global $PARSER_STATUS_STATE_INVALID i32))
  (import "parser_state" "PARSER_TOKEN_NONE" (global $PARSER_TOKEN_NONE i32))
  (import "parser_state" "PARSER_TOKEN_STRING" (global $PARSER_TOKEN_STRING i32))
  (import "parser_state" "PARSER_TOKEN_NUMBER" (global $PARSER_TOKEN_NUMBER i32))
  (import "parser_state" "PARSER_DFA_DEFAULT" (global $PARSER_DFA_DEFAULT i32))
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
  (import "parser_state" "PARSER_EVENT_FIELD_NONE" (global $PARSER_EVENT_FIELD_NONE i32))
  (import "parser_state" "PARSER_EVENT_FIELD_TS" (global $PARSER_EVENT_FIELD_TS i32))
  ;; @generated parser-state-imports parser-test:end

  (data (i32.const 1024) "parser test failed")
  (data (i32.const 2048) "{\"a\":[true,false,null,-12.3e+4]}")
  (data (i32.const 2100) "{\0a@")
  (data (i32.const 2110) "[0,1,10,-0,-1,1.0,1e2,1E+2,1e-2,1.0e2]")
  (data (i32.const 2170) "\22a\5cn\5cu0041\22")
  (data (i32.const 2190) "[-]")
  (data (i32.const 2198) "[01]")
  (data (i32.const 2206) "[1.]")
  (data (i32.const 2214) "[1e]")
  (data (i32.const 2222) "[1e+]")
  (data (i32.const 2230) "[tru]")
  (data (i32.const 2238) "[x]")
  (data (i32.const 2246) "\22a\00\22")
  (data (i32.const 2254) "\22a\5cq")
  (data (i32.const 2262) "\22a\5cu00q")
  (data (i32.const 2274) "1")
  (data (i32.const 2278) "true")
  (data (i32.const 2286) "\22abc")
  (data (i32.const 2294) "[")
  (data (i32.const 2298) "{}")
  (data (i32.const 2304) "}")
  (data (i32.const 2308) "]")
  (data (i32.const 2312) "[}")
  (data (i32.const 2320) "{]")
  (data (i32.const 2330) "[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[[")
  (data (i32.const 2400) "{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{{")
  (data (i32.const 2470) "[t@]")
  (data (i32.const 2478) "[-x]")
  (data (i32.const 2486) "-")
  (data (i32.const 2490) "tru")
  (data (i32.const 2494) "x")
  (data (i32.const 2496) "-x")
  (data (i32.const 2500) "0.1")
  (data (i32.const 2504) "0e1")
  (data (i32.const 2508) "1x")
  (data (i32.const 2512) "1.x")
  (data (i32.const 2516) "1.00")
  (data (i32.const 2522) "1.0x")
  (data (i32.const 2528) "1e2")
  (data (i32.const 2532) "1e+2")
  (data (i32.const 2538) "1e2x")
  (data (i32.const 2544) " ")
  (data (i32.const 2548) "1ex")
  (data (i32.const 2552) "1e+x")
  (data (i32.const 2558) ",")

  (func (export "message_for") (param $code i32) (result i32 i32)
    i32.const 1024
    i32.const 18
  )

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

  (func $assert_tokenize_status (param $state i32) (param $source_id i32) (param $input_ptr i32) (param $input_len i32) (param $record_cap i32) (param $expected i32) (param $code i32)
    local.get $state
    local.get $source_id
    call $parser_state_init

    local.get $state
    local.get $input_ptr
    local.get $input_len
    i32.const 57344
    local.get $record_cap
    call $parser_tokenize_bytes
    local.get $expected
    local.get $code
    call $assert_eq_i32
  )

  (func $assert_manual_number_status (param $state i32) (param $source_id i32) (param $token_ptr i32) (param $token_len i32) (param $expected i32) (param $code i32)
    local.get $state
    local.get $source_id
    call $parser_state_init

    local.get $token_ptr
    local.get $state
    i32.const 160
    call $field
    local.get $token_len
    call $copy_bytes

    local.get $state
    global.get $PARSER_STATE_PARTIAL_TOKEN_LEN_OFFSET
    local.get $token_len
    call $store_i32

    local.get $state
    global.get $PARSER_STATE_DFA_STATE_OFFSET
    i32.const 3
    call $store_i32

    local.get $state
    i32.const 2544
    i32.const 1
    i32.const 57344
    i32.const 4
    call $parser_tokenize_bytes
    local.get $expected
    local.get $code
    call $assert_eq_i32
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

  (func $assert_state_bytes_eq (param $left i32) (param $right i32) (param $code i32)
    (local $i i32)

    block $done
      loop $loop
        local.get $i
        global.get $PARSER_STATE_BYTES
        i32.ge_u
        br_if $done

        local.get $left
        local.get $i
        i32.add
        i32.load8_u
        local.get $right
        local.get $i
        i32.add
        i32.load8_u
        local.get $code
        call $assert_eq_i32

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      end
    end
  )

  (func $record_ptr (param $out i32) (param $index i32) (result i32)
    local.get $out
    local.get $index
    global.get $PARSER_TOKEN_RECORD_BYTES
    i32.mul
    i32.add
  )

  (func $assert_token_record (param $out i32) (param $index i32) (param $kind i32) (param $payload_ptr i32) (param $payload_len i32) (param $code i32)
    local.get $out
    local.get $index
    call $record_ptr
    i32.load
    local.get $kind
    local.get $code
    call $assert_eq_i32

    local.get $out
    local.get $index
    call $record_ptr
    i32.const 4
    i32.add
    i32.load
    local.get $payload_ptr
    local.get $code
    i32.const 1
    i32.add
    call $assert_eq_i32

    local.get $out
    local.get $index
    call $record_ptr
    i32.const 8
    i32.add
    i32.load
    local.get $payload_len
    local.get $code
    i32.const 2
    i32.add
    call $assert_eq_i32
  )

  (func (export "test_parser_writes_fixed_token_records")
    i32.const 55296
    i32.const 120
    call $parser_state_init

    i32.const 55296
    i32.const 5
    call $parser_token_output_reset
    i32.const 1
    i32.const 180
    call $assert_eq_i32

    i32.const 55296
    i32.const 57344
    global.get $PARSER_JSON_TOKEN_LBRACE
    call $parser_emit_structural_token
    i32.const 1
    i32.const 181
    call $assert_eq_i32

    i32.const 55296
    i32.const 57344
    global.get $PARSER_JSON_TOKEN_EOF
    i32.const 0
    i32.const 0
    call $parser_emit_token
    i32.const 1
    i32.const 182
    call $assert_eq_i32

    i32.const 55296
    i32.const 57344
    call $parser_emit_need_more_token
    i32.const 1
    i32.const 183
    call $assert_eq_i32

    i32.const 55296
    i32.const 57344
    call $parser_emit_yield_token
    i32.const 1
    i32.const 184
    call $assert_eq_i32

    i32.const 55296
    i32.const 57344
    i32.const 12
    i32.const 34
    call $parser_emit_error_token
    i32.const 1
    i32.const 185
    call $assert_eq_i32

    i32.const 57344
    i32.const 0
    global.get $PARSER_JSON_TOKEN_LBRACE
    i32.const 0
    i32.const 0
    i32.const 186
    call $assert_token_record

    i32.const 57344
    i32.const 1
    global.get $PARSER_JSON_TOKEN_EOF
    i32.const 0
    i32.const 0
    i32.const 190
    call $assert_token_record

    i32.const 57344
    i32.const 2
    global.get $PARSER_JSON_TOKEN_NEED_MORE
    i32.const 0
    i32.const 0
    i32.const 194
    call $assert_token_record

    i32.const 57344
    i32.const 3
    global.get $PARSER_JSON_TOKEN_YIELD
    i32.const 0
    i32.const 0
    i32.const 198
    call $assert_token_record

    i32.const 57344
    i32.const 4
    global.get $PARSER_JSON_TOKEN_ERROR
    i32.const 12
    i32.const 34
    i32.const 202
    call $assert_token_record

    i32.const 55296
    global.get $PARSER_STATE_OUTPUT_WRITE_RECORD_OFFSET
    call $load_i32
    i32.const 5
    i32.const 206
    call $assert_eq_i32

    i32.const 55296
    global.get $PARSER_STATE_OUTPUT_WRITE_OFFSET
    call $load_i32
    global.get $PARSER_TOKEN_RECORD_BYTES
    i32.const 5
    i32.mul
    i32.const 207
    call $assert_eq_i32

    i32.const 55296
    global.get $PARSER_STATE_OUTPUT_COUNT_OFFSET
    call $load_i32
    i32.const 5
    i32.const 208
    call $assert_eq_i32

    i32.const 55296
    global.get $PARSER_STATE_ERROR_LINE_OFFSET
    call $load_i32
    i32.const 12
    i32.const 209
    call $assert_eq_i32

    i32.const 55296
    global.get $PARSER_STATE_ERROR_COLUMN_OFFSET
    call $load_i32
    i32.const 34
    i32.const 210
    call $assert_eq_i32
  )

  (func (export "test_parser_token_output_respects_capacity")
    i32.const 55296
    i32.const 121
    call $parser_state_init

    i32.const 55296
    i32.const 1
    call $parser_token_output_reset
    i32.const 1
    i32.const 220
    call $assert_eq_i32

    i32.const 55296
    i32.const 57344
    global.get $PARSER_JSON_TOKEN_LBRACE
    call $parser_emit_structural_token
    i32.const 1
    i32.const 221
    call $assert_eq_i32

    i32.const 55296
    i32.const 57344
    call $parser_emit_eof_token
    i32.const 0
    i32.const 222
    call $assert_eq_i32

    i32.const 55296
    global.get $PARSER_STATE_OUTPUT_WRITE_RECORD_OFFSET
    call $load_i32
    i32.const 1
    i32.const 223
    call $assert_eq_i32

    i32.const 55296
    global.get $PARSER_STATE_OUTPUT_COUNT_OFFSET
    call $load_i32
    i32.const 1
    i32.const 224
    call $assert_eq_i32
  )

  (func (export "test_parser_token_output_rejects_invalid_state")
    i32.const 64000
    i32.const 2
    call $parser_token_output_reset
    i32.const 0
    i32.const 230
    call $assert_eq_i32

    i32.const 64000
    global.get $PARSER_STATE_STATUS_OFFSET
    call $field
    i32.load
    global.get $PARSER_STATUS_STATE_INVALID
    i32.const 231
    call $assert_eq_i32

    i32.const 64000
    i32.const 57344
    global.get $PARSER_JSON_TOKEN_LBRACE
    call $parser_emit_structural_token
    i32.const 0
    i32.const 232
    call $assert_eq_i32
  )

  (func (export "test_parser_tokenizes_json_dfa_records")
    i32.const 55296
    i32.const 122
    call $parser_state_init

    i32.const 55296
    i32.const 2048
    i32.const 32
    i32.const 57344
    i32.const 16
    call $parser_tokenize_bytes
    global.get $PARSER_STATUS_DONE
    i32.const 240
    call $assert_eq_i32

    i32.const 57344
    i32.const 0
    global.get $PARSER_JSON_TOKEN_LBRACE
    i32.const 0
    i32.const 0
    i32.const 241
    call $assert_token_record

    i32.const 57344
    i32.const 1
    global.get $PARSER_JSON_TOKEN_STRING
    i32.const 2050
    i32.const 1
    i32.const 245
    call $assert_token_record

    i32.const 57344
    i32.const 2
    global.get $PARSER_JSON_TOKEN_COLON
    i32.const 0
    i32.const 0
    i32.const 249
    call $assert_token_record

    i32.const 57344
    i32.const 3
    global.get $PARSER_JSON_TOKEN_LBRACK
    i32.const 0
    i32.const 0
    i32.const 253
    call $assert_token_record

    i32.const 57344
    i32.const 4
    global.get $PARSER_JSON_TOKEN_TRUE
    i32.const 2054
    i32.const 4
    i32.const 257
    call $assert_token_record

    i32.const 57344
    i32.const 6
    global.get $PARSER_JSON_TOKEN_FALSE
    i32.const 2059
    i32.const 5
    i32.const 261
    call $assert_token_record

    i32.const 57344
    i32.const 8
    global.get $PARSER_JSON_TOKEN_NULL
    i32.const 2065
    i32.const 4
    i32.const 265
    call $assert_token_record

    i32.const 57344
    i32.const 10
    global.get $PARSER_JSON_TOKEN_NUMBER
    i32.const 2070
    i32.const 8
    i32.const 269
    call $assert_token_record

    i32.const 57344
    i32.const 11
    global.get $PARSER_JSON_TOKEN_RBRACK
    i32.const 0
    i32.const 0
    i32.const 273
    call $assert_token_record

    i32.const 57344
    i32.const 12
    global.get $PARSER_JSON_TOKEN_RBRACE
    i32.const 0
    i32.const 0
    i32.const 277
    call $assert_token_record

    i32.const 57344
    i32.const 13
    global.get $PARSER_JSON_TOKEN_EOF
    i32.const 0
    i32.const 0
    i32.const 281
    call $assert_token_record

    i32.const 55296
    global.get $PARSER_STATE_OUTPUT_COUNT_OFFSET
    call $load_i32
    i32.const 14
    i32.const 285
    call $assert_eq_i32

    i32.const 55296
    global.get $PARSER_STATE_DFA_STATE_OFFSET
    call $load_i32
    global.get $PARSER_DFA_DEFAULT
    i32.const 286
    call $assert_eq_i32
  )

  (func (export "test_parser_tokenizer_records_error_position")
    i32.const 55296
    i32.const 123
    call $parser_state_init

    i32.const 55296
    i32.const 2100
    i32.const 3
    i32.const 57344
    i32.const 4
    call $parser_tokenize_bytes
    global.get $PARSER_STATUS_MALFORMED
    i32.const 300
    call $assert_eq_i32

    i32.const 57344
    i32.const 0
    global.get $PARSER_JSON_TOKEN_LBRACE
    i32.const 0
    i32.const 0
    i32.const 301
    call $assert_token_record

    i32.const 57344
    i32.const 1
    global.get $PARSER_JSON_TOKEN_ERROR
    i32.const 2
    i32.const 1
    i32.const 305
    call $assert_token_record

    i32.const 55296
    global.get $PARSER_STATE_ERROR_LINE_OFFSET
    call $load_i32
    i32.const 2
    i32.const 309
    call $assert_eq_i32

    i32.const 55296
    global.get $PARSER_STATE_ERROR_COLUMN_OFFSET
    call $load_i32
    i32.const 1
    i32.const 310
    call $assert_eq_i32
  )

  (func (export "test_parser_tokenizer_covers_number_and_eof_paths")
    i32.const 55296
    i32.const 124
    i32.const 2110
    i32.const 38
    i32.const 64
    global.get $PARSER_STATUS_DONE
    i32.const 320
    call $assert_tokenize_status

    i32.const 55296
    i32.const 125
    i32.const 2274
    i32.const 1
    i32.const 4
    global.get $PARSER_STATUS_DONE
    i32.const 321
    call $assert_tokenize_status

    i32.const 55296
    i32.const 126
    i32.const 2486
    i32.const 1
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 322
    call $assert_tokenize_status

    i32.const 55296
    i32.const 127
    i32.const 2190
    i32.const 3
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 323
    call $assert_tokenize_status

    i32.const 55296
    i32.const 128
    i32.const 2198
    i32.const 4
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 324
    call $assert_tokenize_status

    i32.const 55296
    i32.const 129
    i32.const 2206
    i32.const 4
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 325
    call $assert_tokenize_status

    i32.const 55296
    i32.const 130
    i32.const 2214
    i32.const 4
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 326
    call $assert_tokenize_status

    i32.const 55296
    i32.const 131
    i32.const 2222
    i32.const 5
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 327
    call $assert_tokenize_status

    i32.const 55296
    i32.const 132
    i32.const 2478
    i32.const 4
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 328
    call $assert_tokenize_status

    i32.const 55296
    i32.const 153
    i32.const 2494
    i32.const 0
    global.get $PARSER_STATUS_MALFORMED
    i32.const 329
    call $assert_manual_number_status

    i32.const 55296
    i32.const 154
    i32.const 2494
    i32.const 1
    global.get $PARSER_STATUS_MALFORMED
    i32.const 330
    call $assert_manual_number_status

    i32.const 55296
    i32.const 155
    i32.const 2496
    i32.const 2
    global.get $PARSER_STATUS_MALFORMED
    i32.const 331
    call $assert_manual_number_status

    i32.const 55296
    i32.const 156
    i32.const 2500
    i32.const 3
    global.get $PARSER_STATUS_DONE
    i32.const 332
    call $assert_manual_number_status

    i32.const 55296
    i32.const 157
    i32.const 2504
    i32.const 3
    global.get $PARSER_STATUS_DONE
    i32.const 333
    call $assert_manual_number_status

    i32.const 55296
    i32.const 158
    i32.const 2508
    i32.const 2
    global.get $PARSER_STATUS_MALFORMED
    i32.const 334
    call $assert_manual_number_status

    i32.const 55296
    i32.const 159
    i32.const 2512
    i32.const 3
    global.get $PARSER_STATUS_MALFORMED
    i32.const 335
    call $assert_manual_number_status

    i32.const 55296
    i32.const 160
    i32.const 2516
    i32.const 4
    global.get $PARSER_STATUS_DONE
    i32.const 336
    call $assert_manual_number_status

    i32.const 55296
    i32.const 161
    i32.const 2522
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 337
    call $assert_manual_number_status

    i32.const 55296
    i32.const 162
    i32.const 2528
    i32.const 3
    global.get $PARSER_STATUS_DONE
    i32.const 338
    call $assert_manual_number_status

    i32.const 55296
    i32.const 163
    i32.const 2532
    i32.const 4
    global.get $PARSER_STATUS_DONE
    i32.const 339
    call $assert_manual_number_status

    i32.const 55296
    i32.const 164
    i32.const 2538
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 349
    call $assert_manual_number_status

    i32.const 55296
    i32.const 165
    i32.const 2548
    i32.const 3
    global.get $PARSER_STATUS_MALFORMED
    i32.const 347
    call $assert_manual_number_status

    i32.const 55296
    i32.const 166
    i32.const 2552
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 348
    call $assert_manual_number_status
  )

  (func (export "test_parser_tokenizer_covers_keyword_and_default_errors")
    i32.const 55296
    i32.const 133
    i32.const 2278
    i32.const 4
    i32.const 4
    global.get $PARSER_STATUS_DONE
    i32.const 340
    call $assert_tokenize_status

    i32.const 55296
    i32.const 134
    i32.const 2490
    i32.const 3
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 341
    call $assert_tokenize_status

    i32.const 55296
    i32.const 135
    i32.const 2230
    i32.const 5
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 342
    call $assert_tokenize_status

    i32.const 55296
    i32.const 136
    i32.const 2470
    i32.const 4
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 343
    call $assert_tokenize_status

    i32.const 55296
    i32.const 137
    i32.const 2238
    i32.const 3
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 344
    call $assert_tokenize_status

    i32.const 64000
    i32.const 2238
    i32.const 3
    i32.const 57344
    i32.const 4
    call $parser_tokenize_bytes
    global.get $PARSER_STATUS_STATE_INVALID
    i32.const 345
    call $assert_eq_i32

    i32.const 55296
    i32.const 138
    call $parser_state_init
    i32.const 55296
    global.get $PARSER_STATE_DFA_STATE_OFFSET
    i32.const 99
    call $store_i32
    i32.const 55296
    i32.const 2238
    i32.const 3
    i32.const 57344
    i32.const 4
    call $parser_tokenize_bytes
    global.get $PARSER_STATUS_MALFORMED
    i32.const 346
    call $assert_eq_i32
  )

  (func (export "test_parser_tokenizer_covers_string_escape_paths")
    i32.const 55296
    i32.const 139
    i32.const 2170
    i32.const 11
    i32.const 4
    global.get $PARSER_STATUS_DONE
    i32.const 360
    call $assert_tokenize_status

    i32.const 55296
    i32.const 140
    i32.const 2246
    i32.const 4
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 361
    call $assert_tokenize_status

    i32.const 55296
    i32.const 141
    i32.const 2254
    i32.const 4
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 362
    call $assert_tokenize_status

    i32.const 55296
    i32.const 142
    i32.const 2262
    i32.const 7
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 363
    call $assert_tokenize_status

    i32.const 55296
    i32.const 143
    i32.const 2286
    i32.const 4
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 364
    call $assert_tokenize_status
  )

  (func (export "test_parser_tokenizer_covers_nesting_and_capacity_errors")
    i32.const 55296
    i32.const 144
    i32.const 2048
    i32.const 32
    i32.const 0
    global.get $PARSER_STATUS_YIELDED
    i32.const 380
    call $assert_tokenize_status

    i32.const 55296
    i32.const 145
    i32.const 2298
    i32.const 2
    i32.const 2
    global.get $PARSER_STATUS_YIELDED
    i32.const 381
    call $assert_tokenize_status

    i32.const 55296
    i32.const 167
    i32.const 2170
    i32.const 11
    i32.const 0
    global.get $PARSER_STATUS_YIELDED
    i32.const 389
    call $assert_tokenize_status

    i32.const 55296
    i32.const 168
    i32.const 2558
    i32.const 1
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 390
    call $assert_tokenize_status

    i32.const 55296
    i32.const 146
    i32.const 2294
    i32.const 1
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 382
    call $assert_tokenize_status

    i32.const 55296
    i32.const 147
    i32.const 2304
    i32.const 1
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 383
    call $assert_tokenize_status

    i32.const 55296
    i32.const 148
    i32.const 2308
    i32.const 1
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 384
    call $assert_tokenize_status

    i32.const 55296
    i32.const 149
    i32.const 2312
    i32.const 2
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 385
    call $assert_tokenize_status

    i32.const 55296
    i32.const 150
    i32.const 2320
    i32.const 2
    i32.const 4
    global.get $PARSER_STATUS_MALFORMED
    i32.const 386
    call $assert_tokenize_status

    i32.const 55296
    i32.const 151
    i32.const 2330
    i32.const 65
    i32.const 80
    global.get $PARSER_STATUS_MALFORMED
    i32.const 387
    call $assert_tokenize_status

    i32.const 55296
    i32.const 152
    i32.const 2400
    i32.const 65
    i32.const 80
    global.get $PARSER_STATUS_MALFORMED
    i32.const 388
    call $assert_tokenize_status
  )

  (func (export "test_parser_reads_opfs_chunks")
    i32.const 4096
    i32.const 99
    call $parser_state_init

    i32.const 4096
    i32.const 7
    call $parser_parse
    global.get $PARSER_STATUS_DONE
    i32.const 1
    call $assert_eq_i32

    i32.const 4096
    global.get $PARSER_STATE_STATUS_OFFSET
    call $field
    i32.load
    global.get $PARSER_STATUS_DONE
    i32.const 2
    call $assert_eq_i32

    i32.const 4096
    global.get $PARSER_STATE_EVENT_COUNT_OFFSET
    call $field
    i32.load
    i32.const 2
    i32.const 3
    call $assert_eq_i32

    i32.const 4096
    global.get $PARSER_STATE_DEPTH_OFFSET
    call $field
    i32.load
    i32.const 0
    i32.const 4
    call $assert_eq_i32

    i32.const 4096
    global.get $PARSER_STATE_TOKEN_KIND_OFFSET
    call $field
    i32.load
    global.get $PARSER_TOKEN_NONE
    i32.const 5
    call $assert_eq_i32

    i32.const 4096
    global.get $PARSER_STATE_EVENT_FIELD_OFFSET
    call $field
    i32.load
    global.get $PARSER_EVENT_FIELD_NONE
    i32.const 6
    call $assert_eq_i32

    i32.const 4096
    global.get $PARSER_STATE_EVENT_FIELD_MASK_OFFSET
    call $field
    i32.load
    i32.const 0
    i32.const 7
    call $assert_eq_i32

    i32.const 4096
    global.get $PARSER_STATE_CURRENT_KEY_HASH_OFFSET
    call $field
    i32.load
    global.get $PARSER_EVENT_FIELD_TS
    i32.const 8
    call $assert_eq_i32

    i32.const 4096
    global.get $PARSER_STATE_FILE_OFFSET_OFFSET
    call $field
    i64.load
    i64.const 100
    i64.gt_u
    i32.const 9
    call $assert_true

    i32.const 0x00500000
    i32.load
    global.get $PARSER_JSON_TOKEN_LBRACE
    i32.const 10
    call $assert_eq_i32

    i32.const 4096
    global.get $PARSER_STATE_OUTPUT_COUNT_OFFSET
    call $load_i32
    i32.const 0
    i32.gt_u
    i32.const 11
    call $assert_true
  )

  (func (export "test_parser_ring_refill_wraps_free_span")
    i32.const 4096
    i32.const 103
    call $parser_state_init

    i32.const 4096
    global.get $PARSER_STATE_RING_READ_OFFSET
    i32.const 4194303
    call $store_i32

    i32.const 4096
    global.get $PARSER_STATE_RING_WRITE_OFFSET
    i32.const 4194303
    call $store_i32

    i32.const 4096
    i32.const 8
    call $parser_parse
    global.get $PARSER_STATUS_DONE
    i32.const 12
    call $assert_eq_i32

    i32.const 4096
    global.get $PARSER_STATE_RING_WRITE_OFFSET
    call $load_i32
    i32.const 8
    i32.lt_u
    i32.const 13
    call $assert_true

    i32.const 4096
    global.get $PARSER_STATE_RING_COUNT_OFFSET
    call $load_i32
    i32.const 0
    i32.const 14
    call $assert_eq_i32

    i32.const 4096
    i32.const 103
    call $parser_state_init

    i32.const 4096
    global.get $PARSER_STATE_STATUS_OFFSET
    global.get $PARSER_STATUS_YIELDED
    call $store_i32

    i32.const 4096
    i32.const 1
    call $parser_parse
    global.get $PARSER_STATUS_YIELDED
    i32.const 15
    call $assert_eq_i32

    i32.const 4096
    i32.const 103
    call $parser_state_init

    i32.const 4096
    i32.const 4194304
    call $parser_parse
    global.get $PARSER_STATUS_DONE
    i32.const 16
    call $assert_eq_i32
  )

  (func (export "test_parser_rejects_mismatched_nesting")
    i32.const 8192
    i32.const 100
    call $parser_state_init

    i32.const 8192
    i32.const 4
    call $parser_parse
    global.get $PARSER_STATUS_MALFORMED
    i32.const 20
    call $assert_eq_i32
  )

  (func (export "test_parser_rejects_bad_escape")
    i32.const 12288
    i32.const 101
    call $parser_state_init

    i32.const 12288
    i32.const 5
    call $parser_parse
    global.get $PARSER_STATUS_MALFORMED
    i32.const 30
    call $assert_eq_i32
  )

  (func (export "test_parser_rejects_open_string_at_eof")
    i32.const 16384
    i32.const 102
    call $parser_state_init

    i32.const 16384
    i32.const 6
    call $parser_parse
    global.get $PARSER_STATUS_MALFORMED
    i32.const 40
    call $assert_eq_i32
  )

  (func (export "test_parser_rejects_invalid_state")
    i32.const 20480
    i32.const 8
    call $parser_parse
    global.get $PARSER_STATUS_STATE_INVALID
    i32.const 50
    call $assert_eq_i32
  )

  (func (export "test_parser_accepts_top_level_string")
    i32.const 24576
    i32.const 103
    call $parser_state_init

    i32.const 24576
    i32.const 2
    call $parser_parse
    global.get $PARSER_STATUS_DONE
    i32.const 60
    call $assert_eq_i32
  )

  (func (export "test_parser_rejects_stack_overflow")
    i32.const 28672
    i32.const 104
    call $parser_state_init

    i32.const 28672
    i32.const 65
    call $parser_parse
    global.get $PARSER_STATUS_MALFORMED
    i32.const 70
    call $assert_eq_i32
  )

  (func (export "test_parser_rejects_bad_unicode_escape")
    i32.const 32768
    i32.const 105
    call $parser_state_init

    i32.const 32768
    i32.const 9
    call $parser_parse
    global.get $PARSER_STATUS_MALFORMED
    i32.const 80
    call $assert_eq_i32
  )

  (func (export "test_parser_rejects_control_char_in_string")
    i32.const 36864
    i32.const 106
    call $parser_state_init

    i32.const 36864
    i32.const 11
    call $parser_parse
    global.get $PARSER_STATUS_MALFORMED
    i32.const 90
    call $assert_eq_i32
  )

  (func (export "test_parser_accepts_whitespace_and_default_chunk")
    i32.const 40960
    i32.const 107
    call $parser_state_init

    i32.const 40960
    i32.const 0
    call $parser_parse
    global.get $PARSER_STATUS_DONE
    i32.const 100
    call $assert_eq_i32
  )

  (func (export "test_parser_rejects_key_without_value")
    i32.const 45056
    i32.const 108
    call $parser_state_init

    i32.const 45056
    i32.const 3
    call $parser_parse
    global.get $PARSER_STATUS_MALFORMED
    i32.const 110
    call $assert_eq_i32
  )

  (func (export "test_parser_rejects_colon_without_key")
    i32.const 49152
    i32.const 109
    call $parser_state_init

    i32.const 49152
    i32.const 4
    call $parser_parse
    global.get $PARSER_STATUS_MALFORMED
    i32.const 120
    call $assert_eq_i32
  )

  (func (export "test_parser_handles_literal_and_large_chunk_request")
    i32.const 53248
    i32.const 110
    call $parser_state_init

    i32.const 53248
    i32.const 0x00500000
    call $parser_parse
    global.get $PARSER_STATUS_DONE
    i32.const 130
    call $assert_eq_i32

    i32.const 53248
    global.get $PARSER_STATE_EVENT_COUNT_OFFSET
    call $field
    i32.load
    i32.const 1
    i32.const 131
    call $assert_eq_i32
  )

  (func (export "test_parser_rejects_host_read_error")
    i32.const 57344
    i32.const 111
    call $parser_state_init

    i32.const 57344
    i32.const 8
    call $parser_parse
    global.get $PARSER_STATUS_MALFORMED
    i32.const 140
    call $assert_eq_i32
  )

  (func (export "test_parser_forced_yield_resume_matches_uninterrupted")
    (local $status i32)
    (local $turns i32)
    (local $saw_string i32)
    (local $saw_escape i32)
    (local $saw_unicode i32)
    (local $saw_number i32)

    i32.const 61440
    i32.const 99
    call $parser_state_init
    i32.const 61440
    i32.const 1
    call $parser_parse
    global.get $PARSER_STATUS_DONE
    i32.const 150
    call $assert_eq_i32

    i32.const 62000
    i32.const 99
    call $parser_state_init

    block $done
      loop $resume_loop
        i32.const 62000
        i32.const 1
        i32.const 1
        call $parser_parse_with_budget
        local.set $status

        i32.const 62000
        i32.const 62512
        global.get $PARSER_STATE_BYTES
        call $copy_bytes
        i32.const 62512
        i32.const 62000
        global.get $PARSER_STATE_BYTES
        call $copy_bytes

        i32.const 62000
        global.get $PARSER_STATE_RING_READ_OFFSET
        call $load_i32
        i32.const 0
        i32.ge_u
        i32.const 151
        call $assert_true

        i32.const 62000
        global.get $PARSER_STATE_RING_WRITE_OFFSET
        call $load_i32
        i32.const 0
        i32.ge_u
        i32.const 152
        call $assert_true

        i32.const 62000
        global.get $PARSER_STATE_RING_COUNT_OFFSET
        call $load_i32
        i32.const 1
        i32.le_u
        i32.const 153
        call $assert_true

        i32.const 62000
        global.get $PARSER_STATE_TOKEN_KIND_OFFSET
        call $load_i32
        global.get $PARSER_TOKEN_STRING
        i32.eq
        if
          i32.const 1
          local.set $saw_string
        end

        i32.const 62000
        global.get $PARSER_STATE_STRING_ESCAPE_OFFSET
        call $load_i32
        i32.const 0
        i32.ne
        if
          i32.const 1
          local.set $saw_escape
        end

        i32.const 62000
        global.get $PARSER_STATE_UNICODE_ACCUM_OFFSET
        call $load_i32
        i32.const 0
        i32.ne
        if
          i32.const 1
          local.set $saw_unicode
        end

        i32.const 62000
        global.get $PARSER_STATE_TOKEN_KIND_OFFSET
        call $load_i32
        global.get $PARSER_TOKEN_NUMBER
        i32.eq
        if
          i32.const 1
          local.set $saw_number
        end

        local.get $status
        global.get $PARSER_STATUS_YIELDED
        i32.eq
        if
          local.get $turns
          i32.const 1
          i32.add
          local.tee $turns
          i32.const 256
          i32.lt_u
          i32.const 154
          call $assert_true
          br $resume_loop
        end

        br $done
      end
    end

    local.get $status
    global.get $PARSER_STATUS_DONE
    i32.const 155
    call $assert_eq_i32

    local.get $turns
    i32.const 10
    i32.gt_u
    i32.const 156
    call $assert_true

    local.get $saw_string
    i32.const 157
    call $assert_true

    local.get $saw_escape
    i32.const 158
    call $assert_true

    local.get $saw_unicode
    i32.const 159
    call $assert_true

    local.get $saw_number
    i32.const 160
    call $assert_true

    i32.const 61440
    global.get $PARSER_STATE_FILE_OFFSET_OFFSET
    call $field
    i64.load
    i32.const 62000
    global.get $PARSER_STATE_FILE_OFFSET_OFFSET
    call $field
    i64.load
    i32.const 161
    call $assert_eq_i64

    i32.const 61440
    i32.const 62000
    i32.const 162
    call $assert_state_bytes_eq
  )

  (func (export "test_parser_default_yield_budget_can_force_turns")
    i32.const 57344
    i32.const 99
    call $parser_state_init

    i32.const 57344
    global.get $PARSER_STATE_YIELD_BUDGET_MS_OFFSET
    call $load_i32
    global.get $PARSER_DEFAULT_YIELD_BUDGET_MS
    i32.const 170
    call $assert_eq_i32

    i32.const 57344
    global.get $PARSER_STATE_YIELD_BUDGET_MS_OFFSET
    call $load_i32
    i32.const 8
    i32.le_u
    i32.const 171
    call $assert_true

    i32.const 57344
    i32.const 1
    i32.const 57344
    global.get $PARSER_STATE_YIELD_BUDGET_MS_OFFSET
    call $load_i32
    call $parser_parse_with_budget
    global.get $PARSER_STATUS_YIELDED
    i32.const 172
    call $assert_eq_i32

    i32.const 57344
    global.get $PARSER_STATE_FILE_OFFSET_OFFSET
    call $field
    i64.load
    global.get $PARSER_DEFAULT_YIELD_BUDGET_MS
    i64.extend_i32_u
    i32.const 173
    call $assert_eq_i64

    i32.const 57344
    global.get $PARSER_STATE_STATUS_OFFSET
    call $load_i32
    global.get $PARSER_STATUS_YIELDED
    i32.const 174
    call $assert_eq_i32
  )
)
