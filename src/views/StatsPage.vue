<script setup lang="ts">
import { computed, onMounted } from 'vue'
import Icon from '@/components/Icon.vue'
import { useLibraryStore } from '@/stores/library'
import { formatLabel } from '@/core/formats'
import { formatBytes } from '@/utils/text'

const library = useLibraryStore()

onMounted(() => {
  if (!library.loaded) void library.refresh()
})

const books = computed(() => library.books)
const stats = computed(() => library.stats)

const avgPercent = computed(() => {
  if (!books.value.length) return 0
  const sum = books.value.reduce((total, book) => total + Math.min(100, Math.max(0, book.percent)), 0)
  return Math.round(sum / books.value.length)
})

const DAY = 86_400_000

const days = computed(() => {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const list: { key: number; label: string; count: number }[] = []
  for (let i = 29; i >= 0; i -= 1) {
    const from = start.getTime() - i * DAY
    const to = from + DAY
    const count = books.value.filter((book) => book.lastOpenedAt >= from && book.lastOpenedAt < to).length
    const date = new Date(from)
    list.push({ key: from, label: `${date.getMonth() + 1}/${date.getDate()}`, count })
  }
  return list
})

const maxDay = computed(() => Math.max(1, ...days.value.map((day) => day.count)))

const weekActive = computed(() => {
  const from = Date.now() - 7 * DAY
  return books.value.filter((book) => book.lastOpenedAt >= from).length
})

const formats = computed(() => {
  const map = new Map<string, { label: string; count: number; bytes: number }>()
  for (const book of books.value) {
    const key = formatLabel(book.format)
    const row = map.get(key) ?? { label: key, count: 0, bytes: 0 }
    row.count += 1
    row.bytes += book.size
    map.set(key, row)
  }
  const total = books.value.length || 1
  return [...map.values()]
    .sort((a, b) => b.count - a.count)
    .map((row) => ({ ...row, share: Math.max(4, Math.round((row.count / total) * 100)) }))
})

const inProgress = computed(() =>
  books.value
    .filter((book) => book.percent > 0 && book.percent < 99)
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
    .slice(0, 6),
)

function barHeight(count: number) {
  return `${Math.max(3, Math.round((count / maxDay.value) * 100))}%`
}
</script>

<template>
  <div class="stats-page">
    <header class="page-head">
      <p class="eyebrow">STATISTICS · 页间</p>
      <h1 class="display page-title">读过的都算数<span class="dot">。</span></h1>
      <p class="page-lede">
        统计只在本机计算，依据每本书的阅读进度与最近打开时间，不会上传到任何服务器。
      </p>
    </header>

    <section v-if="!books.length" class="panel empty">
      <Icon name="chart" :size="26" />
      <h2 class="empty-title">还没有可统计的书</h2>
      <p class="empty-text">导入几本书开始阅读，这里会记录你的进度与阅读偏好。</p>
      <RouterLink to="/" class="empty-link">去书架导入</RouterLink>
    </section>

    <template v-else>
      <section class="panel">
        <div class="figure-grid">
          <div class="figure">
            <span class="figure-value">{{ stats.total }}</span>
            <span class="figure-label">藏书总数</span>
          </div>
          <div class="figure">
            <span class="figure-value">{{ stats.reading }}</span>
            <span class="figure-label">正在读</span>
          </div>
          <div class="figure">
            <span class="figure-value">{{ stats.finished }}</span>
            <span class="figure-label">已读完</span>
          </div>
          <div class="figure">
            <span class="figure-value">{{ stats.unread }}</span>
            <span class="figure-label">未开始</span>
          </div>
          <div class="figure">
            <span class="figure-value">{{ avgPercent }}<em>%</em></span>
            <span class="figure-label">平均进度</span>
          </div>
        </div>
      </section>

      <section class="panel">
        <header class="panel-head">
          <div>
            <p class="eyebrow">RHYTHM</p>
            <h2 class="panel-title">阅读节奏</h2>
          </div>
          <span class="panel-note">最近 30 天</span>
        </header>

        <div class="rhythm">
          <div class="rhythm-bars">
            <div
              v-for="day in days"
              :key="day.key"
              class="rhythm-col"
              :title="`${day.label} · ${day.count} 本`"
            >
              <span class="rhythm-bar" :class="{ 'has-value': day.count > 0 }" :style="{ height: barHeight(day.count) }"></span>
            </div>
          </div>
          <div class="rhythm-foot">
            <span>30 天前</span>
            <span class="rhythm-summary">近 7 天打开过 {{ weekActive }} 本</span>
            <span>今天</span>
          </div>
          <p class="rhythm-note">按每本书最近一次打开的时间统计，同一天读多本书会累计。</p>
        </div>
      </section>

      <div class="two-column">
        <section class="panel">
          <header class="panel-head">
            <div>
              <p class="eyebrow">FORMATS</p>
              <h2 class="panel-title">格式分布</h2>
            </div>
            <span class="panel-note">{{ formats.length }} 种格式</span>
          </header>

          <ul class="format-rows">
            <li v-for="row in formats" :key="row.label" class="format-row">
              <div class="format-line">
                <span class="format-label">{{ row.label }}</span>
                <span class="format-meta">{{ row.count }} 本 · {{ formatBytes(row.bytes) }}</span>
              </div>
              <div class="format-track">
                <span :style="{ width: `${row.share}%` }"></span>
              </div>
            </li>
          </ul>
        </section>

        <section class="panel">
          <header class="panel-head">
            <div>
              <p class="eyebrow">CONTINUE</p>
              <h2 class="panel-title">继续阅读</h2>
            </div>
            <span class="panel-note">按最近打开排序</span>
          </header>

          <ul v-if="inProgress.length" class="continue-list">
            <li v-for="book in inProgress" :key="book.id">
              <RouterLink :to="`/reader/${book.id}`" class="continue-item">
                <div class="continue-head">
                  <span class="continue-title">{{ book.title }}</span>
                  <span class="continue-percent">{{ Math.round(book.percent) }}%</span>
                </div>
                <span class="continue-sub">{{ book.author || formatLabel(book.format) }}</span>
                <div class="continue-track">
                  <span :style="{ width: `${Math.min(100, book.percent)}%` }"></span>
                </div>
              </RouterLink>
            </li>
          </ul>
          <p v-else class="continue-empty">暂时没有在读的书，去书架挑一本开始。</p>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stats-page {
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
  font-size: 11px;
  letter-spacing: 0.05em;
  color: var(--ink-faint);
}

