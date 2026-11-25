import type { FormatGroup, FormatId, FormatInfo, SupportLevel } from '@/types'

const nativeHint = '可直接在页间中打开'

const FORMATS: FormatInfo[] = [
  { id: 'epub', label: 'EPUB', group: '电子书', level: 'native' },
  { id: 'pdf', label: 'PDF', group: '电子书', level: 'native' },
  {
    id: 'mobi',
    label: 'MOBI',
    group: '电子书',
    level: 'convert',
    hint: 'Kindle 私有格式。用 Calibre 执行 ebook-convert 转为 EPUB 后导入。',
  },
  {
    id: 'azw',
    label: 'AZW',
    group: '电子书',
    level: 'convert',
    hint: 'Kindle 私有格式。用 Calibre 转为 EPUB 后导入。',
  },
  {
    id: 'azw3',
    label: 'AZW3',
    group: '电子书',
    level: 'convert',
    hint: 'Kindle 私有格式。用 Calibre 转为 EPUB 后导入。',
  },
  { id: 'fb2', label: 'FB2', group: '电子书', level: 'native' },
  { id: 'txt', label: 'TXT', group: '纯文本', level: 'native' },
  { id: 'md', label: 'Markdown', group: '纯文本', level: 'native' },
  { id: 'rtf', label: 'RTF', group: '纯文本', level: 'native' },
  { id: 'html', label: 'HTML', group: '网页', level: 'native' },
  { id: 'xhtml', label: 'XHTML', group: '网页', level: 'native' },
  { id: 'xml', label: 'XML', group: '网页', level: 'native' },
  { id: 'mhtml', label: 'MHTML', group: '网页', level: 'native' },
  {
    id: 'chm',
    label: 'CHM',
    group: '网页',
    level: 'convert',
    hint: 'Windows 帮助文档格式。用 7-Zip 解包取 HTML，或用 Calibre 转为 EPUB。',
  },
  { id: 'cbz', label: 'CBZ', group: '漫画', level: 'native' },
  {
    id: 'cbr',
    label: 'CBR',
    group: '漫画',
    level: 'convert',
    hint: 'RAR 压缩的漫画包。用 7-Zip / WinRAR 解压后重新打包为 CBZ。',
  },
  { id: 'cbt', label: 'CBT', group: '漫画', level: 'native' },
  {
    id: 'cb7',
    label: 'CB7',
    group: '漫画',
    level: 'convert',
    hint: '7z 压缩的漫画包。用 7-Zip 解压后重新打包为 CBZ。',
  },
  {
    id: 'doc',
    label: 'DOC',
    group: '文档',
    level: 'convert',
    hint: '旧版 Word 文档。用 Office / WPS 另存为 DOCX 或 PDF 后导入。',
  },
  { id: 'docx', label: 'DOCX', group: '文档', level: 'native' },
  {
    id: 'ppt',
    label: 'PPT',
    group: '文档',
    level: 'convert',
    hint: '旧版演示文稿。用 Office / WPS 另存为 PDF 后导入。',
  },
  {
    id: 'pptx',
    label: 'PPTX',
    group: '文档',
    level: 'convert',
    hint: '演示文稿。用 Office / WPS 导出为 PDF 后导入。',
  },
  {
    id: 'xps',
    label: 'XPS',
    group: '文档',
    level: 'convert',
    hint: 'Windows 固定版式文档。用系统「打印为 PDF」后导入。',
  },
  {
    id: 'oxps',
    label: 'OXPS',
    group: '文档',
    level: 'convert',
    hint: 'Windows 固定版式文档。用系统「打印为 PDF」后导入。',
  },
  {
    id: 'djvu',
    label: 'DjVu',
    group: '文档',
    level: 'convert',
    hint: '扫描书籍格式。用 DjVuLibre 的 ddjvu 转为 PDF，或 SumatraPDF 导出 PDF。',
  },
  {
    id: 'ofd',
    label: 'OFD',
    group: '文档',
    level: 'convert',
    hint: '国产版式文档。用数科 OFD 阅读器或 WPS 导出 PDF 后导入。',
  },
  {
    id: 'caj',
    label: 'CAJ',
    group: '学术',
    level: 'convert',
    hint: '知网学术格式。用 CAJViewer 导出 PDF 后导入（导入时自动转换需桌面转换工具）。',
  },
]

const ALIASES: Record<string, FormatId> = {
  htm: 'html',
  djv: 'djvu',
  markdown: 'md',
  mht: 'mhtml',
}

export const FORMAT_MAP = new Map<FormatId, FormatInfo>(FORMATS.map((f) => [f.id, f]))

export const FORMAT_GROUPS: FormatGroup[] = ['电子书', '纯文本', '网页', '漫画', '文档', '学术']

export const SUPPORTED_NATIVE: FormatInfo[] = FORMATS.filter((f) => f.level === 'native')

export const ACCEPT_EXTENSIONS = [
  'epub', 'pdf', 'mobi', 'azw', 'azw3', 'fb2',
  'txt', 'md', 'rtf',
  'html', 'htm', 'xhtml', 'xml', 'mhtml', 'mht', 'chm',
  'cbz', 'cbr', 'cbt', 'cb7',
  'doc', 'docx', 'ppt', 'pptx', 'xps', 'oxps', 'djvu', 'djv', 'ofd', 'caj',
]

export const ACCEPT_ATTR = ACCEPT_EXTENSIONS.map((e) => `.${e}`).join(',')

export function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf('.')
  return idx >= 0 ? fileName.slice(idx + 1).toLowerCase() : ''
}

export function detectFormat(fileName: string): FormatId | null {
  const ext = extensionOf(fileName)
  if (!ext) return null
  const normalized = ALIASES[ext] ?? (ext as FormatId)
  return FORMAT_MAP.has(normalized) ? normalized : null
}

export function getFormatInfo(id: FormatId): FormatInfo {
  return FORMAT_MAP.get(id) ?? { id, label: id.toUpperCase(), group: '文档', level: 'convert' }
}

export function isNativeFormat(id: FormatId): boolean {
  return getFormatInfo(id).level === 'native'
}

export function formatLabel(id: FormatId): string {
  return getFormatInfo(id).label
}

export function supportLabel(level: SupportLevel): string {
  return level === 'native' ? '直接阅读' : '需转换'
}

/** MIME 类型，用于 WebDAV 上传与阅读器判断 */
export function mimeOf(format: FormatId): string {
  const map: Partial<Record<FormatId, string>> = {
    epub: 'application/epub+zip',
    pdf: 'application/pdf',
    mobi: 'application/x-mobipocket-ebook',
    azw: 'application/vnd.amazon.ebook',
    azw3: 'application/vnd.amazon.ebook',
    fb2: 'application/x-fictionbook+xml',
    txt: 'text/plain',
    md: 'text/markdown',
    rtf: 'application/rtf',
    html: 'text/html',
    xhtml: 'application/xhtml+xml',
    xml: 'application/xml',
    mhtml: 'multipart/related',
    cbz: 'application/vnd.comicbook+zip',
    cbr: 'application/vnd.comicbook-rar',
    cbt: 'application/x-tar',
    cb7: 'application/x-7z-compressed',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xps: 'application/vnd.ms-xpsdocument',
    oxps: 'application/oxps',
    djvu: 'image/vnd.djvu',
    ofd: 'application/ofd',
    caj: 'application/caj',
    chm: 'application/vnd.ms-htmlhelp',
  }
  return map[format] ?? 'application/octet-stream'
}
