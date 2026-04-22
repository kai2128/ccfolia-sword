import type { BuffInstance } from '@/types/buff-v3'
import type { CcfoliaParam } from '@/types/ccfolia'
import { buffLabel, encodeBuff } from './codec'

export type BuffOp
  = | { kind: 'append', buff: BuffInstance }
    | { kind: 'update', buff: BuffInstance }
    | { kind: 'remove', buffId: string }

export function appendBuff(buff: BuffInstance): BuffOp {
  return { kind: 'append', buff }
}

export function updateBuff(buff: BuffInstance): BuffOp {
  return { kind: 'update', buff }
}

export function removeBuff(buffId: string): BuffOp {
  return { kind: 'remove', buffId }
}

export function applyBuffOps(params: CcfoliaParam[], ops: BuffOp[]): CcfoliaParam[] {
  let next = params.slice()

  for (const op of ops) {
    if (op.kind === 'remove') {
      const label = buffLabel(op.buffId)
      next = next.filter(param => param.label !== label)
      continue
    }

    const label = buffLabel(op.buff.id)
    const entry: CcfoliaParam = { label, value: encodeBuff(op.buff) }
    const index = next.findIndex(param => param.label === label)

    if (op.kind === 'update') {
      if (index < 0)
        continue
      next = next.slice()
      next[index] = entry
      continue
    }

    if (index >= 0) {
      next = next.slice()
      next[index] = entry
    }
    else {
      next = [...next, entry]
    }
  }

  return next
}
