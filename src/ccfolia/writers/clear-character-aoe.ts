import { serializedParamsUpdate } from '@/ccfolia/params-queue'
import { isAoeLabel } from '@/core/range'

// 清空某角色身上全部 AOE 指示器(移除所有 cs_aoe_ 条目)。无变化返回原引用,跳过空写。
export async function clearCharacterAoe(characterId: string): Promise<void> {
  await serializedParamsUpdate(characterId, (current) => {
    const next = current.filter(p => !isAoeLabel(p.label))
    return next.length === current.length ? current : next
  })
}
