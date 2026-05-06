(module
  (import "env" "memory" (memory $memory 1 32768))
  (import "watwat" "assert_eq_i32"
    (func $assert_eq_i32 (param i32) (param i32) (param i32)))
  (import "watwat" "assert_true"
    (func $assert_true (param i32) (param i32)))
  (import "alloc" "bump_init"
    (func $bump_init (param i32) (param i32)))
  (import "pool" "pool_new"
    (func $pool_new (param i32) (param i32) (result i32)))
  (import "pool" "pool_alloc"
    (func $pool_alloc (param i32) (result i32)))
  (import "pool" "pool_free"
    (func $pool_free (param i32) (param i32)))
  (import "pool" "pool_count"
    (func $pool_count (param i32) (result i32)))

  (data (i32.const 1024) "pool test failed")

  (func (export "message_for") (param $code i32) (result i32 i32)
    i32.const 1024
    i32.const 16
  )

  (func $init_heap
    i32.const 4096
    i32.const 65536
    call $bump_init
  )

  (func (export "test_pool_new_rejects_empty_pool")
    call $init_heap

    i32.const 8
    i32.const 0
    call $pool_new
    i32.const 0
    i32.const 1
    call $assert_eq_i32

    i32.const 0
    i32.const 4
    call $pool_new
    i32.const 0
    i32.const 2
    call $assert_eq_i32
  )

  (func (export "test_pool_alloc_until_full")
    (local $pool i32)
    (local $first i32)
    (local $second i32)

    call $init_heap

    i32.const 16
    i32.const 2
    call $pool_new
    local.set $pool

    local.get $pool
    call $pool_alloc
    local.tee $first
    i32.const 0
    i32.ne
    i32.const 3
    call $assert_true

    local.get $pool
    call $pool_alloc
    local.set $second

    local.get $second
    local.get $first
    i32.const 16
    i32.add
    i32.const 4
    call $assert_eq_i32

    local.get $pool
    call $pool_alloc
    i32.const 0
    i32.const 5
    call $assert_eq_i32

    local.get $pool
    call $pool_count
    i32.const 2
    i32.const 6
    call $assert_eq_i32
  )

  (func (export "test_pool_free_recycles_slot")
    (local $pool i32)
    (local $first i32)
    (local $second i32)

    call $init_heap

    i32.const 8
    i32.const 2
    call $pool_new
    local.set $pool

    local.get $pool
    call $pool_alloc
    local.set $first

    local.get $pool
    call $pool_alloc
    local.set $second

    local.get $pool
    local.get $first
    call $pool_free

    local.get $pool
    call $pool_count
    i32.const 1
    i32.const 7
    call $assert_eq_i32

    local.get $pool
    call $pool_alloc
    local.get $first
    i32.const 8
    call $assert_eq_i32

    local.get $second
    i32.const 0
    i32.ne
    i32.const 9
    call $assert_true
  )

  (func (export "test_pool_free_ignores_invalid_pointer")
    (local $pool i32)
    (local $first i32)

    call $init_heap

    i32.const 8
    i32.const 1
    call $pool_new
    local.set $pool

    local.get $pool
    call $pool_alloc
    local.set $first

    local.get $pool
    local.get $first
    i32.const 1
    i32.add
    call $pool_free

    local.get $pool
    call $pool_count
    i32.const 1
    i32.const 10
    call $assert_eq_i32

    local.get $pool
    local.get $first
    call $pool_free

    local.get $pool
    call $pool_count
    i32.const 0
    i32.const 11
    call $assert_eq_i32
  )

  (func (export "test_pool_failure_guards")
    (local $pool i32)
    (local $slot i32)

    i32.const 0
    call $pool_alloc
    i32.const 0
    i32.const 12
    call $assert_eq_i32

    i32.const 0
    i32.const 100
    call $pool_free

    i32.const 0
    call $pool_count
    i32.const 0
    i32.const 13
    call $assert_eq_i32

    i32.const -16
    i32.const -8
    call $bump_init

    i32.const 8
    i32.const 1
    call $pool_new
    i32.const 0
    i32.const 14
    call $assert_eq_i32

    call $init_heap

    i32.const 8
    i32.const 2147483641
    call $pool_new
    i32.const 0
    i32.const 17
    call $assert_eq_i32

    i32.const 65512
    i32.const 65536
    call $bump_init

    i32.const 8
    i32.const 1
    call $pool_new
    i32.const 0
    i32.const 20
    call $assert_eq_i32

    call $init_heap

    i32.const -8
    i32.const 1
    call $pool_new
    i32.const 0
    i32.const 18
    call $assert_eq_i32

    call $init_heap

    i32.const 8
    i32.const 1
    call $pool_new
    local.set $pool

    local.get $pool
    call $pool_alloc
    local.set $slot

    local.get $pool
    local.get $slot
    i32.const 8
    i32.sub
    call $pool_free

    local.get $pool
    call $pool_count
    i32.const 1
    i32.const 15
    call $assert_eq_i32

    local.get $pool
    local.get $slot
    i32.const 8
    i32.add
    call $pool_free

    local.get $pool
    call $pool_count
    i32.const 1
    i32.const 19
    call $assert_eq_i32

    local.get $pool
    local.get $slot
    call $pool_free

    local.get $pool
    local.get $slot
    call $pool_free

    local.get $pool
    call $pool_count
    i32.const 0
    i32.const 16
    call $assert_eq_i32
  )
)
