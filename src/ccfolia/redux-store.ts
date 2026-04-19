// 从 React fiber 里挖 react-redux 的 store。
//
// react-redux 的 <Provider store={...}> 组件会把 store 塞到自己 fiber 的
// memoizedProps.store 上。任何一个挂在 #root 下的 DOM 节点,向上走
// fiber.return 链都会路过 Provider。命中后 cache,后续直接返。
//
// 为什么不走 window 全局? ccfolia 没暴露 store,webpack 把 __webpack_require__
// mangle 成局部变量,外面够不着。fiber 爬虫是已验证可行的方案(fiber-reader
// 已经这么拿 character)。

import { createLogger } from '@/infra/log'

type FiberNode = any

declare const unsafeWindow: Window & typeof globalThis

const log = createLogger('redux')

export interface CcfoliaStore {
  dispatch: (action: unknown) => unknown
  getState: () => unknown
  subscribe: (listener: () => void) => () => void
}

let cachedStore: CcfoliaStore | null = null

interface ReduxDebug {
  searched: number
  found: number
  dispatched: number
  lastType?: string
  lastAction?: unknown
  lastError?: string
  store?: CcfoliaStore | null
}
const debug: ReduxDebug = { searched: 0, found: 0, dispatched: 0 }
try {
  ;(unsafeWindow as unknown as { __CCS_REDUX__?: unknown }).__CCS_REDUX__ = debug
}
catch { /* ignore */ }

function isStore(v: unknown): v is CcfoliaStore {
  return !!v
    && typeof v === 'object'
    && typeof (v as CcfoliaStore).dispatch === 'function'
    && typeof (v as CcfoliaStore).getState === 'function'
    && typeof (v as CcfoliaStore).subscribe === 'function'
}

function getFiber(el: Element): FiberNode | null {
  const key = Object.keys(el).find(k => k.startsWith('__reactFiber'))
  return key ? (el as unknown as Record<string, FiberNode>)[key] ?? null : null
}

// 从一个 fiber 往 root 爬,沿途看 memoizedProps.store。
// Provider 一般离根很近,guard 200 绰绰有余。
function walkUpForStore(start: FiberNode): CcfoliaStore | null {
  let fiber: FiberNode = start
  let guard = 0
  while (fiber && guard < 200) {
    const props = fiber.memoizedProps
    if (props && typeof props === 'object' && isStore(props.store))
      return props.store
    fiber = fiber.return
    guard++
  }
  return null
}

// 外部入口:拿 store,cached 或现找。
// 找不到返 null,调用方负责 fallback。
export function getReduxStore(): CcfoliaStore | null {
  if (cachedStore)
    return cachedStore
  debug.searched++
  // ccfolia 的桌面节点总是最好的起点 — 它们肯定在 Provider 下。
  // 退而求其次扫所有带 fiber 的元素,选离根最近的那个(Provider 一定在通路上)。
  const tried = new Set<Element>()
  const candidates: Element[] = []
  for (const sel of ['.movable', '#root', 'body > div']) {
    for (const el of document.querySelectorAll(sel)) {
      if (!tried.has(el)) {
        tried.add(el)
        candidates.push(el)
      }
    }
  }

  for (const el of candidates) {
    const fiber = getFiber(el)
    if (!fiber)
      continue
    const store = walkUpForStore(fiber)
    if (store) {
      cachedStore = store
      debug.found++
      debug.store = store
      log.info('redux store located', { via: el.tagName.toLowerCase() })
      return store
    }
  }
  return null
}

// 乐观更新角色:直接写 store。Firestore onSnapshot 之后会再刷一次同值,幂等。
// character/update 对应 createEntitySliceGroupBy 自动生成的 reducer,
// payload 是 { id, entity }(entity 是完整替换,不是浅合并)。
export function optimisticUpdateCharacter(char: { _id: string } & Record<string, unknown>): boolean {
  const store = getReduxStore()
  if (!store)
    return false
  const action = {
    type: 'character/update',
    payload: { id: char._id, entity: char },
  }
  debug.lastType = action.type
  debug.lastAction = action
  try {
    store.dispatch(action)
    debug.dispatched++
    return true
  }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    debug.lastError = msg
    log.error('dispatch failed', { action: action.type, error: msg })
    return false
  }
}
