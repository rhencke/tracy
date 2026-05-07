(module
  ;; @thread shared
  (import "env" "memory" (memory $memory 1 32768))
  (import "alloc" "alloc" (func $alloc (param i32) (result i32)))

  (global $HASH_KEYS_PTR i32 (i32.const 0))
  (global $HASH_VALUES_PTR i32 (i32.const 4))
  (global $HASH_STATES_PTR i32 (i32.const 8))
  (global $HASH_CAP i32 (i32.const 12))
  (global $HASH_LEN i32 (i32.const 16))
  (global $HASH_HEADER_BYTES i32 (i32.const 20))
  (global $FNV_OFFSET i32 (i32.const -2128831035))
  (global $FNV_PRIME i32 (i32.const 16777619))

  (func $field (param $map i32) (param $offset i32) (result i32)
    local.get $map
    local.get $offset
    i32.add
  )

  (func $zero_bytes (param $ptr i32) (param $len i32)
    (local $i i32)

    block $done
      loop $loop
        local.get $i
        local.get $len
        i32.ge_u
        br_if $done

        local.get $ptr
        local.get $i
        i32.add
        i32.const 0
        i32.store8

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      end
    end
  )

  (func $normalize_cap (param $initial_cap i32) (result i32)
    (local $cap i32)

    i32.const 8
    local.set $cap

    block $done
      loop $loop
        local.get $cap
        local.get $initial_cap
        i32.ge_u
        br_if $done

        local.get $cap
        i32.const 2
        i32.mul
        local.set $cap
        br $loop
      end
    end

    local.get $cap
  )

  (func $hash_byte (param $hash i32) (param $byte i32) (result i32)
    local.get $hash
    local.get $byte
    i32.const 255
    i32.and
    i32.xor
    global.get $FNV_PRIME
    i32.mul
  )

  (func $hash_i32 (export "hash_i32") (param $key i32) (result i32)
    (local $hash i32)

    global.get $FNV_OFFSET
    local.set $hash

    local.get $hash
    local.get $key
    call $hash_byte
    local.set $hash

    local.get $hash
    local.get $key
    i32.const 8
    i32.shr_u
    call $hash_byte
    local.set $hash

    local.get $hash
    local.get $key
    i32.const 16
    i32.shr_u
    call $hash_byte
    local.set $hash

    local.get $hash
    local.get $key
    i32.const 24
    i32.shr_u
    call $hash_byte
  )

  (func $key_ptr (param $map i32) (param $index i32) (result i32)
    local.get $map
    global.get $HASH_KEYS_PTR
    call $field
    i32.load
    local.get $index
    i32.const 2
    i32.shl
    i32.add
  )

  (func $value_ptr (param $map i32) (param $index i32) (result i32)
    local.get $map
    global.get $HASH_VALUES_PTR
    call $field
    i32.load
    local.get $index
    i32.const 2
    i32.shl
    i32.add
  )

  (func $state_ptr (param $map i32) (param $index i32) (result i32)
    local.get $map
    global.get $HASH_STATES_PTR
    call $field
    i32.load
    local.get $index
    i32.add
  )

  (func $set_len (param $map i32) (param $len i32)
    local.get $map
    global.get $HASH_LEN
    call $field
    local.get $len
    i32.store
  )

  (func $insert_no_grow (param $map i32) (param $key i32) (param $value i32) (result i32)
    (local $cap i32)
    (local $index i32)
    (local $probes i32)

    local.get $map
    global.get $HASH_CAP
    call $field
    i32.load
    local.set $cap

    local.get $key
    call $hash_i32
    local.get $cap
    i32.rem_u
    local.set $index

    block $full
      loop $probe
        local.get $probes
        local.get $cap
        i32.ge_u
        br_if $full

        local.get $map
        local.get $index
        call $state_ptr
        i32.load8_u
        i32.eqz
        if
          local.get $map
          local.get $index
          call $state_ptr
          i32.const 1
          i32.store8

          local.get $map
          local.get $index
          call $key_ptr
          local.get $key
          i32.store

          local.get $map
          local.get $index
          call $value_ptr
          local.get $value
          i32.store

          local.get $map
          local.get $map
          global.get $HASH_LEN
          call $field
          i32.load
          i32.const 1
          i32.add
          call $set_len

          i32.const 1
          return
        end

        local.get $map
        local.get $index
        call $key_ptr
        i32.load
        local.get $key
        i32.eq
        if
          local.get $map
          local.get $index
          call $value_ptr
          local.get $value
          i32.store

          i32.const 1
          return
        end

        local.get $index
        i32.const 1
        i32.add
        local.get $cap
        i32.rem_u
        local.set $index

        local.get $probes
        i32.const 1
        i32.add
        local.set $probes
        br $probe
      end
    end

    i32.const 0
  )

  (func $allocate_tables (param $map i32) (param $cap i32) (result i32)
    (local $keys_ptr i32)
    (local $values_ptr i32)
    (local $states_ptr i32)
    (local $slots_bytes i32)

    local.get $cap
    i32.const 2
    i32.shl
    local.tee $slots_bytes
    i32.const 1
    i32.shl
    call $alloc
    local.tee $keys_ptr
    i32.eqz
    if
      i32.const 0
      return
    end

    local.get $keys_ptr
    local.get $slots_bytes
    i32.add
    local.set $values_ptr

    local.get $cap
    call $alloc
    local.tee $states_ptr
    i32.eqz
    if
      i32.const 0
      return
    end

    local.get $states_ptr
    local.get $cap
    call $zero_bytes

    local.get $map
    global.get $HASH_KEYS_PTR
    call $field
    local.get $keys_ptr
    i32.store

    local.get $map
    global.get $HASH_VALUES_PTR
    call $field
    local.get $values_ptr
    i32.store

    local.get $map
    global.get $HASH_STATES_PTR
    call $field
    local.get $states_ptr
    i32.store

    local.get $map
    global.get $HASH_CAP
    call $field
    local.get $cap
    i32.store

    i32.const 1
  )

  (func $grow (param $map i32) (result i32)
    (local $old_keys i32)
    (local $old_values i32)
    (local $old_states i32)
    (local $old_cap i32)
    (local $old_len i32)
    (local $i i32)

    local.get $map
    global.get $HASH_KEYS_PTR
    call $field
    i32.load
    local.set $old_keys

    local.get $map
    global.get $HASH_VALUES_PTR
    call $field
    i32.load
    local.set $old_values

    local.get $map
    global.get $HASH_STATES_PTR
    call $field
    i32.load
    local.set $old_states

    local.get $map
    global.get $HASH_CAP
    call $field
    i32.load
    local.set $old_cap

    local.get $map
    global.get $HASH_LEN
    call $field
    i32.load
    local.set $old_len

    local.get $map
    local.get $old_cap
    i32.const 2
    i32.mul
    call $allocate_tables
    i32.eqz
    if
      i32.const 0
      return
    end

    local.get $map
    i32.const 0
    call $set_len

    block $done
      loop $loop
        local.get $i
        local.get $old_cap
        i32.ge_u
        br_if $done

        local.get $old_states
        local.get $i
        i32.add
        i32.load8_u
        if
          local.get $map
          local.get $old_keys
          local.get $i
          i32.const 2
          i32.shl
          i32.add
          i32.load
          local.get $old_values
          local.get $i
          i32.const 2
          i32.shl
          i32.add
          i32.load
          call $insert_no_grow
          drop
        end

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      end
    end

    local.get $map
    global.get $HASH_LEN
    call $field
    i32.load
    local.get $old_len
    i32.eq
  )

  (func (export "hash_new") (param $initial_cap i32) (result i32)
    (local $map i32)
    (local $cap i32)

    global.get $HASH_HEADER_BYTES
    call $alloc
    local.tee $map
    i32.eqz
    if
      i32.const 0
      return
    end

    local.get $initial_cap
    call $normalize_cap
    local.set $cap

    local.get $map
    local.get $cap
    call $allocate_tables
    i32.eqz
    if
      i32.const 0
      return
    end

    local.get $map
    i32.const 0
    call $set_len

    local.get $map
  )

  (func (export "hash_put") (param $map i32) (param $key i32) (param $value i32)
    local.get $map
    i32.eqz
    if
      return
    end

    local.get $map
    global.get $HASH_LEN
    call $field
    i32.load
    i32.const 4
    i32.mul
    local.get $map
    global.get $HASH_CAP
    call $field
    i32.load
    i32.const 3
    i32.mul
    i32.ge_u
    if
      local.get $map
      call $grow
      i32.eqz
      if
        return
      end
    end

    local.get $map
    local.get $key
    local.get $value
    call $insert_no_grow
    drop
  )

  (func $find_index (param $map i32) (param $key i32) (result i32)
    (local $cap i32)
    (local $index i32)
    (local $probes i32)

    local.get $map
    i32.eqz
    if
      i32.const -1
      return
    end

    local.get $map
    global.get $HASH_CAP
    call $field
    i32.load
    local.set $cap

    local.get $key
    call $hash_i32
    local.get $cap
    i32.rem_u
    local.set $index

    block $missing
      loop $probe
        local.get $probes
        local.get $cap
        i32.ge_u
        br_if $missing

        local.get $map
        local.get $index
        call $state_ptr
        i32.load8_u
        i32.eqz
        br_if $missing

        local.get $map
        local.get $index
        call $key_ptr
        i32.load
        local.get $key
        i32.eq
        if
          local.get $index
          return
        end

        local.get $index
        i32.const 1
        i32.add
        local.get $cap
        i32.rem_u
        local.set $index

        local.get $probes
        i32.const 1
        i32.add
        local.set $probes
        br $probe
      end
    end

    i32.const -1
  )

  (func (export "hash_get") (param $map i32) (param $key i32) (result i32)
    (local $index i32)

    local.get $map
    local.get $key
    call $find_index
    local.tee $index
    i32.const -1
    i32.eq
    if
      i32.const 0
      return
    end

    local.get $map
    local.get $index
    call $value_ptr
    i32.load
  )

  (func (export "hash_has") (param $map i32) (param $key i32) (result i32)
    local.get $map
    local.get $key
    call $find_index
    i32.const -1
    i32.ne
  )
)
