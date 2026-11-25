<script setup lang="ts">
import { computed, ref } from 'vue'
import { LANGUAGES, suggestedLocale, setLocale, type Locale } from '@/core/i18n'

const selected = ref<Locale>(suggestedLocale(navigator.languages))
const wording = {
  'zh-CN': ['选择语言', '之后可以在设置中更改。', '继续'],
  hi: ['भाषा चुनें', 'आप बाद में सेटिंग्स में भाषा बदल सकते हैं।', 'जारी रखें'],
  pt: ['Escolha o idioma', 'Pode alterá-lo mais tarde nas definições.', 'Continuar'],
  id: ['Pilih bahasa', 'Anda dapat mengubahnya nanti di Pengaturan.', 'Lanjutkan'],
  en: ['Choose your language', 'You can change it later in Settings.', 'Continue'],
  tr: ['Dilinizi seçin', 'Daha sonra Ayarlar’dan değiştirebilirsiniz.', 'Devam et'],
}
const copy = computed(() => wording[selected.value])
</script>

<template>
  <main class="welcome" :lang="selected">
    <form class="language-card" @submit.prevent="setLocale(selected)">
      <p class="welcome-brand">Yejian · 页间</p>
      <h1>{{ copy[0] }}</h1>
      <p class="welcome-note">{{ copy[1] }}</p>
      <fieldset>
        <legend class="visually-hidden">{{ copy[0] }}</legend>
        <label v-for="language in LANGUAGES" :key="language.code" :lang="language.code">
          <input v-model="selected" type="radio" name="locale" :value="language.code" />
          {{ language.name }}
        </label>
      </fieldset>
      <button class="btn btn-primary" type="submit">{{ copy[2] }}</button>
    </form>
  </main>
</template>

<style scoped>
.welcome { min-height: 100%; display: grid; place-items: center; padding: 24px; overflow: auto; }
.language-card { width: min(100%, 26rem); padding: clamp(20px, 5vw, 36px); border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--surface-raised); }
.welcome-brand { color: var(--accent); font-weight: 700; margin: 0 0 12px; }
h1 { font: 700 clamp(1.7rem, 5vw, 2.3rem)/1.2 var(--font-serif); margin: 0; }
.welcome-note { margin: 10px 0 24px; color: var(--ink-soft); }
fieldset { border: 0; padding: 0; margin: 0 0 24px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
label { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--radius-sm); cursor: pointer; }
label:has(input:checked) { border-color: var(--accent); background: var(--accent-soft); }
input { accent-color: var(--accent); }
button { width: 100%; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>
