// 决定单个角色当前应该用 C 还是 E 变体。
// 输入纯数据,输出 'C' | 'E';所有副作用在调用方。
//
//   override 优先,锁死什么显示什么。
//   auto 时:多部位默认 E(每部位有各自 HP/MP,行列堆叠最易读);
//           单部位默认 C,仅在拥挤且开启自动切换时降级到 E。

export type DisplayMode = 'C' | 'E'
export type VariantOverride = 'auto' | DisplayMode

export interface ResolveInput {
  isMultipart: boolean
  override: VariantOverride
  isCrowded: boolean
  autoSwitchOnCrowded: boolean
}

export function resolveDisplayMode(input: ResolveInput): DisplayMode {
  if (input.override !== 'auto')
    return input.override
  if (input.isMultipart)
    return 'E'
  return input.autoSwitchOnCrowded && input.isCrowded ? 'E' : 'C'
}
