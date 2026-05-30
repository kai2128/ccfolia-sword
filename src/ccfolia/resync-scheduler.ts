// 把多次 notify() 合并成有限频率的 run() 调用。
//   - 平静时(距上次 run ≥ throttleMs 且无排期):下一帧立即跑(leading,保手感)。
//   - burst 时:最多每 throttleMs 跑一次,期间通知合并,保证尾帧一定被跑到。
// clock/rAF/timer 依赖注入,便于单测与卸载清理。
export interface SchedulerDeps {
  now: () => number
  requestFrame: (cb: () => void) => number
  cancelFrame: (handle: number) => void
  setTimer: (cb: () => void, ms: number) => number
  clearTimer: (handle: number) => void
  run: () => void
}

export interface ResyncScheduler {
  notify: () => void
  cancel: () => void
}

export function makeResyncScheduler(deps: SchedulerDeps, throttleMs: number): ResyncScheduler {
  let lastRunAt = Number.NEGATIVE_INFINITY
  let frameHandle: number | null = null
  let timerHandle: number | null = null

  function doRun() {
    frameHandle = null
    timerHandle = null
    lastRunAt = deps.now()
    deps.run()
  }

  function notify() {
    // 已有排期 → 合并,不重复排
    if (frameHandle !== null || timerHandle !== null)
      return
    const elapsed = deps.now() - lastRunAt
    if (elapsed >= throttleMs) {
      // 平静:下一帧立即跑
      frameHandle = deps.requestFrame(doRun)
    }
    else {
      // burst:排到 lastRunAt + throttleMs 那一刻(尾帧)
      timerHandle = deps.setTimer(doRun, throttleMs - elapsed)
    }
  }

  function cancel() {
    if (frameHandle !== null) {
      deps.cancelFrame(frameHandle)
      frameHandle = null
    }
    if (timerHandle !== null) {
      deps.clearTimer(timerHandle)
      timerHandle = null
    }
  }

  return { notify, cancel }
}
