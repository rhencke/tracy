(module
  (import "env" "memory" (memory $memory 1 32768))
  (import "watwat" "assert_eq_i32"
    (func $assert_eq_i32 (param i32) (param i32) (param i32)))
  (import "watwat" "assert_eq_str"
    (func $assert_eq_str (param i32) (param i32) (param i32) (param i32) (param i32)))
  (import "watwat" "assert_true"
    (func $assert_true (param i32) (param i32)))
  (import "alloc" "bump_init"
    (func $bump_init (param i32) (param i32)))
  (import "ring" "ring_new"
    (func $ring_new (param i32) (result i32)))
  (import "ring" "ring_write"
    (func $ring_write (param i32) (param i32) (param i32)))
  (import "ring" "ring_read"
    (func $ring_read (param i32) (param i32) (param i32) (result i32)))
  (import "ring" "ring_available"
    (func $ring_available (param i32) (result i32)))

  (data (i32.const 1024) "ring test failed")
  (data (i32.const 2048) "abcdef")
  (data (i32.const 2064) "WXYZ")

  (func (export "message_for") (param $code i32) (result i32 i32)
    i32.const 1024
    i32.const 16
  )

  (func $init_heap
    i32.const 4096
    i32.const 65536
    call $bump_init
  )

  (func (export "test_ring_empty_and_zero_capacity")
    (local $ring i32)

    call $init_heap

    i32.const 0
    call $ring_new
    i32.const 0
    i32.const 1
    call $assert_eq_i32

    i32.const 4
    call $ring_new
    local.tee $ring
    i32.const 0
    i32.ne
    i32.const 2
    call $assert_true

    local.get $ring
    call $ring_available
    i32.const 0
    i32.const 3
    call $assert_eq_i32

    local.get $ring
    i32.const 3000
    i32.const 2
    call $ring_read
    i32.const 0
    i32.const 4
    call $assert_eq_i32
  )

  (func (export "test_ring_write_read_fifo_and_partial")
    (local $ring i32)

    call $init_heap

    i32.const 4
    call $ring_new
    local.set $ring

    local.get $ring
    i32.const 2048
    i32.const 6
    call $ring_write

    local.get $ring
    call $ring_available
    i32.const 4
    i32.const 5
    call $assert_eq_i32

    local.get $ring
    i32.const 3000
    i32.const 2
    call $ring_read
    i32.const 2
    i32.const 6
    call $assert_eq_i32

    i32.const 3000
    i32.const 2
    i32.const 2048
    i32.const 2
    i32.const 7
    call $assert_eq_str

    local.get $ring
    call $ring_available
    i32.const 2
    i32.const 8
    call $assert_eq_i32
  )

  (func (export "test_ring_wraparound_preserves_order")
    (local $ring i32)

    call $init_heap

    i32.const 4
    call $ring_new
    local.set $ring

    local.get $ring
    i32.const 2048
    i32.const 4
    call $ring_write

    local.get $ring
    i32.const 3000
    i32.const 3
    call $ring_read
    drop

    local.get $ring
    i32.const 2064
    i32.const 3
    call $ring_write

    local.get $ring
    call $ring_available
    i32.const 4
    i32.const 9
    call $assert_eq_i32

    local.get $ring
    i32.const 3010
    i32.const 4
    call $ring_read
    i32.const 4
    i32.const 10
    call $assert_eq_i32

    i32.const 3010
    i32.const 1
    i32.const 2051
    i32.const 1
    i32.const 11
    call $assert_eq_str

    i32.const 3011
    i32.const 3
    i32.const 2064
    i32.const 3
    i32.const 12
    call $assert_eq_str

    local.get $ring
    call $ring_available
    i32.const 0
    i32.const 13
    call $assert_eq_i32
  )

  (func (export "test_ring_failure_guards")
    i32.const 0
    i32.const 2048
    i32.const 1
    call $ring_write

    i32.const 0
    i32.const 3000
    i32.const 1
    call $ring_read
    i32.const 0
    i32.const 14
    call $assert_eq_i32

    i32.const 0
    call $ring_available
    i32.const 0
    i32.const 15
    call $assert_eq_i32

    i32.const -16
    i32.const -8
    call $bump_init

    i32.const 4
    call $ring_new
    i32.const 0
    i32.const 16
    call $assert_eq_i32

    call $init_heap

    i32.const -8
    call $ring_new
    i32.const 0
    i32.const 17
    call $assert_eq_i32
  )
)
