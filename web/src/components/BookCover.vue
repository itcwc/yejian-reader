<script setup lang="ts">
import { t } from '@/core/i18n'
import { computed, ref, watch } from 'vue'
import type { Book } from '@/types'
import { formatLabel } from '@/core/formats'

const props = withDefaults(
  defineProps<{
    book: Book
    url?: string | null
    variant?: 'card' | 'hero' | 'mini' | 'detail'
    showProgress?: boolean
  }>(),
  { url: null, variant: 'card', showProgress: true },
)

const imageFailed = ref(false)
watch(
  () => props.url,
  () => {
    imageFailed.value = false
  },
)

const PALETTES = [
  { from: '#37564a', to: '#1a2a23', foil: '#dccaa0' },
  { from: '#6f4436', to: '#38221b', foil: '#e8cda7' },
  { from: '#3d4a6c', to: '#1f2742', foil: '#ccd3e9' },
  { from: '#7a6238', to: '#42331c', foil: '#f0dfb4' },
  { from: '#503b5a', to: '#2a1f33', foil: '#e0cbe6' },
  { from: '#40545a', to: '#213136', foil: '#cce0e3' },
  { from: '#5f4b3b', to: '#32271f', foil: '#e8d6c0' },
  { from: '#3f5a52', to: '#213630', foil: '#cfe2d5' },
]

function hashOf(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

const palette = computed(() => PALETTES[hashOf(props.book.id) % PALETTES.length])

const paletteStyle = computed(() => ({
  '--cover-from': palette.value.from,
  '--cover-to': palette.value.to,
  '--cover-foil': palette.value.foil,
}))

const percent = computed(() => Math.max(0, Math.min(100, props.book.percent || 0)))
const hasImage = computed(() => Boolean(props.url) && !imageFailed.value)
</script>

<template>
  <div
    class="cover"
    :class="[`variant-${variant}`, { 'has-image': hasImage }]"
    :style="paletteStyle"
  >
    <img
      v-if="hasImage"
      :src="url || ''"
      :alt="t('{0} 封面', [book.title])"
      loading="lazy"
      @error="imageFailed = true"
    />

    <template v-else>
      <span class="cover-noise" aria-hidden="true"></span>
      <span class="cover-deco" aria-hidden="true"></span>
      <span class="cover-spine" aria-hidden="true"></span>
      <div class="cover-frame">
        <span class="cover-format">{{ formatLabel(book.format) }}</span>
        <span class="cover-rule" aria-hidden="true"></span>
        <span class="cover-title">{{ book.title }}</span>
        <span class="cover-author">{{ book.author || t('未知作者') }}</span>
      </div>
    </template>

    <span v-if="showProgress && percent > 0" class="cover-progress" aria-hidden="true">
      <span :style="{ width: `${percent}%` }"></span>
    </span>
  </div>
</template>

<style scoped>
.cover {
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: 3px 8px 8px 3px;
  overflow: hidden;
  background: linear-gradient(158deg, var(--cover-from), var(--cover-to));
  color: var(--cover-foil);
  box-shadow: var(--shadow-sm);
  container-type: inline-size;
  isolation: isolate;
}

.cover::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  pointer-events: none;
  z-index: 3;
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-noise {
  position: absolute;
  inset: 0;
  opacity: 0.5;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.07'/%3E%3C/svg%3E");
  mix-blend-mode: soft-light;
}

.cover-spine {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 7px;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.34), rgba(0, 0, 0, 0.05) 62%, rgba(255, 255, 255, 0.08));
  z-index: 2;
}

.cover-deco {
  position: absolute;
  right: -32%;
  bottom: -18%;
  width: 92%;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--cover-foil) 26%, transparent);
  box-shadow: 0 0 0 16px color-mix(in srgb, var(--cover-foil) 5%, transparent);
  opacity: 0.85;
}

.cover-deco::after {
  content: "";
  position: absolute;
  inset: 18%;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--cover-foil) 18%, transparent);
}

.cover-frame {
  position: relative;
  z-index: 2;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 9cqw 8cqw 8cqw 11cqw;
}

.cover-format {
  font-family: var(--font-mono);
  font-size: clamp(7px, 4.2cqw, 11px);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  opacity: 0.72;
}

.cover-rule {
  width: 18%;
  height: 1px;
  margin: 5cqw 0 4cqw;
  background: color-mix(in srgb, var(--cover-foil) 55%, transparent);
}

.cover-title {
  font-family: var(--font-serif);
  font-weight: 600;
  font-size: clamp(13px, 9.4cqw, 34px);
  line-height: 1.42;
  letter-spacing: 0.03em;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  text-wrap: balance;
  text-shadow: 0 1px 12px rgba(0, 0, 0, 0.22);
}

.cover-author {
  margin-top: auto;
  font-size: clamp(7px, 4.4cqw, 12px);
  letter-spacing: 0.12em;
  opacity: 0.72;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cover-progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 3px;
  background: rgba(0, 0, 0, 0.28);
  z-index: 4;
}

.cover-progress span {
  display: block;
  height: 100%;
  background: var(--cover-foil);
  opacity: 0.9;
}

.variant-hero {
  width: 104px;
  border-radius: 4px 10px 10px 4px;
}

.variant-mini {
  width: 46px;
  border-radius: 2px 5px 5px 2px;
}

.variant-detail {
  width: 148px;
  border-radius: 4px 10px 10px 4px;
}

.variant-mini .cover-frame {
  padding: 8cqw 6cqw 6cqw 12cqw;
}

.variant-mini .cover-title {
  -webkit-line-clamp: 3;
}

.variant-mini .cover-rule,
.variant-mini .cover-author {
  display: none;
}
</style>
