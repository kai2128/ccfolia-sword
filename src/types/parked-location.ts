// 角色「场外停放位」的持久化:借用 ccfolia params 数组,与 tag 同样的存法。
// 单一固定 label —— 每个角色至多一个停放位;重复保存直接覆盖。
export const PARKED_LABEL = 'cs_park'

export interface ParkedPayload {
  x: number
  y: number
  savedAt: number
}
