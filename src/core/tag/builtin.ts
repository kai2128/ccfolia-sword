import type { TagDefinition } from '@/types/tag'

export const BUILTIN_TAGS: TagDefinition[] = [
  {
    id: 'builtin.ally',
    label: '盟友',
    color: '#3498db',
    icon: 'i-lucide-shield',
    order: 0,
    builtin: true,
    autoKnockdownOnHpZero: true,
    autoRestoreOnMoveOutside: false,
  },
  {
    id: 'builtin.enemy',
    label: '敌人',
    color: '#e74c3c',
    icon: 'i-lucide-swords',
    order: 1,
    builtin: true,
    autoKnockdownOnHpZero: true,
    autoRestoreOnMoveOutside: true,
  },
  {
    id: 'builtin.neutral',
    label: '中立',
    color: '#95a5a6',
    icon: 'i-lucide-circle',
    order: 2,
    builtin: true,
  },
]
