import type { PowerTable } from '@/types/power-table'

// 内置示例表仅用于让 resolver 开箱可用，不宣称是 SW2.5 官方威力表。
// 如果 GM 后续导入正式表，store 会优先使用用户导入的数据。
export const builtinPowerTables: PowerTable[] = [
  {
    id: 'builtin-starter',
    name: '内置示例威力表（0-40，非官方）',
    description: '仅供 resolver MVP 直接试算与演示用途，可被后续导入的正式表替代。',
    entries: [
      { power: 0, rolls: [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6] },
      { power: 10, rolls: [1, 2, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      { power: 20, rolls: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] },
      { power: 30, rolls: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
      { power: 40, rolls: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    ],
  },
]
