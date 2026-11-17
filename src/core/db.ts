import type { Book, ReadingProgress } from '@/types'

const DB_NAME = 'yejian'
const DB_VERSION = 1

export const STORE = {
  books: 'books',
  files: 'files',
  covers: 'covers',
  progress: 'progress',
} as const

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE.books)) {
        db.createObjectStore(STORE.books, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE.files)) {
        db.createObjectStore(STORE.files)
      }
      if (!db.objectStoreNames.contains(STORE.covers)) {
        db.createObjectStore(STORE.covers)
      }
      if (!db.objectStoreNames.contains(STORE.progress)) {
        db.createObjectStore(STORE.progress, { keyPath: 'bookId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return dbPromise
}

function wrap<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('本地存储事务已取消'))
  })
}

export async function putBook(book: Book): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE.books, 'readwrite')
  tx.objectStore(STORE.books).put(book)
  await done(tx)
}

export async function putBooks(books: Book[]): Promise<void> {
  if (!books.length) return
  const db = await openDb()
  const tx = db.transaction(STORE.books, 'readwrite')
  const store = tx.objectStore(STORE.books)
  books.forEach((b) => store.put(b))
  await done(tx)
}

export async function getBook(id: string): Promise<Book | undefined> {
  const db = await openDb()
  return wrap(db.transaction(STORE.books).objectStore(STORE.books).get(id))
}

export async function listBooks(): Promise<Book[]> {
  const db = await openDb()
  return wrap(db.transaction(STORE.books).objectStore(STORE.books).getAll())
}

export async function putFile(id: string, blob: Blob): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE.files, 'readwrite')
  tx.objectStore(STORE.files).put(blob, id)
  await done(tx)
}

export async function getFile(id: string): Promise<Blob | undefined> {
  const db = await openDb()
  return wrap(db.transaction(STORE.files).objectStore(STORE.files).get(id))
}

export async function putCover(id: string, blob: Blob): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE.covers, 'readwrite')
  tx.objectStore(STORE.covers).put(blob, id)
  await done(tx)
}

export async function getCover(id: string): Promise<Blob | undefined> {
  const db = await openDb()
  return wrap(db.transaction(STORE.covers).objectStore(STORE.covers).get(id))
}

export async function saveProgress(progress: ReadingProgress): Promise<void> {
  // 阅读器传入的是 Vue 响应式对象，必须转成普通对象后才能结构化克隆
  const payload: ReadingProgress = {
    bookId: String(progress.bookId),
    percent: Number.isFinite(progress.percent) ? progress.percent : 0,
    locator: progress.locator ?? null,
    detail: progress.detail
      ? {
          page: progress.detail.page,
          totalPages: progress.detail.totalPages,
          chapter: progress.detail.chapter,
        }
      : undefined,
    updatedAt: Number.isFinite(progress.updatedAt) ? progress.updatedAt : Date.now(),
    device: progress.device,
  }

  const db = await openDb()
  const tx = db.transaction([STORE.progress, STORE.books], 'readwrite')
  tx.objectStore(STORE.progress).put(payload)
  const bookStore = tx.objectStore(STORE.books)
  const request = bookStore.get(payload.bookId)
  request.onsuccess = () => {
    const book = request.result as Book | undefined
    if (!book) return
    if ((book.percent ?? 0) !== payload.percent) {
      book.percent = payload.percent
    }
    book.lastOpenedAt = Math.max(book.lastOpenedAt || 0, payload.updatedAt)
    bookStore.put(book)
  }
  await done(tx)
}

/** 同步场景：仅当远端进度更新时写入，并保留书架上较新的状态 */
export async function mergeProgress(progress: ReadingProgress): Promise<boolean> {
  const db = await openDb()
  const tx = db.transaction([STORE.progress, STORE.books], 'readwrite')
  const progressStore = tx.objectStore(STORE.progress)
  const bookStore = tx.objectStore(STORE.books)
  let changed = false
  const request = progressStore.get(progress.bookId)
  request.onsuccess = () => {
    const existing = request.result as ReadingProgress | undefined
    if (!existing || existing.updatedAt < progress.updatedAt) {
      progressStore.put(progress)
      changed = true
    }
    const bookRequest = bookStore.get(progress.bookId)
    bookRequest.onsuccess = () => {
      const book = bookRequest.result as Book | undefined
      if (!book) return
      if (book.percent !== progress.percent) {
        book.percent = progress.percent
        book.lastOpenedAt = Math.max(book.lastOpenedAt || 0, progress.updatedAt)
        bookStore.put(book)
      }
    }
  }
  await done(tx)
  return changed
}

