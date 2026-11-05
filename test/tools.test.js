import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTools, cleanValue } from '../lib/tools.js'

function fakeService() {
  const calls = []
  const record = (name) => async (input) => {
    calls.push({ name, input })
    return { ok: true, method: name }
  }
  return {
    calls,
    screencapture: record('screencapture'),
    deviceState: record('deviceState'),
    control: record('control'),
    adbCommand: record('adbCommand'),
    aab2apk: {
      convert: record('aab2apk.convert'),
    },
  }
}

test('buildTools 返回五个工具且名字唯一', () => {
  const tools = buildTools({ service: fakeService() })
  const names = tools.map((tool) => tool.name)
  assert.deepEqual(names, ['android_view', 'android_state', 'android_control', 'android_adb', 'android_aab2apk'])
  assert.equal(new Set(names).size, names.length)
  for (const tool of tools) {
    assert.equal(typeof tool.execute, 'function')
    assert.equal(typeof tool.output.render, 'function')
    assert.equal(tool.parameters.type, 'object')
  }
})

test('工具参数 schema 是合法 JSON Schema（required 必须是字符串数组）', () => {
  const tools = buildTools({ service: fakeService() })
  const walk = (schema, path) => {
    assert.equal(typeof schema, 'object', `${path} 应为对象`)
    if ('required' in schema) {
      assert.ok(Array.isArray(schema.required), `${path}.required 必须是数组，实际是 ${typeof schema.required}`)
      for (const key of schema.required) {
        assert.equal(typeof key, 'string', `${path}.required 内必须都是字符串`)
        assert.ok(schema.properties && key in schema.properties, `${path}.required 的 ${key} 不在 properties 中`)
      }
    }
    for (const [key, value] of Object.entries(schema.properties ?? {})) {
      walk(value, `${path}.properties.${key}`)
    }
    if (schema.items) walk(schema.items, `${path}.items`)
  }
  for (const tool of tools) walk(tool.parameters, tool.name)
})

test('android_view 默认 includeState 并标记', async () => {
  const service = fakeService()
  const tool = buildTools({ service }).find((item) => item.name === 'android_view')
  await tool.execute({ serial: 'AAA' })
  assert.deepEqual(service.calls[0], {
    name: 'screencapture',
    input: { serial: 'AAA', savePath: undefined, includeState: true, mark: true },
  })
})

test('android_control 默认 capture=true', async () => {
  const service = fakeService()
  const tool = buildTools({ service }).find((item) => item.name === 'android_control')
  await tool.execute({ action: 'tap', x: 1, y: 2 })
  assert.equal(service.calls[0].input.capture, true)
  assert.equal(service.calls[0].input.action, 'tap')
})

test('android_adb 传 mode / timeout', async () => {
  const service = fakeService()
  const tool = buildTools({ service }).find((item) => item.name === 'android_adb')
  await tool.execute({ command: 'getprop x', mode: 'shell', timeoutMs: 5000 })
  assert.deepEqual(service.calls[0].input, { command: 'getprop x', mode: 'shell', serial: undefined, timeoutMs: 5000 })
})

test('android_aab2apk 折叠成 keystore/tools 覆盖并去掉 undefined', async () => {
  const service = fakeService()
  const tool = buildTools({ service }).find((item) => item.name === 'android_aab2apk')
  await tool.execute({ aabPath: 'C:/x/app.aab', keystorePath: 'k.jks', keystorePassword: 'p', keyAlias: 'a', align: false })
  const input = service.calls[0].input
  assert.equal(input.aabPath, 'C:/x/app.aab')
  assert.equal(input.align, false)
  assert.deepEqual(input.keystore, { keystorePath: 'k.jks', keystorePassword: 'p', keyAlias: 'a' })
  assert.equal(input.tools, undefined)
  assert.equal(Object.hasOwn(input, 'outputDir'), false)
})

test('图片 render 会附上 image block', () => {
  const tool = buildTools({ service: fakeService() }).find((item) => item.name === 'android_view')
  const blocks = tool.output.render({}, { ok: true, image: { attachmentId: 'a1', mediaType: 'image/png' } })
  assert.equal(blocks.length, 2)
  assert.equal(blocks[1].type, 'image')
  assert.equal(blocks[1].attachment.attachmentId, 'a1')
})

test('android_control 手柄：透传按钮/摇杆且默认不截图', async () => {
  const service = fakeService()
  const tool = buildTools({ service }).find((item) => item.name === 'android_control')
  await tool.execute({ action: 'gamepad', buttons: ['a', 'up'], lstick: { x: 1, y: 0 }, holdMs: 80, gamepadType: 'switch' })
  const input = service.calls[0].input
  assert.equal(input.action, 'gamepad')
  assert.deepEqual(input.buttons, ['a', 'up'])
  assert.deepEqual(input.lstick, { x: 1, y: 0 })
  assert.equal(input.holdMs, 80)
  assert.equal(input.gamepadType, 'switch')
  assert.equal(input.capture, false)
})

test('cleanValue 递归去掉 undefined 并把非有限数字变成 null', () => {
  assert.deepEqual(cleanValue({ a: 1, b: undefined, c: { d: undefined, e: 2 }, f: [1, undefined, 3], g: Number.NaN }), {
    a: 1,
    c: { e: 2 },
    f: [1, 3],
    g: null,
  })
})

test('工具输出自动剔除 undefined（修复 lossless JSON 报错）', async () => {
  const service = {
    screencapture: async () => ({ ok: true, width: 10, height: 20, path: undefined, image: undefined, nested: { x: undefined, y: 1 } }),
  }
  const tool = buildTools({ service }).find((item) => item.name === 'android_view')
  const value = await tool.execute({})
  assert.deepEqual(value, { ok: true, width: 10, height: 20, nested: { y: 1 } })
  assert.equal(Object.hasOwn(value, 'path'), false)
})


