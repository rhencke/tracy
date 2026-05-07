(module
  ;; @thread shared
  (import "env" "memory" (memory $memory 1 32768))
  (import "alloc" "alloc" (func $alloc (param i32) (result i32)))

  (global $ARR_DATA_PTR i32 (i32.const 0))
  (global $ARR_LEN i32 (i32.const 4))
  (global $ARR_CAP i32 (i32.const 8))
  (global $ARR_ELEM_SIZE i32 (i32.const 12))
  (global $ARR_HEADER_BYTES i32 (i32.const 16))

  (func $field (param $arr i32) (param $offset i32) (result i32)
    local.get $arr
    local.get $offset
    i32.add
  )

  (func $copy_bytes (param $dst i32) (param $src i32) (param $len i32)
    (local $i i32)

    block $done
      loop $loop
        local.get $i
        local.get $len
        i32.ge_u
        br_if $done

        local.get $dst
        local.get $i
        i32.add
        local.get $src
        local.get $i
        i32.add
        i32.load8_u
        i32.store8

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      end
    end
  )

  (func $array_new (param $initial_cap i32) (param $elem_size i32) (result i32)
    (local $arr i32)
    (local $data_ptr i32)

    global.get $ARR_HEADER_BYTES
    call $alloc
    local.tee $arr
    i32.eqz
    if
      i32.const 0
      return
    end

    local.get $initial_cap
    if
      local.get $initial_cap
      local.get $elem_size
      i32.mul
      call $alloc
      local.tee $data_ptr
      i32.eqz
      if
        i32.const 0
        return
      end
    end

    local.get $arr
    global.get $ARR_DATA_PTR
    call $field
    local.get $data_ptr
    i32.store

    local.get $arr
    global.get $ARR_LEN
    call $field
    i32.const 0
    i32.store

    local.get $arr
    global.get $ARR_CAP
    call $field
    local.get $initial_cap
    i32.store

    local.get $arr
    global.get $ARR_ELEM_SIZE
    call $field
    local.get $elem_size
    i32.store

    local.get $arr
  )

  (func $ensure_push_capacity (param $arr i32) (result i32)
    (local $len i32)
    (local $cap i32)
    (local $elem_size i32)
    (local $old_data i32)
    (local $new_data i32)
    (local $new_cap i32)

    local.get $arr
    global.get $ARR_LEN
    call $field
    i32.load
    local.set $len

    local.get $arr
    global.get $ARR_CAP
    call $field
    i32.load
    local.set $cap

    local.get $len
    local.get $cap
    i32.lt_u
    if
      i32.const 1
      return
    end

    local.get $cap
    if (result i32)
      local.get $cap
      i32.const 2
      i32.mul
    else
      i32.const 1
    end
    local.set $new_cap

    local.get $arr
    global.get $ARR_ELEM_SIZE
    call $field
    i32.load
    local.set $elem_size

    local.get $arr
    global.get $ARR_DATA_PTR
    call $field
    i32.load
    local.set $old_data

    local.get $new_cap
    local.get $elem_size
    i32.mul
    call $alloc
    local.tee $new_data
    i32.eqz
    if
      i32.const 0
      return
    end

    local.get $new_data
    local.get $old_data
    local.get $len
    local.get $elem_size
    i32.mul
    call $copy_bytes

    local.get $arr
    global.get $ARR_DATA_PTR
    call $field
    local.get $new_data
    i32.store

    local.get $arr
    global.get $ARR_CAP
    call $field
    local.get $new_cap
    i32.store

    i32.const 1
  )

  (func $push_i32 (param $arr i32) (param $value i32)
    (local $data_ptr i32)
    (local $len i32)

    local.get $arr
    call $ensure_push_capacity
    i32.eqz
    if
      return
    end

    local.get $arr
    global.get $ARR_DATA_PTR
    call $field
    i32.load
    local.set $data_ptr

    local.get $arr
    global.get $ARR_LEN
    call $field
    i32.load
    local.set $len

    local.get $data_ptr
    local.get $len
    i32.const 2
    i32.shl
    i32.add
    local.get $value
    i32.store

    local.get $arr
    global.get $ARR_LEN
    call $field
    local.get $len
    i32.const 1
    i32.add
    i32.store
  )

  (func $push_f64 (param $arr i32) (param $value f64)
    (local $data_ptr i32)
    (local $len i32)

    local.get $arr
    call $ensure_push_capacity
    i32.eqz
    if
      return
    end

    local.get $arr
    global.get $ARR_DATA_PTR
    call $field
    i32.load
    local.set $data_ptr

    local.get $arr
    global.get $ARR_LEN
    call $field
    i32.load
    local.set $len

    local.get $data_ptr
    local.get $len
    i32.const 3
    i32.shl
    i32.add
    local.get $value
    f64.store

    local.get $arr
    global.get $ARR_LEN
    call $field
    local.get $len
    i32.const 1
    i32.add
    i32.store
  )

  (func $push_u8 (param $arr i32) (param $value i32)
    (local $data_ptr i32)
    (local $len i32)

    local.get $arr
    call $ensure_push_capacity
    i32.eqz
    if
      return
    end

    local.get $arr
    global.get $ARR_DATA_PTR
    call $field
    i32.load
    local.set $data_ptr

    local.get $arr
    global.get $ARR_LEN
    call $field
    i32.load
    local.set $len

    local.get $data_ptr
    local.get $len
    i32.add
    local.get $value
    i32.store8

    local.get $arr
    global.get $ARR_LEN
    call $field
    local.get $len
    i32.const 1
    i32.add
    i32.store
  )

  (func $array_len (param $arr i32) (result i32)
    local.get $arr
    i32.eqz
    if
      i32.const 0
      return
    end

    local.get $arr
    global.get $ARR_LEN
    call $field
    i32.load
  )

  (func (export "arr_i32_new") (param $initial_cap i32) (result i32)
    local.get $initial_cap
    i32.const 4
    call $array_new
  )

  (func (export "arr_i32_push") (param $arr i32) (param $value i32)
    local.get $arr
    local.get $value
    call $push_i32
  )

  (func (export "arr_i32_at") (param $arr i32) (param $index i32) (result i32)
    local.get $index
    local.get $arr
    call $array_len
    i32.ge_u
    if
      i32.const 0
      return
    end

    local.get $arr
    global.get $ARR_DATA_PTR
    call $field
    i32.load
    local.get $index
    i32.const 2
    i32.shl
    i32.add
    i32.load
  )

  (func (export "arr_i32_len") (param $arr i32) (result i32)
    local.get $arr
    call $array_len
  )

  (func (export "arr_f64_new") (param $initial_cap i32) (result i32)
    local.get $initial_cap
    i32.const 8
    call $array_new
  )

  (func (export "arr_f64_push") (param $arr i32) (param $value f64)
    local.get $arr
    local.get $value
    call $push_f64
  )

  (func (export "arr_f64_at") (param $arr i32) (param $index i32) (result f64)
    local.get $index
    local.get $arr
    call $array_len
    i32.ge_u
    if
      f64.const 0
      return
    end

    local.get $arr
    global.get $ARR_DATA_PTR
    call $field
    i32.load
    local.get $index
    i32.const 3
    i32.shl
    i32.add
    f64.load
  )

  (func (export "arr_f64_len") (param $arr i32) (result i32)
    local.get $arr
    call $array_len
  )

  (func (export "arr_u8_new") (param $initial_cap i32) (result i32)
    local.get $initial_cap
    i32.const 1
    call $array_new
  )

  (func (export "arr_u8_push") (param $arr i32) (param $value i32)
    local.get $arr
    local.get $value
    call $push_u8
  )

  (func (export "arr_u8_at") (param $arr i32) (param $index i32) (result i32)
    local.get $index
    local.get $arr
    call $array_len
    i32.ge_u
    if
      i32.const 0
      return
    end

    local.get $arr
    global.get $ARR_DATA_PTR
    call $field
    i32.load
    local.get $index
    i32.add
    i32.load8_u
  )

  (func (export "arr_u8_len") (param $arr i32) (result i32)
    local.get $arr
    call $array_len
  )
)
