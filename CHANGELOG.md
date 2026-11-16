# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与 [语义化版本](https://semver.org/lang/zh-CN/)。

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

### Fixed

- 书架「继续阅读」进度条与百分比显示为空白（模板变量名拼写错误）。

### Known limitations

- 需要转换的格式不内置转换器；CAJ 需先用 CAJViewer 导出 PDF。
- 纯静态部署与 Android WebView 需 WebDAV 服务端配置 CORS 或反向代理。
- 不支持带 DRM 的 EPUB/PDF。

[0.1.0]: https://github.com/itcwc/yejian-reader/releases/tag/v0.1.0
