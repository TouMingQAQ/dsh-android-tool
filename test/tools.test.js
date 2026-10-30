import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTools } from '../lib/tools.js'

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
  }
}

test('buildTools 返回四个工具且名字唯一', () => {
  const tools = buildTools({ service: fakeService() })
  const names = tools.map((tool) => tool.name)
  assert.deepEqual(names, ['android_view', 'android_state', 'android_control', 'android_adb'])
  assert.equal(new Set(names).size, names.length)
  for (const tool of tools) {
    assert.equal(typeof tool.execute, 'function')
    assert.equal(typeof tool.output.render, 'function')
    assert.equal(tool.parameters.type, 'object')
  }
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

test('图片 render 会附上 image block', () => {
  const tool = buildTools({ service: fakeService() }).find((item) => item.name === 'android_view')
  const blocks = tool.output.render({}, { ok: true, image: { attachmentId: 'a1', mediaType: 'image/png' } })
  assert.equal(blocks.length, 2)
  assert.equal(blocks[1].type, 'image')
  assert.equal(blocks[1].attachment.attachmentId, 'a1')
})
