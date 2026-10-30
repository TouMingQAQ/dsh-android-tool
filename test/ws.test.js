import test from 'node:test'
import assert from 'node:assert/strict'
import { acceptKey, encodeFrame, encodeText, encodeBinary, parseFrames, handshakeResponse } from '../lib/ws.js'

test('acceptKey RFC 示例', () => {
  assert.equal(acceptKey('dGhlIHNhbXBsZSBub25jZQ=='), 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=')
})

test('handshakeResponse 缺少 key 返回 undefined', () => {
  assert.equal(handshakeResponse({ headers: {} }), undefined)
  assert.match(handshakeResponse({ headers: { 'sec-websocket-key': 'abc' } }), /101 Switching Protocols/u)
})

test('encodeFrame 短/中/长三种长度', () => {
  assert.deepEqual([...encodeFrame(0x1, Buffer.from('hi'))].slice(0, 2), [0x81, 2])
  const medium = encodeFrame(0x2, Buffer.alloc(200))
  assert.equal(medium[0], 0x82)
  assert.equal(medium[1], 126)
  const large = encodeFrame(0x2, Buffer.alloc(70000))
  assert.equal(large[1], 127)
  assert.equal(encodeText('x')[0], 0x81)
  assert.equal(encodeBinary(Buffer.from([1]))[0], 0x82)
})

test('parseFrames 解析带掩码的客户端帧', () => {
  const payload = Buffer.from('hello')
  const mask = Buffer.from([1, 2, 3, 4])
  const header = Buffer.from([0x81, 0x80 | payload.length])
  const masked = Buffer.alloc(payload.length)
  for (let index = 0; index < payload.length; index += 1) masked[index] = payload[index] ^ mask[index % 4]
  const { frames, rest } = parseFrames(Buffer.concat([header, mask, masked]))
  assert.equal(frames.length, 1)
  assert.equal(frames[0].opcode, 0x1)
  assert.equal(frames[0].payload.toString(), 'hello')
  assert.equal(rest.length, 0)
})

test('parseFrames 半包时保留 rest', () => {
  const header = Buffer.from([0x81, 0x85])
  const { frames, rest } = parseFrames(header)
  assert.equal(frames.length, 0)
  assert.equal(rest.length, 2)
})
