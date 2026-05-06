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
  (import "parser_state" "parser_state_init"
    (func $parser_state_init (param i32) (param i32)))
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
  (import "parser_state" "PARSER_STATE_EVENT_FIELD_OFFSET" (global $PARSER_STATE_EVENT_FIELD_OFFSET i32))
  (import "parser_state" "PARSER_STATE_EVENT_FIELD_MASK_OFFSET" (global $PARSER_STATE_EVENT_FIELD_MASK_OFFSET i32))
  (import "parser_state" "PARSER_STATE_CURRENT_KEY_HASH_OFFSET" (global $PARSER_STATE_CURRENT_KEY_HASH_OFFSET i32))
  (import "parser_state" "PARSER_STATE_EVENT_COUNT_OFFSET" (global $PARSER_STATE_EVENT_COUNT_OFFSET i32))
  (import "parser_state" "PARSER_DEFAULT_YIELD_BUDGET_MS" (global $PARSER_DEFAULT_YIELD_BUDGET_MS i32))
  (import "parser_state" "PARSER_STATUS_DONE" (global $PARSER_STATUS_DONE i32))
  (import "parser_state" "PARSER_STATUS_YIELDED" (global $PARSER_STATUS_YIELDED i32))
  (import "parser_state" "PARSER_STATUS_MALFORMED" (global $PARSER_STATUS_MALFORMED i32))
  (import "parser_state" "PARSER_STATUS_STATE_INVALID" (global $PARSER_STATUS_STATE_INVALID i32))
  (import "parser_state" "PARSER_TOKEN_NONE" (global $PARSER_TOKEN_NONE i32))
  (import "parser_state" "PARSER_TOKEN_STRING" (global $PARSER_TOKEN_STRING i32))
  (import "parser_state" "PARSER_TOKEN_NUMBER" (global $PARSER_TOKEN_NUMBER i32))
  (import "parser_state" "PARSER_EVENT_FIELD_NONE" (global $PARSER_EVENT_FIELD_NONE i32))
  (import "parser_state" "PARSER_EVENT_FIELD_TS" (global $PARSER_EVENT_FIELD_TS i32))

  (data (i32.const 1024) "parser test failed")

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
