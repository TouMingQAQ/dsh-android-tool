import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { registerWebRoutes, WEB_ROUTES } from '../lib/webapi.js'
import { Aab2ApkService } from '../lib/aab2apk.js'

function fakeResponse() {
  const headers = {}
  let body
  return {
    statusCode: 0,
    setHeader(name, value) {
      headers[String(name).toLowerCase()] = value
    },
    end(chunk) {
      body = chunk
    },
    get headers() {
      return headers
    },
    get body() {
      return body
    },
  }
}

function fakeRequest(method, url, chunks = []) {
  return {
    method,
    url,
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    },
  }
}

function fakeServer() {
  const calls = { http: [], upgrade: [] }
  return {
    calls,
    register(options) {
      calls.http.push(options)
      return () => {}
    },
    registerUpgrade(options) {
      calls.upgrade.push(options)
      return () => {}
    },
  }
}

test('注册 HTTP 前缀路由与视频 upgrade 路由', () => {
  const server = fakeServer()
  const dispose = registerWebRoutes(server, { service: {} })
  assert.equal(server.calls.http[0].kind, 'prefix')
  assert.equal(server.calls.http[0].path, '/x-android-tool')
  assert.equal(server.calls.upgrade[0].path, WEB_ROUTES.videoWs)
  assert.equal(typeof dispose, 'function')
})

test('state 路由返回服务状态', async () => {
  const server = fakeServer()
  registerWebRoutes(server, { service: { uiState: async () => ({ ok: true, selectedSerial: 'AAA' }) } })
  const res = fakeResponse()
  await server.calls.http[0].handler(fakeRequest('GET', WEB_ROUTES.state), res)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(JSON.parse(res.body), { ok: true, selectedSerial: 'AAA' })
})

test('screenshot 有图返回 image/png，无图 404', async () => {
  const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47])
  let shot = { ok: true, buffer }
  const server = fakeServer()
  registerWebRoutes(server, { service: { screenshotBuffer: async () => shot, uiState: async () => ({ ok: true }) } })
  const res = fakeResponse()
  await server.calls.http[0].handler(fakeRequest('GET', WEB_ROUTES.screenshot), res)
  assert.equal(res.statusCode, 200)
  assert.equal(res.headers['content-type'], 'image/png')
  assert.deepEqual(res.body, buffer)

  shot = { ok: false, error: '没有设备' }
  const missing = fakeResponse()
  await server.calls.http[0].handler(fakeRequest('GET', WEB_ROUTES.screenshot), missing)
  assert.equal(missing.statusCode, 404)
})

test('command 路由解析 JSON 并转发', async () => {
  const calls = []
  const server = fakeServer()
  registerWebRoutes(server, {
    service: {
      humanCommand: async (body) => {
        calls.push(body)
        return { ok: true }
      },
      uiState: async () => ({ ok: true }),
    },
  })
  const res = fakeResponse()
  await server.calls.http[0].handler(fakeRequest('POST', WEB_ROUTES.command, [JSON.stringify({ action: 'connect', host: '1.2.3.4' })]), res)
  assert.deepEqual(calls[0], { action: 'connect', host: '1.2.3.4' })
  assert.deepEqual(JSON.parse(res.body), { ok: true })
})

test('未知路由 404；非 GET/POST 方法 405', async () => {
  const server = fakeServer()
  registerWebRoutes(server, { service: { uiState: async () => ({ ok: true }) } })
  const unknown = fakeResponse()
  await server.calls.http[0].handler(fakeRequest('GET', '/x-android-tool/nope'), unknown)
  assert.equal(unknown.statusCode, 404)

  const put = fakeResponse()
  await server.calls.http[0].handler(fakeRequest('PUT', WEB_ROUTES.command), put)
  assert.equal(put.statusCode, 405)
})

test('gamepad.svg 按 type 返回对应素材', async () => {
  const server = fakeServer()
  registerWebRoutes(server, { service: { pluginRoot: process.cwd(), uiState: async () => ({ ok: true }) } })
  const handler = server.calls.http[0].handler
  for (const type of ['xbox', 'ps', 'switch']) {
    const res = fakeResponse()
    await handler(fakeRequest('GET', `${WEB_ROUTES.gamepadSvg}?type=${type}`), res)
    assert.equal(res.statusCode, 200)
    assert.equal(res.headers['content-type'], 'image/svg+xml; charset=utf-8')
    assert.match(Buffer.from(res.body).toString('utf8'), /<svg/u)
  }
  const missing = fakeResponse()
  await handler(fakeRequest('GET', `${WEB_ROUTES.gamepadSvg}?type=unknown`), missing)
  assert.equal(missing.statusCode, 200) // unknown 回退到 xbox
})

test('aab2apk config / 保存 / 浏览 / 任务路由', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aab2apk-web-'))
  try {
    const aab2apk = new Aab2ApkService({ getDataRoot: () => root, pluginRoot: process.cwd() })
    const server = fakeServer()
    registerWebRoutes(server, { service: { aab2apk } })
    const handler = server.calls.http[0].handler

    const described = fakeResponse()
    await handler(fakeRequest('GET', WEB_ROUTES.aab2apkConfig), described)
    const describedBody = JSON.parse(described.body)
    assert.equal(describedBody.ok, true)
    assert.equal(describedBody.config.outputDir, 'output')

    const saved = fakeResponse()
    await handler(fakeRequest('POST', WEB_ROUTES.aab2apkConfig, [JSON.stringify({ config: { aabPath: 'x.aab' } })]), saved)
    assert.equal(JSON.parse(saved.body).ok, true)

    const browsed = fakeResponse()
    await handler(fakeRequest('GET', `${WEB_ROUTES.aab2apkBrowse}?path=${encodeURIComponent(root)}`), browsed)
    assert.equal(JSON.parse(browsed.body).ok, true)

    const job = fakeResponse()
    await handler(fakeRequest('GET', `${WEB_ROUTES.aab2apkJob}?id=nope`), job)
    assert.equal(JSON.parse(job.body).ok, false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
