// 内置状态效果库(REQUIREMENTS §7.2)
// 数值/倒计时沿用 SW2.5 常见配置,GM 可通过 custom 覆盖或新增
// 挂载时 lifecycle 可被 GM 改写,这里只给默认

import type { StatusEffectDefinition } from '@/types/status-effect'

function def(
  id: string,
  name: string,
  category: StatusEffectDefinition['category'],
  icon: string,
  extras: Partial<StatusEffectDefinition> = {},
): StatusEffectDefinition {
  return {
    id,
    name,
    category,
    icon,
    defaultLifecycle: { kind: 'manual' },
    bundledModifiers: [],
    hooks: [],
    builtin: true,
    ...extras,
  }
}

export const BUILTIN_STATUS_EFFECTS: StatusEffectDefinition[] = [
  def('poison', '中毒', 'debuff', 'i-mdi-biohazard', {
    description: '每回合结束受到中毒伤害',
    hooks: [{ trigger: 'round-end', prompt: '请掷中毒伤害(1d6 或 GM 指定)' }],
  }),
  def('paralysis', '麻痹', 'debuff', 'i-mdi-flash', {
    description: '无法行动(行动不能子集)',
  }),
  def('sleep', '睡眠', 'debuff', 'i-mdi-sleep', {
    description: '无法行动,受伤立即解除',
    hooks: [{ trigger: 'on-detach', prompt: '受伤醒来' }],
  }),
  def('confusion', '混乱', 'debuff', 'i-mdi-help-circle', {
    description: '每回合随机行动',
    hooks: [{ trigger: 'turn-start', prompt: '掷混乱表决定行动' }],
  }),
  def('charm', '魅惑', 'debuff', 'i-mdi-heart', {
    description: '被魅惑者视施术者为友方',
  }),
  def('fear', '恐怖', 'debuff', 'i-mdi-ghost', {
    description: '需进行精神抵抗,失败无法攻击来源',
  }),
  def('petrified', '石化', 'debuff', 'i-mdi-cube', {
    description: '完全无法行动,不受物理伤害',
  }),
  def('blessed', '祝福', 'buff', 'i-mdi-star', {
    description: '攻击 / 回避 +1',
    defaultLifecycle: { kind: 'turns', remaining: 3 },
    bundledModifiers: [
      { target: 'attack', value: 1, source: '祝福' },
      { target: 'evasion', value: 1, source: '祝福' },
    ],
  }),
  def('protection', '加护', 'buff', 'i-mdi-shield', {
    description: '防护点 +2',
    defaultLifecycle: { kind: 'turns', remaining: 3 },
    bundledModifiers: [
      { target: 'armor', value: 2, source: '加护' },
    ],
  }),
  def('haste', '加速', 'buff', 'i-mdi-lightning-bolt', {
    description: '增加一次额外动作机会(由 GM 判定触发)',
    defaultLifecycle: { kind: 'turns', remaining: 3 },
  }),
  def('invisible', '隐身', 'buff', 'i-mdi-eye-off', {
    description: '攻击者对其命中判定不利',
  }),
  def('incapacitated', '行动不能', 'debuff', 'i-mdi-close-octagon', {
    description: 'HP ≤ 0 或其他原因导致无法行动',
  }),
  def('dying', '濒死', 'debuff', 'i-mdi-heart-broken', {
    description: '生命危险,需救治',
    hooks: [{ trigger: 'round-end', prompt: '请掷生命抵抗判定' }],
  }),
  def('berserk', '狂化', 'neutral', 'i-mdi-fire', {
    description: '攻击 +X,回避 -X(X 由 GM 决定)',
  }),
]
