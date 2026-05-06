(module
  (import "env" "memory" (memory $memory 1))
  (import "watwat" "assert_eq_i32"
    (func $check_eq_i32 (param i32) (param i32) (param i32)))
  (import "assert" "assert_eq_i32"
    (func $assert_eq_i32 (param i32) (param i32) (param i32)))
  (import "assert" "assert_eq_i64"
    (func $assert_eq_i64 (param i64) (param i64) (param i32)))
  (import "assert" "assert_eq_f64"
    (func $assert_eq_f64 (param f64) (param f64) (param f64) (param i32)))
  (import "assert" "assert_eq_str"
    (func $assert_eq_str (param i32) (param i32) (param i32) (param i32) (param i32)))
  (import "assert" "assert_true"
    (func $assert_true (param i32) (param i32)))
  (import "assert" "assert_false"
    (func $assert_false (param i32) (param i32)))

  (data (i32.const 1024) "assert test failed")
  (data (i32.const 2048) "alpha")
  (data (i32.const 2064) "alpha")
  (data (i32.const 2080) "beta")

  (func (export "message_for") (param $code i32) (result i32 i32)
    i32.const 1024
    i32.const 18
  )

  (func (export "test_assert_pass_paths")
    i32.const 7
    i32.const 7
    i32.const 1
    call $assert_eq_i32

    i64.const 9007199254740991
    i64.const 9007199254740991
    i32.const 2
    call $assert_eq_i64

    f64.const 3.14159
    f64.const 3.14160
    f64.const 0.00002
    i32.const 3
    call $assert_eq_f64

    i32.const 2048
    i32.const 5
    i32.const 2064
    i32.const 5
    i32.const 4
    call $assert_eq_str

    i32.const 1
    i32.const 5
    call $assert_true

    i32.const 0
    i32.const 6
    call $assert_false

    i32.const 1
    i32.const 1
    i32.const 7
    call $check_eq_i32
  )

  (func (export "probe_assert_eq_i32_failure")
    i32.const 1
    i32.const 2
    i32.const 8
    call $assert_eq_i32
  )

  (func (export "probe_assert_eq_i64_failure")
    i64.const 1
    i64.const 2
    i32.const 9
    call $assert_eq_i64
  )

  (func (export "probe_assert_eq_f64_failure")
    f64.const 1
    f64.const 2
    f64.const 0.001
    i32.const 10
    call $assert_eq_f64
  )

  (func (export "probe_assert_eq_str_length_failure")
    i32.const 2048
    i32.const 5
    i32.const 2080
    i32.const 4
    i32.const 11
    call $assert_eq_str
  )

  (func (export "probe_assert_true_failure")
    i32.const 0
    i32.const 12
    call $assert_true
  )

  (func (export "probe_assert_false_failure")
    i32.const 1
    i32.const 13
    call $assert_false
  )
)
