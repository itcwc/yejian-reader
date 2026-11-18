<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '@/components/Icon.vue'
import BookCover from '@/components/BookCover.vue'
import EpubReader from '@/readers/EpubReader.vue'
import PdfReader from '@/readers/PdfReader.vue'
import FlowReader from '@/readers/FlowReader.vue'
import ComicReader from '@/readers/ComicReader.vue'
import HtmlReader from '@/readers/HtmlReader.vue'
import { getBookBundle } from '@/core/library'
import { getProgress, saveProgress } from '@/core/db'
import { buildFlowContent, buildHtmlContent } from '@/core/content'
import { formatLabel } from '@/core/formats'
import { THEME_META } from '@/core/preferences'
import { useLibraryStore } from '@/stores/library'
import { usePreferencesStore } from '@/stores/preferences'
import { useSyncStore } from '@/stores/sync'
import type { Book, ReadingProgress, ReaderProgress, ThemeId, TocItem } from '@/types'

const props = defineProps<{ id: string }>()

const router = useRouter()
const library = useLibraryStore()
const preferences = usePreferencesStore()
const sync = useSyncStore()

type EngineType = 'epub' | 'pdf' | 'flow' | 'html' | 'comic' | 'none'

const book = ref<Book | null>(null)
const initialProgress = ref<ReadingProgress | null>(null)
const buffer = ref<ArrayBuffer | null>(null)
const flowHtml = ref('')
const htmlDoc = ref('')
const chapters = ref<TocItem[]>([])
const engineType = ref<EngineType>('none')
const preparing = ref(true)
const engineReady = ref(false)
const loadError = ref('')
const tocOpen = ref(false)
const settingsOpen = ref(false)
const barsVisible = ref(false)
const showTapGuide = ref(false)
const current = ref<ReaderProgress>({ percent: 0, locator: '', detail: {} })
const sliderValue = ref(0)
const dragging = ref(false)
const engine = ref<any>(null)

let hasProgress = false
let saveTimer = 0
let guideTimer = 0
let guideChecked = false

const showLoader = computed(
  () => preparing.value || (!engineReady.value && !loadError.value && engineType.value !== 'none'),
)

const pageLabel = computed(() => {
  const detail = current.value.detail
  if (detail?.totalPages) return `${detail.page || 1} / ${detail.totalPages}`
  return `${Math.round(current.value.percent)}%`
})

const clockText = ref('')
const batteryPercent = ref<number | null>(null)
const showBattery = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
let clockTimer = 0

function updateClock() {
  const now = new Date()
  clockText.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}

function bindBattery() {
  const nav = navigator as Navigator & {
    getBattery?: () => Promise<{ level: number; addEventListener: (type: string, cb: () => void) => void }>
  }
  nav
    .getBattery?.()
    .then((battery) => {
      const sync = () => {
        batteryPercent.value = Math.round(battery.level * 100)
      }
      sync()
      battery.addEventListener('levelchange', sync)
    })
    .catch(() => {
      /* 不支持电量 API 时只显示时间 */
    })
}

const themeOptions = (Object.keys(THEME_META) as ThemeId[]).map((id) => ({
  id,
  ...THEME_META[id],
}))

const supportFontSettings = computed(
  () => engineType.value === 'flow' || engineType.value === 'html' || engineType.value === 'epub',
)

const supportWidthSetting = computed(
  () => engineType.value === 'flow' || engineType.value === 'html' || engineType.value === 'epub',
)

// 预览块按版心宽度设置缩放文字栏宽度，让调节效果可见
const previewWidth = computed(() => {
  const ratio = Math.max(0, Math.min(1, (preferences.prefs.contentWidth - 560) / 420))
  return `${Math.round(56 + ratio * 44)}%`
})

const supportReadingMode = computed(
  () => engineType.value === 'flow' || engineType.value === 'epub' || engineType.value === 'pdf' || engineType.value === 'comic',
)

// html 阅读器只有滚动；其余引擎跟随阅读方式设置
const verticalTapZones = computed(
  () =>
    engineType.value === 'html' ||
    (supportReadingMode.value && preferences.prefs.readingMode === 'scroll'),
)

const hasToc = computed(() => chapters.value.length > 0)

const currentChapter = computed(() => current.value.detail?.chapter || '')

function toggleBars() {
  barsVisible.value = !barsVisible.value
}

function maybeShowTapGuide() {
  if (guideChecked) return
  guideChecked = true
  if (!preferences.prefs.tapGuide) return
  showTapGuide.value = true
  guideTimer = window.setTimeout(() => dismissTapGuide(), 4600)
}

function dismissTapGuide() {
  if (!showTapGuide.value) return
  showTapGuide.value = false
  if (guideTimer) window.clearTimeout(guideTimer)
}

function closePanels() {
  tocOpen.value = false
  settingsOpen.value = false
  barsVisible.value = true
}

