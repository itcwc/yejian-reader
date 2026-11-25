import type { Preferences, ThemeId } from '@/types'

const KEY = 'yejian.preferences.v1'

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'paper',
  readerTheme: 'paper',
  readingMode: 'paged',
  fontSize: 19,
  lineHeight: 1.95,
  fontKind: 'serif',
  contentWidth: 720,
  pdfInvert: true,
  comicSpread: false,
  tapGuide: true,
}

export const THEME_META: Record<
  ThemeId,
  { label: string; caption: string; swatch: string; color: string; readerColor: string }
> = {
  paper: {
    label: '白纸',
    caption: '温和米白，长读不刺眼',
    swatch: '#f2efe6',
    color: '#f2efe6',
    readerColor: '#f7f4ea',
  },
  night: {
    label: '夜读',
    caption: '低亮深墨，暗处不扰人',
    swatch: '#141814',
    color: '#101311',
    readerColor: '#121612',
  },
  green: {
    label: '护眼',
    caption: '低饱和绿，缓解视疲劳',
    swatch: '#dbe8d4',
    color: '#dbe8d4',
    readerColor: '#e3eedb',
  },
}

export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_PREFERENCES }
    const parsed = JSON.parse(raw) as Partial<Preferences>
    const merged = { ...DEFAULT_PREFERENCES, ...parsed }
    // 旧版本只有应用主题，首次升级时让阅读主题跟随它，避免阅读器突然变成白纸。
    if (!parsed.readerTheme) merged.readerTheme = merged.theme
    return merged
  } catch {
    return { ...DEFAULT_PREFERENCES }
  }
}

export function savePreferences(prefs: Preferences): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    /* 存储不可用时静默失败 */
  }
}

export function applyTheme(theme: ThemeId): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_META[theme].color)
}

export function initTheme(): void {
  applyTheme(loadPreferences().theme)
}

export function readerFontStack(kind: Preferences['fontKind']): string {
  return kind === 'serif'
    ? '"Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", "STSong", "SimSun", serif'
    : '"PingFang SC", "HarmonyOS Sans SC", "MiSans", "Source Han Sans SC", "Microsoft YaHei", sans-serif'
}
