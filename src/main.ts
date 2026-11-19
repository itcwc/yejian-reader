import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { initTheme, loadPreferences, savePreferences } from './core/preferences'
import { hasSelectedLocale, isLocale, setLocale } from './core/i18n'
import './styles/tokens.css'
import './styles/base.css'

const url = new URL(window.location.href)
const language = url.searchParams.get('lang')
const theme = url.searchParams.get('theme')
if (isLocale(language)) {
  setLocale(language)
  url.searchParams.delete('lang')
} else if (import.meta.env.MODE === 'pages' && !hasSelectedLocale.value) {
  setLocale('en')
}
if (theme === 'paper' || theme === 'green' || theme === 'night') {
  savePreferences({ ...loadPreferences(), theme, readerTheme: theme })
  url.searchParams.delete('theme')
}
if (url.href !== location.href) history.replaceState(history.state, '', url)

initTheme()

createApp(App).use(createPinia()).use(router).mount('#app')