function toggleToc() {
  if (!hasToc.value) return
  tocOpen.value = !tocOpen.value
  if (tocOpen.value) {
    settingsOpen.value = false
    barsVisible.value = true
  }
}

function toggleSettings() {
  settingsOpen.value = !settingsOpen.value
  if (settingsOpen.value) {
    tocOpen.value = false
    barsVisible.value = true
  }
}

async function loadBook() {
  preparing.value = true
  loadError.value = ''
  engineReady.value = false
  try {
    const bundle = await getBookBundle(props.id)
    if (!bundle) throw new Error('这本书不在本地书架中，可能已被移除。')
    book.value = bundle.book
    buffer.value = bundle.buffer
    initialProgress.value = (await getProgress(props.id)) || null
    current.value = {
      percent: initialProgress.value?.percent || 0,
      locator: initialProgress.value?.locator || '',
      detail: initialProgress.value?.detail || {},
    }
    sliderValue.value = current.value.percent
    chapters.value = []
    document.title = `${bundle.book.title} · 页间`

    const format = bundle.book.format
    if (format === 'epub') {
      engineType.value = 'epub'
    } else if (format === 'pdf') {
      engineType.value = 'pdf'
    } else if (format === 'cbz' || format === 'cbt') {
      engineType.value = 'comic'
    } else if (format === 'html' || format === 'xhtml' || format === 'mhtml') {
      engineType.value = 'html'
      htmlDoc.value = buildHtmlContent(bundle.book, bundle.buffer)
    } else {
      const content = await buildFlowContent(bundle.book, bundle.buffer)
      flowHtml.value = content.html
      chapters.value = content.chapters
      engineType.value = 'flow'
    }
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '无法打开这本书'
  } finally {
    preparing.value = false
  }
}

function onReady() {
  engineReady.value = true
  maybeShowTapGuide()
}

function onError(message: string) {
  loadError.value = message
  preparing.value = false
}

function onToc(items: TocItem[]) {
  chapters.value = items
}

function onProgress(progress: ReaderProgress) {
  hasProgress = true
  current.value = progress
  if (!dragging.value) sliderValue.value = progress.percent
  library.applyProgress(props.id, progress.percent, Date.now())
  scheduleSave()
}

function scheduleSave() {
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    void flushProgress()
  }, 800)
}

async function flushProgress() {
  if (!book.value || !hasProgress) return
  const payload: ReadingProgress = {
    bookId: book.value.id,
    percent: current.value.percent,
    locator: current.value.locator || null,
    detail: current.value.detail,
    updatedAt: Date.now(),
    device: sync.device.name,
  }
  try {
    await saveProgress(payload)
  } catch {
    return
  }
  sync.scheduleAutoSync(9000)
}

function next() {
  engine.value?.next?.()
}

function prev() {
  engine.value?.prev?.()
}

function onSliderInput() {
  dragging.value = true
}

function onSliderChange() {
  dragging.value = false
  engine.value?.goToPercent?.(sliderValue.value)
}

function jumpTo(item: TocItem) {
  engine.value?.goTo?.(item.locator)
  tocOpen.value = false
}

function switchTheme(theme: ThemeId) {
  preferences.setReaderTheme(theme)
}

async function exit() {
  await flushProgress()
  router.push('/')
}

function onKeydown(event: KeyboardEvent) {
  const tag = (event.target as HTMLElement | null)?.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') {
    if (event.key === 'Escape') (event.target as HTMLElement).blur()
    return
  }

  if (showTapGuide.value) {
    dismissTapGuide()
    return
  }

  if (event.key === 'Escape') {
    if (tocOpen.value || settingsOpen.value) closePanels()
    return
  }

  if (tocOpen.value || settingsOpen.value) return

  if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ' || event.key === 'ArrowDown') {
    event.preventDefault()
    next()
  } else if (event.key === 'ArrowLeft' || event.key === 'PageUp' || event.key === 'ArrowUp') {
    event.preventDefault()
    prev()
  } else if (event.key === 't' || event.key === 'T') {
    toggleToc()
  } else if (event.key === 's' || event.key === 'S') {
    toggleSettings()
  }
}

function onPageHide() {
  void flushProgress()
}

onMounted(async () => {
  await loadBook()
  updateClock()
  if (showBattery) bindBattery()
  clockTimer = window.setInterval(updateClock, 15000)
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('pagehide', onPageHide)
})

onBeforeUnmount(() => {
  if (saveTimer) window.clearTimeout(saveTimer)
  if (guideTimer) window.clearTimeout(guideTimer)
  if (clockTimer) window.clearInterval(clockTimer)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('pagehide', onPageHide)
  document.title = '页间 · 跨设备阅读'
  void flushProgress()
})
</script>

