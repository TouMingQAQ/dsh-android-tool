import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildHidReport,
  diffButtons,
  dpadHatValue,
  emptyGamepadState,
  GAMEPAD_HID_REPORT_DESC,
  GAMEPAD_REPORT_SIZE,
  GAMEPAD_TYPES,
  gamepadStateEquals,
  gamepadSummary,
  gamepadTypeInfo,
  normalizeGamepadState,
  resolveButtonName,
  resolveGamepadType,
} from '../lib/gamepad.js'

test('HID 报告描述符以 Gamepad 用法开头、以双重 End Collection 结尾', () => {
  assert.ok(GAMEPAD_HID_REPORT_DESC.length > 60)
  assert.deepEqual(Array.from(GAMEPAD_HID_REPORT_DESC.slice(0, 4)), [0x05, 0x01, 0x09, 0x05])
  assert.deepEqual(Array.from(GAMEPAD_HID_REPORT_DESC.slice(-2)), [0xc0, 0xc0])
})

test('中立状态生成 15 字节报告：摇杆居中、按钮/扳机为 0', () => {
  const report = buildHidReport(emptyGamepadState())
  assert.equal(report.length, GAMEPAD_REPORT_SIZE)
  // 左右摇杆四轴居中 = 0x8000（小端 00 80）
  assert.deepEqual(Array.from(report.subarray(0, 8)), [0x00, 0x80, 0x00, 0x80, 0x00, 0x80, 0x00, 0x80])
  assert.deepEqual(Array.from(report.subarray(8, 14)), [0, 0, 0, 0, 0, 0])
  assert.equal(report[14], 0)
})

test('按键位映射：A+B → 0x0003，肩键位单独存在', () => {
  const report = buildHidReport({ buttons: ['a', 'b', 'lb', 'start'] })
  const buttons = report.readUInt16LE(12)
  assert.equal(buttons & 0x0001, 0x0001) // A
  assert.equal(buttons & 0x0002, 0x0002) // B
  assert.equal(buttons & 0x0040, 0x0040) // LB
  assert.equal(buttons & 0x0800, 0x0800) // START
})

test('方向键进 hat switch：上左=8，下右=4，单下=5', () => {
  assert.equal(dpadHatValue({ up: true, left: true }), 8)
  assert.equal(dpadHatValue({ down: true, right: true }), 4)
  assert.equal(dpadHatValue({ down: true }), 5)
  assert.equal(dpadHatValue({}), 0)
})

test('摇杆轴映射到 0..65535：右/上 与 左/下', () => {
  const right = buildHidReport({ lstick: { x: 1, y: 1 } })
  assert.equal(right.readUInt16LE(0), 0xffff) // x 右 = 最大
  assert.equal(right.readUInt16LE(2), 0x0000) // y 上 = 最小（SDL 约定）
  const left = buildHidReport({ lstick: { x: -1, y: -1 } })
  assert.equal(left.readUInt16LE(0), 0x0000)
  assert.equal(left.readUInt16LE(2), 0xffff)
})

test('扳机 1.0 → 0x7FFF，0.5 约一半', () => {
  assert.equal(buildHidReport({ lt: 1, rt: 0.5 }).readUInt16LE(8), 0x7fff)
  assert.equal(buildHidReport({ rt: 0.5 }).readUInt16LE(10), Math.round(0.5 * 0x7fff))
})

test('别名归一化：PlayStation / dpad / lb 都能识别', () => {
  assert.equal(resolveButtonName('Cross'), 'a')
  assert.equal(resolveButtonName('dpad-up'), 'up')
  assert.equal(resolveButtonName('L1'), 'lb')
  const state = normalizeGamepadState({ buttons: ['cross', 'triangle', 'dpad_left', 'shoulder_right'] })
  assert.equal(state.buttons.a, true)
  assert.equal(state.buttons.y, true)
  assert.equal(state.buttons.left, true)
  assert.equal(state.buttons.rb, true)
  assert.equal(state.buttons.b, false)
})

test('buttons 数组是绝对语义，merge 才是叠加', () => {
  const base = normalizeGamepadState({ buttons: ['a', 'b'] })
  const absolute = normalizeGamepadState({ buttons: ['x'] }, { base })
  assert.equal(absolute.buttons.a, false)
  assert.equal(absolute.buttons.x, true)
  const merged = normalizeGamepadState({ buttons: ['x'] }, { base, merge: true })
  assert.equal(merged.buttons.a, true)
  assert.equal(merged.buttons.x, true)
})

test('dpad 简写与 press/release 增量', () => {
  const state = normalizeGamepadState({ dpad: ['up', 'right'], press: ['a'] })
  assert.equal(state.buttons.up, true)
  assert.equal(state.buttons.right, true)
  assert.equal(state.buttons.a, true)
  const released = normalizeGamepadState({ release: ['a'] }, { base: state, merge: true })
  assert.equal(released.buttons.a, false)
  assert.equal(released.buttons.up, true)
})

test('diffButtons 找出按下与松开', () => {
  const before = normalizeGamepadState({ buttons: ['a', 'b'] })
  const after = normalizeGamepadState({ buttons: ['b', 'x'] })
  const diff = diffButtons(before, after)
  assert.deepEqual(diff.pressed, ['x'])
  assert.deepEqual(diff.released, ['a'])
})

test('肩键不会把扳机带到底', () => {
  const state = normalizeGamepadState({ buttons: ['lb', 'rb'] })
  assert.equal(state.lt, 0)
  assert.equal(state.rt, 0)
  const withTrigger = normalizeGamepadState({ buttons: ['rb'], rt: 0.5 })
  assert.equal(withTrigger.rt, 0.5)
})

test('gamepadStateEquals 与摘要', () => {
  const a = normalizeGamepadState({ buttons: ['a', 'up'], lstick: { x: 0.5, y: 0 } })
  const b = normalizeGamepadState({ buttons: ['a', 'up'], lstick: { x: 0.5, y: 0 } })
  assert.equal(gamepadStateEquals(a, b), true)
  assert.equal(gamepadStateEquals(a, emptyGamepadState()), false)
  assert.match(gamepadSummary(a), /A/)
  assert.match(gamepadSummary(a), /↑/)
  assert.equal(gamepadSummary(emptyGamepadState()), '中立')
})

test('手柄类型解析与身份信息', () => {
  assert.equal(resolveGamepadType('PS5'), 'ps')
  assert.equal(resolveGamepadType('nintendo switch'), 'switch')
  assert.equal(resolveGamepadType('xbox-360'), 'xbox')
  assert.equal(resolveGamepadType('unknown'), 'xbox')
  assert.equal(gamepadTypeInfo('ps').vendorId, 0x054c)
  assert.equal(gamepadTypeInfo('switch').productId, 0x2009)
  assert.equal(GAMEPAD_TYPES.xbox.name, 'Microsoft X-Box 360 Pad')
})

test('三种类型共用标准 A/B/X/Y 位映射，只换身份', () => {
  assert.deepEqual(GAMEPAD_TYPES.switch.bits, GAMEPAD_TYPES.xbox.bits)
  assert.deepEqual(GAMEPAD_TYPES.ps.bits, GAMEPAD_TYPES.xbox.bits)
  for (const type of ['xbox', 'ps', 'switch']) {
    assert.equal(buildHidReport({ buttons: ['a'] }, type).readUInt16LE(12) & 0xffff, 0x0001)
    assert.equal(buildHidReport({ buttons: ['x'] }, type).readUInt16LE(12) & 0xffff, 0x0008)
  }
})

