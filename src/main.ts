import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import './style.css'
import App from './App.vue'
import { i18n } from './i18n'

registerSW({ immediate: true })

createApp(App).use(i18n).mount('#app')
