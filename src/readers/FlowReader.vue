<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Preferences, ReaderProgress, ReadingProgress, TocItem } from '@/types'
import { readerFontStack } from '@/core/preferences'
import { resolveTapZone } from '@/core/tap-zones'

const props = defineProps<{
  html: string
  chapters: TocItem[]
  initial?: ReadingProgress | null
  settings: Preferences
  format: string
}>()

const emit = defineEmits<{
  progress: [ReaderProgress]
  ready: []
  'toggle-bars': []
}>()

const viewport = ref<HTMLElement>()
const track = ref<HTMLElement>()
const content = ref<HTMLElement>()

const isScroll = computed(() => props.settings.readingMode === 'scroll')

let page = 0
let totalPages = 1
let columnWidth = 0
let columnGap = 64
let anchors: { id: string; label: string; page: number; offset: number }[] = []
let selectedChapter: { id: string; position: number } | undefined
let lastPercent = props.initial?.percent || 0
let resizeObserver: ResizeObserver | null = null
let resizeTimer = 0
let imageLoadTimer = 0
let scrollRaf = 0
let wheelLock = 0
let swallowClickUntil = 0
let touchStart = { x: 0, y: 0, time: 0 }
let disposed = false

const contentStyle = computed(() => ({
  fontFamily: readerFontStack(props.settings.fontKind),
  fontSize: `${props.settings.fontSize}px`,
  lineHeight: String(props.settings.lineHeight),
}))

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function percentOfPage(value: number): number {
  if (totalPages <= 1) return 100
  return (value / (totalPages - 1)) * 100
}

function pageFromPercent(percent: number): number {
  if (totalPages <= 1) return 0
  return Math.min(totalPages - 1, Math.max(0, Math.round((percent / 100) * (totalPages - 1))))
}

function currentChapter() {
  const position = isScroll.value ? viewport.value?.scrollTop ?? 0 : page
  if (selectedChapter?.position === position) {
    const selected = anchors.find((anchor) => anchor.id === selectedChapter?.id)
    if (selected) return selected
  }
  selectedChapter = undefined
  let chapter: (typeof anchors)[number] | undefined
  if (isScroll.value) {
    const top = position + 24
    for (const anchor of anchors) {
      if (anchor.offset <= top) chapter = anchor
      else break
    }
    return chapter
  }
  for (const anchor of anchors) {
    if (anchor.page <= page) chapter = anchor
    else break
  }
  return chapter
}

function applyTransform() {
  const el = content.value
  if (!el) return
  el.style.transform = `translateX(-${page * (columnWidth + columnGap)}px)`
}

function emitProgress() {
  const chapter = currentChapter()
  const chapterDetail = { chapter: chapter?.label, chapterLocator: chapter?.id }
  if (isScroll.value) {
    const el = viewport.value
    if (!el) return
    const max = el.scrollHeight - el.clientHeight
    const percent = max > 8 ? clampPercent((el.scrollTop / max) * 100) : 100
    lastPercent = percent
    emit('progress', {
      percent,
      locator: `scroll:${Math.round(el.scrollTop)}`,
      detail: chapterDetail,
    })
    return
  }

  const percent = clampPercent(percentOfPage(page))
  lastPercent = percent
  emit('progress', {
    percent,
    locator: String(page),
    detail: {
      page: page + 1,
      totalPages,
      ...chapterDetail,
    },
  })
}

function collectPagedAnchors() {
  const el = content.value
  if (!el) return
  const base = el.getBoundingClientRect().left
  anchors = props.chapters
    .map((item) => {
      const node = el.querySelector(`#${CSS.escape(item.locator)}`) as HTMLElement | null
      const left = node ? node.getBoundingClientRect().left : base
      return {
        id: item.locator,
        label: item.label,
        offset: 0,
        page: Math.max(
          0,
          Math.min(totalPages - 1, Math.round((left - base) / (columnWidth + columnGap))),
        ),
      }
    })
    .filter((item) => item.page < totalPages)
}

function collectScrollAnchors() {
  const el = content.value
  if (!el) return
  const base = el.getBoundingClientRect().top
  anchors = props.chapters.map((item) => {
    const node = el.querySelector(`#${CSS.escape(item.locator)}`) as HTMLElement | null
    const rect = node?.getBoundingClientRect()
    return {
      id: item.locator,
      label: item.label,
      page: 0,
      offset: rect ? Math.max(0, rect.top - base) : 0,
    }
  })
}

function layoutPaged(percent: number) {
  const el = content.value
  const trackEl = track.value
  const viewportEl = viewport.value
  if (!el || !trackEl) return

  if (viewportEl) viewportEl.scrollTop = 0

  columnWidth = Math.max(260, trackEl.clientWidth)
  columnGap = Math.round(Math.min(120, Math.max(44, columnWidth * 0.09)))

  el.style.columnWidth = `${columnWidth}px`
  el.style.columnGap = `${columnGap}px`
  el.style.width = '100%'
  el.style.height = '100%'
  el.style.transform = 'none'

  const scrollWidth = el.scrollWidth
  totalPages = Math.max(1, Math.round((scrollWidth + columnGap) / (columnWidth + columnGap)))

  collectPagedAnchors()

  page = pageFromPercent(percent)
  applyTransform()
}

