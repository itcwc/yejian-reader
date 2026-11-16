<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '@/components/Icon.vue'
import BookCover from '@/components/BookCover.vue'
import Modal from '@/components/Modal.vue'
import FormatMatrix from '@/components/FormatMatrix.vue'
import { useLibraryStore } from '@/stores/library'
import { useToastStore } from '@/stores/toast'
import { ACCEPT_ATTR, formatLabel, getFormatInfo } from '@/core/formats'
import { formatBytes, formatDate, formatDateTime } from '@/utils/text'
import type { Book, ImportReport } from '@/types'

const router = useRouter()
const library = useLibraryStore()
const toast = useToastStore()

type StatusFilter = 'all' | 'reading' | 'unread' | 'finished'

const search = ref('')
const statusFilter = ref<StatusFilter>('all')
const formatFilter = ref('all')
const viewMode = ref<'grid' | 'list'>(
  (localStorage.getItem('yejian.view') as 'grid' | 'list') || 'grid',
)
const searchInput = ref<HTMLInputElement>()
const fileInput = ref<HTMLInputElement>()

const dragging = ref(false)
const importReport = ref<ImportReport | null>(null)
const reportOpen = ref(false)
const guideOpen = ref(false)
const detailsBook = ref<Book | null>(null)
const pendingDelete = ref<Book | null>(null)

let dragDepth = 0

watch(viewMode, (value) => {
  try {
    localStorage.setItem('yejian.view', value)
  } catch {
    /* 忽略存储失败 */
  }
})

const statusCounts = computed(() => ({
  all: library.stats.total,
  reading: library.stats.reading,
  unread: library.stats.unread,
  finished: library.stats.finished,
}))

const availableFormats = computed(() => {
  const map = new Map<string, string>()
  library.books.forEach((book) => map.set(book.format, formatLabel(book.format)))
  return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
})

const filteredBooks = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return library.sortedBooks.filter((book) => {
    if (statusFilter.value !== 'all') {
      const status =
        book.percent >= 99 ? 'finished' : book.percent > 0 ? 'reading' : 'unread'
      if (status !== statusFilter.value) return false
    }
    if (formatFilter.value !== 'all' && book.format !== formatFilter.value) return false
    if (!keyword) return true
    return (
      book.title.toLowerCase().includes(keyword) ||
      book.author.toLowerCase().includes(keyword) ||
      book.fileName.toLowerCase().includes(keyword)
    )
  })
})

const isFiltered = computed(
  () => statusFilter.value !== 'all' || formatFilter.value !== 'all' || Boolean(search.value.trim()),
)

const heroBook = computed(() => (isFiltered.value ? null : library.continueBook))
const heroPercent = computed(() => Math.round(heroBook.value?.percent || 0))

const reportSummary = computed(() => {
  const report = importReport.value
  if (!report) return ''
  const parts: string[] = []
  if (report.added.length) parts.push(`新增 ${report.added.length} 本`)
  if (report.duplicates) parts.push(`重复 ${report.duplicates} 个`)
  if (report.unsupported.length) parts.push(`待转换 ${report.unsupported.length} 个`)
  if (report.failed.length) parts.push(`失败 ${report.failed.length} 个`)
  return parts.join(' · ')
})

function statusOf(book: Book): StatusFilter {
  if (book.percent >= 99) return 'finished'
  if (book.percent > 0) return 'reading'
  return 'unread'
}