<template>
  <div class="reader" :class="`engine-${engineType}`" :data-theme="preferences.prefs.readerTheme">
    <div class="reader-surface">
      <EpubReader
        v-if="engineType === 'epub' && buffer"
        ref="engine"
        :buffer="buffer"
        :initial="initialProgress"
        :settings="preferences.prefs"
        @progress="onProgress"
        @toc="onToc"
        @ready="onReady"
        @error="onError"
        @toggle-bars="toggleBars"
      />
      <PdfReader
        v-else-if="engineType === 'pdf' && buffer"
        ref="engine"
        :buffer="buffer"
        :initial="initialProgress"
        :settings="preferences.prefs"
        @progress="onProgress"
        @toc="onToc"
        @ready="onReady"
        @error="onError"
        @toggle-bars="toggleBars"
      />
      <ComicReader
        v-else-if="engineType === 'comic' && buffer && book"
        ref="engine"
        :buffer="buffer"
        :format="book.format"
        :initial="initialProgress"
        :settings="preferences.prefs"
        @progress="onProgress"
        @ready="onReady"
        @error="onError"
        @toggle-bars="toggleBars"
      />
      <FlowReader
        v-else-if="engineType === 'flow' && book"
        ref="engine"
        :html="flowHtml"
        :chapters="chapters"
        :initial="initialProgress"
        :settings="preferences.prefs"
        :format="book.format"
        @progress="onProgress"
        @ready="onReady"
        @toggle-bars="toggleBars"
      />
      <HtmlReader
        v-else-if="engineType === 'html' && book"
        ref="engine"
        :html="htmlDoc"
        :initial="initialProgress"
        :settings="preferences.prefs"
        @progress="onProgress"
        @toc="onToc"
        @ready="onReady"
        @error="onError"
        @toggle-bars="toggleBars"
      />

      <Transition name="fade">
        <div v-if="showLoader" class="reader-state">
          <div v-if="book" class="loading-cover">
            <BookCover :book="book" :url="null" variant="mini" :show-progress="false" />
          </div>
          <div v-else class="loading-mark">页</div>
          <p class="loading-eyebrow">OPENING</p>
          <h2 class="loading-title">{{ book ? `正在展开《${book.title}》` : '正在取出这本书' }}</h2>
          <div class="loading-bar"><span></span></div>
          <p class="loading-hint">首次打开会解析排版，稍等片刻</p>
        </div>
      </Transition>

      <div v-if="loadError && !showLoader" class="reader-state reader-error">
        <Icon name="alert" :size="30" />
        <h2 class="loading-title">打不开这本书</h2>
        <p class="error-copy">{{ loadError }}</p>
        <button class="btn btn-primary" type="button" @click="exit">返回书架</button>
      </div>
    </div>

    <Transition name="fade">
      <div
        v-if="showTapGuide"
        class="tap-guide"
        :class="{ 'is-scroll': verticalTapZones }"
        @click="dismissTapGuide"
      >
        <div class="tap-guide-half is-prev">
          <span>{{ verticalTapZones ? '上一屏' : '上一页' }}</span>
        </div>
        <div class="tap-guide-half is-next">
          <span>{{ verticalTapZones ? '下一屏' : '下一页' }}</span>
        </div>
        <div class="tap-guide-center">
          <span class="tap-guide-title">轻点中间</span>
          <span class="tap-guide-sub">显示 / 隐藏菜单</span>
        </div>
        <p class="tap-guide-tip">
          {{ verticalTapZones ? '上下点击滚动' : '左右点击翻页' }} · 轻点任意位置关闭提示
        </p>
      </div>
    </Transition>

    <Transition name="bar-top">
      <header v-show="barsVisible" class="reader-top">
        <div class="top-inner">
          <button class="icon-btn top-back" type="button" aria-label="返回书架" @click="exit">
            <Icon name="back" :size="19" />
          </button>

          <div class="top-title">
            <span class="top-book">{{ book?.title || '未命名' }}</span>
            <span class="top-chapter">
              {{ currentChapter || (book ? formatLabel(book.format) : '') }}
            </span>
          </div>

          <div class="top-actions">
            <button
              class="icon-btn"
              type="button"
              :disabled="!hasToc"
              :title="hasToc ? '目录 (T)' : '本书没有目录'"
              aria-label="目录"
              @click="toggleToc"
            >
              <Icon name="toc" :size="19" />
            </button>
            <button class="icon-btn" type="button" title="阅读设置 (S)" aria-label="阅读设置" @click="toggleSettings">
              <Icon name="type" :size="19" />
            </button>
          </div>
        </div>
      </header>
    </Transition>

    <Transition name="bar-bottom">
      <footer v-show="barsVisible" class="reader-bottom">
        <button class="icon-btn" type="button" aria-label="上一页" @click="prev">
          <Icon name="left" :size="18" />
        </button>

        <input
          v-model.number="sliderValue"
          class="progress-range"
          type="range"
          min="0"
          max="100"
          step="0.1"
          :style="{ '--fill': `${sliderValue}%` }"
          aria-label="阅读进度"
          @input="onSliderInput"
          @change="onSliderChange"
        />

        <span class="page-label">{{ pageLabel }}</span>

        <button class="icon-btn" type="button" aria-label="下一页" @click="next">
          <Icon name="right" :size="18" />
        </button>
      </footer>
    </Transition>

    <div class="reader-statusbar" :class="{ 'is-raised': barsVisible }" aria-hidden="true">
      <span class="status-time">{{ clockText }}</span>
      <span v-if="showBattery && batteryPercent !== null" class="status-battery">
        <span class="battery-shell">
          <span class="battery-fill" :style="{ width: `${batteryPercent}%` }"></span>
        </span>
        <span>{{ batteryPercent }}%</span>
      </span>
    </div>

    <Transition name="fade">
      <div v-if="tocOpen || settingsOpen" class="reader-scrim" @click="closePanels"></div>
    </Transition>

    <Transition name="drawer">
      <aside v-if="tocOpen" class="toc-drawer">
        <header class="toc-head">
          <p class="eyebrow">CONTENTS · {{ chapters.length }}</p>
          <h2 class="toc-book-title">{{ book?.title }}</h2>
          <button class="icon-btn toc-close" type="button" aria-label="关闭目录" @click="tocOpen = false">
            <Icon name="x" :size="17" />
          </button>
        </header>

        <nav class="toc-list">
          <button
            v-for="item in chapters"
            :key="`${item.locator}-${item.label}`"
            class="toc-item"
            :class="{ 'is-current': item.label === currentChapter }"
            :style="{ paddingLeft: `${18 + (item.level - 1) * 14}px` }"
            type="button"
            @click="jumpTo(item)"
          >
            <span class="toc-level" aria-hidden="true"></span>
            <span class="toc-label">{{ item.label }}</span>
          </button>
        </nav>

        <footer class="toc-foot">
          <span>{{ Math.round(current.percent) }}% 已读</span>
          <span class="dot-sep">·</span>
          <span>{{ pageLabel }}</span>
        </footer>
      </aside>
    </Transition>

    <Transition name="sheet">
      <section v-if="settingsOpen" class="settings-sheet">
        <header class="sheet-head">
          <div>
            <p class="eyebrow">READING</p>
            <h2 class="sheet-title">阅读设置</h2>
          </div>
          <button class="icon-btn" type="button" aria-label="关闭设置" @click="settingsOpen = false">
            <Icon name="x" :size="18" />
          </button>
        </header>

        <div class="sheet-body">
          <div class="setting-block">
            <span class="setting-label">阅读主题</span>
            <div class="theme-grid">
              <button
                v-for="theme in themeOptions"
                :key="theme.id"
                class="theme-option"
                :class="{ 'is-active': preferences.prefs.readerTheme === theme.id }"
                type="button"
                @click="switchTheme(theme.id)"
              >
                <span class="theme-swatch" :style="{ background: theme.swatch }">
                  <Icon
                    :name="theme.id === 'night' ? 'moon' : theme.id === 'green' ? 'leaf' : 'sun'"
                    :size="14"
                  />
                </span>
                <span class="theme-name">{{ theme.label }}</span>
                <span class="theme-caption">{{ theme.caption }}</span>
              </button>
            </div>
          </div>

          <div v-if="supportReadingMode" class="setting-row">
            <div>
              <span class="setting-label">阅读方式</span>
              <span class="setting-hint">
                {{ preferences.prefs.readingMode === 'scroll' ? '向下滚动，连续阅读' : '左右翻页，逐页阅读' }}
              </span>
            </div>
            <div class="segmented">
              <button
                type="button"
                :class="{ 'is-active': preferences.prefs.readingMode === 'paged' }"
                @click="preferences.prefs.readingMode = 'paged'"
              >
                翻页
              </button>
              <button
                type="button"
                :class="{ 'is-active': preferences.prefs.readingMode === 'scroll' }"
                @click="preferences.prefs.readingMode = 'scroll'"
              >
                滚动
              </button>
            </div>
          </div>

          <div class="setting-row">
            <div>
              <span class="setting-label">点击区域提示</span>
              <span class="setting-hint">每次进入阅读时显示可点击区域</span>
            </div>
            <button
              class="switch"
              :class="{ 'is-on': preferences.prefs.tapGuide }"
              type="button"
              role="switch"
              :aria-checked="preferences.prefs.tapGuide"
              @click="preferences.prefs.tapGuide = !preferences.prefs.tapGuide"
            >
              <span></span>
            </button>
          </div>

          <div v-if="engineType === 'pdf'" class="setting-row">
            <div>
              <span class="setting-label">夜间反色</span>
              <span class="setting-hint">夜读主题下反转 PDF 页面颜色</span>
            </div>
            <button
              class="switch"
              :class="{ 'is-on': preferences.prefs.pdfInvert }"
              type="button"
              role="switch"
              :aria-checked="preferences.prefs.pdfInvert"
              @click="preferences.prefs.pdfInvert = !preferences.prefs.pdfInvert"
            >
              <span></span>
            </button>
          </div>

          <div v-if="engineType === 'comic'" class="setting-row">
            <div>
              <span class="setting-label">翻页方式</span>
              <span class="setting-hint">宽屏时双页并排阅读</span>
            </div>
            <div class="segmented">
              <button
                type="button"
                :class="{ 'is-active': !preferences.prefs.comicSpread }"
                @click="preferences.prefs.comicSpread = false"
              >
                单页
              </button>
              <button
                type="button"
                :class="{ 'is-active': preferences.prefs.comicSpread }"
                @click="preferences.prefs.comicSpread = true"
              >
                双页
              </button>
            </div>
          </div>

          <template v-if="supportFontSettings">
            <div class="setting-preview">
              <p
                class="preview-text"
                :style="{
                  fontFamily: preferences.prefs.fontKind === 'serif' ? 'var(--font-serif)' : 'var(--font-ui)',
                  fontSize: `${preferences.prefs.fontSize}px`,
                  lineHeight: preferences.prefs.lineHeight,
                  maxWidth: previewWidth,
                }"
              >
                行到水穷处，坐看云起时。每一次翻页，都是为了看见更好的自己。
              </p>
              <span class="preview-caption">实时预览</span>
            </div>

            <div class="setting-row">
              <span class="setting-label">字体</span>
              <div class="segmented">
                <button
                  type="button"
                  :class="{ 'is-active': preferences.prefs.fontKind === 'serif' }"
                  @click="preferences.prefs.fontKind = 'serif'"
                >
                  宋体
                </button>
                <button
                  type="button"
                  :class="{ 'is-active': preferences.prefs.fontKind === 'sans' }"
                  @click="preferences.prefs.fontKind = 'sans'"
                >
                  黑体
                </button>
              </div>
            </div>

            <div class="setting-row">
              <span class="setting-label">字号</span>
              <div class="range-control">
                <button class="range-step" type="button" aria-label="减小字号" @click="preferences.prefs.fontSize = Math.max(14, preferences.prefs.fontSize - 1)">
                  A−
                </button>
                <input
                  v-model.number="preferences.prefs.fontSize"
                  type="range"
                  min="14"
                  max="32"
                  step="1"
                />
                <button class="range-step" type="button" aria-label="增大字号" @click="preferences.prefs.fontSize = Math.min(32, preferences.prefs.fontSize + 1)">
                  A+
                </button>
                <span class="range-value">{{ preferences.prefs.fontSize }}</span>
              </div>
            </div>

            <div class="setting-row">
              <span class="setting-label">行距</span>
              <div class="range-control">
                <button
                  class="range-step"
                  type="button"
                  aria-label="减小行距"
                  @click="preferences.prefs.lineHeight = Number(Math.max(1.5, preferences.prefs.lineHeight - 0.05).toFixed(2))"
                >
                  −
                </button>
                <input
                  v-model.number="preferences.prefs.lineHeight"
                  type="range"
                  min="1.5"
                  max="2.6"
                  step="0.05"
                />
                <button
                  class="range-step"
                  type="button"
                  aria-label="增大行距"
                  @click="preferences.prefs.lineHeight = Number(Math.min(2.6, preferences.prefs.lineHeight + 0.05).toFixed(2))"
                >
                  +
                </button>
                <span class="range-value">{{ preferences.prefs.lineHeight.toFixed(2) }}</span>
              </div>
            </div>

            <div v-if="supportWidthSetting" class="setting-row">
              <span class="setting-label">版心宽度</span>
              <div class="range-control">
                <input
                  v-model.number="preferences.prefs.contentWidth"
                  type="range"
                  min="560"
                  max="980"
                  step="20"
                />
                <span class="range-value">{{ preferences.prefs.contentWidth }}</span>
              </div>
            </div>
          </template>
        </div>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
