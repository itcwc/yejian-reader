export type FormatId =
  | 'epub'
  | 'pdf'
  | 'mobi'
  | 'azw'
  | 'azw3'
  | 'fb2'
  | 'txt'
  | 'md'
  | 'rtf'
  | 'html'
  | 'xhtml'
  | 'xml'
  | 'mhtml'
  | 'cbz'
  | 'cbr'
  | 'cbt'
  | 'cb7'
  | 'doc'
  | 'docx'
  | 'ppt'
  | 'pptx'
  | 'xps'
  | 'oxps'
  | 'djvu'
  | 'ofd'
  | 'caj'
  | 'chm'

export type FormatGroup = '电子书' | '纯文本' | '网页' | '漫画' | '文档' | '学术'

export type SupportLevel = 'native' | 'convert'

export interface FormatInfo {
  id: FormatId
  label: string
  group: FormatGroup
  level: SupportLevel
  hint?: string
}

export interface BookExtra {
  publisher?: string
  language?: string
  description?: string
  pageCount?: number
  chapterCount?: number
  wordCount?: number
  cover?: boolean
}

export interface Book {
  id: string
  title: string
  author: string
  format: FormatId
  fileName: string
  size: number
  mime: string
  addedAt: number
  updatedAt: number
  lastOpenedAt: number
  percent: number
  meta: BookExtra
}

export interface ProgressDetail {
  page?: number
  totalPages?: number
  chapter?: string
}

export interface ReadingProgress {
  bookId: string
  percent: number
  locator: string | null
  detail?: ProgressDetail
  updatedAt: number
  device?: string
}

export interface TocItem {
  label: string
  locator: string
  level: number
}

export interface ReaderProgress {
  percent: number
  locator: string
  detail?: ProgressDetail
}

export interface ImportIssue {
  name: string
  format: string | null
  reason: string
}

export interface ImportReport {
  added: Book[]
  duplicates: number
  unsupported: ImportIssue[]
  failed: ImportIssue[]
}

export type ThemeId = 'paper' | 'night' | 'green'
export type FontKind = 'serif' | 'sans'
export type ReadingMode = 'paged' | 'scroll'

export interface Preferences {
  theme: ThemeId
  readerTheme: ThemeId
  readingMode: ReadingMode
  fontSize: number
  lineHeight: number
  fontKind: FontKind
  contentWidth: number
  pdfInvert: boolean
  comicSpread: boolean
}

export interface SyncConfig {
  url: string
  username: string
  password: string
  autoSync: boolean
  syncBooks: boolean
}

export interface SyncSummary {
  at: number
  ok: boolean
  message: string
  progressPulled: number
  progressPushed: number
  booksDownloaded: number
  booksUploaded: number
  bytes: number
}

export interface RemoteBookMeta {
  id: string
  title: string
  author: string
  format: FormatId
  size: number
  fileName: string
  addedAt: number
  updatedAt: number
  meta: BookExtra
}

export interface RemoteManifest {
  version: 1
  updatedAt: number
  books: RemoteBookMeta[]
  /** 已上传封面的书籍 id，旧版本清单没有该字段 */
  covers?: string[]
}

export interface RemoteProgressFile {
  version: 1
  updatedAt: number
  items: Record<string, Omit<ReadingProgress, 'bookId'>>
}

export interface DeviceInfo {
  name: string
  platform: 'web' | 'pc' | 'android'
}
