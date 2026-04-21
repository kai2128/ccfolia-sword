import type { Resolution, ResolvedTarget } from './types'

export function formatActionLog(resolution: Resolution): string {
  const lines = [formatHeadline(resolution)]
  for (const target of resolution.targets)
    lines.push(` ${formatTargetLine(target, resolution)}`)
  return lines.join('\n')
}

function formatHeadline(resolution: Resolution): string {
  const { draft } = resolution
  const attacker = draft.attacker || '攻击者'
  const actionName = draft.actionName || '行动'
  const suffix = draft.isAoe ? '(AoE)' : ''
  const parts = [`【${attacker} → ${actionName}${suffix}】`]
  if (draft.kind === 'magic' && draft.castingRoll !== undefined)
    parts.push(`行使 ${draft.castingRoll}`)
  if (draft.mpCost !== undefined)
    parts.push(`MP ${draft.mpCost}`)
  return parts.join(' ')
}

function formatTargetLine(target: ResolvedTarget, resolution: Resolution): string {
  const source = resolution.draft.targets.find(item => item.id === target.id)

  if (resolution.draft.kind === 'physical')
    return formatPhysicalTargetLine(target, resolution, source)

  return formatMagicTargetLine(target, resolution, source)
}

function formatPhysicalTargetLine(
  target: ResolvedTarget,
  resolution: Resolution,
  source?: Resolution['draft']['targets'][number],
): string {
  const evasion = source?.evasion ?? '-'
  const defense = source?.defense ?? 0

  if (target.hit === false)
    return `${target.name}(回避${evasion})未命中`
  if (target.hit === 'unknown')
    return `${target.name} 待定`
  if (target.rawDamage === null)
    return `${target.name}(回避${evasion})命中(${resolution.draft.attackRoll ?? '-'}) 伤害 -`
  return `${target.name}(回避${evasion})命中(${resolution.draft.attackRoll ?? '-'}) 伤害 ${target.rawDamage}-${defense} = ${target.finalDamage ?? '-'}`
}

function formatMagicTargetLine(
  target: ResolvedTarget,
  resolution: Resolution,
  source?: Resolution['draft']['targets'][number],
): string {
  if (target.hit === 'unknown')
    return `${target.name} 待定`

  const resistValue = source?.resistValue ?? '-'
  if (target.hit === true)
    return `${target.name} 抵抗 ${resistValue} 失败 ${target.finalDamage ?? '-'}`

  const outcome = resolution.draft.resistOutcome === 'half' ? '半伤' : '无效'
  return `${target.name} 抵抗 ${resistValue} 成功 ${outcome} ${target.finalDamage ?? '-'}`
}
