import test from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import {
  DEFAULTS,
  readBool,
  snapshotConfig,
  splitArgs,
  resolveExecutablePaths,
  resolveDataRoot,
  clampInt,
} from '../lib/config.js'

test('snapshotConfig 空对象给出默认值', () => {
  const value = snapshotConfig({})
  assert.equal(value.adbPath, '')
  assert.equal(value.wirelessPort, 5555)
  assert.equal(value.videoMaxSize, 720)
  assert.equal(value.previewFps, 3)
  assert.equal(value.autoConnect, false)
})

test('snapshotConfig 容忍 Volatile 引用与坏值', () => {
  const config = {
    adbPath: { get: () => '  C:/adb.exe  ' },
    wirelessPort: { get: () => '99999' },
    videoMaxSize: { get: () => 'abc' },
    autoConnect: { get: () => 'off' },
  }
  const value = snapshotConfig(config)
  assert.equal(value.adbPath, 'C:/adb.exe')
  assert.equal(value.wirelessPort, 65535)
  assert.equal(value.videoMaxSize, DEFAULTS.videoMaxSize)
  assert.equal(value.autoConnect, false)
})

test('readBool / clampInt', () => {
  assert.equal(readBool('yes', false), true)
  assert.equal(readBool('0', true), false)
  assert.equal(readBool(undefined, true), true)
  assert.equal(clampInt('42', 1, 10, 5), 10)
  assert.equal(clampInt('x', 1, 10, 5), 5)
})

test('resolveExecutablePaths 默认用随包目录', () => {
  const value = resolveExecutablePaths({ pluginRoot: 'C:/plugin', platform: 'win32', join })
  assert.equal(value.adbPath, join('C:/plugin', 'scrcpy', 'adb.exe'))
  assert.equal(value.scrcpyPath, join('C:/plugin', 'scrcpy', 'scrcpy.exe'))
  assert.equal(value.serverPath, join('C:/plugin', 'scrcpy', 'scrcpy-server'))
})

test('resolveExecutablePaths 显式路径优先', () => {
  const value = resolveExecutablePaths({ pluginRoot: 'C:/plugin', adbPath: 'D:/adb.exe', scrcpyPath: 'D:/scrcpy.exe', platform: 'win32', join })
  assert.equal(value.adbPath, 'D:/adb.exe')
  assert.equal(value.scrcpyPath, 'D:/scrcpy.exe')
})

test('resolveDataRoot 优先级 profile > home', () => {
  assert.equal(resolveDataRoot({ profileDir: 'C:/profile', homeDir: 'C:/home', join }).source, 'profile')
  assert.equal(resolveDataRoot({ homeDir: 'C:/home', join }).root, join('C:/home', '.dsh-android-tool'))
})

test('splitArgs 支持引号与转义', () => {
  assert.deepEqual(splitArgs('--no-audio --always-on-top'), ['--no-audio', '--always-on-top'])
  assert.deepEqual(splitArgs('"a b" c\\ d'), ['a b', 'c d'])
  assert.deepEqual(splitArgs("'x y'"), ['x y'])
})
