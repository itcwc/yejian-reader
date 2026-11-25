<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { FormatId, Preferences, ReaderProgress, ReadingProgress } from '@/types'
import { extractComicPages } from '@/core/comic'
import { resolveTapZone } from '@/core/tap-zones'

const props = defineProps<{
  buffer: ArrayBuffer
  format: FormatId
  initial?: ReadingProgress | null
  settings: Preferences
}>()

const emit = defineEmits<{
  progress: [ReaderProgress]
  ready: []
  error: [string]
  'toggle-bars': []
}>()

const stage = ref<HTMLElement>()
const urls = ref<string[]>([])
const loading = ref(true)
const index = ref(0)
let wheelLock = 0
let swallowClickUntil = 0
let scrollRaf = 0
let touchStart = { x: 0, y: 0, time: 0 }
let disposed = false

const isScroll = computed(() => props.settings.readingMode === 'scroll')
const total = computed(() => urls.value.length)
const spread = computed(() => props.settings.comicSpread && total.value > 1 && total.value > 1)
const step = computed(() => (spread.value ? 2 : 1))
const visible = computed(() => {
  const result: { url: string; index: number }[] = []
  for (let offset = 0; offset < step.value; offset += 1) {
    const i = index.value + offset
    if (i < total.value && urls.value[i]) result.push({ url: urls.value[i], index: i })
  }
  return result
})

function percentOf(value: number): number {
  if (total.value <= 1) return 100
  return (value / (total.value - 1)) * 100
}

function emitProgress() {
  emit('progress', {
    percent: Math.max(0, Math.min(100, percentOf(index.value))),
    locator: String(index.value + 1),
    detail: {
      page: index.value + 1,
      totalPages: total.value,
      chapter: total.value ? `第 ${index.value + 1} / ${total.value} 页` : undefined,
    },
  })
}

function clampIndex(value: number): number {
  return Math.max(0, Math.min(Math.max(0, total.value - 1), value))
}

function preload() {
  for (let offset = -2; offset <= step.value + 2; offset += 1) {
    const target = index.value + offset
    if (target >= 0 && target < urls.value.length) {
      const image = new Image()
      image.src = urls.value[target]
    }
  }
}

function syncIndex(value: number) {
  const next = clampIndex(value)
  if (next === index.value && urls.value.length) return
  index.value = next
  emitProgress()
  preload()
}

function next() {
  if (isScroll.value) {
    scrollByViewport(1)
    return
  }
  if (index.value >= total.value - step.value) {
    if (index.value === total.value - 1) return
    syncIndex(total.value - 1)
    return
  }
  syncIndex(index.value + step.value)
}

function prev() {
  if (isScroll.value) {
    scrollByViewport(-1)
    return
  }
  syncIndex(index.value - step.value)
}

function scrollByViewport(direction: number) {
  const el = stage.value
  if (!el) return
  el.scrollBy({ top: direction * el.clientHeight * 0.92, behavior: 'smooth' })
}

function scrollToPercent(percent: number) {
  const el = stage.value
  if (!el) return
  const max = el.scrollHeight - el.clientHeight
  el.scrollTo({
    top: (Math.max(0, Math.min(100, percent)) / 100) * Math.max(0, max),
    behavior: 'auto',
  })
}

function onScroll() {
  if (!isScroll.value || scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    const el = stage.value
    if (!el || !total.value) return
    const max = el.scrollHeight - el.clientHeight
    const percent = max > 8 ? Math.max(0, Math.min(100, (el.scrollTop / max) * 100)) : 100
    const next = Math.round((percent / 100) * Math.max(0, total.value - 1))
    if (next !== index.value) {
      index.value = next
      emitProgress()
    }
  })
}

function goTo(locator: string) {
  const target = Number.parseInt(locator, 10)
  if (!Number.isFinite(target)) return
  if (isScroll.value) {
    scrollToPercent(percentOf(target - 1))
    return
  }
  syncIndex(target - 1)
}

