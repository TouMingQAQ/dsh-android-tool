import test from 'node:test'
import assert from 'node:assert/strict'
import { parseThreadTimeLine, parseUnityColor, normalizeColor, levelPasses } from '../lib/logcat.js'

test('parseThreadTimeLine 解析 threadtime 行', () => {
  const line = '10-29 21:30:45.123  1234  5678 I Unity   : <color=#ff0000>Hello</color>'
  const entry = parseThreadTimeLine(line)
  assert.equal(entry.date, '10-29')
  assert.equal(entry.time, '21:30:45.123')
  assert.equal(entry.pid, 1234)
  assert.equal(entry.tid, 5678)
  assert.equal(entry.level, 'I')
  assert.equal(entry.tag, 'Unity')
  assert.match(entry.msg, /<color=#ff0000>/u)
})

test('parseThreadTimeLine 不匹配返回 undefined', () => {
  assert.equal(parseThreadTimeLine('    at com.example.Foo(Foo.java:1)'), undefined)
  assert.equal(parseThreadTimeLine(''), undefined)
})

test('normalizeColor 支持 #RGB / #RRGGBB / #RRGGBBAA / 颜色名', () => {
  assert.equal(normalizeColor('#f00'), '#ff0000')
  assert.equal(normalizeColor('#FF0000'), '#FF0000')
  assert.equal(normalizeColor('#FF000080'), '#FF0000')
  assert.equal(normalizeColor('red'), 'red')
  assert.equal(normalizeColor('javascript:alert(1)'), undefined)
})

test('parseUnityColor 只解析 color 标签并保留其它文本', () => {
  const segments = parseUnityColor('<color=#00ff00>OK</color> and <b>bold</b>')
  assert.deepEqual(segments, [
    { text: 'OK', color: '#00ff00' },
    { text: ' and <b>bold</b>' },
  ])
})

test('parseUnityColor 无标签时原样返回', () => {
  assert.deepEqual(parseUnityColor('plain'), [{ text: 'plain' }])
})

test('levelPasses 过滤低级别', () => {
  assert.equal(levelPasses('E', 'W'), true)
  assert.equal(levelPasses('D', 'I'), false)
  assert.equal(levelPasses('V', 'V'), true)
  assert.equal(levelPasses('I', 'bad'), true)
})
