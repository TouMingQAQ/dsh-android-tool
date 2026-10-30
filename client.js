// dsh-android-tool 的浏览器半边：右侧「安卓设备」四 Tab + 设置里的「安卓调试」。
//
// 约束与其它 dsh-yisu 子插件一致：
//   1. 自注册脚本：window.__ModuleLoader__.load({ id, factory })，不 import；
//   2. 只 require('react')，其余能力走 /x-android-tool 的 HTTP/WS；
//   3. apply 绝不抛：一侧注册失败不影响另一侧。
window.__ModuleLoader__.load({
  id: 'dsh-android-tool',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    const API = '/x-android-tool'
    const TAB_KIND = 'android-tool'
    const TAB_ID = 'dsh-android-tool'
    const AUTO_OPEN_KEY = 'dsh-android-tool.lastOpenedAt'

    const S = {
      root: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'var(--dsw-alias-bg-base, transparent)',
        color: 'inherit',
      },
      header: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 8px',
        borderBottom: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.24))',
        flexWrap: 'wrap',
      },
      tabBar: { display: 'flex', gap: 4, flex: 1, minWidth: 0, flexWrap: 'wrap' },
      tab: {
        font: 'inherit',
        fontSize: 12.5,
        lineHeight: '20px',
        padding: '2px 9px',
        borderRadius: 999,
        border: '1px solid transparent',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        opacity: 0.72,
      },
      tabActive: {
        borderColor: 'var(--dsw-alias-border-l2, rgba(127,127,127,.38))',
        background: 'var(--dsw-alias-fill-l2, rgba(127,127,127,.12))',
        opacity: 1,
      },
      device: {
        font: 'inherit',
        fontSize: 12,
        maxWidth: 200,
        padding: '3px 6px',
        borderRadius: 6,
        border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.38))',
        background: 'transparent',
        color: 'inherit',
      },
      body: { flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
      toolbar: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 9px',
        borderBottom: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.18))',
        flexWrap: 'wrap',
      },
      btn: {
        font: 'inherit',
        fontSize: 12.5,
        lineHeight: '20px',
        minWidth: 28,
        padding: '2px 8px',
        borderRadius: 6,
        border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.38))',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
      },
      btnPrimary: {
        font: 'inherit',
        fontSize: 12.5,
        lineHeight: '20px',
        padding: '3px 12px',
        borderRadius: 6,
        border: '1px solid var(--dsw-alias-accent, #3b82f6)',
        background: 'var(--dsw-alias-accent, #3b82f6)',
        color: '#fff',
        cursor: 'pointer',
      },
      btnDisabled: { opacity: 0.4, cursor: 'default' },
      input: {
        font: 'inherit',
        fontSize: 12.5,
        padding: '3px 7px',
        borderRadius: 6,
        border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.38))',
        background: 'transparent',
        color: 'inherit',
        boxSizing: 'border-box',
      },
      grow: { flex: 1, minWidth: 100 },
      screenWrap: { flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' },
      canvas: { width: '100%', height: '100%', display: 'block', touchAction: 'none', cursor: 'crosshair' },
      empty: {
        margin: '28px 16px',
        padding: '14px 16px',
        borderRadius: 10,
        border: '1px dashed var(--dsw-alias-border-l2, rgba(127,127,127,.35))',
        opacity: 0.78,
        fontSize: 13,
        lineHeight: 1.65,
        textAlign: 'center',
        maxWidth: 460,
      },
      statusBar: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 9px',
        borderTop: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.18))',
        fontSize: 11.5,
        opacity: 0.8,
        flexWrap: 'wrap',
      },
      chip: (ok) => ({
        fontSize: 11,
        padding: '0 7px',
        borderRadius: 999,
        border: '1px solid currentColor',
        color: ok ? 'var(--dsw-alias-text-positive, #2e8b57)' : 'var(--dsw-alias-text-warning, #c98a00)',
      }),
      err: {
        margin: '6px 9px',
        padding: '5px 9px',
        borderRadius: 6,
        fontSize: 12,
        color: 'var(--dsw-alias-text-warning, #c98a00)',
        background: 'var(--dsw-alias-fill-l2, rgba(127,127,127,.08))',
        whiteSpace: 'pre-wrap',
      },
      muted: { opacity: 0.68, fontSize: 12, lineHeight: 1.6 },
      mono: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
      logBox: { flex: 1, minHeight: 0, overflow: 'auto', padding: '4px 8px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 11.5, lineHeight: 1.55 },
      logRow: { display: 'flex', gap: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', padding: '1px 0' },
      logTime: { opacity: 0.5, flex: '0 0 auto' },
      logTag: { opacity: 0.82, flex: '0 0 auto', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis' },
      logMsg: { flex: 1, minWidth: 0 },
      perfWrap: { flex: 1, minHeight: 0, overflow: 'auto', padding: 10, display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', alignContent: 'start' },
      card: { border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.28))', borderRadius: 10, padding: '10px 12px', background: 'var(--dsw-alias-fill-l2, rgba(127,127,127,.05))' },
      cardTitle: { fontSize: 12, opacity: 0.7, marginBottom: 6 },
      big: { fontSize: 26, fontWeight: 600, lineHeight: 1.1 },
      bar: { height: 6, borderRadius: 99, background: 'rgba(127,127,127,.2)', overflow: 'hidden', marginTop: 6 },
      barFill: (pct) => ({ height: '100%', width: `${Math.max(0, Math.min(100, Number(pct) || 0))}%`, background: 'var(--dsw-alias-accent, #3b82f6)' }),
      cmdWrap: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
      pre: { flex: 1, minHeight: 0, overflow: 'auto', margin: '0 9px 9px', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.25))', background: 'rgba(0,0,0,.12)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 11.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
      page: { padding: '18px 20px 40px', maxWidth: 760 },
      pageTitle: { fontSize: 17, fontWeight: 600, margin: '0 0 4px' },
      section: { marginTop: 16 },
      field: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 },
      fieldLabel: { fontSize: 12.5, display: 'flex', justifyContent: 'space-between', gap: 10 },
      fieldKey: { opacity: 0.45, fontSize: 11, fontFamily: 'ui-monospace, monospace' },
      row: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 },
      table: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
      th: { textAlign: 'left', padding: '5px 8px', borderBottom: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.28))', opacity: 0.65, fontWeight: 500 },
      td: { padding: '5px 8px', borderBottom: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.14))' },
    }

    async function requestJson(url, body) {
      try {
        const options =
          body === undefined
            ? { headers: { accept: 'application/json' } }
            : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
        const response = await fetch(url, options)
        const text = await response.text()
        if (text.length === 0) return { ok: response.ok }
        try {
          return JSON.parse(text)
        } catch {
          return { ok: false, error: text.slice(0, 200) }
        }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    }

    function readCursor() {
      try {
        return Number(window.localStorage.getItem(AUTO_OPEN_KEY) ?? '0') || 0
      } catch {
        return 0
      }
    }
    function writeCursor(value) {
      try {
        window.localStorage.setItem(AUTO_OPEN_KEY, String(value))
      } catch {
        // 忽略
      }
    }

    function fmtPct(value) {
      return value === undefined || value === null || Number.isNaN(Number(value)) ? '—' : `${Number(value)}%`
    }

    /**
     * 视频帧渲染器：优先 WebGL，失败退回 Canvas 2D。
     *
     * 参考 ya-webadb（Tango）的 scrcpy 播放器思路：
     *   - canvas 的 **CSS 尺寸固定** 为面板可视区，视频做 letterbox 适配；
     *     不再让 canvas 的 width/height 跟着每一帧的分辨率跳，所以不会“一会儿大一会儿小”；
     *   - 解码回调只保存“最新一帧”，用 requestAnimationFrame 合并绘制；
     *     上一帧还没画完就直接丢掉，避免延迟越积越大。
     */
    function createFrameRenderer(canvas) {
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1))
      let gl
      let program
      let positionBuffer
      let texcoordBuffer
      let texture
      let mode = '2d'
      let context2d
      let pendingFrame
      let raf = 0
      let lastW = 0
      let lastH = 0

      // Canvas 2D 渲染器：稳妥、兼容性最好。只保留最新一帧 + 固定画布尺寸做 letterbox，
      // 这正是 ya-webadb 播放器最关键的两点（帧合并 + 不随分辨率改画布）。
      const twoD = canvas.getContext('2d')
      if (twoD) {
        const fit = (cw, ch, sw, sh) => {
          if (!(sw > 0) || !(sh > 0)) return { x: 0, y: 0, width: cw, height: ch }
          const scale = Math.min(cw / sw, ch / sh)
          const width = Math.max(1, Math.floor(sw * scale))
          const height = Math.max(1, Math.floor(sh * scale))
          return { x: Math.floor((cw - width) / 2), y: Math.floor((ch - height) / 2), width, height }
        }
        const size = () => {
          const parent = canvas.parentElement
          const width = Math.max(1, Math.floor((parent?.clientWidth || 640) * dpr))
          const height = Math.max(1, Math.floor((parent?.clientHeight || 360) * dpr))
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width
            canvas.height = height
          }
        }
        let pending
        let pendingRaf = 0
        let rendered = 0
        let renderedAt = window.performance.now()
        let currentFps = 0
        const paint = () => {
          pendingRaf = 0
          const frame = pending
          pending = undefined
          if (frame === undefined) return
          rendered += 1
          const now = window.performance.now()
          if (now - renderedAt >= 1000) {
            currentFps = Math.round((rendered * 1000) / (now - renderedAt))
            rendered = 0
            renderedAt = now
          }
          try {
            size()
            const viewport = fit(canvas.width, canvas.height, frame.displayWidth || frame.codedWidth, frame.displayHeight || frame.codedHeight)
            twoD.fillStyle = '#000'
            twoD.fillRect(0, 0, canvas.width, canvas.height)
            twoD.drawImage(frame, viewport.x, viewport.y, viewport.width, viewport.height)
          } catch {
            // 单帧失败不影响后续
          }
          try {
            frame.close()
          } catch {
            // 忽略
          }
        }
        const schedule = () => {
          if (pendingRaf !== 0) return
          pendingRaf = window.requestAnimationFrame(paint)
        }
        return {
          mode: '2d',
          get fps() {
            return currentFps
          },
          drawFrame(frame) {
            if (pending !== undefined) {
              try {
                pending.close()
              } catch {
                // 忽略
              }
            }
            pending = frame
            schedule()
          },
          drawImage(image) {
            size()
            const viewport = fit(canvas.width, canvas.height, image.naturalWidth || image.width, image.naturalHeight || image.height)
            twoD.fillStyle = '#000'
            twoD.fillRect(0, 0, canvas.width, canvas.height)
            twoD.drawImage(image, viewport.x, viewport.y, viewport.width, viewport.height)
          },
          dispose() {
            if (pendingRaf !== 0) window.cancelAnimationFrame(pendingRaf)
            pendingRaf = 0
            if (pending !== undefined) {
              try {
                pending.close()
              } catch {
                // 忽略
              }
            }
            pending = undefined
          },
        }
      }

      const fitViewport = (canvasWidth, canvasHeight, sourceWidth, sourceHeight) => {
        if (!(sourceWidth > 0) || !(sourceHeight > 0)) return { x: 0, y: 0, width: canvasWidth, height: canvasHeight }
        const scale = Math.min(canvasWidth / sourceWidth, canvasHeight / sourceHeight)
        const width = Math.max(1, Math.floor(sourceWidth * scale))
        const height = Math.max(1, Math.floor(sourceHeight * scale))
        return { x: Math.floor((canvasWidth - width) / 2), y: Math.floor((canvasHeight - height) / 2), width, height }
      }

      const sizeCanvas = () => {
        const parent = canvas.parentElement
        const width = Math.max(1, Math.floor((parent?.clientWidth || canvas.clientWidth || 640) * dpr))
        const height = Math.max(1, Math.floor((parent?.clientHeight || canvas.clientHeight || 360) * dpr))
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width
          canvas.height = height
        }
      }

      const compile = (glContext, type, source) => {
        const shader = glContext.createShader(type)
        glContext.shaderSource(shader, source)
        glContext.compileShader(shader)
        if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
          throw new Error(glContext.getShaderInfoLog(shader) || 'shader compile failed')
        }
        return shader
      }

      const initWebgl = () => {
        try {
          gl = canvas.getContext('webgl2', { alpha: false, antialias: false, desynchronized: true }) ||
            canvas.getContext('webgl', { alpha: false, antialias: false, desynchronized: true })
          if (!gl) return false
          const vertex = compile(gl, gl.VERTEX_SHADER, [
            'attribute vec2 a_position;',
            'attribute vec2 a_texcoord;',
            'varying vec2 v_texcoord;',
            'void main() { gl_Position = vec4(a_position, 0.0, 1.0); v_texcoord = a_texcoord; }',
          ].join('\n'))
          const fragment = compile(gl, gl.FRAGMENT_SHADER, [
            'precision mediump float;',
            'varying vec2 v_texcoord;',
            'uniform sampler2D u_texture;',
            'void main() { gl_FragColor = texture2D(u_texture, v_texcoord); }',
          ].join('\n'))
          program = gl.createProgram()
          gl.attachShader(program, vertex)
          gl.attachShader(program, fragment)
          gl.linkProgram(program)
          if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'program link failed')
          gl.useProgram(program)

          positionBuffer = gl.createBuffer()
          gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
          const positionLocation = gl.getAttribLocation(program, 'a_position')
          gl.enableVertexAttribArray(positionLocation)
          gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

          texcoordBuffer = gl.createBuffer()
          gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer)
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW)
          const texcoordLocation = gl.getAttribLocation(program, 'a_texcoord')
          gl.enableVertexAttribArray(texcoordLocation)
          gl.vertexAttribPointer(texcoordLocation, 2, gl.FLOAT, false, 0, 0)

          texture = gl.createTexture()
          gl.bindTexture(gl.TEXTURE_2D, texture)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
          gl.clearColor(0, 0, 0, 1)
          mode = 'webgl'
          return true
        } catch {
          gl = undefined
          return false
        }
      }

      if (!initWebgl()) {
        context2d = canvas.getContext('2d')
        mode = context2d ? '2d' : 'none'
      }

      const paint = () => {
        raf = 0
        const frame = pendingFrame
        pendingFrame = undefined
        if (frame === undefined) return
        const sourceWidth = frame.displayWidth || frame.codedWidth || 0
        const sourceHeight = frame.displayHeight || frame.codedHeight || 0
        sizeCanvas()
        if (mode === 'webgl') {
          try {
            const viewport = fitViewport(canvas.width, canvas.height, sourceWidth, sourceHeight)
            gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height)
            gl.clear(gl.COLOR_BUFFER_BIT)
            gl.bindTexture(gl.TEXTURE_2D, texture)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, frame)
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
          } catch {
            // 一帧失败不影响后续
          }
        } else if (mode === '2d') {
          try {
            const viewport = fitViewport(canvas.width, canvas.height, sourceWidth, sourceHeight)
            context2d.fillStyle = '#000'
            context2d.fillRect(0, 0, canvas.width, canvas.height)
            context2d.drawImage(frame, viewport.x, viewport.y, viewport.width, viewport.height)
          } catch {
            // 忽略
          }
        }
        try {
          frame.close()
        } catch {
          // 忽略
        }
      }

      const schedule = () => {
        if (raf !== 0) return
        raf = window.requestAnimationFrame(paint)
      }

      return {
        get mode() {
          return mode
        },
        drawFrame(frame) {
          if (pendingFrame !== undefined) {
            try {
              pendingFrame.close()
            } catch {
              // 忽略
            }
          }
          pendingFrame = frame
          schedule()
        },
        drawImage(image) {
          const parent = canvas.parentElement
          const width = Math.max(1, Math.floor((parent?.clientWidth || 640) * dpr))
          const height = Math.max(1, Math.floor((parent?.clientHeight || 360) * dpr))
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width
            canvas.height = height
            lastW = width
            lastH = height
          }
          if (mode === '2d' && context2d) {
            const viewport = fitViewport(canvas.width, canvas.height, image.naturalWidth || image.width, image.naturalHeight || image.height)
            context2d.fillStyle = '#000'
            context2d.fillRect(0, 0, canvas.width, canvas.height)
            context2d.drawImage(image, viewport.x, viewport.y, viewport.width, viewport.height)
            return
          }
          // WebGL 画图片要走 canvas 中转
          try {
            const off = document.createElement('canvas')
            off.width = image.naturalWidth || image.width
            off.height = image.naturalHeight || image.height
            off.getContext('2d').drawImage(image, 0, 0)
            const bitmap = off
            const viewport = fitViewport(canvas.width, canvas.height, off.width, off.height)
            gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height)
            gl.clear(gl.COLOR_BUFFER_BIT)
            gl.bindTexture(gl.TEXTURE_2D, texture)
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap)
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
          } catch {
            // 忽略
          }
        },
        dispose() {
          if (raf !== 0) window.cancelAnimationFrame(raf)
          raf = 0
          if (pendingFrame !== undefined) {
            try {
              pendingFrame.close()
            } catch {
              // 忽略
            }
          }
          pendingFrame = undefined
        },
      }
    }

    function levelColor(level) {
      return (
        {
          V: 'var(--dsw-alias-text-secondary, #8a8a8a)',
          D: 'var(--dsw-alias-text-info, #4f9cf9)',
          I: 'var(--dsw-alias-text-positive, #2e8b57)',
          W: 'var(--dsw-alias-text-warning, #c98a00)',
          E: 'var(--dsw-alias-text-danger, #e5534b)',
          F: 'var(--dsw-alias-text-danger, #e5534b)',
          S: 'var(--dsw-alias-text-danger, #e5534b)',
        }[String(level).toUpperCase()] ?? 'inherit'
      )
    }

    // ── 面板主体 ────────────────────────────────────────────────────────────
    function AndroidPanel() {
      const [tab, setTab] = React.useState('screen')
      const [state, setState] = React.useState(undefined)
      const [error, setError] = React.useState('')

      const refresh = React.useCallback(async () => {
        const next = await requestJson(`${API}/state.json`)
        if (next !== undefined && next !== null) {
          setState(next)
          if (next.ok === false && next.error) setError(next.error)
        }
      }, [])

      React.useEffect(() => {
        let stopped = false
        let timer
        const tick = async () => {
          await refresh()
          if (!stopped) timer = window.setTimeout(tick, 2000)
        }
        void tick()
        return () => {
          stopped = true
          if (timer !== undefined) window.clearTimeout(timer)
        }
      }, [refresh])

      const choose = async (serial) => {
        await requestJson(`${API}/command`, { action: 'select', serial })
        await refresh()
      }

      const tabs = [
        { id: 'screen', label: '界面' },
        { id: 'logcat', label: 'Logcat' },
        { id: 'perf', label: '性能' },
        { id: 'command', label: '指令' },
      ]

      let content
      if (tab === 'screen') content = h(ScreenTab, { state, refresh })
      else if (tab === 'logcat') content = h(LogcatTab, { state, refresh })
      else if (tab === 'perf') content = h(PerfTab, { state, refresh })
      else content = h(CommandTab, { state, refresh })

      const devices = Array.isArray(state?.devices) ? state.devices : []
      return h(
        'div',
        { style: S.root, 'data-dsh-android-tool': '' },
        h(
          'div',
          { style: S.header },
          h(
            'div',
            { style: S.tabBar, role: 'tablist' },
            tabs.map((item) =>
              h(
                'button',
                {
                  key: item.id,
                  type: 'button',
                  role: 'tab',
                  'aria-selected': tab === item.id,
                  style: tab === item.id ? { ...S.tab, ...S.tabActive } : S.tab,
                  onClick: () => setTab(item.id),
                },
                item.label,
              ),
            ),
          ),
          h(
            'select',
            {
              style: S.device,
              value: state?.selectedSerial ?? '',
              title: '当前调试设备',
              onChange: (event) => void choose(event.target.value),
            },
            devices.length === 0
              ? h('option', { value: '' }, '无设备')
              : devices.map((device) =>
                  h(
                    'option',
                    { key: device.serial, value: device.serial },
                    `${device.model || device.serial}${device.state === 'device' ? '' : ` (${device.state})`}`,
                  ),
                ),
          ),
        ),
        state?.deviceError || error ? h('div', { style: S.err }, state?.deviceError || error) : null,
        content,
      )
    }

    // ── Tab1 界面 ──────────────────────────────────────────────────────────
    function ScreenTab({ state }) {
      const canvasRef = React.useRef(null)
      const metaRef = React.useRef(undefined)
      const decoderRef = React.useRef(undefined)
      const rendererRef = React.useRef(undefined)
      const wsRef = React.useRef(undefined)
      const pollRef = React.useRef(undefined)
      const modeRef = React.useRef('idle')
      const pointerRef = React.useRef(undefined)
      const [mode, setMode] = React.useState('idle')
      const [error, setError] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [fps, setFps] = React.useState(0)

      const setModeBoth = (next) => {
        modeRef.current = next
        setMode(next)
      }

      const stopPoll = () => {
        if (pollRef.current !== undefined) {
          window.clearInterval(pollRef.current)
          pollRef.current = undefined
        }
      }

      const stopWs = () => {
        if (wsRef.current !== undefined) {
          const ws = wsRef.current
          wsRef.current = undefined
          try {
            ws.close()
          } catch {
            // 忽略
          }
        }
      }

      const ensureRenderer = () => {
        if (rendererRef.current === undefined && canvasRef.current !== null) {
          rendererRef.current = createFrameRenderer(canvasRef.current)
        }
        return rendererRef.current
      }

      const setupCanvas = (meta) => {
        // canvas 的尺寸由面板决定，视频只做 letterbox；不要在每帧里改 canvas.width，
        // 否则横竖屏/分辨率一变，画面就会突然放大缩小。
        metaRef.current = meta
        ensureRenderer()
      }

      const configureDecoder = (meta) => {
        if (typeof window.VideoDecoder === 'undefined') {
          startPoll()
          return
        }
        const previous = metaRef.current
        if (decoderRef.current !== undefined && previous !== undefined && previous.codec === meta.codec) {
          metaRef.current = meta
          setupCanvas(meta)
          return
        }
        try {
          decoderRef.current?.close?.()
        } catch {
          // 忽略
        }
        metaRef.current = meta
        setupCanvas(meta)
        try {
          const decoder = new window.VideoDecoder({
            output: (frame) => {
              const renderer = ensureRenderer()
              if (renderer === undefined) {
                frame.close()
                return
              }
              // 只保留最新帧，由 requestAnimationFrame 合并绘制；渲染器负责 close(frame)
              renderer.drawFrame(frame)
            },
            error: (decoderError) => {
              setError(`视频解码失败：${decoderError?.message ?? String(decoderError)}，已切换截图模式。`)
              startPoll()
            },
          })
          decoder.configure({ codec: meta.codec || 'avc1.42e01e', optimizeForLatency: true })
          decoderRef.current = decoder
        } catch (decoderError) {
          setError(`初始化视频解码失败：${decoderError?.message ?? String(decoderError)}，已切换截图模式。`)
          startPoll()
        }
      }

      const decodeFrame = (buffer) => {
        const decoder = decoderRef.current
        if (decoder === undefined) return
        try {
          const view = new DataView(buffer)
          if (view.byteLength < 10) return
          const flags = view.getUint8(0)
          const isKey = (flags & 1) === 1
          // 实时优先：解码积压时丢掉非关键帧，避免延迟越滚越大。
          if (decoder.decodeQueueSize > 30 && !isKey) return
          const timestamp = view.getFloat64(1)
          const payload = new Uint8Array(buffer, 9)
          decoder.decode(
            new window.EncodedVideoChunk({
              type: isKey ? 'key' : 'delta',
              timestamp: Math.max(0, Math.round(timestamp)),
              data: payload,
            }),
          )
        } catch (decodeError) {
          setError(`送入解码器失败：${decodeError?.message ?? String(decodeError)}`)
        }
      }

      const openWs = () => {
        // 实时流与截图轮询必须互斥：两个同时画到同一张 canvas 上会一边 1024×608、
        // 一边 1200×2000 地来回改尺寸，看起来就是“画面一会儿大一会儿小”，而且卡。
        stopPoll()
        stopWs()
        const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
        let ws
        try {
          ws = new WebSocket(`${scheme}://${window.location.host}${API}/video.ws`)
        } catch (wsError) {
          setError(`WebSocket 打开失败：${wsError?.message ?? String(wsError)}`)
          startPoll()
          return
        }
        ws.binaryType = 'arraybuffer'
        wsRef.current = ws
        ws.onopen = () => {
          setModeBoth('live')
          setError('')
        }
        ws.onmessage = (event) => {
          if (typeof event.data === 'string') {
            try {
              const message = JSON.parse(event.data)
              if (message.type === 'meta') {
                setError('')
                configureDecoder(message)
              } else if (message.type === 'status' && message.running === false && message.error) setError(message.error)
            } catch {
              // 忽略非 JSON
            }
            return
          }
          decodeFrame(event.data)
        }
        ws.onerror = () => {
          if (wsRef.current === ws) setError('视频流连接失败，已切换截图模式。')
        }
        ws.onclose = () => {
          if (wsRef.current !== ws) return
          wsRef.current = undefined
          if (modeRef.current === 'live') startPoll()
        }
      }

      const startPoll = () => {
        stopWs()
        stopPoll()
        try {
          decoderRef.current?.close?.()
        } catch {
          // 忽略
        }
        decoderRef.current = undefined
        metaRef.current = undefined
        setModeBoth('poll')
        const fps = Math.max(1, Math.min(10, Number(state?.previewFps) || 3))
        let stopped = false
        const tick = () => {
          if (stopped) return
          const image = new Image()
          image.onload = () => {
            ensureRenderer()?.drawImage(image)
          }
          image.onerror = () => {
            // 截图还不可用（例如视频刚启动）时静默重试
          }
          image.src = `${API}/screenshot.png?t=${Date.now()}${state?.selectedSerial ? `&serial=${encodeURIComponent(state.selectedSerial)}` : ''}`
        }
        tick()
        pollRef.current = window.setInterval(tick, Math.round(1000 / fps))
        void stopped
      }

      const stopAll = () => {
        stopWs()
        stopPoll()
        try {
          decoderRef.current?.close?.()
        } catch {
          // 忽略
        }
        decoderRef.current = undefined
        metaRef.current = undefined
        rendererRef.current?.dispose?.()
        rendererRef.current = undefined
        setModeBoth('idle')
      }

      const startVideo = async () => {
        if (!state?.selectedSerial) {
          setError('没有选中设备，请先在设置里连接并选择设备。')
          return
        }
        setBusy(true)
        setError('')
        openWs()
        const result = await requestJson(`${API}/command`, { action: 'startVideo', serial: state.selectedSerial })
        if (result?.ok !== true) {
          setError(result?.error ?? '启动视频失败，已切换截图模式。')
          startPoll()
        }
        setBusy(false)
      }

      React.useEffect(() => {
        const timer = window.setInterval(() => {
          setFps(rendererRef.current?.fps ?? 0)
        }, 1000)
        return () => window.clearInterval(timer)
      }, [])

      React.useEffect(() => {
        if (state?.selectedSerial) void startVideo()
        else stopAll()
        return () => {
          stopAll()
          // 离开界面 tab / 面板时把 host 侧推流也停掉，别让 scrcpy server 白跑。
          void requestJson(`${API}/command`, { action: 'stopVideo' })
        }
        // 只在设备变化时重开
      }, [state?.selectedSerial])

      const post = async (action, extra) => {
        const result = await requestJson(`${API}/command`, { action, serial: state?.selectedSerial, ...extra })
        if (result?.ok !== true) setError(result?.error ?? '操作失败')
        return result
      }

      const canvasPoint = (event) => {
        const canvas = canvasRef.current
        const meta = metaRef.current
        if (canvas === null || meta === undefined) return undefined
        const rect = canvas.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return undefined
        return {
          x: Math.round(((event.clientX - rect.left) / rect.width) * meta.width),
          y: Math.round(((event.clientY - rect.top) / rect.height) * meta.height),
        }
      }

      /** 走已建立的视频 WebSocket 发触控，省掉每次 HTTP 往返。 */
      const sendWsTouch = (action, point) => {
        const ws = wsRef.current
        if (ws === undefined || ws.readyState !== 1 || point === undefined) return false
        try {
          ws.send(JSON.stringify({ type: 'touch', action, x: point.x, y: point.y }))
          return true
        } catch {
          return false
        }
      }

      const onPointerDown = (event) => {
        const point = canvasPoint(event)
        if (point === undefined) return
        const sent = sendWsTouch('down', point)
        pointerRef.current = { start: point, last: point, at: Date.now(), lastSentAt: 0, sent }
        try {
          event.currentTarget.setPointerCapture?.(event.pointerId)
        } catch {
          // 忽略
        }
      }

      const onPointerMove = (event) => {
        const state = pointerRef.current
        if (state === undefined || state.sent !== true) return
        if ((event.buttons & 1) !== 1 && event.pointerType === 'mouse') return
        const point = canvasPoint(event)
        if (point === undefined) return
        const now = Date.now()
        // 最高约 60Hz，别把没有变化的消息塞满 WebSocket。
        if (now - state.lastSentAt < 16 && Math.hypot(point.x - state.last.x, point.y - state.last.y) < 2) return
        state.last = point
        state.lastSentAt = now
        sendWsTouch('move', point)
      }

      const finishPointer = (event, cancelled) => {
        const state = pointerRef.current
        pointerRef.current = undefined
        if (state === undefined) return
        const point = canvasPoint(event) ?? state.last
        if (state.sent === true) {
          sendWsTouch(cancelled ? 'cancel' : 'up', point)
          return
        }
        // 截图模式（没有 WebSocket）才退回 HTTP 的 tap/swipe。
        const distance = Math.hypot(point.x - state.start.x, point.y - state.start.y)
        if (distance < 14) void post('tap', { x: point.x, y: point.y })
        else void post('swipe', { x: state.start.x, y: state.start.y, x2: point.x, y2: point.y, durationMs: Math.max(120, Math.min(1200, Date.now() - state.at)) })
      }

      const onPointerUp = (event) => finishPointer(event, false)
      const onPointerCancel = (event) => finishPointer(event, true)

      const stream = state?.stream ?? {}
      const device = state?.device
      return h(
        'div',
        { style: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } },
        h(
          'div',
          { style: S.toolbar },
          h('button', { style: S.btn, title: '音量减', onClick: () => void post('volume', { delta: -1 }) }, '音量 −'),
          h('button', { style: S.btn, title: '音量加', onClick: () => void post('volume', { delta: 1 }) }, '音量 +'),
          h('button', { style: S.btn, onClick: () => void post('key', { key: 'back' }) }, '返回'),
          h('button', { style: S.btn, onClick: () => void post('key', { key: 'home' }) }, '主页'),
          h('button', { style: S.btn, onClick: () => void post('key', { key: 'wakeup' }) }, '亮屏'),
          h('span', { style: { flex: 1 } }),
          h('button', { style: busy ? { ...S.btn, ...S.btnDisabled } : S.btn, disabled: busy, onClick: () => void startVideo() }, '重连画面'),
          state?.adb?.scrcpyExists === true
            ? h('button', { style: S.btn, onClick: () => void post('startScrcpy') }, '打开 scrcpy 窗口')
            : null,
          state?.adb?.scrcpyExists === true
            ? h('button', { style: S.btn, onClick: () => void post('stopScrcpy') }, '关闭窗口')
            : null,
        ),
        error.length > 0 ? h('div', { style: S.err }, error) : null,
        h(
          'div',
          { style: S.screenWrap },
          state?.selectedSerial
            ? h('canvas', {
                ref: canvasRef,
                style: S.canvas,
                onPointerDown,
                onPointerMove,
                onPointerUp,
                onPointerCancel,
              })
            : h(
                'div',
                { style: S.empty },
                h('div', { style: { fontWeight: 600, marginBottom: 6 } }, '还没有连接 Android 设备'),
                h('div', null, '去「设置 → 安卓调试」填 adb 路径、连接无线调试，再选一台设备。'),
                h('div', { style: { marginTop: 6, opacity: 0.72 } }, '连接后这里会显示画面；点画面可以直接触控。'),
              ),
        ),
        h(
          'div',
          { style: S.statusBar },
          h('span', { style: S.chip(mode === 'live') }, mode === 'live' ? `实时画面 · ${fps} fps` : mode === 'poll' ? '截图模式' : '未启动'),
          device ? h('span', null, `${device.model || device.serial}`) : null,
          stream.width ? h('span', null, `${stream.width}×${stream.height}`) : null,
          stream.error ? h('span', { style: { opacity: 0.8 } }, stream.error) : null,
        ),
      )
    }

    // ── Tab2 Logcat ────────────────────────────────────────────────────────
    function LogcatTab({ state }) {
      const [entries, setEntries] = React.useState([])
      const [cursor, setCursor] = React.useState(0)
      const [paused, setPaused] = React.useState(false)
      const [autoScroll, setAutoScroll] = React.useState(true)
      const [level, setLevel] = React.useState('V')
      const [pkg, setPkg] = React.useState('')
      const [keyword, setKeyword] = React.useState('')
      const [packages, setPackages] = React.useState({ running: [], installed: [], foreground: '' })
      const [error, setError] = React.useState('')
      const cursorRef = React.useRef(0)
      const pausedRef = React.useRef(false)
      const autoScrollRef = React.useRef(true)
      const filtersRef = React.useRef({ pkg: '', q: '', level: 'V' })
      const logRef = React.useRef(null)

      React.useEffect(() => {
        cursorRef.current = cursor
      }, [cursor])
      React.useEffect(() => {
        pausedRef.current = paused
      }, [paused])
      React.useEffect(() => {
        autoScrollRef.current = autoScroll
      }, [autoScroll])
      React.useEffect(() => {
        filtersRef.current = { pkg, q: keyword, level }
      }, [pkg, keyword, level])

      const loadPackages = async () => {
        const result = await requestJson(`${API}/packages.json${state?.selectedSerial ? `?serial=${encodeURIComponent(state.selectedSerial)}` : ''}`)
        if (result?.ok === true) setPackages(result)
      }

      React.useEffect(() => {
        void loadPackages()
        const timer = window.setInterval(() => void loadPackages(), 5000)
        return () => {
          window.clearInterval(timer)
          // 离开 Logcat tab 时停掉 host 的 logcat 子进程，别让它一直白读日志。
          void requestJson(`${API}/command`, { action: 'logcatStop' })
        }
      }, [state?.selectedSerial])

      const fetchOnce = async () => {
        if (pausedRef.current) return
        const filters = filtersRef.current
        const query = new URLSearchParams({
          cursor: String(cursorRef.current),
          pkg: filters.pkg,
          q: filters.q,
          level: filters.level,
          limit: '500',
        })
        if (state?.selectedSerial) query.set('serial', state.selectedSerial)
        const result = await requestJson(`${API}/logcat.json?${query.toString()}`)
        if (result?.ok !== true) {
          if (result?.error) setError(result.error)
          return
        }
        setError('')
        if (typeof result.cursor === 'number' && result.cursor !== cursorRef.current) {
          cursorRef.current = result.cursor
          setCursor(result.cursor)
        }
        const nextEntries = Array.isArray(result.entries) ? result.entries : []
        if (nextEntries.length > 0) {
          setEntries((previous) => {
            const seen = new Set(previous.map((entry) => entry.id))
            const fresh = nextEntries.filter((entry) => !seen.has(entry.id))
            if (fresh.length === 0) return previous
            const merged = [...previous, ...fresh]
            return merged.length > 2000 ? merged.slice(merged.length - 2000) : merged
          })
        }
      }

      React.useEffect(() => {
        const timer = window.setInterval(() => void fetchOnce(), 700)
        void fetchOnce()
        return () => window.clearInterval(timer)
        // 用 ref 读取最新过滤条件
      }, [state?.selectedSerial])

      // 过滤条件变化时重置本地日志
      React.useEffect(() => {
        cursorRef.current = 0
        setCursor(0)
        setEntries([])
        void fetchOnce()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [pkg, keyword, level, state?.selectedSerial])

      React.useEffect(() => {
        if (autoScroll !== true) return
        const node = logRef.current
        if (node === null) return
        node.scrollTop = node.scrollHeight
      }, [entries, autoScroll])

      const jumpBottom = () => {
        setAutoScroll(true)
        autoScrollRef.current = true
        window.requestAnimationFrame(() => {
          const node = logRef.current
          if (node !== null) node.scrollTop = node.scrollHeight
        })
      }

      const clear = () => {
        setEntries([])
      }

      const exportFile = () => {
        const query = new URLSearchParams({ pkg, q: keyword, level, ...(state?.selectedSerial ? { serial: state.selectedSerial } : {}) })
        const anchor = document.createElement('a')
        anchor.href = `${API}/logcat/export.txt?${query.toString()}`
        anchor.download = `logcat-${Date.now()}.txt`
        anchor.click()
      }

      const runningOptions = []
      const seen = new Set()
      if (packages.foreground) {
        runningOptions.push({ value: packages.foreground, label: `前台：${packages.foreground}` })
        seen.add(packages.foreground)
      }
      for (const item of Array.isArray(packages.running) ? packages.running : []) {
        if (seen.has(item.package)) continue
        seen.add(item.package)
        runningOptions.push({ value: item.package, label: `${item.package}${item.isSystem ? '（系统）' : ''}` })
      }

      return h(
        'div',
        { style: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } },
        h(
          'div',
          { style: S.toolbar },
          h(
            'select',
            { style: { ...S.input, maxWidth: 220 }, value: pkg, onChange: (event) => setPkg(event.target.value), title: '按包名过滤' },
            h('option', { value: '' }, '全部包名'),
            runningOptions.map((option) => h('option', { key: option.value, value: option.value }, option.label)),
          ),
          h('input', {
            style: { ...S.input, width: 150 },
            placeholder: '关键词',
            value: keyword,
            spellCheck: false,
            onChange: (event) => setKeyword(event.target.value),
          }),
          h(
            'select',
            { style: S.input, value: level, onChange: (event) => setLevel(event.target.value), title: '最低级别' },
            ['V', 'D', 'I', 'W', 'E', 'F'].map((item) => h('option', { key: item, value: item }, item)),
          ),
          h('button', { style: S.btn, onClick: () => setPaused((value) => !value) }, paused ? '继续' : '暂停'),
          h(
            'label',
            { style: { ...S.muted, display: 'flex', alignItems: 'center', gap: 4 } },
            h('input', { type: 'checkbox', checked: autoScroll, onChange: (event) => setAutoScroll(event.target.checked) }),
            '自动滚动',
          ),
          h('button', { style: S.btn, onClick: jumpBottom }, '回到底部'),
          h('button', { style: S.btn, onClick: clear }, '清空'),
          h('button', { style: S.btn, onClick: exportFile }, '导出'),
        ),
        error.length > 0 ? h('div', { style: S.err }, error) : null,
        h(
          'div',
          { ref: logRef, style: S.logBox },
          entries.length === 0
            ? h('div', { style: S.empty }, state?.selectedSerial ? '等待日志…（设备没连上或当前过滤条件下没有日志）' : '先在设置里连接设备')
            : entries.map((entry) =>
                h(
                  'div',
                  { key: entry.id, style: S.logRow },
                  h('span', { style: S.logTime }, `${entry.time ?? ''}`),
                  h('span', { style: { ...S.logTag, color: levelColor(entry.level) } }, `${entry.level ?? ''}/${entry.tag ?? ''}`),
                  h(
                    'span',
                    { style: S.logMsg },
                    (Array.isArray(entry.segments) && entry.segments.length > 0
                      ? entry.segments
                      : [{ text: entry.msg ?? '' }]
                    ).map((segment, index) => h('span', { key: index, style: segment.color ? { color: segment.color } : undefined }, segment.text)),
                  ),
                ),
              ),
        ),
        h(
          'div',
          { style: S.statusBar },
          h('span', { style: S.chip(state?.logcat?.running === true) }, state?.logcat?.running === true ? '采集中' : '未采集'),
          h('span', null, `${entries.length} 行（本地上限 2000）`),
          packages.foreground ? h('span', null, `前台：${packages.foreground}`) : null,
        ),
      )
    }

    // ── Tab3 性能 ──────────────────────────────────────────────────────────
    function PerfTab({ state }) {
      const [snapshot, setSnapshot] = React.useState(undefined)
      const [pkg, setPkg] = React.useState('')
      const [packages, setPackages] = React.useState({ running: [], foreground: '' })
      const [error, setError] = React.useState('')

      const sample = async () => {
        const query = new URLSearchParams()
        if (pkg) query.set('pkg', pkg)
        if (state?.selectedSerial) query.set('serial', state.selectedSerial)
        const result = await requestJson(`${API}/perf.json?${query.toString()}`)
        if (result?.ok === true) {
          setSnapshot(result)
          setError('')
        } else if (result?.error) setError(result.error)
      }

      React.useEffect(() => {
        void sample()
        const timer = window.setInterval(() => void sample(), 2000)
        return () => window.clearInterval(timer)
      }, [state?.selectedSerial, pkg])

      React.useEffect(() => {
        const load = async () => {
          const result = await requestJson(`${API}/packages.json${state?.selectedSerial ? `?serial=${encodeURIComponent(state.selectedSerial)}` : ''}`)
          if (result?.ok === true) setPackages(result)
        }
        void load()
      }, [state?.selectedSerial])

      const cpu = snapshot?.cpu ?? {}
      const memory = snapshot?.memory ?? {}
      const gpu = snapshot?.gpu ?? {}
      const battery = snapshot?.battery ?? {}
      const memPct = memory.totalMb ? (Number(memory.usedMb) / Number(memory.totalMb)) * 100 : 0

      return h(
        'div',
        { style: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } },
        h(
          'div',
          { style: S.toolbar },
          h(
            'select',
            { style: { ...S.input, maxWidth: 240 }, value: pkg, onChange: (event) => setPkg(event.target.value) },
            h('option', { value: '' }, '前台应用'),
            (Array.isArray(packages.running) ? packages.running : []).map((item) => h('option', { key: item.package, value: item.package }, item.package)),
          ),
          h('span', { style: { flex: 1 } }),
          h('span', { style: S.muted }, snapshot?.sampledAt ? `采样于 ${new Date(snapshot.sampledAt).toLocaleTimeString()}` : ''),
        ),
        error.length > 0 ? h('div', { style: S.err }, error) : null,
        h(
          'div',
          { style: S.perfWrap },
          h(
            'div',
            { style: S.card },
            h('div', { style: S.cardTitle }, 'CPU（整机）'),
            h('div', { style: S.big }, fmtPct(cpu.usagePercent)),
            h('div', { style: S.bar }, h('div', { style: S.barFill(cpu.usagePercent) })),
            h('div', { style: { ...S.muted, marginTop: 6 } }, `应用：${fmtPct(cpu.appPercent)} · 系统总：${fmtPct(cpu.totalPercent)}`),
          ),
          h(
            'div',
            { style: S.card },
            h('div', { style: S.cardTitle }, '内存'),
            h('div', { style: S.big }, `${memory.usedMb ?? '—'} / ${memory.totalMb ?? '—'} MB`),
            h('div', { style: S.bar }, h('div', { style: S.barFill(memPct) })),
            h('div', { style: { ...S.muted, marginTop: 6 } }, `应用 PSS：${memory.appPssMb === undefined ? '—' : `${memory.appPssMb} MB`}`),
          ),
          h(
            'div',
            { style: S.card },
            h('div', { style: S.cardTitle }, 'GPU'),
            h('div', { style: S.big }, gpu.available === true ? fmtPct(gpu.usagePercent) : '不可用'),
            gpu.available === true ? h('div', { style: S.bar }, h('div', { style: S.barFill(gpu.usagePercent) })) : null,
            h(
              'div',
              { style: { ...S.muted, marginTop: 6 } },
              [gpu.renderer, gpu.platform, gpu.clockMHz ? `${gpu.clockMHz} MHz` : ''].filter(Boolean).join(' · ') || gpu.reason || '',
            ),
          ),
          h(
            'div',
            { style: S.card },
            h('div', { style: S.cardTitle }, '电池'),
            h('div', { style: S.big }, battery.level === undefined ? '—' : `${battery.level}%`),
            h('div', { style: { ...S.muted, marginTop: 6 } }, `${battery.status ?? ''}${battery.temperatureC === undefined ? '' : ` · ${battery.temperatureC}°C`}`),
          ),
        ),
        h(
          'div',
          { style: S.statusBar },
          h('span', { style: S.chip(state?.selectedSerial !== undefined && state?.selectedSerial !== '') }, state?.selectedSerial ? `设备 ${state.selectedSerial}` : '未连接'),
          snapshot?.package ? h('span', null, `目标应用：${snapshot.package}`) : null,
        ),
      )
    }

    // ── Tab4 指令 ──────────────────────────────────────────────────────────
    function CommandTab({ state }) {
      const [command, setCommand] = React.useState('')
      const [mode, setMode] = React.useState('shell')
      const [output, setOutput] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [history, setHistory] = React.useState(() => {
        try {
          return JSON.parse(window.localStorage.getItem('dsh-android-tool.history') ?? '[]')
        } catch {
          return []
        }
      })

      const remember = (item) => {
        setHistory((previous) => {
          const next = [item, ...previous.filter((row) => row !== item)].slice(0, 20)
          try {
            window.localStorage.setItem('dsh-android-tool.history', JSON.stringify(next))
          } catch {
            // 忽略
          }
          return next
        })
      }

      const run = async () => {
        const text = command.trim()
        if (text.length === 0) return
        setBusy(true)
        setOutput('运行中…')
        const result = await requestJson(`${API}/exec`, { command: text, mode, serial: state?.selectedSerial })
        setBusy(false)
        remember(text)
        if (result?.ok === true) {
          const parts = [`$ ${mode === 'shell' ? `adb shell ${text}` : `adb ${text}`}`]
          if (result.stdout) parts.push(result.stdout)
          if (result.stderr) parts.push(`[stderr]\n${result.stderr}`)
          parts.push(`[exit ${result.code ?? 0} · ${result.elapsedMs ?? 0}ms${result.truncated ? ' · 输出已截断' : ''}]`)
          setOutput(parts.join('\n'))
        } else {
          setOutput(`${result?.error ?? '执行失败'}\n${result?.stderr ?? ''}`)
        }
      }

      const quick = [
        { label: '型号', command: 'getprop ro.product.model' },
        { label: '三方包', command: 'pm list packages -3' },
        { label: '电池', command: 'dumpsys battery' },
        { label: '前台', command: "dumpsys activity activities | grep mResumedActivity" },
      ]

      return h(
        'div',
        { style: S.cmdWrap },
        h(
          'div',
          { style: S.toolbar },
          h('input', {
            style: { ...S.input, ...S.grow },
            placeholder: mode === 'shell' ? '输入 shell 命令，例如 getprop ro.product.model' : '输入 adb 参数，例如 shell getprop ro.product.model',
            value: command,
            spellCheck: false,
            onChange: (event) => setCommand(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter' && !event.shiftKey) void run()
            },
          }),
          h(
            'select',
            { style: S.input, value: mode, onChange: (event) => setMode(event.target.value) },
            h('option', { value: 'shell' }, 'shell'),
            h('option', { value: 'adb' }, 'adb'),
          ),
          h('button', { style: busy ? { ...S.btnPrimary, ...S.btnDisabled } : S.btnPrimary, disabled: busy, onClick: () => void run() }, '运行'),
        ),
        h(
          'div',
          { style: { ...S.toolbar, borderBottom: 'none', paddingTop: 0 } },
          quick.map((item) => h('button', { key: item.label, style: S.btn, onClick: () => setCommand(item.command) }, item.label)),
          h('span', { style: { flex: 1 } }),
          history.slice(0, 4).map((item) => h('button', { key: item, style: S.btn, title: item, onClick: () => setCommand(item) }, item.length > 16 ? `${item.slice(0, 16)}…` : item)),
        ),
        h('pre', { style: S.pre }, output || '输出会显示在这里。'),
        h(
          'div',
          { style: S.statusBar },
          h('span', { style: S.chip(state?.adb?.exists === true) }, state?.adb?.exists === true ? 'adb 就绪' : 'adb 未找到'),
          state?.selectedSerial ? h('span', null, state.selectedSerial) : h('span', null, '未选择设备'),
        ),
      )
    }

    // ── 设置页 ─────────────────────────────────────────────────────────────
    const SETTINGS_NAMESPACE = 'dsh-android-tool'
    const MARKER_FIELD = 'adbPath'
    const EMPTY_MIRROR = { status: 'idle' }
    const EMPTY_FORM = { status: 'loading' }

    function findNamespace(snapshot) {
      const list = snapshot?.view?.namespaces ?? []
      const byField = list.find((item) => {
        const dict = item?.schema?.dict
        return dict !== undefined && dict !== null && typeof dict === 'object' && MARKER_FIELD in dict
      })
      if (byField !== undefined) return byField
      return list.find((item) => item?.ns === SETTINGS_NAMESPACE) ?? list.find((item) => item?.ns === `include:${SETTINGS_NAMESPACE}`)
    }

    function AndroidSettingsSection(props) {
      const configForms = props?.configForms
      const mirror = React.useMemo(() => (configForms === undefined ? undefined : configForms.describe()), [configForms])
      const mirrorSnap = React.useSyncExternalStore(
        (listener) => (mirror === undefined ? () => {} : mirror.subscribe(listener)),
        () => (mirror === undefined ? EMPTY_MIRROR : mirror.getSnapshot()),
        () => (mirror === undefined ? EMPTY_MIRROR : mirror.getSnapshot()),
      )
      const view = findNamespace(mirrorSnap)
      const namespace = view?.ns
      const form = React.useMemo(() => (namespace === undefined || configForms === undefined ? undefined : configForms.get(namespace)), [configForms, namespace])
      const formSnap = React.useSyncExternalStore(
        (listener) => (form === undefined ? () => {} : form.subscribe(listener)),
        () => (form === undefined ? EMPTY_FORM : form.getSnapshot()),
        () => (form === undefined ? EMPTY_FORM : form.getSnapshot()),
      )

      const [draft, setDraft] = React.useState({})
      const [status, setStatus] = React.useState('')
      const [deviceState, setDeviceState] = React.useState(undefined)
      const [wire, setWire] = React.useState({ host: '', port: '5555', pairPort: '', code: '' })
      const wireTouched = React.useRef(false)
      const [actionOutput, setActionOutput] = React.useState('')

      const current = formSnap?.value ?? {}
      const pick = (key, fallback) => (Object.hasOwn(draft, key) ? draft[key] : current[key] !== undefined ? current[key] : fallback)
      const setField = (key, value) => setDraft((previous) => ({ ...previous, [key]: value }))

      React.useEffect(() => {
        if (mirrorSnap.status === 'idle' && typeof mirror?.ensure === 'function') void mirror.ensure()
      }, [mirror, mirrorSnap.status])

      React.useEffect(() => {
        if (wireTouched.current === true) return
        if (current.wirelessHost !== undefined || current.wirelessPort !== undefined) {
          setWire((previous) => ({
            ...previous,
            host: current.wirelessHost ?? previous.host,
            port: String(current.wirelessPort ?? previous.port),
            pairPort: current.pairingPort ? String(current.pairingPort) : previous.pairPort,
          }))
        }
      }, [current.wirelessHost, current.wirelessPort, current.pairingPort])

      const refreshState = async () => {
        const next = await requestJson(`${API}/state.json`)
        if (next !== undefined) setDeviceState(next)
      }

      React.useEffect(() => {
        void refreshState()
        const timer = window.setInterval(() => void refreshState(), 2500)
        return () => window.clearInterval(timer)
      }, [])

      const save = async () => {
        if (form === undefined) return
        const ops = Object.entries(draft).map(([key, value]) => (value === undefined ? { op: 'unset', path: [key] } : { op: 'set', path: [key], value }))
        if (ops.length === 0) {
          setStatus('没有改动。')
          return
        }
        setStatus('正在保存…')
        try {
          const ok = await form.mutate(ops, formSnap.revision)
          if (ok === false) {
            setStatus('保存被拒绝，请检查取值（端口 1–65535）。')
            return
          }
          setDraft({})
          setStatus('已保存，立即生效。')
        } catch (saveError) {
          setStatus(`保存失败：${saveError?.message ?? String(saveError)}`)
        }
      }

      const action = async (name, extra) => {
        setActionOutput('处理中…')
        const result = await requestJson(`${API}/command`, { action: name, ...extra })
        setActionOutput(result?.ok === true ? `${name} 成功${result.output ? `：${result.output}` : result.version ? `：${result.version}` : ''}` : `${name} 失败：${result?.error ?? '未知错误'}`)
        await refreshState()
        return result
      }

      if (configForms === undefined) {
        return h('div', { style: S.page }, h('h2', { style: S.pageTitle }, '安卓调试'), h('p', { style: S.muted }, '配置服务未就绪，无法在这里改配置。'))
      }
      if (namespace === undefined) {
        if (mirrorSnap.status === 'idle' || mirrorSnap.status === 'loading') {
          return h('div', { style: S.page }, h('h2', { style: S.pageTitle }, '安卓调试'), h('p', { style: S.muted }, '正在读取插件配置…'))
        }
        const namespaces = (mirrorSnap.view?.namespaces ?? []).map((item) => item.ns)
        return h(
          'div',
          { style: S.page },
          h('h2', { style: S.pageTitle }, '安卓调试'),
          h('p', { style: S.muted }, '没有读到这个插件的配置项。宿主当前命名空间：'),
          h('pre', { style: S.pre }, namespaces.length === 0 ? '（空）' : namespaces.join('\n')),
        )
      }

      const devices = Array.isArray(deviceState?.devices) ? deviceState.devices : []
      const dirty = Object.keys(draft).length > 0

      return h(
        'div',
        { style: S.page },
        h('h2', { style: S.pageTitle }, '安卓调试'),
        h('p', { style: S.muted }, '配置无线调试与 adb。保存后立即生效，不用重启。无线配对码只在配对时用一次，不保存。'),

        h(
          'div',
          { style: S.section },
          h('h3', { style: { fontSize: 14, margin: '0 0 8px' } }, '工具路径'),
          h(
            'div',
            { style: S.field },
            h('label', { style: S.fieldLabel }, h('span', null, 'adb 路径'), h('span', { style: S.fieldKey }, 'adbPath')),
            h('input', { style: S.input, value: pick('adbPath', ''), placeholder: '留空 = 随包 scrcpy 目录里的 adb.exe', onChange: (event) => setField('adbPath', event.target.value) }),
            h('span', { style: S.muted }, deviceState?.adb?.path ? `当前解析：${deviceState.adb.path}${deviceState.adb.exists ? '' : '（不存在）'}` : ''),
          ),
          h(
            'div',
            { style: S.field },
            h('label', { style: S.fieldLabel }, h('span', null, 'scrcpy 路径'), h('span', { style: S.fieldKey }, 'scrcpyPath')),
            h('input', { style: S.input, value: pick('scrcpyPath', ''), placeholder: '精简包不含 scrcpy.exe；需要独立窗口时填本机 scrcpy.exe 路径', onChange: (event) => setField('scrcpyPath', event.target.value) }),
          ),
          h(
            'div',
            { style: S.row },
            h('button', { style: S.btn, onClick: () => void action('testAdb') }, '测试 adb'),
            h('button', { style: S.btn, onClick: () => void action('refreshDevices') }, '扫描设备'),
            deviceState?.adb ? h('span', { style: S.muted }, `adb ${deviceState.adb.exists ? '已找到' : '未找到'} · scrcpy ${deviceState.adb.scrcpyExists ? '已找到' : '未找到'}`) : null,
          ),
        ),

        h(
          'div',
          { style: S.section },
          h('h3', { style: { fontSize: 14, margin: '0 0 8px' } }, '无线调试'),
          h(
            'div',
            { style: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 } },
            h('input', { style: S.input, value: wire.host, placeholder: '设备 IP，例如 192.168.1.23', onChange: (event) => { wireTouched.current = true; setWire((previous) => ({ ...previous, host: event.target.value })); setField('wirelessHost', event.target.value) } }),
            h('input', { style: S.input, value: wire.port, placeholder: '连接端口 5555', onChange: (event) => { wireTouched.current = true; setWire((previous) => ({ ...previous, port: event.target.value })); setField('wirelessPort', Number(event.target.value) || 5555) } }),
            h('input', { style: S.input, value: wire.pairPort, placeholder: '配对端口（Android 11+）', onChange: (event) => { wireTouched.current = true; setWire((previous) => ({ ...previous, pairPort: event.target.value })); setField('pairingPort', Number(event.target.value) || 0) } }),
            h('input', { style: S.input, value: wire.code, placeholder: '六位配对码', onChange: (event) => setWire((previous) => ({ ...previous, code: event.target.value })) }),
          ),
          h(
            'div',
            { style: S.row },
            h('button', { style: S.btn, onClick: () => void action('pair', { host: wire.host, port: Number(wire.pairPort), code: wire.code }) }, '配对'),
            h('button', { style: S.btnPrimary, onClick: () => void action('connect', { host: wire.host, port: Number(wire.port) || 5555 }) }, '连接'),
            h('button', { style: S.btn, onClick: () => void action('disconnect', { host: wire.host, port: Number(wire.port) || 5555 }) }, '断开'),
            h('button', { style: S.btn, onClick: () => void action('enableTcpip') }, 'USB 开启 TCP 模式'),
          ),
          h('p', { style: S.muted }, 'Android 11+：先在「无线调试」里点“使用配对码配对设备”，把 IP、配对端口和配对码填到这里点配对；成功后再用上面的连接端口点连接。'),
        ),

        h(
          'div',
          { style: S.section },
          h('h3', { style: { fontSize: 14, margin: '0 0 8px' } }, '当前调试设备'),
          devices.length === 0
            ? h('p', { style: S.muted }, deviceState?.deviceError ?? '没有检测到设备。')
            : h(
                'table',
                { style: S.table },
                h('thead', null, h('tr', null, h('th', { style: S.th }, ''), h('th', { style: S.th }, '序列号'), h('th', { style: S.th }, '状态'), h('th', { style: S.th }, '型号'))),
                h(
                  'tbody',
                  null,
                  devices.map((device) =>
                    h(
                      'tr',
                      { key: device.serial },
                      h(
                        'td',
                        { style: S.td },
                        h('input', {
                          type: 'radio',
                          name: 'android-device',
                          checked: deviceState?.selectedSerial === device.serial,
                          onChange: () => void action('select', { serial: device.serial }),
                        }),
                      ),
                      h('td', { style: S.td }, device.serial),
                      h('td', { style: S.td }, device.state),
                      h('td', { style: S.td }, device.model || '—'),
                    ),
                  ),
                ),
              ),
          actionOutput ? h('p', { style: S.muted }, actionOutput) : null,
        ),

        h(
          'div',
          { style: S.section },
          h('h3', { style: { fontSize: 14, margin: '0 0 8px' } }, '偏好'),
          h(
            'label',
            { style: { ...S.muted, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 } },
            h('input', { type: 'checkbox', checked: pick('autoConnect', false) === true, onChange: (event) => setField('autoConnect', event.target.checked) }),
            '启动后自动连接上面的无线设备',
          ),
          h(
            'div',
            { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 } },
            numberField('视频最大边', 'videoMaxSize', pick('videoMaxSize', 1024), setField, { min: 320, max: 4096, step: 1 }),
            numberField('视频码率 (bps)', 'videoBitRate', pick('videoBitRate', 4000000), setField, { min: 100000, max: 50000000, step: 100000 }),
            numberField('视频帧率', 'videoFps', pick('videoFps', 30), setField, { min: 1, max: 120, step: 1 }),
            numberField('截图模式 FPS', 'previewFps', pick('previewFps', 3), setField, { min: 1, max: 10, step: 1 }),
            numberField('Logcat 缓冲行数', 'logcatMaxLines', pick('logcatMaxLines', 5000), setField, { min: 100, max: 100000, step: 100 }),
            numberField('adb 超时 (ms)', 'adbTimeoutMs', pick('adbTimeoutMs', 15000), setField, { min: 1000, max: 120000, step: 500 }),
          ),
          h(
            'div',
            { style: S.field },
            h('label', { style: S.fieldLabel }, h('span', null, '额外 scrcpy 参数'), h('span', { style: S.fieldKey }, 'scrcpyExtraArgs')),
            h('input', { style: S.input, value: pick('scrcpyExtraArgs', ''), placeholder: '例如 --no-audio --always-on-top', onChange: (event) => setField('scrcpyExtraArgs', event.target.value) }),
          ),
        ),

        h(
          'div',
          { style: { ...S.row, marginTop: 22, position: 'sticky', bottom: 0, background: 'var(--dsw-alias-bg-base, transparent)', padding: '10px 0' } },
          h('button', { style: dirty ? S.btnPrimary : { ...S.btnPrimary, ...S.btnDisabled }, disabled: !dirty, onClick: () => void save() }, '保存'),
          h('button', { style: S.btn, disabled: !dirty, onClick: () => setDraft({}) }, '撤销'),
          h('span', { style: S.muted }, status),
        ),
      )
    }

    function numberField(label, key, value, setField, range) {
      return h(
        'div',
        { style: S.field, key },
        h('label', { style: S.fieldLabel }, h('span', null, label), h('span', { style: S.fieldKey }, key)),
        h('input', {
          type: 'number',
          style: S.input,
          value: value === undefined || value === null ? '' : String(value),
          min: range.min,
          max: range.max,
          step: range.step,
          onChange: (event) => setField(key, event.target.value === '' ? undefined : Number(event.target.value)),
        }),
      )
    }

    return {
      inject: ['slots', 'sidebarRight', 'sidebarRightTabs'],
      __components: { AndroidPanel, ScreenTab, LogcatTab, PerfTab, CommandTab, AndroidSettingsSection },
      apply(ctx) {
        // 1) 右侧 Sidebar 的「安卓设备」页
        try {
          ctx.effect(
            () =>
              ctx.sidebarRightTabs.register({
                id: TAB_ID,
                kind: TAB_KIND,
                multiple: false,
                keepMounted: true,
                title: () => '安卓设备',
                guide: [
                  {
                    id: 'android-tool',
                    order: 26,
                    title: () => '安卓设备',
                    description: () => '查看并控制 Android 设备',
                  },
                ],
              }),
            'dsh-android-tool: tab type',
          )

          ctx.effect(
            () =>
              ctx.slots.inject('sidebar.right.pane.tab', () =>
                ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TAB_ID }, AndroidPanel),
              ),
            'dsh-android-tool: tab body',
          )

          // AI 一调用工具，就把面板拉到右侧
          ctx.effect(() => {
            let stopped = false
            let timer
            const tick = async () => {
              const next = await requestJson(`${API}/state.json`)
              if (stopped) return
              const at = Number(next?.agentActionAt ?? 0)
              if (at > 0 && at > readCursor()) {
                try {
                  ctx.sidebarRight.openTab(TAB_KIND, { params: {} })
                  writeCursor(at)
                } catch {
                  // 当前没有选中会话时 openTab 会拒绝，等下一次轮询重试
                }
              }
              timer = window.setTimeout(tick, 1200)
            }
            void tick()
            return () => {
              stopped = true
              if (timer !== undefined) window.clearTimeout(timer)
            }
          }, 'dsh-android-tool: auto-open panel')
        } catch (error) {
          try {
            console.warn('[dsh-android-tool] 侧边栏注册失败：', error)
          } catch {
            // 忽略
          }
        }

        // 2) 设置 →「安卓调试」
        try {
          ctx.slots.inject('settings.section', () =>
            ctx.slots.register(
              {
                name: 'settings.section',
                id: 'android-tool',
                order: 90,
                label: () => '安卓调试',
                inject: () => ({ configForms: ctx.get('configForms') }),
              },
              AndroidSettingsSection,
            ),
          )
        } catch (error) {
          try {
            console.warn('[dsh-android-tool] 设置页注册失败：', error)
          } catch {
            // 忽略
          }
        }
      },
    }
  },
})
