(module
  (import "env" "memory" (memory $memory 1))
  (import "watwat" "assert_true"
    (func $assert_true (param i32) (param i32)))
  (import "app" "tracy_main" (func $tracy_main))
  (import "app" "tracy_tick" (func $tracy_tick))

  (data (i32.const 1024) "app test failed")

  (func (export "message_for") (param $code i32) (result i32 i32)
    i32.const 1024
    i32.const 15
  )

  (func (export "test_app_exports_are_callable")
    call $tracy_main
    call $tracy_tick

    i32.const 1
    i32.const 1
    call $assert_true
  )
)
