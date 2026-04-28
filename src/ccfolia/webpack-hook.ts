// 劫持 ccfolia webpack 5 运行时,拿到 __webpack_require__。
//
// 原理:webpack 5 把异步 chunk 数组挂到 `self.webpackChunkccfolia` 上。
// 主 bundle 先写这个全局,然后调用其 push。我们在 document-start 时
// 把这个 key 变成一个 setter:ccfolia 第一次写时我们替换 push,再推一个
// 假 chunk 让 webpack 把 require 回调给我们。
//
// 必须在 `run-at: document-start` 且主 bundle 尚未加载前安装。
//
// 拿到 __webpack_require__ 之后按函数源码指纹扫 wreq.m:
//   - firebase/app 模块 — 提供 getApp + _getProvider
//   - firebase/firestore 模块 — 提供 doc / setDoc / serverTimestamp 等
// 用 `_getProvider(app, "firestore").getImmediate({identifier:"(default)"})`
// 拿 ccfolia 自己初始化的 db 实例(getFirestore 被 tree-shake 掉了,不能用)。

import { createLogger } from '@/infra/log'

declare const unsafeWindow: Window & typeof globalThis

const log = createLogger('webpack')

type AnyFn = (...args: unknown[]) => unknown
type WebpackFactory = (mod: { exports: unknown }, exports: unknown, req: WebpackRequire) => void

interface WebpackRequire {
  (id: string | number): unknown
  m?: Record<string, WebpackFactory>
}

type ChunkData = [unknown[], Record<string, WebpackFactory>, ((req: WebpackRequire) => void)?]

interface FirestoreModule {
  doc: AnyFn
  setDoc: AnyFn
  updateDoc?: AnyFn
  writeBatch?: AnyFn
  collection?: AnyFn
  serverTimestamp: AnyFn
}

interface AppModule {
  getApp: AnyFn
  // _getProvider(app, name) — Firebase SDK 内部 API,拿 ComponentContainer 的 Provider
  getProvider: AnyFn
}

export interface FirestoreApi {
  db: unknown
  firestore: FirestoreModule
  app: AppModule
}

const CHUNK_KEY = 'webpackChunkccfolia'

let wreq: WebpackRequire | null = null
let api: FirestoreApi | null = null
const apiListeners = new Set<(a: FirestoreApi) => void>()

export function initWebpackHook() {
  const w = unsafeWindow

  // ccfolia bundle 可能已经加载(热刷/开发时),先看全局有没有
  const existing = (w as unknown as Record<string, ChunkData[] | undefined>)[CHUNK_KEY]
  if (Array.isArray(existing)) {
    log.info('chunk array already present, injecting late', { existingLen: existing.length })
    injectFakeChunk(existing)
    return
  }

  // 正常路径:ccfolia 还没写 key,先装 setter
  try {
    Object.defineProperty(w, CHUNK_KEY, {
      configurable: true,
      set(chunkArr: ChunkData[]) {
        log.info('chunk setter fired', { chunkLen: chunkArr.length })
        Object.defineProperty(w, CHUNK_KEY, {
          value: chunkArr,
          writable: true,
          configurable: true,
        })
        injectFakeChunk(chunkArr)
      },
      get() {
        return undefined
      },
    })
    log.debug('setter installed on webpackChunkccfolia')
  }
  catch (e) {
    log.error('failed to install chunk setter (ccfolia loaded first?)', e)
  }
}

// 推一个假 chunk。webpack 看到它就会调用我们的 factory,把 __webpack_require__ 传进来。
// 标识 chunk id 用 Symbol 避免撞车。
function injectFakeChunk(chunkArr: ChunkData[]) {
  const fakeId = Symbol('ccs-hook')
  // [chunkIds, moreModules, runtime(req)]
  chunkArr.push([
    [fakeId as unknown as string],
    {},
    (req) => {
      wreq = req
      log.info('__webpack_require__ captured', { modules: Object.keys(req.m ?? {}).length })
      // 第一次扫通常是空的:webpack 刚安装模块工厂,还没执行到 initializer。
      // 用退避重试,直到找到或次数耗尽。
      scheduleScan()
    },
  ])
}

const SCAN_DELAYS = [0, 50, 150, 400, 1000, 2000, 5000, 10000, 20000]

function scheduleScan(idx = 0) {
  if (api)
    return
  if (idx >= SCAN_DELAYS.length) {
    log.error('scan gave up — firebase SDK not located', { attempts: SCAN_DELAYS.length })
    return
  }
  window.setTimeout(() => {
    let done = false
    try {
      done = scanModules(idx)
    }
    catch (e) {
      // 不让异常炸 ccfolia 的 JSONP 栈
      log.error('scanModules threw', e)
    }
    if (!done)
      scheduleScan(idx + 1)
  }, SCAN_DELAYS[idx])
}

