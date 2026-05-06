(module
  (import "env" "memory" (memory $memory 1 32768))

  (global $WASM_PAGE_SIZE i32 (i32.const 0x00010000))
  (global $heap_base (mut i32) (i32.const 0))
  (global $heap_ptr (mut i32) (i32.const 0))
  (global $heap_end (mut i32) (i32.const 0))

  (func $align8 (param $value i32) (result i32)
    local.get $value
    i32.const 7
    i32.add
    i32.const -8
    i32.and
  )

  (func $memory_bytes (result i32)
    memory.size
    global.get $WASM_PAGE_SIZE
    i32.mul
  )

  (func $ensure_capacity (param $needed_end i32) (result i32)
    (local $current_bytes i32)
    (local $grow_bytes i32)
    (local $grow_pages i32)

    call $memory_bytes
    local.tee $current_bytes
    local.get $needed_end
    i32.ge_u
    if
      local.get $needed_end
      global.get $heap_end
      i32.gt_u
      if
        local.get $current_bytes
        global.set $heap_end
      end

      i32.const 1
      return
    end

    local.get $needed_end
    local.get $current_bytes
    i32.sub
    local.set $grow_bytes

    local.get $grow_bytes
    global.get $WASM_PAGE_SIZE
    i32.const 1
    i32.sub
    i32.add
    global.get $WASM_PAGE_SIZE
    i32.div_u
    local.set $grow_pages

    local.get $grow_pages
    memory.grow
    i32.const -1
    i32.eq
    if
      i32.const 0
      return
    end

    call $memory_bytes
    global.set $heap_end
    i32.const 1
  )

  (func (export "bump_init") (param $base i32) (param $end i32)
    local.get $base
    global.set $heap_base

    local.get $base
    global.set $heap_ptr

    local.get $end
    global.set $heap_end
  )

  (func (export "alloc") (param $bytes i32) (result i32)
    (local $ptr i32)
    (local $next i32)

    global.get $heap_ptr
    call $align8
    local.set $ptr

    local.get $ptr
    local.get $bytes
    i32.add
    call $align8
    local.set $next

    local.get $next
    local.get $ptr
    i32.lt_u
    if
      i32.const 0
      return
    end

    local.get $next
    global.get $heap_end
    i32.gt_u
    local.get $next
    call $memory_bytes
    i32.gt_u
    i32.or
    if
      local.get $next
      call $ensure_capacity
      i32.eqz
      if
        i32.const 0
        return
      end
    end

    local.get $next
    global.set $heap_ptr
    local.get $ptr
  )

  (func (export "checkpoint") (result i32)
    global.get $heap_ptr
  )

  (func (export "reset_to") (param $label i32)
    local.get $label
    global.get $heap_base
    i32.ge_u
    local.get $label
    global.get $heap_end
    i32.le_u
    i32.and
    if
      local.get $label
      global.set $heap_ptr
    end
  )
)
