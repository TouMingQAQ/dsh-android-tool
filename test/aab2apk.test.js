import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  Aab2ApkService,
  cleanPath,
  humanSize,
  normalizeConfig,
  redactCommand,
  resolvePath,
  runProcess,
  sanitizeFileName,
  splitArgList,
  uniquePath,
  wildcardMatch,
} from '../lib/aab2apk.js'
import { buildStoredZip, listZipEntries, readZipEntry } from '../lib/zip.js'
import { parseManifestBytes, readApkManifest } from '../lib/apk-manifest.js'

test('cleanPath 去引号 / 展开环境变量 / 归一斜杠', () => {
  process.env.AAB2APK_TEST_DIR = 'C:\\demo'
  assert.equal(cleanPath('  "C:\\Program Files\\x"  '), 'C:\\Program Files\\x')
  assert.equal(cleanPath('$AAB2APK_TEST_DIR/app.aab'), 'C:\\demo\\app.aab')
  assert.equal(cleanPath(''), '')
})

test('resolvePath 相对锚定、绝对原样、折叠 ..', () => {
  const base = 'C:\\plugin'
  assert.equal(resolvePath(base, 'out'), 'C:\\plugin\\out')
  assert.equal(resolvePath(base, 'C:\\abs\\x'), 'C:\\abs\\x')
  assert.equal(resolvePath(base, 'a\\..\\b'), 'C:\\plugin\\b')
  assert.equal(resolvePath(base, ''), '')
})

test('splitArgList 支持引号与数组', () => {
  assert.deepEqual(splitArgList('--a 1 -Xmx2g'), ['--a', '1', '-Xmx2g'])
  assert.deepEqual(splitArgList('--msg "hello world"'), ['--msg', 'hello world'])
  assert.deepEqual(splitArgList([' a ', '', 'b']), ['a', 'b'])
})

test('humanSize / redactCommand / sanitizeFileName', () => {
  assert.equal(humanSize(512), '512 B')
  assert.equal(humanSize(2048), '2.00 KiB')
  const masked = redactCommand('apksigner sign --ks a.jks --ks-pass pass:secret --key-pass pass:top')
  assert.ok(masked.includes('pass:***'))
  assert.ok(!masked.includes('secret'))
  assert.ok(!masked.includes('top'))
  assert.equal(sanitizeFileName('a/b:c*?.apk'), 'a_b_c__.apk')
})

test('uniquePath 追加后缀', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aab2apk-unique-'))
  try {
    const file = join(dir, 'x.apk')
    await (await import('node:fs/promises')).writeFile(file, 'x')
    const next = uniquePath(file)
    assert.notEqual(next, file)
    assert.ok(next.includes('x-1'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('wildcardMatch', () => {
  assert.equal(wildcardMatch('apksigner*', 'apksigner.bat'), true)
  assert.equal(wildcardMatch('apksigner.bat', 'apksigner'), false)
  assert.equal(wildcardMatch('*', 'anything'), true)
})

test('normalizeConfig 回填默认值并拆参数', () => {
  const config = normalizeConfig({ aabPath: 'app.aab', extraBundletoolArgs: '-a -b', keystore: { keyAlias: ' release ' } })
  assert.equal(config.aabPath, 'app.aab')
  assert.equal(config.outputDir, 'output')
  assert.deepEqual(config.extraBundletoolArgs, ['-a', '-b'])
  assert.equal(config.keystore.keyAlias, 'release')
  assert.equal(config.align, true)
})

test('zip：列目录 / 读取条目', () => {
  const buffer = buildStoredZip([
    { name: 'base/manifest/AndroidManifest.xml', data: Buffer.from('abc') },
    { name: 'universal.apk', data: Buffer.from('apk-bytes') },
  ])
  const names = listZipEntries(buffer).map((entry) => entry.name)
  assert.deepEqual(names, ['base/manifest/AndroidManifest.xml', 'universal.apk'])
  assert.equal(readZipEntry(buffer, 'universal.apk').toString(), 'apk-bytes')
})

test('apk-manifest：坏数据不抛，返回 null', () => {
  assert.deepEqual(parseManifestBytes(Buffer.from('not-axml')), { packageName: null, versionCode: null, versionName: null })
  const zip = buildStoredZip([{ name: 'AndroidManifest.xml', data: Buffer.from('bad') }])
  assert.deepEqual(readApkManifest(zip), { packageName: null, versionCode: null, versionName: null })
})

test('runProcess 逐行回调并返回退出码', async () => {
  const lines = []
  const result = await runProcess(
    { program: process.execPath, args: ['-e', "console.log('hello-aab2apk')"], env: {} },
    { onLine: (_stream, line) => lines.push(line), timeoutMs: 20000 },
  )
  assert.equal(result.success, true)
  assert.equal(result.code, 0)
  assert.ok(lines.some((line) => line.includes('hello-aab2apk')))
})

test('Aab2ApkService 配置持久化 + *** 表示不修改密码', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aab2apk-config-'))
  try {
    const service = new Aab2ApkService({ getDataRoot: () => root, pluginRoot: process.cwd() })
    await service.saveConfig({ aabPath: 'app.aab', keystore: { keystorePath: 'k.jks', keystorePassword: 'secret', keyAlias: 'a' } })
    let loaded = await service.loadConfig()
    assert.equal(loaded.keystore.keystorePassword, 'secret')

    await service.saveConfig({ keystore: { keystorePassword: '***' } })
    loaded = await service.loadConfig()
    assert.equal(loaded.keystore.keystorePassword, 'secret')
    assert.equal(loaded.aabPath, 'app.aab')

    const described = await service.describe()
    assert.equal(described.config.keystore.keystorePassword, '***')
    assert.equal(described.ok, true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
