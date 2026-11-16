import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import type { Book, ImportReport } from '@/types'
import { listBooks } from '@/core/db'
import { getCoverUrl } from '@/core/covers'
import { importFiles as importFilesToShelf, removeBook as removeBookFromShelf } from '@/core/library'

const FINISHED_THRESHOLD = 99

export const useLibraryStore = defineStore('library', () => {
  const books = ref<Book[]>([])
  const covers = reactive<Record<string, string>>({})
  const loading = ref(false)
  const loaded = ref(false)
  const sortMode = ref<'recent' | 'added' | 'title'>('recent')

  const importing = ref(false)
  const importDone = ref(0)
  const importTotal = ref(0)

  const sortedBooks = computed(() => {
    const list = [...books.value]
    if (sortMode.value === 'title') {
      return list.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'))
    }
    if (sortMode.value === 'added') {
      return list.sort((a, b) => b.addedAt - a.addedAt)
    }
    return list.sort((a, b) => Math.max(b.lastOpenedAt, b.addedAt) - Math.max(a.lastOpenedAt, a.addedAt))
  })

  const stats = computed(() => {
    let reading = 0
    let finished = 0
    let unread = 0
    for (const book of books.value) {
      if (book.percent >= FINISHED_THRESHOLD) finished += 1
      else if (book.percent > 0) reading += 1
      else unread += 1
    }
    return { total: books.value.length, reading, finished, unread }
  })

  const continueBook = computed<Book | null>(() => {
    const candidates = books.value.filter(
      (book) => book.lastOpenedAt > 0 && book.percent > 0 && book.percent < FINISHED_THRESHOLD,
    )
    if (!candidates.length) return null
    return candidates.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)[0]
  })

  const totalBytes = computed(() => books.value.reduce((sum, book) => sum + book.size, 0))

  async function ensureCovers() {
    const pending = books.value.filter((book) => book.meta.cover && !covers[book.id])
    await Promise.all(
      pending.map(async (book) => {
        const url = await getCoverUrl(book).catch(() => null)
        if (url) covers[book.id] = url
      }),
    )
  }

  async function refresh() {
    loading.value = true
    try {
      books.value = await listBooks()
      loaded.value = true
      await ensureCovers()
    } finally {
      loading.value = false
    }
  }

  async function importBooks(files: File[]): Promise<ImportReport> {
    importing.value = true
    importDone.value = 0
    importTotal.value = files.length
    try {
      const report = await importFilesToShelf(files, (done, total) => {
        importDone.value = done
        importTotal.value = total
      })
      await refresh()
      return report
    } finally {
      importing.value = false
    }
  }

  async function remove(id: string) {
    await removeBookFromShelf(id)
    books.value = books.value.filter((book) => book.id !== id)
    delete covers[id]
  }

  function applyProgress(bookId: string, percent: number, at: number) {
    const book = books.value.find((item) => item.id === bookId)
    if (!book) return
    book.percent = percent
    book.lastOpenedAt = Math.max(book.lastOpenedAt, at)
  }

  function findBook(id: string): Book | undefined {
    return books.value.find((book) => book.id === id)
  }

  return {
    books,
    covers,
    loading,
    loaded,
    sortMode,
    importing,
    importDone,
    importTotal,
    sortedBooks,
    stats,
    continueBook,
    totalBytes,
    refresh,
    importBooks,
    remove,
    applyProgress,
    findBook,
    ensureCovers,
  }
})
