import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { createApp } from 'vue'
import App from './App.vue'
import { usePiecesStore } from './ccfolia/pieces-store'
import { startRoomCharactersSync, useRoomCharactersStore } from './ccfolia/room-characters-store'
import { startSceneMount } from './ccfolia/scene-mount'
import { initWebpackHook } from './ccfolia/webpack-hook'
import SceneOverlayRoot from './components/scene/SceneOverlayRoot.vue'
import { PortalTargetKey } from './components/ui/portal'
import { bindHotkey } from './core/shell/hotkey'
import { installLogPanel } from './infra/log'
import { createShadowMount } from './infra/shadow-mount'
import { useSettingsStore } from './stores/settings'
// UnoCSS 入口:触发 CSS 生成;vite-plugin-monkey 的 cssSideEffects
// 钩子把生成的 CSS 堆到 window.__CCS_CSS__,在 Shadow DOM 内注入。
import 'virtual:uno.css'

// 日志面板必须最先挂 — webpack-hook 进来就要用
installLogPanel()

// 必须在 ccfolia 主 bundle 加载前:把 webpackChunkccfolia 的 setter 装上,
// 才能在第一次 push 时塞假 chunk 拿到 __webpack_require__。
initWebpackHook()

function mount() {
  const { mountPoint, portalTarget } = createShadowMount()

  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)

  const app = createApp(App)
  app.use(pinia)
  // 所有 Reka Portal 通过 inject 取这个目标,避免 overlay 逃出 Shadow DOM
  app.provide(PortalTargetKey, portalTarget)

  // pinia 挂完,把持久化的 logMaxLines 推到日志环
  const settings = useSettingsStore()
  settings.applyLogMaxLines()

  // Alt+S 切面板显隐
  bindHotkey({ alt: true, key: 's' }, () => settings.togglePanel())

  app.mount(mountPoint)

  // 启动 ccfolia Redux 订阅 + scene overlay(共享主 app 的 pinia + portalTarget,
  // 否则派生 store 看不到数据 / Reka Portal 无家可归)。
  startRoomCharactersSync()
  startSceneMount(SceneOverlayRoot, pinia, portalTarget)

  // devtools 验收桥;生产里只是几个对象引用,无运行时开销。
  // 必须 merge 而不是整体赋值 —— startSceneMount() 里 tryMount 是同步的,
  // overlay 的 SceneOverlayRoot 会先一步把 overlayPieces / overlayRoomCharacters
  // 写进 __CCS_STORES__,这里若直接 = { ... } 会把 overlay 写好的字段抹掉。
  const dbg = window as unknown as { __CCS_STORES__?: Record<string, unknown> }
  dbg.__CCS_STORES__ = {
    ...(dbg.__CCS_STORES__ ?? {}),
    roomCharacters: useRoomCharactersStore(),
    pieces: usePiecesStore(),
    settings,
  }
}

if (document.readyState === 'complete')
  mount()
else
  window.addEventListener('load', mount)
