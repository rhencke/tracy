(module
  (import "env" "memory" (memory $memory 1 32768))
  (import "watwat" "assert_eq_i32"
    (func $assert_eq_i32 (param i32) (param i32) (param i32)))
  (import "watwat" "assert_true"
    (func $assert_true (param i32) (param i32)))
  (import "alloc" "bump_init"
    (func $bump_init (param i32) (param i32)))
  (import "alloc" "alloc"
    (func $alloc (param i32) (result i32)))
  (import "alloc" "checkpoint"
    (func $checkpoint (result i32)))
  (import "alloc" "reset_to"
    (func $reset_to (param i32)))

  (data (i32.const 1024) "alloc test failed")

  (func (export "message_for") (param $code i32) (result i32 i32)
    i32.const 1024
    i32.const 17
  )

  (func (export "test_alloc_aligns_to_8_bytes")
    (local $ptr i32)

    i32.const 1001
    i32.const 2048
    call $bump_init

    i32.const 1
    call $alloc
    local.tee $ptr
    i32.const 1008
    i32.const 1
    call $assert_eq_i32

    local.get $ptr
    i32.const 7
    i32.and
    i32.const 0
    i32.const 2
    call $assert_eq_i32
  )

  (func (export "test_alloc_rounds_next_pointer")
    i32.const 2048
    i32.const 4096
    call $bump_init

    i32.const 3
    call $alloc
    i32.const 2048
    i32.const 3
    call $assert_eq_i32

    i32.const 1
    call $alloc
    i32.const 2056
    i32.const 4
    call $assert_eq_i32
  )

  (func (export "test_alloc_zero_does_not_advance")
    i32.const 3001
    i32.const 4096
    call $bump_init

    i32.const 0
    call $alloc
    i32.const 3008
    i32.const 5
    call $assert_eq_i32

    i32.const 1
    call $alloc
    i32.const 3008
    i32.const 6
    call $assert_eq_i32
  )

  (func (export "test_checkpoint_and_reset_reuse_space")
    (local $label i32)

    i32.const 4096
    i32.const 8192
    call $bump_init

    i32.const 8
    call $alloc
    i32.const 4096
    i32.const 7
    call $assert_eq_i32

    call $checkpoint
    local.set $label

    i32.const 16
    call $alloc
    drop

    local.get $label
    call $reset_to

    i32.const 8
    call $alloc
    local.get $label
    i32.const 8
    call $assert_eq_i32
  )

  (func (export "test_alloc_grows_linear_memory")
    (local $before_pages i32)
    (local $current_bytes i32)
    (local $ptr i32)

    memory.size
    local.set $before_pages

    local.get $before_pages
    i32.const 65536
    i32.mul
    local.set $current_bytes

    local.get $current_bytes
    i32.const 16
    i32.sub
    local.get $current_bytes
    call $bump_init

    i32.const 64
    call $alloc
    local.set $ptr

    local.get $ptr
    local.get $current_bytes
    i32.const 16
    i32.sub
    i32.const 9
    call $assert_eq_i32

    memory.size
    local.get $before_pages
    i32.gt_u
    i32.const 10
    call $assert_true
  )
)