.reader {
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: var(--reader-bg);
  color: var(--reader-ink);
}

.reader-surface {
  position: absolute;
  inset: 0;
  background: var(--reader-bg);
  transition: background 0.3s var(--ease-soft);
}

/* 底部安全区（手势条/导航栏所在区域）始终铺阅读底色，避免露出系统默认黑色 */
.reader::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: env(safe-area-inset-bottom);
  background: var(--reader-bg);
  pointer-events: none;
  z-index: 44;
}

.reader-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  background: color-mix(in srgb, var(--reader-bg) 82%, transparent);
  border-bottom: 1px solid var(--reader-line);
  backdrop-filter: blur(18px) saturate(1.1);
  -webkit-backdrop-filter: blur(18px) saturate(1.1);
}

.top-inner {
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: 1180px;
  margin: 0 auto;
  padding: 10px clamp(12px, 3vw, 26px);
  min-height: 60px;
}

.top-back {
  flex: 0 0 auto;
  color: var(--reader-ink);
}

.top-title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.top-book {
  font-family: var(--font-serif);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.top-chapter {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.08em;
  color: var(--reader-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.top-actions .icon-btn,
.top-back {
  color: var(--reader-ink);
}

.top-actions .icon-btn:hover,
.top-back:hover {
  background: color-mix(in srgb, var(--reader-ink) 8%, transparent);
}

.reader-bottom {
  position: absolute;
  bottom: max(18px, env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 10px;
  width: min(760px, calc(100% - 32px));
  padding: 8px 14px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--reader-bg) 84%, transparent);
  border: 1px solid var(--reader-line);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(18px) saturate(1.1);
  -webkit-backdrop-filter: blur(18px) saturate(1.1);
}

.reader-bottom .icon-btn {
  color: var(--reader-ink);
  flex: 0 0 auto;
}

.reader-bottom .icon-btn:hover {
  background: color-mix(in srgb, var(--reader-ink) 8%, transparent);
}

.reader-statusbar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: max(6px, env(safe-area-inset-bottom));
  z-index: 45;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 clamp(14px, 3vw, 30px);
  font-family: var(--font-mono);
  font-size: 10px;
  color: color-mix(in srgb, var(--reader-ink) 58%, var(--reader-bg));
  pointer-events: none;
  transition: bottom 0.28s var(--ease-out);
}

.reader-statusbar.is-raised {
  bottom: calc(max(10px, env(safe-area-inset-bottom)) + 48px);
}

.status-time {
  letter-spacing: 0.02em;
}

.status-battery {
  display: flex;
  align-items: center;
  gap: 4px;
}

.battery-shell {
  position: relative;
  width: 17px;
  height: 9px;
  border: 1px solid currentColor;
  border-radius: 2px;
}

.battery-shell::after {
  content: '';
  position: absolute;
  top: 50%;
  right: -3px;
  width: 2px;
  height: 4px;
  border-radius: 0 1px 1px 0;
  background: currentColor;
  transform: translateY(-50%);
}

.battery-fill {
  position: absolute;
  top: 1px;
  bottom: 1px;
  left: 1px;
  max-width: calc(100% - 2px);
  border-radius: 1px;
  background: currentColor;
}

.progress-range {
  flex: 1;
  min-width: 0;
  appearance: none;
  -webkit-appearance: none;
  height: 3px;
  border-radius: 99px;
  background: linear-gradient(
    to right,
    var(--reader-accent) 0%,
    var(--reader-accent) var(--fill, 0%),
    var(--reader-line) var(--fill, 0%),
    var(--reader-line) 100%
  );
  outline: none;
  cursor: pointer;
}

.progress-range::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--reader-accent);
  border: 2px solid var(--reader-bg);
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.25);
  transition: transform 0.15s;
}

