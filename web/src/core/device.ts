import type { DeviceInfo } from '@/types'
import { t } from '@/core/i18n'

const KEY = 'yejian.device.v1'
const defaultNamePattern = /^(桌面|安卓|浏览器)-([A-Z0-9]{1,4})$/

export function deviceDisplayName(device: DeviceInfo): string {
  if (device.customName) return device.name
  const generated = defaultNamePattern.exec(device.name)
  return generated ? `${t(generated[1])}-${generated[2]}` : device.name
}

function detectPlatform(): DeviceInfo['platform'] {
  if (typeof window !== 'undefined' && window.yejian?.platform === 'desktop') return 'pc'
  const ua = navigator.userAgent
  if (/Android/i.test(ua)) return 'android'
  return 'web'
}

export function getDeviceInfo(): DeviceInfo {
  const platform = detectPlatform()
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DeviceInfo
      if (parsed.name) return { ...parsed, platform }
    }
  } catch {
    /* 忽略损坏的本地值 */
  }

  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  const prefix = platform === 'pc' ? '桌面' : platform === 'android' ? '安卓' : '浏览器'
  const info: DeviceInfo = { name: `${prefix}-${suffix}`, platform }
  try {
    localStorage.setItem(KEY, JSON.stringify(info))
  } catch {
    /* 忽略存储失败 */
  }
  return info
}

export function renameDevice(name: string): DeviceInfo {
  const current = getDeviceInfo()
  const trimmed = name.trim()
  if (!trimmed) return current
  const info = { ...current, name: trimmed, customName: true }
  try {
    localStorage.setItem(KEY, JSON.stringify(info))
  } catch {
    /* 忽略存储失败 */
  }
  return info
}
