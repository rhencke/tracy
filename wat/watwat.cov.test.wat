(module
  (import "env" "memory" (memory $memory 1))
  (import "watwat" "assert_eq_i32"
    (func $assert_eq_i32 (param i32) (param i32) (param i32)))

  (data (i32.const 1024) "coverage self-test failed")

  (func (export "message_for") (param $code i32) (result i32 i32)
    i32.const 1024
    i32.const 25
  )

  (func $entry_value (result i32)
    i32.const 42
  )

  (func $folded_if_else_value (param $use_then i32) (result i32)
    (if (result i32)
      (local.get $use_then)
      (then
        (i32.const 7))
      (else
        (i32.const 9)))
  )

  (func $flat_post_branch_value (param $take_branch i32) (result i32)
    (block $done
      local.get $take_branch
      br_if $done

      i32.const 11
      return

      i32.const 99
      return
    )

    i32.const 13
  )

  (func (export "test_function_entry_runs")
    call $entry_value
    i32.const 42
    i32.const 1
    call $assert_eq_i32
  )

  (func (export "test_if_else_arms_run")
    i32.const 1
    call $folded_if_else_value
    i32.const 7
    i32.const 2
    call $assert_eq_i32

    i32.const 0
    call $folded_if_else_value
    i32.const 9
    i32.const 3
    call $assert_eq_i32
  )

  (func (export "test_br_if_post_branch_fallthrough_runs")
    i32.const 0
    call $flat_post_branch_value
    i32.const 11
    i32.const 4
    call $assert_eq_i32

    i32.const 1
    call $flat_post_branch_value
    i32.const 13
    i32.const 5
    call $assert_eq_i32
  )
)
