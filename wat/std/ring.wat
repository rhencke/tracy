(module
  ;; @thread shared
  (import "env" "memory" (memory $memory 1 32768))
  (import "alloc" "alloc" (func $alloc (param i32) (result i32)))

  (global $RING_BUF_PTR i32 (i32.const 0))
  (global $RING_CAP i32 (i32.const 4))
  (global $RING_READ_POS i32 (i32.const 8))
  (global $RING_WRITE_POS i32 (i32.const 12))
  (global $RING_COUNT i32 (i32.const 16))
  (global $RING_HEADER_BYTES i32 (i32.const 20))

  (func $field (param $ring i32) (param $offset i32) (result i32)
    local.get $ring
    local.get $offset
    i32.add
  )

  (func $get (param $ring i32) (param $offset i32) (result i32)
    local.get $ring
    local.get $offset
    call $field
    i32.load
  )

  (func $set (param $ring i32) (param $offset i32) (param $value i32)
    local.get $ring
    local.get $offset
    call $field
    local.get $value
    i32.store
  )

  (func $min_u (param $a i32) (param $b i32) (result i32)
    local.get $a
    local.get $b
    i32.lt_u
    if (result i32)
      local.get $a
    else
      local.get $b
    end
  )

  (func (export "ring_new") (param $byte_cap i32) (result i32)
    (local $ring i32)
    (local $buf i32)

    local.get $byte_cap
    i32.eqz
    if
      i32.const 0
      return
    end

    global.get $RING_HEADER_BYTES
    call $alloc
    local.tee $ring
    i32.eqz
    if
      i32.const 0
      return
    end

    local.get $byte_cap
    call $alloc
    local.tee $buf
    i32.eqz
    if
      i32.const 0
      return
    end

    local.get $ring
    global.get $RING_BUF_PTR
    local.get $buf
    call $set

    local.get $ring
    global.get $RING_CAP
    local.get $byte_cap
    call $set

    local.get $ring
    global.get $RING_READ_POS
    i32.const 0
    call $set

    local.get $ring
    global.get $RING_WRITE_POS
    i32.const 0
    call $set

    local.get $ring
    global.get $RING_COUNT
    i32.const 0
    call $set

    local.get $ring
  )

  (func (export "ring_write") (param $ring i32) (param $src_ptr i32) (param $len i32)
    (local $buf i32)
    (local $cap i32)
    (local $write_pos i32)
    (local $count i32)
    (local $to_write i32)
    (local $i i32)

    local.get $ring
    i32.eqz
    if
      return
    end

    local.get $ring
    global.get $RING_BUF_PTR
    call $get
    local.set $buf

    local.get $ring
    global.get $RING_CAP
    call $get
    local.set $cap

    local.get $ring
    global.get $RING_WRITE_POS
    call $get
    local.set $write_pos

    local.get $ring
    global.get $RING_COUNT
    call $get
    local.set $count

    local.get $len
    local.get $cap
    local.get $count
    i32.sub
    call $min_u
    local.set $to_write

    block $done
      loop $loop
        local.get $i
        local.get $to_write
        i32.ge_u
        br_if $done

        local.get $buf
        local.get $write_pos
        i32.add
        local.get $src_ptr
        local.get $i
        i32.add
        i32.load8_u
        i32.store8

        local.get $write_pos
        i32.const 1
        i32.add
        local.get $cap
        i32.rem_u
        local.set $write_pos

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      end
    end

    local.get $ring
    global.get $RING_WRITE_POS
    local.get $write_pos
    call $set

    local.get $ring
    global.get $RING_COUNT
    local.get $count
    local.get $to_write
    i32.add
    call $set
  )

  (func (export "ring_read") (param $ring i32) (param $dst_ptr i32) (param $len i32) (result i32)
    (local $buf i32)
    (local $cap i32)
    (local $read_pos i32)
    (local $count i32)
    (local $to_read i32)
    (local $i i32)

    local.get $ring
    i32.eqz
    if
      i32.const 0
      return
    end

    local.get $ring
    global.get $RING_BUF_PTR
    call $get
    local.set $buf

    local.get $ring
    global.get $RING_CAP
    call $get
    local.set $cap

    local.get $ring
    global.get $RING_READ_POS
    call $get
    local.set $read_pos

    local.get $ring
    global.get $RING_COUNT
    call $get
    local.set $count

    local.get $len
    local.get $count
    call $min_u
    local.set $to_read

    block $done
      loop $loop
        local.get $i
        local.get $to_read
        i32.ge_u
        br_if $done

        local.get $dst_ptr
        local.get $i
        i32.add
        local.get $buf
        local.get $read_pos
        i32.add
        i32.load8_u
        i32.store8

        local.get $read_pos
        i32.const 1
        i32.add
        local.get $cap
        i32.rem_u
        local.set $read_pos

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      end
    end

    local.get $ring
    global.get $RING_READ_POS
    local.get $read_pos
    call $set

    local.get $ring
    global.get $RING_COUNT
    local.get $count
    local.get $to_read
    i32.sub
    call $set

    local.get $to_read
  )

  (func (export "ring_available") (param $ring i32) (result i32)
    local.get $ring
    i32.eqz
    if
      i32.const 0
      return
    end

    local.get $ring
    global.get $RING_COUNT
    call $get
  )
)
