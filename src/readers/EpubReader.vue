<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ePub from 'epubjs'
import type { Preferences, ReaderProgress, ReadingProgress, TocItem } from '@/types'
import { readerFontStack } from '@/core/preferences'
import { resolveTapZone } from '@/core/tap-zones'

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

const host = ref<HTMLElement>()

let book: any = null
let rendition: any = null
let locationsReady = false
let destroyed = false
let resizeTimer = 0
let warmTimer = 0
let warmPending = false
let scrollBound: HTMLElement | null = null
let initialPercent = 0
let lastPercent = 0

function isScroll(): boolean {
  return props.settings.readingMode === 'scroll'
}

function cssVar(name: string): string {
  const host = document.querySelector('.reader') || document.documentElement
  return getComputedStyle(host).getPropertyValue(name).trim()
}

function themeRules() {
  const bg = cssVar('--reader-bg') || '#f7f4ea'
  const ink = cssVar('--reader-ink') || '#24281f'
  const accent = cssVar('--reader-accent') || '#3a6252'
  const line = cssVar('--reader-line') || '#ded7c5'
  const muted = cssVar('--reader-muted') || '#82887b'
  const font = readerFontStack(props.settings.fontKind)

  return {
    'html': {
      background: `${bg} !important`,
    },
    'body': {
      background: `${bg} !important`,
      color: `${ink} !important`,
      'font-family': `${font} !important`,
      'line-height': `${props.settings.lineHeight} !important`,
      padding: '0 !important',
      margin: '0 !important',
    },
    'p': {
      'line-height': `${props.settings.lineHeight} !important`,
      'margin-top': '0 !important',
      'margin-bottom': '0.75em !important',
    },
    'h1, h2, h3, h4, h5, h6': {
      color: `${ink} !important`,
      'line-height': '1.45 !important',
    },
    'a': {
      color: `${accent} !important`,
    },
    'blockquote': {
      color: `${muted} !important`,
      'border-left': `2px solid ${line} !important`,
      padding: '0 0 0 1em !important',
      margin: '0.8em 0 !important',
    },
    'img': {
      'max-width': '100% !important',
      height: 'auto !important',
    },
    '::selection': {
      background: `${accent} !important`,
      color: `${bg} !important`,
    },
  }
}

function applyTheme() {
  if (!rendition) return
  try {
    rendition.themes.register('yejian', themeRules())
    rendition.themes.select('yejian')
    rendition.themes.fontSize(`${props.settings.fontSize}px`)
  } catch {
    /* 主题应用失败时保留默认样式 */
  }
}

function flattenToc(items: any[], level = 1): TocItem[] {
  const result: TocItem[] = []
  for (const item of items || []) {
    const href = typeof item?.href === 'string' ? item.href : ''
    if (href) {
      result.push({
        label: String(item.label || href).trim(),
        locator: href,
        level,
      })
    }
    if (item?.subitems?.length) result.push(...flattenToc(item.subitems, level + 1))
  }
  return result
}

function chapterLabel(href?: string): string | undefined {
  if (!href || !book?.navigation?.get) return undefined
  try {
    const item = book.navigation.get(href)
    const label = typeof item?.label === 'string' ? item.label.trim() : ''
    return label || undefined
  } catch {
    return undefined
  }
}

function emitLocation(location: any) {
  if (!location?.start) return
  const cfi = String(location.start.cfi || '')
  if (!cfi) return

  let percent = 0
  if (locationsReady) {
    try {
      const value = book.locations.percentageFromCfi(cfi)
      if (Number.isFinite(value)) percent = value * 100
    } catch {
      percent = 0
    }
  }
  if (!percent) {
    const index = Number(location.start.index) || 0
    const total = Number(book?.spine?.length) || 1
    percent = (index / Math.max(1, total)) * 100
  }

  lastPercent = Math.max(0, Math.min(100, percent))
  emit('progress', {
    percent: lastPercent,
    locator: cfi,
    detail: {
      chapter: chapterLabel(location.start.href),
    },
  })
}

function scrollByViewport(direction: number) {
  const container = host.value?.querySelector('.epub-container') as HTMLElement | null
  if (container) {
    container.scrollBy({ top: direction * container.clientHeight * 0.9, behavior: 'smooth' })
    return
  }
  if (direction > 0) rendition?.next()
  else rendition?.prev()
}

