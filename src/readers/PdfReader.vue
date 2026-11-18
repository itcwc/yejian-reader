<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { loadPdfDocument, readPdfOutline, type PdfOutlineItem } from '@/core/pdf'
import { resolveTapZone } from '@/core/tap-zones'
import type { Preferences, ReaderProgress, ReadingProgress, TocItem } from '@/types'

const props = defineProps<{
  buffer: ArrayBuffer
  initial?: ReadingProgress | null
  settings: Preferences
}>()

const emit = defineEmits<{
  progress: [ReaderProgress]
  toc: [TocItem[]]
  ready: []
  error: [string]
  'toggle-bars': []
}>()

const stage = ref<HTMLElement>()
const wrap = ref<HTMLElement>()
const scrollList = ref<HTMLElement>()
const loading = ref(true)
const totalPages = ref(0)

const isScroll = computed(() => props.settings.readingMode === 'scroll')

let doc: PDFDocumentProxy | null = null
let pageNumber = 1
let renderToken = 0
let resizeObserver: ResizeObserver | null = null
let resizeTimer = 0
let wheelLock = 0
let swallowClickUntil = 0
let scrollRaf = 0
let touchStart = { x: 0, y: 0, time: 0 }
let disposed = false
const slots = new Map<number, HTMLElement>()
let observer: IntersectionObserver | null = null

function clampPage(value: number): number {
  return Math.max(1, Math.min(totalPages.value || 1, Math.round(value)))
}

function percentOf(value: number): number {
  if (totalPages.value <= 1) return 100
  return ((value - 1) / (totalPages.value - 1)) * 100
}

function filterCss(): string {
  if (props.settings.readerTheme === 'night' && props.settings.pdfInvert) {
    return 'invert(0.91) hue-rotate(180deg) contrast(0.94) saturate(0.9)'
  }
  if (props.settings.readerTheme === 'green') {
    return 'sepia(0.16) hue-rotate(46deg) saturate(0.92) brightness(0.985)'
  }
  return 'none'
}

function applyCanvasFilter() {
  const filter = filterCss()
  const canvases = stage.value?.querySelectorAll('canvas') || []
  canvases.forEach((canvas) => {
    if (canvas instanceof HTMLCanvasElement) canvas.style.filter = filter
  })
}

function emitProgress() {
  emit('progress', {
    percent: Math.max(0, Math.min(100, percentOf(pageNumber))),
    locator: String(pageNumber),
    detail: {
      page: pageNumber,
      totalPages: totalPages.value,
      chapter: totalPages.value ? `第 ${pageNumber} / ${totalPages.value} 页` : undefined,
    },
  })
}

function setSlot(el: any, pageNo: number) {
  if (el) slots.set(pageNo, el as HTMLElement)
  else slots.delete(pageNo)
}

async function renderPage(target: number) {
  if (!doc) return
  pageNumber = clampPage(target)
  const token = ++renderToken
  loading.value = true
  try {
    const pdfPage = await doc.getPage(pageNumber)
    if (token !== renderToken || disposed) return
    const stageEl = stage.value
    if (!stageEl) return

    const base = pdfPage.getViewport({ scale: 1 })
    const padding = 26
    const maxWidth = Math.max(200, stageEl.clientWidth - padding * 2)
    const maxHeight = Math.max(200, stageEl.clientHeight - padding * 2)
    const scale = Math.max(0.15, Math.min(maxWidth / base.width, maxHeight / base.height))
    const dpr = Math.min(2.5, window.devicePixelRatio || 1)
    const viewport = pdfPage.getViewport({ scale: scale * dpr })

    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    canvas.style.width = `${Math.floor(base.width * scale)}px`
    canvas.style.height = `${Math.floor(base.height * scale)}px`
    canvas.style.filter = filterCss()
    canvas.className = 'pdf-canvas'

    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法创建画布')

    const task = pdfPage.render({ canvasContext: context, viewport })
    await task.promise
    if (token !== renderToken || disposed) return

    wrap.value?.replaceChildren(canvas)
    loading.value = false
    emitProgress()
  } catch (error) {
    if ((error as { name?: string })?.name === 'RenderingCancelledException') return
    if (!disposed) {
      loading.value = false
      emit('error', error instanceof Error ? error.message : 'PDF 渲染失败')
    }
  }
}

