import test from 'node:test'
import assert from 'node:assert/strict'
import { registerWebRoutes, WEB_ROUTES } from '../lib/webapi.js'

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
