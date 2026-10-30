/**
 * 面向模型的 Android 工具。
 *
 * 注册在 host 层（所有会话可见）。工具名用 snake_case，与 DSH 自带工具一致。
 * 所有工具只做参数校验并转给 AndroidService；失败返回结构化 { ok:false, error }。
 */

const OUTPUT = {
  schema: { type: 'object', additionalProperties: true },
  render: (_args, value) => {
    const blocks = [{ type: 'text', text: JSON.stringify(value, null, 2) }]
    const image = value?.image
    if (image !== undefined && image !== null && typeof image.attachmentId === 'string') {
      blocks.push({ type: 'image', attachment: image })
    }
    return blocks
  },
}

/**
 * @param {object} deps
 * @param {import('./service.js').AndroidService} deps.service
 */
export function buildTools(deps) {
  const service = deps.service

  const view = {
    name: 'android_view',
    description: [
      'Capture the current screen of the selected Android device and return it as an image so you can see it.',
      'The screenshot is also pushed to the right-side "安卓设备" panel. Use it before/after any control action.',
      'Returns serial, model, current package/activity, width/height, capture time, and the image itself.',
    ].join('\n'),
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        serial: { type: 'string', description: 'Optional device serial. Defaults to the selected device in settings.' },
        savePath: { type: 'string', description: 'Optional absolute path to also save the PNG to.' },
        includeState: { type: 'boolean', description: 'Include current model/package/activity in the result. Default true.' },
      },
    },
    output: OUTPUT,
    isConcurrencySafe: () => false,
    timeoutMs: 40000,
    async execute(args) {
      return service.screencapture({
        serial: args?.serial,
        savePath: args?.savePath,
        includeState: args?.includeState !== false,
        mark: true,
      })
    },
    presentCall() {
      return { card: 'generic', title: 'Android 截图', kind: 'read' }
    },
  }

  const state = {
    name: 'android_state',
    description: [
      'Query the selected Android device status: model, brand, Android version, battery (level/temperature/charging),',
      'WiFi (enabled/SSID/IP/airplane mode), memory, storage, screen size/density/wakefulness, and the current foreground app.',
    ].join('\n'),
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        serial: { type: 'string', description: 'Optional device serial. Defaults to the selected device.' },
      },
    },
    output: OUTPUT,
    isConcurrencySafe: () => false,
    timeoutMs: 40000,
    async execute(args) {
      return service.deviceState({ serial: args?.serial })
    },
    presentCall() {
      return { card: 'generic', title: 'Android 设备状态', kind: 'read' }
    },
  }

  const control = {
    name: 'android_control',
    description: [
      'Simulate touch/key input on the selected Android device. When the live screen stream is running, it uses the',
      'low-latency scrcpy control channel (touch/key/text/scroll); otherwise it falls back to `adb shell input`. Actions:',
      '- tap: {x,y}; long_press: {x,y,durationMs}; swipe: {x1,y1,x2,y2,durationMs}',
      '- key: {key} (back/home/recents/enter/volume_up/volume_down/power/menu/wakeup or a numeric keycode)',
      '- text: {text} (scrcpy channel supports Unicode; adb fallback is ASCII only)',
      '- scroll: {direction: up|down|left|right, amount}; wake; open_app: {package}',
      'Coordinates are device-screen pixels; when using scrcpy they are scaled to video coordinates automatically.',
      'By default it captures a screenshot after the action and returns it as an image (capture:false to skip).',
    ].join('\n'),
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        action: {
          type: 'string',
          required: true,
          enum: ['tap', 'long_press', 'swipe', 'key', 'text', 'scroll', 'wake', 'open_app'],
          description: 'The input action.',
        },
        x: { type: 'number', description: 'Tap/long-press/swipe start X (device pixels).' },
        y: { type: 'number', description: 'Tap/long-press/swipe start Y (device pixels).' },
        x2: { type: 'number', description: 'Swipe end X.' },
        y2: { type: 'number', description: 'Swipe end Y.' },
        durationMs: { type: 'integer', description: 'Long-press / swipe duration in milliseconds.' },
        key: { type: 'string', description: 'Key name or numeric Android keycode.' },
        text: { type: 'string', description: 'ASCII text to type.' },
        direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], description: 'Scroll direction.' },
        amount: { type: 'integer', description: 'Scroll distance in pixels.' },
        package: { type: 'string', description: 'Package name for open_app.' },
        serial: { type: 'string', description: 'Optional device serial.' },
        capture: { type: 'boolean', description: 'Capture a screenshot after the action. Default true.' },
      },
    },
    output: OUTPUT,
    isConcurrencySafe: () => false,
    timeoutMs: 90000,
    async execute(args) {
      return service.control({
        action: args?.action,
        x: args?.x,
        y: args?.y,
        x2: args?.x2,
        y2: args?.y2,
        durationMs: args?.durationMs,
        key: args?.key,
        text: args?.text,
        direction: args?.direction,
        amount: args?.amount,
        package: args?.package,
        serial: args?.serial,
        capture: args?.capture !== false,
      })
    },
    presentCall(args) {
      return { card: 'generic', title: `Android ${String(args?.action ?? 'control')}`, kind: 'write' }
    },
  }

  const adb = {
    name: 'android_adb',
    description: [
      'Last-resort: run a raw adb command against the selected device using the plugin-configured adb.',
      'Prefer android_view / android_state / android_control for normal work; use this only when they cannot express it.',
      'mode=shell (default) runs `adb -s <serial> shell <command>`; mode=adb treats `command` as adb arguments.',
      'Returns exit code, stdout, stderr, elapsed time. Interactive commands are not supported and will time out.',
    ].join('\n'),
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        command: { type: 'string', required: true, description: 'Shell command (mode=shell) or adb argv (mode=adb).' },
        mode: { type: 'string', enum: ['shell', 'adb'], description: 'How to interpret command. Default shell.' },
        serial: { type: 'string', description: 'Optional device serial.' },
        timeoutMs: { type: 'integer', description: 'Timeout in milliseconds (default 20000, max 120000).' },
      },
    },
    output: OUTPUT,
    isConcurrencySafe: () => false,
    timeoutMs: 130000,
    async execute(args) {
      return service.adbCommand({
        command: args?.command,
        mode: args?.mode,
        serial: args?.serial,
        timeoutMs: args?.timeoutMs,
      })
    },
    presentCall(args) {
      return { card: 'generic', title: `adb ${String(args?.command ?? '').slice(0, 40)}`, kind: 'write' }
    },
  }

  return [view, state, control, adb]
}
