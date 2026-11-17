# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.6] - 2026-11-17

### Fixed

- 修复 Windows 自绘标题栏与最小化、最大化、关闭按钮之间的 1 像素底边错位。

## [0.1.5] - 2026-11-17

### Added

- 书籍封面随 WebDAV 同步：封面单独存入 `yejian/covers/`，换设备或重新同步后无需重新解析即可显示。

### Fixed

- 安卓端 WebDAV 请求显式发送 `Content-Length`，连接被服务端重置时会用 `Connection: close` 重试；若站点强制 HTTPS，会自动把 `http://` 地址升级为 `https://` 再试一次。

## [0.1.4] - 2026-11-17

### Fixed

- 自建 WebDAV 使用自签名证书时同步失败：桌面端与安卓端在证书校验失败后自动放宽校验重试一次，不再报 `self signed certificate`。

## [0.1.3] - 2026-11-17

### Added

- 导航栏新增「阅读统计」页：藏书/在读/已完成概览、最近 30 天阅读节奏、格式分布与继续阅读入口。
- 设置页新增「阅读主题」选择，可与应用主题分别设置。
- Windows 桌面端改用自绘标题栏，颜色与符号随应用主题变化。

### Fixed

- 桌面端与安卓应用内同步无法连接 WebDAV：改用原生 HTTP 栈发起请求，不再受站点 CORS 限制，支持 PROPFIND / MKCOL 等自定义方法。
- 「格式支持」与「导入结果」弹窗的关闭按钮、遮罩点击、Esc 无法关闭。

## [0.1.2] - 2026-11-17

### Added

- 阅读主题与应用主题拆分：阅读时的纸面主题在「阅读设置 → 阅读主题」中单独选择，可与应用主题不同。
- 设置页新增独立的「版本更新」面板，显示当前版本并提供检查更新 / 前往下载入口。

### Changed

- Windows 原生窗口外框跟随应用主题：夜读时标题栏与窗口底色变深，避免白边与白底。
- 侧栏与移动端底栏互换「设置」「外观」位置，设置图标改为齿轮。
- 关于页间的 `dt` / `dd` 改为同行左右对齐，窄屏不再上下堆叠。

### Fixed

- 窄屏下搜索框无法收缩，导致首页出现横向滚动（375px 实测越界 9px）。

## [0.1.1] - 2026-11-17

### Added

- Windows 应用内自动更新：基于 `electron-updater` 与 GitHub Releases，启动后自动检查并在右下角提示，可下载后重启安装；「设置 → 关于页间」支持手动检查。
- Android 应用内更新：读取 Release 中的 `update.json`，下载 APK、校验 SHA-256 后调起系统安装器。
- Android 固定 debug 签名（`android-webview/keystore/yejian-debug.jks`），保证后续版本可覆盖安装。
- 设置页显示当前版本号。
- CI 生成并上传 `update.json`，供 Android 检查版本。

### Changed

- Windows 安装包改为 ASCII 文件名 `yejian-v<version>-windows-x64.exe`，与 `latest.yml` 中的路径一致，修复自动更新 404。
- 版本号升级至 0.1.1。

### Notes

- v0.1.0 的 Android 包由 CI 临时签名，无法直接覆盖安装，首次升级请先卸载旧版。

## [0.1.0] - 2026-11-16

首个公开版本。

### Added

- Web / Windows（Electron）/ Android（uni-app）三端阅读应用，共用同一套阅读内核。
- 直接阅读 EPUB、PDF、TXT、Markdown、RTF、FB2、HTML/HTM/XHTML/XML、MHTML、CBZ、CBT、DOCX。
- 识别 MOBI/AZW/AZW3、CHM、CBR/CB7、DOC/PPT/PPTX、XPS/OXPS、DjVu、OFD、CAJ，并给出转换指引。
- 翻页与连续滚动两种阅读方式，切换时保留阅读位置。
- 点击左右翻页、点击中央正方形开合工具栏，首次进入展示一次性热区引导。
- 白色、黑色、护眼绿三套主题，覆盖书架、阅读器、目录与设置面板。
- 排版设置：字号、行距、版心、字体；PDF 夜读反色与护眼滤镜；漫画单页/双页。
- IndexedDB 本地书库与阅读进度持久化，刷新、退出、切页后自动续读。
- WebDAV 同步书目、阅读进度与书籍文件；进度按 `updatedAt` 合并，先下载书籍再合并进度。
- 开发/预览服务器内置 `/__dav` 同源代理，绕过浏览器 CORS 限制。
- 书架搜索、筛选、排序、拖拽导入、导入报告与格式矩阵说明。
- README 中英文版本与桌面、移动端界面截图。
- GitHub Actions 自动创建 Release，并构建上传 Windows 安装包与 Android APK。

### Fixed

- 书架「继续阅读」进度条与百分比显示为空白（模板变量名拼写错误）。

### Known limitations

- 需要转换的格式不内置转换器；CAJ 需先用 CAJViewer 导出 PDF。
- 纯静态网页部署需 WebDAV 服务端配置 CORS 或反向代理；桌面端与安卓应用使用原生请求，不受此限制。
- 不支持带 DRM 的 EPUB/PDF。

[0.1.6]: https://github.com/itcwc/yejian-reader/releases/tag/v0.1.6
[0.1.5]: https://github.com/itcwc/yejian-reader/releases/tag/v0.1.5
[0.1.4]: https://github.com/itcwc/yejian-reader/releases/tag/v0.1.4
[0.1.3]: https://github.com/itcwc/yejian-reader/releases/tag/v0.1.3
[0.1.2]: https://github.com/itcwc/yejian-reader/releases/tag/v0.1.2
[0.1.1]: https://github.com/itcwc/yejian-reader/releases/tag/v0.1.1
[0.1.0]: https://github.com/itcwc/yejian-reader/releases/tag/v0.1.0
