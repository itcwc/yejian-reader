<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Icon from '@/components/Icon.vue'
import FormatMatrix from '@/components/FormatMatrix.vue'
import { usePreferencesStore } from '@/stores/preferences'
import { useLibraryStore } from '@/stores/library'
import { useSyncStore } from '@/stores/sync'
import { useToastStore } from '@/stores/toast'
import { THEME_META } from '@/core/preferences'
import { exportLibraryBackup, importLibraryBackup, saveLibraryBackup } from '@/core/backup'
import { formatBytes } from '@/utils/text'
import type { ThemeId } from '@/types'

const preferences = usePreferencesStore()
const library = useLibraryStore()
const sync = useSyncStore()
const toast = useToastStore()

const appVersion = __APP_VERSION__
const updates = window.yejian?.updates
const checkingUpdate = ref(false)
const updateMessage = ref('')
let unsubscribeUpdate: (() => void) | undefined

const updateHint = computed(() => {
  if (updates) {
    return '启动时会自动检查 GitHub Releases，发现新版本后右下角提示下载，重启即可完成安装。'
  }
  if (sync.device.platform === 'android') {
    return 'Android 版启动时会自动检查新版本，也可前往 Releases 手动下载 APK。'
  }
  return '浏览器端不支持应用内更新；桌面版与 Android 版会自动检查，也可从 Releases 手动下载。'
})

async function checkUpdate() {
  if (!updates || checkingUpdate.value) return
  checkingUpdate.value = true
  try {
    const result = await updates.check()
    if (!result.supported) {
      toast.push('当前环境不支持应用内更新')
    } else if (result.error) {
      toast.push(`检查更新失败：${result.error}`, 'error')
    } else if (result.version && result.version !== appVersion) {
      toast.push(`发现新版本 v${result.version}`, 'success')
    } else {
      toast.push('已是最新版本', 'success')
    }
  } finally {
    checkingUpdate.value = false
  }
}

const usage = ref(0)
const quota = ref(0)
const backupInput = ref<HTMLInputElement>()
const backupBusy = ref<'export' | 'import' | null>(null)

async function exportBackup() {
  if (backupBusy.value) return
  backupBusy.value = 'export'
  try {
    const { blob, count } = await exportLibraryBackup()
    if (await saveLibraryBackup(blob)) toast.push(`已导出 ${count} 本书及其阅读进度`, 'success')
  } catch (error) {
    toast.push(`导出失败：${error instanceof Error ? error.message : '请重试'}`, 'error')
  } finally {
    backupBusy.value = null
  }
}

async function importBackup(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || backupBusy.value) return
  backupBusy.value = 'import'
  try {
    const { added, progressUpdated } = await importLibraryBackup(file)
    await library.refresh()
    toast.push(`导入完成：新增 ${added} 本书，更新 ${progressUpdated} 条阅读进度`, 'success')
  } catch (error) {
    toast.push(`导入失败：${error instanceof Error ? error.message : '请重试'}`, 'error')
  } finally {
    backupBusy.value = null
  }
}

const themes = (Object.keys(THEME_META) as ThemeId[]).map((id) => ({
  id,
  ...THEME_META[id],
  preview: {
    paper: { bg: '#f7f4ea', ink: '#24281f', line: '#ded7c5', accent: '#3a6252' },
    night: { bg: '#121612', ink: '#dcd9cd', line: '#2a302b', accent: '#9bc8ad' },
    green: { bg: '#e3eedb', ink: '#23301f', line: '#c8d9bf', accent: '#3f6a4b' },
  }[id],
}))

const platformLabel = computed(() => {
  const platform = sync.device.platform
  if (platform === 'pc') return '桌面应用（Electron）'
  if (platform === 'android') return '安卓（uniapp 容器）'
  return '浏览器（Web / PWA）'
})

const usagePercent = computed(() => {
  if (!quota.value) return 0
  return Math.min(100, (usage.value / quota.value) * 100)
})

onMounted(async () => {
  unsubscribeUpdate = updates?.onStatus((state) => {
    if (state.state === 'checking') updateMessage.value = '正在检查新版本…'
    else if (state.state === 'none') updateMessage.value = '已是最新版本'
    else if (state.state === 'available') updateMessage.value = `发现新版本 v${state.version}`
    else if (state.state === 'downloading') updateMessage.value = `正在下载 ${state.percent ?? 0}%`
    else if (state.state === 'downloaded') updateMessage.value = `v${state.version} 已下载，重启后安装`
    else updateMessage.value = state.message || '检查更新失败'
  })

  try {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate()
      usage.value = estimate.usage || 0
      quota.value = estimate.quota || 0
    }
  } catch {
    /* 估算不可用时忽略 */
  }
})

