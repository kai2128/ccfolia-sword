// Token sniffer · 方案 γ(直接 hook unsafeWindow)
//
// Tampermonkey 在 DOM sandbox 下把页面真实 window 暴露为 unsafeWindow。
// 我们对 unsafeWindow.fetch / unsafeWindow.XMLHttpRequest.prototype 的改写
// 才会被页面内的 Firebase SDK 看到。用 script sandbox 里的 window 没用。
//
// 必须在 run-at: document-start 调用 initTokenSniffer(),否则 Firebase SDK
// 已经完成 channel 握手,后续 POST 也可能用它缓存的原始引用。

// Tampermonkey 注入到脚本作用域的全局,TS 这里声明一下。
declare const unsafeWindow: Window & typeof globalThis

export interface CcfoliaSession {
  writeChannelBase: string
  latestStreamToken: string
  maxRid: number
  maxOfs: number
}

let session: CcfoliaSession | null = null
const listeners = new Set<(s: CcfoliaSession) => void>()

const WRITE_CHANNEL_MARKER = '/google.firestore.v1.Firestore/Write/channel'

// 诊断:把每个环节的命中数挂到 unsafeWindow,方便控制台排查
interface SnifferDebug {
  fetchSeen: number
  fetchMatched: number
  xhrSeen: number
  xhrMatched: number
  skippedNoSid: number
  skippedNoData0: number
  skippedBadJson: number
  skippedNoToken: number
  captured: number
  lastUrl?: string
  lastBodyHead?: string
}
const debug: SnifferDebug = {
  fetchSeen: 0,
  fetchMatched: 0,
  xhrSeen: 0,
  xhrMatched: 0,
  skippedNoSid: 0,
  skippedNoData0: 0,
  skippedBadJson: 0,
  skippedNoToken: 0,
  captured: 0,
}

export function initTokenSniffer() {
  const w = unsafeWindow
  hookFetch(w)
  hookXhr(w)
  ;(w as unknown as { __CCS_SNIFFER__?: unknown }).__CCS_SNIFFER__ = debug
}

function hookFetch(w: Window & typeof globalThis) {
  const original = w.fetch
  w.fetch = function hookedFetch(this: unknown, ...args: Parameters<typeof fetch>) {
    try {
      debug.fetchSeen++
      const [input, init] = args
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request | undefined)?.url
      if (url && url.includes(WRITE_CHANNEL_MARKER)) {
        debug.fetchMatched++
        extractBodyText(input, init).then((body) => {
          if (body)
            capture(url, body)
        }).catch(() => {})
      }
    }
    catch {
      // sniffer 绝不能影响 ccfolia 的正常请求
    }
    return original.apply(this, args)
  } as typeof fetch
}

// 抽 fetch 请求体。覆盖 ccfolia 可能用到的形态:
//   - string(老式写法)
//   - URLSearchParams(Firestore WebChannel 最常见)
//   - FormData
//   - Request(input 本身就是 Request,需要 clone 后再读)
//   - Blob / ReadableStream 也走 clone+text 这条分支
async function extractBodyText(input: RequestInfo | URL, init?: RequestInit): Promise<string | null> {
  const body = init?.body
  if (typeof body === 'string')
    return body
  if (body instanceof URLSearchParams)
    return body.toString()
  if (body instanceof FormData) {
    const params = new URLSearchParams()
    body.forEach((v, k) => {
      if (typeof v === 'string')
        params.append(k, v)
    })
    return params.toString()
  }
  if (body instanceof Blob)
    return body.text()
  // input 可能本身是 Request,它持有 body;clone 以免消耗原流
  if (input instanceof Request) {
    try {
      return await input.clone().text()
    }
    catch {
      return null
    }
  }
  return null
}

function hookXhr(w: Window & typeof globalThis) {
  const proto = w.XMLHttpRequest.prototype
  const originalOpen = proto.open
  const originalSend = proto.send
  const urlKey = '__ccsSniffUrl__'

  proto.open = function (this: XMLHttpRequest & { [urlKey]?: string }, method: string, url: string | URL, ...rest: unknown[]) {
    try {
      debug.xhrSeen++
      const u = typeof url === 'string' ? url : url.href
      if (u.includes(WRITE_CHANNEL_MARKER)) {
        debug.xhrMatched++
        this[urlKey] = u
      }
    }
    catch { /* ignore */ }
    // @ts-expect-error — 透传剩余参数
    return originalOpen.call(this, method, url, ...rest)
  }

  proto.send = function (this: XMLHttpRequest & { [urlKey]?: string }, body?: Document | XMLHttpRequestBodyInit | null) {
    try {
      const url = this[urlKey]
      if (url && typeof body === 'string')
        capture(url, body)
    }
    catch { /* ignore */ }
    return originalSend.call(this, body as XMLHttpRequestBodyInit | null)
  }
}

function capture(url: string, body: string) {
  debug.lastUrl = url.slice(0, 200)
  debug.lastBodyHead = body.slice(0, 200)

  const u = new URL(url, location.href)
  const sid = u.searchParams.get('SID')
  const gsessionid = u.searchParams.get('gsessionid')
  if (!sid || !gsessionid) {
    debug.skippedNoSid++
    return
  }

  const ridStr = u.searchParams.get('RID')
  const rid = ridStr ? Number.parseInt(ridStr, 10) : Number.NaN

  const params = new URLSearchParams(body)
  const data0 = params.get('req0___data__')
  if (!data0) {
    debug.skippedNoData0++
    return
  }

  let token: string | undefined
  try {
    const obj = JSON.parse(data0) as { streamToken?: unknown }
    if (typeof obj.streamToken === 'string')
      token = obj.streamToken
  }
  catch {
    debug.skippedBadJson++
    return
  }
  if (!token) {
    debug.skippedNoToken++
    return
  }

  const ofs = Number.parseInt(params.get('ofs') ?? '', 10)
  const count = Number.parseInt(params.get('count') ?? '1', 10)

  const base = new URL(url, location.href)
  base.searchParams.delete('RID')
  base.searchParams.delete('AID')
  base.searchParams.delete('zx')
  base.searchParams.delete('t')

  const next: CcfoliaSession = {
    writeChannelBase: base.toString(),
    latestStreamToken: token,
    maxRid: Number.isFinite(rid) ? Math.max(session?.maxRid ?? 0, rid) : (session?.maxRid ?? 0),
    maxOfs: Number.isFinite(ofs) ? Math.max(session?.maxOfs ?? -1, ofs + count - 1) : (session?.maxOfs ?? -1),
  }

  session = next
  debug.captured++
  listeners.forEach(l => l(next))
}

export function getSession(): CcfoliaSession | null {
  return session
}

export function onSessionReady(cb: (s: CcfoliaSession) => void): () => void {
  if (session)
    cb(session)
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function claimNextWriteSlot(batchSize = 1): { rid: number, ofs: number } | null {
  if (!session)
    return null
  const rid = session.maxRid + 1
  const ofs = session.maxOfs + 1
  session.maxRid = rid
  session.maxOfs = ofs + batchSize - 1
  return { rid, ofs }
}
