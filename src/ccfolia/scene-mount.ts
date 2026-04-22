import type { Pinia } from 'pinia'
import type { App } from 'vue'
import { createApp } from 'vue'
import { PortalTargetKey } from '@/components/ui/portal'
import { createLogger } from '@/infra/log'
import { setupShadowRoot } from '@/infra/shadow-mount'
import { autoCalibrateGrid } from './grid-detect'

const log = createLogger('scene-mount')

interface MountedOverlay {
  host: HTMLDivElement
  app: App
  rootComponent: unknown
  pinia: Pinia
  portalTarget: HTMLElement
}

let mounted: MountedOverlay | null = null
let observer: MutationObserver | null = null

// 找 ccfolia 画布容器:所有 .movable 的最深公共祖先。
// 实测该节点是 transform: scale(...) 的 camera/zoom 层。
// 没有 .movable(进房间前 / 房间还在 loading)时返 null,交给 caller 重试。
export function findCanvasContainer(): HTMLElement | null {
  const movables = document.querySelectorAll<HTMLElement>('.movable')
  if (movables.length === 0)
    return null
  let common = ancestorChain(movables[0])
  for (let i = 1; i < movables.length; i++) {
    const set = new Set(ancestorChain(movables[i]))
    common = common.filter(el => set.has(el))
    if (common.length === 0)
      return null
  }
  // common 包含 movable 自己 + 它全部祖先;我们要最深的公共祖先而不是 movable 自身,跳过所有 .movable。
  for (const el of common) {
    if (!el.classList.contains('movable'))
      return el
  }
  return null
}

function ancestorChain(el: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = []
  let cur: HTMLElement | null = el
  while (cur) {
    out.push(cur)
    cur = cur.parentElement
  }
  return out
}

// 硬约束:overlay 是独立 Vue app,必须把主 app 的 pinia 实例 + portalTarget 注进来:
//   - pinia:两个 app 共用同一 store 单例,否则派生 usePiecesStore 看不到数据。
//   - portalTarget:scene 组件里的 Tooltip/Popover 等 Reka Portal 需要一个挂载点;
//     传主 app 的 portalTarget(来自 createShadowMount())让所有 portal 渲染到同一处,
//     避免 scene 的 overlay 自己再造一个 Shadow 导致事件/样式割裂。
export function startSceneMount(
  rootComponent: unknown,
  pinia: Pinia,
  portalTarget: HTMLElement,
): void {
  if (mounted || observer)
    return
  tryMount(rootComponent, pinia, portalTarget)

  // 不要 disconnect:ccfolia 切房间 / 切场景 / 画布重建 会把 host 连窝端走,
  // 这里永久监听 body,每次 mutation 核对 host 还在不在 DOM,掉线就重新定位 canvas 再 append 回去。
  // host 和 ShadowRoot + Vue app 不动,保留 overlay 内部状态。
  observer = new MutationObserver(() => {
    if (!mounted) {
      tryMount(rootComponent, pinia, portalTarget)
      return
    }
    if (!mounted.host.isConnected) {
      const canvas = findCanvasContainer()
      if (!canvas)
        return
      canvas.appendChild(mounted.host)
      // 画布重建(切房间/切场景)大概率意味着 Field 也重绘,顺手再校准一次。
      autoCalibrateGrid(canvas, pinia)
      log.info('overlay host re-appended after canvas remount')
    }
  })
  observer.observe(document.body, { subtree: true, childList: true })
}

function tryMount(rootComponent: unknown, pinia: Pinia, portalTarget: HTMLElement): void {
  const canvas = findCanvasContainer()
  if (!canvas)
    return
  // 被动一次性校准:探到 Field 根就把 settings.grid 同步过去。场景还没渲染完时可能短路,
  // 由下面 MutationObserver 在 host 重挂时再试一次。
  autoCalibrateGrid(canvas, pinia)
  const host = document.createElement('div')
  host.setAttribute('data-ccs-overlay-root', '')
  Object.assign(host.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    pointerEvents: 'none',
    zIndex: '9999',
    width: '0',
    height: '0',
  })
  canvas.appendChild(host)

  // 复用 Panel 的 Shadow 引导(HOST_RESET + UnoCSS 注入);Scene 不自建 portal,复用主 app 的。
  const { mountPoint } = setupShadowRoot(host, { withPortalTarget: false })

  const app = createApp(rootComponent as any)
  app.use(pinia) // 同主 app 的 pinia 单例
  app.provide(PortalTargetKey, portalTarget) // 同主 app 的 portal 目标,Reka Portal 有家可归
  app.mount(mountPoint)

  mounted = { host, app, rootComponent, pinia, portalTarget }
  log.info('overlay root mounted in canvas')
}

export function stopSceneMount(): void {
  observer?.disconnect()
  observer = null
  mounted?.app.unmount()
  mounted?.host.remove()
  mounted = null
}
