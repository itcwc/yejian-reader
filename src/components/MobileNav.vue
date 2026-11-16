<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Icon from './Icon.vue'
import { usePreferencesStore } from '@/stores/preferences'

const route = useRoute()
const preferences = usePreferencesStore()

const items = [
  { to: '/', label: '书架', icon: 'book' },
  { to: '/sync', label: '同步', icon: 'sync' },
  { to: '/settings', label: '设置', icon: 'settings' },
]

const themeIcon = computed(() => {
  if (preferences.prefs.theme === 'night') return 'moon'
  if (preferences.prefs.theme === 'green') return 'leaf'
  return 'sun'
})

function isActive(to: string) {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}
</script>

<template>
  <nav class="mobile-nav" aria-label="移动端导航">
    <RouterLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="mobile-nav-item"
      :class="{ 'is-active': isActive(item.to) }"
    >
      <Icon :name="item.icon" :size="20" />
      <span>{{ item.label }}</span>
    </RouterLink>
    <button class="mobile-nav-item" type="button" @click="preferences.cycleTheme()">
      <Icon :name="themeIcon" :size="20" />
      <span>外观</span>
    </button>
  </nav>
</template>

<style scoped>
.mobile-nav {
  display: none;
}

@media (max-width: 860px) {
  .mobile-nav {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: max(12px, env(safe-area-inset-bottom));
    z-index: var(--z-rail);
    display: flex;
    justify-content: space-around;
    align-items: center;
    height: 62px;
    padding: 0 6px;
    border-radius: 22px;
    background: color-mix(in srgb, var(--surface) 88%, transparent);
    border: 1px solid var(--line);
    box-shadow: var(--shadow-md);
    backdrop-filter: blur(18px) saturate(1.15);
    -webkit-backdrop-filter: blur(18px) saturate(1.15);
  }

  .mobile-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-width: 58px;
    height: 46px;
    border-radius: 14px;
    color: var(--ink-muted);
    font-size: 10px;
    letter-spacing: 0.08em;
    transition: color 0.2s, background 0.2s;
  }

  .mobile-nav-item.is-active {
    color: var(--accent);
    background: var(--accent-soft);
  }
}
</style>