function onReaderScroll() {
  scheduleWarmChapter()
}

function bindScrollWatch() {
  const container = host.value?.querySelector('.epub-container') as HTMLElement | null
  if (scrollBound === container) return
  unbindScrollWatch()
  scrollBound = container
  scrollBound?.addEventListener('scroll', onReaderScroll, { passive: true })
}

function unbindScrollWatch() {
  scrollBound?.removeEventListener('scroll', onReaderScroll)
  scrollBound = null
}

function scheduleWarmChapter(delay = 220) {
  if (warmTimer) window.clearTimeout(warmTimer)
  warmTimer = window.setTimeout(() => {
    warmTimer = 0
    void warmPreviousChapter()
  }, delay)
}

// 连续滚动时 epub.js 会在视口远离后销毁上一章的 iframe，只留下等高的空白占位，
// 用户向上滚回章首时会先看到白屏，再重新渲染，表现为闪动/回弹。
// 这里空闲时提前渲染上一章并阻止其被销毁，滚回章首时内容已就绪。
async function warmPreviousChapter() {
  if (destroyed || warmPending || !isScroll() || !rendition) return
  const manager = rendition.manager
  if (!manager || manager.name !== 'continuous' || !manager.views) return
  let anchor: any = null
  try {
    anchor = manager.visible?.()[0]
  } catch {
    anchor = null
  }
  if (!anchor) {
    const all = manager.views.all?.() || []
    anchor = all[all.length - 1] || manager.views.first?.()
  }
  const prev = anchor?.section?.prev?.()
  if (!prev) return
  const views: any[] = manager.views.all?.() || []
  const existing = views.find((view: any) => view?.section?.index === prev.index)

  warmPending = true
  try {
    if (existing) {
      // 保留该视图，避免视口远离后被 update() 销毁；已被销毁的空白视图需要重新渲染
      existing.destroy = () => {}
      if (!existing.displayed) await existing.display(manager.request)
    } else {
      const view = manager.prepend(prev)
      if (!view) return
      view.destroy = () => {}
      await view.display(manager.request)
    }
    bindScrollWatch()
  } catch {
    /* 预热失败时仍由 epub.js 在滚动到章首时自行处理 */
  } finally {
    warmPending = false
  }
}

function zoneFromContentEvent(event: MouseEvent) {
  const hostEl = host.value
  if (!hostEl) return null
  const rootEl = (hostEl.closest('.epub-reader') as HTMLElement | null) || hostEl
  const frame = hostEl.querySelector('iframe') as HTMLIFrameElement | null
  const frameRect = frame?.getBoundingClientRect()
  // iframe 内部坐标需换算成阅读器窗口坐标，避免分栏宽度大于可视区域时误判左右
  const screenX = (frameRect?.left ?? 0) + event.clientX
  const screenY = (frameRect?.top ?? 0) + event.clientY
  return resolveTapZone(
    rootEl.getBoundingClientRect(),
    screenX,
    screenY,
    isScroll() ? 'vertical' : 'horizontal',
  )
}

