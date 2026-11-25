<script setup lang="ts">
import { t } from '@/core/i18n'
import { FORMAT_GROUPS, FORMAT_MAP, supportLabel } from '@/core/formats'

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const groups = FORMAT_GROUPS.map((group) => ({
  group,
  items: Array.from(FORMAT_MAP.values()).filter((format) => format.group === group),
}))
</script>

<template>
  <div class="format-matrix" :class="{ compact }">
    <section v-for="entry in groups" :key="entry.group" class="matrix-group">
      <h3 class="matrix-group-title">
        <span class="group-index">{{ t(entry.group).slice(0, 1) }}</span>
        {{ t(entry.group) }}
      </h3>
      <ul class="matrix-list">
        <li v-for="format in entry.items" :key="format.id" class="matrix-item">
          <div class="matrix-head">
            <span class="matrix-label">{{ format.label }}</span>
            <span class="matrix-badge" :class="`level-${format.level}`">
              {{ t(supportLabel(format.level)) }}
            </span>
          </div>
          <p v-if="format.level === 'convert' && !compact" class="matrix-hint">{{ t(format.hint ?? '') }}</p>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.format-matrix {
  display: grid;
  gap: 22px;
}

.matrix-group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-serif);
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--ink);
}

.group-index {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  font-family: var(--font-serif);
}

.matrix-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
  gap: 8px;
}

.matrix-item {
  padding: 9px 11px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
  background: var(--surface-raised);
}

.matrix-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.matrix-label {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--ink-soft);
}

.matrix-badge {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.04em;
  padding: 2px 5px;
  border-radius: 3px;
  white-space: nowrap;
}

.level-native {
  color: var(--accent);
  background: var(--accent-soft);
}

.level-convert {
  color: var(--ink-muted);
  background: var(--surface-soft);
  border: 1px solid var(--line);
}

.matrix-hint {
  margin-top: 6px;
  font-size: 11.5px;
  line-height: 1.55;
  color: var(--ink-muted);
}

.compact .matrix-list {
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
}

.compact .matrix-item {
  padding: 7px 9px;
}
</style>
