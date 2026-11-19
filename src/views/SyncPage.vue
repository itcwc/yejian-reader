<script setup lang="ts">
import { t } from '@/core/i18n'
import { deviceDisplayName } from '@/core/device'
import { computed, ref } from 'vue'
import Icon from '@/components/Icon.vue'
import { useSyncStore } from '@/stores/sync'
import { useToastStore } from '@/stores/toast'
import { formatBytes, formatDateTime } from '@/utils/text'

const sync = useSyncStore()
const toast = useToastStore()

const testing = ref(false)
const testResult = ref<{ ok: boolean; message: string } | null>(null)
const showPassword = ref(false)
const deviceNameDraft = ref<string | null>(null)
const deviceName = computed({
  get: () => deviceNameDraft.value ?? deviceDisplayName(sync.device),
  set: (value: string) => { deviceNameDraft.value = value },
})

const hostLabel = computed(() => {
  try {
    return new URL(sync.config.url).host || sync.config.url
  } catch {
    return sync.config.url || t('尚未配置')
  }
})

const statusTitle = computed(() => {
  if (sync.syncing) return t('正在与云端对齐…')
  if (!sync.configured) return t('尚未连接云端')
  if (sync.lastResult?.ok) return sync.lastResult.message
  if (sync.lastResult) return t('上次同步没有完成')
  return t('连接已就绪，等待第一次同步')
})

const totalProgress = computed(() => {
  const result = sync.lastResult
  if (!result) return 0
  return result.progressPulled + result.progressPushed
})

async function testConnection() {
  testing.value = true
  testResult.value = null
  const result = await sync.testConnection()
  testResult.value = result
  testing.value = false
  toast.push(result.message, result.ok ? 'success' : 'error', 4200)
}

async function syncNow() {
  await sync.syncNow(false)
}

function saveDeviceName() {
  const name = deviceNameDraft.value?.trim()
  deviceNameDraft.value = null
  if (!name || name === deviceDisplayName(sync.device)) return
  sync.updateDeviceName(name)
  toast.push(t('设备名称已更新'), 'success')
}
</script>

