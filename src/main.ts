import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { createApp } from 'vue'
import App from './App.vue'
import { initTokenSniffer } from './ccfolia/token-sniffer'
import { initWebpackHook } from './ccfolia/webpack-hook'
import { createShadowMount } from './infra/shadow-mount'
// UnoCSS 入口:触发 CSS 生成;vite-plugin-monkey 的 cssSideEffects
// 钩子把生成的 CSS 堆到 window.__CCS_CSS__,在 Shadow DOM 内注入。
import 'virtual:uno.css'

// 必须在 ccfolia 主 bundle 加载前:把 webpackChunkccfolia 的 setter 装上,
// 才能在第一次 push 时塞假 chunk 拿到 __webpack_require__。
initWebpackHook()

// 必须最先执行:ccfolia 首次 Firestore write 可能早于 load 事件,
// 我们要包住 window.fetch 才能捕获 streamToken。
initTokenSniffer()

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
