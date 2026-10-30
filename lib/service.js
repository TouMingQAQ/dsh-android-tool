/**
 * AndroidService：把 adb、logcat、性能、scrcpy 推流与独立窗口拼成一个门面。
 *
 * 对上层只暴露方法；所有方法都返回 `{ ok, ... }`，绝不抛。
 */

import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { resolveDataRoot, resolveExecutablePaths } from './config.js'
import { layoutAt } from './paths.js'
import { Adb, pickDevice, resolveKeyCode } from './adb.js'
import { LogcatService } from './logcat.js'
import { PerfService } from './perf.js'
import { parseBattery } from './perf.js'
import { ScrcpyStream } from './scrcpy-stream.js'
import { ScrcpyWindow } from './scrcpy-window.js'

/** 把 `wm size` 输出解析成 { width, height }。 */
export function parseWmSize(text) {
  const matches = [...String(text ?? '').matchAll(/(\d+)\s*x\s*(\d+)/giu)]
  if (matches.length === 0) return undefined
  const last = matches[matches.length - 1]
  return { width: Number(last[1]), height: Number(last[2]) }
}

/** 解析 df -k /data。 */
export function parseDf(text) {
  const lines = String(text ?? '').trim().split(/\r?\n/u)
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const parts = lines[index].trim().split(/\s+/u)
    if (parts.length < 6) continue
    const totalKb = Number(parts[1])
    const usedKb = Number(parts[2])
    const freeKb = Number(parts[3])
    if ([totalKb, usedKb, freeKb].every((value) => Number.isFinite(value))) {
      return { totalKb, usedKb, freeKb }
    }
  }
  return undefined
}

/** 解析 wifi 组合命令结果。 */
export function parseWifi(text) {
  const source = String(text ?? '')
  const enabledMatch = /Wi-?Fi is (enabled|disabled)/iu.exec(source)
  const ssidMatch = /SSID:\s*("?)([^"\r\n]*)\1/iu.exec(source)
  const ipMatch = /inet\s+(\d+\.\d+\.\d+\.\d+)/u.exec(source)
  const airplaneMatch = /==AIR\r?\n(\d+)/u.exec(source)
  return {
    enabled: enabledMatch !== null ? /enabled/iu.test(enabledMatch[1]) : undefined,
    ssid: ssidMatch !== null ? ssidMatch[2].trim() : undefined,
    ip: ipMatch !== null ? ipMatch[1] : undefined,
    airplaneMode: airplaneMatch !== null ? airplaneMatch[1] === '1' : undefined,
  }
}

export class AndroidService {
  /**
   * @param {object} options
   * @param {object} options.ctx
   * @param {() => object} options.getConfig
   * @param {string} options.pluginRoot
   * @param {() => string} [options.getProfileDir]
   * @param {() => string} [options.getHomeDir]
   * @param {object} [options.logger]
   */
  constructor(options) {
    this.ctx = options.ctx
    this.getConfig = options.getConfig
    this.pluginRoot = options.pluginRoot
    this.getProfileDir = options.getProfileDir ?? (() => process.env.DSH_PROFILE_DIR ?? '')
    this.getHomeDir = options.getHomeDir ?? (() => homedir())
    this.logger = options.logger

    this.adb = new Adb({ getConfig: options.getConfig, pluginRoot: options.pluginRoot, logger: options.logger })
    this.logcat = new LogcatService({ adb: this.adb, getConfig: options.getConfig, logger: options.logger })
    this.perf = new PerfService({ adb: this.adb, logger: options.logger })
    this.stream = new ScrcpyStream({ adb: this.adb, getConfig: options.getConfig, pluginRoot: options.pluginRoot, logger: options.logger })
    this.window = new ScrcpyWindow({ adb: this.adb, getConfig: options.getConfig, logger: options.logger })

    this.state = { deviceSerial: '', lastAddress: '' }
    this.stateLoaded = undefined
    this.agentActionAt = 0
    this.statePollCount = 0
    this.devicesCache = undefined
    this.deviceSize = undefined
    this.disposed = false
  }