onBeforeUnmount(() => {
  unsubscribeUpdate?.()
})
</script>

<template>
  <div class="settings-page">
    <header class="page-head">
      <p class="eyebrow">SETTINGS · 页间</p>
      <h1 class="display page-title">让阅读更像自己<span class="dot">。</span></h1>
      <p class="page-lede">
        调整外观与默认排版。设置会保存在本机，并作用于之后打开的每一本书。
      </p>
    </header>

    <section class="panel">
      <header class="panel-head">
        <div>
          <p class="eyebrow">APPEARANCE</p>
          <h2 class="panel-title">外观主题</h2>
        </div>
        <span class="panel-note">应用界面（不含阅读页）</span>
      </header>

      <div class="theme-grid">
        <button
          v-for="theme in themes"
          :key="theme.id"
          class="theme-card"
          :class="{ 'is-active': preferences.prefs.theme === theme.id }"
          type="button"
          @click="preferences.setTheme(theme.id)"
        >
          <span class="theme-preview" :style="{ background: theme.preview.bg, color: theme.preview.ink }">
            <span class="preview-top" :style="{ background: theme.preview.accent }"></span>
            <span class="preview-title">读</span>
            <span class="preview-line" :style="{ background: theme.preview.line }"></span>
            <span class="preview-line short" :style="{ background: theme.preview.line }"></span>
            <span class="preview-line" :style="{ background: theme.preview.line }"></span>
          </span>
          <span class="theme-info">
            <span class="theme-label">{{ theme.label }}</span>
            <span class="theme-caption">{{ theme.caption }}</span>
          </span>
          <span v-if="preferences.prefs.theme === theme.id" class="theme-check">
            <Icon name="check" :size="13" />
          </span>
        </button>
      </div>

      <div class="theme-sub">
        <div class="theme-sub-head">
          <div>
            <span class="setting-label">阅读主题</span>
            <span class="setting-hint">只影响阅读页的纸面颜色，与应用主题互不干扰</span>
          </div>
        </div>
        <div class="reader-theme-row">
          <button
            v-for="theme in themes"
            :key="theme.id"
            class="reader-theme-chip"
            :class="{ 'is-active': preferences.prefs.readerTheme === theme.id }"
            type="button"
            @click="preferences.setReaderTheme(theme.id)"
          >
            <span
              class="chip-swatch"
              :style="{ background: theme.preview.bg, borderColor: theme.preview.line, color: theme.preview.ink }"
            >
              <span class="chip-swatch-line" :style="{ background: theme.preview.accent }"></span>
            </span>
            <span class="chip-label">{{ theme.label }}</span>
          </button>
        </div>
      </div>
    </section>

    <section class="panel">
      <header class="panel-head">
        <div>
          <p class="eyebrow">TYPOGRAPHY</p>
          <h2 class="panel-title">阅读排版</h2>
        </div>
        <span class="panel-note">实时保存</span>
      </header>

      <div class="setting-list">
        <div class="setting-row">
          <div>
            <span class="setting-label">正文字体</span>
            <span class="setting-hint">宋体更适合长文，黑体更清晰</span>
          </div>
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
          <div>
            <span class="setting-label">默认阅读方式</span>
            <span class="setting-hint">翻页逐屏阅读，滚动连续阅读</span>
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
            <span class="setting-label">默认字号</span>
            <span class="setting-hint">14 – 32 px</span>
          </div>
          <div class="range-control">
            <input v-model.number="preferences.prefs.fontSize" type="range" min="14" max="32" step="1" />
            <span class="range-value">{{ preferences.prefs.fontSize }}</span>
          </div>
        </div>

        <div class="setting-row">
          <div>
            <span class="setting-label">默认行距</span>
            <span class="setting-hint">更宽松的行距适合夜间与长时间阅读</span>
          </div>
          <div class="range-control">
            <input v-model.number="preferences.prefs.lineHeight" type="range" min="1.5" max="2.6" step="0.05" />
            <span class="range-value">{{ preferences.prefs.lineHeight.toFixed(2) }}</span>
          </div>
        </div>

        <div class="setting-row">
          <div>
            <span class="setting-label">版心宽度</span>
            <span class="setting-hint">流式文本每行的最大宽度</span>
          </div>
          <div class="range-control">
            <input v-model.number="preferences.prefs.contentWidth" type="range" min="560" max="980" step="20" />
            <span class="range-value">{{ preferences.prefs.contentWidth }}</span>
          </div>
        </div>

        <div class="setting-row">
          <div>
            <span class="setting-label">PDF 夜间反色</span>
            <span class="setting-hint">在夜读主题下反转 PDF 页面</span>
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

        <div class="setting-row">
          <div>
            <span class="setting-label">漫画双页</span>
            <span class="setting-hint">宽屏设备上并排显示两页</span>
          </div>
          <button
            class="switch"
            :class="{ 'is-on': preferences.prefs.comicSpread }"
            type="button"
            role="switch"
            :aria-checked="preferences.prefs.comicSpread"
            @click="preferences.prefs.comicSpread = !preferences.prefs.comicSpread"
          >
            <span></span>
          </button>
        </div>
      </div>
    </section>

    <div class="two-column">
      <section class="panel">
        <header class="panel-head">
          <div>
            <p class="eyebrow">STORAGE</p>
            <h2 class="panel-title">本地存储</h2>
          </div>
          <Icon name="folder" :size="18" />
        </header>

        <div class="storage-figures">
          <div class="figure">
            <span class="figure-value">{{ library.stats.total }}</span>
            <span class="figure-label">本书</span>
          </div>
          <div class="figure">
            <span class="figure-value">{{ formatBytes(library.totalBytes) }}</span>
            <span class="figure-label">书籍文件</span>
          </div>
          <div class="figure">
            <span class="figure-value">{{ formatBytes(usage) }}</span>
            <span class="figure-label">浏览器已用</span>
          </div>
        </div>

        <div v-if="quota" class="quota">
          <div class="quota-head">
            <span>存储配额</span>
            <span>{{ formatBytes(quota) }}</span>
          </div>
          <div class="quota-track">
            <span :style="{ width: `${usagePercent}%` }"></span>
          </div>
        </div>

        <p class="storage-note">
          书籍与阅读进度保存在本机 IndexedDB 中，不会自动上传。
          清理应用数据会删除本机书架，请先导出备份或使用 WebDAV 同步。
        </p>
      </section>

      <section class="panel">
        <header class="panel-head">
          <div>
            <p class="eyebrow">ABOUT</p>
            <h2 class="panel-title">关于页间</h2>
          </div>
          <span class="panel-note">本地优先 · 不上传</span>
        </header>

        <div class="about-mark">
          <span class="about-seal">页</span>
          <div>
            <h3 class="about-name">页间</h3>
            <p class="about-tagline">多设备阅读器 · 本地优先</p>
          </div>
        </div>

        <dl class="about-list">
          <div>
            <dt>运行平台</dt>
            <dd>{{ platformLabel }}</dd>
          </div>
          <div>
            <dt>设备名称</dt>
            <dd>{{ sync.device.name }}</dd>
          </div>
          <div>
            <dt>数据存储</dt>
            <dd>IndexedDB + Blob</dd>
          </div>
          <div>
            <dt>同步方式</dt>
            <dd>{{ sync.configured ? 'WebDAV 已配置' : 'WebDAV 未配置' }}</dd>
          </div>
        </dl>

        <p class="about-note">
          页间不提供账号，也不托管你的文件。阅读记录在你自己的设备与 WebDAV 空间之间流转。
        </p>
      </section>
    </div>

    <section class="panel">
      <header class="panel-head">
        <div>
          <p class="eyebrow">BACKUP</p>
          <h2 class="panel-title">书库与进度备份</h2>
        </div>
        <Icon name="folder" :size="18" />
      </header>
      <p class="storage-note">
        将书籍文件、封面和阅读进度导出为一个备份文件，可离线转移到另一台设备。
        导入会合并到当前书库，同一本书保留最近更新的进度。
      </p>
      <div class="backup-actions">
        <button class="check-update" :disabled="!!backupBusy" @click="exportBackup">
          {{ backupBusy === 'export' ? '导出中…' : '导出备份' }}
        </button>
        <button class="check-update" :disabled="!!backupBusy" @click="backupInput?.click()">
          {{ backupBusy === 'import' ? '导入中…' : '导入备份' }}
        </button>
        <input ref="backupInput" type="file" hidden @change="importBackup" />
      </div>
    </section>

    <section class="panel">
      <header class="panel-head">
        <div>
          <p class="eyebrow">UPDATE</p>
          <h2 class="panel-title">版本更新</h2>
        </div>
        <span class="panel-note">GitHub Releases</span>
      </header>

      <div class="update-row">
        <div class="update-version">
          <span class="update-label">当前版本</span>
          <span class="update-value">v{{ appVersion }}</span>
        </div>
        <button v-if="updates" class="check-update" :disabled="checkingUpdate" @click="checkUpdate">
          {{ checkingUpdate ? '检查中…' : '检查更新' }}
        </button>
        <a
          v-else
          class="check-update"
          href="https://github.com/itcwc/yejian-reader/releases"
          target="_blank"
          rel="noreferrer"
        >
          前往下载
        </a>
      </div>

      <p v-if="updateMessage" class="update-status">{{ updateMessage }}</p>
      <p class="update-note">{{ updateHint }}</p>
    </section>

    <section class="panel">
      <header class="panel-head">
        <div>
          <p class="eyebrow">FORMATS</p>
          <h2 class="panel-title">格式支持</h2>
        </div>
        <span class="panel-note">本地解析 · 不上传</span>
      </header>
      <p class="formats-intro">
        标为「直接阅读」的格式打开即读；「需转换」的格式会给出具体转换方式，
        转换后重新导入即可。
      </p>
      <FormatMatrix />
    </section>
  </div>