.progress-range::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.progress-range::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--reader-accent);
  border: 2px solid var(--reader-bg);
}

.page-label {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--reader-muted);
  min-width: 42px;
  text-align: center;
}

.reader-scrim {
  position: absolute;
  inset: 0;
  z-index: 60;
  background: var(--scrim);
  backdrop-filter: blur(2px);
}

.toc-drawer {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 70;
  width: min(360px, 88vw);
  display: flex;
  flex-direction: column;
  background: var(--reader-bg);
  border-right: 1px solid var(--reader-line);
  box-shadow: 20px 0 60px rgba(0, 0, 0, 0.16);
}

.toc-head {
  position: relative;
  padding: 26px 22px 16px;
  border-bottom: 1px solid var(--reader-line);
}

.toc-book-title {
  margin-top: 6px;
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
  padding-right: 34px;
}

.toc-close {
  position: absolute;
  top: 18px;
  right: 14px;
  color: var(--reader-ink);
}

.toc-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px 0 20px;
}

.toc-item {
  display: flex;
  align-items: baseline;
  gap: 9px;
  width: 100%;
  padding: 9px 18px 9px 0;
  text-align: left;
  color: var(--reader-muted);
  font-size: 13px;
  line-height: 1.55;
  border-left: 2px solid transparent;
  transition: color 0.18s, background 0.18s, border-color 0.18s;
}

