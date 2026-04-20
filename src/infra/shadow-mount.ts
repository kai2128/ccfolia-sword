// Shadow DOM 挂载 + CSS 注入
// 详见 docs/design/02-ui-framework.md / 04-styling.md

// :host 边界 reset,防止 ccfolia 全局样式穿透。
// button/input 的重置:Shadow DOM 里 UA 默认样式还在(:host all:initial 只作用于宿主元素),
// 而 UnoCSS preflight 在 Shadow 内覆盖不全,这里显式扳回 Tailwind 风格基线,
// 避免 reka 裸 button / input 带 UA 灰白底 + 边框。
const HOST_RESET = `
:host {
  all: initial;
  font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 13px;
  line-height: 1.4;
  color: #e0e0e0;
}
*, *::before, *::after { box-sizing: border-box; }
button {
  background: transparent;
  border: 0;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
}
button:disabled { cursor: not-allowed; }
input, textarea, select {
  font: inherit;
  color: inherit;
}
`

export interface MountResult {
  host: HTMLElement
  shadow: ShadowRoot
  mountPoint: HTMLElement
  /** Reka UI Portal 组件的挂载点,留在 Shadow 内防止样式/事件逃出 */
  portalTarget: HTMLElement
}

export function createShadowMount(): MountResult {
  const host = document.createElement('div')
  host.id = 'ccs-host'
  host.style.cssText = 'position:fixed;top:0;left:0;z-index:2147483647;pointer-events:none;'
  document.body.append(host)

  const shadow = host.attachShadow({ mode: 'open' })

  const resetStyle = document.createElement('style')
  resetStyle.textContent = HOST_RESET
  shadow.append(resetStyle)

  // vite-plugin-monkey 的 cssSideEffects 钩子把所有 CSS(含 UnoCSS)
  // 堆到 window.__CCS_CSS__,这里统一注入 Shadow DOM。
  const cssChunks = (window as unknown as { __CCS_CSS__?: string[] }).__CCS_CSS__ ?? []
  if (cssChunks.length) {
    const unoStyle = document.createElement('style')
    unoStyle.textContent = cssChunks.join('\n')
    shadow.append(unoStyle)
  }

  const mountPoint = document.createElement('div')
  mountPoint.style.pointerEvents = 'auto'
  shadow.append(mountPoint)

  // Portal 挂载点:所有 Reka Portal 组件的 :to 目标。放在 mountPoint 之后,
  // 保证 overlay 天然盖在普通 UI 之上
  const portalTarget = document.createElement('div')
  portalTarget.id = 'ccs-portal'
  portalTarget.style.pointerEvents = 'auto'
  shadow.append(portalTarget)

  // React 重渲染可能卸载 host —— 监听 body 子节点变化,发现 host 不在就 re-append。
  // Shadow DOM 上挂的 Vue app 不会被销毁(re-append 保留子树),所以状态不丢。
  const observer = new MutationObserver(() => {
    if (!document.body.contains(host))
      document.body.append(host)
  })
  observer.observe(document.body, { childList: true })

  return { host, shadow, mountPoint, portalTarget }
}
