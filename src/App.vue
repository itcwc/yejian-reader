<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppRail from '@/components/AppRail.vue'
import MobileNav from '@/components/MobileNav.vue'
import TitleBar from '@/components/TitleBar.vue'
import ToastHost from '@/components/ToastHost.vue'
import UpdateBanner from '@/components/UpdateBanner.vue'
import { useSyncStore } from '@/stores/sync'
import { useLibraryStore } from '@/stores/library'
import { usePreferencesStore } from '@/stores/preferences'
import { THEME_META } from '@/core/preferences'

const route = useRoute()
const immersive = computed(() => route.meta.immersive === true)
const customTitleBar = window.yejian?.os === 'win32'

// 安卓壳：阅读模式隐藏系统状态栏与导航栏，并把窗口底色同步为当前主题，
// 避免系统栏区域露出黑色底。
const shell = (window as unknown as {
  YeJianShell?: {
    setImmersive?: (value: boolean) => void
    setShellColor?: (color: string) => void
  }
}).YeJianShell
const preferences = usePreferencesStore()
watch(
  [immersive, () => preferences.prefs.readerTheme, () => preferences.prefs.theme],
  ([isImmersive]) => {
    shell?.setImmersive?.(isImmersive)
    const theme = isImmersive ? preferences.prefs.readerTheme : preferences.prefs.theme
    const meta = THEME_META[theme]
    shell?.setShellColor?.(isImmersive ? meta.readerColor : meta.color)
  },
  { immediate: true },
)

const sync = useSyncStore()
const library = useLibraryStore()

let lastAutoSync = 0

function handleVisibility() {
  if (document.visibilityState !== 'visible') return
  if (!sync.canAutoSync) return
  if (Date.now() - lastAutoSync < 5 * 60 * 1000) return
  lastAutoSync = Date.now()
  void sync.syncNow(true)
}

onMounted(async () => {
  void library.refresh()
  if (sync.canAutoSync) {
    lastAutoSync = Date.now()
    void sync.syncNow(true)
  }
  document.addEventListener('visibilitychange', handleVisibility)
})

onBeforeUnmount(() => document.removeEventListener('visibilitychange', handleVisibility))
</script>

<template>
  <div class="app" :class="{ 'has-titlebar': customTitleBar }">
    <TitleBar v-if="customTitleBar" />
    <AppRail v-if="!immersive" />

    <main class="app-main" :class="{ 'is-immersive': immersive }">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <MobileNav v-if="!immersive" />
    <UpdateBanner v-if="!immersive" />
    <ToastHost />
  </div>
</template>

<style scoped>
.app {
  position: relative;
  display: flex;
  height: 100%;
  width: 100%;
}

.app.has-titlebar {
  /* Windows draws the caption buttons over the first 36px. Reserve the divider below them. */
  --titlebar-height: 37px;
  padding-top: var(--titlebar-height);
}

.app-main {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  z-index: 1;
}
</style>
