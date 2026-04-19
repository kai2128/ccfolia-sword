// ccfolia React Fiber 里的 character 对象原始 shape。
// 字段以实测为准(tech/10-ccfolia-storage.md §读取路径),未出现的字段不做假设。

export interface CcfoliaStatus {
  label: string // "HP" / "MP" / "防護点" 等
  value: number
  max: number
}

export interface CcfoliaParam {
  label: string
  value: string // 永远 string,sword 侧再 JSON.parse
}

export interface CcfoliaCharacter {
  _id: string
  name: string
  memo?: string
  iconUrl?: string
  status: CcfoliaStatus[]
  params: CcfoliaParam[]
  // ccfolia 内部还挂了更多字段(color/secret/active/owner 等),
  // 目前 sword 只需要 id/name/status/params,其他按需再加。
  [extra: string]: unknown
}
