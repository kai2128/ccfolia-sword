// AOE 领域预设。color 取自设计稿 range.jsx 的 kind 配色:
// resist = aoe 橙, ward = atk 金。
export interface AoePreset {
  key: string
  label: string
  radiusM: number
  color: string
}

export const AOE_PRESETS: AoePreset[] = [
  { key: 'resist', label: '领域抗性', radiusM: 5, color: '#cf8533' },
  { key: 'ward', label: '防护领域', radiusM: 3, color: '#e7c66a' },
]