async function renderScrollPage(target: number) {
  const slot = slots.get(target)
  if (!slot || slot.dataset.rendered === '1' || slot.dataset.rendered === 'pending') return
  if (!doc || disposed || !isScroll.value) return
  slot.dataset.rendered = 'pending'
  try {
    const pdfPage = await doc.getPage(target)
    if (disposed || !isScroll.value) {
      slot.dataset.rendered = ''
      return
    }

    const base = pdfPage.getViewport({ scale: 1 })
    const width = Math.max(220, slot.clientWidth || (stage.value?.clientWidth || 720) - 36)
    const scale = width / base.width
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const viewport = pdfPage.getViewport({ scale: scale * dpr })

    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    canvas.style.width = '100%'
    canvas.style.height = 'auto'
    canvas.style.filter = filterCss()
    canvas.className = 'pdf-canvas'

    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法创建画布')

    await pdfPage.render({ canvasContext: context, viewport }).promise
    if (disposed || !isScroll.value) {
      slot.dataset.rendered = ''
      return
    }

    slot.style.aspectRatio = ''
    slot.replaceChildren(canvas)
    slot.dataset.rendered = '1'
  } catch (error) {
    slot.dataset.rendered = ''
    if ((error as { name?: string })?.name !== 'RenderingCancelledException' && !disposed) {
      emit('error', error instanceof Error ? error.message : 'PDF 渲染失败')
    }
  }
}

function updateScrollProgress() {
  const stageEl = stage.value
  if (!stageEl || !totalPages.value) return
  const probe = stageEl.getBoundingClientRect().top + stageEl.clientHeight * 0.3
  let current = 1
  for (let pageNo = 1; pageNo <= totalPages.value; pageNo += 1) {
    const slot = slots.get(pageNo)
    if (!slot) continue
    if (slot.getBoundingClientRect().top <= probe) current = pageNo
    else break
  }
  const next = clampPage(current)
  if (next !== pageNumber) {
    pageNumber = next
    emitProgress()
  }
}

function onScroll() {
  if (!isScroll.value || scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    updateScrollProgress()
  })
}

function scrollToPage(target: number, smooth = true) {
  const stageEl = stage.value
  const slot = slots.get(clampPage(target))
  if (!stageEl || !slot) return
  const top =
    stageEl.scrollTop + (slot.getBoundingClientRect().top - stageEl.getBoundingClientRect().top) - 10
  stageEl.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' })
}

async function setupScroll() {
  if (!doc) return
  await nextTick()
  const stageEl = stage.value
  if (!stageEl) return

  let aspect = 1.414
  try {
    const first = await doc.getPage(1)
    const base = first.getViewport({ scale: 1 })
    if (base.width > 0) aspect = base.height / base.width
  } catch {
    /* 使用默认比例 */
  }

  slots.forEach((slot) => {
    slot.style.aspectRatio = `1 / ${aspect.toFixed(4)}`
    slot.dataset.rendered = ''
    slot.replaceChildren()
  })

  observer?.disconnect()
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const slot = entry.target as HTMLElement
        const target = Number(slot.dataset.page)
        if (Number.isFinite(target) && target > 0) void renderScrollPage(target)
      }
    },
    { root: stageEl, rootMargin: '720px 0px' },
  )

  slots.forEach((slot) => observer?.observe(slot))

  scrollToPage(pageNumber, false)
  void renderScrollPage(pageNumber)
  loading.value = false
  updateScrollProgress()
}

function teardownScroll() {
  observer?.disconnect()
  observer = null
  slots.forEach((slot) => {
    slot.replaceChildren()
    slot.dataset.rendered = ''
  })
}

function flattenOutline(items: PdfOutlineItem[], level = 1): TocItem[] {
  const result: TocItem[] = []
  for (const item of items) {
    result.push({ label: item.title, locator: String(item.page), level })
    if (item.children?.length) result.push(...flattenOutline(item.children, level + 1))
  }
  return result
}

function next() {
  if (isScroll.value) {
    scrollToPage(pageNumber + 1)
    return
  }
  if (pageNumber >= totalPages.value) return
  void renderPage(pageNumber + 1)
}

function prev() {
  if (isScroll.value) {
    scrollToPage(pageNumber - 1)
    return
  }
  if (pageNumber <= 1) return
  void renderPage(pageNumber - 1)
}

function goTo(locator: string) {
  const target = Number.parseInt(locator, 10)
  if (!Number.isFinite(target)) return
  if (isScroll.value) {
    void renderScrollPage(clampPage(target))
    scrollToPage(target)
    return
  }
  void renderPage(target)
}

