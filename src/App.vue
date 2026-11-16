<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppRail from '@/components/AppRail.vue'
import MobileNav from '@/components/MobileNav.vue'
import ToastHost from '@/components/ToastHost.vue'
import { useSyncStore } from '@/stores/sync'
import { useLibraryStore } from '@/stores/library'

const route = useRoute()
const immersive = computed(() => route.meta.immersive === true)

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
  <div class="app">
    <AppRail v-if="!immersive" />

    <main class="app-main" :class="{ 'is-immersive': immersive }">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <MobileNav v-if="!immersive" />
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

.app-main {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  z-index: 1;
}
</style>
