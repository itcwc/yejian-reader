/** 文本解码与 HTML 安全处理工具 */

const UTF8_BOM = [0xef, 0xbb, 0xbf]
const UTF16LE_BOM = [0xff, 0xfe]
const UTF16BE_BOM = [0xfe, 0xff]

function startsWith(bytes: Uint8Array, bom: number[]): boolean {
  if (bytes.length < bom.length) return false
  return bom.every((b, i) => bytes[i] === b)
}

function sniffDeclaredCharset(bytes: Uint8Array): string | null {
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 4096))
  const meta = /charset\s*=\s*["']?([\w-]+)/i.exec(head)
  const xml = /encoding\s*=\s*["']([\w-]+)["']/i.exec(head)
  const value = (meta?.[1] || xml?.[1] || '').toLowerCase()
  if (!value) return null
  const alias: Record<string, string> = { gbk: 'gb18030', gb2312: 'gb18030', 'utf8': 'utf-8' }
  return alias[value] ?? value
}

export function decodeBuffer(buffer: ArrayBuffer, declared?: string): string {
  const bytes = new Uint8Array(buffer)
  let encoding = declared?.toLowerCase()

  if (!encoding) {
    if (startsWith(bytes, UTF8_BOM)) encoding = 'utf-8'
    else if (startsWith(bytes, UTF16LE_BOM)) encoding = 'utf-16le'
    else if (startsWith(bytes, UTF16BE_BOM)) encoding = 'utf-16be'
    else encoding = sniffDeclaredCharset(bytes) ?? undefined
  }

  if (encoding) {
    try {
      return new TextDecoder(encoding).decode(bytes)
    } catch {
      /* 继续回退 */
    }
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    try {
      return new TextDecoder('gb18030').decode(bytes)
    } catch {
      return new TextDecoder('utf-8').decode(bytes)
    }
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** 移除脚本、内联事件与危险 URL，保留正文样式 */
export function sanitizeHtml(html: string): string {
  const template = document.createElement('template')
  template.innerHTML = html
  template.content
    .querySelectorAll('script, iframe, object, embed, link, meta, base, form, input, textarea, button')
    .forEach((node) => node.remove())
  template.content.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim()
      const isDangerousUrl = /^(javascript|data:text\/html)/i.test(value)
      if (
        name.startsWith('on') ||
        name === 'srcdoc' ||
        ((name === 'href' || name === 'src' || name === 'xlink:href') && isDangerousUrl)
      ) {
        el.removeAttribute(attr.name)
      }
    }
  })
  return template.innerHTML
}

export function countWords(text: string): number {
  const cjk = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  const latin = (text.match(/[A-Za-z0-9]+/g) || []).length
  return cjk + latin
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** i
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return '—'
  const d = new Date(timestamp)
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  const md = `${d.getMonth() + 1} 月 ${d.getDate()} 日`
  return sameYear ? md : `${d.getFullYear()} 年 ${md}`
}

export function formatDateTime(timestamp: number): string {
  if (!timestamp) return '—'
  const d = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
