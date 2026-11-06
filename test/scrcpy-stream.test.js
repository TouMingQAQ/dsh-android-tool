import test from 'node:test'
import assert from 'node:assert/strict'
import { ScrcpyStream } from '../lib/scrcpy-stream.js'

function frameHeader({ config = false, key = false, pts = 1000, size }) {
  const buffer = Buffer.alloc(12)
  buffer.writeBigUInt64BE(BigInt(pts), 0)
  if (config) buffer[0] |= 0x40
  if (key) buffer[0] |= 0x20
  buffer.writeUInt32BE(size, 8)
  return buffer
}

test('feed 解析 codec/session/config/media 并广播', () => {
  const stream = new ScrcpyStream({
    adb: {},
    getConfig: () => ({ videoMaxSize: 1024, videoBitRate: 4000000, videoFps: 30 }),
    pluginRoot: '.',
  })
  const client = {
    texts: [],
    frames: [],
    sendText(text) {
      this.texts.push(text)
    },
    sendBinary(buffer) {
      this.frames.push(buffer)
    },
  }
  stream.clients.add(client)

  const sps = Buffer.from([0, 0, 0, 1, 0x67, 0x64, 0x00, 0x28])
  const pps = Buffer.from([0, 0, 0, 1, 0x68, 0xee, 0x3c])
  const configPayload = Buffer.concat([sps, pps])
  const idr = Buffer.from([0, 0, 0, 1, 0x65, 0x88, 0x84])

  const session = Buffer.alloc(12)
  session[0] = 0x80
  session.writeUInt32BE(1080, 4)
  session.writeUInt32BE(2400, 8)

  const packet = Buffer.concat([
    Buffer.from([0x68, 0x32, 0x36, 0x34]),
    session,
    frameHeader({ config: true, key: true, size: configPayload.length }),
    configPayload,
    frameHeader({ key: true, pts: 123456, size: idr.length }),
    idr,
  ])
  stream.feed(packet)

  assert.ok(client.texts.length >= 2)
  const first = JSON.parse(client.texts[0])
  assert.equal(first.type, 'meta')
  assert.equal(first.width, 1080)
  assert.equal(first.height, 2400)
  const lastMeta = JSON.parse(client.texts[client.texts.length - 1])
  assert.equal(lastMeta.codec, 'avc1.640028')

  assert.equal(client.frames.length, 1)
  const frame = client.frames[0]
  assert.equal(frame[0], 1) // key frame
  assert.equal(frame.readDoubleBE(1), 123456)
  const payload = frame.subarray(9)
  assert.ok(payload.includes(Buffer.from([0x65, 0x88, 0x84])))
  assert.ok(payload.includes(Buffer.from([0x67, 0x64, 0x00, 0x28])))
})

test('feed 处理半包', () => {
  const stream = new ScrcpyStream({ adb: {}, getConfig: () => ({}), pluginRoot: '.' })
  const client = { texts: [], frames: [], sendText(t) { this.texts.push(t) }, sendBinary(b) { this.frames.push(b) } }
  stream.clients.add(client)
  stream.feed(Buffer.from([0x68, 0x32]))
  assert.equal(client.frames.length, 0)
  stream.feed(Buffer.from([0x36, 0x34]))
  assert.equal(client.frames.length, 0)
  // 半包不会抛，等 session packet 到齐才发 meta
})

test('setGamepad 先发 UHID_CREATE 再发 UHID_INPUT，并广播手柄状态', () => {
  const stream = new ScrcpyStream({ adb: {}, getConfig: () => ({}), pluginRoot: '.' })
  stream.width = 100
  stream.height = 100
  const writes = []
  stream.controlSocket = { destroyed: false, write(buffer) { writes.push(Buffer.from(buffer)) } }
  const client = { texts: [], sendText(t) { this.texts.push(t) }, sendBinary() {} }
  stream.clients.add(client)

  const ok = stream.setGamepad({ buttons: ['a', 'up'], lstick: { x: 1, y: 0 } }, { source: 'ai' })
  assert.equal(ok, true)
  assert.equal(writes.length, 2)
  assert.equal(writes[0][0], 12) // UHID_CREATE2
  assert.equal(writes[1][0], 13) // UHID_INPUT2
  const report = writes[1].subarray(5) // type(1)+id(2)+len(2)+data
  assert.equal(report.length, 15)
  assert.equal(report.readUInt16LE(0), 0xffff) // 左摇杆 x 最右
  assert.equal(report[14], 1) // hat 上

  const texts = client.texts.map((text) => JSON.parse(text))
  const gamepad = texts.find((item) => item.type === 'gamepad')
  assert.ok(gamepad !== undefined)
  assert.equal(gamepad.source, 'ai')
  assert.equal(gamepad.gamepad.buttons.a, true)
  assert.equal(gamepad.gamepad.buttons.up, true)

  stream.destroyGamepad()
  assert.equal(writes[writes.length - 1][0], 14) // UHID_DESTROY
  assert.equal(stream.gamepad.created, false)
})

