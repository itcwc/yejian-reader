<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const LABELS: Record<string, string> = {
  library: '书架',
  stats: '统计',
  sync: '同步',
  settings: '设置',
  reader: '阅读',
}

const pageLabel = computed(() => LABELS[String(route.name)] || '页间')
</script>

<template>
  <header class="titlebar">
    <span class="titlebar-seal">页</span>
    <span class="titlebar-name">页间</span>
    <span class="titlebar-divider"></span>
    <span class="titlebar-page">{{ pageLabel }}</span>
  </header>
</template>

<style scoped>
.titlebar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 70;
  display: flex;
  align-items: center;
  gap: 9px;
  height: 36px;
  padding: 0 12px 0 16px;
  padding-right: 150px;
  background: var(--bg);
  border-bottom: 1px solid var(--line);
  color: var(--ink-muted);
  font-size: 11.5px;
  letter-spacing: 0.04em;
  user-select: none;
  -webkit-app-region: drag;
}

.titlebar-seal {
  display: grid;
  place-items: center;
  width: 17px;
  height: 17px;
  border-radius: 5px;
  background: var(--accent);
  color: var(--accent-ink);
  font-family: var(--font-serif);
  font-size: 11px;
  line-height: 1;
}

.titlebar-name {
  color: var(--ink-soft);
  font-family: var(--font-serif);
  font-size: 12.5px;
  letter-spacing: 0.06em;
}

.titlebar-divider {
  width: 1px;
  height: 11px;
  background: var(--line-strong);
}

.titlebar-page {
  color: var(--ink-faint);
}
</style>