<template>
  <div class="sync-page">
    <header class="page-head">
      <h1 class="display page-title">{{ t('跨设备同步') }}<span class="dot">{{ t('。') }}</span></h1>
      <p class="page-lede">{{ t('进度、书目与书籍文件通过你自己的 WebDAV 空间流转。没有账号体系， 没有中间服务器，换一台设备登录同一个空间即可接着读。') }}</p>
    </header>

    <section class="status-card" :class="{ 'is-syncing': sync.syncing, 'is-error': sync.lastResult && !sync.lastResult.ok }">
      <span class="status-ghost" aria-hidden="true">{{ '雲' }}</span>
      <div class="status-icon" :class="{ spinning: sync.syncing }">
        <Icon name="cloud" :size="30" />
      </div>
      <div class="status-copy">
        <div class="status-meta">
          <span class="status-dot" :class="{ on: sync.configured, busy: sync.syncing }"></span>
          <span class="status-host">{{ hostLabel }}</span>
          <span v-if="sync.lastResult" class="dot-sep">·</span>
          <span v-if="sync.lastResult">{{ formatDateTime(sync.lastResult.at) }}</span>
        </div>
        <h2 class="status-title">{{ statusTitle }}</h2>
        <p class="status-sub">
          <template v-if="sync.lastResult">{{ t('拉取 {0} 条 · 推送 {1} 条 · 下载 {2} 本 · 上传 {3} 本', [sync.lastResult.progressPulled, sync.lastResult.progressPushed, sync.lastResult.booksDownloaded, sync.lastResult.booksUploaded]) }}</template>
          <template v-else>{{ t('配置服务器后，页间会先合并阅读进度，再按需同步书籍文件。') }}</template>
        </p>
      </div>
      <button class="btn btn-primary sync-btn" type="button" :disabled="sync.syncing || !sync.configured" @click="syncNow">
        <span v-if="sync.syncing" class="spinner spinner-light"></span>
        <Icon v-else name="refresh" :size="16" />
        {{ sync.syncing ? t('同步中') : t('立即同步') }}
      </button>
    </section>

    <div class="sync-layout">
      <section class="card config-card">
        <header class="card-head">
          <div>
            <h2 class="card-title">{{ t('WebDAV 连接') }}</h2>
          </div>
          <span class="badge">{{ sync.configured ? t('已配置') : t('未配置') }}</span>
        </header>

        <div class="form">
          <label class="form-field">
            <span class="form-label">
              <Icon name="server" :size="14" />{{ t('服务器地址') }}</span>
            <input
              v-model="sync.config.url"
              class="field"
              type="url"
              placeholder="https://dav.example.com/dav/"
              spellcheck="false"
              autocomplete="off"
            />
            <span class="form-hint">{{ t('需要以 http:// 或 https:// 开头，建议填写 WebDAV 根路径。') }}</span>
          </label>

          <div class="form-row">
            <label class="form-field">
              <span class="form-label">
                <Icon name="key" :size="14" />{{ t('账号') }}</span>
              <input
                v-model="sync.config.username"
                class="field"
                type="text"
                :placeholder="t('WebDAV 用户名')"
                autocomplete="username"
                spellcheck="false"
              />
            </label>

            <label class="form-field">
              <span class="form-label">
                <Icon name="key" :size="14" />{{ t('密码') }}</span>
              <span class="password-wrap">
                <input
                  v-model="sync.config.password"
                  class="field"
                  :type="showPassword ? 'text' : 'password'"
                  :placeholder="t('建议使用应用专用密码')"
                  autocomplete="current-password"
                />
                <button class="password-toggle" type="button" :aria-label="showPassword ? t('隐藏密码') : t('显示密码')" @click="showPassword = !showPassword">
                  <Icon :name="showPassword ? 'minimize' : 'eye'" :size="15" />
                </button>
              </span>
            </label>
          </div>

          <label class="form-field">
            <span class="form-label">
              <Icon name="book-open" :size="14" />{{ t('设备名称') }}</span>
            <input
              v-model="deviceName"
              class="field"
              type="text"
              :placeholder="t('例如：书房桌面')"
              maxlength="24"
              @blur="saveDeviceName"
              @keydown.enter="saveDeviceName"
            />
            <span class="form-hint">{{ t('用于标记进度来源，方便识别是哪台设备读到的位置。') }}</span>
          </label>

          <div class="toggle-list">
            <div class="toggle-row">
              <div>
                <span class="form-label">{{ t('自动同步') }}</span>
                <span class="form-hint">{{ t('打开应用与合上书本时自动合并进度。') }}</span>
              </div>
              <button
                class="switch"
                :class="{ 'is-on': sync.config.autoSync }"
                type="button"
                role="switch"
                :aria-checked="sync.config.autoSync"
                @click="sync.config.autoSync = !sync.config.autoSync"
              >
                <span></span>
              </button>
            </div>

            <div class="toggle-row">
              <div>
                <span class="form-label">{{ t('同步书籍文件') }}</span>
                <span class="form-hint">{{ t('把书籍本体也上传到云端，其他设备可直接下载。会占用流量与空间。') }}</span>
              </div>
              <button
                class="switch"
                :class="{ 'is-on': sync.config.syncBooks }"
                type="button"
                role="switch"
                :aria-checked="sync.config.syncBooks"
                @click="sync.config.syncBooks = !sync.config.syncBooks"
              >
                <span></span>
              </button>
            </div>
          </div>

          <div v-if="testResult" class="test-result" :class="testResult.ok ? 'ok' : 'bad'">
            <Icon :name="testResult.ok ? 'check' : 'alert'" :size="15" />
            <span>{{ testResult.message }}</span>
          </div>

          <div class="form-actions">
            <button class="btn btn-ghost" type="button" :disabled="testing || sync.syncing" @click="testConnection">
              <span v-if="testing" class="spinner"></span>
              <Icon v-else name="wifi" :size="16" />{{ t('测试连接') }}</button>
            <button class="btn btn-primary" type="button" :disabled="sync.syncing || !sync.configured" @click="syncNow">
              <Icon name="sync" :size="16" />{{ t('同步全部') }}</button>
          </div>
        </div>
      </section>

      <div class="side-column">
        <section class="card result-card">
          <header class="card-head">
            <div>
              <h2 class="card-title">{{ t('本次同步') }}</h2>
            </div>
            <span v-if="sync.lastResult" class="badge" :class="{ 'badge-ok': sync.lastResult.ok }">
              {{ sync.lastResult.ok ? t('完成') : t('失败') }}
            </span>
          </header>

          <div v-if="sync.lastResult" class="result-body">
            <p class="result-message">{{ sync.lastResult.message }}</p>
            <div class="result-stats">
              <div class="stat">
                <span class="stat-value">{{ totalProgress }}</span>
                <span class="stat-label">{{ t('进度记录') }}</span>
              </div>
              <div class="stat">
                <span class="stat-value">{{ sync.lastResult.booksDownloaded }}</span>
                <span class="stat-label">{{ t('下载书籍') }}</span>
              </div>
              <div class="stat">
                <span class="stat-value">{{ sync.lastResult.booksUploaded }}</span>
                <span class="stat-label">{{ t('上传书籍') }}</span>
              </div>
              <div class="stat">
                <span class="stat-value">{{ formatBytes(sync.lastResult.bytes) }}</span>
                <span class="stat-label">{{ t('传输数据') }}</span>
              </div>
            </div>
          </div>
          <div v-else class="result-empty">
            <Icon name="cloud" :size="26" />
            <p>{{ t('还没有同步记录。配置好服务器后点一次「立即同步」。') }}</p>
          </div>
        </section>

        <section class="card log-card">
          <header class="card-head">
            <div>
              <h2 class="card-title">{{ t('同步日志') }}</h2>
            </div>
          </header>
          <ul v-if="sync.logs.length" class="log-list">
            <li v-for="(entry, index) in sync.logs" :key="index" class="log-item" :class="`tone-${entry.tone}`">
              <span class="log-time">{{ formatDateTime(entry.time).slice(11) }}</span>
              <span class="log-text">{{ entry.text }}</span>
            </li>
          </ul>
          <p v-else class="log-empty">{{ t('日志会记录连接、合并与传输的每一步。') }}</p>
        </section>
      </div>
    </div>

    <section class="notes">
      <article class="note">
        <span class="note-index">01</span>
        <h3>{{ t('进度如何合并') }}</h3>
        <p>{{ t('以每条记录的时间戳为准，保留较新的阅读位置；不同书互不影响，不会互相覆盖。') }}</p>
      </article>
      <article class="note">
        <span class="note-index">02</span>
        <h3>{{ t('浏览器才需要 CORS') }}</h3>
        <p>{{ t('桌面端与安卓应用通过原生网络栈请求 WebDAV，不需要服务端开启跨域；只有网页版直连时才要求允许 CORS 并暴露 PROPFIND 等方法。坚果云可填写 dav.jianguoyun.com 并使用应用密码。') }}</p>
      </article>
      <article class="note">
        <span class="note-index">03</span>
        <h3>{{ t('书籍文件可选') }}</h3>
        <p>{{ t('关闭「同步书籍文件」时只同步进度与书目，最省流量；打开后新设备可直接拉取原始文件。') }}</p>
      </article>
    </section>
  </div>
