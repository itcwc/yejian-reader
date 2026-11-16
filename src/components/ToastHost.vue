<script setup lang="ts">
import { useToastStore } from '@/stores/toast'

const toast = useToastStore()
</script>

<template>
  <Teleport to="body">
    <div class="toast-host" aria-live="polite">
      <TransitionGroup name="toast">
        <div
          v-for="item in toast.items"
          :key="item.id"
          class="toast"
          :class="`tone-${item.tone}`"
          @click="toast.remove(item.id)"
        >
          <span class="toast-dot" aria-hidden="true"></span>
          <span class="toast-text">{{ item.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-host {
  position: fixed;
  left: 50%;
  bottom: max(26px, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  pointer-events: none;
  width: min(92vw, 520px);
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 100%;
  padding: 12px 18px;
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  color: var(--ink);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-md);
  font-size: 13.5px;
  line-height: 1.55;
  cursor: pointer;
}

.toast-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-top: 6px;
  flex: 0 0 auto;
  background: var(--ink-muted);
}

.tone-success {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
  background: color-mix(in srgb, var(--accent-soft) 70%, var(--surface-raised));
}

.tone-success .toast-dot {
  background: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent);
}

.tone-error {
  border-color: color-mix(in srgb, var(--danger) 42%, var(--line));
}

.tone-error .toast-dot {
  background: var(--danger);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 14%, transparent);
}

.toast-text {
  word-break: break-word;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.24s var(--ease-soft), transform 0.32s var(--ease-out);
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.97);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.98);
}

@media (max-width: 860px) {
  .toast-host {
    bottom: calc(max(12px, env(safe-area-inset-bottom)) + 76px);
  }
}
</style>
