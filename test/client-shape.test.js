import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

test('client 是自注册脚本，不 import 本包模块', () => {
  assert.match(source, /window\.__ModuleLoader__\.load\(/u)
  assert.doesNotMatch(source, /^\s*import\s/mu)
})

test('注册了右侧页面与设置 section', () => {
  assert.match(source, /sidebarRightTabs\.register/u)
  assert.match(source, /sidebar\.right\.pane\.tab/u)
  assert.match(source, /settings\.section/u)
  assert.match(source, /安卓调试/u)
  assert.match(source, /安卓设备/u)
})

test('四 Tab 与 WebCodecs 都在', () => {
  for (const label of ['界面', 'Logcat', '性能', '指令']) assert.match(source, new RegExp(label, 'u'))
  assert.match(source, /VideoDecoder/u)
  assert.match(source, /video\.ws/u)
})

test('Unity 颜色通过 segments 渲染，不用 innerHTML', () => {
  assert.match(source, /entry\.segments/u)
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/u)
})
