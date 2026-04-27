import type { StatusLabelMap } from '@/core/status-slot'
import type { CcfoliaCharacter } from '@/types/ccfolia'

// 多部位角色:在 ccfolia 的 character.status 里以 label 前缀区分部位。
// 形如 `XXHP` `XXMP` `X1HP` `X2HP` `X3HP` —— XX 是主,X1/X2/X3 是子部位,
// 子部位的 MP 可缺省。识别规则:扫所有以 labelMap.hp 结尾的 label,把前缀(可空)group 起来。
//   prefix 个数 ≥ 2 → 多部位
//   = 1 且唯一前缀非空 → 仍按多部位(GM 命名了 XXHP 但只有一个部位,少见但允许)
//   = 1 且前缀空(标准 `HP`)→ 单部位,单条 partKey=''
//   = 0 → 角色无 HP,单条 partKey='',hpLabel 落到 labelMap.hp(查不到时 RosterRow 显示 "—")

export interface CharacterPartView {
  charId: string
  partKey: string // '' / 'XX' / 'X1' / ...
  isMain: boolean
  hpLabel: string // 实际的 ccfolia status.label,如 'XXHP' / 'HP'
  mpLabel: string | null
  partName: string // UI 子行展示用,如 'X1';main / 单部位下为 ''
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function extractParts(
  char: CcfoliaCharacter,
  labelMap: StatusLabelMap,
): CharacterPartView[] {
  const hpLabel = labelMap.hp
  const mpLabel = labelMap.mp
  const re = new RegExp(`^(.*)${escapeRegex(hpLabel)}$`)

  // 按首次出现顺序收集前缀(空前缀也算一种)
  const prefixes: string[] = []
  const seen = new Set<string>()
  for (const entry of char.status) {
    const m = re.exec(entry.label)
    if (!m)
      continue
    const prefix = m[1]
    if (seen.has(prefix))
      continue
    seen.add(prefix)
    prefixes.push(prefix)
  }

  // 角色无 HP:返回单条退化记录(读取时拿不到值,RosterRow 会显示 "—")
  if (prefixes.length === 0) {
    return [{
      charId: char._id,
      partKey: '',
      isMain: true,
      hpLabel,
      mpLabel: null,
      partName: '',
    }]
  }

  // 单部位且前缀为空:标准角色,行为同改动前
  if (prefixes.length === 1 && prefixes[0] === '') {
    const hasMp = char.status.some(e => e.label === mpLabel)
    return [{
      charId: char._id,
      partKey: '',
      isMain: true,
      hpLabel,
      mpLabel: hasMp ? mpLabel : null,
      partName: '',
    }]
  }

  // 多部位(或单一带前缀的特殊情况)
  return prefixes.map((prefix, i) => {
    const fullMpLabel = prefix + mpLabel
    const hasMp = char.status.some(e => e.label === fullMpLabel)
    return {
      charId: char._id,
      partKey: prefix,
      isMain: i === 0,
      hpLabel: prefix + hpLabel,
      mpLabel: hasMp ? fullMpLabel : null,
      partName: prefix,
    }
  })
}

// 便利:多部位 = parts.length > 1
export function isMultipart(parts: CharacterPartView[]): boolean {
  return parts.length > 1
}
