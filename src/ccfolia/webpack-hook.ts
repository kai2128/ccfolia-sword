// 劫持 ccfolia webpack 5 运行时,拿到 __webpack_require__。
//
// 原理:webpack 5 把异步 chunk 数组挂到 `self.webpackChunkccfolia` 上。
// 主 bundle 先写这个全局,然后调用其 push。我们在 document-start 时
// 把这个 key 变成一个 setter:ccfolia 第一次写时我们替换 push,再推一个
// 假 chunk 让 webpack 把 require 回调给我们。
//
// 必须在 `run-at: document-start` 且主 bundle 尚未加载前安装。
//
// 拿到 __webpack_require__ 之后:
//   wreq.c = 已初始化模块的导出 cache (按 moduleId 索引)
//   wreq.m = 原始 factory 函数 cache
// 我们扫 wreq.c 找:
//   - ccfolia 的 `db`:Firestore 实例,有 _databaseId / type === 'firestore'
//   - firebase/firestore 模块:导出 setDoc / doc / updateDoc / writeBatch
// 两者合起来就能走 ccfolia 自己的 SDK 写入路径,完全不用 REST。

declare const unsafeWindow: Window & typeof globalThis

type AnyFn = (...args: unknown[]) => unknown
type WebpackFactory = (mod: { exports: unknown }, exports: unknown, req: WebpackRequire) => void

interface WebpackRequire {
  (id: string | number): unknown
  c?: Record<string, { exports: Record<string, unknown> }>
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

interface WebpackDebug {
  hookInstalled: boolean
  chunkSeen: number
  wreqReady: boolean
  scanAttempts: number
  dbFound: boolean
  firestoreFound: boolean
  mModulesKnown: number
  dbModuleId?: string
  firestoreModuleId?: string
  wreqKeys?: string[]
  lastScanError?: string
  // 诊断:各关键词命中的 module id 列表,刷一次就 dump
  keywordHits?: Record<string, string[]>
  largestFactoryIds?: Array<{ id: string, len: number }>
  probedModules?: Record<string, { exports: string[], error?: string }>
  probedFunctions?: Record<string, Record<string, string>>
  appTried?: Array<{ id: string, matched: boolean, fns: string[] }>
}
const debug: WebpackDebug = {
  hookInstalled: false,
  chunkSeen: 0,
  wreqReady: false,
  scanAttempts: 0,
  dbFound: false,
  firestoreFound: false,
  mModulesKnown: 0,
}

export function initWebpackHook() {
  const w = unsafeWindow
  ;(w as unknown as { __CCS_WEBPACK__?: unknown }).__CCS_WEBPACK__ = debug

  // ccfolia bundle 可能已经加载(热刷/开发时),先看全局有没有
  const existing = (w as unknown as Record<string, ChunkData[] | undefined>)[CHUNK_KEY]
  if (Array.isArray(existing)) {
    debug.chunkSeen = existing.length
    wrapPush(existing)
    injectFakeChunk(existing)
    return
  }

  // 正常路径:ccfolia 还没写 key,先装 setter
  try {
    Object.defineProperty(w, CHUNK_KEY, {
      configurable: true,
      set(chunkArr: ChunkData[]) {
        debug.chunkSeen++
        // 把 key 变成普通属性,后续不再触发 setter
        Object.defineProperty(w, CHUNK_KEY, {
          value: chunkArr,
          writable: true,
          configurable: true,
        })
        wrapPush(chunkArr)
        injectFakeChunk(chunkArr)
      },
      get() {
        return undefined
      },
    })
    debug.hookInstalled = true
  }
  catch {
    // 多半是 ccfolia 比我们早到;此时走 existing 路径也行,但已经晚了
  }
}

function wrapPush(chunkArr: ChunkData[]) {
  const origPush = chunkArr.push.bind(chunkArr)
  chunkArr.push = (...items: ChunkData[]) => {
    return origPush(...items)
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
      debug.wreqReady = true
      try {
        debug.wreqKeys = Object.keys(req as unknown as object)
      }
      catch { /* ignore */ }
      // 第一次扫通常是空的:webpack 刚安装模块工厂,还没执行到 initializer。
      // 用退避重试,直到 db+firestore 都找到或次数耗尽。
      scheduleScan()
    },
  ])
}

