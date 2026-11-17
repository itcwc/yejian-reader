<script setup lang="ts">
import { useRoute } from 'vue-router'
import Icon from './Icon.vue'

const route = useRoute()
const appVersion = __APP_VERSION__

const nav = [
  { to: '/', label: '书架', icon: 'book' },
  { to: '/stats', label: '统计', icon: 'chart' },
  { to: '/sync', label: '同步', icon: 'sync' },
]

function isActive(to: string) {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}
</script>

<template>
  <aside class="rail">
    <RouterLink to="/" class="brand" aria-label="页间书架">
      <span class="brand-seal">
        <span class="seal-char">页</span>
      </span>
      <span class="brand-name">页间</span>
    </RouterLink>

    <nav class="rail-nav" aria-label="主导航">
      <RouterLink
        v-for="item in nav"
        :key="item.to"
        :to="item.to"
        class="rail-item"
        :class="{ 'is-active': isActive(item.to) }"
      >
        <span class="rail-indicator" aria-hidden="true"></span>
        <Icon :name="item.icon" :size="20" />
        <span class="rail-label">{{ item.label }}</span>
      </RouterLink>
    </nav>

    <div class="rail-foot">
      <RouterLink
        to="/settings"
        class="rail-item rail-item-foot"
        :class="{ 'is-active': isActive('/settings') }"
      >
        <span class="rail-indicator" aria-hidden="true"></span>
        <Icon name="settings" :size="20" />
        <span class="rail-label">设置</span>
      </RouterLink>
      <span class="rail-version">v{{ appVersion }}</span>
    </div>
  </aside>
</template>

<style scoped>
.rail {
  position: relative;
  z-index: var(--z-rail);
  width: var(--rail-width);
  flex: 0 0 var(--rail-width);
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 22px 10px 18px;
  background: var(--surface-soft);
  border-right: 1px solid var(--line);
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--ink);
}

.brand-seal {
  position: relative;
  width: 42px;
  height: 46px;
  display: grid;
  place-items: center;
  background: var(--accent);
  color: var(--accent-ink);
  border-radius: 5px 5px 14px 5px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-ink) 22%, transparent);
  transform: rotate(-2deg);
  transition: transform 0.4s var(--ease-out);
}

.brand:hover .brand-seal {
  transform: rotate(2deg) scale(1.03);
}

.brand-seal::after {
  content: "";
  position: absolute;
  inset: 4px;
  border: 1px solid color-mix(in srgb, var(--accent-ink) 38%, transparent);
  border-radius: 2px 2px 10px 2px;
  pointer-events: none;
}

.seal-char {
  font-family: var(--font-serif);
  font-size: 23px;
  line-height: 1;
  font-weight: 600;
}

.brand-name {
  font-family: var(--font-serif);
  font-size: 11px;
  letter-spacing: 0.24em;
  color: var(--ink-muted);
  padding-left: 0.24em;
}

.rail-nav {
  margin-top: 44px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.rail-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 60px;
  border-radius: var(--radius-md);
  color: var(--ink-muted);
  transition: color 0.2s, background 0.2s, transform 0.2s var(--ease-out);
}

.rail-item:hover {
  color: var(--ink);
  background: var(--surface-hover);
}

.rail-item.is-active {
  color: var(--accent);
  background: var(--accent-soft);
}

.rail-item:active {
  transform: scale(0.97);
}

.rail-indicator {
  position: absolute;
  left: -10px;
  top: 50%;
  width: 2px;
  height: 0;
  background: var(--accent);
  border-radius: 2px;
  transform: translateY(-50%);
  transition: height 0.28s var(--ease-out);
}

.rail-item.is-active .rail-indicator {
  height: 22px;
}

.rail-label {
  font-size: 10.5px;
  letter-spacing: 0.14em;
}

.rail-foot {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.rail-item-foot {
  width: 58px;
}

.rail-version {
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.1em;
  color: var(--ink-faint);
}

@media (max-width: 860px) {
  .rail {
    display: none;
  }
}
</style>
