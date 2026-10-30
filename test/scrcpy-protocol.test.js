import test from 'node:test'
import assert from 'node:assert/strict'
import {
  readCodecId,
  parseSessionPacket,
  parseFrameHeader,
  splitAnnexB,
  extractSpsPps,
  spsToCodecString,
  joinAnnexB,
  scrcpySocketName,
} from '../lib/scrcpy-protocol.js'

test('scrcpySocketName 用十进制 scid 生成 8 位十六进制名', () => {
  assert.equal(scrcpySocketName(7654321), 'scrcpy_0074cbb1')
  assert.equal(scrcpySocketName(0x1234), 'scrcpy_00001234')
  assert.equal(scrcpySocketName(-1), 'scrcpy')
})

test('readCodecId 识别 h264', () => {
  const value = readCodecId(Buffer.from([0x68, 0x32, 0x36, 0x34]))
  assert.equal(value.name, 'h264')
})

test('parseSessionPacket 读宽高', () => {
  const buffer = Buffer.alloc(12)
  buffer[0] = 0x80
  buffer.writeUInt32BE(1080, 4)
  buffer.writeUInt32BE(2400, 8)
  assert.deepEqual(parseSessionPacket(buffer), { clientResized: false, width: 1080, height: 2400 })
  assert.equal(parseSessionPacket(Buffer.alloc(12)), undefined)
})

test('parseFrameHeader 读 flags / pts / size', () => {
  const buffer = Buffer.alloc(12)
  const pts = 123456n
  buffer.writeBigUInt64BE(pts, 0)
  buffer[0] |= 0x40 | 0x20 // config + key
  buffer.writeUInt32BE(999, 8)
  const value = parseFrameHeader(buffer)
  assert.equal(value.media, true)
  assert.equal(value.config, true)
  assert.equal(value.key, true)
  assert.equal(value.pts, 123456)
  assert.equal(value.size, 999)
})

test('splitAnnexB 拆出 SPS/PPS/IDR', () => {
  const buffer = Buffer.concat([
    Buffer.from([0, 0, 0, 1, 0x67, 0x64, 0x00, 0x28]),
    Buffer.from([0, 0, 0, 1, 0x68, 0xee, 0x3c]),
    Buffer.from([0, 0, 0, 1, 0x65, 0x88]),
  ])
  const nals = splitAnnexB(buffer)
  assert.deepEqual(nals.map((nal) => nal.type), [7, 8, 5])
  const { sps, pps } = extractSpsPps(nals)
  assert.equal(sps[0], 0x67)
  assert.equal(pps[0], 0x68)
  assert.equal(spsToCodecString(sps), 'avc1.640028')
})

test('joinAnnexB 拼回起始码', () => {
  const joined = joinAnnexB([Buffer.from([0x67, 0x64]), Buffer.from([0x68, 0xee])])
  assert.deepEqual([...joined], [0, 0, 0, 1, 0x67, 0x64, 0, 0, 0, 1, 0x68, 0xee])
})