</template>

<style scoped>
.backup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}

.settings-page {
  height: 100%;
  overflow-y: auto;
  padding: clamp(30px, 5vh, 60px) var(--page-pad) calc(max(20px, env(safe-area-inset-bottom)) + 60px);
  background:
    radial-gradient(900px 480px at 6% -10%, color-mix(in srgb, var(--accent) 9%, transparent), transparent 60%);
}

.page-head {
  max-width: 1080px;
  margin: 0 auto clamp(26px, 4vw, 38px);
}

.page-title {
  margin-top: 12px;
  font-size: clamp(34px, 4.4vw, 52px);
  font-weight: 500;
  line-height: 1.12;
}

.dot {
  color: var(--accent);
}

.page-lede {
  max-width: 560px;
  margin-top: 14px;
  color: var(--ink-muted);
  font-size: 13.5px;
  line-height: 1.9;
}

.panel {
  max-width: 1080px;
  margin: 0 auto 20px;
  padding: 24px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--line);
  background: var(--surface);
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
}

.panel-title {
  margin-top: 4px;
  font-family: var(--font-serif);
  font-size: 19px;
  font-weight: 600;
}

.panel-note {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.1em;
  color: var(--ink-faint);
  padding-top: 4px;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-top: 18px;
}

.theme-sub {
  margin-top: 22px;
  padding-top: 20px;
  border-top: 1px solid var(--line);
}

