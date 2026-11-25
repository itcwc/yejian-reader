import { t } from '@/core/i18n'
import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import type { SyncConfig, SyncSummary } from '@/types'
import { getDeviceInfo, renameDevice } from '@/core/device'
import { runSync } from '@/core/sync'
import { WebdavClient, WebdavError } from '@/core/webdav'
import { useLibraryStore } from './library'
import { useToastStore } from './toast'

const CONFIG_KEY = 'yejian.sync.v1'
const RESULT_KEY = 'yejian.sync.last.v1'

function loadConfig(): SyncConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) return { ...defaults(), ...(JSON.parse(raw) as Partial<SyncConfig>) }
  } catch {
    /* 忽略损坏配置 */
  }
  return defaults()
}

function defaults(): SyncConfig {
  return { url: '', username: '', password: '', autoSync: false, syncBooks: true }
}

function loadResult(): SyncSummary | null {
  try {
    const raw = localStorage.getItem(RESULT_KEY)
    return raw ? (JSON.parse(raw) as SyncSummary) : null
  } catch {
    return null
  }
}

export interface SyncLog {
  time: number
  text: string
  tone: 'info' | 'error' | 'success'
}

export const useSyncStore = defineStore('sync', () => {
  const toast = useToastStore()
  const config = reactive<SyncConfig>(loadConfig())
  const device = ref(getDeviceInfo())
  const syncing = ref(false)
  const lastResult = ref<SyncSummary | null>(loadResult())
  const logs = ref<SyncLog[]>([])
  let autoTimer: number | null = null

  const configured = computed(() => Boolean(config.url.trim()))
  const canAutoSync = computed(() => configured.value && config.autoSync)

  watch(
    config,
    () => {
      try {
        localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
      } catch {
        /* 忽略存储失败 */
      }
    },
    { deep: true },
  )

  function log(text: string, tone: SyncLog['tone'] = 'info') {
    logs.value = [...logs.value.slice(-39), { time: Date.now(), text, tone }]
  }

  function updateDeviceName(name: string) {
    device.value = renameDevice(name)
  }

  async function testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      if (!config.url.trim()) return { ok: false, message: t('请先填写 WebDAV 服务器地址') }
      const client = new WebdavClient(config)
      await client.test()
      await client.ensureCollection('yejian')
      await client.ensureCollection('yejian/books')
      return { ok: true, message: t('连接成功，同步目录可写') }
    } catch (error) {
      const message = error instanceof WebdavError ? error.message : t('连接失败，请检查配置')
      return { ok: false, message }
    }
  }

  async function syncNow(silent = false): Promise<SyncSummary | null> {
    if (syncing.value) return null
    if (!configured.value) {
      if (!silent) toast.push(t('请先在同步设置中填写 WebDAV 地址'), 'error')
      return null
    }
    syncing.value = true
    logs.value = []
    log(t('开始同步'))
    try {
      const result = await runSync(config, {
        onStage: (stage) => log(stage),
      })
      lastResult.value = result
      if (result.ok) await useLibraryStore().refresh()
      try {
        localStorage.setItem(RESULT_KEY, JSON.stringify(result))
      } catch {
        /* 忽略存储失败 */
      }
      log(result.message, result.ok ? 'success' : 'error')
      if (!silent) {
        toast.push(result.ok ? t('同步完成：{0}', [result.message]) : t('同步失败：{0}', [result.message]), result.ok ? 'success' : 'error', 4200)
      }
      return result
    } finally {
      syncing.value = false
    }
  }

  function scheduleAutoSync(delay = 5000) {
    if (!canAutoSync.value) return
    if (autoTimer) window.clearTimeout(autoTimer)
    autoTimer = window.setTimeout(() => {
      autoTimer = null
      void syncNow(true)
    }, delay)
  }

  return {
    config,
    device,
    syncing,
    lastResult,
    logs,
    configured,
    canAutoSync,
    testConnection,
    syncNow,
    scheduleAutoSync,
    updateDeviceName,
    log,
  }
})