function scrollToPercent(percent: number, smooth = false) {
  const el = viewport.value
  if (!el) return
  const max = el.scrollHeight - el.clientHeight
  el.scrollTo({
    top: (clampPercent(percent) / 100) * Math.max(0, max),
    behavior: smooth ? 'smooth' : 'auto',
  })
}

function layoutScroll(percent: number) {
  const el = content.value
  if (!el) return

  el.style.columnWidth = 'auto'
  el.style.columnGap = '0px'
  el.style.width = '100%'
  el.style.height = 'auto'
  el.style.transform = 'none'

  totalPages = 1
  collectScrollAnchors()
  scrollToPercent(percent, false)
}

function relayout(preserve = true) {
  const percent = preserve ? lastPercent : 0
  if (isScroll.value) layoutScroll(percent)
  else layoutPaged(percent)
  emitProgress()
}

function next() {
  if (isScroll.value) {
    scrollByViewport(1)
    return
  }
  if (page >= totalPages - 1) return
  page += 1
  applyTransform()
  emitProgress()
}

function prev() {
  if (isScroll.value) {
    scrollByViewport(-1)
    return
  }
  if (page <= 0) return
  page -= 1
  applyTransform()
  emitProgress()
}

function scrollByViewport(direction: number) {
  const el = viewport.value
  if (!el) return
  el.scrollBy({ top: direction * el.clientHeight * 0.9, behavior: 'smooth' })
}

function goToPercent(percent: number) {
  if (isScroll.value) {
    scrollToPercent(percent, true)
    return
  }
  page = pageFromPercent(percent)
  applyTransform()
  emitProgress()
}

function goTo(locator: string) {
  const anchor = anchors.find((item) => item.id === locator)
  if (!anchor) return
  if (isScroll.value) {
    const el = viewport.value
    if (!el) return
    el.scrollTop = Math.max(0, anchor.offset - 24)
    selectedChapter = { id: locator, position: el.scrollTop }
    emitProgress()
    return
  }
  page = anchor.page
  selectedChapter = { id: locator, position: page }
  applyTransform()
  emitProgress()
}

function onScroll() {
  if (!isScroll.value || scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    emitProgress()
  })
}

function onWheel(event: WheelEvent) {
  if (isScroll.value) return
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
  if (Math.abs(delta) < 6) return
  const now = Date.now()
  if (now < wheelLock) return
  wheelLock = now + 420
  if (delta > 0) next()
  else prev()
}

function onTouchStart(event: TouchEvent) {
  if (isScroll.value) return
  const touch = event.touches[0]
  touchStart = { x: touch.clientX, y: touch.clientY, time: Date.now() }
}

function onTouchEnd(event: TouchEvent) {
  if (isScroll.value) return
  const touch = event.changedTouches[0]
  const dx = touch.clientX - touchStart.x
  const dy = touch.clientY - touchStart.y
  if (Date.now() - touchStart.time < 650 && Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    swallowClickUntil = Date.now() + 450
    if (dx < 0) next()
    else prev()
  }
}

function onClick(event: MouseEvent) {
  if (Date.now() < swallowClickUntil) return
  const target = event.target as HTMLElement | null
  if (target?.closest('a, button')) return
  const selection = window.getSelection()
  if (selection && selection.toString().trim()) return

  const el = viewport.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const zone = resolveTapZone(rect, event.clientX, event.clientY, isScroll.value ? 'vertical' : 'horizontal')
  if (zone === 'prev') prev()
  else if (zone === 'next') next()
  else emit('toggle-bars')
}

function scheduleRelayout() {
  if (resizeTimer) window.clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => {
    if (!disposed) relayout(true)
  }, 160)
}

onMounted(async () => {
  await nextTick()
  relayout(true)
  emit('ready')

  if (viewport.value) {
    resizeObserver = new ResizeObserver(scheduleRelayout)
    resizeObserver.observe(viewport.value)
  }

  const images = content.value?.querySelectorAll('img') || []
  images.forEach((image) => {
    image.addEventListener('load', () => {
      if (imageLoadTimer) window.clearTimeout(imageLoadTimer)
      imageLoadTimer = window.setTimeout(() => relayout(true), 220)
    })
  })
})

watch(
  () => [
    props.settings.fontSize,
    props.settings.lineHeight,
    props.settings.fontKind,
    props.settings.contentWidth,
    props.settings.readingMode,
  ],
  async () => {
    await nextTick()
    relayout(true)
  },
)

onBeforeUnmount(() => {
  disposed = true
  resizeObserver?.disconnect()
  if (resizeTimer) window.clearTimeout(resizeTimer)
  if (imageLoadTimer) window.clearTimeout(imageLoadTimer)
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
})

defineExpose({ next, prev, goToPercent, goTo })
</script>