.theme-sub-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.reader-theme-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.reader-theme-chip {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 7px 14px 7px 8px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line);
  background: var(--surface-soft);
  color: var(--ink-muted);
  font-size: 12px;
  transition: all 0.18s var(--ease-soft);
}

.reader-theme-chip:hover {
  color: var(--ink);
  border-color: var(--line-strong);
}

.reader-theme-chip.is-active {
  color: var(--accent);
  border-color: var(--accent-line);
  background: var(--accent-soft);
}

.chip-swatch {
  display: flex;
  align-items: flex-end;
  width: 22px;
  height: 22px;
  padding: 4px;
  border-radius: 7px;
  border: 1px solid;
}

.chip-swatch-line {
  display: block;
  width: 100%;
  height: 3px;
  border-radius: 2px;
}

.chip-label {
  letter-spacing: 0.02em;
}

.theme-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  background: var(--surface-raised);
  text-align: left;
  transition: transform 0.26s var(--ease-out), border-color 0.2s, box-shadow 0.2s;
}

.theme-card:hover {
  transform: translateY(-3px);
}

.theme-card.is-active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-soft);
}

.theme-preview {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 7px;
  height: 128px;
  padding: 18px 20px;
  border-radius: 4px 10px 10px 4px;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.preview-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  opacity: 0.75;
}

.preview-title {
  font-family: var(--font-serif);
  font-size: 24px;
  font-weight: 600;
  line-height: 1;
  margin-bottom: 2px;
}

.preview-line {
  height: 3px;
  border-radius: 99px;
  opacity: 0.85;
}

.preview-line.short {
  width: 62%;
}

.theme-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.theme-label {
  font-family: var(--font-serif);
  font-size: 14px;
  font-weight: 600;
}

.theme-caption {
  font-size: 10.5px;
  color: var(--ink-faint);
}

.theme-check {
  position: absolute;
  right: 12px;
  bottom: 16px;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--accent-ink);
}

