import { buildClearParkedParams, buildSaveParkedParams } from '@/core/parked-location'
import { serializedParamsUpdate } from '../params-queue'

// 把当前 (x, y) 写进角色 params 的 cs_park 条目。幂等:同一角色再保存覆盖。
// 调用方负责判断"当前是否处于场外"(允许触发的语义条件)。
export async function saveCharacterParked(charId: string, x: number, y: number): Promise<void> {
  await serializedParamsUpdate(charId, params =>
    buildSaveParkedParams(params, x, y, Date.now()))
}

export async function clearCharacterParked(charId: string): Promise<void> {
  await serializedParamsUpdate(charId, (params) => {
    const next = buildClearParkedParams(params)
    return next.length === params.length ? params : next
  })
}
