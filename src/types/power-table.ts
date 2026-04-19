// 威力表数据模型,对齐 REQUIREMENTS §3.5
// entries[i].rolls 长度固定 11,索引 0..10 对应 2d6 和 2..12

export interface PowerTableEntry {
  power: number
  rolls: number[] // length=11, index 0=rolled 2 ... index 10=rolled 12
}

export interface PowerTable {
  id: string
  name: string
  description?: string
  entries: PowerTableEntry[]
}