function hookContent(contents: any) {
  const doc: Document | undefined = contents?.document
  if (!doc) return

  if (isScroll()) {
    doc.addEventListener('keydown', (event: KeyboardEvent) => {
      if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(event.key)) {
        event.preventDefault()
        scrollByViewport(1)
      } else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(event.key)) {
        event.preventDefault()
        scrollByViewport(-1)
      }
    })
    doc.addEventListener('click', (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('a, button, input, textarea, select')) return
      const selection = doc.defaultView?.getSelection()
      if (selection && selection.toString().trim()) return
      const zone = zoneFromContentEvent(event)
      if (zone === 'prev') scrollByViewport(-1)
      else if (zone === 'next') scrollByViewport(1)
      else if (zone === 'toggle') emit('toggle-bars')
    })
    return
  }

  let swallowClickUntil = 0
  const turnByX = (event: MouseEvent) => {
    if (Date.now() < swallowClickUntil) return
    const target = event.target as HTMLElement | null
    if (target?.closest('a, button, input, textarea, select')) return
    const selection = doc.defaultView?.getSelection()
    if (selection && selection.toString().trim()) return
    const zone = zoneFromContentEvent(event)
    if (zone === 'prev') rendition?.prev()
    else if (zone === 'next') rendition?.next()
    else if (zone === 'toggle') emit('toggle-bars')
  }
  doc.addEventListener('click', turnByX)

  doc.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
      event.preventDefault()
      rendition?.next()
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      event.preventDefault()
      rendition?.prev()
    }
  })

  let startX = 0
  let startY = 0
  let startTime = 0
  doc.addEventListener(
    'touchstart',
    (event: TouchEvent) => {
      const touch = event.touches[0]
      startX = touch.clientX
      startY = touch.clientY
      startTime = Date.now()
    },
    { passive: true },
  )
  doc.addEventListener(
    'touchend',
    (event: TouchEvent) => {
      const touch = event.changedTouches[0]
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      if (Date.now() - startTime < 650 && Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        swallowClickUntil = Date.now() + 450
        if (dx < 0) rendition?.next()
        else rendition?.prev()
      }
    },
    { passive: true },
  )
}

function handleResize() {
  if (resizeTimer) window.clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => {
    if (!destroyed && rendition) {
      try {
        rendition.resize()
      } catch {
        /* 忽略 */
      }
    }
  }, 180)
}

async function createRendition(target?: string) {
  if (!book || !host.value || destroyed) return
  unbindScrollWatch()
  try {
    rendition?.destroy()
  } catch {
    /* 忽略销毁异常 */
  }

  rendition = book.renderTo(host.value, {
    width: '100%',
    height: '100%',
    flow: isScroll() ? 'scrolled' : 'paginated',
    ...(isScroll() ? { manager: 'continuous', overflow: 'scroll' } : {}),
    spread: 'none',
    minSpreadWidth: 100000,
    allowScriptedContent: false,
  })

  rendition.hooks.content.register(hookContent)
  rendition.on('relocated', (location: any) => {
    emitLocation(location)
    scheduleWarmChapter()
  })

  applyTheme()

  let positioned = false
  try {
    await rendition.display(target)
    positioned = true
  } catch {
    /* 忽略定位失败 */
  }
  if (destroyed) return positioned
  emit('ready')
  bindScrollWatch()
  window.requestAnimationFrame(() => {
    if (!destroyed) void warmPreviousChapter()
  })
  return positioned
}

async function scrollToPercent(percent: number) {
  if (!book || !rendition) return
  const ratio = Math.max(0, Math.min(100, percent)) / 100
  if (locationsReady) {
    try {
      const cfi = book.locations.cfiFromPercentage(ratio)
      if (cfi) await rendition.display(cfi)
    } catch {
      /* 忽略 */
    }
  } else {
    const total = Math.max(1, Number(book.spine?.length) || 1)
    const index = Math.min(total - 1, Math.floor(ratio * total))
    const item = book.spine.get(index) as any
    if (item?.href) {
      try {
        await rendition.display(item.href)
      } catch {
        /* 忽略 */
      }
    }
  }
  const current = rendition.currentLocation?.()
  if (current) emitLocation(current)
}

async function rebuild() {
  if (!book || destroyed) return
  const percent = lastPercent
  if (isScroll()) {
    await createRendition()
    if (destroyed) return
    await scrollToPercent(percent)
    return
  }

  let cfi: string | undefined
  try {
    const current = rendition?.currentLocation?.()?.start?.cfi
    if (typeof current === 'string' && current.startsWith('epubcfi(')) cfi = current
  } catch {
    cfi = undefined
  }
  await createRendition(cfi)
  if (cfi || destroyed) return

  if (locationsReady) {
    try {
      const target = book.locations.cfiFromPercentage(Math.max(0, Math.min(1, percent / 100)))
      if (target) await rendition.display(target)
    } catch {
      /* 忽略 */
    }
  }
}