.two-column {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  max-width: 1080px;
  margin: 0 auto 20px;
}

.two-column .panel {
  width: 100%;
  margin: 0;
}

/* ---------- 概览 ---------- */
.figure-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
}

.figure {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px;
  border-radius: var(--radius-md);
  background: var(--surface-soft);
}

.figure-value {
  font-family: var(--font-display);
  font-size: clamp(24px, 2.6vw, 32px);
  line-height: 1;
  color: var(--ink);
}

.figure-value em {
  font-style: normal;
  font-size: 0.55em;
  margin-left: 2px;
  color: var(--ink-muted);
}

.figure-label {
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--ink-faint);
}

/* ---------- 阅读节奏 ---------- */
.rhythm {
  padding-top: 18px;
}

.rhythm-bars {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 120px;
}

.rhythm-col {
  flex: 1;
  display: flex;
  align-items: flex-end;
  height: 100%;
  border-radius: 3px;
  background: color-mix(in srgb, var(--ink) 4%, transparent);
  overflow: hidden;
}

.rhythm-bar {
  display: block;
  width: 100%;
  border-radius: 3px;
  background: color-mix(in srgb, var(--line-strong) 60%, transparent);
  transition: height 0.4s var(--ease-out);
}

.rhythm-bar.has-value {
  background: color-mix(in srgb, var(--accent) 70%, transparent);
}

.rhythm-foot {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: var(--ink-faint);
}

.rhythm-summary {
  color: var(--ink-muted);
}

.rhythm-note {
  margin-top: 10px;
  font-size: 11px;
  line-height: 1.7;
  color: var(--ink-faint);
}

/* ---------- 格式分布 ---------- */
.format-rows {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 18px;
}

.format-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.format-label {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--ink-soft);
}

.format-meta {
  font-size: 11px;
  color: var(--ink-faint);
}

.format-track {
  margin-top: 7px;
  height: 5px;
  border-radius: var(--radius-pill);
  background: var(--surface-soft);
  overflow: hidden;
}

.format-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: color-mix(in srgb, var(--accent) 62%, transparent);
}

/* ---------- 继续阅读 ---------- */
.continue-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 12px;
}

.continue-item {
  display: block;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  transition: background 0.18s var(--ease-soft);
}

.continue-item:hover {
  background: var(--surface-hover);
}

.continue-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.continue-title {
  font-family: var(--font-serif);
  font-size: 14px;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.continue-percent {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--accent);
}

.continue-sub {
  display: block;
  margin-top: 3px;
  font-size: 11px;
  color: var(--ink-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.continue-track {
  margin-top: 8px;
  height: 3px;
  border-radius: var(--radius-pill);
  background: var(--surface-soft);
  overflow: hidden;
}

.continue-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
}

.continue-empty {
  margin-top: 18px;
  font-size: 12.5px;
  color: var(--ink-faint);
  line-height: 1.8;
}

/* ---------- 空状态 ---------- */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 56px 24px;
  text-align: center;
  color: var(--ink-muted);
}

.empty-title {
  margin-top: 6px;
  font-family: var(--font-serif);
  font-size: 19px;
  color: var(--ink);
}

.empty-text {
  font-size: 12.5px;
  line-height: 1.8;
  color: var(--ink-muted);
}

.empty-link {
  margin-top: 8px;
  padding: 9px 20px;
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 12.5px;
}

@media (max-width: 860px) {
  .figure-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .figure:last-child {
    grid-column: 1 / -1;
  }

  .two-column {
    grid-template-columns: 1fr;
  }

  .rhythm-bars {
    gap: 3px;
    height: 96px;
  }
}
</style>
