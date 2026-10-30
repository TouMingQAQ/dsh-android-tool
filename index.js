/**
 * dsh-android-tool —— 把 Android 设备接进 DSH（host 半边）。
 *
 * 这一层做四件事：
 *   1. 构造 AndroidService（adb / logcat / 性能 / scrcpy 推流与独立窗口）；
 *   2. 注册 android_view / android_state / android_control / android_adb 四个工具；
 *   3. 注册 /x-android-tool 的 HTTP 与 WebSocket 接口（侧边栏与设置页用）；
 *   4. 卸载时关掉本插件启动的进程。
 *
 * 插件加载本身不 spawn 任何进程，第一次访问设备时才启动。
 */

import { snapshotConfig } from './lib/config.js'
import { Config } from './lib/config-schema.js'
import { pluginRootFrom } from './lib/paths.js'
import { AndroidService } from './lib/service.js'
import { buildTools } from './lib/tools.js'
import { registerWebRoutes } from './lib/webapi.js'

export const name = 'dsh-android-tool'

/** `tools` 是硬依赖：没有工具注册表，这个插件就没有意义。 */
export const inject = ['tools']

export { Config }

/**
 * @param {object} ctx - host 作用域上下文
 * @param {object} config - 运行期配置（volatile 字段需实时读取）
 */
export function apply(ctx, config) {
  const logger = ctx.logger
  const pluginRoot = pluginRootFrom(import.meta.url)

  const service = new AndroidService({
    ctx,
    getConfig: () => snapshotConfig(config),
    pluginRoot,
    getProfileDir: () => process.env.DSH_PROFILE_DIR ?? '',
    logger,
  })

  ctx.provide('androidTool', service)

  // ── 工具注册（host 层，所有会话可见）──────────────────────────────────────
  for (const definition of buildTools({ service })) {
    ctx.effect(() => ctx.tools.register(definition), `dsh-android-tool: ${definition.name}`)
  }

  // ── 面板 / 设置页接口 ─────────────────────────────────────────────────────
  ctx.inject(['webServer'], (scope) => {
    scope.effect(
      () => registerWebRoutes(scope.webServer, { service, logger }),
      'dsh-android-tool: console routes',
    )
  })

  // ── 拆卸 ───────────────────────────────────────────────────────────────────
  ctx.effect(
    () => () => {
      service.dispose()
    },
    'dsh-android-tool: disposal',
  )

  void service.init().catch((error) => {
    logger?.warn?.(`dsh-android-tool: 初始化失败 ${error instanceof Error ? error.message : String(error)}`)
  })

  const settings = snapshotConfig(config)
  logger?.info?.(
    `dsh-android-tool: 已加载（adb: ${settings.adbPath || '随包默认'} · 无线: ${settings.wirelessHost || '未配置'}）`,
  )
}
