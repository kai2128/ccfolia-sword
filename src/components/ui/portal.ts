import type { InjectionKey, Ref } from 'vue'
import { inject } from 'vue'

// Reka Portal 挂载点注入 key。在 main.ts 里通过 app.provide 下发,
// 由 Dialog/Select/Dropdown/Tooltip 等 Portal 封装消费。
export const PortalTargetKey: InjectionKey<Ref<HTMLElement | null> | HTMLElement> = Symbol('ccs:portalTarget')

export function usePortalTarget(): HTMLElement | null {
  const target = inject(PortalTargetKey, null)
  if (!target)
    return null
  return target instanceof HTMLElement ? target : (target.value ?? null)
}
