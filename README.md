# dsh-android-tool

把 Android 设备接进 DSH 工作台：

- **设置 → 安卓调试**：配置 adb / scrcpy 路径、无线调试（配对 / 连接 / 断开）、当前调试设备与视频/日志偏好。
- **右侧 Sidebar → 安卓设备**：顶部四个 Tab —— 界面 / Logcat / 性能 / 指令。
- **给 AI 的四个工具**：`android_view`、`android_state`、`android_control`、`android_adb`。

插件随包 `scrcpy-win64-v5.0.1` 的精简版：只保留 `adb.exe`、`AdbWinApi.dll`、`AdbWinUsbApi.dll`、`scrcpy-server`（约 9MB），不依赖本机另外安装 adb；独立 scrcpy 窗口需要你在设置里另外指定本机 `scrcpy.exe`。

## 安装

把本目录加入 DSH profile：

1. 在本目录执行 `npm install`（安装 `@yume-chan/scrcpy` 依赖）；
2. 在 profile 的 `node_modules` 建 junction 指向本目录；
3. `package.json` 的 `dependencies` 写 `"dsh-android-tool": "link:C:/WorkSpace/Work/DSH/dsh-android-tool"`；
4. `package.json` 的 `dsh.profile.bundles` 加入 `"dsh-android-tool"`；
5. 重启 DSH（首次加载后可通过 profile 的插件热重载刷新）。

## 第三方库

本插件直接依赖以下第三方库，均以 npm 依赖声明在 `package.json` 里：

| 库 | 版本 | 许可证 | 用途 |
|---|---|---|---|
| [`@yume-chan/scrcpy`](https://www.npmjs.com/package/@yume-chan/scrcpy) | `^3.0.0-beta.4` | MIT | scrcpy 控制协议序列化（触摸 / 按键 / 文本 / 滚动），用于低延迟控制通道；会带入其传递依赖 `@yume-chan/async`、`@yume-chan/event`、`@yume-chan/no-data-view`、`@yume-chan/stream-extra`、`@yume-chan/struct` |
| [Genymobile/scrcpy](https://github.com/Genymobile/scrcpy) 随包二进制 | `5.0.1` | Apache-2.0 | 精简随包：`adb.exe`、`AdbWinApi.dll`、`AdbWinUsbApi.dll`、`scrcpy-server`；`scrcpy.exe` 等 GUI 依赖不随包 |

视频解码/渲染没有引入额外 npm 包，使用浏览器原生 WebCodecs + Canvas2D；渲染与丢帧策略参考 [ya-webadb / Tango](https://github.com/yume-chan/ya-webadb)（MIT）。

## 侧边栏

### 界面

- 优先使用 **scrcpy 推流**：host 侧复用随包的 `scrcpy-server 5.0.1`，解析 H.264 帧后经 WebSocket 推给浏览器，用 WebCodecs 解码到 canvas。
- `VideoDecoder` 不可用或推流失败时自动回退到 **adb 截图轮询**（默认 3fps），功能不中断。
- 画布点击 = tap；鼠标拖动时通过现有视频 WebSocket 实时发送 `touch down/move/up`（约 60Hz），不是松手后才补一个 swipe，所以拖动手感跟手；按钮可调音量 ±、返回、主页、亮屏。
- 触控走 scrcpy **control socket**（`@yume-chan/scrcpy` 序列化），不是每次 `adb shell input`，实测一次控制往返约 20–30ms；流没开时才回退 adb。
- 「打开 scrcpy 窗口」在设置了本机 `scrcpy.exe` 路径后启动独立窗口；精简包默认不带，按钮会自动隐藏。

### Logcat

- 自动扫描运行中的包名；支持包名 / 关键词 / 级别过滤。
- 自动滚动开关、`回到底部`（同时自动打开自动滚动）、清空、暂停、导出 `.txt`。
- 默认解析 Unity 富文本的 `<color=...>` 标签（仅颜色，安全渲染为 span）。

### 性能

- CPU：整机使用率（`/proc/stat` 差值）、目标应用 CPU%（`dumpsys cpuinfo`）。
- 内存：整机已用/总量（`/proc/meminfo`）、目标应用 PSS（`dumpsys meminfo`）。
- GPU：按 SoC sysfs 尽力读取（高通 kgsl / Mali / devfreq）；读不到显示「不可用」，不编数字。
- 附带电池电量、状态、温度。

### 指令

- 直接执行 adb 命令，使用设置里配置的 adb。
- `shell` 模式 = `adb -s <serial> shell <command>`；`adb` 模式把输入当作 adb argv。
- 有超时保护，输出显示 stdout / stderr / 退出码 / 耗时。

## AI 工具

| 工具 | 作用 |
|---|---|
| `android_view` | 截图当前画面并以图片返回给模型，同时更新侧边栏画面；附带型号/当前包名/Activity/分辨率。 |
| `android_state` | 查看设备参数：型号、Android 版本、电量、WiFi、内存、存储、屏幕、当前应用。 |
| `android_control` | 模拟触屏与按键：tap / long_press / swipe / key / text / scroll / wake / open_app，默认操作后回一张截图。 |
| `android_adb` | 最后兜底：用配置的 adb 执行任意命令，返回 stdout/stderr/退出码。 |

## 配置项

| key | 默认 | 说明 |
|---|---|---|
| `adbPath` | 随包 | 留空 = `scrcpy-win64-v5.0.1/adb.exe` |
| `scrcpyPath` | 空 | 精简包不含；需要独立 scrcpy 窗口时填本机 `scrcpy.exe` 路径 |
| `wirelessHost` | 空 | 无线调试设备 IP |
| `wirelessPort` | 5555 | adb connect 端口 |
| `pairingPort` | 0 | Android 11+ 配对端口（配对码不保存） |
| `autoConnect` | false | 启动后自动连接无线设备 |
| `videoMaxSize` | 720 | scrcpy 最大边 |
| `videoBitRate` | 2500000 | scrcpy 视频码率 |
| `videoFps` | 30 | scrcpy 最大帧率 |
| `previewFps` | 3 | 截图回退模式帧率 |
| `logcatMaxLines` | 5000 | 服务端日志环形缓冲 |
| `adbTimeoutMs` | 15000 | adb 默认超时 |
| `scrcpyExtraArgs` | 空 | 独立 scrcpy 窗口的额外参数 |

## 限制

- **GPU**：Android 没有统一 GPU 占用接口，不同 SoC 的 sysfs 不一样；读不到时明确显示不可用。
- **中文输入**：实时流下走 scrcpy control，支持 Unicode；只有回退到 `adb shell input text` 时才只支持 ASCII。
- **首次启动无设备**：插件正常加载，界面给出空状态；真机联调需要先连接设备或配置无线调试。
- **scrcpy 协议随版本变化**：本插件绑定随包的 `scrcpy-server 5.0.1`，升级 scrcpy 目录时需要同步更新协议解析。
- **安全**：`android_adb` 能执行任意 adb 命令，仅建议在本地 DSH GUI 使用。

## 开发

```bash
node --test "test/*.test.js"
node test/smoke-host.mjs   # 需要 DSH_PROFILE_DIR 与 schemastery
```

协议参考：<https://github.com/Genymobile/scrcpy/blob/master/doc/develop.md>

控制协议直接依赖 [`@yume-chan/scrcpy`](https://github.com/yume-chan/ya-webadb/tree/main/libraries/scrcpy)；视频渲染与丢帧策略也参考了 [ya-webadb / Tango](https://github.com/yume-chan/ya-webadb)（MIT）：固定画布尺寸做 letterbox、解码回调只保留最新帧、积压时丢非关键帧。
