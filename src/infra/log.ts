// 轻量日志:环形缓冲 + 控制台镜像 + unsafeWindow 暴露。
//
// 设计目标:
//   1. 初始化失败时,能在 console 跑 `__CCS_LOG__.dump()` 一键拿到时间线
//   2. 正常运行时 debug 级不刷屏,info+ 才进 console
//   3. 零外部依赖,不依赖 Vue / Pinia,主脚本任何环节都能用(含 document-start)

declare const unsafeWindow: Window & typeof globalThis

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  t: number
  level: LogLevel
  tag: string
  msg: string
  data?: unknown
}

const RING_SIZE = 500
const ring: LogEntry[] = []
const levelOrder: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

// 镜像到 console 的最低级别(低于这个就只进 ring,不打 console)
let mirrorLevel: LogLevel = 'info'

function write(level: LogLevel, tag: string, msg: string, data?: unknown) {
  const entry: LogEntry = { t: Date.now(), level, tag, msg, data }
  ring.push(entry)
  if (ring.length > RING_SIZE)
    ring.shift()

  if (levelOrder[level] < levelOrder[mirrorLevel])
    return

  const head = `[ccs:${tag}] ${msg}`
  const tail = data === undefined ? [] : [data]
  if (level === 'error')
    console.error(head, ...tail)
  else if (level === 'warn')
    console.warn(head, ...tail)
  else if (level === 'debug')
    console.debug(head, ...tail)
  else
    console.info(head, ...tail)
}

export interface Logger {
  debug: (msg: string, data?: unknown) => void
  info: (msg: string, data?: unknown) => void
  warn: (msg: string, data?: unknown) => void
  error: (msg: string, data?: unknown) => void
  child: (subTag: string) => Logger
}

export function createLogger(tag: string): Logger {
  return {
    debug: (msg, data) => write('debug', tag, msg, data),
    info: (msg, data) => write('info', tag, msg, data),
    warn: (msg, data) => write('warn', tag, msg, data),
    error: (msg, data) => write('error', tag, msg, data),
    child: sub => createLogger(`${tag}:${sub}`),
  }
}

// 把控制面板挂到 unsafeWindow,方便 console 里操作。
// 必须在 document-start 早期调用一次,其他模块 createLogger 即可用。
export function installLogPanel() {
  const panel = {
    dump: (): LogEntry[] => ring.slice(),
    tail: (n = 30): LogEntry[] => ring.slice(-n),
    byTag: (tag: string): LogEntry[] => ring.filter(e => e.tag.startsWith(tag)),
    byLevel: (level: LogLevel): LogEntry[] =>
      ring.filter(e => levelOrder[e.level] >= levelOrder[level]),
    clear: () => { ring.length = 0 },
    setMirrorLevel: (l: LogLevel) => { mirrorLevel = l },
    // 打印成可读表格,时间戳转相对 ms
    print: (n = 30) => {
      const items = ring.slice(-n)
      const t0 = items[0]?.t ?? 0
      console.table(items.map(e => ({
        ms: e.t - t0,
        level: e.level,
        tag: e.tag,
        msg: e.msg,
      })))
    },
  }
  ;(unsafeWindow as unknown as { __CCS_LOG__?: typeof panel }).__CCS_LOG__ = panel
}
