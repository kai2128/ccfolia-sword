// 战斗 FX 内部事件总线。apply-damage / apply-heal 写回成功后由 UI 层喷事件,
// scene overlay 的 FxLayer 订阅、根据 charId 查 piece 坐标渲染对应特效。
//
// 不走 store / 不走 watcher diff —— amount 直接由调用方给(已知是 HP 变化、
// 已知是哪一条 kind),不需要再去对 status 做差分。

export type FxKind = 'damage' | 'heal'

export interface FxEvent {
  kind: FxKind
  charId: string
  amount: number
}

type Listener = (event: FxEvent) => void

const listeners = new Set<Listener>()

export function emitFx(event: FxEvent): void {
  // amount<=0 不喷:resisted=0 / heal 撞上限 净 0 都没必要演。
  if (!Number.isFinite(event.amount) || event.amount <= 0)
    return
  for (const fn of listeners)
    fn(event)
}

export function onFx(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
