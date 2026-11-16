import type { DeviceInfo } from '@/types'

const KEY = 'yejian.device.v1'

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
  const info = { ...getDeviceInfo(), name: name.trim() || getDeviceInfo().name }
  try {
    localStorage.setItem(KEY, JSON.stringify(info))
  } catch {
    /* 忽略存储失败 */
  }
  return info
}
