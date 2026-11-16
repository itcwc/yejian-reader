<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import Icon from './Icon.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    subtitle?: string
    width?: string
    showClose?: boolean
  }>(),
  { title: '', subtitle: '', width: '520px', showClose: true },
)

const emit = defineEmits<{ close: [] }>()

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open) emit('close')
}

watch(
  () => props.open,
  (open) => {
    document.documentElement.style.overflow = open ? 'hidden' : ''
  },
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.documentElement.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-root" @click.self="emit('close')">
        <div class="modal-panel" :style="{ maxWidth: width }" role="dialog" aria-modal="true">
          <header v-if="title || $slots.header" class="modal-head">
            <div class="modal-head-text">
              <slot name="header">
                <span class="modal-subtitle">{{ subtitle }}</span>
                <h2 class="modal-title">{{ title }}</h2>
              </slot>
            </div>
            <button v-if="showClose" class="icon-btn" type="button" aria-label="关闭" @click="emit('close')">
              <Icon name="x" :size="18" />
            </button>
          </header>

          <div class="modal-body">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="modal-foot">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-root {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--scrim);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.modal-panel {
  width: 100%;
  max-height: min(86vh, 880px);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.modal-head {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 22px 24px 16px;
  border-bottom: 1px solid var(--line);
}

.modal-head-text {
  flex: 1;
  min-width: 0;
}

.modal-subtitle {
  display: block;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-muted);
  margin-bottom: 4px;
}

.modal-title {
  font-family: var(--font-serif);
  font-size: 21px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.35;
}

.modal-body {
  padding: 22px 24px;
  overflow-y: auto;
}

.modal-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--line);
  background: var(--surface-soft);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.22s var(--ease-soft);
}

.modal-enter-active .modal-panel,
.modal-leave-active .modal-panel {
  transition: transform 0.34s var(--ease-out), opacity 0.24s var(--ease-soft);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-panel,
.modal-leave-to .modal-panel {
  opacity: 0;
  transform: translateY(16px) scale(0.98);
}

@media (max-width: 600px) {
  .modal-root {
    padding: 14px;
    align-items: flex-end;
  }

  .modal-panel {
    max-height: 90vh;
    border-radius: var(--radius-lg);
  }
}
</style>