function relativeTime(timestamp: number): string {
  if (!timestamp) return ''
  const diff = Date.now() - timestamp
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 2 * day) return '昨天'
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`
  return formatDate(timestamp)
}

function openBook(book: Book) {
  detailsBook.value = null
  router.push({ name: 'reader', params: { id: book.id } })
}

function triggerImport() {
  fileInput.value?.click()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (files.length) void handleImport(files)
}

async function handleImport(files: File[]) {
  if (!files.length) return
  const report = await library.importBooks(files)
  importReport.value = report
  if (report.added.length) {
    toast.push(`已加入书架：${report.added.length} 本`, 'success')
  }
  if (report.duplicates || report.unsupported.length || report.failed.length) {
    reportOpen.value = true
  } else if (!report.added.length) {
    toast.push('没有可导入的书', 'error')
  }
}

function clearFilters() {
  search.value = ''
  statusFilter.value = 'all'
  formatFilter.value = 'all'
}

function onDragEnter(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return
  dragDepth += 1
  dragging.value = true
}

function onDragOver(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return
  event.preventDefault()
}

function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) dragging.value = false
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  dragDepth = 0
  dragging.value = false
  const files = Array.from(event.dataTransfer?.files || [])
  if (files.length) void handleImport(files)
}

function onKeydown(event: KeyboardEvent) {
  const tag = (document.activeElement?.tagName || '').toLowerCase()
  if (event.key === '/' && tag !== 'input' && tag !== 'textarea') {
    event.preventDefault()
    searchInput.value?.focus()
  }
}

async function confirmDelete() {
  const book = pendingDelete.value
  if (!book) return
  try {
    await library.remove(book.id)
    if (detailsBook.value?.id === book.id) detailsBook.value = null
    toast.push(`已移除《${book.title}》`, 'success')
  } catch {
    toast.push('删除失败，请重试', 'error')
  } finally {
    pendingDelete.value = null
  }
}

onMounted(() => {
  window.addEventListener('dragenter', onDragEnter)
  window.addEventListener('dragover', onDragOver)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('drop', onDrop)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('dragenter', onDragEnter)
  window.removeEventListener('dragover', onDragOver)
  window.removeEventListener('dragleave', onDragLeave)
  window.removeEventListener('drop', onDrop)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="library">
    <span class="watermark" aria-hidden="true">書</span>

    <input
      ref="fileInput"
      class="visually-hidden"
      type="file"
      multiple
      :accept="ACCEPT_ATTR"
      @change="onFileChange"
    />

    <header class="lib-head">
      <div class="head-copy">
        <p class="eyebrow">
          LIBRARY · {{ library.stats.total }} VOLUMES
          <span class="eyebrow-line" aria-hidden="true"></span>
          {{ library.stats.reading }} 在读
        </p>
        <h1 class="display head-title">我的书架<span class="title-dot">。</span></h1>
        <p class="head-lede">
          把书放进这里，读到哪里都能接着读。支持 EPUB、PDF、纯文本与漫画，
          通过 WebDAV 在手机、平板和桌面之间同步进度。
        </p>
      </div>

      <div class="head-actions">
        <label class="search">
          <Icon name="search" :size="17" />
          <input
            ref="searchInput"
            v-model="search"
            type="search"
            placeholder="搜索书名、作者或文件名"
            aria-label="搜索书架"
          />
          <button v-if="search" class="search-clear" type="button" aria-label="清除搜索" @click="search = ''">
            <Icon name="x" :size="14" />
          </button>
          <kbd v-else>/</kbd>
        </label>

        <button class="btn btn-primary import-btn" type="button" @click="triggerImport">
          <Icon name="plus" :size="17" />
          导入书籍
        </button>
      </div>
    </header>

    <section v-if="heroBook" class="hero" @click="openBook(heroBook)">
      <span class="hero-ghost" aria-hidden="true">續</span>
      <div class="hero-cover">
        <BookCover
          :book="heroBook"
          :url="library.covers[heroBook.id] || null"
          variant="hero"
        />
      </div>
      <div class="hero-text">
        <p class="eyebrow">继续阅读 · {{ relativeTime(heroBook.lastOpenedAt) }}</p>
        <h2 class="display hero-title">{{ heroBook.title }}</h2>
        <p class="hero-author">
          {{ heroBook.author || '未知作者' }}
          <span class="dot-sep">·</span>
          {{ formatLabel(heroBook.format) }}
        </p>
        <div class="hero-progress">
          <div class="progress-track">
            <span :style="{ width: `${heroProgress}%` }"></span>
          </div>
          <span class="hero-pct">{{ heroProgress }}%</span>
        </div>
      </div>
      <button class="hero-cta" type="button" aria-label="继续阅读">
        <Icon name="arrow-right" :size="22" />
      </button>
    </section>

    <div class="toolbar">
      <div class="filters">
        <button
          v-for="item in [
            { key: 'all', label: '全部' },
            { key: 'reading', label: '在读' },
            { key: 'unread', label: '未读' },
            { key: 'finished', label: '已读完' },
          ]"
          :key="item.key"
          type="button"
          class="chip"
          :class="{ 'is-active': statusFilter === item.key }"
          @click="statusFilter = item.key as StatusFilter"
        >
          {{ item.label }}
          <span class="chip-count">{{ statusCounts[item.key as StatusFilter] }}</span>
        </button>

        <span class="toolbar-sep" aria-hidden="true"></span>

        <select v-model="formatFilter" class="mini-select" aria-label="按格式筛选">
          <option value="all">全部格式</option>
          <option v-for="[value, label] in availableFormats" :key="value" :value="value">
            {{ label }}
          </option>
        </select>

        <select v-model="library.sortMode" class="mini-select" aria-label="排序方式">
          <option value="recent">最近阅读</option>
          <option value="added">最近加入</option>
          <option value="title">书名排序</option>
        </select>
      </div>

      <div class="view-toggle">
        <button
          type="button"
          class="view-btn"
          :class="{ 'is-active': viewMode === 'grid' }"
          aria-label="网格视图"
          @click="viewMode = 'grid'"
        >
          <Icon name="grid" :size="17" />
        </button>
        <button
          type="button"
          class="view-btn"
          :class="{ 'is-active': viewMode === 'list' }"
          aria-label="列表视图"
          @click="viewMode = 'list'"
        >
          <Icon name="list" :size="17" />
        </button>
      </div>
    </div>

    <div v-if="library.loading && !library.loaded" class="skeleton-grid">
      <div v-for="i in 8" :key="i" class="skeleton-card">
        <div class="skeleton-cover"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
      </div>
    </div>

    <template v-else-if="filteredBooks.length">
      <div v-if="viewMode === 'grid'" class="book-grid">
        <article
          v-for="(book, index) in filteredBooks"
          :key="book.id"
          class="book-card"
          :style="{ '--i': Math.min(index, 14) }"
          @click="openBook(book)"
        >
          <div class="card-cover">
            <BookCover :book="book" :url="library.covers[book.id] || null" />
          </div>
          <button
            class="card-more"
            type="button"
            aria-label="查看详情"
            @click.stop="detailsBook = book"
          >
            <Icon name="more" :size="16" />
          </button>
          <div class="card-meta">
            <h3 class="card-title">{{ book.title }}</h3>
            <p class="card-author">{{ book.author || '未知作者' }}</p>
            <div class="card-foot">
              <span class="card-format">{{ formatLabel(book.format) }}</span>
              <span class="card-percent">{{ Math.round(book.percent) }}%</span>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="book-list">
        <article
          v-for="(book, index) in filteredBooks"
          :key="book.id"
          class="book-row"
          :style="{ '--i': Math.min(index, 14) }"
          @click="openBook(book)"
        >
          <BookCover :book="book" :url="library.covers[book.id] || null" variant="mini" />
          <div class="row-main">
            <h3 class="row-title">{{ book.title }}</h3>
            <p class="row-meta">
              {{ book.author || '未知作者' }}
              <span class="dot-sep">·</span>
              {{ formatLabel(book.format) }}
              <span class="dot-sep">·</span>
              {{ formatBytes(book.size) }}
            </p>
            <div class="row-progress">
              <span :style="{ width: `${book.percent}%` }"></span>
            </div>
          </div>
          <span class="row-status" :class="`status-${statusOf(book)}`">
            {{ statusOf(book) === 'finished' ? '已读完' : statusOf(book) === 'reading' ? `${Math.round(book.percent)}%` : '未读' }}
          </span>
          <button
            class="icon-btn row-more"
            type="button"
            aria-label="查看详情"
            @click.stop="detailsBook = book"
          >
            <Icon name="more" :size="16" />
          </button>
        </article>
      </div>
    </template>

    <div v-else-if="!library.loading && !library.books.length" class="empty-state">
      <div class="empty-illustration" aria-hidden="true">
        <span class="empty-book back"></span>
        <span class="empty-book mid"></span>
        <span class="empty-book front"><Icon name="book-open" :size="34" /></span>
      </div>
      <h2 class="display empty-title">书架还是空的<span class="title-dot">。</span></h2>
      <p class="empty-copy">
        把 EPUB、PDF、TXT 或漫画文件拖进窗口，或点击导入。所有书籍与进度都保存在本机。
      </p>
      <div class="empty-actions">
        <button class="btn btn-primary" type="button" @click="triggerImport">
          <Icon name="plus" :size="16" />
          选择文件导入
        </button>
        <button class="btn btn-ghost" type="button" @click="guideOpen = true">
          查看支持格式
        </button>
      </div>
    </div>

    <div v-else class="empty-state">
      <h2 class="display empty-title">没有符合条件的书</h2>
      <p class="empty-copy">换个关键词，或清除筛选看看整个书架。</p>
      <button class="btn btn-ghost" type="button" @click="clearFilters">清除筛选</button>
    </div>

    <footer class="lib-foot">
      <span>页间 · 本地优先</span>
      <span class="dot-sep">·</span>
      <span>{{ formatBytes(library.totalBytes) }} 已占用</span>
      <button class="foot-link" type="button" @click="guideOpen = true">格式支持</button>
    </footer>

    <!-- 拖拽导入 -->
    <Transition name="drop">
      <div v-if="dragging" class="drop-overlay">
        <div class="drop-panel">
          <Icon name="download" :size="34" />
          <h2 class="display">松手，把书放上书架</h2>
          <p>支持 EPUB、PDF、TXT、MD、DOCX、CBZ、FB2 等格式</p>
        </div>
      </div>
    </Transition>

    <!-- 导入进度 -->
    <Transition name="toast">
      <div v-if="library.importing" class="import-progress">
        <div class="import-progress-head">
          <span class="spinner"></span>
          <span>正在导入 {{ library.importDone }} / {{ library.importTotal }}</span>
        </div>
        <div class="import-bar">
          <span :style="{ width: `${(library.importDone / Math.max(1, library.importTotal)) * 100}%` }"></span>
        </div>
      </div>
    </Transition>

    <!-- 导入报告 -->
    <Modal v-model:open="reportOpen" title="导入结果" subtitle="IMPORT REPORT" width="560px">
      <p class="report-summary">{{ reportSummary }}</p>

      <div v-if="importReport?.unsupported.length" class="report-section">
        <h3 class="report-title">
          <Icon name="alert" :size="15" />
          需要先转换的格式
        </h3>
        <ul class="issue-list">
          <li v-for="issue in importReport.unsupported" :key="issue.name" class="issue">
            <div class="issue-head">
              <span class="issue-name">{{ issue.name }}</span>
              <span class="badge">{{ issue.format }}</span>
            </div>
            <p class="issue-reason">{{ issue.reason }}</p>
          </li>
        </ul>
        <p class="report-note">
          转换完成后重新导入即可。页间坚持本地解析，不上传你的文件。
        </p>
      </div>

      <div v-if="importReport?.failed.length" class="report-section">
        <h3 class="report-title">
          <Icon name="alert" :size="15" />
          导入失败
        </h3>
        <ul class="issue-list">
          <li v-for="issue in importReport.failed" :key="issue.name" class="issue">
            <div class="issue-head">
              <span class="issue-name">{{ issue.name }}</span>
            </div>
            <p class="issue-reason">{{ issue.reason }}</p>
          </li>
        </ul>
      </div>

      <p v-if="importReport?.duplicates" class="duplicate-note">
        {{ importReport.duplicates }} 个文件已在书架中，已自动跳过。
      </p>

      <template #footer>
        <button class="btn btn-ghost" type="button" @click="reportOpen = false; guideOpen = true">
          查看支持格式
        </button>
        <button class="btn btn-primary" type="button" @click="reportOpen = false">完成</button>
      </template>
    </Modal>

    <!-- 格式支持 -->
    <Modal v-model:open="guideOpen" title="格式支持" subtitle="FORMAT SUPPORT" width="720px">
      <p class="guide-intro">
        页间在本地解析主流阅读格式。部分私有或版式格式需要先用桌面工具转换，
        点击下方「需转换」可获得具体做法。
      </p>
      <FormatMatrix />
      <template #footer>
        <button class="btn btn-primary" type="button" @click="guideOpen = false">知道了</button>
      </template>
    </Modal>

    <!-- 书籍详情 -->
    <Modal
      :open="Boolean(detailsBook)"
      title="书籍详情"
      subtitle="VOLUME"
      width="600px"
      @close="detailsBook = null"
    >
      <div v-if="detailsBook" class="detail">
        <div class="detail-top">
          <BookCover
            :book="detailsBook"
            :url="library.covers[detailsBook.id] || null"
            variant="detail"
            :show-progress="false"
          />
          <div class="detail-copy">
            <h2 class="display detail-title">{{ detailsBook.title }}</h2>
            <p class="detail-author">{{ detailsBook.author || '未知作者' }}</p>
            <div class="detail-tags">
              <span class="badge">{{ formatLabel(detailsBook.format) }}</span>
              <span v-if="detailsBook.percent >= 99" class="badge badge-done">已读完</span>
              <span v-else-if="detailsBook.percent > 0" class="badge badge-reading">
                读至 {{ Math.round(detailsBook.percent) }}%
              </span>
              <span v-else class="badge">未开始</span>
            </div>
            <p class="detail-desc">{{ detailsBook.meta.description || '这本书还没有简介。' }}</p>
          </div>
        </div>

        <dl class="detail-grid">
          <div>
            <dt>文件大小</dt>
            <dd>{{ formatBytes(detailsBook.size) }}</dd>
          </div>
          <div v-if="detailsBook.meta.pageCount">
            <dt>页数</dt>
            <dd>{{ detailsBook.meta.pageCount }} 页</dd>
          </div>
          <div v-if="detailsBook.meta.chapterCount">
            <dt>章节</dt>
            <dd>{{ detailsBook.meta.chapterCount }} 章</dd>
          </div>
          <div v-if="detailsBook.meta.publisher">
            <dt>出版社</dt>
            <dd>{{ detailsBook.meta.publisher }}</dd>
          </div>
          <div>
            <dt>加入时间</dt>
            <dd>{{ formatDate(detailsBook.addedAt) }}</dd>
          </div>
          <div>
            <dt>最近阅读</dt>
            <dd>{{ detailsBook.lastOpenedAt ? formatDateTime(detailsBook.lastOpenedAt) : '尚未阅读' }}</dd>
          </div>
          <div class="detail-grid-wide">
            <dt>文件名</dt>
            <dd class="file-name">{{ detailsBook.fileName }}</dd>
          </div>
        </dl>

        <div class="detail-progress">
          <div class="progress-track">
            <span :style="{ width: `${detailsBook.percent}%` }"></span>
          </div>
          <span>{{ Math.round(detailsBook.percent) }}%</span>
        </div>
      </div>

      <template #footer>
        <button
          v-if="detailsBook"
          class="btn btn-danger"
          type="button"
          @click="pendingDelete = detailsBook; detailsBook = null"
        >
          <Icon name="trash" :size="15" />
          移除
        </button>
        <span class="foot-spacer"></span>
        <button class="btn btn-ghost" type="button" @click="detailsBook = null">关闭</button>
        <button v-if="detailsBook" class="btn btn-primary" type="button" @click="openBook(detailsBook)">
          {{ detailsBook.percent > 0 ? '继续阅读' : '开始阅读' }}
          <Icon name="arrow-right" :size="15" />
        </button>
      </template>
    </Modal>

    <!-- 删除确认 -->
    <Modal
      :open="Boolean(pendingDelete)"
      title="移除这本书？"
      subtitle="REMOVE"
      width="420px"
      @close="pendingDelete = null"
    >
      <p class="confirm-copy">
        将从本机书架删除《{{ pendingDelete?.title }}》及其阅读进度，此操作无法撤销。
        云端副本（如已同步）不会被删除。
      </p>
      <template #footer>
        <button class="btn btn-ghost" type="button" @click="pendingDelete = null">取消</button>
        <button class="btn btn-primary confirm-delete" type="button" @click="confirmDelete">
          确认移除
        </button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.library {
  position: relative;
  height: 100%;
  overflow-y: auto;
  scrollbar-gutter: stable;
  padding: clamp(30px, 5vh, 64px) var(--page-pad) 40px;
  background:
    radial-gradient(1100px 540px at 88% -8%, color-mix(in srgb, var(--accent) 11%, transparent), transparent 62%),
    radial-gradient(820px 480px at -12% 18%, color-mix(in srgb, var(--accent) 6%, transparent), transparent 58%);
}

.watermark {
  position: absolute;
  top: 24px;
  right: 4vw;
  font-family: var(--font-serif);
  font-size: clamp(180px, 26vw, 360px);
  line-height: 1;
  color: var(--ink);
  opacity: 0.035;
  pointer-events: none;
  user-select: none;
}

.lib-head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 32px;
  max-width: var(--content-max);
  margin: 0 auto;
}

.head-copy {
  min-width: 0;
}

.eyebrow {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.eyebrow-line {
  width: 28px;
  height: 1px;
  background: var(--line-strong);
}

.head-title {
  font-size: clamp(38px, 5.4vw, 62px);
  font-weight: 500;
  line-height: 1.08;
  letter-spacing: 0.015em;
}

.title-dot {
  color: var(--accent);
}

.head-lede {
  max-width: 540px;
  margin-top: 14px;
  color: var(--ink-muted);
  font-size: 13.5px;
  line-height: 1.85;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 0 0 auto;
  padding-bottom: 6px;
}

.search {
  display: flex;
  align-items: center;
  gap: 9px;
  width: clamp(190px, 20vw, 268px);
  height: 42px;
  padding: 0 13px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink-muted);
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}

.search:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
  background: var(--surface-raised);
}

.search input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  outline: none;
  font-size: 13px;
  color: var(--ink);
}

.search input::placeholder {
  color: var(--ink-faint);
}

.search input::-webkit-search-cancel-button {
  display: none;
}

.search kbd {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--line);
  color: var(--ink-faint);
  background: var(--surface-soft);
}

.search-clear {
  display: inline-flex;
  color: var(--ink-faint);
}

.search-clear:hover {
  color: var(--ink);
}

.import-btn {
  height: 42px;
}

.hero {
  position: relative;
  z-index: 1;
  max-width: var(--content-max);
  margin: clamp(28px, 4vw, 46px) auto 0;
  display: flex;
  align-items: center;
  gap: clamp(20px, 3vw, 36px);
  padding: clamp(20px, 2.6vw, 30px) clamp(20px, 3vw, 38px);
  border-radius: var(--radius-lg);
  border: 1px solid var(--accent-line);
  background:
    linear-gradient(120deg, var(--surface) 0%, var(--accent-soft) 100%);
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.3s var(--ease-out), box-shadow 0.3s var(--ease-out);
  animation: fade-up 0.5s var(--ease-out) both;
}

.hero:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
}

.hero-ghost {
  position: absolute;
  right: 64px;
  top: 50%;
  transform: translateY(-50%);
  font-family: var(--font-serif);
  font-size: clamp(120px, 15vw, 200px);
  line-height: 1;
  color: var(--accent);
  opacity: 0.06;
  pointer-events: none;
}

.hero-cover {
  flex: 0 0 auto;
  transform: rotate(-2.5deg);
  transition: transform 0.4s var(--ease-out);
}

.hero:hover .hero-cover {
  transform: rotate(0deg) translateY(-2px);
}

.hero-text {
  flex: 1;
  min-width: 0;
}

.hero-title {
  margin-top: 8px;
  font-size: clamp(24px, 2.6vw, 34px);
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hero-author {
  margin-top: 6px;
  color: var(--ink-muted);
  font-size: 12.5px;
}

.dot-sep {
  margin: 0 6px;
  color: var(--ink-faint);
}

.hero-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  max-width: 420px;
}

.progress-track {
  flex: 1;
  height: 3px;
  border-radius: 99px;
  background: color-mix(in srgb, var(--ink) 10%, transparent);
  overflow: hidden;
}

.progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 0.4s var(--ease-out);
}

.hero-pct {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-muted);
  letter-spacing: 0.04em;
}

.hero-cta {
  flex: 0 0 auto;
  width: 58px;
  height: 58px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--accent);
  color: var(--accent-ink);
  box-shadow: var(--shadow-sm);
  transition: transform 0.3s var(--ease-out), background 0.2s;
}

.hero:hover .hero-cta {
  transform: translateX(4px);
  background: var(--accent-strong);
}

.toolbar {
  position: sticky;
  top: 0;
  z-index: 6;
  max-width: var(--content-max);
  margin: clamp(22px, 3vw, 34px) auto 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
  background: color-mix(in srgb, var(--bg) 84%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.filters {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.chip-count {
  font-family: var(--font-mono);
  font-size: 9.5px;
  opacity: 0.68;
  margin-left: 2px;
}

.toolbar-sep {
  width: 1px;
  height: 18px;
  background: var(--line);
  margin: 0 4px;
}

.mini-select {
  height: 31px;
  padding: 0 26px 0 11px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line);
  background-color: transparent;
  color: var(--ink-muted);
  font-size: 12.5px;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--ink-muted) 50%),
    linear-gradient(135deg, var(--ink-muted) 50%, transparent 50%);
  background-position: calc(100% - 14px) 52%, calc(100% - 9px) 52%;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  transition: border-color 0.2s, color 0.2s;
}

.mini-select:hover {
  border-color: var(--line-strong);
  color: var(--ink);
}

.view-toggle {
  display: flex;
  padding: 3px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line);
  background: var(--surface);
}

.view-btn {
  display: grid;
  place-items: center;
  width: 34px;
  height: 28px;
  border-radius: var(--radius-pill);
  color: var(--ink-faint);
  transition: all 0.2s;
}

.view-btn:hover {
  color: var(--ink);
}

.view-btn.is-active {
  background: var(--accent-soft);
  color: var(--accent);
}

.book-grid {
  max-width: var(--content-max);
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: clamp(24px, 3vw, 40px) clamp(16px, 2.2vw, 28px);
}

.book-card {
  position: relative;
  min-width: 0;
  cursor: pointer;
  animation: fade-up 0.45s var(--ease-out) both;
  animation-delay: calc(var(--i) * 26ms);
}

.card-cover {
  transition: transform 0.34s var(--ease-out), filter 0.3s;
}

.book-card:hover .card-cover {
  transform: translateY(-6px);
}

.book-card:hover .card-cover :deep(.cover) {
  box-shadow: var(--shadow-md);
}

.card-more {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 4;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  color: var(--ink-soft);
  opacity: 0;
  transform: translateY(-3px);
  backdrop-filter: blur(8px);
  transition: opacity 0.2s, transform 0.2s, background 0.2s;
}

.book-card:hover .card-more,
.book-card:focus-within .card-more {
  opacity: 1;
  transform: translateY(0);
}

.card-more:hover {
  background: var(--surface-raised);
  color: var(--ink);
}

.card-meta {
  padding-top: 12px;
}

.card-title {
  font-family: var(--font-serif);
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.45;
  letter-spacing: 0.01em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  transition: color 0.2s;
}

.book-card:hover .card-title {
  color: var(--accent);
}

.card-author {
  margin-top: 4px;
  font-size: 11.5px;
  color: var(--ink-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 7px;
}

.card-format {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  color: var(--ink-faint);
}

.card-percent {
  font-family: var(--font-mono);
  font-size: 9.5px;
  color: var(--ink-muted);
}

.book-list {
  max-width: var(--content-max);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--line);
}

.book-row {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 15px 10px;
  border-bottom: 1px solid var(--line);
  cursor: pointer;
  transition: background 0.2s, padding 0.25s var(--ease-out);
  animation: fade-up 0.4s var(--ease-out) both;
  animation-delay: calc(var(--i) * 20ms);
}

.book-row:hover {
  background: var(--surface-hover);
  padding-left: 16px;
}

.row-main {
  flex: 1;
  min-width: 0;
}

.row-title {
  font-family: var(--font-serif);
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-meta {
  margin-top: 3px;
  font-size: 11.5px;
  color: var(--ink-muted);
}

.row-progress {
  margin-top: 8px;
  height: 2px;
  max-width: 320px;
  background: var(--line);
  border-radius: 99px;
  overflow: hidden;
}

.row-progress span {
  display: block;
  height: 100%;
  background: var(--accent);
}

.row-status {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--ink-faint);
  min-width: 46px;
  text-align: right;
}

.status-reading {
  color: var(--accent);
}

.status-finished {
  color: var(--ink-muted);
}

.row-more {
  opacity: 0;
}

.book-row:hover .row-more {
  opacity: 1;
}

.skeleton-grid {
  max-width: var(--content-max);
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 28px 24px;
}

.skeleton-cover {
  aspect-ratio: 2 / 3;
  border-radius: 6px;
  background: linear-gradient(110deg, var(--surface-soft) 30%, var(--surface) 50%, var(--surface-soft) 70%);
  background-size: 220% 100%;
  animation: shimmer 1.6s linear infinite;
}

.skeleton-line {
  height: 11px;
  margin-top: 12px;
  border-radius: 4px;
  background: var(--surface-soft);
}

.skeleton-line.short {
  width: 58%;
  margin-top: 8px;
}

@keyframes shimmer {
  to {
    background-position: -220% 0;
  }
}

.empty-state {
  max-width: 520px;
  margin: clamp(48px, 9vh, 110px) auto;
  text-align: center;
  animation: fade-up 0.5s var(--ease-out) both;
}

.empty-illustration {
  position: relative;
  width: 150px;
  height: 112px;
  margin: 0 auto 28px;
}

.empty-book {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 104px;
  height: 76px;
  border-radius: 5px 10px 10px 5px;
  border: 1px solid var(--accent-line);
  background: var(--surface-raised);
  box-shadow: var(--shadow-sm);
}

.empty-book.back {
  transform: translateX(-64%) rotate(-9deg);
  background: var(--accent-soft);
}

.empty-book.mid {
  transform: translateX(-44%) rotate(4deg);
  background: var(--surface);
}

.empty-book.front {
  display: grid;
  place-items: center;
  color: var(--accent);
  transform: translateX(-52%) translateY(-8px);
}

.empty-title {
  font-size: clamp(28px, 3.4vw, 38px);
  font-weight: 500;
}

.empty-copy {
  margin: 14px auto 26px;
  max-width: 400px;
  color: var(--ink-muted);
  font-size: 13.5px;
  line-height: 1.85;
}

.empty-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}

.lib-foot {
  max-width: var(--content-max);
  margin: 60px auto 10px;
  padding-top: 20px;
  border-top: 1px solid var(--line);
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--ink-faint);
}

.foot-link {
  margin-left: auto;
  color: var(--ink-muted);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.foot-link:hover {
  color: var(--accent);
}

.drop-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--bg) 62%, transparent);
  backdrop-filter: blur(10px);
}

.drop-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 52px 72px;
  border-radius: var(--radius-xl);
  border: 1.5px dashed var(--accent);
  background: var(--surface);
  color: var(--accent);
  box-shadow: var(--shadow-lg);
  text-align: center;
}

.drop-panel h2 {
  font-size: 26px;
  font-weight: 500;
  color: var(--ink);
}

.drop-panel p {
  font-size: 12.5px;
  color: var(--ink-muted);
}

.drop-enter-active,
.drop-leave-active {
  transition: opacity 0.2s;
}

.drop-enter-from,
.drop-leave-to {
  opacity: 0;
}

.import-progress {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: var(--z-overlay);
  width: 260px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-md);
}

.import-progress-head {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  color: var(--ink-soft);
}

.import-bar {
  margin-top: 10px;
  height: 3px;
  border-radius: 99px;
  background: var(--line);
  overflow: hidden;
}

.import-bar span {
  display: block;
  height: 100%;
  background: var(--accent);
  transition: width 0.3s var(--ease-out);
}

.report-summary {
  font-family: var(--font-mono);
  font-size: 11.5px;
  letter-spacing: 0.04em;
  color: var(--ink-muted);
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 18px;
}

.report-section + .report-section {
  margin-top: 22px;
}

.report-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-soft);
  margin-bottom: 10px;
}

.issue-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
  max-height: 300px;
  overflow-y: auto;
  padding-right: 4px;
}

.issue {
  padding: 11px 13px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
  background: var(--surface-raised);
}

.issue-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.issue-name {
  font-size: 12.5px;
  font-weight: 500;
  word-break: break-all;
}

.issue-reason {
  margin-top: 5px;
  font-size: 11.5px;
  line-height: 1.65;
  color: var(--ink-muted);
}

.report-note {
  margin-top: 12px;
  font-size: 11.5px;
  color: var(--ink-faint);
  line-height: 1.7;
}

.duplicate-note {
  margin-top: 18px;
  font-size: 12px;
  color: var(--ink-muted);
}

.guide-intro {
  font-size: 12.5px;
  line-height: 1.85;
  color: var(--ink-muted);
  margin-bottom: 20px;
}

.detail-top {
  display: flex;
  gap: 22px;
}

.detail-copy {
  flex: 1;
  min-width: 0;
}

.detail-title {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.35;
}

.detail-author {
  margin-top: 6px;
  color: var(--ink-muted);
  font-size: 12.5px;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.badge-reading {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: var(--accent-line);
}

.badge-done {
  color: var(--ink-muted);
}

.detail-desc {
  margin-top: 14px;
  font-size: 12.5px;
  line-height: 1.8;
  color: var(--ink-muted);
  display: -webkit-box;
  -webkit-line-clamp: 5;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px 20px;
  margin: 24px 0 20px;
  padding: 18px;
  border-radius: var(--radius-md);
  background: var(--surface-soft);
  border: 1px solid var(--line);
}

.detail-grid dt {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-faint);
  margin-bottom: 5px;
}

.detail-grid dd {
  font-size: 12.5px;
  color: var(--ink-soft);
  word-break: break-word;
}

.detail-grid-wide {
  grid-column: 1 / -1;
}

.file-name {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-muted);
}

.detail-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--ink-muted);
}

.detail-progress .progress-track {
  height: 3px;
}

.foot-spacer {
  flex: 1;
}

.confirm-copy {
  font-size: 13.5px;
  line-height: 1.85;
  color: var(--ink-soft);
}

.confirm-delete {
  background: var(--danger);
  color: #fff9f4;
}

.confirm-delete:hover {
  background: color-mix(in srgb, var(--danger) 86%, #000);
}

@media (max-width: 1180px) {
  .head-actions {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .search {
    width: 100%;
  }
}

@media (max-width: 860px) {
  .library {
    padding: 26px 18px calc(max(12px, env(safe-area-inset-bottom)) + 96px);
  }

  .lib-head {
    flex-direction: column;
    align-items: stretch;
    gap: 22px;
  }

  .head-title {
    font-size: clamp(34px, 10vw, 46px);
  }

  .head-actions {
    flex-direction: row;
    align-items: center;
  }

  .search {
    flex: 1;
    width: auto;
  }

  .hero {
    flex-wrap: wrap;
    gap: 16px;
    padding: 20px;
  }

  .hero-ghost {
    display: none;
  }

  .hero-cta {
    width: 46px;
    height: 46px;
  }

  .hero-title {
    white-space: normal;
  }

  .toolbar {
    flex-wrap: wrap;
  }

  .filters {
    width: 100%;
  }

  .view-toggle {
    margin-left: auto;
  }

  .book-grid {
    grid-template-columns: repeat(auto-fill, minmax(124px, 1fr));
    gap: 22px 14px;
  }

  .card-more {
    opacity: 1;
    top: 4px;
    right: 4px;
    width: 26px;
    height: 26px;
  }

  .row-more {
    opacity: 1;
  }

  .lib-foot {
    flex-wrap: wrap;
    margin-top: 40px;
  }

  .import-progress {
    left: 18px;
    right: 18px;
    bottom: calc(max(12px, env(safe-area-inset-bottom)) + 76px);
    width: auto;
  }

  .drop-panel {
    padding: 40px 28px;
    margin: 18px;
  }

  .detail-top {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .detail-tags {
    justify-content: center;
  }

  .detail-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .watermark {
    font-size: 220px;
    opacity: 0.025;
  }
}
</style>
