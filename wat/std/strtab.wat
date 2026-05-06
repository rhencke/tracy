(module
  (import "env" "memory" (memory $memory 1 32768))
  (import "alloc" "alloc" (func $alloc (param i32) (result i32)))
  (import "hash" "hash_new" (func $hash_new (param i32) (result i32)))
  (import "hash" "hash_put" (func $hash_put (param i32) (param i32) (param i32)))
  (import "hash" "hash_get" (func $hash_get (param i32) (param i32) (result i32)))

  (global $FNV_OFFSET i32 (i32.const -2128831035))
  (global $FNV_PRIME i32 (i32.const 16777619))
  (global $ENTRY_START_CAP i32 (i32.const 16))

  (global $index (mut i32) (i32.const 0))
  (global $ptrs (mut i32) (i32.const 0))
  (global $lens (mut i32) (i32.const 0))
  (global $hashes (mut i32) (i32.const 0))
  (global $nexts (mut i32) (i32.const 0))
  (global $count (mut i32) (i32.const 0))
  (global $capacity (mut i32) (i32.const 0))

  (func $hash_byte (param $hash i32) (param $byte i32) (result i32)
    local.get $hash
    local.get $byte
    i32.const 255
    i32.and
    i32.xor
    global.get $FNV_PRIME
    i32.mul
  )

  (func $hash_bytes (param $ptr i32) (param $len i32) (result i32)
    (local $hash i32)
    (local $i i32)

    global.get $FNV_OFFSET
    local.set $hash

    block $done
      loop $loop
        local.get $i
        local.get $len
        i32.ge_u
        br_if $done

        local.get $hash
        local.get $ptr
        local.get $i
        i32.add
        i32.load8_u
        call $hash_byte
        local.set $hash

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      end
    end

    local.get $hash
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

  (func $bytes_eq (param $a_ptr i32) (param $b_ptr i32) (param $len i32) (result i32)
    (local $i i32)

    block $same
      loop $loop
        local.get $i
        local.get $len
        i32.ge_u
        br_if $same

        local.get $a_ptr
        local.get $i
        i32.add
        i32.load8_u
        local.get $b_ptr
        local.get $i
        i32.add
        i32.load8_u
        i32.ne
        if
          i32.const 0
          return
        end

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $loop
      end
    end

    i32.const 1
  )

  (func $entry_ptr (param $base i32) (param $id i32) (result i32)
    local.get $base
    local.get $id
    i32.const 2
    i32.shl
    i32.add
  )

  (func $alloc_entry_array (param $cap i32) (result i32)
    local.get $cap
    i32.const 1
    i32.add
    i32.const 2
    i32.shl
    call $alloc
  )

  (func $ensure_init (result i32)
    global.get $index
    if
      i32.const 1
      return
    end

    i32.const 16
    call $hash_new
    global.set $index

    global.get $ENTRY_START_CAP
    global.set $capacity

    global.get $capacity
    call $alloc_entry_array
    global.set $ptrs

    global.get $capacity
    call $alloc_entry_array
    global.set $lens

    global.get $capacity
    call $alloc_entry_array
    global.set $hashes

    global.get $capacity
    call $alloc_entry_array
    global.set $nexts

    global.get $index
    global.get $ptrs
    i32.and
    global.get $lens
    i32.and
    global.get $hashes
    i32.and
    global.get $nexts
    i32.and
    i32.const 0
    i32.ne
  )

  (func $grow_entries (result i32)
    (local $old_cap i32)
    (local $old_ptrs i32)
    (local $old_lens i32)
    (local $old_hashes i32)
    (local $old_nexts i32)
    (local $new_cap i32)

    global.get $capacity
    local.set $old_cap
    global.get $ptrs
    local.set $old_ptrs
    global.get $lens
    local.set $old_lens
    global.get $hashes
    local.set $old_hashes
    global.get $nexts
    local.set $old_nexts

    local.get $old_cap
    i32.const 2
    i32.mul
    local.set $new_cap

    local.get $new_cap
    call $alloc_entry_array
    global.set $ptrs

    local.get $new_cap
    call $alloc_entry_array
    global.set $lens

    local.get $new_cap
    call $alloc_entry_array
    global.set $hashes

    local.get $new_cap
    call $alloc_entry_array
    global.set $nexts

    global.get $ptrs
    global.get $lens
    i32.and
    global.get $hashes
    i32.and
    global.get $nexts
    i32.and
    i32.eqz
    if
      i32.const 0
      return
    end

    global.get $ptrs
    local.get $old_ptrs
    global.get $count
    i32.const 1
    i32.add
    i32.const 2
    i32.shl
    call $copy_bytes

    global.get $lens
    local.get $old_lens
    global.get $count
    i32.const 1
    i32.add
    i32.const 2
    i32.shl
    call $copy_bytes

    global.get $hashes
    local.get $old_hashes
    global.get $count
    i32.const 1
    i32.add
    i32.const 2
    i32.shl
    call $copy_bytes

    global.get $nexts
    local.get $old_nexts
    global.get $count
    i32.const 1
    i32.add
    i32.const 2
    i32.shl
    call $copy_bytes

    local.get $new_cap
    global.set $capacity

    i32.const 1
  )

  (func $ensure_entry_capacity (result i32)
    global.get $count
    global.get $capacity
    i32.lt_u
    if
      i32.const 1
      return
    end

    call $grow_entries
  )

  (func (export "strtab_intern") (param $ptr i32) (param $len i32) (result i32)
    (local $hash i32)
    (local $id i32)
    (local $copy_ptr i32)
    (local $head i32)

    call $ensure_init
    i32.eqz
    if
      i32.const 0
      return
    end

    local.get $ptr
    local.get $len
    call $hash_bytes
    local.set $hash

    global.get $index
    local.get $hash
    call $hash_get
    local.tee $id
    local.set $head

    block $not_found
      loop $scan
        local.get $id
        i32.eqz
        br_if $not_found

        global.get $hashes
        local.get $id
        call $entry_ptr
        i32.load
        local.get $hash
        i32.eq
        global.get $lens
        local.get $id
        call $entry_ptr
        i32.load
        local.get $len
        i32.eq
        i32.and
        if
          global.get $ptrs
          local.get $id
          call $entry_ptr
          i32.load
          local.get $ptr
          local.get $len
          call $bytes_eq
          if
            local.get $id
            return
          end
        end

        global.get $nexts
        local.get $id
        call $entry_ptr
        i32.load
        local.set $id
        br $scan
      end
    end

    call $ensure_entry_capacity
    i32.eqz
    if
      i32.const 0
      return
    end

    local.get $len
    if
      local.get $len
      call $alloc
      local.tee $copy_ptr
      i32.eqz
      if
        i32.const 0
        return
      end

      local.get $copy_ptr
      local.get $ptr
      local.get $len
      call $copy_bytes
    end

    global.get $count
    i32.const 1
    i32.add
    global.set $count

    global.get $ptrs
    global.get $count
    call $entry_ptr
    local.get $copy_ptr
    i32.store

    global.get $lens
    global.get $count
    call $entry_ptr
    local.get $len
    i32.store

    global.get $hashes
    global.get $count
    call $entry_ptr
    local.get $hash
    i32.store

    global.get $nexts
    global.get $count
    call $entry_ptr
    local.get $head
    i32.store

    global.get $index
    local.get $hash
    global.get $count
    call $hash_put

    global.get $count
  )

  (func (export "strtab_get") (param $id i32) (result i32 i32)
    local.get $id
    i32.eqz
    local.get $id
    global.get $count
    i32.gt_u
    i32.or
    if
      i32.const 0
      i32.const 0
      return
    end

    global.get $ptrs
    local.get $id
    call $entry_ptr
    i32.load

    global.get $lens
    local.get $id
    call $entry_ptr
    i32.load
  )

  (func (export "strtab_eq") (param $a i32) (param $b i32) (result i32)
    local.get $a
    local.get $b
    i32.eq
  )
)