  /** 取宿主服务。 */
  get(name) {
    try {
      return this.ctx?.get?.(name)
    } catch {
      return undefined
    }
  }

  /** 数据根目录。 */
  resolveDataRoot() {
    return resolveDataRoot({
      profileDir: String(this.getProfileDir() ?? '').trim(),
      homeDir: this.getHomeDir(),
      join,
    })
  }

  /** 确保数据目录存在。 */
  async ensureDirs() {
    const { root } = this.resolveDataRoot()
    const layout = layoutAt(root)
    try {
      await mkdir(layout.logsDir, { recursive: true })
      return { ok: true, layout }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /** 读运行期状态（只读一次）。 */
  async loadState() {
    if (this.stateLoaded !== undefined) return this.stateLoaded
    const { root } = this.resolveDataRoot()
    const layout = layoutAt(root)
    this.stateLoaded = (async () => {
      try {
        const text = await readFile(layout.stateFile, 'utf8')
        const parsed = JSON.parse(text)
        if (parsed !== null && typeof parsed === 'object') {
          this.state = {
            deviceSerial: typeof parsed.deviceSerial === 'string' ? parsed.deviceSerial : '',
            lastAddress: typeof parsed.lastAddress === 'string' ? parsed.lastAddress : '',
          }
        }
      } catch {
        // 文件不存在或损坏：用默认值
      }
      return this.state
    })()
    return this.stateLoaded
  }

  /** 原子写运行期状态。 */
  async saveState() {
    const { root } = this.resolveDataRoot()
    const layout = layoutAt(root)
    try {
      await mkdir(root, { recursive: true })
      const temp = `${layout.stateFile}.tmp`
      await writeFile(temp, JSON.stringify(this.state, null, 2), 'utf8')
      await rename(temp, layout.stateFile)
      return { ok: true }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /** 初始化：读状态 + 按需自动连接。 */
  async init() {
    await this.loadState()
    const settings = this.getConfig()
    if (settings.autoConnect === true && settings.wirelessHost.length > 0) {
      void this.adb.connect(settings.wirelessHost, settings.wirelessPort).then((result) => {
        if (result.ok === true) {
          this.state.lastAddress = result.target ?? ''
          void this.saveState()
        }
      })
    }
  }

  /** AI 用了工具 → 面板自动弹出。 */
  markAgentAction() {
    this.agentActionAt = Date.now()
  }

  /** 当前 adb 路径信息。 */
  adbInfo() {
    const paths = resolveExecutablePaths({
      pluginRoot: this.pluginRoot,
      adbPath: this.getConfig().adbPath,
      scrcpyPath: this.getConfig().scrcpyPath,
      join,
    })
    return {
      path: paths.adbPath,
      exists: existsSync(paths.adbPath),
      scrcpyPath: paths.scrcpyPath,
      scrcpyExists: existsSync(paths.scrcpyPath),
      serverExists: existsSync(paths.serverPath),
    }
  }

  /** 选一台设备（不抛）。 */
  async resolveDevice(preferred) {
    await this.loadState()
    const wanted = String(preferred ?? this.state.deviceSerial ?? '').trim()
    // 已经有一条活着的 scrcpy 连接时，直接认它，避免每次点击都 spawn 一次
    // `adb devices`——那会平白给每次触控加 50–100ms。
    if (this.stream.running === true && this.stream.serial.length > 0) {
      if (wanted.length === 0 || wanted === this.stream.serial) {
        return { ok: true, device: { serial: this.stream.serial, state: 'device' } }
      }
    }
    const picked = await this.adb.selectDevice(wanted)
    if (picked.ok === true && this.state.deviceSerial !== picked.device.serial) {
      this.state.deviceSerial = picked.device.serial
      void this.saveState()
    }
    return picked
  }

  /** 面板/设置页状态。 */
  async uiState() {
    this.statePollCount += 1
    await this.loadState()
    // 面板/自动打开/设置页都会打这个接口；缓存 1.5 秒，避免每秒 spawn 多次 adb。
    if (this.devicesCache === undefined || Date.now() - this.devicesCache.at > 1500) {
      this.devicesCache = { at: Date.now(), result: await this.adb.devices() }
    }
    const listed = this.devicesCache.result
    const picked = listed.ok === true ? pickDevice(listed.devices, this.state.deviceSerial) : { ok: false, error: listed.error }
    const chosen = picked.ok === true ? picked.device : undefined
    if (chosen !== undefined && this.state.deviceSerial !== chosen.serial) {
      this.state.deviceSerial = chosen.serial
      void this.saveState()
    }
    return {
      ok: true,
      adb: this.adbInfo(),
      devices: listed.devices ?? [],
      selectedSerial: chosen?.serial ?? this.state.deviceSerial ?? '',
      device: chosen ?? null,
      deviceError: chosen === undefined ? picked.error : undefined,
      stream: this.stream.status(),
      window: this.window.status(),
      logcat: {
        running: this.logcat.running,
        serial: this.logcat.serial,
        lines: this.logcat.entries.length,
        error: this.logcat.lastError || undefined,
      },
      previewFps: this.getConfig().previewFps,
      statePollCount: this.statePollCount,
      agentActionAt: this.agentActionAt,
    }
  }

  /** 当前前台应用。 */
  async currentApp(serial) {
    const result = await this.adb.shell(
      serial,
      "dumpsys activity activities 2>/dev/null | grep -E 'mResumedActivity|topResumedActivity' | head -n 1",
      { timeoutMs: 8000 },
    )
    if (result.ok !== true) return undefined
    const match = /([a-zA-Z][\w.]*\/[\w.$]+)/u.exec(result.stdout)
    if (match === null) return undefined
    return match[1]
  }

  /** 截图（返回 buffer + 可选图片附件）。 */
  async screencapture(input = {}) {
    const picked = await this.resolveDevice(input.serial)
    if (picked.ok !== true) return { ok: false, error: picked.error }
    const serial = picked.device.serial
    const shot = await this.adb.screencap(serial)
    if (shot.ok !== true) return { ok: false, error: shot.error, serial }

    let savedPath
    const explicit = String(input.savePath ?? '').trim()
    if (explicit.length > 0) {
      try {
        await mkdir(dirname(explicit), { recursive: true })
        await writeFile(explicit, shot.buffer)
        savedPath = explicit
      } catch {
        savedPath = undefined
      }
    }

    let image
    const attachments = this.get('attachments')
    if (attachments !== undefined && typeof attachments.saveImage === 'function') {
      try {
        const ref = await attachments.saveImage({
          data: shot.buffer,
          mediaType: 'image/png',
          name: `android-${serial.replace(/[^\w.-]/gu, '_')}.png`,
        })
        image = {
          attachmentId: ref.attachmentId,
          mediaType: ref.mediaType,
          bytes: ref.bytes,
          width: ref.width,
          height: ref.height,
          ...(ref.name === undefined ? {} : { name: ref.name }),
          ...(ref.originalDimensions === undefined ? {} : { originalDimensions: { ...ref.originalDimensions } }),
        }
      } catch {
        image = undefined
      }
    }

    if (input.mark !== false) this.markAgentAction()

    let current
    if (input.includeState !== false) {
      const app = await this.currentApp(serial)
      const model = await this.adb.shell(serial, 'getprop ro.product.model', { timeoutMs: 5000 })
      current = {
        model: model.ok === true ? model.stdout.trim() : '',
        activity: app ?? '',
        package: app !== undefined ? app.split('/')[0] : '',
      }
    }

    return {
      ok: true,
      serial,
      width: shot.width,
      height: shot.height,
      bytes: shot.buffer.length,
      path: savedPath,
      image,
      ...(current === undefined ? {} : current),
      capturedAt: Date.now(),
    }
  }

  /** 只取截图字节，给面板 <img> / 轮询用。 */
  async screenshotBuffer(serial) {
    const picked = await this.resolveDevice(serial)
    if (picked.ok !== true) return { ok: false, error: picked.error }
    const shot = await this.adb.screencap(picked.device.serial)
    return shot
  }

  /** 设备状态（电量 / WiFi / 存储 / 内存 / 屏幕 / 当前应用）。 */
  async deviceState(input = {}) {
    const picked = await this.resolveDevice(input.serial)
    if (picked.ok !== true) return { ok: false, error: picked.error }
    const serial = picked.device.serial

    const propsResult = await this.adb.shell(serial, 'getprop ro.product.model; getprop ro.product.brand; getprop ro.build.version.release; getprop ro.build.version.sdk; getprop ro.product.cpu.abi', { timeoutMs: 8000 })
    const props = propsResult.ok === true ? propsResult.stdout.split(/\r?\n/u) : []
    const [model = '', brand = '', android = '', sdk = '', abi = ''] = props.map((line) => line.trim())

    const batteryResult = await this.adb.shell(serial, 'dumpsys battery', { timeoutMs: 8000 })
    const battery = parseBattery(batteryResult.stdout)

    const wifiCommand = [
      "echo '==WIFI'",
      'cmd wifi status 2>/dev/null',
      "echo '==IP'",
      'ip -f inet addr show wlan0 2>/dev/null',
      "echo '==AIR'",
      'settings get global airplane_mode_on 2>/dev/null',
    ].join('; ')
    const wifiResult = await this.adb.shell(serial, wifiCommand, { timeoutMs: 8000 })
    const wifi = parseWifi(wifiResult.stdout)

    const memResult = await this.adb.shell(serial, 'cat /proc/meminfo', { timeoutMs: 8000 })
    const mem = parseMeminfoSafe(memResult.stdout)

    const dfResult = await this.adb.shell(serial, 'df -k /data', { timeoutMs: 8000 })
    const storage = parseDf(dfResult.stdout)

    const sizeResult = await this.adb.shell(serial, 'wm size; wm density', { timeoutMs: 8000 })
    const display = parseWmSize(sizeResult.stdout)
    const densityMatch = /Physical density:\s*(\d+)/iu.exec(sizeResult.stdout)

    const powerResult = await this.adb.shell(serial, "dumpsys power 2>/dev/null | grep -E 'mWakefulness=' | head -n 1", { timeoutMs: 8000 })
    const wakeMatch = /mWakefulness=(\w+)/u.exec(powerResult.stdout)

    const app = await this.currentApp(serial)

    return {
      ok: true,
      serial,
      model,
      brand,
      android,
      sdk,
      abi,
      battery,
      wifi,
      memory: mem,
      storage,
      display: display === undefined ? undefined : { ...display, density: densityMatch !== null ? Number(densityMatch[1]) : undefined },
      screen: { wakefulness: wakeMatch !== null ? wakeMatch[1] : undefined },
      current: app === undefined ? undefined : { activity: app, package: app.split('/')[0] },
      sampledAt: Date.now(),
    }
  }

  /**
   * 把设备物理坐标换算成 scrcpy 视频坐标。
   * 面板点击本来就来自视频坐标（input.videoCoords=true），AI 工具截图看到的是
   * 设备物理尺寸，所以只有工具调用需要换算。
   */
  async toVideoPoint(serial, x, y) {
    const width = this.stream.width || 0
    const height = this.stream.height || 0
    if (!(width > 0) || !(height > 0)) return undefined
    if (this.deviceSize === undefined || Date.now() - this.deviceSize.at > 5000) {
      const result = await this.adb.shell(serial, 'wm size', { timeoutMs: 5000 })
      const parsed = parseWmSize(result.stdout) ?? { width: 1080, height: 1920 }
      this.deviceSize = { at: Date.now(), ...parsed }
    }
    return {
      x: (Number(x) * width) / (this.deviceSize.width || width),
      y: (Number(y) * height) / (this.deviceSize.height || height),
    }
  }

  /** 模拟触屏 / 按键。优先走 scrcpy control 通道，延迟比 adb shell input 低很多。 */
  async control(input = {}) {
    const picked = await this.resolveDevice(input.serial)
    if (picked.ok !== true) return { ok: false, error: picked.error }
    const serial = picked.device.serial
    const action = String(input.action ?? '').trim()
    const stream = this.stream
    const fast = stream.controlReady()
    let result
    let used = 'adb'

    const point = async (x, y) => {
      if (input.videoCoords === true) return { x: Number(x), y: Number(y) }
      return (await this.toVideoPoint(serial, x, y)) ?? { x: Number(x), y: Number(y) }
    }

    if (action === 'tap') {
      if (fast) {
        const p = await point(input.x, input.y)
        result = (await stream.controlTap(p.x, p.y)) ? { ok: true } : { ok: false, error: 'scrcpy control 写入失败' }
        used = 'scrcpy'
      } else {
        result = await this.adb.tap(serial, input.x, input.y)
      }
    } else if (action === 'long_press') {
      const ms = Number(input.durationMs) || 700
      if (fast) {
        const p = await point(input.x, input.y)
        result = (await stream.controlSwipe(p.x, p.y, p.x, p.y, ms)) ? { ok: true } : { ok: false, error: 'scrcpy control 写入失败' }
        used = 'scrcpy'
      } else {
        result = await this.adb.swipe(serial, input.x, input.y, input.x, input.y, ms)
      }
    } else if (action === 'swipe') {
      const duration = input.durationMs ?? 300
      if (fast) {
        const a = await point(input.x, input.y)
        const b = await point(input.x2, input.y2)
        result = (await stream.controlSwipe(a.x, a.y, b.x, b.y, duration)) ? { ok: true } : { ok: false, error: 'scrcpy control 写入失败' }
        used = 'scrcpy'
      } else {
        result = await this.adb.swipe(serial, input.x, input.y, input.x2, input.y2, duration)
      }
    } else if (action === 'key') {
      const code = resolveKeyCode(input.key)
      if (fast && code !== undefined) {
        result = (await stream.controlKey(code)) ? { ok: true } : { ok: false, error: 'scrcpy control 写入失败' }
        used = 'scrcpy'
      } else {
        result = await this.adb.keyevent(serial, input.key)
      }
    } else if (action === 'text') {
      if (fast) {
        result = stream.controlText(input.text) ? { ok: true } : { ok: false, error: 'scrcpy control 写入失败' }
        used = 'scrcpy'
      } else {
        result = await this.adb.inputText(serial, input.text)
      }
    } else if (action === 'scroll') {
      const direction = String(input.direction ?? 'down')
      const amount = Math.max(1, (Number(input.amount) || 400) / 200)
      if (fast) {
        result = stream.controlScroll(direction, amount) ? { ok: true } : { ok: false, error: 'scrcpy control 写入失败' }
        used = 'scrcpy'
      } else {
        const size = parseWmSize((await this.adb.shell(serial, 'wm size', { timeoutMs: 5000 })).stdout) ?? { width: 1080, height: 1920 }
        const pixels = Math.max(50, Number(input.amount) || 400)
        const cx = Math.round(size.width / 2)
        const cy = Math.round(size.height / 2)
        if (direction === 'up') result = await this.adb.swipe(serial, cx, cy - pixels, cx, cy + pixels, 250)
        else if (direction === 'down') result = await this.adb.swipe(serial, cx, cy + pixels, cx, cy - pixels, 250)
        else if (direction === 'left') result = await this.adb.swipe(serial, cx - pixels, cy, cx + pixels, cy, 250)
        else result = await this.adb.swipe(serial, cx + pixels, cy, cx - pixels, cy, 250)
      }
    } else if (action === 'wake') {
      if (fast && stream.controlPower(true)) {
        result = { ok: true }
        used = 'scrcpy'
      } else {
        result = await this.adb.keyevent(serial, 'wakeup')
      }
    } else if (action === 'open_app') {
      const pkg = String(input.package ?? '').trim()
      if (pkg.length === 0) return { ok: false, error: 'open_app 需要 package 参数。' }
      result = await this.adb.shell(serial, `monkey -p ${pkg} -c android.intent.category.LAUNCHER 1`, { timeoutMs: 15000 })
    } else {
      return { ok: false, error: `不支持的 action：${action || '(空)'}` }
    }

    if (result.ok !== true) return { ok: false, error: result.error, serial, action }
    this.markAgentAction()

    if (input.capture === false) {
      return { ok: true, serial, action, via: used }
    }
    const shot = await this.screencapture({ serial, mark: true, includeState: true })
    return {
      ok: true,
      serial,
      action,
      via: used,
      ...(shot.ok === true
        ? {
            width: shot.width,
            height: shot.height,
            image: shot.image,
            model: shot.model,
            package: shot.package,
            activity: shot.activity,
          }
        : { screenshotError: shot.error }),
    }
  }

  /** 任意 adb 命令（最后兜底）。 */
  async adbCommand(input = {}) {
    const mode = String(input.mode ?? 'shell') === 'adb' ? 'adb' : 'shell'
    const command = String(input.command ?? '').trim()
    if (command.length === 0) return { ok: false, error: '命令为空。' }
    const timeoutMs = Math.max(1000, Math.min(120000, Number(input.timeoutMs) || 20000))

    let result
    if (mode === 'shell') {
      const picked = await this.resolveDevice(input.serial)
      if (picked.ok !== true) return { ok: false, error: picked.error }
      result = await this.adb.run(['shell', command], { serial: picked.device.serial, timeoutMs })
    } else {
      const args = splitArgsLoose(command)
      const serial = String(input.serial ?? '').trim()
      result = await this.adb.run(args, { serial, timeoutMs })
    }
    this.markAgentAction()
    return {
      ok: result.ok === true,
      mode,
      code: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
      truncated: result.truncated === true,
      elapsedMs: result.elapsedMs,
      error: result.ok === true ? undefined : result.error,
    }
  }

  /** 设置页 / 面板按钮。 */
  async humanCommand(body = {}) {
    await this.loadState()
    const action = String(body.action ?? '').trim()
    if (action === 'testAdb') return this.adb.version()
    if (action === 'refreshDevices') return this.adb.devices()
    if (action === 'select') {
      this.state.deviceSerial = String(body.serial ?? '').trim()
      const saved = await this.saveState()
      return { ok: saved.ok === true, selectedSerial: this.state.deviceSerial, error: saved.error }
    }
    if (action === 'connect') {
      const result = await this.adb.connect(body.host, body.port)
      if (result.ok === true) {
        this.state.lastAddress = result.target ?? ''
        void this.saveState()
      }
      return result
    }
    if (action === 'pair') return this.adb.pair(body.host, body.port, body.code)
    if (action === 'disconnect') return this.adb.disconnect(body.host, body.port)
    if (action === 'enableTcpip') {
      const picked = await this.resolveDevice(body.serial)
      if (picked.ok !== true) return { ok: false, error: picked.error }
      return this.adb.enableTcpip(picked.device.serial, body.port)
    }
    if (action === 'volume') {
      return this.control({
        action: 'key',
        key: Number(body.delta) >= 0 ? 'volume_up' : 'volume_down',
        serial: body.serial,
        capture: false,
        videoCoords: true,
      })
    }
    if (action === 'key') {
      return this.control({ action: 'key', key: body.key, serial: body.serial, capture: false, videoCoords: true })
    }
    if (action === 'tap' || action === 'swipe') {
      return this.control({ ...body, action, capture: false, videoCoords: true })
    }
    if (action === 'startScrcpy') {
      const picked = await this.resolveDevice(body.serial)
      if (picked.ok !== true) return { ok: false, error: picked.error }
      return this.window.launch(picked.device.serial)
    }
    if (action === 'stopScrcpy') return this.window.stop()
    if (action === 'startVideo') {
      const picked = await this.resolveDevice(body.serial)
      if (picked.ok !== true) return { ok: false, error: picked.error }
      return this.stream.start(picked.device.serial)
    }
    if (action === 'stopVideo') return this.stream.stop()
    if (action === 'logcatStart') {
      const picked = await this.resolveDevice(body.serial)
      if (picked.ok !== true) return { ok: false, error: picked.error }
      return this.logcat.ensure(picked.device.serial)
    }
    if (action === 'logcatStop') {
      this.logcat.stop()
      return { ok: true }
    }
    return { ok: false, error: `未知 action：${action || '(空)'}` }
  }

  /** 读 logcat。 */
  async logcatRead(options = {}) {
    const picked = await this.resolveDevice(options.serial)
    if (picked.ok !== true) return { ok: false, error: picked.error, entries: [], cursor: 0 }
    return this.logcat.read({ ...options, serial: picked.device.serial })
  }

  /** 运行中 / 已安装包名。 */
  async packages(options = {}) {
    const picked = await this.resolveDevice(options.serial)
    if (picked.ok !== true) return { ok: false, error: picked.error, running: [], installed: [], foreground: '' }
    return this.logcat.scanPackages(picked.device.serial)
  }

  /** 性能。 */
  async perfSample(options = {}) {
    const picked = await this.resolveDevice(options.serial)
    if (picked.ok !== true) return { ok: false, error: picked.error }
    const pkg = String(options.pkg ?? '').trim() || (await this.currentApp(picked.device.serial))?.split('/')[0] || ''
    return this.perf.sample(picked.device.serial, pkg)
  }

  /** 导出 logcat 到文件。 */
  async exportLogcat(filters = {}) {
    const picked = await this.resolveDevice(filters.serial)
    if (picked.ok !== true) return { ok: false, error: picked.error }
    await this.logcat.ensure(picked.device.serial)
    await this.logcat.ensurePidMap(picked.device.serial)
    const text = this.logcat.exportText(filters)
    const dirs = await this.ensureDirs()
    if (dirs.ok !== true) return { ok: false, error: dirs.error }
    const stamp = new Date().toISOString().replace(/[:.]/gu, '-')
    const filename = `logcat-${stamp}.txt`
    const path = join(dirs.layout.logsDir, filename)
    try {
      await writeFile(path, text, 'utf8')
      return { ok: true, path, filename, bytes: Buffer.byteLength(text), lines: text.length === 0 ? 0 : text.trimEnd().split('\n').length, serial: picked.device.serial }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  /** 当前 logcat 文本（下载用，不落盘）。 */
  async exportLogcatText(filters = {}) {
    const picked = await this.resolveDevice(filters.serial)
    if (picked.ok !== true) return { ok: false, error: picked.error, text: '' }
    await this.logcat.ensure(picked.device.serial)
    await this.logcat.ensurePidMap(picked.device.serial)
    return { ok: true, text: this.logcat.exportText(filters), serial: picked.device.serial }
  }

  /** scrcpy 推流。 */
  startVideo(serial) {
    return this.stream.start(serial)
  }

  stopVideo() {
    return this.stream.stop()
  }

  videoStatus() {
    return this.stream.status()
  }

  handleVideoUpgrade(req, socket, head) {
    return this.stream.handleUpgrade(req, socket, head)
  }

  /** 插件卸载。 */
  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.window.dispose()
    this.logcat.dispose()
    this.stream.dispose()
  }
}

/** 避免循环 import：本文件已 import parseMeminfo 的兄弟函数，这里直接用。 */
function parseMeminfoSafe(text) {
  const values = {}
  for (const line of String(text ?? '').split(/\r?\n/u)) {
    const match = /^(MemTotal|MemFree|MemAvailable):\s+(\d+)/u.exec(line.trim())
    if (match !== null) values[match[1]] = Number(match[2])
  }
  const totalKb = values.MemTotal ?? 0
  const availableKb = values.MemAvailable ?? values.MemFree ?? 0
  return {
    totalMb: Math.round(totalKb / 1024),
    usedMb: Math.round(Math.max(0, totalKb - availableKb) / 1024),
    availableMb: Math.round(availableKb / 1024),
  }
}

/** 宽松拆 adb 参数。 */
function splitArgsLoose(text) {
  const out = []
  let current = ''
  let quote = ''
  for (const char of String(text ?? '')) {
    if (quote !== '') {
      if (char === quote) quote = ''
      else current += char
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (/\s/u.test(char)) {
      if (current.length > 0) {
        out.push(current)
        current = ''
      }
      continue
    }
    current += char
  }
  if (current.length > 0) out.push(current)
  return out
}
