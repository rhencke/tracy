;; Generated from abi/layout.json by tools/generate-layout.js.
;; Do not edit wat/std/mem.test.wat by hand.
(module
  (import "env" "memory" (memory $memory 1))
  (import "watwat" "assert_eq_i32"
    (func $assert_eq_i32 (param i32) (param i32) (param i32)))
  (import "mem" "WASM_PAGE_SIZE" (global $WASM_PAGE_SIZE i32))
  (import "mem" "OPFS_PAGE_SIZE" (global $OPFS_PAGE_SIZE i32))
  (import "mem" "MEM_SCRATCH_BASE" (global $MEM_SCRATCH_BASE i32))
  (import "mem" "MEM_RING_BASE" (global $MEM_RING_BASE i32))
  (import "mem" "MEM_DICT_BASE" (global $MEM_DICT_BASE i32))
  (import "mem" "MEM_INDEX_CACHE_BASE" (global $MEM_INDEX_CACHE_BASE i32))
  (import "mem" "MEM_PYRAMID_CACHE_BASE" (global $MEM_PYRAMID_CACHE_BASE i32))
  (import "mem" "MEM_RENDER_SCRATCH" (global $MEM_RENDER_SCRATCH i32))
  (import "mem" "MEM_HEAP_BASE" (global $MEM_HEAP_BASE i32))
  (import "mem" "MEM_STACK_BASE" (global $MEM_STACK_BASE i32))
  (import "mem" "MEM_SCRATCH_SIZE" (global $MEM_SCRATCH_SIZE i32))
  (import "mem" "MEM_RING_SIZE" (global $MEM_RING_SIZE i32))
  (import "mem" "MEM_DICT_SIZE" (global $MEM_DICT_SIZE i32))
  (import "mem" "MEM_INDEX_CACHE_SIZE" (global $MEM_INDEX_CACHE_SIZE i32))
  (import "mem" "MEM_PYRAMID_CACHE_SIZE" (global $MEM_PYRAMID_CACHE_SIZE i32))
  (import "mem" "MEM_RENDER_SCRATCH_SIZE" (global $MEM_RENDER_SCRATCH_SIZE i32))
  (import "mem" "MEM_HEAP_SIZE" (global $MEM_HEAP_SIZE i32))
  (import "mem" "MEM_STACK_SIZE" (global $MEM_STACK_SIZE i32))
  (import "mem" "MEM_INITIAL_BYTES" (global $MEM_INITIAL_BYTES i32))
  (import "mem" "MEM_INITIAL_PAGES" (global $MEM_INITIAL_PAGES i32))
  (import "mem" "MEM_WORKING_TARGET_BYTES" (global $MEM_WORKING_TARGET_BYTES i32))
  (import "mem" "MEM_WORKING_TARGET_PAGES" (global $MEM_WORKING_TARGET_PAGES i32))
  (import "mem" "MEM_HEAP_CEILING_BYTES" (global $MEM_HEAP_CEILING_BYTES i32))
  (import "mem" "MEM_HEAP_CEILING_PAGES" (global $MEM_HEAP_CEILING_PAGES i32))

  (data (i32.const 1024) "mem test failed")

  (func (export "message_for") (param $code i32) (result i32 i32)
    i32.const 1024
    i32.const 15
  )

  (func (export "test_page_sizes")
    global.get $WASM_PAGE_SIZE
    i32.const 0x00010000
    i32.const 1
    call $assert_eq_i32

    global.get $OPFS_PAGE_SIZE
    i32.const 0x00010000
    i32.const 2
    call $assert_eq_i32
  )

  (func (export "test_region_bases")
    global.get $MEM_SCRATCH_BASE
    i32.const 0x00000000
    i32.const 3
    call $assert_eq_i32

    global.get $MEM_RING_BASE
    i32.const 0x00100000
    i32.const 4
    call $assert_eq_i32

    global.get $MEM_DICT_BASE
    i32.const 0x00500000
    i32.const 5
    call $assert_eq_i32

    global.get $MEM_INDEX_CACHE_BASE
    i32.const 0x01500000
    i32.const 6
    call $assert_eq_i32

    global.get $MEM_PYRAMID_CACHE_BASE
    i32.const 0x11500000
    i32.const 7
    call $assert_eq_i32

    global.get $MEM_RENDER_SCRATCH
    i32.const 0x19500000
    i32.const 8
    call $assert_eq_i32

    global.get $MEM_HEAP_BASE
    i32.const 0x1B500000
    i32.const 9
    call $assert_eq_i32

    global.get $MEM_STACK_BASE
    i32.const 0x1F500000
    i32.const 10
    call $assert_eq_i32
  )

  (func (export "test_region_sizes")
    global.get $MEM_SCRATCH_SIZE
    i32.const 0x00100000
    i32.const 11
    call $assert_eq_i32

    global.get $MEM_RING_SIZE
    i32.const 0x00400000
    i32.const 12
    call $assert_eq_i32

    global.get $MEM_DICT_SIZE
    i32.const 0x01000000
    i32.const 13
    call $assert_eq_i32

    global.get $MEM_INDEX_CACHE_SIZE
    i32.const 0x10000000
    i32.const 14
    call $assert_eq_i32

    global.get $MEM_PYRAMID_CACHE_SIZE
    i32.const 0x08000000
    i32.const 15
    call $assert_eq_i32

    global.get $MEM_RENDER_SCRATCH_SIZE
    i32.const 0x02000000
    i32.const 16
    call $assert_eq_i32

    global.get $MEM_HEAP_SIZE
    i32.const 0x04000000
    i32.const 17
    call $assert_eq_i32

    global.get $MEM_STACK_SIZE
    i32.const 0x01000000
    i32.const 18
    call $assert_eq_i32
  )

  (func (export "test_memory_budget")
    global.get $MEM_INITIAL_BYTES
    i32.const 0x20500000
    i32.const 19
    call $assert_eq_i32

    global.get $MEM_INITIAL_PAGES
    i32.const 8272
    i32.const 20
    call $assert_eq_i32

    global.get $MEM_WORKING_TARGET_BYTES
    i32.const 0x25800000
    i32.const 21
    call $assert_eq_i32

    global.get $MEM_WORKING_TARGET_PAGES
    i32.const 9600
    i32.const 22
    call $assert_eq_i32

    global.get $MEM_HEAP_CEILING_BYTES
    i32.const 0x40000000
    i32.const 23
    call $assert_eq_i32

    global.get $MEM_HEAP_CEILING_PAGES
    i32.const 16384
    i32.const 24
    call $assert_eq_i32
  )
)