onMounted(async () => {
  try {
    initialPercent = props.initial?.percent || 0
    lastPercent = initialPercent
    const initialLocator =
      props.initial?.locator && props.initial.locator.startsWith('epubcfi(')
        ? props.initial.locator
        : null

    book = ePub(props.buffer.slice(0))
    await book.ready
    await book.loaded.navigation.catch(() => null)

    if (destroyed || !host.value) return

    const toc = flattenToc(book.navigation?.toc || [])
    emit('toc', toc)

    const positioned = await createRendition(initialLocator || undefined)
    if (destroyed) return

    // 有精确 CFI 时直接用 CFI 定位；百分比定位在 locations 就绪前只能按章节粗算，
    // 会落到章首，因此滚动模式也不能用它覆盖 CFI。
    const hasLocator = Boolean(initialLocator) && positioned
    if (isScroll() && !hasLocator) await scrollToPercent(initialPercent)

    book.locations
      .generate(1400)
      .then(async () => {
        if (destroyed) return
        locationsReady = true
        if (hasLocator) {
          const located = rendition?.currentLocation?.()
          if (located) emitLocation(located)
          return
        }
        if (initialPercent > 0) {
          try {
            const cfi = book.locations.cfiFromPercentage(initialPercent / 100)
            if (cfi) await rendition?.display(cfi)
          } catch {
            /* 忽略定位失败 */
          }
        }
        const current = rendition?.currentLocation?.()
        if (current) emitLocation(current)
      })
      .catch(() => undefined)

    window.addEventListener('resize', handleResize)
  } catch (error) {
    emit('error', error instanceof Error ? error.message : 'EPUB 打开失败')
  }
})

watch(
  () => [props.settings.fontSize, props.settings.lineHeight, props.settings.fontKind, props.settings.readerTheme],
  () => applyTheme(),
)

watch(
  () => props.settings.readingMode,
  async () => {
    if (!book || destroyed) return
    await rebuild()
  },
)

function next() {
  if (isScroll()) {
    scrollByViewport(1)
    return
  }
  rendition?.next()
}

function prev() {
  if (isScroll()) {
    scrollByViewport(-1)
    return
  }
  rendition?.prev()
}

function onFrameClick(event: MouseEvent) {
  if (isScroll()) return
  const el = event.currentTarget as HTMLElement | null
  if (!el) return
  const rect = el.getBoundingClientRect()
  const zone = resolveTapZone(rect, event.clientX, event.clientY)
  if (zone === 'prev') rendition?.prev()
  else if (zone === 'next') rendition?.next()
  else emit('toggle-bars')
}

function goTo(locator: string) {
  if (rendition && locator) rendition.display(locator)
}

function goToPercent(percent: number) {
  if (!rendition) return
  if (isScroll()) {
    void scrollToPercent(percent)
    return
  }
  if (locationsReady) {
    try {
      const cfi = book.locations.cfiFromPercentage(Math.max(0, Math.min(1, percent / 100)))
      if (cfi) rendition.display(cfi)
    } catch {
      /* 忽略 */
    }
    return
  }
  try {
    const spineItem = book.spine.get(Math.round((percent / 100) * (book.spine.length - 1)))
    if (spineItem?.href) rendition.display(spineItem.href)
  } catch {
    /* 忽略 */
  }
}

onBeforeUnmount(() => {
  destroyed = true
  window.removeEventListener('resize', handleResize)
  if (resizeTimer) window.clearTimeout(resizeTimer)
  if (warmTimer) window.clearTimeout(warmTimer)
  unbindScrollWatch()
  try {
    rendition?.destroy()
    book?.destroy()
  } catch {
    /* 忽略销毁异常 */
  }
})

defineExpose({ next, prev, goTo, goToPercent })
</script>

<template>
  <div class="epub-reader" @click="onFrameClick">
    <div ref="host" class="epub-host"></div>
  </div>
</template>

<style scoped>
.epub-reader {
  position: absolute;
  inset: 0;
  padding: 10px clamp(16px, 5vw, 58px) 24px;
  overflow-anchor: none;
}

.epub-host {
  width: 100%;
  height: 100%;
  max-width: 900px;
  margin: 0 auto;
  overflow-anchor: none;
}

/* 连续滚动时 epub.js 会自行补偿滚动位置，浏览器的滚动锚定会与之叠加导致回弹 */
.epub-host :deep(.epub-container) {
  overflow-anchor: none;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.epub-host :deep(iframe) {
  border: 0;
  width: 100%;
  height: 100%;
  background: transparent;
}
</style>
