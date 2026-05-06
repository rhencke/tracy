(module
  (import "env" "memory" (memory $memory 1))
  (import "watwat" "assert_eq_i32"
    (func $assert_eq_i32 (param i32) (param i32) (param i32)))
  (import "watwat" "assert_eq_i64"
    (func $assert_eq_i64 (param i64) (param i64) (param i32)))
  (import "watwat" "assert_eq_f64"
    (func $assert_eq_f64 (param f64) (param f64) (param f64) (param i32)))
  (import "watwat" "assert_eq_str"
    (func $assert_eq_str (param i32) (param i32) (param i32) (param i32) (param i32)))
  (import "watwat" "assert_true"
    (func $assert_true (param i32) (param i32)))
  (import "watwat" "assert_false"
    (func $assert_false (param i32) (param i32)))

  (data (i32.const 1024) "watwat self-test assertion failed")
  (data (i32.const 1088) "deliberate i32 failure")
  (data (i32.const 1120) "hello watwat")
  (data (i32.const 1152) "hello watwat")

  (func (export "message_for") (param $code i32) (result i32 i32)
    local.get $code
    i32.const 42
    i32.eq
    if
      i32.const 1088
      i32.const 22
      return
    end

    i32.const 1024
    i32.const 33
  )

  (func (export "test_assert_eq_i32_pass")
    i32.const 7
    i32.const 7
    i32.const 1
    call $assert_eq_i32
  )

  (func (export "test_assert_eq_i64_pass")
    i64.const 9007199254740991
    i64.const 9007199254740991
    i32.const 2
    call $assert_eq_i64
  )

  (func (export "test_assert_eq_f64_pass")
    f64.const 3.14159
    f64.const 3.14160
    f64.const 0.00002
    i32.const 3
    call $assert_eq_f64
  )

  (func (export "test_assert_eq_str_pass")
    i32.const 1120
    i32.const 12
    i32.const 1152
    i32.const 12
    i32.const 4
    call $assert_eq_str
  )

  (func (export "test_assert_true_pass")
    i32.const 1
    i32.const 5
    call $assert_true
  )

  (func (export "test_assert_false_pass")
    i32.const 0
    i32.const 6
    call $assert_false
  )

  (func (export "probe_assert_eq_i32_failure")
    i32.const 1
    i32.const 2
    i32.const 42
    call $assert_eq_i32
  )
)
