import type { BookExtra, FormatId } from '@/types'
import { decodeBuffer, stripTags } from '@/utils/text'
import { readPdfMetadata } from './pdf'

export interface ExtractedMeta {
  title?: string
  author?: string
  meta: BookExtra
  cover?: Blob
}

export function titleFromFileName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || fileName
}

function isProbablyText(value: string): boolean {
  return /[\u4e00-\u9fa5A-Za-z0-9]/.test(value)
}

function imageMime(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    avif: 'image/avif',
    bmp: 'image/bmp',
  }
  return map[ext || ''] ?? 'image/jpeg'
}

async function loadZip(buffer: ArrayBuffer) {
  const { default: JSZip } = await import('jszip')
  return JSZip.loadAsync(buffer)
}

function resolveZipPath(baseDir: string, href: string): string {
  const clean = decodeURIComponent(href.split('#')[0])
  const parts = `${baseDir}/${clean}`.split('/')
  const stack: string[] = []
  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') stack.pop()
    else stack.push(part)
  }
  return stack.join('/')
}

export async function extractMetadata(
  fileName: string,
  format: FormatId,
  buffer: ArrayBuffer,
): Promise<ExtractedMeta> {
  const fallback: ExtractedMeta = {
    title: titleFromFileName(fileName),
    author: '',
    meta: {},
  }

  try {
    switch (format) {
      case 'epub':
        return { ...fallback, ...(await extractEpub(buffer)) }
      case 'pdf': {
        const pdf = await readPdfMetadata(buffer)
        return {
          title: pdf.title || fallback.title,
          author: pdf.author || '',
          meta: { pageCount: pdf.pageCount, cover: Boolean(pdf.cover) },
          cover: pdf.cover,
        }
      }
      case 'fb2':
        return { ...fallback, ...(await extractFb2(buffer)) }
      case 'cbz':
      case 'cbt':
        return { ...fallback, ...(await extractComicMeta(buffer, format)) }
      case 'docx':
        return { ...fallback, ...(await extractDocx(buffer)) }
      case 'html':
      case 'xhtml':
      case 'mhtml': {
        const text = decodeBuffer(buffer)
        const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(text)
        const title = match ? stripTags(match[1]) : ''
        return { ...fallback, title: isProbablyText(title) ? title : fallback.title, meta: {} }
      }
      case 'txt':
      case 'md':
      case 'rtf':
      case 'xml':
        return fallback
      default:
        return fallback
    }
  } catch {
    return fallback
  }
}

/* ----------------------------- EPUB ----------------------------- */

async function extractEpub(buffer: ArrayBuffer): Promise<ExtractedMeta> {
  const zip = await loadZip(buffer)
  const containerFile = zip.file('META-INF/container.xml')
  if (!containerFile) throw new Error('缺少 container.xml')
  const containerXml = await containerFile.async('string')
  const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml')
  const rootfile = containerDoc.getElementsByTagName('rootfile')[0]
  const opfPath = rootfile?.getAttribute('full-path')
  if (!opfPath) throw new Error('找不到 OPF')

  const opfFile = zip.file(opfPath)
  if (!opfFile) throw new Error('OPF 文件缺失')
  const opfXml = await opfFile.async('string')
  const opf = new DOMParser().parseFromString(opfXml, 'application/xml')

  const dc = (name: string): string => {
    const ns = opf.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', name)[0]
    const plain = opf.getElementsByTagName(`dc:${name}`)[0]
    return (ns?.textContent || plain?.textContent || '').trim()
  }

  const title = dc('title')
  const author = dc('creator')
  const publisher = dc('publisher')
  const language = dc('language')
  const description = stripTags(dc('description'))
  const spineCount = opf.getElementsByTagName('itemref').length

  const metaTags = Array.from(opf.getElementsByTagName('meta'))
  const coverId = metaTags.find((m) => m.getAttribute('name') === 'cover')?.getAttribute('content') || ''
  const items = Array.from(opf.getElementsByTagName('item'))
  const coverItem =
    items.find((item) => coverId && item.getAttribute('id') === coverId) ||
    items.find((item) => (item.getAttribute('properties') || '').includes('cover-image')) ||
    items.find((item) => /cover/i.test(item.getAttribute('href') || '') && /image/i.test(item.getAttribute('media-type') || ''))

  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : ''
  let cover: Blob | undefined
  if (coverItem) {
    const href = coverItem.getAttribute('href')
    if (href) {
      const path = resolveZipPath(opfDir, href)
      const entry = zip.file(path) || zip.file(resolveZipPath(opfDir, decodeURIComponent(href)))
      if (entry) {
        const data = await entry.async('arraybuffer')
        cover = new Blob([data], { type: coverItem.getAttribute('media-type') || imageMime(path) })
      }
    }
  }

  return {
    title: title || undefined,
    author: author || undefined,
    meta: {
      publisher: publisher || undefined,
      language: language || undefined,
      description: description ? description.slice(0, 600) : undefined,
      chapterCount: spineCount || undefined,
      cover: Boolean(cover),
    },
    cover,
  }
}

