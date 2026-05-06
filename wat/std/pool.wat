(module
  (import "env" "memory" (memory $memory 1 32768))
  (import "alloc" "alloc" (func $alloc (param i32) (result i32)))

  (global $POOL_ELEM_SIZE i32 (i32.const 0))
  (global $POOL_CAPACITY i32 (i32.const 4))
  (global $POOL_SLAB_PTR i32 (i32.const 8))
  (global $POOL_BITMAP_PTR i32 (i32.const 12))
  (global $POOL_IN_USE i32 (i32.const 16))
  (global $POOL_BITMAP_BYTES i32 (i32.const 20))
  (global $POOL_HEADER_BYTES i32 (i32.const 24))

  (func $align8 (param $value i32) (result i32)
    local.get $value
    i32.const 7
    i32.add
    i32.const -8
    i32.and
  )

  (func $pool_field (param $pool i32) (param $offset i32) (result i32)
    local.get $pool
    local.get $offset
    i32.add
  )

  (func $bitmap_byte_ptr (param $pool i32) (param $index i32) (result i32)
    local.get $pool
    global.get $POOL_BITMAP_PTR
    call $pool_field
    i32.load
    local.get $index
    i32.const 3
    i32.shr_u
    i32.add
  )

  (func $bitmap_mask (param $index i32) (result i32)
    i32.const 1
    local.get $index
    i32.const 7
    i32.and
    i32.shl
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

  (func (export "pool_new") (param $elem_size i32) (param $capacity i32) (result i32)
    (local $pool i32)
    (local $slot_size i32)
    (local $bitmap_bytes i32)
    (local $bitmap_ptr i32)
    (local $slab_ptr i32)

    local.get $elem_size
    i32.eqz
    local.get $capacity
    i32.eqz
    i32.or
    if
      i32.const 0
      return
    end

    local.get $elem_size
    call $align8
    local.set $slot_size

    local.get $capacity
    i32.const 7
    i32.add
    i32.const 3
    i32.shr_u
    local.set $bitmap_bytes

    global.get $POOL_HEADER_BYTES
    call $alloc
    local.tee $pool
    i32.eqz
    if
      i32.const 0
      return
    end

    local.get $bitmap_bytes
    call $alloc
    local.tee $bitmap_ptr
    i32.eqz
    if
      i32.const 0
      return
    end

    local.get $slot_size
    local.get $capacity
    i32.mul
    call $alloc
    local.tee $slab_ptr
    i32.eqz
    if
      i32.const 0
      return
    end

    local.get $bitmap_ptr
    local.get $bitmap_bytes
    call $zero_bytes

    local.get $pool
    global.get $POOL_ELEM_SIZE
    call $pool_field
    local.get $slot_size
    i32.store

    local.get $pool
    global.get $POOL_CAPACITY
    call $pool_field
    local.get $capacity
    i32.store

    local.get $pool
    global.get $POOL_SLAB_PTR
    call $pool_field
    local.get $slab_ptr
    i32.store

    local.get $pool
    global.get $POOL_BITMAP_PTR
    call $pool_field
    local.get $bitmap_ptr
    i32.store

    local.get $pool
    global.get $POOL_IN_USE
    call $pool_field
    i32.const 0
    i32.store

    local.get $pool
    global.get $POOL_BITMAP_BYTES
    call $pool_field
    local.get $bitmap_bytes
    i32.store

    local.get $pool
  )

  (func (export "pool_alloc") (param $pool i32) (result i32)
    (local $capacity i32)
    (local $slot_size i32)
    (local $slab_ptr i32)
    (local $index i32)
    (local $byte_ptr i32)
    (local $mask i32)
    (local $byte i32)

    local.get $pool
    i32.eqz
    if
      i32.const 0
      return
    end

    local.get $pool
    global.get $POOL_CAPACITY
    call $pool_field
    i32.load
    local.set $capacity

    local.get $pool
    global.get $POOL_ELEM_SIZE
    call $pool_field
    i32.load
    local.set $slot_size

    local.get $pool
    global.get $POOL_SLAB_PTR
    call $pool_field
    i32.load
    local.set $slab_ptr

    block $full
      loop $scan
        local.get $index
        local.get $capacity
        i32.ge_u
        br_if $full

        local.get $pool
        local.get $index
        call $bitmap_byte_ptr
        local.set $byte_ptr

        local.get $index
        call $bitmap_mask
        local.set $mask

        local.get $byte_ptr
        i32.load8_u
        local.tee $byte
        local.get $mask
        i32.and
        i32.eqz
        if
          local.get $byte_ptr
          local.get $byte
          local.get $mask
          i32.or
          i32.store8

          local.get $pool
          global.get $POOL_IN_USE
          call $pool_field
          local.get $pool
          global.get $POOL_IN_USE
          call $pool_field
          i32.load
          i32.const 1
          i32.add
          i32.store

          local.get $slab_ptr
          local.get $index
          local.get $slot_size
          i32.mul
          i32.add
          return
        end

        local.get $index
        i32.const 1
        i32.add
        local.set $index
        br $scan
      end
    end

    i32.const 0
  )

  (func (export "pool_free") (param $pool i32) (param $ptr i32)
    (local $capacity i32)
    (local $slot_size i32)
    (local $slab_ptr i32)
    (local $offset i32)
    (local $index i32)
    (local $byte_ptr i32)
    (local $mask i32)
    (local $byte i32)

    local.get $pool
    i32.eqz
    if
      return
    end

    local.get $pool
    global.get $POOL_CAPACITY
    call $pool_field
    i32.load
    local.set $capacity

    local.get $pool
    global.get $POOL_ELEM_SIZE
    call $pool_field
    i32.load
    local.set $slot_size

    local.get $pool
    global.get $POOL_SLAB_PTR
    call $pool_field
    i32.load
    local.set $slab_ptr

    local.get $ptr
    local.get $slab_ptr
    i32.lt_u
    if
      return
    end

    local.get $ptr
    local.get $slab_ptr
    i32.sub
    local.set $offset

    local.get $offset
    local.get $slot_size
    i32.rem_u
    if
      return
    end

    local.get $offset
    local.get $slot_size
    i32.div_u
    local.tee $index
    local.get $capacity
    i32.ge_u
    if
      return
    end

    local.get $pool
    local.get $index
    call $bitmap_byte_ptr
    local.set $byte_ptr

    local.get $index
    call $bitmap_mask
    local.set $mask

    local.get $byte_ptr
    i32.load8_u
    local.tee $byte
    local.get $mask
    i32.and
    i32.eqz
    if
      return
    end

    local.get $byte_ptr
    local.get $byte
    local.get $mask
    i32.const -1
    i32.xor
    i32.and
    i32.store8

    local.get $pool
    global.get $POOL_IN_USE
    call $pool_field
    local.get $pool
    global.get $POOL_IN_USE
    call $pool_field
    i32.load
    i32.const 1
    i32.sub
    i32.store
  )

  (func (export "pool_count") (param $pool i32) (result i32)
    local.get $pool
    i32.eqz
    if
      i32.const 0
      return
    end

    local.get $pool
    global.get $POOL_IN_USE
    call $pool_field
    i32.load
  )
)
