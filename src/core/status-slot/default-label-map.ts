/**
 * sword 语义槽 → ccfolia character.status 的 label 字符串。
 * GM 可在设置里手改(兼容繁体 / 日文 / 自定义)。
 */
export type StatusSlot = 'hp' | 'mp' | 'defense' | 'mentalResist' | 'lifeResist'

export type StatusLabelMap = Record<StatusSlot, string>

export const DEFAULT_STATUS_LABEL_MAP: StatusLabelMap = {
  hp: 'HP',
  mp: 'MP',
  defense: '防御',
  mentalResist: '精神抵抗',
  lifeResist: '生命抵抗',
}
