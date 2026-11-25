import { ref } from 'vue'
import messages from './messages.json'

export const LANGUAGES = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'hi', name: 'हिंदी' },
  { code: 'pt', name: 'Português' },
  { code: 'id', name: 'Indonesian' },
  { code: 'en', name: 'English' },
  { code: 'tr', name: 'Türkçe' },
] as const

export type Locale = (typeof LANGUAGES)[number]['code']
const storageKey = 'yejian.locale.v1'

export function isLocale(value: unknown): value is Locale {
  return LANGUAGES.some(({ code }) => code === value)
}

function loadLocale(): Locale | null {
  try {
    const value = localStorage.getItem(storageKey)
    return isLocale(value) ? value : null
  } catch {
    return null
  }
}

export const locale = ref<Locale>('zh-CN')
export const hasSelectedLocale = ref(false)
const saved = loadLocale()
if (saved) {
  locale.value = saved
  hasSelectedLocale.value = true
}

export function suggestedLocale(languages: readonly string[]): Locale {
  for (const value of languages) {
    const code = value.toLowerCase()
    if (code === 'zh' || code.startsWith('zh-')) return 'zh-CN'
    const base = code.split('-')[0]
    if (isLocale(base)) return base
    if (base === 'in') return 'id'
  }
  return 'en'
}

export function setLocale(value: Locale) {
  locale.value = value
  hasSelectedLocale.value = true
  try {
    localStorage.setItem(storageKey, value)
  } catch {
    /* Keep the user's choice for this session. */
  }
}

type TranslatedLocale = Exclude<Locale, 'zh-CN'>
const dictionary: Record<string, Partial<Record<TranslatedLocale, string>>> = messages

export function t(message: string, args: unknown[] = []): string {
  const current = locale.value
  const translated = current === 'zh-CN' ? message : dictionary[message]?.[current] ?? message
  return translated.replace(/\{(\d+)\}/g, (token, index: string) =>
    Number(index) < args.length ? String(args[Number(index)] ?? '') : token,
  )
}
