import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseProcStat,
  computeCpuUsage,
  parseMeminfo,
  parseAppPss,
  parseCpuInfo,
  parseBattery,
  parseGpuOutput,
} from '../lib/perf.js'

test('parseProcStat / computeCpuUsage', () => {
  const first = parseProcStat('cpu  100 0 100 800 0 0 0 0 0 0\ncpu0 1 2 3')
  const second = parseProcStat('cpu  200 0 200 1600 0 0 0 0 0 0')
  assert.deepEqual(first, { idle: 800, total: 1000 })
  assert.equal(computeCpuUsage(first, second), 20)
  assert.equal(computeCpuUsage(undefined, second), undefined)
})

test('parseMeminfo', () => {
  const text = 'MemTotal:       8000000 kB\nMemFree:        1000000 kB\nMemAvailable:   3000000 kB\nBuffers:          10000 kB\nCached:          500000 kB\n'
  const value = parseMeminfo(text)
  assert.equal(value.totalKb, 8000000)
  assert.equal(value.availableKb, 3000000)
  assert.equal(value.usedKb, 5000000)
})

test('parseAppPss 兼容两种 dumpsys 输出', () => {
  assert.equal(parseAppPss('TOTAL PSS: 123456  TOTAL RSS: 200000'), 123456)
  assert.equal(parseAppPss('  TOTAL   654321   TOTAL SWAP PSS: 0'), 654321)
  assert.equal(parseAppPss('nothing'), undefined)
})

test('parseCpuInfo 取 TOTAL 与目标包', () => {
  const text = [
    'Load: 1.2 / 1.0 / 0.8',
    '  12.3% TOTAL: 5% user + 7% kernel',
    '  4.5% 1234/com.example.app: 2% user + 2.5% kernel',
    '  1.0% 99/system_server: 0.5% user + 0.5% kernel',
  ].join('\n')
  const value = parseCpuInfo(text, 'com.example.app')
  assert.equal(value.totalPercent, 12.3)
  assert.equal(value.appPercent, 4.5)
})

test('parseBattery', () => {
  const text = 'AC powered: true\nUSB powered: false\nstatus: 2\nlevel: 87\ntemperature: 315\n'
  const value = parseBattery(text)
  assert.equal(value.level, 87)
  assert.equal(value.status, '充电中')
  assert.equal(value.temperatureC, 32) // 31.5 四舍五入
  assert.equal(value.charging, true)
})

test('parseGpuOutput 解析 kgsl gpubusy 与频率', () => {
  const text = '==/sys/class/kgsl/kgsl-3d0/gpubusy\n30 100\n==/sys/class/kgsl/kgsl-3d0/gpuclk\n600000000\n'
  const value = parseGpuOutput(text)
  assert.equal(value.available, true)
  assert.equal(value.usagePercent, 30)
  assert.equal(value.clockMHz, 600)
})

test('parseGpuOutput 无接口时 available=false', () => {
  const value = parseGpuOutput('==/sys/class/kgsl/kgsl-3d0/gpubusy\n\n')
  assert.equal(value.available, false)
})
