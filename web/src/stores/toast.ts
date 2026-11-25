import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastTone = 'default' | 'success' | 'error'

export interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

let counter = 0

export const useToastStore = defineStore('toast', () => {
  const items = ref<ToastItem[]>([])

  function remove(id: number) {
    items.value = items.value.filter((item) => item.id !== id)
  }

  function push(message: string, tone: ToastTone = 'default', duration = 3400) {
    const id = ++counter
    items.value = [...items.value, { id, message, tone }]
    window.setTimeout(() => remove(id), duration)
  }

  return { items, push, remove }
})
