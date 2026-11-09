# dsh-android-tool

把 Android 设备接进 DSH 工作台：

- **设置 → 安卓调试**：配置 adb / scrcpy 路径；无线调试收成三个按钮——**扫码配对 / 配对码配对 / IP 直连**，各自弹窗单独操作，不再把一堆输入框挤在一页里。
- **右侧 Sidebar → 安卓设备**：顶部六个 Tab —— 界面 / Logcat / 性能 / 指令 / AAB→APK / 安装 APK；「界面」里还能展开一个可点击 / 拖动的虚拟手柄，支持本机电脑手柄转接和截图复制到输入框。
- **手柄模式**：AI 可用 `android_control action=gamepad` 通过 scrcpy UHID 注入虚拟手柄（摇杆、扳机、方向键、ABXY），可选 **XBox / PlayStation / Nintendo Switch** 三种类型（VID/PID、名字与 NS 的 A/B/X/Y 换位都跟着变），面板会画出当前手柄输入；没有实时画面时自动回退到 adb 按键。
- **AAB → APK**：把 `.aab` 转成已签名、可直接安装的 `.apk`（bundletool → zipalign → apksigner），复刻 [AAB2APK](https://github.com/TouMingQAQ/AAB2APK) 的完整流程。
- **安装 APK**：选一个本机 `.apk`，用 `adb install` 直接装到当前设备，支持覆盖安装 / 允许降级 / 授予权限。
- **给 AI 的六个工具**：`android_view`、`android_state`、`android_control`、`android_adb`、`android_install_apk`、`android_aab2apk`。

插件随包一份 `scrcpy/` 目录的精简版：只保留 `adb.exe`、`AdbWinApi.dll`、`AdbWinUsbApi.dll`、`scrcpy-server`（约 9MB），不依赖本机另外安装 adb；独立 scrcpy 窗口需要你在设置里另外指定本机 `scrcpy.exe`。

另外随包 `tools/bundletool-all.jar`（1.18.3，约 32MB），AAB→APK 开箱就能用；Java 与 Android SDK Build-Tools（apksigner / zipalign）仍需本机安装。

## 安装

### 从 GitHub 安装

在 DSH 的「设置 → 插件 → 安装」里填仓库地址即可（给到仓库，不用精确到子目录）：

```
https://github.com/TouMingQAQ/dsh-android-tool
```

或在 profile 目录执行：

```bash
dsh plugin install github:TouMingQAQ/dsh-android-tool
```

装完 `dsh.profile.bundles` 会出现 `dsh-android-tool`，右侧多出「安卓设备」面板，AI 侧多出六个 `android_*` 工具。

### 卡在 codeload.github.com 超时怎么办

本包随带精简 scrcpy 二进制（`adb.exe` 等约 8.8MB），GitHub tarball 约 **4.6MB**；`codeload.github.com` 在部分网络下很慢，pnpm 默认 `fetch-timeout` 只有 60 秒，下不完就报：

```
GET https://codeload.github.com/.../tar.gz/<sha> ... The operation was aborted due to timeout
```

这是下载超时，不是包有问题（插件管理器不会为 git spec 换源重试，因为换源救不了拉取主机本身）。在 profile 目录的 `.npmrc` 里放宽后再装：

```ini
fetch-timeout=600000
fetch-retries=5
fetch-retry-maxtimeout=120000
```

有代理就一并配上 `https-proxy` / `proxy`。装完可以删掉这几行。

### 本地链接安装（开发用）

1. 在本目录执行 `npm install`（安装 `@yume-chan/scrcpy`、`qrcode` 等依赖）；
2. 在 profile 的 `node_modules` 建 junction 指向本目录；
3. profile 的 `package.json` `dependencies` 写 `"dsh-android-tool": "link:<本目录绝对路径>"`；
4. `dsh.profile.bundles` 加入 `"dsh-android-tool"`；
5. 重启 DSH（之后可用插件热重载刷新）。

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
- **手柄**：工具栏点「手柄」会展开一个手柄，标题栏可切 **XBox / PlayStation / Nintendo Switch**（三种底图直接取自 [gamepadtester.cn](https://www.gamepadtester.cn/) 的控制器 SVG，设备端 VID/PID/名字也按类型重建）。鼠标 / 触摸直接点按钮、拖摇杆、按扳机，输入通过 control socket 的 UHID 通道注入设备；AI 用手柄时这里会同步高亮当前按键与摇杆位置。标题栏勾选「电脑手柄」后，可把本机 USB / 蓝牙手柄（Gamepad API）实时转接给手机。标题栏还有「断连」按钮，点它会主动销毁 UHID 设备——手机侧看到手柄被拔出、实时画面不受影响，之后任意手柄输入会自动重连建好。手柄需要实时推流（UHID），推流不可用时按钮退化为 adb `keyevent` 点按，摇杆/扳机不可用。界面工具栏还有「截图到输入框」，把当前画面复制到剪贴板，回到聊天输入框 `Ctrl+V` 粘贴后继续打字。
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

### AAB → APK

把安卓 App Bundle `.aab` 转成已签名、可直接安装的 `.apk`，流程与 [AAB2APK](https://github.com/TouMingQAQ/AAB2APK) 一致：

```
.aab → bundletool build-apks --mode=universal → 解包 universal.apk → zipalign → apksigner sign → apksigner verify → .apk
```

- **输入与输出**：AAB 文件、输出文件夹、输出名、缓存目录；AAB 路径直接粘贴或点「浏览」选择（DSH 会拦截拖进来的文件，界面拿不到拖拽）。
- **密钥库与签名**：`.jks/.keystore/.p12/.pfx/.bks`、密码、别名、密钥密码、密钥库类型、v4 签名。密码在日志里统一显示为 `pass:***`。
- **构建工具**：bundletool jar、Java、Android SDK、apksigner、zipalign；打开面板即自动探测（`JAVA_HOME`、`ANDROID_HOME`、`%LOCALAPPDATA%\Android\Sdk`、`build-tools/<版本>`、PATH 都会查），检测到的路径直接显示在输入框里、可一键「填入检测值」，已经配好就不用再去浏览。
- **自动识别**：`bundle` 没有 `BundleConfig.pb` 时自动从 AAB 抽出 `AndroidManifest.xml` 传给 `--aab-manifest`。
- **配置持久化**：优先存到当前会话工作区下的 `.android_tool/aab2apk.config.json`（相对路径也以工作区为基准）；取不到工作区时退回 DSH 配置目录下的 `.android_tool`，最后才落到用户主目录。与 [AAB2APK](https://github.com/TouMingQAQ/AAB2APK) 的字段一致。
- **取消 / 超时**：每一步都支持取消；bundletool 30 分钟、签名/对齐 10 分钟、校验 5 分钟超时。
- **进度与折叠**：转换时显示百分比进度条和七步流程清单（检查配置 → build-apks → 解包 → 对齐 → 签名 → 校验 → 完成）；各参数卡片可折叠，不占地方。
- 需要 **Java** 和 **Android SDK Build-Tools**（apksigner / zipalign）；`bundletool-all.jar` 已随包放在 `tools/`，也可以用界面覆盖成别的版本。缺哪个会在检测结果里直接写出来。

### 安装 APK

选一个本机 `.apk` 直接装到当前设备（`adb install`）：

- **选文件**：粘贴完整路径，或点「浏览」在内置文件浏览器里选（DSH 会拦截拖进来的文件，界面拿不到拖拽，所以没有拖放）。路径输入后会显示文件大小、包名、版本（能读出清单时）。
- **安装选项**：覆盖安装（`-r`，默认开）、允许降级（`-d`）、授予权限（`-g`）。
- **结果**：成功显示大小与耗时；失败显示 adb 的 `Failure [INSTALL_FAILED_...]` 错误码和原始输出。安装后不会自动启动应用。

## AI 工具

| 工具 | 作用 |
|---|---|
| `android_view` | 截图当前画面并以图片返回给模型，同时更新侧边栏画面；附带型号/当前包名/Activity/分辨率。 |
| `android_state` | 查看设备参数：型号、Android 版本、电量、WiFi、内存、存储、屏幕、当前应用。 |
| `android_control` | 模拟触屏与按键：tap / long_press / swipe / key / text / scroll / wake / open_app / gamepad / gamepad_disconnect，默认操作后回一张截图（手柄默认不截图）。`gamepad` 用 scrcpy UHID 注入虚拟手柄：`buttons`（a/b/x/y/lb/rb/back/start/guide/lstick/rstick/up/down/left/right）、`lstick`/`rstick`（x/y 各 -1..1，y 向上为正）、`lt`/`rt`（0..1）、`gamepadType`（xbox/ps/switch）、`merge`、`holdMs`；`gamepad_disconnect` 主动断连虚拟手柄（画面继续，之后任意手柄输入自动重连）。 |
| `android_adb` | 最后兜底：用配置的 adb 执行任意命令，返回 stdout/stderr/退出码。 |
| `android_install_apk` | 把本机 `.apk` 装到当前设备（`adb install`），默认覆盖安装；可选降级、授予权限；返回安装结果、大小和 adb 输出。 |
| `android_aab2apk` | 把 `.aab` 转成已签名 `.apk`，返回输出路径、大小、耗时、包名/版本与工具输出尾巴。 |

## 配置项

| key | 默认 | 说明 |
|---|---|---|
| `adbPath` | 随包 | 留空 = `scrcpy/adb.exe` |
| `scrcpyPath` | 空 | 精简包不含；需要独立 scrcpy 窗口时填本机 `scrcpy.exe` 路径 |
| `wirelessHost` | 空 | 无线调试设备 IP |
| `wirelessPort` | 5555 | adb connect 端口 |
| `pairingPort` | 0 | Android 11+ 配对端口（配对码不保存） |
| `autoConnect` | false | 启动后自动连接无线设备 |
| `videoMaxSize` | 720 | scrcpy 最大边 |
| `videoBitRate` | 2500000 | scrcpy 视频码率 |
| `videoFps` | 30 | scrcpy 最大帧率 |
| `videoEncoder` | 空 | 指定 MediaCodec 视频编码器；留空 = 自动。MIUI 卡顿时可填设备硬件编码器名 |
| `videoCodecOptions` | 空 | scrcpy `video_codec_options`，如 `i-frame-interval:float=1`（关键帧间隔 1 秒，弱网/卡顿恢复更快） |
| `previewFps` | 3 | 截图回退模式帧率 |
| `logcatMaxLines` | 5000 | 服务端日志环形缓冲 |
| `adbTimeoutMs` | 15000 | adb 默认超时 |
| `scrcpyExtraArgs` | 空 | 独立 scrcpy 窗口的额外参数 |

## 无线调试：三种连法

设置页的「无线调试」只有三个按钮，点开各自弹窗：

### 扫码配对（推荐，Android 11+）

1. 手机和电脑连同一个 Wi-Fi，手机打开 **开发者选项 → 无线调试**；
2. 在插件里点 **扫码配对**，会显示一个二维码（有效期 120 秒，一次性）；
3. 手机上点 **使用二维码配对设备**，扫描电脑上的二维码；
4. 插件自动完成 `adb pair` 并找到连接服务 `adb connect`，弹窗状态变成「已连接」。

> 二维码里是随机生成的配对服务名与一次性配对码（`WIFI:T:ADB;S:...;P:...;;`），不写进配置、也不落盘。它是电脑显示、手机来扫，电脑不需要摄像头。底层用 `adb mdns services` 发现 `_adb-tls-pairing._tcp` 服务，需要手机与电脑在同一局域网且防火墙放行 adb。

### 配对码配对

手机「无线调试 → 使用配对码配对设备」给出 IP、配对端口和六位配对码，填进弹窗点 **配对**。连接端口（通常 5555）和配对端口可能不同，配对成功后用「IP 直连」连接。

### IP 直连

已经配对过、手机 `无线调试` 页面直接显示 `IP:端口` 时，填 IP + 端口点 **连接** / **断开** 即可。改完的 IP / 端口记得点页面底部「保存」，下次启动才能自动连接（`autoConnect`）。

## 限制

- **DSH 版本**：`package.json` 声明 `engines.dsh: >=0.2.1-rc.3`，当前 0.2.1-rc.5 已验证；更老的 DSH 会被插件管理器判为不兼容而拒绝加载。
- **AAB → APK 依赖外部工具**：需要 Java（JDK 11+）和 Android SDK Build-Tools；`bundletool-all.jar` 已随包（`tools/`），缺 Java/SDK 时会在「检测工具」里提示。
- **GPU**：Android 没有统一 GPU 占用接口，不同 SoC 的 sysfs 不一样；读不到时明确显示不可用。
- **中文输入**：实时流下走 scrcpy control，支持 Unicode；只有回退到 `adb shell input text` 时才只支持 ASCII。
- **视频卡顿 / 延迟（不同厂商差异大）**：ColorOS 流畅、MIUI 卡顿很常见，通常是设备编码器或无线 ADB 链路导致。可在「设置 → 安卓调试」里降低 `videoMaxSize`（如 540）、`videoBitRate`（1.5–2 Mbps），或把 `videoCodecOptions` 填 `i-frame-interval:float=1`；必要时用 `videoEncoder` 指定硬件编码器。`/x-android-tool/state.json` 的 `stream.serverLog` 能看到 scrcpy 最终使用的编码器与报错。
- **手柄依赖 UHID**：摇杆 / 扳机 / 按住按键都通过 scrcpy 的 UHID 通道，需要实时推流（scrcpy-server 5.0.1，control=true）；推流不可用时自动退回 adb `keyevent`，只能点按、无法按住或摇杆。部分系统对 `/dev/uhid` 权限收紧时 UHID 会失败，此时同样退回 keyevent。
- **手柄类型是身份级**：XBox / PlayStation / Nintendo Switch 共用同一份通用 HID 报告描述符，只切换 VID/PID/名字和 NS 的 A/B/X/Y 换位；各家原生特性（DualSense 自适应扳机、Switch HD 震动等）不会生效。
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