<template>
  <div
    ref="viewport"
    class="flow-viewport"
    :class="{ 'scroll-mode': isScroll }"
    @scroll.passive="onScroll"
    @wheel.passive="onWheel"
    @click="onClick"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >
    <div ref="track" class="flow-track" :style="{ maxWidth: `${settings.contentWidth}px` }">
      <div
        ref="content"
        class="flow-content"
        :class="[`flow-${format}`, { 'is-scroll': isScroll }]"
        :style="contentStyle"
        v-html="html"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.flow-viewport {
  position: absolute;
  inset: 0;
  overflow: hidden;
  padding: 20px clamp(18px, 6vw, 64px) 30px;
  color: var(--reader-ink);
}

.flow-viewport.scroll-mode {
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-bottom: 110px;
}

.flow-track {
  height: 100%;
  width: 100%;
  margin: 0 auto;
}

.scroll-mode .flow-track {
  height: auto;
}

.flow-content {
  height: 100%;
  column-fill: auto;
  overflow: visible;
  transition: transform 0.38s var(--ease-out);
  will-change: transform;
  word-break: break-word;
  text-align: justify;
  text-justify: inter-ideograph;
}

.flow-content.is-scroll {
  height: auto;
  transition: none;
  will-change: auto;
}

.flow-content :deep(p) {
  margin: 0 0 0.72em;
  text-indent: 0;
}

.flow-content :deep(h1),
.flow-content :deep(h2),
.flow-content :deep(h3),
.flow-content :deep(h4) {
  font-family: var(--font-serif);
  font-weight: 600;
  color: var(--reader-ink);
  margin: 1.4em 0 0.7em;
  break-after: avoid;
  line-height: 1.45;
  text-align: left;
}

.flow-content :deep(h1) {
  font-size: 1.6em;
}

.flow-content :deep(h2) {
  font-size: 1.32em;
}

.flow-content :deep(h3) {
  font-size: 1.14em;
}

.flow-content :deep(h4) {
  font-size: 1em;
}

.flow-content :deep(blockquote) {
  margin: 1em 0;
  padding: 0.2em 0 0.2em 1.1em;
  border-left: 2px solid var(--reader-line);
  color: var(--reader-muted);
}

.flow-content :deep(em) {
  font-style: italic;
}

.flow-content :deep(strong) {
  font-weight: 600;
}

.flow-content :deep(a) {
  color: var(--reader-accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.flow-content :deep(img) {
  max-width: 100%;
  max-height: 92%;
  object-fit: contain;
  margin: 0.6em auto;
  break-inside: avoid;
  border-radius: 3px;
}

.flow-content.is-scroll :deep(img) {
  max-height: none;
  height: auto;
}

.flow-content :deep(hr) {
  border: 0;
  border-top: 1px solid var(--reader-line);
  margin: 1.6em 0;
}

.flow-content :deep(ul),
.flow-content :deep(ol) {
  margin: 0.6em 0 0.9em 1.4em;
  padding: 0;
}

.flow-content :deep(ul) {
  list-style: disc;
}

.flow-content :deep(ol) {
  list-style: decimal;
}

.flow-content :deep(li) {
  margin-bottom: 0.4em;
}

.flow-content :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.88em;
  padding: 0.12em 0.35em;
  border-radius: 3px;
  background: color-mix(in srgb, var(--reader-ink) 7%, transparent);
}

.flow-content :deep(pre) {
  font-family: var(--font-mono);
  font-size: 0.82em;
  line-height: 1.65;
  padding: 0.9em 1em;
  border-radius: 6px;
  background: color-mix(in srgb, var(--reader-ink) 5%, transparent);
  border: 1px solid var(--reader-line);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0.8em 0;
}

.flow-content :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88em;
  margin: 1em 0;
}

.flow-content :deep(th),
.flow-content :deep(td) {
  border: 1px solid var(--reader-line);
  padding: 0.4em 0.6em;
  text-align: left;
}

.flow-txt :deep(p),
.flow-fb2 :deep(p) {
  text-indent: 2em;
  margin-bottom: 0.6em;
}

.flow-txt :deep(h1),
.flow-txt :deep(h2) {
  text-align: center;
  margin: 1.6em 0 0.9em;
}

.flow-md :deep(p) {
  margin-bottom: 0.9em;
}

.flow-fb2 :deep(.fb2-title) {
  text-align: center;
}

.flow-fb2 :deep(.fb2-spacer) {
  height: 0.9em;
}

.flow-fb2 :deep(.fb2-epigraph) {
  font-style: italic;
}

.flow-fb2 :deep(.fb2-verse) {
  text-indent: 0;
  margin-bottom: 0.3em;
}

.flow-fb2 :deep(.fb2-text-author) {
  text-align: right;
  text-indent: 0;
  color: var(--reader-muted);
}

.flow-fb2 :deep(.fb2-poem) {
  margin: 1em 0 1em 1.2em;
}

.plain-xml {
  font-size: 0.82em;
  white-space: pre-wrap;
  word-break: break-word;
  text-indent: 0;
  padding: 0.8em;
  border: 1px solid var(--reader-line);
  border-radius: 6px;
}

.rtf-tab {
  display: inline-block;
  width: 2em;
}
</style>
