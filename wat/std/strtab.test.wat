(module
  (import "env" "memory" (memory $memory 1 32768))
  (import "watwat" "assert_eq_i32"
    (func $assert_eq_i32 (param i32) (param i32) (param i32)))
  (import "watwat" "assert_eq_str"
    (func $assert_eq_str (param i32) (param i32) (param i32) (param i32) (param i32)))
  (import "watwat" "assert_true"
    (func $assert_true (param i32) (param i32)))
  (import "watwat" "assert_false"
    (func $assert_false (param i32) (param i32)))
  (import "alloc" "bump_init"
    (func $bump_init (param i32) (param i32)))
  (import "strtab" "strtab_intern"
    (func $strtab_intern (param i32) (param i32) (result i32)))
  (import "strtab" "strtab_get"
    (func $strtab_get (param i32) (result i32 i32)))
  (import "strtab" "strtab_eq"
    (func $strtab_eq (param i32) (param i32) (result i32)))

  (data (i32.const 1024) "strtab test failed")
  (data (i32.const 2048) "alpha")
  (data (i32.const 2064) "alpha")
  (data (i32.const 2080) "beta")
  (data (i32.const 2096) "azspuz")
  (data (i32.const 2112) "bwjqdo")
  (data (i32.const 2128) "cdefghijklmn")

  (func (export "message_for") (param $code i32) (result i32 i32)
    i32.const 1024
    i32.const 18
  )

  (func (export "test_strtab_init_failure")
    i32.const -16
    i32.const -8
    call $bump_init

    i32.const 2048
    i32.const 5
    call $strtab_intern
    i32.const 0
    i32.const 11
    call $assert_eq_i32
  )

  (func (export "test_strtab_intern_get_and_eq")
    (local $alpha_a i32)
    (local $alpha_b i32)
    (local $beta i32)
    (local $empty i32)
    (local $got_ptr i32)
    (local $got_len i32)

    i32.const 4096
    i32.const 65536
    call $bump_init

    i32.const 2048
    i32.const 5
    call $strtab_intern
    local.set $alpha_a

    i32.const 2064
    i32.const 5
    call $strtab_intern
    local.set $alpha_b

    i32.const 2080
    i32.const 4
    call $strtab_intern
    local.set $beta

    i32.const 2048
    i32.const 0
    call $strtab_intern
    local.set $empty

    local.get $alpha_a
    i32.const 0
    i32.ne
    i32.const 1
    call $assert_true

    local.get $alpha_a
    local.get $alpha_b
    i32.const 2
    call $assert_eq_i32

    local.get $alpha_a
    local.get $beta
    call $strtab_eq
    i32.const 3
    call $assert_false

    local.get $alpha_a
    local.get $alpha_b
    call $strtab_eq
    i32.const 4
    call $assert_true

    local.get $alpha_a
    call $strtab_get
    local.set $got_len
    local.set $got_ptr

    local.get $got_ptr
    local.get $got_len
    i32.const 2048
    i32.const 5
    i32.const 5
    call $assert_eq_str

    local.get $got_ptr
    i32.const 2048
    i32.ne
    i32.const 10
    call $assert_true

    local.get $beta
    call $strtab_get
    local.set $got_len
    local.set $got_ptr

    local.get $got_ptr
    local.get $got_len
    i32.const 2080
    i32.const 4
    i32.const 6
    call $assert_eq_str

    local.get $empty
    call $strtab_get
    local.set $got_len
    local.set $got_ptr

    local.get $got_len
    i32.const 0
    i32.const 7
    call $assert_eq_i32

    i32.const 999
    call $strtab_get
    local.set $got_len
    local.set $got_ptr

    local.get $got_ptr
    i32.const 0
    i32.const 8
    call $assert_eq_i32

    local.get $got_len
    i32.const 0
    i32.const 9
    call $assert_eq_i32
  )

  (func (export "test_strtab_collision_and_alloc_failure")
    i32.const 2096
    i32.const 6
    call $strtab_intern
    drop

    i32.const 2112
    i32.const 6
    call $strtab_intern
    drop

    i32.const -16
    i32.const -8
    call $bump_init

    i32.const 2128
    i32.const 1
    call $strtab_intern
    i32.const 0
    i32.const 12
    call $assert_eq_i32
  )

  (func (export "test_strtab_grow_failure")
    (local $i i32)

    i32.const 4096
    i32.const 65536
    call $bump_init

    block $done
      loop $intern
        local.get $i
        i32.const 11
        i32.ge_u
        br_if $done

        i32.const 2128
        local.get $i
        i32.add
        i32.const 1
        call $strtab_intern
        drop

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $intern
      end
    end

    i32.const -16
    i32.const -8
    call $bump_init

    i32.const 2048
    i32.const 4
    call $strtab_intern
    i32.const 0
    i32.const 13
    call $assert_eq_i32
  )
)
