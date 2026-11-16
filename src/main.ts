import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { initTheme } from './core/preferences'
import './styles/tokens.css'
import './styles/base.css'

initTheme()

createApp(App).use(createPinia()).use(router).mount('#app')
