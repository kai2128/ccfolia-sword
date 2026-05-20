import type { StatusLabelMap } from '@/core/status-slot'
import type { CcfoliaCharacter } from '@/types/ccfolia'

// 多部位角色:在 ccfolia 的 character.status 里以 label 前缀区分部位。
// 形如 `XXHP` `XXMP` `X1HP` `X2HP` `X3HP` —— XX 是主,X1/X2/X3 是子部位,
// 子部位的 MP 可缺省。识别规则:扫所有以 labelMap.hp 结尾的 label 收集前缀(可空)。
//   prefix 个数 ≥ 2 → 多部位
//   = 1 且唯一前缀非空 → 仍按多部位(GM 命名了 XXHP 但只有一个部位,少见但允许)
//   = 1 且前缀空(标准 `HP`)→ 单部位,单条 partKey=''
//   = 0 → 角色无 HP,退化为单条 partKey='',hpLabel 走默认(读不到值时上层显示占位)

export interface CharacterPartView {
  charId: string
  partKey: string
  isMain: boolean
  hpLabel: string
  mpLabel: string | null
  partName: string
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// extractParts 在 overlay 重算里每棋子调一次,又在 reconcileHpFxDiff 里每角色调一次。
// 前缀正则只取决于 hpLabel,按 label 缓存,免去每次 new RegExp 编译。
let cachedHpLabel: string | null = null
let cachedHpPrefixRe: RegExp | null = null
function hpPrefixRegex(hpLabel: string): RegExp {
  if (cachedHpPrefixRe === null || cachedHpLabel !== hpLabel) {
    cachedHpLabel = hpLabel
    cachedHpPrefixRe = new RegExp(`^(.*)${escapeRegex(hpLabel)}$`)
  }
  return cachedHpPrefixRe
}

export function extractParts(
  char: CcfoliaCharacter,
  labelMap: StatusLabelMap,
): CharacterPartView[] {
  const hpLabel = labelMap.hp
  const mpLabel = labelMap.mp
  const re = hpPrefixRegex(hpLabel)

  const seen = new Set<string>()
  const prefixes: string[] = []
  for (const entry of char.status) {
    const m = re.exec(entry.label)
    if (!m || seen.has(m[1]))
      continue
    seen.add(m[1])
    prefixes.push(m[1])
  }

  // 角色无 HP:返回单条退化记录,hpLabel 走默认值,读取时拿不到值 → 上层显示占位。
  const effective = prefixes.length === 0 ? [''] : prefixes
  const labels = new Set(char.status.map(e => e.label))

  return effective.map((prefix, i) => {
    const fullMp = prefix + mpLabel
    return {
      charId: char._id,
      partKey: prefix,
      isMain: i === 0,
      hpLabel: prefix + hpLabel,
      mpLabel: labels.has(fullMp) ? fullMp : null,
      partName: prefix,
    }
  })
}