// 重试调度:先 rAF,再 100ms/500ms 梯度,最后每 1s 兜底直到 30s。
// 全包 try/catch,绝不让异常冒出去炸 ccfolia 的 JSONP 栈。
const SCAN_DELAYS = [0, 50, 150, 400, 1000, 2000, 5000, 10000, 20000]

function scheduleScan(idx = 0) {
  if (api)
    return
  if (idx >= SCAN_DELAYS.length)
    return
  window.setTimeout(() => {
    let done = false
    try {
      done = scanModules()
    }
    catch (e) {
      debug.lastScanError = e instanceof Error ? e.message : String(e)
    }
    if (!done)
      scheduleScan(idx + 1)
  }, SCAN_DELAYS[idx])
}

function scanModules(): boolean {
  if (!wreq)
    return false
  debug.scanAttempts++
  const factories = wreq.m ?? {}
  debug.mModulesKnown = Object.keys(factories).length

  // 每次扫都 probe 嫌疑 module(已 require 过的走闭包 cache,成本很低),
  // 这样不用等最后一次触发。
  if (!debug.probedModules) {
    debug.probedModules = {}
    debug.probedFunctions = {}
    const probeIds = ['49631', '67825', '72685', '1069']
    for (const id of probeIds) {
      try {
        const exp = wreq(id) as Record<string, unknown>
        const keys = exp && typeof exp === 'object' ? Object.keys(exp).slice(0, 40) : []
        debug.probedModules[id] = { exports: keys }
        const fns: Record<string, string> = {}
        if (exp && typeof exp === 'object') {
          for (const k of keys) {
            const v = exp[k]
            if (typeof v === 'function') {
              try {
                fns[k] = (v as () => unknown).toString().slice(0, 180)
              }
              catch { /* ignore */ }
            }
            else if (v && typeof v === 'object') {
              fns[k] = `[object ${(v as object).constructor?.name ?? '?'}]`
            }
            else {
              fns[k] = typeof v
            }
          }
        }
        debug.probedFunctions[id] = fns
      }
      catch (e) {
        debug.probedModules[id] = { exports: [], error: (e as Error).message }
      }
    }
  }

  // 只在第一次扫时 dump 诊断(避免重复算开销)
  if (debug.scanAttempts === 1) {
    try {
      const hits: Record<string, string[]> = {
        initializeFirestore: [],
        initializeApp: [],
        firestore: [],
        setDoc: [],
        writeBatch: [],
        onSnapshot: [],
        firebaseApp: [],
        DocumentReference: [],
        'no-app': [],
        appName: [],
        getImmediate: [],
      }
      const sizes: Array<{ id: string, len: number }> = []
      for (const id in factories) {
        let src = ''
        try {
          src = factories[id].toString()
        }
        catch { continue }
        sizes.push({ id, len: src.length })
        for (const kw of Object.keys(hits)) {
          if (src.includes(kw))
            hits[kw].push(id)
        }
      }
      // 每个关键词只留前 15 个 id,避免噪声(太少会漏真正的目标模块)
      for (const kw of Object.keys(hits))
        hits[kw] = hits[kw].slice(0, 15)
      debug.keywordHits = hits
      sizes.sort((a, b) => b.len - a.len)
      debug.largestFactoryIds = sizes.slice(0, 5)
    }
    catch { /* ignore */ }
  }
  // 这个 webpack 构建不挂 wreq.c(模块 cache 是 runtime 的闭包私有),
  // 所以我们靠 factory.toString() 扫关键词找模块,再 wreq(id) 取 exports。
  // wreq(id) 对已执行模块走私有 cache,不会重跑 factory。

  // 按函数源码指纹识别(terser 对 export 名做了 property mangling,
  // 但函数体里的 string literal 和内部函数名保留)。
  let foundFs: FirestoreModule | null = null
  let foundAppMod: AppModule | null = null
  let fsId: string | undefined
  let appId: string | undefined

  // 遍历 keywordHits 命中的嫌疑 module,而不是 803 个全试 — 省时省力
  const firestoreCandidates = new Set<string>([
    ...(debug.keywordHits?.initializeFirestore ?? []),
    ...(debug.keywordHits?.setDoc ?? []),
    ...(debug.keywordHits?.onSnapshot ?? []),
  ])
  // getApp 本体在 firebase/app 模块;用 `"no-app"` 最稳 — 这是 getApp
  // 错误路径的字面量。initializeApp 关键词可能只命中调用方(initializer.ts)
  // 而不是 firebase/app 本体,所以别靠它。
  const appCandidates = new Set<string>([
    ...(debug.keywordHits?.['no-app'] ?? []),
    ...(debug.keywordHits?.appName ?? []),
    ...(debug.keywordHits?.initializeApp ?? []),
  ])

  for (const id of firestoreCandidates) {
    if (foundFs)
      break
    try {
      const exp = wreq(id) as Record<string, unknown>
      const fs = matchFirestoreExports(exp)
      if (fs) {
        foundFs = fs
        fsId = id
      }
    }
    catch (e) {
      debug.lastScanError = `require firestore ${id}: ${(e as Error).message}`
    }
  }

  if (!debug.appTried)
    debug.appTried = []
  for (const id of appCandidates) {
    if (foundAppMod)
      break
    try {
      const exp = wreq(id) as Record<string, unknown>
      const m = matchAppExports(exp)
      // 诊断:记录每个候选模块的导出名,看哪个是 firebase/app
      const fns: string[] = []
      if (exp && typeof exp === 'object') {
        for (const k of Object.keys(exp)) {
          if (typeof (exp as Record<string, unknown>)[k] === 'function')
            fns.push(k)
        }
      }
      debug.appTried.push({ id, matched: !!m, fns: fns.slice(0, 30) })
      if (m) {
        foundAppMod = m
        appId = id
      }
    }
    catch (e) {
      debug.lastScanError = `require app ${id}: ${(e as Error).message}`
    }
  }

  let foundDb: unknown = null
  if (foundAppMod && foundFs) {
    try {
      const app = foundAppMod.getApp()
      // ccfolia 用 initializeFirestore 初始化了默认实例。绕开 getFirestore
      // (tree-shake 掉了),直接从 component provider 拿。
      const provider = foundAppMod.getProvider(app, 'firestore') as {
        getImmediate: (opts: { identifier: string }) => unknown
      }
      const db = provider.getImmediate({ identifier: '(default)' })
      if (db && typeof db === 'object')
        foundDb = db
    }
    catch (e) {
      debug.lastScanError = `provider.getImmediate(firestore): ${(e as Error).message}`
    }
  }
  const dbId = foundDb ? `${appId}→${fsId}` : undefined

  if (foundDb) {
    debug.dbFound = true
    debug.dbModuleId = dbId
  }
  if (foundFs) {
    debug.firestoreFound = true
    debug.firestoreModuleId = fsId
  }

  if (foundDb && foundFs && foundAppMod) {
    api = { db: foundDb, firestore: foundFs, app: foundAppMod }
    try {
      ;(unsafeWindow as unknown as { __CCS_DB__?: unknown, __CCS_FS__?: unknown }).__CCS_DB__ = foundDb
      ;(unsafeWindow as unknown as { __CCS_DB__?: unknown, __CCS_FS__?: unknown }).__CCS_FS__ = foundFs
    }
    catch { /* ignore */ }
    apiListeners.forEach(l => l(api!))
    apiListeners.clear()
    return true
  }
  return false
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
// 升级 Firebase SDK 也不怕 — 这些 marker 是它家代码稳定特征。
function matchFirestoreExports(exp: Record<string, unknown>): FirestoreModule | null {
  if (!exp || typeof exp !== 'object')
    return null

  const fns: Array<[string, string]> = []
  for (const k of Object.keys(exp)) {
    const v = exp[k]
    if (typeof v === 'function') {
      try { fns.push([k, (v as () => unknown).toString()]) }
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
  // writeBatch 没稳定字串,但它是接 firestore 返 WriteBatch;优先找源码含 "WriteBatch" 或 ".commit"
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
// getApp:`D.create("no-app",{appName:e})` 是错误路径字面量。
// _getProvider:`e.container.getProvider(t)` — 接 app 对象 + component name,
// 返 ComponentContainer 的 Provider。我们用它绕开 tree-shaken 的 getFirestore,
// 直接 `provider.getImmediate({identifier:"(default)"})` 拿 ccfolia 那份 db。
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
    try { src = (v as () => unknown).toString() }
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