function goToPercent(percent: number) {
  if (!totalPages.value) return
  const target = Math.round(1 + (percent / 100) * (totalPages.value - 1))
  if (isScroll.value) {
    void renderScrollPage(clampPage(target))
    scrollToPage(target)
    return
  }
  void renderPage(target)
}

function onWheel(event: WheelEvent) {
  if (isScroll.value) return
  if (Math.abs(event.deltaY) < 6) return
  const now = Date.now()
  if (now < wheelLock) return
  wheelLock = now + 420
  if (event.deltaY > 0) next()
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
  if (target?.closest('button, a, input')) return
  const selection = window.getSelection()
  if (selection && selection.toString().trim()) return
  const el = stage.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const zone = resolveTapZone(rect, event.clientX, event.clientY, isScroll.value ? 'vertical' : 'horizontal')
  if (zone === 'prev') prev()
  else if (zone === 'next') next()
  else emit('toggle-bars')
}

function scheduleRerender() {
  if (resizeTimer) window.clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => {
    if (disposed) return
    if (isScroll.value) void setupScroll()
    else void renderPage(pageNumber)
  }, 220)
}

onMounted(async () => {
  try {
    doc = await loadPdfDocument(props.buffer)
    if (disposed) return
    totalPages.value = doc.numPages
    const initialPage =
      props.initial?.detail?.page ||
      (props.initial?.percent ? Math.round(1 + (props.initial.percent / 100) * (totalPages.value - 1)) : 1)
    pageNumber = clampPage(initialPage)

    const outline = await readPdfOutline(doc).catch(() => [])
    emit('toc', flattenOutline(outline))

    if (isScroll.value) await setupScroll()
    else await renderPage(pageNumber)
    emit('ready')

    if (stage.value) {
      resizeObserver = new ResizeObserver(scheduleRerender)
      resizeObserver.observe(stage.value)
    }
  } catch (error) {
    emit('error', error instanceof Error ? error.message : 'PDF 打开失败')
  }
})

watch(
  () => [props.settings.readerTheme, props.settings.pdfInvert],
  () => applyCanvasFilter(),
)

watch(
  () => props.settings.readingMode,
  async (mode) => {
    if (!doc) return
    if (mode === 'scroll') {
      await setupScroll()
      emitProgress()
      return
    }
    teardownScroll()
    await nextTick()
    await renderPage(pageNumber)
  },
)

onBeforeUnmount(() => {
  disposed = true
  resizeObserver?.disconnect()
  observer?.disconnect()
  if (resizeTimer) window.clearTimeout(resizeTimer)
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
  void doc?.destroy().catch(() => undefined)
})

defineExpose({ next, prev, goTo, goToPercent })
</script>

<template>
  <div
    ref="stage"
    class="pdf-stage"
    :class="{ 'is-scroll': isScroll }"
    @wheel.passive="onWheel"
    @click="onClick"
    @scroll.passive="onScroll"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >
    <div v-if="!isScroll" ref="wrap" class="pdf-wrap"></div>
    <div v-else ref="scrollList" class="pdf-scroll-list">
      <div
        v-for="pageNo in totalPages"
        :key="pageNo"
        :ref="(el) => setSlot(el, pageNo)"
        class="pdf-slot"
        :data-page="pageNo"
      ></div>
    </div>
    <div v-if="loading && !isScroll" class="pdf-loading">
      <span class="spinner"></span>
    </div>
  </div>
</template>

<style scoped>
.pdf-stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: var(--reader-bg);
  overflow: hidden;
}

.pdf-stage.is-scroll {
  display: block;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0;
}

.pdf-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  max-height: 100%;
}

.pdf-wrap :deep(canvas) {
  display: block;
  border-radius: 2px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.18);
  transition: filter 0.3s var(--ease-soft);
}

.pdf-scroll-list {
  width: min(920px, 100%);
  margin: 0 auto;
  padding: 16px clamp(12px, 3vw, 32px) 130px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.pdf-slot {
  width: 100%;
  border-radius: 2px;
  background: color-mix(in srgb, var(--reader-ink) 4%, transparent);
}

.pdf-slot :deep(canvas) {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 2px;
  box-shadow: 0 6px 26px rgba(0, 0, 0, 0.14);
  transition: filter 0.3s var(--ease-soft);
}

.pdf-loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--reader-bg) 72%, transparent);
  pointer-events: none;
}
</style>
