import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAdbDevices, parseMdnsEndpoint, parseMdnsServices, pickDevice, pngSize, resolveKeyCode, KEY_CODES } from '../lib/adb.js'

const SAMPLE = [
  'List of devices attached',
  'R58M1234ABC          device product:beyond1 model:SM_G9730 device:beyond1 transport_id:1',
  'emulator-5554        device product:sdk_gphone model:sdk_gphone device:generic transport_id:2',
  '192.168.1.5:5555     unauthorized transport_id:3',
  '',
].join('\n')

test('parseAdbDevices 解析序列号/状态/型号', () => {
  const devices = parseAdbDevices(SAMPLE)
  assert.equal(devices.length, 3)
  assert.deepEqual(devices[0], {
    serial: 'R58M1234ABC',
    state: 'device',
    model: 'SM_G9730',
    product: 'beyond1',
    device: 'beyond1',
    transportId: '1',
  })
  assert.equal(devices[2].state, 'unauthorized')
})

test('pickDevice 优先指定设备，其次唯一在线设备', () => {
  const devices = parseAdbDevices(SAMPLE)
  assert.equal(pickDevice(devices, 'emulator-5554').device.serial, 'emulator-5554')
  assert.equal(pickDevice(devices, '').ok, false) // 两台在线，必须选
  assert.equal(pickDevice(devices, 'not-exist').ok, false)
  const one = parseAdbDevices('List of devices attached\nAAA device model:X\n')
  assert.equal(pickDevice(one, '').device.serial, 'AAA')
})

test('pickDevice 无设备 / 未授权给出可读原因', () => {
  assert.match(pickDevice([], '').error, /没有检测到/u)
  const unauthorized = parseAdbDevices('List of devices attached\nAAA unauthorized\n')
  assert.match(pickDevice(unauthorized, '').error, /未授权/u)
})

test('pngSize 校验 PNG 头', () => {
  const buffer = Buffer.alloc(24)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0)
  buffer.writeUInt32BE(1080, 16)
  buffer.writeUInt32BE(2400, 20)
  assert.deepEqual(pngSize(buffer), { width: 1080, height: 2400 })
  assert.equal(pngSize(Buffer.from([1, 2, 3])), undefined)
})

test('resolveKeyCode 支持名字与数字', () => {
  assert.equal(resolveKeyCode('volume_up'), 24)
  assert.equal(resolveKeyCode('BACK'), KEY_CODES.back)
  assert.equal(resolveKeyCode('66'), 66)
  assert.equal(resolveKeyCode('nope'), undefined)
})

test('parseMdnsServices 解析配对/连接服务', () => {
  const output = [
    'List of discovered mdns services',
    'adb-R58M-ABC\t_adb-tls-pairing._tcp\t192.168.1.5:37777',
    'studio-deadbeef\t_adb-tls-pairing._tcp\t192.168.1.9:40001',
    'adb-R58M-ABC\t_adb-tls-connect._tcp\t192.168.1.5:5555',
  ].join('\r\n')
  const rows = parseMdnsServices(output)
  assert.equal(rows.length, 3)
  assert.deepEqual(rows[0], { instance: 'adb-R58M-ABC', kind: '_adb-tls-pairing._tcp', endpoint: '192.168.1.5:37777' })
  assert.deepEqual(rows[2], { instance: 'adb-R58M-ABC', kind: '_adb-tls-connect._tcp', endpoint: '192.168.1.5:5555' })
  assert.equal(parseMdnsServices('').length, 0)
})

test('parseMdnsEndpoint 解析 IPv4 / IPv6，拒绝非法值', () => {
  assert.deepEqual(parseMdnsEndpoint('192.168.1.5:5555'), { host: '192.168.1.5', port: 5555 })
  assert.deepEqual(parseMdnsEndpoint('[fe80::1]:37777'), { host: 'fe80::1', port: 37777 })
  assert.equal(parseMdnsEndpoint('nohost'), undefined)
  assert.equal(parseMdnsEndpoint('host:0'), undefined)
  assert.equal(parseMdnsEndpoint(':5555'), undefined)
})
