import { t } from '@/core/i18n'
import type { Book, ReadingProgress } from '@/types'
import { readBackupBooks, restoreBackupBooks, type BackupBook } from './db'
import { isNativeFormat } from './formats'
import { bytesToBase64 } from './nativeDav'

const MAGIC = 'YEJIAN-BACKUP\n'
const MAX_MANIFEST_BYTES = 16 * 1024 * 1024
const encoder = new TextEncoder()
const headerSize = MAGIC.length + 4

interface BackupEntry {
  book: Book
  progress?: ReadingProgress
  cover?: { size: number; type: string }
}

interface BackupManifest {
  version: 1
  entries: BackupEntry[]
}

export async function exportLibraryBackup(): Promise<{ blob: Blob; count: number }> {
  const books = await readBackupBooks()
  if (!books.length) throw new Error(t('书架为空，没有可导出的书籍'))
  const manifest: BackupManifest = {
    version: 1,
    entries: books.map(({ book, cover, progress }) => ({
      book,
      progress,
      cover: cover ? { size: cover.size, type: cover.type } : undefined,
    })),
  }
  const json = encoder.encode(JSON.stringify(manifest))
  if (json.byteLength > MAX_MANIFEST_BYTES) throw new Error(t('书库清单太大，无法导出'))
  const header = new Uint8Array(headerSize)
  header.set(encoder.encode(MAGIC))
  new DataView(header.buffer).setUint32(MAGIC.length, json.byteLength)
  const parts: BlobPart[] = [header, json]
  for (const { book, file, cover } of books) {
    if (file.size !== book.size) throw new Error(`《${book.title}》的书籍文件大小不符`)
    parts.push(file)
    if (cover) parts.push(cover)
  }
  return { blob: new Blob(parts, { type: 'application/octet-stream' }), count: books.length }
}

function nonnegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function percent(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
}

function validBook(book: Book | undefined): book is Book {
  return Boolean(book && typeof book.id === 'string' && /^[a-z0-9-]{1,128}$/i.test(book.id)
    && [book.title, book.author, book.fileName, book.mime].every((value) => typeof value === 'string')
    && typeof book.format === 'string' && isNativeFormat(book.format)
    && [book.size, book.addedAt, book.updatedAt, book.lastOpenedAt].every(nonnegative)
    && percent(book.percent) && book.meta && typeof book.meta === 'object' && !Array.isArray(book.meta))
}

function validProgress(progress: ReadingProgress, id: string): boolean {
  return Boolean(progress && progress.bookId === id && percent(progress.percent)
    && nonnegative(progress.updatedAt)
    && (progress.locator === null || typeof progress.locator === 'string')
    && (progress.device === undefined || typeof progress.device === 'string')
    && (progress.detail === undefined || (progress.detail
      && typeof progress.detail === 'object' && !Array.isArray(progress.detail)
      && (progress.detail.page === undefined || nonnegative(progress.detail.page))
      && (progress.detail.totalPages === undefined || nonnegative(progress.detail.totalPages))
      && (progress.detail.chapter === undefined || typeof progress.detail.chapter === 'string'))))
}

export async function importLibraryBackup(blob: Blob) {
  const invalid = () => new Error(t('备份文件无效或不完整'))
  if (blob.size < headerSize) throw invalid()
  const header = await blob.slice(0, headerSize).arrayBuffer()
  if (new TextDecoder().decode(header.slice(0, MAGIC.length)) !== MAGIC) throw invalid()
  const size = new DataView(header).getUint32(MAGIC.length)
  if (!size || size > MAX_MANIFEST_BYTES || headerSize + size > blob.size) throw invalid()
  let offset = headerSize + size
  let manifest: BackupManifest
  try {
    manifest = JSON.parse(await blob.slice(headerSize, offset).text())
  } catch {
    throw invalid()
  }
  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.entries)) throw invalid()

  const take = (length: number, type: string) => {
    if (length > blob.size - offset) throw invalid()
    const part = blob.slice(offset, offset + length, type)
    offset += length
    return part
  }
  const ids = new Set<string>()
  const entries: BackupBook[] = []
  for (const entry of manifest.entries) {
    if (!validBook(entry?.book) || ids.has(entry.book.id)) throw invalid()
    const { book, cover, progress } = entry
    if (progress !== undefined && !validProgress(progress, book.id)) throw invalid()
    if (cover !== undefined && (!cover || !nonnegative(cover.size) || typeof cover.type !== 'string')) {
      throw invalid()
    }
    ids.add(book.id)
    entries.push({
      book,
      file: take(book.size, book.mime),
      cover: cover ? take(cover.size, cover.type) : undefined,
      progress,
    })
  }
  if (offset !== blob.size) throw invalid()
  return restoreBackupBooks(entries)
}

export async function saveLibraryBackup(blob: Blob): Promise<boolean> {
  const name = `yejian-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.yejianbackup`
  const native = window.YeJianBackup
  if (native) {
    const status = await new Promise<string>((resolve, reject) => {
      window.__yejianBackupChosen = resolve
      try { native.choose(name) } catch (error) { reject(error) }
    }).finally(() => { delete window.__yejianBackupChosen })
    if (status === 'cancelled') return false
    if (status !== 'ready') throw new Error(t('无法打开保存位置'))
    let saved = false
    try {
      const chunkSize = 256 * 1024
      for (let offset = 0; offset < blob.size; offset += chunkSize) {
        const chunk = new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer())
        if (!native.write(bytesToBase64(chunk))) throw new Error(t('无法写入备份文件'))
      }
      saved = native.finish()
      if (!saved) throw new Error(t('无法保存备份文件'))
    } finally {
      if (!saved) native.cancel()
    }
    return true
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return true
}