/* ----------------------------- FB2 ----------------------------- */

async function extractFb2(buffer: ArrayBuffer): Promise<ExtractedMeta> {
  const xml = decodeBuffer(buffer)
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const titleInfo = doc.getElementsByTagName('title-info')[0]
  if (!titleInfo) throw new Error('缺少 title-info')
  const text = (tag: string) => {
    const node = titleInfo.getElementsByTagName(tag)[0]
    return node?.textContent?.trim() || ''
  }
  const first = text('first-name')
  const middle = text('middle-name')
  const last = text('last-name')
  const author = [first, middle, last].filter(Boolean).join(' ')

  let cover: Blob | undefined
  const coverImage = titleInfo.getElementsByTagName('coverpage')[0]?.getElementsByTagName('image')[0]
  const href = coverImage?.getAttribute('l:href') || coverImage?.getAttribute('href') || ''
  const binaryId = href.replace(/^#/, '')
  if (binaryId) {
    const binaries = Array.from(doc.getElementsByTagName('binary'))
    const binary = binaries.find((b) => b.getAttribute('id') === binaryId)
    if (binary?.textContent) {
      const raw = atob(binary.textContent.replace(/\s/g, ''))
      const bytes = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
      cover = new Blob([bytes], { type: binary.getAttribute('content-type') || 'image/jpeg' })
    }
  }

  return {
    title: text('book-title') || undefined,
    author: author || undefined,
    meta: { cover: Boolean(cover) },
    cover,
  }
}

/* ----------------------------- 漫画 ----------------------------- */

function isImageName(name: string): boolean {
  return /\.(jpe?g|png|webp|gif|avif|bmp)$/i.test(name) && !name.startsWith('__MACOSX')
}

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

async function extractComicMeta(buffer: ArrayBuffer, format: FormatId): Promise<ExtractedMeta> {
  const names: string[] = []
  let firstData: ArrayBuffer | undefined

  if (format === 'cbz') {
    const zip = await loadZip(buffer)
    Object.keys(zip.files)
      .filter((name) => !zip.files[name].dir && isImageName(name))
      .sort(naturalSort)
      .forEach((name) => names.push(name))
    if (names[0]) firstData = await zip.files[names[0]].async('arraybuffer')
  } else {
    const entries = extractTar(buffer)
    const images = entries.filter((entry) => isImageName(entry.name)).sort((a, b) => naturalSort(a.name, b.name))
    images.forEach((entry) => names.push(entry.name))
    if (images[0]) firstData = images[0].data.buffer.slice(0) as ArrayBuffer
  }

  return {
    meta: { pageCount: names.length, cover: Boolean(firstData) },
    cover: firstData ? new Blob([firstData], { type: imageMime(names[0] || '') }) : undefined,
  }
}

export interface TarEntry {
  name: string
  data: Uint8Array
}

/** 解析未压缩 tar（CBT 漫画包） */
export function extractTar(buffer: ArrayBuffer): TarEntry[] {
  const bytes = new Uint8Array(buffer)
  const entries: TarEntry[] = []
  let offset = 0
  const readString = (start: number, length: number) => {
    let end = start
    while (end < start + length && bytes[end] !== 0) end += 1
    return new TextDecoder().decode(bytes.slice(start, end))
  }
  const readOctal = (start: number, length: number) => {
    const raw = readString(start, length).trim()
    return raw ? parseInt(raw, 8) : 0
  }

  while (offset + 512 <= bytes.length) {
    const name = readString(offset, 100)
    if (!name) {
      offset += 512
      continue
    }
    const size = readOctal(offset + 124, 12)
    const type = readString(offset + 156, 1) || '0'
    const prefix = readString(offset + 345, 155)
    const fullName = prefix ? `${prefix}/${name}` : name
    const dataStart = offset + 512
    if (type === '0' && size > 0 && dataStart + size <= bytes.length) {
      entries.push({ name: fullName, data: bytes.slice(dataStart, dataStart + size) })
    }
    offset = dataStart + Math.ceil(size / 512) * 512
  }
  return entries
}

/* ----------------------------- DOCX ----------------------------- */

async function extractDocx(buffer: ArrayBuffer): Promise<ExtractedMeta> {
  const zip = await loadZip(buffer)
  const core = zip.file('docProps/core.xml')
  if (!core) return { meta: {} }
  const xml = await core.async('string')
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const pick = (tag: string) => doc.getElementsByTagNameNS('*', tag)[0]?.textContent?.trim() || ''
  return {
    title: pick('title') || undefined,
    author: pick('creator') || undefined,
    meta: {},
  }
}
