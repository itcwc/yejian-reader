<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

type UpdateState = {
  state: 'checking' | 'available' | 'none' | 'downloading' | 'downloaded' | 'error'
  version?: string
  percent?: number
  message?: string
}

const current = ref<UpdateState | null>(null)
const busy = ref(false)
let unsubscribe: (() => void) | undefined
let hideTimer: number | undefined

function apply(next: UpdateState) {
  if (next.state === 'checking' || next.state === 'none') return
  window.clearTimeout(hideTimer)
  current.value = next
  if (next.state === 'error') {
    hideTimer = window.setTimeout(() => {
      current.value = null
    }, 8000)
  }
}

async function download() {
  if (busy.value) return
  busy.value = true
  try {
    await window.yejian?.updates?.download()
  } finally {
    busy.value = false
  }
}

async function install() {
  await window.yejian?.updates?.install()
}

function dismiss() {
  window.clearTimeout(hideTimer)
  current.value = null
}

onMounted(() => {
  unsubscribe = window.yejian?.updates?.onStatus(apply)
})

onBeforeUnmount(() => {
  unsubscribe?.()
  window.clearTimeout(hideTimer)
})
</script>

<template>
  <Transition name="update">
    <aside v-if="current" class="update-card" role="status">
      <template v-if="current.state === 'available'">
        <p class="update-eyebrow">UPDATE</p>
        <h3 class="update-title">发现新版本 v{{ current.version }}</h3>
        <p class="update-text">下载完成后重启页间即可完成安装，书架与阅读进度不受影响。</p>
        <div class="update-actions">
          <button class="update-primary" :disabled="busy" @click="download">
            {{ busy ? '准备中…' : '下载更新' }}
          </button>
          <button class="update-ghost" @click="dismiss">稍后</button>
        </div>
      </template>

      <template v-else-if="current.state === 'downloading'">
        <p class="update-eyebrow">DOWNLOADING</p>
        <h3 class="update-title">正在下载 {{ current.percent ?? 0 }}%</h3>
        <div class="update-track"><span :style="{ width: `${current.percent ?? 0}%` }"></span></div>
        <p class="update-text">请保持页间运行，下载完成后可直接重启安装。</p>
      </template>

      <template v-else-if="current.state === 'downloaded'">
        <p class="update-eyebrow">READY</p>
        <h3 class="update-title">v{{ current.version }} 已就绪</h3>
        <p class="update-text">点击重启安装，或下次退出页间时自动完成更新。</p>
        <div class="update-actions">
          <button class="update-primary" @click="install">重启安装</button>
          <button class="update-ghost" @click="dismiss">稍后</button>
        </div>
      </template>

      <template v-else>
        <p class="update-eyebrow">UPDATE</p>
        <h3 class="update-title">更新检查失败</h3>
        <p class="update-text">{{ current.message || '请检查网络后重试。' }}</p>
        <div class="update-actions">
          <button class="update-ghost" @click="dismiss">关闭</button>
        </div>
      </template>
    </aside>
  </Transition>
</template>

<style scoped>
.update-card {
  position: fixed;
  right: 22px;
  bottom: 22px;
  z-index: var(--z-toast);
  width: min(340px, calc(100vw - 32px));
  padding: 18px 20px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  background: var(--surface-raised);
  box-shadow: var(--shadow-md);
}

.update-eyebrow {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.22em;
  color: var(--ink-faint);
}

.update-title {
  margin: 7px 0 0;
  font-family: var(--font-serif);
  font-size: 17px;
  font-weight: 600;
  color: var(--ink);
}

.update-text {
  margin: 7px 0 0;
  font-size: 12.5px;
  line-height: 1.75;
  color: var(--ink-muted);
}

.update-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
}

.update-primary,
.update-ghost {
  height: 32px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.18s var(--ease-soft), color 0.18s var(--ease-soft);
}

.update-primary {
  border: 1px solid var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
}

.update-primary:hover:not(:disabled) {
  background: var(--accent-strong);
}

.update-primary:disabled {
  opacity: 0.6;
  cursor: default;
}

.update-ghost {
  border: 1px solid var(--line);
  background: transparent;
  color: var(--ink-soft);
}

.update-ghost:hover {
  background: var(--surface-hover);
}

.update-track {
  height: 4px;
  margin-top: 12px;
  border-radius: var(--radius-pill);
  background: var(--surface-soft);
  overflow: hidden;
}

.update-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 0.25s var(--ease-out);
}

.update-enter-active,
.update-leave-active {
  transition: opacity 0.2s var(--ease-soft), transform 0.28s var(--ease-out);
}

.update-enter-from,
.update-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

@media (max-width: 720px) {
  .update-card {
    right: 16px;
    bottom: calc(78px + env(safe-area-inset-bottom));
  }
}
</style>