.toc-item:hover {
  color: var(--reader-ink);
  background: color-mix(in srgb, var(--reader-ink) 5%, transparent);
}

.toc-item.is-current {
  color: var(--reader-accent);
  border-left-color: var(--reader-accent);
  background: color-mix(in srgb, var(--reader-accent) 8%, transparent);
}

.toc-level {
  flex: 0 0 auto;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.5;
}

.toc-label {
  flex: 1;
  word-break: break-word;
}

.toc-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 14px 22px calc(14px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--reader-line);
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.06em;
  color: var(--reader-muted);
}

.settings-sheet {
  position: absolute;
  left: 50%;
  bottom: 0;
  z-index: 70;
  width: min(640px, 100%);
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  transform: translateX(-50%);
  background: var(--surface);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  border: 1px solid var(--line);
  border-bottom: 0;
  box-shadow: 0 -20px 60px rgba(0, 0, 0, 0.2);
}

.sheet-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 24px 12px;
  border-bottom: 1px solid var(--line);
}

.sheet-title {
  font-family: var(--font-serif);
  font-size: 19px;
  font-weight: 600;
  margin-top: 3px;
}

.sheet-body {
  padding: 8px 24px calc(24px + env(safe-area-inset-bottom));
  overflow-y: auto;
}

.setting-block {
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 15px 0;
  border-bottom: 1px solid var(--line);
}

