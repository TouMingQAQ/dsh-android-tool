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
