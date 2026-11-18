import type { Book, RemoteBookMeta, RemoteManifest, RemoteProgressFile, SyncConfig, SyncSummary } from '@/types'
import { getDeviceInfo } from './device'
import { getBookBundle, syncRemoteBook } from './library'
import { listBooks, listProgress, mergeProgress, getCover, putCover } from './db'
import { WebdavClient, WebdavError } from './webdav'

const BASE_DIR = 'yejian'
const BOOKS_DIR = 'yejian/books'
const COVERS_DIR = 'yejian/covers'
const PROGRESS_FILE = 'yejian/progress.json'
const MANIFEST_FILE = 'yejian/books.json'

export interface SyncCallbacks {
  onStage?: (stage: string) => void
}

function remoteFileName(meta: RemoteBookMeta): string {
  const ext = meta.fileName.split('.').pop()?.toLowerCase() || meta.format
  return `${meta.id}.${ext}`
}

function coverFileName(bookId: string): string {
  return `${bookId}.cover`
}

/** 封面统一按无类型字节流上传，下载时用文件头还原 MIME。 */
function sniffImageType(bytes: Uint8Array): string {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png'
  }
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length > 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif'
  if (
    bytes.length > 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  return 'image/jpeg'
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
    await client.ensureCollection(COVERS_DIR)

    callbacks.onStage?.('读取云端记录')
    const [manifestText, progressText] = await Promise.all([
      client.getText(MANIFEST_FILE),
      client.getText(PROGRESS_FILE),
    ])
    const remoteManifest = parseManifest(manifestText)
    const remoteProgress = parseProgress(progressText)
    const remoteCoverIds = new Set(remoteManifest?.covers || [])

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
    let pendingRemoteBooks = 0

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

      /* ---------- 封面（单独存储，随书籍一起同步） ---------- */
      callbacks.onStage?.('同步书籍封面')
      const booksAfterDownload = await listBooks()

      for (const book of booksAfterDownload) {
        if (!book.meta.cover) continue
        if (await getCover(book.id)) continue
        // 旧版清单没有 covers 字段，逐个尝试；新版没有记录则说明云端确实没有。
        if (remoteManifest?.covers && !remoteCoverIds.has(book.id)) continue
        const raw = await client.getBlob(`${COVERS_DIR}/${coverFileName(book.id)}`).catch(() => null)
        if (!raw) continue
        const bytes = new Uint8Array(await raw.arrayBuffer())
        if (!bytes.length) continue
        await putCover(book.id, new Blob([bytes], { type: sniffImageType(bytes) }))
      }

      for (const book of booksAfterDownload) {
        if (!book.meta.cover || remoteCoverIds.has(book.id)) continue
        const cover = await getCover(book.id)
        if (!cover) continue
        await client.put(`${COVERS_DIR}/${coverFileName(book.id)}`, cover)
        remoteCoverIds.add(book.id)
      }
    } else {
      // 关闭书籍同步时仍要提示云端还有多少本书没落到本地，避免误以为已经同步完成
      pendingRemoteBooks = Array.from(mergedBooks.keys()).filter((id) => !localBookIds.has(id)).length
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
      covers: Array.from(remoteCoverIds),
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
    if (pendingRemoteBooks) parts.push(`云端还有 ${pendingRemoteBooks} 本未下载（请开启「同步书籍文件」）`)
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
