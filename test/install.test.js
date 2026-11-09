import test from 'node:test'
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import { parseAdbInstallOutput } from '../lib/adb.js'
import { AndroidService } from '../lib/service.js'

test('parseAdbInstallOutput 识别成功', () => {
  const r = parseAdbInstallOutput('Performing Streamed Install\nSuccess\n')
  assert.equal(r.ok, true)
  assert.equal(r.message, '安装成功')
})

test('parseAdbInstallOutput 识别 Failure 与错误码', () => {
  const r = parseAdbInstallOutput('Performing Streamed Install\nFailure [INSTALL_FAILED_ALREADY_EXISTS: Attempt to re-install without uninstalling]\n')
  assert.equal(r.ok, false)
  assert.equal(r.code, 'INSTALL_FAILED_ALREADY_EXISTS')
  assert.match(r.message, /INSTALL_FAILED_ALREADY_EXISTS/)
})

test('parseAdbInstallOutput 空输出', () => {
  const r = parseAdbInstallOutput('')
  assert.equal(r.ok, false)
  assert.match(r.message, /无输出/)
})

test('writeApkBase64 落到临时文件并保留 .apk 后缀', async () => {
  const service = new AndroidService({
    ctx: { get: () => undefined },
    getConfig: () => ({}),
    pluginRoot: process.cwd(),
    getProfileDir: () => '',
    getHomeDir: () => process.cwd(),
  })
  const result = await service.writeApkBase64(Buffer.from('apk-bytes').toString('base64'), 'drop test.apk')
  assert.equal(result.ok, true)
  assert.match(result.path, /\.apk$/u)
  await rm(result.path, { force: true })
})
