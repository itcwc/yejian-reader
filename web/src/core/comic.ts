import type { Book, FormatId } from '@/types'
import { extractTar } from './metadata'

export interface ComicPage {
  name: string
  url: string
}

function naturalSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

function isImageName(name: string): boolean {
  return /\.(jpe?g|png|webp|gif|avif|bmp)$/i.test(name) && !name.startsWith('__MACOSX')
}

function mimeOf(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    avif: 'image/avif',
    bmp: 'image/bmp',
  }
  return map[ext] || 'image/jpeg'
}

/** 解包 CBZ / CBT，返回按名称自然排序的图片 Blob 列表 */
export async function extractComicPages(buffer: ArrayBuffer, format: FormatId): Promise<Blob[]> {
  const pages: { name: string; blob: Blob }[] = []

  if (format === 'cbz') {
    const { default: JSZip } = await import('jszip')
    const zip = await JSZip.loadAsync(buffer)
    const names = Object.keys(zip.files)
      .filter((name) => !zip.files[name].dir && isImageName(name))
      .sort(naturalSort)
    for (const name of names) {
      const data = await zip.files[name].async('arraybuffer')
      pages.push({ name, blob: new Blob([data], { type: mimeOf(name) }) })
    }
  } else if (format === 'cbt') {
    const entries = extractTar(buffer)
      .filter((entry) => isImageName(entry.name))
      .sort((a, b) => naturalSort(a.name, b.name))
    for (const entry of entries) {
      pages.push({ name: entry.name, blob: new Blob([entry.data], { type: mimeOf(entry.name) }) })
    }
  }

  return pages.map((page) => page.blob)
}

export function revokeComicPages(urls: string[]): void {
  urls.forEach((url) => URL.revokeObjectURL(url))
}

export function bookToComicLabel(book: Book): string {
  return `${book.title}`
}