.setting-list {
  padding-top: 4px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
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
  font-size: 10.5px;
  color: var(--ink-faint);
}

.segmented {
  display: flex;
  padding: 3px;
  border-radius: var(--radius-pill);
  background: var(--surface-soft);
  border: 1px solid var(--line);
  flex: 0 0 auto;
}

.segmented button {
  padding: 5px 16px;
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
  gap: 10px;
  flex: 0 0 260px;
}

.range-control input[type="range"] {
  flex: 1;
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
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
}

.range-value {
  min-width: 38px;
  text-align: right;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--ink-muted);
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

.two-column {
  max-width: 1080px;
  margin: 0 auto 20px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  align-items: stretch;
}

.two-column .panel {
  margin: 0;
}

.storage-figures {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-top: 18px;
}

.figure {
  padding: 13px 14px;
  border-radius: var(--radius-sm);
  background: var(--surface-soft);
  border: 1px solid var(--line);
}

.figure-value {
  display: block;
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.2;
}

.figure-label {
  display: block;
  margin-top: 3px;
  font-size: 9.5px;
  letter-spacing: 0.06em;
  color: var(--ink-faint);
}

.quota {
  margin-top: 16px;
}

.quota-head {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.05em;
  color: var(--ink-muted);
  margin-bottom: 7px;
}

.quota-track {
  height: 4px;
  border-radius: 99px;
  background: var(--line);
  overflow: hidden;
}

.quota-track span {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: inherit;
  transition: width 0.5s var(--ease-out);
}

.storage-note {
  margin-top: 16px;
  font-size: 11px;
  line-height: 1.75;
  color: var(--ink-faint);
}

.update-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 18px;
}

.update-version {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.update-label {
  font-size: 11px;
  color: var(--ink-muted);
}

.update-value {
  font-family: var(--font-mono);
  font-size: 15px;
  letter-spacing: 0.04em;
  color: var(--ink);
}

.update-status {
  margin-top: 12px;
  font-size: 11.5px;
  line-height: 1.7;
  color: var(--accent-strong);
}

.update-note {
  margin-top: 8px;
  font-size: 11px;
  line-height: 1.75;
  color: var(--ink-faint);
}

.check-update {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--line);
  background: transparent;
  color: var(--ink-soft);
  font-size: 11px;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.16s var(--ease-soft);
}

.check-update:hover:not(:disabled) {
  background: var(--surface-hover);
}

.check-update:disabled {
  opacity: 0.55;
  cursor: default;
}

.about-mark {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 18px;
}

.about-seal {
  display: grid;
  place-items: center;
  width: 44px;
  height: 48px;
  border-radius: 5px 5px 14px 5px;
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-serif);
  font-size: 23px;
  transform: rotate(-2deg);
}

.about-name {
  font-family: var(--font-serif);
  font-size: 19px;
  font-weight: 600;
}

.about-tagline {
  margin-top: 2px;
  font-size: 11px;
  color: var(--ink-muted);
}

.about-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 24px;
  margin-top: 18px;
}

.about-list > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 14px;
  padding: 7px 0;
  min-width: 0;
}

.about-list dt {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-faint);
}

.about-list dd {
  min-width: 0;
  font-size: 12px;
  color: var(--ink-soft);
  text-align: right;
  overflow-wrap: anywhere;
}

.about-note {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  font-size: 11px;
  line-height: 1.75;
  color: var(--ink-faint);
}

.formats-intro {
  margin-top: 16px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--ink-muted);
  margin-bottom: 18px;
}

@media (max-width: 980px) {
  .two-column {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 860px) {
  .settings-page {
    padding: 26px 18px calc(max(12px, env(safe-area-inset-bottom)) + 100px);
  }

  .panel {
    padding: 18px;
  }

  .theme-grid {
    grid-template-columns: 1fr;
  }

  .theme-card {
    flex-direction: row;
    align-items: center;
    gap: 14px;
  }

  .theme-preview {
    flex: 0 0 96px;
    height: 104px;
    padding: 14px;
  }

  .preview-title {
    font-size: 18px;
  }

  .theme-check {
    position: static;
    margin-left: auto;
  }

  .setting-row {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .range-control {
    flex: 1;
  }

  .segmented {
    align-self: flex-start;
  }

  .switch {
    align-self: flex-end;
  }

  .storage-figures {
    grid-template-columns: 1fr 1fr;
  }

  .about-list {
    grid-template-columns: 1fr;
  }
}
</style>
