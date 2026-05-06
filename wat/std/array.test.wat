(module
  (import "env" "memory" (memory $memory 1 32768))
  (import "watwat" "assert_eq_i32"
    (func $assert_eq_i32 (param i32) (param i32) (param i32)))
  (import "watwat" "assert_eq_f64"
    (func $assert_eq_f64 (param f64) (param f64) (param f64) (param i32)))
  (import "watwat" "assert_true"
    (func $assert_true (param i32) (param i32)))
  (import "alloc" "bump_init"
    (func $bump_init (param i32) (param i32)))
  (import "array" "arr_i32_new"
    (func $arr_i32_new (param i32) (result i32)))
  (import "array" "arr_i32_push"
    (func $arr_i32_push (param i32) (param i32)))
  (import "array" "arr_i32_at"
    (func $arr_i32_at (param i32) (param i32) (result i32)))
  (import "array" "arr_i32_len"
    (func $arr_i32_len (param i32) (result i32)))
  (import "array" "arr_f64_new"
    (func $arr_f64_new (param i32) (result i32)))
  (import "array" "arr_f64_push"
    (func $arr_f64_push (param i32) (param f64)))
  (import "array" "arr_f64_at"
    (func $arr_f64_at (param i32) (param i32) (result f64)))
  (import "array" "arr_f64_len"
    (func $arr_f64_len (param i32) (result i32)))
  (import "array" "arr_u8_new"
    (func $arr_u8_new (param i32) (result i32)))
  (import "array" "arr_u8_push"
    (func $arr_u8_push (param i32) (param i32)))
  (import "array" "arr_u8_at"
    (func $arr_u8_at (param i32) (param i32) (result i32)))
  (import "array" "arr_u8_len"
    (func $arr_u8_len (param i32) (result i32)))

  (data (i32.const 1024) "array test failed")

  (func (export "message_for") (param $code i32) (result i32 i32)
    i32.const 1024
    i32.const 17
  )

  (func $init_heap
    i32.const 4096
    i32.const 65536
    call $bump_init
  )

  (func (export "test_i32_array_empty_and_bounds")
    (local $arr i32)

    call $init_heap

    i32.const 0
    call $arr_i32_new
    local.tee $arr
    i32.const 0
    i32.ne
    i32.const 1
    call $assert_true

    local.get $arr
    call $arr_i32_len
    i32.const 0
    i32.const 2
    call $assert_eq_i32

    local.get $arr
    i32.const 0
    call $arr_i32_at
    i32.const 0
    i32.const 3
    call $assert_eq_i32
  )

  (func (export "test_i32_array_push_order_and_growth")
    (local $arr i32)

    call $init_heap

    i32.const 1
    call $arr_i32_new
    local.set $arr

    local.get $arr
    i32.const 11
    call $arr_i32_push

    local.get $arr
    i32.const 22
    call $arr_i32_push

    local.get $arr
    i32.const -7
    call $arr_i32_push

    local.get $arr
    call $arr_i32_len
    i32.const 3
    i32.const 4
    call $assert_eq_i32

    local.get $arr
    i32.const 0
    call $arr_i32_at
    i32.const 11
    i32.const 5
    call $assert_eq_i32

    local.get $arr
    i32.const 1
    call $arr_i32_at
    i32.const 22
    i32.const 6
    call $assert_eq_i32

    local.get $arr
    i32.const 2
    call $arr_i32_at
    i32.const -7
    i32.const 7
    call $assert_eq_i32
  )

  (func (export "test_f64_array_push_order_and_bounds")
    (local $arr i32)

    call $init_heap

    i32.const 0
    call $arr_f64_new
    local.set $arr

    local.get $arr
    f64.const 1.25
    call $arr_f64_push

    local.get $arr
    f64.const -2.5
    call $arr_f64_push

    local.get $arr
    call $arr_f64_len
    i32.const 2
    i32.const 8
    call $assert_eq_i32

    local.get $arr
    i32.const 0
    call $arr_f64_at
    f64.const 1.25
    f64.const 0.000001
    i32.const 9
    call $assert_eq_f64

    local.get $arr
    i32.const 1
    call $arr_f64_at
    f64.const -2.5
    f64.const 0.000001
    i32.const 10
    call $assert_eq_f64

    local.get $arr
    i32.const 2
    call $arr_f64_at
    f64.const 0
    f64.const 0.000001
    i32.const 11
    call $assert_eq_f64
  )

  (func (export "test_u8_array_push_masks_to_byte")
    (local $arr i32)

    call $init_heap

    i32.const 1
    call $arr_u8_new
    local.set $arr

    local.get $arr
    i32.const 255
    call $arr_u8_push

    local.get $arr
    i32.const 256
    call $arr_u8_push

    local.get $arr
    call $arr_u8_len
    i32.const 2
    i32.const 12
    call $assert_eq_i32

    local.get $arr
    i32.const 0
    call $arr_u8_at
    i32.const 255
    i32.const 13
    call $assert_eq_i32

    local.get $arr
    i32.const 1
    call $arr_u8_at
    i32.const 0
    i32.const 14
    call $assert_eq_i32

    local.get $arr
    i32.const 4
    call $arr_u8_at
    i32.const 0
    i32.const 15
    call $assert_eq_i32
  )
)
