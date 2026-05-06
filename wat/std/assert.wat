(module
  (import "env" "memory" (memory $memory 1))
  (import "watwat" "fail" (func $fail (param i32)))

  (func $trap_with_code (param $code i32)
    local.get $code
    call $fail
    unreachable
  )

  (func (export "assert_eq_i32") (param $actual i32) (param $expected i32) (param $code i32)
    local.get $actual
    local.get $expected
    i32.ne
    if
      local.get $code
      call $trap_with_code
    end
  )

  (func (export "assert_eq_i64") (param $actual i64) (param $expected i64) (param $code i32)
    local.get $actual
    local.get $expected
    i64.ne
    if
      local.get $code
      call $trap_with_code
    end
  )

  (func (export "assert_eq_f64")
    (param $actual f64)
    (param $expected f64)
    (param $epsilon f64)
    (param $code i32)
    (local $delta f64)

    local.get $actual
    local.get $expected
    f64.sub
    f64.abs
    local.set $delta

    local.get $delta
    local.get $delta
    f64.ne
    local.get $delta
    local.get $epsilon
    f64.abs
    f64.gt
    i32.or
    if
      local.get $code
      call $trap_with_code
    end
  )

  (func (export "assert_eq_str")
    (param $a_ptr i32)
    (param $a_len i32)
    (param $b_ptr i32)
    (param $b_len i32)
    (param $code i32)
    (local $i i32)

    local.get $a_len
    local.get $b_len
    i32.ne
    if
      local.get $code
      call $trap_with_code
    end

    block $done
      loop $compare
        local.get $i
        local.get $a_len
        i32.ge_u
        br_if $done

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
          local.get $code
          call $trap_with_code
        end

        local.get $i
        i32.const 1
        i32.add
        local.set $i
        br $compare
      end
    end
  )

  (func (export "assert_true") (param $value i32) (param $code i32)
    local.get $value
    i32.eqz
    if
      local.get $code
      call $trap_with_code
    end
  )

  (func (export "assert_false") (param $value i32) (param $code i32)
    local.get $value
    if
      local.get $code
      call $trap_with_code
    end
  )
)