</template>

<style scoped>
.sync-page {
  height: 100%;
  overflow-y: auto;
  padding: clamp(30px, 5vh, 60px) var(--page-pad) calc(max(20px, env(safe-area-inset-bottom)) + 60px);
  background:
    radial-gradient(1000px 500px at 90% -10%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 60%);
}

.page-head {
  max-width: 1100px;
  margin: 0 auto;
}

.page-title {
  margin-top: 12px;
  font-size: clamp(36px, 4.6vw, 54px);
  font-weight: 500;
  line-height: 1.1;
}

.dot {
  color: var(--accent);
}

.page-lede {
  max-width: 600px;
  margin-top: 14px;
  color: var(--ink-muted);
  font-size: 13.5px;
  line-height: 1.9;
}

.status-card {
  position: relative;
  max-width: 1100px;
  margin: clamp(26px, 4vw, 40px) auto 0;
  display: flex;
  align-items: center;
  gap: 22px;
  padding: clamp(22px, 3vw, 32px) clamp(22px, 3vw, 36px);
  border-radius: var(--radius-lg);
  border: 1px solid var(--accent-line);
  background: linear-gradient(120deg, var(--surface) 0%, var(--accent-soft) 100%);
  overflow: hidden;
}

.status-ghost {
  position: absolute;
  right: 120px;
  top: 50%;
  transform: translateY(-50%);
  font-family: var(--font-serif);
  font-size: 180px;
  line-height: 1;
  color: var(--accent);
  opacity: 0.06;
  pointer-events: none;
}

.status-icon {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 1px solid var(--accent-line);
  background: var(--surface-raised);
  color: var(--accent);
  box-shadow: var(--shadow-sm);
}

