// 战斗 FX 内部事件总线。生产者目前是 room-characters-store 的 HP/MP diff watcher
// (见 reconcileHpFxDiff / reconcileMpFxDiff),投递跨 tab:每个客户端的 onSnapshot 各自跑 diff 喷自己的演出。
// 消费者:scene overlay 的 FxLayer,按 charId 查 piece 坐标渲染对应特效。

// damage/heal 是 HP 演出;mp-drain/mp-restore 是 MP 演出(蓝色、比 HP 小一号)。
export type FxKind = 'damage' | 'heal' | 'mp-drain' | 'mp-restore'

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
