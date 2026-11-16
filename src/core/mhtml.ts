import { escapeHtml } from '@/utils/text'

function latin1Bytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i) & 0xff
  return bytes
}

function decodeQuotedPrintable(text: string): Uint8Array {
  const clean = text.replace(/=\r?\n/g, '')
  const bytes: number[] = []
  for (let i = 0; i < clean.length; i += 1) {
    if (clean[i] === '=' && /[0-9a-fA-F]{2}/.test(clean.slice(i + 1, i + 3))) {
      bytes.push(parseInt(clean.slice(i + 1, i + 3), 16))
      i += 2
    } else {
      bytes.push(clean.charCodeAt(i) & 0xff)
    }
  }
  return new Uint8Array(bytes)
}

function decodeBase64(text: string): Uint8Array {
  const raw = atob(text.replace(/\s/g, ''))
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function decodeBody(body: string, encoding: string): Uint8Array {
  const kind = encoding.toLowerCase().trim()
  if (kind === 'base64') return decodeBase64(body)
  if (kind === 'quoted-printable') return decodeQuotedPrintable(body)
  return latin1Bytes(body)
}

function parseHeaders(block: string): Record<string, string> {
  const headers: Record<string, string> = {}
  let current = ''
  for (const line of block.split(/\r?\n/)) {
    if (/^[ \t]/.test(line) && current) {
      headers[current] += ` ${line.trim()}`
      continue
    }
    const idx = line.indexOf(':')
    if (idx > 0) {
      current = line.slice(0, idx).trim().toLowerCase()
      headers[current] = line.slice(idx + 1).trim()
    }
  }
  return headers
}

function decodeTextPart(bytes: Uint8Array, charset?: string): string {
  try {
    return new TextDecoder(charset || 'utf-8').decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

/** 解析 MHTML（multipart/related），内联 cid 图片后返回 HTML */
export function parseMhtml(source: string): string {
  const boundaryMatch = /boundary\s*=\s*(?:"([^"]+)"|([^\s;]+))/i.exec(source)
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2]
  if (!boundary) {
    return `<pre style="white-space:pre-wrap;padding:24px;font-size:13px;">${escapeHtml(source.slice(0, 40000))}</pre>`
  }

  const escaped = boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = source.split(new RegExp(`--${escaped}(?:--)?`))
  const resources = new Map<string, string>()
  let html = ''

  for (const part of parts) {
    const normalized = part.replace(/^\r?\n/, '')
    const split = normalized.search(/\r?\n\r?\n/)
    if (split < 0) continue
    const headers = parseHeaders(normalized.slice(0, split))
    const body = normalized.slice(split).replace(/^\r?\n\r?\n/, '').replace(/\r?\n$/, '')
    const contentType = headers['content-type'] || ''
    const encoding = headers['content-transfer-encoding'] || ''
    const contentId = (headers['content-id'] || '').replace(/[<>]/g, '')
    const mime = contentType.split(';')[0].trim().toLowerCase()

    if (mime === 'text/html' && !html) {
      const kind = encoding.toLowerCase().trim()
      if (!kind || kind === '7bit' || kind === '8bit') {
        // 源文件已按 charset 解码为字符串，直接使用可避免再次按字节解码
        html = body
      } else {
        const charset = /charset\s*=\s*"?([^";]+)"?/i.exec(contentType)?.[1]
        html = decodeTextPart(decodeBody(body, encoding), charset)
      }
    } else if (mime.startsWith('image/') && contentId) {
      const data = decodeBody(body, encoding)
      resources.set(contentId, `data:${mime};base64,${bytesToBase64(data)}`)
    }
  }

  if (!html) {
    return `<pre style="white-space:pre-wrap;padding:24px;font-size:13px;">${escapeHtml(source.slice(0, 40000))}</pre>`
  }

  for (const [cid, dataUrl] of resources) {
    html = html.replace(new RegExp(`cid:${cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), dataUrl)
  }
  return html
}
