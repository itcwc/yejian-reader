import type { Book } from '@/types'
import { getCover } from './db'

const coverUrls = new Map<string, string>()

/** 封面 Blob 转为可复用的 object URL */
export async function getCoverUrl(book: Book): Promise<string | null> {
  if (!book.meta.cover) return null
  const cached = coverUrls.get(book.id)
  if (cached) return cached
  const blob = await getCover(book.id)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  coverUrls.set(book.id, url)
  return url
}

export function revokeCoverUrl(bookId: string): void {
  const url = coverUrls.get(bookId)
  if (url) {
    URL.revokeObjectURL(url)
    coverUrls.delete(bookId)
  }
}
