/**
 * 宿主加载面冒烟测试（需要开发机上的 DSH_PROFILE_DIR 与 schemastery）。
 * 手动执行：node test/smoke-host.mjs
 */

import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import assert from 'node:assert/strict'

const PROFILE_MODULES = join(process.env.DSH_PROFILE_DIR ?? '', 'node_modules')
const MAP = {
  '@deepseek-ai/schemastery': join(PROFILE_MODULES, '@deepseek-ai', 'schemastery', 'lib', 'index.mjs'),
}

if (process.env.DSH_PROFILE_DIR === undefined || !existsSync(MAP['@deepseek-ai/schemastery'])) {
  console.log('skip: 没有可用的 DSH_PROFILE_DIR / schemastery，跳过宿主冒烟测试')
  process.exit(0)
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = MAP[specifier]
    if (target !== undefined && existsSync(target)) return { url: pathToFileURL(target).href, shortCircuit: true }
    return nextResolve(specifier, context)
  },
})

function fakeHost() {
  const calls = { effects: 0, injections: [], tools: [], http: [], upgrade: [], provides: [] }
  const disposers = []
  const services = {
    tools: {
      register: (definition) => {
        calls.tools.push(definition)
        return () => {}
      },
    },
    webServer: {
      register: (route) => {
        calls.http.push(route)
        return () => {}
      },
      registerUpgrade: (route) => {
        calls.upgrade.push(route)
        return () => {}
      },
    },
  }

  const ctx = {
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    tools: services.tools,
    webServer: services.webServer,
    get: (name) => services[name],
    provide: (name) => {
      calls.provides.push(name)
      return () => {}
    },
    effect: (body, _label) => {
      calls.effects += 1
      const result = typeof body === 'function' ? body() : undefined
      if (typeof result === 'function') disposers.push(result)
      return () => {
        if (typeof result === 'function') result()
      }
    },
    inject: (deps, callback) => {
      calls.injections.push(deps)
      const scoped = { ...ctx, tools: services.tools, webServer: services.webServer, effect: ctx.effect }
      const result = callback(scoped)
      if (typeof result === 'function') disposers.push(result)
    },
  }
  return { ctx, calls, disposeAll: () => disposers.forEach((fn) => fn()) }
}

const host = await import('../index.js')
assert.equal(host.name, 'dsh-android-tool')
assert.equal(typeof host.apply, 'function')
assert.ok(Array.isArray(host.inject))
assert.deepEqual(host.inject, ['tools'])
assert.ok(host.Config !== undefined)

const parsed = host.Config({})
for (const key of Object.keys(parsed)) {
  assert.equal(typeof parsed[key]?.get, 'function', `${key} 必须是 volatile 引用`)
}

const env = fakeHost()
host.apply(env.ctx, parsed)
await new Promise((resolve) => setTimeout(resolve, 30))

const toolNames = env.calls.tools.map((tool) => tool.name).sort()
assert.deepEqual(toolNames, ['android_adb', 'android_control', 'android_state', 'android_view'])
assert.equal(env.calls.http[0].path, '/x-android-tool')
assert.equal(env.calls.http[0].kind, 'prefix')
assert.equal(env.calls.upgrade[0].path, '/x-android-tool/video.ws')
assert.ok(env.calls.provides.includes('androidTool'))
assert.ok(env.calls.injections.some((deps) => deps.includes('webServer')))

env.disposeAll()
console.log('宿主冒烟测试通过 ✓', JSON.stringify({ tools: toolNames, routes: env.calls.http.length, upgrade: env.calls.upgrade.length }))
