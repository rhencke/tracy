(module
  (import "env" "memory" (memory $memory 1 32768))
  (import "watwat" "assert_eq_i32"
    (func $assert_eq_i32 (param i32) (param i32) (param i32)))
  (import "watwat" "assert_true"
    (func $assert_true (param i32) (param i32)))
  (import "watwat" "assert_false"
    (func $assert_false (param i32) (param i32)))
  (import "alloc" "bump_init"
    (func $bump_init (param i32) (param i32)))
  (import "hash" "hash_new"
    (func $hash_new (param i32) (result i32)))
  (import "hash" "hash_put"
    (func $hash_put (param i32) (param i32) (param i32)))
  (import "hash" "hash_get"
    (func $hash_get (param i32) (param i32) (result i32)))
  (import "hash" "hash_has"
    (func $hash_has (param i32) (param i32) (result i32)))

  (data (i32.const 1024) "hash test failed")

  (func (export "message_for") (param $code i32) (result i32 i32)
    i32.const 1024
    i32.const 16
  )

  (func $init_heap
    i32.const 4096
    i32.const 65536
    call $bump_init
  )

  (func (export "test_hash_missing_key")
    (local $map i32)

    call $init_heap

    i32.const 0
    call $hash_new
    local.set $map

    local.get $map
    i32.const 123
    call $hash_has
    i32.const 1
    call $assert_false

    local.get $map
    i32.const 123
    call $hash_get
    i32.const 0
    i32.const 2
    call $assert_eq_i32
  )

  (func (export "test_hash_put_get_and_update")
    (local $map i32)

    call $init_heap

    i32.const 4
    call $hash_new
    local.set $map

    local.get $map
    i32.const 10
    i32.const 100
    call $hash_put

    local.get $map
    i32.const 10
    call $hash_has
    i32.const 3
    call $assert_true

    local.get $map
    i32.const 10
    call $hash_get
    i32.const 100
    i32.const 4
    call $assert_eq_i32

    local.get $map
    i32.const 10
    i32.const 200
    call $hash_put

    local.get $map
    i32.const 10
    call $hash_get
    i32.const 200
    i32.const 5
    call $assert_eq_i32
  )

  (func (export "test_hash_linear_probe_collision")
    (local $map i32)

    call $init_heap

    i32.const 2
    call $hash_new
    local.set $map

    local.get $map
    i32.const 0
    i32.const 11
    call $hash_put

    local.get $map
    i32.const 8
    i32.const 22
    call $hash_put

    local.get $map
    i32.const 0
    call $hash_get
    i32.const 11
    i32.const 6
    call $assert_eq_i32

    local.get $map
    i32.const 8
    call $hash_get
    i32.const 22
    i32.const 7
    call $assert_eq_i32
  )

  (func (export "test_hash_grows_and_rehashes_entries")
    (local $map i32)
    (local $i i32)

    call $init_heap

    i32.const 1
    call $hash_new
    local.set $map

    block $done
      loop $insert
        local.get $i
        i32.const 20
        i32.ge_u
        br_if $done

        local.get $map
        local.get $i
        local.get $i
        i32.const 1000
        i32.add
        call $hash_put

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $insert
      end
    end

    local.get $map
    i32.const 0
    call $hash_get
    i32.const 1000
    i32.const 8
    call $assert_eq_i32

    local.get $map
    i32.const 19
    call $hash_get
    i32.const 1019
    i32.const 9
    call $assert_eq_i32

    local.get $map
    i32.const 99
    call $hash_has
    i32.const 10
    call $assert_false
  )

  (func (export "test_hash_failure_guards")
    (local $map i32)

    call $init_heap

    i32.const 0
    i32.const 123
    i32.const 456
    call $hash_put

    i32.const 0
    i32.const 123
    call $hash_get
    i32.const 0
    i32.const 11
    call $assert_eq_i32

    i32.const 0
    i32.const 123
    call $hash_has
    i32.const 12
    call $assert_false

    i32.const -16
    i32.const -8
    call $bump_init

    i32.const 0
    call $hash_new
    i32.const 0
    i32.const 13
    call $assert_eq_i32

    call $init_heap

    i32.const 1073741824
    call $hash_new
    i32.const 0
    i32.const 14
    call $assert_eq_i32

    call $init_heap

    i32.const 1
    call $hash_new
    local.set $map

    local.get $map
    i32.const 1
    i32.const 101
    call $hash_put

    local.get $map
    i32.const 2
    i32.const 102
    call $hash_put

    local.get $map
    i32.const 3
    i32.const 103
    call $hash_put

    local.get $map
    i32.const 4
    i32.const 104
    call $hash_put

    local.get $map
    i32.const 5
    i32.const 105
    call $hash_put

    local.get $map
    i32.const 6
    i32.const 106
    call $hash_put

    i32.const -16
    i32.const -8
    call $bump_init

    local.get $map
    i32.const 100
    i32.const 200
    call $hash_put
  )
)