function goToPercent(percent: number) {
  if (isScroll.value) {
    scrollToPercent(percent)
    return
  }
  syncIndex(Math.round((percent / 100) * Math.max(0, total.value - 1)))
}

function onWheel(event: WheelEvent) {
  if (isScroll.value) return
  if (Math.abs(event.deltaY) < 6) return
  const now = Date.now()
  if (now < wheelLock) return
  wheelLock = now + 380
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
  if (Date.now() - touchStart.time < 700 && Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.4) {
    swallowClickUntil = Date.now() + 450
    if (dx < 0) next()
    else prev()
  }
}

function onClick(event: MouseEvent) {
  if (Date.now() < swallowClickUntil) return
  if (loading.value) return
  const el = stage.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const zone = resolveTapZone(rect, event.clientX, event.clientY, isScroll.value ? 'vertical' : 'horizontal')
  if (zone === 'prev') prev()
  else if (zone === 'next') next()
  else emit('toggle-bars')
}

onMounted(async () => {
  try {
    const blobs = await extractComicPages(props.buffer, props.format)
    if (disposed) return
    urls.value = blobs.map((blob) => URL.createObjectURL(blob))
    if (!urls.value.length) {
      emit('error', '这个漫画包里没有找到图片')
      return
    }
    const initialIndex =
      props.initial?.detail?.page !== undefined
        ? props.initial.detail.page - 1
        : props.initial?.percent
          ? Math.round((props.initial.percent / 100) * (urls.value.length - 1))
          : 0
    index.value = clampIndex(initialIndex)
    loading.value = false
    emitProgress()
    preload()
    emit('ready')
    if (isScroll.value) {
      await nextTick()
      scrollToPercent(percentOf(index.value))
    }
  } catch (error) {
    emit('error', error instanceof Error ? error.message : '漫画解包失败')
  }
})

watch(
  () => props.settings.readingMode,
  async () => {
    await nextTick()
    if (isScroll.value) scrollToPercent(percentOf(index.value))
    else preload()
  },
)

onBeforeUnmount(() => {
  disposed = true
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
  urls.value.forEach((url) => URL.revokeObjectURL(url))
})

defineExpose({ next, prev, goTo, goToPercent })
</script>

<template>
  <div
    ref="stage"
    class="comic-stage"
    :class="{ 'is-scroll': isScroll }"
    @wheel.passive="onWheel"
    @click="onClick"
    @scroll.passive="onScroll"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >
    <div v-if="loading" class="comic-loading">
      <span class="spinner"></span>
      <span>正在解包漫画</span>
    </div>
    <template v-else>
      <div v-if="!isScroll" class="comic-pages" :class="{ spread }">
        <img
          v-for="page in visible"
          :key="page.index"
          :src="page.url"
          :alt="`第 ${page.index + 1} 页`"
          draggable="false"
        />
      </div>
      <div v-else class="comic-scroll">
        <img
          v-for="(url, pageIndex) in urls"
          :key="pageIndex"
          :src="url"
          :alt="`第 ${pageIndex + 1} 页`"
          loading="lazy"
          draggable="false"
        />
      </div>
    </template>
    <div v-if="!loading && !isScroll" class="comic-hint">滚轮 / 滑动翻页</div>
  </div>
</template>

<style scoped>
.comic-stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--reader-bg);
  overflow: hidden;
  user-select: none;
}

.comic-stage.is-scroll {
  display: block;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.comic-scroll {
  width: min(860px, 100%);
  margin: 0 auto;
  padding: 10px 10px 100px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comic-scroll img {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 2px;
  box-shadow: 0 6px 26px rgba(0, 0, 0, 0.14);
}

.comic-pages {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 100%;
  padding: 12px;
}

.comic-pages img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 2px;
  box-shadow: 0 8px 34px rgba(0, 0, 0, 0.16);
}

.comic-pages.spread img {
  max-width: calc(50% - 3px);
}

.comic-loading {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--reader-muted);
  font-size: 13px;
}

.comic-hint {
  position: absolute;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.12em;
  color: var(--reader-muted);
  opacity: 0.5;
  pointer-events: none;
}
</style>