export async function getProgress(bookId: string): Promise<ReadingProgress | undefined> {
  const db = await openDb()
  return wrap(db.transaction(STORE.progress).objectStore(STORE.progress).get(bookId))
}

export async function listProgress(): Promise<ReadingProgress[]> {
  const db = await openDb()
  return wrap(db.transaction(STORE.progress).objectStore(STORE.progress).getAll())
}

export async function deleteBook(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction([STORE.books, STORE.files, STORE.covers, STORE.progress], 'readwrite')
  tx.objectStore(STORE.books).delete(id)
  tx.objectStore(STORE.files).delete(id)
  tx.objectStore(STORE.covers).delete(id)
  tx.objectStore(STORE.progress).delete(id)
  await done(tx)
}

export async function hasBook(id: string): Promise<boolean> {
  const db = await openDb()
  const key = await wrap(db.transaction(STORE.books).objectStore(STORE.books).getKey(id))
  return key !== undefined
}

export interface BackupBook {
  book: Book
  file: Blob
  cover?: Blob
  progress?: ReadingProgress
}

export async function readBackupBooks(): Promise<BackupBook[]> {
  const db = await openDb()
  const tx = db.transaction(Object.values(STORE))
  const books = tx.objectStore(STORE.books)
  const files = tx.objectStore(STORE.files)
  const covers = tx.objectStore(STORE.covers)
  const progress = tx.objectStore(STORE.progress)
  const [, entries] = await Promise.all([
    done(tx),
    wrap<Book[]>(books.getAll()).then((all) => Promise.all(all.map(async (book) => {
      const [file, cover, record] = await Promise.all([
        wrap<Blob | undefined>(files.get(book.id)),
        wrap<Blob | undefined>(covers.get(book.id)),
        wrap<ReadingProgress | undefined>(progress.get(book.id)),
      ])
      if (!file) throw new Error(`找不到《${book.title}》的书籍文件`)
      return { book, file, cover, progress: record }
    }))),
  ])
  return entries
}

export async function restoreBackupBooks(entries: BackupBook[]) {
  const db = await openDb()
  const tx = db.transaction(Object.values(STORE), 'readwrite')
  const books = tx.objectStore(STORE.books)
  const files = tx.objectStore(STORE.files)
  const covers = tx.objectStore(STORE.covers)
  const progress = tx.objectStore(STORE.progress)
  const result = { added: 0, progressUpdated: 0 }
  await Promise.all([
    done(tx),
    Promise.all(entries.map(async (entry) => {
      const id = entry.book.id
      const [local, localFile, localCover, current] = await Promise.all([
        wrap<Book | undefined>(books.get(id)),
        wrap<IDBValidKey | undefined>(files.getKey(id)),
        wrap<IDBValidKey | undefined>(covers.getKey(id)),
        wrap<ReadingProgress | undefined>(progress.get(id)),
      ])
      if (!localFile) files.put(entry.file, id)
      if (!localCover && entry.cover) covers.put(entry.cover, id)
      const incoming = entry.progress
      const newer = incoming && (!current || incoming.updatedAt > current.updatedAt)
      if (newer) {
        progress.put(incoming)
        result.progressUpdated += 1
      }
      if (!local) result.added += 1
      const chosen = newer ? incoming : current
      const book = local ?? entry.book
      books.put({
        ...book,
        percent: chosen?.percent ?? book.percent,
        lastOpenedAt: Math.max(book.lastOpenedAt, chosen?.updatedAt ?? 0),
        meta: { ...book.meta, cover: Boolean(book.meta.cover || localCover || entry.cover) },
      })
    })).catch((error) => {
      try { tx.abort() } catch { /* transaction already ended */ }
      throw error
    }),
  ])
  return result
}
