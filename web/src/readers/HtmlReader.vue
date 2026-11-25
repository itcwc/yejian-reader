<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Preferences, ReaderProgress, ReadingProgress, TocItem } from '@/types'
import { readerFontStack } from '@/core/preferences'
import { resolveTapZone } from '@/core/tap-zones'

const props = defineProps<{
  html: string
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

const frame = ref<HTMLIFrameElement>()
let doc: Document | null = null
let headings: { id: string; label: string; element: HTMLElement }[] = []
let scrollRaf = 0
let restoreTimers: number[] = []
let disposed = false
let initialPercent = 0
const sourceDoc = ref('')

function cssVar(name: string): string {
  const host = document.querySelector('.reader') || document.documentElement
  return getComputedStyle(host).getPropertyValue(name).trim()
}

function readerStyle(): string {
  const bg = cssVar('--reader-bg') || '#f7f4ea'
  const ink = cssVar('--reader-ink') || '#24281f'
  const muted = cssVar('--reader-muted') || '#82887b'
  const line = cssVar('--reader-line') || '#ded7c5'
  const accent = cssVar('--reader-accent') || '#3a6252'
  const font = readerFontStack(props.settings.fontKind)
  const width = props.settings.contentWidth

  return `
    html { background: ${bg} !important; }
    body {
      background: ${bg} !important;
      color: ${ink} !important;
      font-family: ${font} !important;
      font-size: ${props.settings.fontSize}px !important;
      line-height: ${props.settings.lineHeight} !important;
      margin: 0 auto !important;
      padding: 30px clamp(18px, 6vw, 72px) 140px !important;
      max-width: ${width + 140}px !important;
      box-sizing: border-box !important;
      overflow-wrap: break-word !important;
      text-align: justify;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", "STSong", serif !important;
      color: ${ink} !important;
      line-height: 1.4 !important;
      margin: 1.4em 0 0.7em !important;
    }
    h1 { font-size: 1.8em !important; }
    h2 { font-size: 1.45em !important; }
    h3 { font-size: 1.2em !important; }
    p { margin: 0 0 0.85em !important; }
    a { color: ${accent} !important; }
    img, video, svg, canvas {
      max-width: 100% !important;
      height: auto !important;
    }
    table {
      max-width: 100% !important;
      border-collapse: collapse !important;
      font-size: 0.9em !important;
    }
    th, td {
      border: 1px solid ${line} !important;
      padding: 0.4em 0.65em !important;
      color: ${ink} !important;
    }
    blockquote {
      color: ${muted} !important;
      border-left: 2px solid ${line} !important;
      margin: 0.9em 0 !important;
      padding: 0.1em 0 0.1em 1em !important;
    }
    pre, code {
      font-family: "JetBrains Mono", Consolas, monospace !important;
    }
    pre {
      white-space: pre-wrap !important;
      overflow-wrap: break-word !important;
      background: color-mix(in srgb, ${ink} 6%, transparent) !important;
      padding: 0.9em 1em !important;
      border-radius: 6px !important;
      font-size: 0.85em !important;
    }
    ::selection { background: ${accent} !important; color: ${bg} !important; }
  `
}

function buildDocument(raw: string): string {
  const style = `<style id="yejian-reader-style">${readerStyle()}</style>`
  if (/<\/head>/i.test(raw)) return raw.replace(/<\/head>/i, `${style}</head>`)
  if (/<body[^>]*>/i.test(raw)) return raw.replace(/<body[^>]*>/i, (match) => `${match}${style}`)
  return `<!doctype html><html><head><meta charset="utf-8" />${style}</head><body>${raw}</body></html>`
}

function ensureStyle() {
  if (!doc) return
  let style = doc.getElementById('yejian-reader-style') as HTMLStyleElement | null
  if (!style) {
    style = doc.createElement('style')
    style.id = 'yejian-reader-style'
    ;(doc.head || doc.documentElement).appendChild(style)
  }
  style.textContent = readerStyle()
}

let selectedChapter: { id: string; scrollTop: number } | undefined

function emitProgress() {
  if (!doc || disposed) return
  const scroller = doc.scrollingElement || doc.documentElement
  const max = scroller.scrollHeight - scroller.clientHeight
  const percent = max > 8 ? Math.min(100, Math.max(0, (scroller.scrollTop / max) * 100)) : 100

  if (selectedChapter?.scrollTop !== scroller.scrollTop) selectedChapter = undefined
  let chapter = headings.find((item) => item.id === selectedChapter?.id)
  if (!chapter) {
    for (const item of headings) {
      if (item.element.getBoundingClientRect().top <= 140) chapter = item
      else break
    }
  }

  emit('progress', {
    percent,
    locator: String(Math.round(scroller.scrollTop)),
    detail: { chapter: chapter?.label, chapterLocator: chapter?.id },
  })
}

function scheduleProgress() {
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    emitProgress()
  })
}

