import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { createApp } from 'vue'
import App from './App.vue'
import { createShadowMount } from './infra/shadow-mount'
// UnoCSS 入口:触发 CSS 生成;vite-plugin-monkey 的 cssSideEffects
// 钩子把生成的 CSS 堆到 window.__CCS_CSS__,在 Shadow DOM 内注入。
import 'virtual:uno.css'

function mount() {
  const { mountPoint } = createShadowMount()

  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)

  const app = createApp(App)
  app.use(pinia)
  app.mount(mountPoint)
}

if (document.readyState === 'complete')
  mount()
else
  window.addEventListener('load', mount)
