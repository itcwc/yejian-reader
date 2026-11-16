import type { Book, RemoteBookMeta, RemoteManifest, RemoteProgressFile, SyncConfig, SyncSummary } from '@/types'
import { getDeviceInfo } from './device'
import { getBookBundle, syncRemoteBook } from './library'
import { listBooks, listProgress, mergeProgress } from './db'
import { WebdavClient, WebdavError } from './webdav'

const BASE_DIR = 'yejian'
const BOOKS_DIR = 'yejian/books'
const PROGRESS_FILE = 'yejian/progress.json'
const MANIFEST_FILE = 'yejian/books.json'

export interface SyncCallbacks {
  onStage?: (stage: string) => void
}

function remoteFileName(meta: RemoteBookMeta): string {
  const ext = meta.fileName.split('.').pop()?.toLowerCase() || meta.format
  return `${meta.id}.${ext}`
}

function toRemoteMeta(book: Book): RemoteBookMeta {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    format: book.format,
    size: book.size,
    fileName: book.fileName,
    addedAt: book.addedAt,
    updatedAt: book.updatedAt,
    meta: book.meta,
  }
}

function parseManifest(text: string | null): RemoteManifest | null {
  if (!text) return null
  try {
    const parsed = JSON.parse(text) as RemoteManifest
    if (!parsed || !Array.isArray(parsed.books)) return null
    return parsed
  } catch {
    return null
  }
}

function parseProgress(text: string | null): RemoteProgressFile | null {
  if (!text) return null
  try {
    const parsed = JSON.parse(text) as RemoteProgressFile
    if (!parsed || typeof parsed.items !== 'object' || !parsed.items) return null
    return parsed
  } catch {
    return null
  }
}

function friendlyError(error: unknown): string {
  if (error instanceof WebdavError) return error.message
  if (error instanceof Error) return error.message
  return '同步过程中发生未知错误'
}

/** 执行一次完整同步：合并阅读进度、按需同步书籍文件 */
export async function runSync(config: SyncConfig, callbacks: SyncCallbacks = {}): Promise<SyncSummary> {
  const at = Date.now()
  const baseSummary: SyncSummary = {
    at,
    ok: false,
    message: '',
    progressPulled: 0,
    progressPushed: 0,
    booksDownloaded: 0,
    booksUploaded: 0,
    bytes: 0,
  }

  const device = getDeviceInfo()

  try {
    if (!config.url.trim()) throw new WebdavError('config', '请先填写 WebDAV 服务器地址')

    const client = new WebdavClient(config)
    callbacks.onStage?.('连接服务器')
    await client.test()
    callbacks.onStage?.('准备同步目录')
    await client.ensureCollection(BASE_DIR)
    await client.ensureCollection(BOOKS_DIR)

    callbacks.onStage?.('读取云端记录')
    const [manifestText, progressText] = await Promise.all([
      client.getText(MANIFEST_FILE),
      client.getText(PROGRESS_FILE),
    ])
    const remoteManifest = parseManifest(manifestText)
    const remoteProgress = parseProgress(progressText)

    const localBooks = await listBooks()
    const localBookIds = new Set(localBooks.map((book) => book.id))
    const localProgress = await listProgress()

    /* ---------- 书目清单 ---------- */
    callbacks.onStage?.('合并书目')
    const mergedBooks = new Map<string, RemoteBookMeta>()
    for (const book of remoteManifest?.books || []) {
      if (book?.id) mergedBooks.set(book.id, book)
    }
    for (const book of localBooks) {
      const local = toRemoteMeta(book)
      const remote = mergedBooks.get(local.id)
      if (!remote || remote.updatedAt <= local.updatedAt) {
        mergedBooks.set(local.id, local)
      }
    }

    /* ---------- 书籍文件 ---------- */
    let booksDownloaded = 0
    let booksUploaded = 0
    let bytes = 0

    if (config.syncBooks) {
      callbacks.onStage?.('下载云端书籍')
      const remoteFiles = new Map((remoteManifest?.books || []).map((book) => [book.id, book]))
      for (const meta of mergedBooks.values()) {
        if (localBookIds.has(meta.id)) continue
        const remoteMeta = remoteFiles.get(meta.id)
        if (!remoteMeta) continue
        const blob = await client.getBlob(`${BOOKS_DIR}/${remoteFileName(remoteMeta)}`).catch(() => null)
        if (!blob) continue
        const book = await syncRemoteBook(remoteMeta, blob)
        if (book) {
          localBookIds.add(book.id)
          booksDownloaded += 1
          bytes += blob.size
        }
      }

      callbacks.onStage?.('上传本地书籍')
      for (const book of localBooks) {
        const remote = remoteFiles.get(book.id)
        if (remote) continue
        const bundle = await getBookBundle(book.id).catch(() => null)
        if (!bundle) continue
        await client.put(
          `${BOOKS_DIR}/${remoteFileName(toRemoteMeta(book))}`,
          bundle.blob,
        )
        booksUploaded += 1
        bytes += bundle.blob.size
      }
    }

    /* ---------- 阅读进度（在书籍下载后合并，确保新设备也能落到书架上） ---------- */
    callbacks.onStage?.('合并阅读进度')
    const remoteItems = remoteProgress?.items ? { ...remoteProgress.items } : {}
    let progressPushed = 0
    let progressPulled = 0

    for (const local of localProgress) {
      const remote = remoteItems[local.bookId]
      if (!remote || remote.updatedAt < local.updatedAt) {
        remoteItems[local.bookId] = {
          percent: local.percent,
          locator: local.locator,
          detail: local.detail,
          updatedAt: local.updatedAt,
          device: local.device || device.name,
        }
        progressPushed += 1
      } else if (remote.updatedAt > local.updatedAt) {
        const changed = await mergeProgress({ ...remote, bookId: local.bookId })
        if (changed) progressPulled += 1
      }
    }

    for (const [bookId, remote] of Object.entries(remoteItems)) {
      if (!localBookIds.has(bookId)) continue
      if (localProgress.some((item) => item.bookId === bookId)) continue
      const changed = await mergeProgress({ ...remote, bookId })
      if (changed) progressPulled += 1
    }

    /* ---------- 写回云端 ---------- */
    callbacks.onStage?.('写入云端记录')
    const now = Date.now()
    const manifest: RemoteManifest = {
      version: 1,
      updatedAt: now,
      books: Array.from(mergedBooks.values()),
    }
    const progressPayload: RemoteProgressFile = {
      version: 1,
      updatedAt: now,
      items: remoteItems,
    }

    await Promise.all([
      client.put(MANIFEST_FILE, JSON.stringify(manifest)),
      client.put(PROGRESS_FILE, JSON.stringify(progressPayload)),
    ])

    const parts: string[] = []
    if (booksDownloaded) parts.push(`下载 ${booksDownloaded} 本`)
    if (booksUploaded) parts.push(`上传 ${booksUploaded} 本`)
    if (progressPulled) parts.push(`拉取 ${progressPulled} 条进度`)
    if (progressPushed) parts.push(`推送 ${progressPushed} 条进度`)
    if (!parts.length) parts.push('云端与本地已一致')

    return {
      ...baseSummary,
      ok: true,
      message: parts.join(' · '),
      progressPulled,
      progressPushed,
      booksDownloaded,
      booksUploaded,
      bytes,
    }
  } catch (error) {
    return { ...baseSummary, ok: false, message: friendlyError(error) }
  }
}