.setting-row:last-child {
  border-bottom: 0;
}

.setting-label {
  display: block;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--ink-soft);
}

.setting-hint {
  display: block;
  margin-top: 3px;
  font-size: 11px;
  color: var(--ink-faint);
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 12px;
}

.theme-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 7px;
  padding: 11px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  background: var(--surface-raised);
  text-align: left;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s var(--ease-out);
}

.theme-option:hover {
  transform: translateY(-2px);
}

.theme-option.is-active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}

.theme-swatch {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--line);
  color: var(--ink-soft);
}

.theme-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--ink);
}

.theme-caption {
  font-size: 10px;
  line-height: 1.4;
  color: var(--ink-faint);
}

.switch {
  flex: 0 0 auto;
  width: 42px;
  height: 24px;
  border-radius: 99px;
  background: var(--line-strong);
  padding: 2px;
  transition: background 0.22s;
}

.switch span {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--surface-raised);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.22s var(--ease-out);
}

.switch.is-on {
  background: var(--accent);
}

.switch.is-on span {
  transform: translateX(18px);
}

.segmented {
  display: flex;
  padding: 3px;
  border-radius: var(--radius-pill);
  background: var(--surface-soft);
  border: 1px solid var(--line);
}

.segmented button {
  padding: 5px 15px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  color: var(--ink-muted);
  transition: all 0.18s;
}

.segmented button.is-active {
  background: var(--accent);
  color: var(--accent-ink);
}

.range-control {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
  min-width: 0;
  max-width: 320px;
}

.range-control input[type="range"] {
  flex: 1 1 56px;
  min-width: 40px;
  appearance: none;
  -webkit-appearance: none;
  height: 3px;
  border-radius: 99px;
  background: var(--line-strong);
  outline: none;
}

.range-control input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--surface);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.range-step {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--ink-muted);
  padding: 4px 6px;
  border-radius: 4px;
  border: 1px solid var(--line);
}

.range-step:hover {
  color: var(--ink);
  border-color: var(--line-strong);
}

.range-value {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--ink-muted);
  min-width: 30px;
  text-align: right;
}

.setting-preview {
  position: relative;
  margin: 14px 0;
  padding: 14px 16px 18px;
  border: 1px solid var(--reader-line);
  border-radius: var(--radius-sm);
  background: var(--reader-bg);
}

.preview-text {
  margin: 0 auto;
  color: var(--reader-ink);
  word-break: break-word;
  transition: max-width 0.2s var(--ease-soft);
}

.preview-caption {
  position: absolute;
  right: 10px;
  bottom: 5px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.08em;
  color: var(--reader-muted);
}

.reader-state {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 30px;
  text-align: center;
  background: var(--reader-bg);
}

.loading-cover {
  width: 58px;
  margin-bottom: 8px;
  transform: rotate(-3deg);
}

.loading-mark {
  display: grid;
  place-items: center;
  width: 56px;
  height: 62px;
  margin-bottom: 8px;
  border-radius: 5px 5px 16px 5px;
  background: var(--reader-accent);
  color: var(--reader-bg);
  font-family: var(--font-serif);
  font-size: 28px;
  transform: rotate(-2deg);
}

.loading-eyebrow {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.22em;
  color: var(--reader-muted);
}

.loading-title {
  font-family: var(--font-serif);
  font-size: 19px;
  font-weight: 500;
  line-height: 1.5;
  color: var(--reader-ink);
  max-width: 460px;
}

.loading-bar {
  width: 160px;
  height: 2px;
  margin-top: 8px;
  border-radius: 99px;
  background: var(--reader-line);
  overflow: hidden;
}

.loading-bar span {
  display: block;
  width: 44%;
  height: 100%;
  background: var(--reader-accent);
  border-radius: inherit;
  animation: indeterminate 1.3s var(--ease-soft) infinite;
}

