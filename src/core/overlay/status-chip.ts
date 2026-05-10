// 战斗 status 指示器的纯数据层:从 character.status[] 里挑出
// label 以 高昂 / 镇静 / 魅惑 开头的条目,映射成可渲染的 chip 数据。
// 不依赖 Vue / Firestore,SceneOverlayLayer 与 RosterRow 共用。

import type { CcfoliaStatus } from '@/types/ccfolia'

export type Polarity = 'buff' | 'debuff'

export interface StatusRecord {
  glyph: string
  hue: string
  polarity: Polarity
}

export interface StatusChipItem {
  /** 原始 status.label,用作 Vue key 与 chip 显示文字 */
  label: string
  /** 原始 status.value */
  value: number
  record: StatusRecord
}

// 顺序优先,startsWith 命中即停。要扩展只动这一张表。
export const STATUS_PATTERNS: Array<{ prefix: string, record: StatusRecord }> = [
  { prefix: '高昂', record: { glyph: '昂', hue: '#cf8533', polarity: 'buff' } },
  { prefix: '镇静', record: { glyph: '镇', hue: '#7fb6e8', polarity: 'buff' } },
  { prefix: '魅惑', record: { glyph: '魅', hue: '#d68bb6', polarity: 'debuff' } },
]

export function matchStatusPattern(label: string): StatusRecord | null {
  for (const pat of STATUS_PATTERNS) {
    if (label.startsWith(pat.prefix))
      return pat.record
  }
  return null
}

export function extractStatusChips(status: CcfoliaStatus[]): StatusChipItem[] {
  const out: StatusChipItem[] = []
  for (const s of status) {
    const record = matchStatusPattern(s.label)
    if (record)
      out.push({ label: s.label, value: s.value, record })
  }
  return out
}