// 扫 wreq.m 里的 factory 源码找 firestore / app 两个模块。
// 这个 webpack 构建不挂 wreq.c(模块 cache 在 runtime 闭包里),
// 但 wreq(id) 对已执行模块走私有 cache,不重跑 factory,成本很低。
function scanModules(attempt: number): boolean {
  if (!wreq)
    return false
  const factories = wreq.m ?? {}

  // 按 factory 源码关键词预筛,省得把 800+ 个模块都 require 一遍
  const fsCandidates: string[] = []
  const appCandidates: string[] = []
  for (const id in factories) {
    let src = ''
    try {
      src = factories[id].toString()
    }
    catch { continue }
    if (src.includes('"setDoc"') || src.includes('initializeFirestore'))
      fsCandidates.push(id)
    if (src.includes('"no-app"'))
      appCandidates.push(id)
  }

  let foundFs: FirestoreModule | null = null
  let foundAppMod: AppModule | null = null

  for (const id of fsCandidates) {
    if (foundFs)
      break
    try {
      const m = matchFirestoreExports(wreq(id) as Record<string, unknown>)
      if (m)
        foundFs = m
    }
    catch { /* ignore */ }
  }

  for (const id of appCandidates) {
    if (foundAppMod)
      break
    try {
      const m = matchAppExports(wreq(id) as Record<string, unknown>)
      if (m)
        foundAppMod = m
    }
    catch { /* ignore */ }
  }

  if (!foundFs || !foundAppMod) {
    log.debug('scan miss', {
      attempt,
      fsCandidates: fsCandidates.length,
      appCandidates: appCandidates.length,
      foundFs: !!foundFs,
      foundAppMod: !!foundAppMod,
    })
    return false
  }

  // ccfolia 用 initializeFirestore 初始化了默认实例。绕开 getFirestore
  // (tree-shake 掉了),直接从 component provider 拿已存在的 db。
  let db: unknown
  try {
    const app = foundAppMod.getApp()
    const provider = foundAppMod.getProvider(app, 'firestore') as {
      getImmediate: (opts: { identifier: string }) => unknown
    }
    db = provider.getImmediate({ identifier: '(default)' })
  }
  catch (e) {
    log.warn('getImmediate(firestore) failed — retrying', e)
    return false
  }
  if (!db || typeof db !== 'object') {
    log.warn('getImmediate returned non-object', { db })
    return false
  }

  api = { db, firestore: foundFs, app: foundAppMod }
  log.info('firebase SDK api ready', { attempt })
  apiListeners.forEach(l => l(api!))
  apiListeners.clear()
  return true
}

export function getFirestoreApi(): FirestoreApi | null {
  return api
}

export function onFirestoreApiReady(cb: (a: FirestoreApi) => void): () => void {
  if (api) {
    cb(api)
    return () => {}
  }
  apiListeners.add(cb)
  return () => apiListeners.delete(cb)
}

// 按函数体源码指纹识别 firebase/firestore 的导出。
// terser 把 export 名 mangle 成两字母,但函数内部的字符串字面量(如 "setDoc"
// "doc","path" "serverTimestamp")和 Firebase SDK 内部 helper 调用模式保留。
function matchFirestoreExports(exp: Record<string, unknown>): FirestoreModule | null {
  if (!exp || typeof exp !== 'object')
    return null

  const fns: Array<[string, string]> = []
  for (const k of Object.keys(exp)) {
    const v = exp[k]
    if (typeof v === 'function') {
      try {
        fns.push([k, (v as () => unknown).toString()])
      }
      catch { /* ignore */ }
    }
  }

  const pick = (test: (src: string) => boolean): string | null => {
    for (const [k, s] of fns) {
      if (test(s))
        return k
    }
    return null
  }

  const docKey = pick(s => s.includes('"doc"') && s.includes('"path"'))
  const setDocKey = pick(s => s.includes('"setDoc"'))
  const collectionKey = pick(s => s.includes('"collection"') && s.includes('"path"'))
  const serverTimestampKey = pick(s => s.includes('"serverTimestamp"'))
  const updateDocKey = pick(s => s.includes('"updateDoc"'))
  // writeBatch 没稳定字串;源码形如 `new X(e, t => Y(e, t))`
  const writeBatchKey = pick(s => /new [A-Za-z_$]{1,4}\(e,\s*t=>[a-zA-Z_$]{1,4}\(e,t\)\)/.test(s))

  if (!docKey || !setDocKey || !serverTimestampKey)
    return null

  return {
    doc: exp[docKey] as AnyFn,
    setDoc: exp[setDocKey] as AnyFn,
    serverTimestamp: exp[serverTimestampKey] as AnyFn,
    collection: collectionKey ? (exp[collectionKey] as AnyFn) : undefined,
    updateDoc: updateDocKey ? (exp[updateDocKey] as AnyFn) : undefined,
    writeBatch: writeBatchKey ? (exp[writeBatchKey] as AnyFn) : undefined,
  }
}

// 按函数体源码指纹识别 firebase/app 的 getApp + _getProvider。
// getApp: `D.create("no-app",{appName:e})` 是错误路径字面量。
// _getProvider: `e.container.getProvider(t)` —
// 接 app + component name 返 Provider,我们用它绕开 tree-shaken 的 getFirestore。
function matchAppExports(exp: Record<string, unknown>): AppModule | null {
  if (!exp || typeof exp !== 'object')
    return null

  let getApp: AnyFn | null = null
  let getProvider: AnyFn | null = null

  for (const k of Object.keys(exp)) {
    const v = exp[k]
    if (typeof v !== 'function')
      continue
    let src = ''
    try {
      src = (v as () => unknown).toString()
    }
    catch { continue }
    if (!getApp && src.includes('"no-app"') && src.includes('appName'))
      getApp = v as AnyFn
    if (!getProvider && src.includes('container.getProvider'))
      getProvider = v as AnyFn
  }

  if (!getApp || !getProvider)
    return null
  return { getApp, getProvider }
}
