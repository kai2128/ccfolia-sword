import type { ResistType } from '@/types/action'

export interface ResistLabels {
  successLabel: string
  failureLabel: string
}

export function resistLabels(type: ResistType): ResistLabels | null {
  switch (type) {
    case 'evasion':
      return { successLabel: '未命中', failureLabel: '命中' }
    case 'mental':
    case 'life':
      return { successLabel: '抵抗成功', failureLabel: '抵抗失败' }
    case 'none':
      return null
  }
}