.status-icon.spinning {
  animation: float 1.8s var(--ease-soft) infinite;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

.status-copy {
  flex: 1;
  min-width: 0;
}

.status-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.08em;
  color: var(--ink-muted);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ink-faint);
}

.status-dot.on {
  background: var(--accent);
}

.status-dot.busy {
  animation: pulse-soft 1.1s infinite;
}

.status-title {
  margin-top: 8px;
  font-family: var(--font-serif);
  font-size: clamp(19px, 2.1vw, 25px);
  font-weight: 600;
  line-height: 1.45;
}

.status-sub {
  margin-top: 7px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--ink-muted);
}

.sync-btn {
  flex: 0 0 auto;
  height: 44px;
}

.spinner-light {
  border-color: color-mix(in srgb, var(--accent-ink) 30%, transparent);
  border-top-color: var(--accent-ink);
}

.sync-layout {
  max-width: 1100px;
  margin: 26px auto 0;
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, 1fr);
  gap: 20px;
  align-items: start;
}

.card {
  padding: 24px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--line);
  background: var(--surface);
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
}

.card-title {
  margin-top: 4px;
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 600;
}

.badge-ok {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: var(--accent-line);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-top: 18px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--ink-soft);
  letter-spacing: 0.02em;
}

.form-hint {
  font-size: 10.5px;
  line-height: 1.6;
  color: var(--ink-faint);
}

.password-wrap {
  position: relative;
  display: block;
}

.password-wrap .field {
  padding-right: 40px;
}

.password-toggle {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: var(--ink-faint);
}

.password-toggle:hover {
  color: var(--ink);
  background: var(--surface-hover);
}

.toggle-list {
  border-top: 1px solid var(--line);
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 14px 0;
  border-bottom: 1px solid var(--line);
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

.test-result {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 13px;
  border-radius: var(--radius-sm);
  font-size: 11.5px;
  line-height: 1.6;
}

.test-result.ok {
  color: var(--accent);
  background: var(--accent-soft);
  border: 1px solid var(--accent-line);
}

.test-result.bad {
  color: var(--danger);
  background: var(--danger-soft);
  border: 1px solid color-mix(in srgb, var(--danger) 28%, transparent);
}

.form-actions {
  display: flex;
  gap: 10px;
  padding-top: 2px;
}

.side-column {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.result-body {
  padding-top: 16px;
}

.result-message {
  font-size: 13px;
  line-height: 1.75;
  color: var(--ink-soft);
}

.result-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 16px;
}

.stat {
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: var(--surface-soft);
  border: 1px solid var(--line);
}

.stat-value {
  display: block;
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 600;
  color: var(--ink);
  line-height: 1.2;
}

.stat-label {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--ink-faint);
}

.result-empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding-top: 22px;
  color: var(--ink-faint);
}

.result-empty p {
  font-size: 12px;
  line-height: 1.75;
  color: var(--ink-muted);
}

.log-list {
  padding-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
}

.log-item {
  display: flex;
  gap: 10px;
  font-size: 11.5px;
  line-height: 1.6;
}

.log-time {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 9.5px;
  color: var(--ink-faint);
  padding-top: 2px;
}

.log-text {
  color: var(--ink-muted);
}

.tone-success .log-text {
  color: var(--accent);
}

.tone-error .log-text {
  color: var(--danger);
}

.log-empty {
  padding-top: 16px;
  font-size: 11.5px;
  color: var(--ink-faint);
  line-height: 1.7;
}

.notes {
  max-width: 1100px;
  margin: 28px auto 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}

.note {
  padding: 20px;
  border-top: 1px solid var(--line-strong);
}

.note-index {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--accent);
}

.note h3 {
  margin: 8px 0;
  font-family: var(--font-serif);
  font-size: 14.5px;
  font-weight: 600;
}

.note p {
  font-size: 11.5px;
  line-height: 1.8;
  color: var(--ink-muted);
}

@media (max-width: 980px) {
  .sync-layout {
    grid-template-columns: 1fr;
  }

  .notes {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}

@media (max-width: 860px) {
  .sync-page {
    padding: 26px 18px calc(max(12px, env(safe-area-inset-bottom)) + 100px);
  }

  .status-card {
    flex-wrap: wrap;
    gap: 16px;
    padding: 20px;
  }

  .status-ghost {
    display: none;
  }

  .sync-btn {
    width: 100%;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .card {
    padding: 18px;
  }

  .notes {
    margin-top: 18px;
  }
}
</style>
