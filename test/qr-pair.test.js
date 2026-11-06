import test from 'node:test'
import assert from 'node:assert/strict'
import { AndroidService, buildPairingPayload } from '../lib/service.js'

function fakeAdb({ pairingInstance = 'studio-abc', connectHost = '192.168.1.20', pairOk = true, connectOk = true } = {}) {
  const calls = []
  return {
    calls,
    async mdnsCheck() {
      return { ok: true }
    },
    async mdnsServices() {
      calls.push(['mdnsServices'])
      return {
        ok: true,
        services: [
          { instance: pairingInstance, kind: '_adb-tls-pairing._tcp', endpoint: '192.168.1.20:41000' },
          { instance: 'adb-x', kind: '_adb-tls-connect._tcp', endpoint: `${connectHost}:5555` },
        ],
      }
    },
    async pair(host, port, code) {
      calls.push(['pair', host, port, code])
      return pairOk ? { ok: true, target: `${host}:${port}`, output: 'Successfully paired' } : { ok: false, error: 'bad code' }
    },
    async connect(host, port) {
      calls.push(['connect', host, port])
      return connectOk ? { ok: true, target: `${host}:${port}`, output: 'connected' } : { ok: false, error: 'refused' }
    },
  }
}

function makeService(adb) {
  const service = Object.create(AndroidService.prototype)
  service.adb = adb
  service.qrPairing = undefined
  service.state = {}
  service.saveState = async () => ({ ok: true })
  service.loadState = async () => service.state
  return service
}

test('buildPairingPayload 生成标准 ADB 二维码载荷', () => {
  assert.equal(buildPairingPayload('studio-abc', 'deadbeef'), 'WIFI:T:ADB;S:studio-abc;P:deadbeef;;')
  assert.throws(() => buildPairingPayload('', 'x'), /服务名/u)
  assert.throws(() => buildPairingPayload('a;b', 'x'), /服务名/u)
  assert.throws(() => buildPairingPayload('a', 'x\ny'), /配对码/u)
})

test('runQrPairing 等配对服务 → 配对 → 连接', async () => {
  const adb = fakeAdb()
  const service = makeService(adb)
  const session = {
    token: 't',
    service: 'studio-abc',
    password: 'deadbeef',
    status: 'waiting',
    expiresAt: Date.now() + 5000,
    cancelled: false,
  }
  service.qrPairing = session
  await service.runQrPairing(session)
  assert.equal(session.status, 'connected')
  assert.equal(session.endpoint, '192.168.1.20:41000')
  assert.equal(session.target, '192.168.1.20:5555')
  assert.deepEqual(
    adb.calls.filter((call) => call[0] !== 'mdnsServices'),
    [
      ['pair', '192.168.1.20', 41000, 'deadbeef'],
      ['connect', '192.168.1.20', 5555],
    ],
  )
})

test('runQrPairing 配对失败时停在 failed', async () => {
  const adb = fakeAdb({ pairOk: false })
  const service = makeService(adb)
  const session = {
    token: 't',
    service: 'studio-abc',
    password: 'deadbeef',
    status: 'waiting',
    expiresAt: Date.now() + 5000,
    cancelled: false,
  }
  service.qrPairing = session
  await service.runQrPairing(session)
  assert.equal(session.status, 'failed')
  assert.match(session.message, /配对失败/u)
})

test('startQrPairing 返回 token 与二维码 PNG，可查询/取消', async () => {
  const service = makeService(fakeAdb({ pairingInstance: 'never-match' }))
  const started = await service.startQrPairing()
  assert.equal(started.ok, true)
  assert.equal(typeof started.token, 'string')
  assert.equal(started.status, 'waiting')

  const png = service.qrPairingImage(started.token)
  assert.equal(Buffer.isBuffer(png), true)
  assert.equal(png.subarray(0, 4).toString('hex'), '89504e47')

  const status = service.qrPairingStatus(started.token)
  assert.equal(status.ok, true)
  assert.equal(status.service.startsWith('studio-'), true)
  assert.equal(service.qrPairingStatus('wrong-token').ok, false)

  assert.equal(service.cancelQrPairing(started.token).ok, true)
  assert.equal(service.qrPairing, undefined)
  assert.equal(service.qrPairingImage(started.token), undefined)
})