@keyframes indeterminate {
  0% {
    transform: translateX(-110%);
  }
  100% {
    transform: translateX(260%);
  }
}

.loading-hint {
  font-size: 11px;
  color: var(--reader-muted);
  opacity: 0.8;
}

.reader-error {
  color: var(--danger);
  gap: 12px;
}

.error-copy {
  max-width: 420px;
  font-size: 12.5px;
  line-height: 1.8;
  color: var(--reader-muted);
}

.bar-top-enter-active,
.bar-top-leave-active,
.bar-bottom-enter-active,
.bar-bottom-leave-active {
  transition: opacity 0.26s var(--ease-soft), transform 0.3s var(--ease-out);
}

.bar-top-enter-from,
.bar-top-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}

.bar-bottom-enter-from,
.bar-bottom-leave-to {
  opacity: 0;
  transform: translate(-50%, 120%);
}

.drawer-enter-active,
.drawer-leave-active {
  transition: transform 0.34s var(--ease-out);
}

.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(-100%);
}

.sheet-enter-active,
.sheet-leave-active {
  transition: transform 0.36s var(--ease-out), opacity 0.25s;
}

.sheet-enter-from,
.sheet-leave-to {
  transform: translate(-50%, 100%);
  opacity: 0.6;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.24s var(--ease-soft);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 700px) {
  .top-inner {
    min-height: 54px;
    padding: 8px 10px;
    gap: 6px;
  }

  .top-book {
    font-size: 13px;
  }

  .reader-bottom {
    bottom: max(10px, env(safe-area-inset-bottom));
    width: calc(100% - 20px);
    padding: 7px 10px;
    gap: 6px;
  }

  .reader-statusbar {
    font-size: 9px;
  }

  .battery-shell {
    width: 14px;
    height: 8px;
  }

  .page-label {
    min-width: 38px;
    font-size: 9.5px;
  }

  .theme-grid {
    grid-template-columns: 1fr;
  }

  .theme-option {
    flex-direction: row;
    align-items: center;
    gap: 10px;
  }

  .theme-caption {
    margin-left: auto;
    text-align: right;
  }

  .range-control {
    max-width: 200px;
  }

  .sheet-body {
    padding-left: 18px;
    padding-right: 18px;
  }

  .settings-sheet {
    max-height: 90vh;
  }
}

.tap-guide {
  position: absolute;
  inset: 0;
  z-index: 36;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--reader-bg) 84%, transparent);
  backdrop-filter: blur(1.5px);
  cursor: pointer;
}

.tap-guide-half {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 40%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tap-guide-half span {
  font-family: var(--font-serif);
  font-size: 12px;
  letter-spacing: 0.3em;
  color: var(--reader-muted);
  writing-mode: vertical-rl;
  padding: 14px 0;
  border-top: 1px solid color-mix(in srgb, var(--reader-ink) 22%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--reader-ink) 22%, transparent);
}

.tap-guide-half.is-prev {
  left: 0;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--reader-ink) 5%, transparent),
    transparent
  );
}

.tap-guide-half.is-next {
  right: 0;
  background: linear-gradient(
    270deg,
    color-mix(in srgb, var(--reader-ink) 5%, transparent),
    transparent
  );
}

/* 滚动模式：上下两屏 */
.tap-guide.is-scroll .tap-guide-half {
  left: 0;
  right: 0;
  width: 100%;
  height: 40%;
}

.tap-guide.is-scroll .tap-guide-half.is-prev {
  top: 0;
  bottom: auto;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--reader-ink) 5%, transparent),
    transparent
  );
}

.tap-guide.is-scroll .tap-guide-half.is-next {
  top: auto;
  bottom: 0;
  background: linear-gradient(
    0deg,
    color-mix(in srgb, var(--reader-ink) 5%, transparent),
    transparent
  );
}

.tap-guide.is-scroll .tap-guide-half span {
  writing-mode: horizontal-tb;
  border-top: 0;
  border-bottom: 0;
  padding: 0;
  font-size: 13px;
}

.tap-guide-center {
  position: relative;
  width: clamp(160px, min(42vmin, 360px), 360px);
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px dashed color-mix(in srgb, var(--reader-ink) 34%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, var(--reader-bg) 62%, transparent);
  box-shadow: 0 18px 60px color-mix(in srgb, var(--reader-ink) 10%, transparent);
}

.tap-guide-title {
  font-family: var(--font-serif);
  font-size: 17px;
  letter-spacing: 0.12em;
  color: var(--reader-ink);
}

.tap-guide-sub {
  font-size: 11px;
  letter-spacing: 0.2em;
  color: var(--reader-muted);
}

.tap-guide-tip {
  position: absolute;
  bottom: 14%;
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.16em;
  color: var(--reader-muted);
}
</style>
