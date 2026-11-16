import type { Book, FormatId, ImportIssue, ImportReport } from '@/types'
import { detectFormat, formatLabel, getFormatInfo, isNativeFormat, mimeOf } from './formats'
import { extractMetadata, titleFromFileName, type ExtractedMeta } from './metadata'
import {
  deleteBook as deleteBookRecord,
  getBook,
  getFile,
  hasBook,
  putBook,
  putCover,
  putFile,
  putBooks,
} from './db'
import { revokeCoverUrl } from './covers'

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function fallbackHash(bytes: Uint8Array): string {
  let h1 = 0x811c9dc5
  let h2 = 0x1000193
  for (let i = 0; i < bytes.length; i += 1) {
    h1 ^= bytes[i]
    h1 = Math.imul(h1, 0x01000193)
    h2 = Math.imul(h2 ^ bytes[i], 0x85ebca6b)
  }
  const part = (n: number) => (n >>> 0).toString(16).padStart(8, '0')
  return `${part(h1)}${part(h2)}${part(h1 ^ h2)}${part(Math.imul(h1, h2))}`
}

/** 取文件头 + 体积生成稳定指纹，跨设备同一本书得到同一 ID */
export async function fingerprint(buffer: ArrayBuffer, size: number): Promise<string> {
  const head = new Uint8Array(buffer.slice(0, Math.min(buffer.byteLength, 1024 * 1024)))
  let digest = ''
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const hash = await crypto.subtle.digest('SHA-256', head)
      digest = toHex(new Uint8Array(hash)).slice(0, 28)
    } catch {
      digest = fallbackHash(head)
    }
  } else {
    digest = fallbackHash(head)
  }
  return `${digest}-${size.toString(36)}`
}

export interface ImportOptions {
  /** 同步下载时由远端清单提供元数据，跳过解析 */
  preset?: Partial<Book>
  /** 由调用方指定 ID（通常用于 WebDAV 同步） */
  id?: string
  extract?: boolean
}

export async function importBlob(
  blob: Blob,
  fileName: string,
  format?: FormatId,
): Promise<{ book: Book | null; issue?: ImportIssue }> {
  return importBlobInternal(blob, fileName, format, {})
}

async function importBlobInternal(
  blob: Blob,
  fileName: string,
  format: FormatId | undefined,
  options: ImportOptions,
): Promise<{ book: Book | null; issue?: ImportIssue }> {
  const resolvedFormat = format ?? detectFormat(fileName)
  if (!resolvedFormat) {
    return {
      book: null,
      issue: { name: fileName, format: null, reason: '无法识别的文件格式' },
    }
  }

  if (!isNativeFormat(resolvedFormat)) {
    const info = getFormatInfo(resolvedFormat)
    return {
      book: null,
      issue: {
        name: fileName,
        format: info.label,
        reason: info.hint || `${info.label} 需要先转换为 PDF / EPUB`,
      },
    }
  }

  const buffer = await blob.arrayBuffer()
  const id = options.id ?? (await fingerprint(buffer, blob.size))

  if (await hasBook(id)) {
    return { book: null, issue: { name: fileName, format: formatLabel(resolvedFormat), reason: 'duplicate' } }
  }

  let extracted: ExtractedMeta = {
    title: options.preset?.title || titleFromFileName(fileName),
    author: options.preset?.author || '',
    meta: {},
  }

  if (options.extract !== false && !options.preset) {
    extracted = await extractMetadata(fileName, resolvedFormat, buffer)
  }

  const now = Date.now()
  const preset = options.preset
  const book: Book = {
    id,
    title: (preset?.title || extracted.title || titleFromFileName(fileName)).trim(),
    author: (preset?.author || extracted.author || '').trim(),
    format: resolvedFormat,
    fileName,
    size: blob.size,
    mime: blob.type || mimeOf(resolvedFormat),
    addedAt: preset?.addedAt ?? now,
    updatedAt: preset?.updatedAt ?? now,
    lastOpenedAt: preset?.lastOpenedAt ?? 0,
    percent: preset?.percent ?? 0,
    meta: {
      ...extracted.meta,
      ...(preset?.meta || {}),
      cover: Boolean(extracted.cover) || Boolean(preset?.meta?.cover),
    },
  }

  try {
    await putFile(id, blob)
    if (extracted.cover) await putCover(id, extracted.cover)
    await putBook(book)
  } catch (error) {
    return {
      book: null,
      issue: {
        name: fileName,
        format: formatLabel(resolvedFormat),
        reason: error instanceof Error ? error.message : '写入本地书架失败',
      },
    }
  }

  return { book }
}

export async function importFiles(
  files: ArrayLike<File>,
  onProgress?: (done: number, total: number, name: string) => void,
): Promise<ImportReport> {
  const list = Array.from(files)
  const report: ImportReport = { added: [], duplicates: 0, unsupported: [], failed: [] }

  for (let i = 0; i < list.length; i += 1) {
    const file = list[i]
    onProgress?.(i, list.length, file.name)
    try {
      const result = await importBlobInternal(file, file.name, undefined, {})
      if (result.book) {
        report.added.push(result.book)
      } else if (result.issue?.reason === 'duplicate') {
        report.duplicates += 1
      } else if (result.issue) {
        if (result.issue.format) report.unsupported.push(result.issue)
        else report.failed.push(result.issue)
      }
    } catch (error) {
      report.failed.push({
        name: file.name,
        format: null,
        reason: error instanceof Error ? error.message : '导入失败',
      })
    }
  }

  onProgress?.(list.length, list.length, '')
  return report
}

export interface BookBundle {
  book: Book
  blob: Blob
  buffer: ArrayBuffer
}

export async function getBookBundle(id: string): Promise<BookBundle | null> {
  const book = await getBook(id)
  if (!book) return null
  const blob = await getFile(id)
  if (!blob) return null
  const buffer = await blob.arrayBuffer()
  return { book, blob, buffer }
}

export async function updateBook(id: string, patch: Partial<Book>): Promise<Book | null> {
  const book = await getBook(id)
  if (!book) return null
  const next: Book = { ...book, ...patch, id: book.id, updatedAt: Date.now() }
  await putBook(next)
  return next
}

export async function removeBook(id: string): Promise<void> {
  revokeCoverUrl(id)
  await deleteBookRecord(id)
}

export async function syncRemoteBook(remote: {
  id: string
  title: string
  author: string
  format: FormatId
  fileName: string
  size: number
  addedAt: number
  updatedAt: number
  meta?: Book['meta']
}, blob: Blob): Promise<Book | null> {
  const result = await importBlobInternal(blob, remote.fileName, remote.format, {
    id: remote.id,
    extract: false,
    preset: {
      title: remote.title,
      author: remote.author,
      format: remote.format,
      fileName: remote.fileName,
      addedAt: remote.addedAt,
      updatedAt: remote.updatedAt,
      meta: remote.meta,
    },
  })
  return result.book
}

export async function saveBooksMeta(books: Book[]): Promise<void> {
  await putBooks(books)
}