function collectHeadings() {
  if (!doc) return
  headings = []
  const elements = Array.from(doc.querySelectorAll('h1, h2, h3, h4')) as HTMLElement[]
  elements.forEach((element, index) => {
    const id = element.id || `yj-h-${index + 1}`
    element.id = id
    const label = element.textContent?.trim() || `第 ${index + 1} 节`
    headings.push({ id, label, element })
  })
  emit(
    'toc',
    headings.map((item) => ({
      label: item.label,
      locator: item.id,
      level: Number(item.element.tagName.slice(1)) || 1,
    })),
  )
}

function scrollToPercent(percent: number, smooth = false) {
  if (!doc) return
  const scroller = doc.scrollingElement || doc.documentElement
  const max = scroller.scrollHeight - scroller.clientHeight
  const target = (Math.max(0, Math.min(100, percent)) / 100) * max
  if (smooth) scroller.scrollTo({ top: target, behavior: 'smooth' })
  else scroller.scrollTop = target
}

function onFrameLoad() {
  if (disposed) return
  doc = frame.value?.contentDocument || null
  if (!doc) {
    emit('error', '无法读取网页内容')
    return
  }
  ensureStyle()
  collectHeadings()

  const view = doc.defaultView
  view?.addEventListener('scroll', scheduleProgress, { passive: true })

  doc.addEventListener('click', (event) => {
    const anchor = (event.target as HTMLElement | null)?.closest('a')
    if (anchor) {
      const href = anchor.getAttribute('href') || ''
      if (!href || href.startsWith('#')) return
      event.preventDefault()
      window.open(href, '_blank', 'noopener,noreferrer')
      return
    }

    const selection = view?.getSelection()
    if (selection && selection.toString().trim()) return

    const width = doc?.documentElement.clientWidth || 1
    const height = doc?.documentElement.clientHeight || 1
    const zone = resolveTapZone({ left: 0, top: 0, width, height }, event.clientX, event.clientY, 'vertical')
    if (zone === 'prev') prev()
    else if (zone === 'next') next()
    else emit('toggle-bars')
  })

  emit('ready')
  emitProgress()

  const attempt = (delay: number) => {
    const timer = window.setTimeout(() => {
      if (!disposed) scrollToPercent(initialPercent)
    }, delay)
    restoreTimers.push(timer)
  }
  attempt(80)
  attempt(500)
  attempt(1200)

  const images = Array.from(doc.querySelectorAll('img'))
  images.forEach((image) => {
    if (!image.complete) {
      image.addEventListener('load', () => scrollToPercent(initialPercent), { once: true })
    }
  })
}

function next() {
  const view = doc?.defaultView
  if (view) view.scrollBy({ top: view.innerHeight * 0.88, behavior: 'smooth' })
}

function prev() {
  const view = doc?.defaultView
  if (view) view.scrollBy({ top: -view.innerHeight * 0.88, behavior: 'smooth' })
}

function goTo(locator: string) {
  if (!doc) return
  const element = doc.getElementById(locator)
  if (!element) return
  element.scrollIntoView({ behavior: 'instant', block: 'start' })
  const scroller = doc.scrollingElement || doc.documentElement
  selectedChapter = { id: locator, scrollTop: scroller.scrollTop }
  emitProgress()
}

function goToPercent(percent: number) {
  scrollToPercent(percent, true)
}

onMounted(() => {
  initialPercent = props.initial?.percent || 0
  sourceDoc.value = buildDocument(props.html)
})

watch(
  () => [props.settings.fontSize, props.settings.lineHeight, props.settings.fontKind, props.settings.contentWidth, props.settings.readerTheme],
  () => ensureStyle(),
)

onBeforeUnmount(() => {
  disposed = true
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
  restoreTimers.forEach((timer) => window.clearTimeout(timer))
  const view = doc?.defaultView
  view?.removeEventListener('scroll', scheduleProgress)
})

defineExpose({ next, prev, goTo, goToPercent })
</script>

<template>
  <div class="html-reader">
    <iframe
      ref="frame"
      class="html-frame"
      :srcdoc="sourceDoc"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      title="网页内容"
      @load="onFrameLoad"
    ></iframe>
  </div>
</template>

<style scoped>
.html-reader {
  position: absolute;
  inset: 0;
  background: var(--reader-bg);
}

.html-frame {
  width: 100%;
  height: 100%;
  border: 0;
  background: var(--reader-bg);
}
</style>
