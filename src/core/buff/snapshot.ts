import type { BuffSnapshot, StatusEffectDefinition } from '@/types/buff-v3'

export function createSnapshot(def: StatusEffectDefinition): BuffSnapshot {
  return {
    name: def.name,
    icon: def.icon,
    color: def.color,
    description: def.description,
    tickPrompt: def.tickPrompt,
    modifiers: def.modifiers.map(modifier => ({ ...modifier })),
    reminder: def.reminder,
    defaultAoeRadius: def.defaultAoeRadius,
    polarity: def.polarity,
    actionValue: def.actionValue,
  }
}