test('disconnectGamepad 主动销毁 UHID 并广播断连状态；无设备时也能安全调用', () => {
  const stream = new ScrcpyStream({ adb: {}, getConfig: () => ({}), pluginRoot: '.' })
  const writes = []
  stream.controlSocket = { destroyed: false, write(buffer) { writes.push(Buffer.from(buffer)) } }
  const client = { texts: [], sendText(t) { this.texts.push(t) }, sendBinary() {} }
  stream.clients.add(client)

  // 还没设备时直接断连：不抛、disconnected=false
  assert.equal(stream.disconnectGamepad().disconnected, false)

  stream.setGamepad({ buttons: ['a'] }, { source: 'manual' })
  assert.equal(stream.gamepad.created, true)

  const result = stream.disconnectGamepad()
  assert.equal(result.ok, true)
  assert.equal(result.disconnected, true)
  assert.equal(stream.gamepad.created, false)
  assert.equal(writes[writes.length - 1][0], 14) // UHID_DESTROY

  const last = JSON.parse(client.texts[client.texts.length - 1])
  assert.equal(last.type, 'gamepad')
  assert.equal(last.uhid, false)
  assert.equal(last.via, 'idle')
})

test('WS gamepadDisconnect 消息会销毁 UHID 设备', () => {
  const stream = new ScrcpyStream({ adb: {}, getConfig: () => ({}), pluginRoot: '.' })
  stream.controlSocket = { destroyed: false, write() {} }
  stream.clients.add({ texts: [], sendText() {}, sendBinary() {} })

  stream.setGamepad({ buttons: ['a'] }, { source: 'manual' })
  assert.equal(stream.gamepad.created, true)
  stream.handleControlMessage({ type: 'gamepadDisconnect' })
  assert.equal(stream.gamepad.created, false)
})

test('setGamepadType 按新类型重建 UHID（PS 的 VID/PID）', () => {
  const stream = new ScrcpyStream({ adb: {}, getConfig: () => ({}), pluginRoot: '.' })
  const writes = []
  stream.controlSocket = { destroyed: false, write(buffer) { writes.push(Buffer.from(buffer)) } }
  stream.clients.add({ texts: [], sendText() {}, sendBinary() {} })

  stream.setGamepad({ buttons: ['a'] }, { source: 'manual' })
  assert.equal(writes[0][0], 12)
  // id(2) 后是 vendorId（大端）
  assert.equal(writes[0].readUInt16BE(3), 0x045e)

  stream.setGamepadType('ps')
  const create = writes.filter((buffer) => buffer[0] === 12)
  assert.equal(create.length, 2)
  const psCreate = create[1]
  assert.equal(psCreate.readUInt16BE(3), 0x054c) // Sony
  assert.equal(psCreate.readUInt16BE(5), 0x0ce6) // DualSense
  assert.equal(stream.gamepad.type, 'ps')
})

test('慢客户端积压时丢非关键帧，关键帧恢复', () => {
  const stream = new ScrcpyStream({ adb: {}, getConfig: () => ({}), pluginRoot: '.' })
  const client = {
    texts: [],
    frames: [],
    bufferedAmount: 300 * 1024,
    sendText(t) { this.texts.push(t) },
    sendBinary(b) { this.frames.push(b) },
  }
  stream.clients.add(client)
  const delta = Buffer.alloc(19)
  delta[0] = 0
  const key = Buffer.alloc(19)
  key[0] = 1
  stream.broadcastBinary(delta)
  assert.equal(client.frames.length, 0)
  stream.broadcastBinary(delta)
  assert.equal(client.frames.length, 0)
  stream.broadcastBinary(key)
  assert.equal(client.frames.length, 1)
  client.bufferedAmount = 0
  stream.broadcastBinary(delta)
  assert.equal(client.frames.length, 2)
})



