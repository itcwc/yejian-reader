import type { PDFDocumentProxy } from 'pdfjs-dist'

type PdfjsModule = typeof import('pdfjs-dist')

let pdfjsPromise: Promise<PdfjsModule> | null = null

export function getPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist')
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      return pdfjs
    })()
  }
  return pdfjsPromise
}

/** pdf.js 会把 ArrayBuffer 转移给 worker，必须传入副本 */
export async function loadPdfDocument(buffer: ArrayBuffer): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjs()
  const data = new Uint8Array(buffer.slice(0))
  return pdfjs.getDocument({ data }).promise
}

export interface PdfMeta {
  title?: string
  author?: string
  pageCount: number
  cover?: Blob
}

export async function readPdfMetadata(buffer: ArrayBuffer): Promise<PdfMeta> {
  const doc = await loadPdfDocument(buffer)
  try {
    let title = ''
    let author = ''
    try {
      const info = (await doc.getMetadata()).info as Record<string, unknown>
      title = typeof info.Title === 'string' ? info.Title.trim() : ''
      author = typeof info.Author === 'string' ? info.Author.trim() : ''
    } catch {
      /* 元数据缺失 */
    }

    let cover: Blob | undefined
    try {
      cover = await renderPdfPageCover(doc, 1)
    } catch {
      /* 封面渲染失败不影响导入 */
    }

    return { title: title || undefined, author: author || undefined, pageCount: doc.numPages, cover }
  } finally {
    await doc.destroy().catch(() => undefined)
  }
}

export async function renderPdfPageCover(doc: PDFDocumentProxy, pageNumber: number): Promise<Blob | undefined> {
  const page = await doc.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(2, 480 / base.width)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const context = canvas.getContext('2d')
  if (!context) return undefined
  await page.render({ canvasContext: context, viewport }).promise
  return new Promise<Blob | undefined>((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? undefined), 'image/jpeg', 0.84)
  })
}

export interface PdfOutlineItem {
  title: string
  page: number
  children: PdfOutlineItem[]
}

/** 提取 PDF 书签目录（页码从 1 开始） */
export async function readPdfOutline(doc: PDFDocumentProxy): Promise<PdfOutlineItem[]> {
  const outline = await doc.getOutline().catch(() => null)
  if (!outline) return []

  const resolvePage = async (dest: unknown): Promise<number> => {
    try {
      let target = dest as string | unknown[] | null
      if (typeof target === 'string') target = await doc.getDestination(target)
      if (!Array.isArray(target) || !target.length) return 1
      const index = await doc.getPageIndex(target[0] as never)
      return index + 1
    } catch {
      return 1
    }
  }

  const walk = async (items: any[], level: number): Promise<PdfOutlineItem[]> => {
    const result: PdfOutlineItem[] = []
    for (const item of items) {
      const page = await resolvePage(item.dest)
      const children = item.items?.length ? await walk(item.items, level + 1) : []
      result.push({ title: String(item.title || '未命名'), page, children })
    }
    return result
  }

  return walk(outline, 0)
}
