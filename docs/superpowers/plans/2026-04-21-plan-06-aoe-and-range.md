# Plan 06 · AoE Buff + 射程圈 + 实时覆盖重算

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 GM 可以挂"以角色为圆心"的 AoE Buff,画布上画圈随中心移动,覆盖名单实时按 Chebyshev 距离重算,GM 可手动 include / exclude。中心死亡 / 隐藏时整条 AoE 连同单体 buff 一起批量禁用(非删除)。同时每个角色可单独切换显示一个"射程圈"(纯视觉,可调半径),只本地不写 ccfolia。同步把 Plan 05 留下的 `resolveDefense` 的 `extraMods` 占位替换为"从覆盖我的 AoE buff 汇总 modifier"。

**Architecture:** 覆盖集合是 **派生态**,不落盘。核心是 `core/buff/aoe.ts` 里的 `computeCoverage(buff, pieces) → Set<characterId>`;UI 消费方:(1) `AoeCircle.vue` 画布圆 + 覆盖者的高亮,(2) `BuffBadgeRow` 在被覆盖角色上加徽章(禁用态 = 灰显),(3) `resolveDefense` 注入覆盖我的 AoE modifier。中心死亡走 Plan 05 的 `batchSetBuffsEnabledForCharacter`(该方法本身会覆盖中心身上所有 `cs_buff_*`,含 AoE),复活走反向批量 enable。射程圈是本地 ephemeral 状态,存 `encounter.local.rangeCircles: Record<characterId, number>`(键存在 = 显示,值 = 半径格数),多角色可同时开启;Plan 04 原 `rulers` 字段在 Task 8 Step 1 一并删除 / 替换。

**Tech Stack:** Vue 3 + pieces-store(Plan 02 已建)+ characters-store + core/range(Plan 01)+ Firestore writer(Plan 05)。

**前置:** Plan 01-05 完。

**Spec 参考:** §3.3 AttachAoe、§4.2 AoE Buff 实时跟随、§5.3 AoE buff 行 `[👥调整覆盖]`、§5.5 画布叠加层、§10 硬规则 #5(coverage 是派生态)。

---

## 文件结构

| 动作      | 路径                                                            | 职责                                                                                                                                        |
| --------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 新建      | `src/core/buff/aoe.ts`                                          | `computeCoverage(buff, pieces, gridConfig)`:Chebyshev 按半径收集,再叠加 include / exclude                                                   |
| 新建      | `src/core/buff/aoe.test.ts`                                     | 单测(同格、边界、include、exclude、disabled 仍算 coverage 给 UI 灰显)                                                                       |
| 新建      | `src/stores/buffs-derived.ts`                                   | 派生 store:`coverageByBuff: Map<buffId, Set<characterId>>` / `aoeBuffsCoveringCharacter(id): BuffInstance[]` 等响应式 getter                |
| 修改      | `src/core/combat/resolve-modifiers.ts`                          | `resolveDefense` 的 `extraMods` 改为从 `aoeBuffsCoveringCharacter(id)` 的 enabled buff 汇总                                                 |
| 修改      | `src/core/combat/resolve-modifiers.test.ts`                     | 追加 AoE 覆盖的贡献                                                                                                                         |
| 新建      | `src/components/scene/AoeCircle.vue`                            | 画布内圆,淡色填充 + 描边,中心 piece 坐标驱动                                                                                                |
| 修改      | `src/components/scene/SceneOverlayLayer.vue`                    | 多一个 v-for 渲染所有 AoE circle + BuffBadgeRow 读 AoE 覆盖徽章                                                                             |
| 修改      | `src/components/overlay/BuffBadgeRow.vue`                       | 入参 buffs 增加"AoE 覆盖但挂在别人身上的"来源,用 attachedTo.kind 区分显示(单体徽章 + AoE 徽章都渲染,AoE 中心死亡时和单体 disabled 视觉一致) |
| 修改      | `src/components/buffs/AttachBuffDialog.vue`                     | 放开 AoE 分支:radius 输入 + 覆盖预览列表                                                                                                    |
| 新建      | `src/components/buffs/AoeCoverageEditor.vue`                    | `[👥调整覆盖]`:两栏(自动覆盖 / 非自动覆盖)勾选 → 写 includeOverride / excludeOverride                                                       |
| 修改      | `src/components/buffs/BuffRow.vue`                              | AoE 行追加 `[👥]` 按钮,打开 AoeCoverageEditor                                                                                               |
| 新建      | `src/components/scene/RangeCircle.vue`                          | 以角色为中心的射程圆;从 `encounter.local.rangeCircles` 渲染,青色虚线区分 AoE 蓝实线                                                         |
| 修改      | 角色行组件                                                      | 加 `📏` 切换按钮 + 半径输入(就地编辑);具体文件按 roster / 角色 Tab 现状                                                                     |
| 新建/修改 | `src/components/scene/PiecePopover.vue` 或扩现有 piece 选中气泡 | 加同款 `📏` + 半径输入;若 Plan 02 未暴露 piece click 事件可降级,仅保留角色行入口                                                            |
| 修改      | `src/stores/encounter.ts`                                       | 替换 Plan 04 的 `rulers` 为 `rangeCircles: Record<characterId, number>`;暴露 `toggleRangeCircle` / `setRangeRadius` / `clearRangeCircles`   |
| 修改      | `src/ccfolia/writers/toggle-buff-enabled.ts`                    | 无需改(已经按 buffId 读 cs*buff*,AoE / 单体一视同仁)                                                                                        |

---

## Task 1:computeCoverage 纯函数

**Files:**

- Create: `src/core/buff/aoe.ts`
- Create: `src/core/buff/aoe.test.ts`

- [ ] **Step 1: 先写失败测试**

```typescript
// src/core/buff/aoe.test.ts

import type { PieceSnapshot } from '@/ccfolia/pieces-store' // Plan 02 Task 2
import type { GridConfig } from '@/core/range/types'
import type { AttachAoe, BuffInstance } from '@/types/buff-v3'
import { describe, expect, it } from 'vitest'
import { computeCoverage } from './aoe'

const GRID: GridConfig = {
  cols: 19,
  rows: 34,
  cellSizePx: 40,
  originPx: { x: 0, y: 0 },
  pieceAnchor: 'center',
}

function piece(id: string, col: number, row: number): PieceSnapshot {
  // center-anchor: (col + 0.5) * 40, (row + 0.5) * 40
  return {
    pieceId: id,
    characterId: id,
    x: (col + 0.5) * 40,
    y: (row + 0.5) * 40,
  }
}

function aoeBuff(attach: Partial<AttachAoe>, enabled = true): BuffInstance {
  return {
    id: 'b1',
    definitionId: 'd',
    snapshot: { name: '', icon: '', description: '', modifiers: [] },
    attachedTo: {
      kind: 'aoe',
      centerCharacterId: 'center',
      radius: 2,
      ...attach,
    },
    lifecycle: 'encounter',
    enabled,
    attachedAtTurn: 1,
  }
}

describe('computeCoverage', () => {
  const center = piece('center', 5, 5)

  it('includes center itself', () => {
    const cov = computeCoverage(aoeBuff({ radius: 2 }), [center], GRID)
    expect(cov.has('center')).toBe(true)
  })

  it('includes pieces within Chebyshev radius', () => {
    const a = piece('a', 5, 7) // row distance = 2
    const b = piece('b', 7, 5) // col distance = 2
    const c = piece('c', 8, 5) // distance 3 (out)
    const cov = computeCoverage(aoeBuff({ radius: 2 }), [center, a, b, c], GRID)
    expect(cov.has('a')).toBe(true)
    expect(cov.has('b')).toBe(true)
    expect(cov.has('c')).toBe(false)
  })

  it('treats diagonals as distance = max(|dx|,|dy|)', () => {
    const diag = piece('diag', 7, 7) // both 2
    const cov = computeCoverage(aoeBuff({ radius: 2 }), [center, diag], GRID)
    expect(cov.has('diag')).toBe(true)
  })

  it('excludes pieces with no grid cell (off-grid)', () => {
    const off: PieceSnapshot = { pieceId: 'off', characterId: 'off', x: -999, y: -999 }
    const cov = computeCoverage(aoeBuff({ radius: 2 }), [center, off], GRID)
    expect(cov.has('off')).toBe(false)
  })

  it('includeOverride adds out-of-range pieces', () => {
    const far = piece('far', 10, 10)
    const cov = computeCoverage(aoeBuff({ radius: 2, includeOverride: ['far'] }), [center, far], GRID)
    expect(cov.has('far')).toBe(true)
  })

  it('excludeOverride removes in-range pieces', () => {
    const near = piece('near', 5, 6)
    const cov = computeCoverage(aoeBuff({ radius: 2, excludeOverride: ['near'] }), [center, near], GRID)
    expect(cov.has('near')).toBe(false)
  })

  it('exclude wins over include when both list same id', () => {
    const near = piece('near', 5, 6)
    const cov = computeCoverage(aoeBuff({ radius: 2, includeOverride: ['near'], excludeOverride: ['near'] }), [center, near], GRID)
    expect(cov.has('near')).toBe(false)
  })

  it('returns empty set if center piece missing', () => {
    const a = piece('a', 5, 6)
    const cov = computeCoverage(aoeBuff({ radius: 2 }), [a], GRID) // no 'center' piece
    expect(cov.size).toBe(0)
  })

  it('disabled buff still returns full coverage (UI uses grey-out, not removal)', () => {
    const near = piece('near', 5, 6)
    const cov = computeCoverage(aoeBuff({ radius: 2 }, false), [center, near], GRID)
    expect(cov.has('near')).toBe(true)
  })
})
```

- [ ] **Step 2: 跑失败**

Run: `pnpm vitest run src/core/buff/aoe.test.ts`
Expected: FAIL 找不到模块

- [ ] **Step 3: 实现**

```typescript
// src/core/buff/aoe.ts

import type { PieceSnapshot } from '@/ccfolia/pieces-store'
import type { GridConfig } from '@/core/range/types'
import type { BuffInstance } from '@/types/buff-v3'
import { chebyshev, pxToCell } from '@/core/range'

// 输入:AoE buff + 当前所有 pieces + grid 配置
// 输出:被覆盖的 characterId 集合(含中心自身)
// 规则:auto = 距离中心 ≤ radius 的 piece;final = (auto ∪ include) \ exclude
// 注:本函数**不看 enabled**,enabled=false 时 UI 层自己决定灰显;这样中心死亡后仍能显示"原本谁被罩着"
export function computeCoverage(buff: BuffInstance, pieces: PieceSnapshot[], grid: GridConfig): Set<string> {
  if (buff.attachedTo.kind !== 'aoe')
    return new Set()
  const attach = buff.attachedTo
  const center = pieces.find(p => p.characterId === attach.centerCharacterId)
  if (!center)
    return new Set()
  // Plan 01 签名:pxToCell({ x, y }, cfg) —— 不是 (x, y, cfg)
  const centerCell = pxToCell({ x: center.x, y: center.y }, grid)
  if (!centerCell)
    return new Set()

  const auto = new Set<string>()
  for (const p of pieces) {
    const cell = pxToCell({ x: p.x, y: p.y }, grid)
    if (!cell)
      continue
    const d = chebyshev(centerCell, cell)
    if (d <= attach.radius)
      auto.add(p.characterId)
  }

  const include = new Set(attach.includeOverride ?? [])
  const exclude = new Set(attach.excludeOverride ?? [])

  const out = new Set<string>()
  for (const id of auto)
    out.add(id)
  for (const id of include)
    out.add(id)
  for (const id of exclude)
    out.delete(id)
  return out
}
```

Plan 01 导出的函数名:`chebyshev(a: CellRef, b: CellRef)` 和 `pxToCell({x,y}: {x:number,y:number}, cfg: GridConfig)`。`@/core/range` 是 barrel re-export,覆盖 `grid.ts` + `distance.ts` + `cell-ref.ts`。

- [ ] **Step 4: 跑测试**

Run: `pnpm vitest run src/core/buff/aoe.test.ts`
Expected: 9 pass

- [ ] **Step 5: commit**

```bash
git add src/core/buff/aoe.ts src/core/buff/aoe.test.ts
git commit -m "feat(buff): computeCoverage for AoE buffs (Chebyshev + override)"
```

---

## Task 2:派生响应式 store buffs-derived

**Files:**

- Create: `src/stores/buffs-derived.ts`

本 store 是组件消费口,所有 AoE 相关的"跨 character 聚合"都从这里读。不落盘、不写 ccfolia,是 `collectBuffs + computeCoverage` 的响应式包装。

- [ ] **Step 1: 实现**

```typescript
// src/stores/buffs-derived.ts

import type { BuffInstance } from '@/types/buff-v3'
import { computed, defineStore } from 'pinia'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { computeCoverage } from '@/core/buff/aoe'
import { collectBuffs } from '@/core/buff/collect'
import { useSettingsStore } from '@/stores/settings'

export const useBuffsDerivedStore = defineStore('buffsDerived', () => {
  const characters = useRoomCharactersStore()
  const pieces = usePiecesStore()
  const settings = useSettingsStore()

  // 全部 AoE buff(按 centerCharacterId 聚在中心角色的 params 里)
  // characters.all 返回 CcfoliaCharacter[],collectBuffs 从 character.params 解析 cs_buff_*
  const allAoeBuffs = computed<BuffInstance[]>(() => {
    const out: BuffInstance[] = []
    for (const c of characters.all) {
      for (const b of collectBuffs(c)) {
        if (b.attachedTo.kind === 'aoe')
          out.push(b)
      }
    }
    return out
  })

  // buffId → 覆盖集合
  const coverageByBuff = computed<Map<string, Set<string>>>(() => {
    const map = new Map<string, Set<string>>()
    for (const b of allAoeBuffs.value)
      map.set(b.id, computeCoverage(b, pieces.list, settings.grid))
    return map
  })

  // 返回覆盖某角色的所有 AoE buff(不过滤 enabled,消费方按需过滤)
  function aoeBuffsCoveringCharacter(characterId: string): BuffInstance[] {
    return allAoeBuffs.value.filter((b) => {
      const cov = coverageByBuff.value.get(b.id)
      return cov?.has(characterId) ?? false
    })
  }

  return {
    allAoeBuffs,
    coverageByBuff,
    aoeBuffsCoveringCharacter,
  }
})
```

`usePiecesStore` 的 `list` 由 Plan 02 的 `src/ccfolia/pieces-store.ts` 提供(state 字段就叫 `list`,不是 `all`)。

- [ ] **Step 2: tsc**

Run: `pnpm tsc --noEmit`
Expected: 0 错误(可能需要补 pieces-store 的 `all` getter 的类型导出)

- [ ] **Step 3: commit**

```bash
git add src/stores/buffs-derived.ts
git commit -m "feat(stores): buffs-derived for AoE coverage computation"
```

---

## Task 3:resolveDefense 接入 AoE 贡献

**Files:**

- Modify: `src/core/combat/resolve-modifiers.ts`
- Modify: `src/core/combat/resolve-modifiers.test.ts`
- Modify: ActionForm 调用点(src/components/combat/ActionForm.vue)

Plan 05 的 `resolveDefense(char, labelMap, extraMods)` 已汇总**单体**,本 task 补 AoE。UI 层调用时,从 `buffsDerivedStore.aoeBuffsCoveringCharacter(id)` 过滤 `enabled === true`,把它们 `snapshot.modifiers` 展平成 `extraMods` 传进去。Core 层函数签名不用改 —— 这样 core 仍是纯函数,测试可 mock extraMods。

- [ ] **Step 1: 补 core 单测**

追加到 `src/core/combat/resolve-modifiers.test.ts`:

```typescript
it('resolveDefense adds extraMods defense contribution (AoE injected)', () => {
  const c = charWithBuffs(3, []) // helper defined in Plan 05 Task 11
  const result = resolveDefense(c, DEFAULT_LABEL_MAP, [
    { target: 'defense', value: 2 },
    { target: 'attack', value: 99 }, // 不同 target,应忽略
  ])
  expect(result).toBe(5)
})
```

- [ ] **Step 2: 跑测试**

Run: `pnpm vitest run src/core/combat/resolve-modifiers.test.ts`
Expected: 所有 pass

- [ ] **Step 3: 改 ActionForm / TargetRow 调用点**

Read: `src/components/combat/ActionForm.vue` 和 `TargetRow.vue`(Plan 04 建)

找到调用 `resolveDefense(char, labelMap, [])` 的地方:

```typescript
// Before:
// After:
import { useBuffsDerivedStore } from '@/stores/buffs-derived'

const defense = resolveDefense(target, settings.statusLabelMap, [])
const buffsDerived = useBuffsDerivedStore()

function extraModsFor(characterId: string) {
  return buffsDerived
    .aoeBuffsCoveringCharacter(characterId)
    .filter(b => b.enabled)
    .flatMap(b => b.snapshot.modifiers)
}

const defense = resolveDefense(target, settings.statusLabelMap, extraModsFor(target.id))
```

**注意**:这是响应式依赖。若调用点原来写的是普通函数,需改为 `computed` 以触发覆盖变化时重算。通常的做法:

```typescript
const defenseByTargetId = computed(() => {
  const map = new Map<string, number>()
  for (const t of draft.targets) {
    const char = characters.byId(t.characterId)
    if (char)
      map.set(t.characterId, resolveDefense(char, settings.statusLabelMap, extraModsFor(t.characterId)))
  }
  return map
})
```

- [ ] **Step 4: tsc**

Run: `pnpm tsc --noEmit`

- [ ] **Step 5: 手工验证(触发点:拖动被 AoE 覆盖的目标 piece 进出圈)**

1. 挂一条 AoE 加护(defense +2,radius=2)在格伦
2. 哥布林 A 在圈内 → ActionForm 算哥布林防御时多 +2
3. 拖哥布林 A 出圈 → ActionForm 里防御数字立即少 2
4. 禁用这条 AoE → 防御数字恢复基础值,但徽章灰显仍在

- [ ] **Step 6: commit**

```bash
git add src/core/combat/resolve-modifiers.test.ts src/components/combat/ActionForm.vue
git commit -m "feat(combat): resolveDefense consumes AoE coverage modifiers"
```

---

## Task 4:BuffBadgeRow 吃 AoE 来源 + SceneOverlayLayer 集成

**Files:**

- Modify: `src/components/overlay/BuffBadgeRow.vue`
- Modify: `src/components/scene/SceneOverlayLayer.vue`

让 overlay 上的徽章既有"挂我身上的单体 buff"也有"覆盖我的 AoE buff",两者视觉一致,AoE disabled 时一样灰显。

- [ ] **Step 1: 修 BuffBadgeRow**

Plan 05 里 BuffBadgeRow 只接一个 `buffs` 数组。AoE / 单体 UI 差异只需 tooltip 标记"[AoE]":

```vue
<!-- BuffBadgeRow.vue 的 template 片段改动 -->
<span
  v-for="b in visible"
  :key="b.id"
  class="badge"
  :class="{ disabled: !b.enabled, aoe: b.attachedTo.kind === 'aoe' }"
  :style="b.snapshot.color ? { borderColor: b.snapshot.color } : {}"
  :title="b.attachedTo.kind === 'aoe' ? `[AoE] ${b.snapshot.name}` : b.snapshot.name"
>
  <span v-if="!b.enabled" class="prefix">⊘
</span>

  <span class="icon" :class="b.snapshot.icon" />
</span>
```

可选加 `.badge.aoe { border-style: dashed; }` 作 AoE 视觉区分。

- [ ] **Step 2: SceneOverlayLayer 合并两类 buffs**

```vue
<!-- SceneOverlayLayer.vue -->
<script setup lang="ts">
import { collectBuffs } from '@/core/buff/collect'
// ... 现有 imports
import { useBuffsDerivedStore } from '@/stores/buffs-derived'

const buffsDerived = useBuffsDerivedStore()

function buffsOf(piece: Piece) {
  const character = characters.byId(piece.characterId)
  if (!character)
    return []
  const own = collectBuffs(character).filter(b => b.attachedTo.kind === 'single')
  const aoe = buffsDerived.aoeBuffsCoveringCharacter(piece.characterId)
  return [...own, ...aoe]
}
</script>
```

- [ ] **Step 3: 手工验证**

1. 挂 AoE 加护在格伦(radius=2)
2. 法伊在圈内 → 法伊立绘上方出现加护徽章(非挂在法伊自己的 params,而是从 buffs-derived 来)
3. 拖法伊出圈 → 徽章消失
4. 拖回圈内 → 徽章恢复
5. 格伦 HP 到 0 → 格伦身上的 AoE 自动 disabled,覆盖的法伊徽章灰显

- [ ] **Step 4: commit**

```bash
git add src/components/overlay/BuffBadgeRow.vue src/components/scene/SceneOverlayLayer.vue
git commit -m "feat(overlay): BuffBadgeRow merges self-buffs with AoE coverage"
```

---

## Task 5:AoeCircle.vue 画布圆

**Files:**

- Create: `src/components/scene/AoeCircle.vue`
- Modify: `src/components/scene/SceneOverlayLayer.vue`(追加 AoeCircle v-for)

AoE 视觉圆(spec §5.5 "I1 视觉圆形,淡色填充 + 描边;覆盖角色加内描金边";判定仍 Chebyshev,这里只是视觉)。

- [ ] **Step 1: 写组件**

```vue
<!-- src/components/scene/AoeCircle.vue -->
<script setup lang="ts">
import type { BuffInstance } from '@/types/buff-v3'
import { computed } from 'vue'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps<{
  buff: BuffInstance // attachedTo.kind === 'aoe'
}>()

const pieces = usePiecesStore()
const settings = useSettingsStore()

const centerPiece = computed(() => {
  if (props.buff.attachedTo.kind !== 'aoe')
    return null
  return pieces.list.find(p => p.characterId === props.buff.attachedTo.centerCharacterId) ?? null
})

const diameterPx = computed(() => {
  if (props.buff.attachedTo.kind !== 'aoe')
    return 0
  // Chebyshev 半径 r 对应的视觉边长 = (2r+1) 格;圆直径取格边长 *(2r+1) 近似覆盖
  return (2 * props.buff.attachedTo.radius + 1) * settings.grid.cellSizePx
})

const style = computed(() => {
  if (!centerPiece.value)
    return { display: 'none' }
  return {
    left: `${centerPiece.value.x - diameterPx.value / 2}px`,
    top: `${centerPiece.value.y - diameterPx.value / 2}px`,
    width: `${diameterPx.value}px`,
    height: `${diameterPx.value}px`,
    borderColor: props.buff.snapshot.color ?? 'rgba(90, 140, 255, 0.8)',
    opacity: props.buff.enabled ? 1 : 0.35,
  }
})
</script>

<template>
  <div class="aoe-circle" :style="style" />
</template>

<style scoped>
.aoe-circle {
  position: absolute;
  border-radius: 50%;
  border: 2px solid rgba(90, 140, 255, 0.8);
  background: rgba(90, 140, 255, 0.15);
  pointer-events: none;
}
</style>
```

半径视觉处理:spec §5.5 写 "视觉圆形,判定 Chebyshev"—— 有意不对称(GM 看圆,程序按方)。上面 `diameterPx` 取 `(2r+1) * cellSizePx` 和 Chebyshev 方框同外接尺寸,视觉误差最小。若日后要严格"圆 = 视觉外接圆",可以再调整。

- [ ] **Step 2: SceneOverlayLayer 追加 AoeCircle 层**

```vue
<!-- SceneOverlayLayer.vue -->
<script setup lang="ts">
// ... 既有
import AoeCircle from './AoeCircle.vue'
</script>

<template>
  <div class="overlay-root">
    <!-- 先圆后 piece,圆在立绘下层 -->
    <AoeCircle
      v-for="buff in buffsDerived.allAoeBuffs"
      :key="buff.id"
      :buff="buff"
    />
    <div v-for="piece in pieces.list" :key="piece.pieceId" class="piece-slot" ...>
      <HpIndicator ... />
      <BuffBadgeRow :buffs="buffsOf(piece)" />
    </div>
  </div>
</template>
```

- [ ] **Step 3: 手工验证**

1. 挂 AoE 加护 radius=2 在格伦 → 看到浅蓝圆
2. 拖格伦 → 圆跟随
3. 格伦 HP 到 0 → 圆变半透明 + 覆盖徽章灰

- [ ] **Step 4: commit**

```bash
git add src/components/scene/AoeCircle.vue src/components/scene/SceneOverlayLayer.vue
git commit -m "feat(scene): AoeCircle rendering AoE buff radius"
```

---

## Task 6:AttachBuffDialog 放开 AoE 分支

**Files:**

- Modify: `src/components/buffs/AttachBuffDialog.vue`

Plan 05 里 AoE 被 block。本 task 补上 radius 输入 + 覆盖预览。

- [ ] **Step 1: 改 Dialog**

```vue
<!-- 去掉 Plan 05 的 "AoE 挂载暂未开放" warn -->
<!-- 加 AoE 专属字段 -->

<template>
  <!-- ... 既有 form ... -->
  <template v-if="def">
    <!-- ... name/duration/lifecycle/note 原样 ... -->
    <template v-if="def.scope === 'aoe'">
      <label>半径(格,= 米) <input v-model.number="aoeRadius" type="number" min="1"></label>
      <section class="coverage-preview">
        <h4>预览覆盖({{ coveragePreview.length }} 人)</h4>
        <ul>
          <li v-for="cid in coveragePreview" :key="cid">
            {{ charNameOf(cid) }}
          </li>
        </ul>
      </section>
    </template>
  </template>
</template>
```

```typescript
import { usePiecesStore } from '@/ccfolia/pieces-store'
// script 补:
import { computeCoverage } from '@/core/buff/aoe'

const pieces = usePiecesStore()
const aoeRadius = ref(1)

watch(def, (newDef) => {
  // 既有 watch 内追加:
  if (newDef?.scope === 'aoe')
    aoeRadius.value = newDef.defaultAoeRadius ?? 2
})

const coveragePreview = computed(() => {
  if (!def.value || def.value.scope !== 'aoe')
    return []
  const fakeBuff: BuffInstance = {
    id: 'preview',
    definitionId: def.value.id,
    snapshot: createSnapshot(def.value),
    attachedTo: {
      kind: 'aoe',
      centerCharacterId: props.characterId,
      radius: aoeRadius.value,
    },
    lifecycle: 'encounter',
    enabled: true,
    attachedAtTurn: 0,
  }
  return Array.from(computeCoverage(fakeBuff, pieces.list, settings.grid))
})

function charNameOf(id: string): string {
  return characters.byId(id)?.name ?? '(未知)'
}

// confirm() 分支:
async function confirm() {
  if (!def.value)
    return
  const snapshot = createSnapshot(def.value)
  snapshot.modifiers = modifiers.value.map(m => ({ ...m }))

  const attachedTo = def.value.scope === 'single'
    ? { kind: 'single' as const, characterId: props.characterId }
    : { kind: 'aoe' as const, centerCharacterId: props.characterId, radius: aoeRadius.value }

  const buff: BuffInstance = {
    id: crypto.randomUUID(),
    definitionId: def.value.id,
    snapshot,
    attachedTo,
    lifecycle: lifecycle.value,
    enabled: true,
    turnsRemaining: turnsRemaining.value ?? undefined,
    attachedAtTurn: encounter.shared.turn,
    note: note.value || undefined,
  }
  await attachBuff(props.characterId, buff)
  emit('close')
}
```

- [ ] **Step 2: canConfirm 放开**

```typescript
const canConfirm = computed(() => def.value !== null) // 不再限 single
```

- [ ] **Step 3: 手工验证**

1. Buff 库新建自定义 AoE buff(scope=aoe, defaultAoeRadius=2, modifier defense+2)
2. 在角色 Tab 点格伦 → 挂 buff → 选它 → radius 默认 2,调 3 → 预览列表即时反映
3. 确认 → 画布出圆,哥布林 A/B 徽章出现

- [ ] **Step 4: commit**

```bash
git add src/components/buffs/AttachBuffDialog.vue
git commit -m "feat(buffs): AttachBuffDialog enables AoE scope with coverage preview"
```

---

## Task 7:AoeCoverageEditor 调整 include / exclude

**Files:**

- Create: `src/components/buffs/AoeCoverageEditor.vue`
- Modify: `src/components/buffs/BuffRow.vue`

Spec §5.3:AoE buff 行有 `[👥调整覆盖]` 按钮,弹两栏编辑器。

- [ ] **Step 1: 编辑器组件**

```vue
<!-- src/components/buffs/AoeCoverageEditor.vue -->
<script setup lang="ts">
import type { BuffInstance } from '@/types/buff-v3'
import { computed, ref } from 'vue'
import { readCharacterParams, writeCharacterParams } from '@/ccfolia/firestore-writer'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { computeCoverage } from '@/core/buff/aoe'
import { applyBuffOps, updateBuff } from '@/core/buff/params-rmw'
import { useBuffsDerivedStore } from '@/stores/buffs-derived'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps<{
  buff: BuffInstance // 约束:attachedTo.kind='aoe'
  centerCharacterId: string
  open: boolean
}>()
const emit = defineEmits<{ (e: 'close'): void }>()

const characters = useRoomCharactersStore()
const pieces = usePiecesStore()
const settings = useSettingsStore()

// 自动覆盖 = 当前 radius 下在圈内的(忽略已有 override 看"自然")
const autoSet = computed<Set<string>>(() => {
  if (props.buff.attachedTo.kind !== 'aoe')
    return new Set()
  const plainBuff: BuffInstance = {
    ...props.buff,
    attachedTo: {
      kind: 'aoe',
      centerCharacterId: props.buff.attachedTo.centerCharacterId,
      radius: props.buff.attachedTo.radius,
      // 去掉 override 看自然覆盖
    },
  }
  return computeCoverage(plainBuff, pieces.list, settings.grid)
})

const allPieces = computed(() => pieces.list.map(p => p.characterId))

const includeDraft = ref<Set<string>>(new Set(props.buff.attachedTo.kind === 'aoe' ? (props.buff.attachedTo.includeOverride ?? []) : []))
const excludeDraft = ref<Set<string>>(new Set(props.buff.attachedTo.kind === 'aoe' ? (props.buff.attachedTo.excludeOverride ?? []) : []))

function toggleInclude(id: string) {
  if (includeDraft.value.has(id))
    includeDraft.value.delete(id)
  else includeDraft.value.add(id)
  includeDraft.value = new Set(includeDraft.value) // 触发响应式
}

function toggleExclude(id: string) {
  if (excludeDraft.value.has(id))
    excludeDraft.value.delete(id)
  else excludeDraft.value.add(id)
  excludeDraft.value = new Set(excludeDraft.value)
}

async function save() {
  if (props.buff.attachedTo.kind !== 'aoe')
    return
  const next: BuffInstance = {
    ...props.buff,
    attachedTo: {
      ...props.buff.attachedTo,
      includeOverride: Array.from(includeDraft.value),
      excludeOverride: Array.from(excludeDraft.value),
    },
  }
  const params = readCharacterParams(props.centerCharacterId)
  const newParams = applyBuffOps(params, [updateBuff(next)])
  await writeCharacterParams(props.centerCharacterId, newParams)
  emit('close')
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="emit('close')">
    <div class="dialog">
      <header>调整 AoE 覆盖:{{ buff.snapshot.name }}</header>
      <section>
        <h4>自动覆盖角色(勾选 = 强制排除)</h4>
        <label v-for="id in allPieces" v-show="autoSet.has(id)" :key="id">
          <input
            type="checkbox"
            :checked="excludeDraft.has(id)"
            @change="toggleExclude(id)"
          >
          {{ characters.byId(id)?.name ?? id }}
        </label>
      </section>
      <section>
        <h4>非自动覆盖角色(勾选 = 强制加入)</h4>
        <label v-for="id in allPieces" v-show="!autoSet.has(id)" :key="id">
          <input
            type="checkbox"
            :checked="includeDraft.has(id)"
            @change="toggleInclude(id)"
          >
          {{ characters.byId(id)?.name ?? id }}
        </label>
      </section>
      <footer>
        <button @click="emit('close')">
          取消
        </button>
        <button @click="save">
          保存
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: grid;
  place-items: center;
}
.dialog {
  background: #fff;
  padding: 16px;
  border-radius: 8px;
  min-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
section {
  border: 1px solid #eee;
  padding: 8px;
  border-radius: 4px;
}
section label {
  display: block;
}
footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
```

- [ ] **Step 2: BuffRow 补按钮**

```vue
<!-- BuffRow.vue 追加 -->
<script setup lang="ts">
// 追加:
import { ref } from 'vue'
import AoeCoverageEditor from './AoeCoverageEditor.vue'

const coverageEditorOpen = ref(false)
</script>

<template>
  <div class="buff-row" ...>
    <!-- ... 原有 icon/name/turns/aoe-tag/toggle/remove ... -->
    <button
      v-if="buff.attachedTo.kind === 'aoe'"
      title="调整覆盖"
      @click="coverageEditorOpen = true"
    >
      👥
    </button>
  </div>
  <AoeCoverageEditor
    v-if="buff.attachedTo.kind === 'aoe'"
    :buff="buff"
    :center-character-id="characterId"
    :open="coverageEditorOpen"
    @close="coverageEditorOpen = false"
  />
</template>
```

- [ ] **Step 3: 手工验证**

1. 挂 AoE buff,覆盖 3 人
2. 角色行展开 → AoE buff 行有 👥 按钮
3. 点 👥 → 两栏出现,自动覆盖那栏勾其中一人 → 保存
4. 该人徽章消失(exclude 生效)
5. 点 👥 → 非自动栏勾一个远处的人 → 保存
6. 远处那人徽章出现(include 生效)

- [ ] **Step 4: commit**

```bash
git add src/components/buffs/AoeCoverageEditor.vue src/components/buffs/BuffRow.vue
git commit -m "feat(buffs): AoeCoverageEditor for include/exclude override"
```

---

## Task 8:射程圈(Range Circle)

**Files:**

- Modify: `src/stores/encounter.ts`
- Create: `src/components/scene/RangeCircle.vue`
- Modify: `src/components/scene/SceneOverlayLayer.vue`
- Modify: 角色行组件(具体文件按 roster / 角色 Tab 现状)
- Create / Modify: piece 点击气泡(`src/components/scene/PiecePopover.vue` 或扩现有 popover)

射程圈 = 以某角色为中心、可开关的视觉圆,**无 buff 语义、不参与结算**,纯显示。存 `encounter.local.rangeCircles: Record<characterId, number>`,键存在 = 显示,值 = 半径(格=米)。多角色可同时开启,默认半径 3m。入口两处:(1) 角色行 `📏` 切换按钮 + 半径输入;(2) piece 点击气泡同款控件。

- [ ] **Step 1: encounter store — 用 `rangeCircles` 替换 `rulers`**

Read: `src/stores/encounter.ts`

把 Plan 04 遗留的 `RulerStub` 类型 / `rulers: RulerStub[]` state / `persistLocal` 中 rulers 的序列化 / `endCombat` 里 `this.local.rulers = []` 等整块清理。**不要在 action 里调 `persistLocal()`** —— Plan 04 已经在 `main.ts` 用 `$subscribe` 钩 `encounter.local` 变更触发 `persistLocal(state.local)`,actions 只改 state,持久化全自动。

```typescript
// src/stores/encounter.ts

// state.local 里新增(原 rulers 字段删除):
rangeCircles: {} as Record<string, number>,  // characterId → radius(格,= 米)

// actions:
toggleRangeCircle(characterId: string, defaultRadius = 3) {
  if (characterId in this.local.rangeCircles)
    delete this.local.rangeCircles[characterId]
  else
    this.local.rangeCircles[characterId] = defaultRadius
},
setRangeRadius(characterId: string, radius: number) {
  if (characterId in this.local.rangeCircles)
    this.local.rangeCircles[characterId] = radius
},
clearRangeCircles() {
  this.local.rangeCircles = {}
},
```

> 持久化说明:`$subscribe` 自动 flush 到 `sessionStorage`(key `ccs:encounter:local`,tab-local),无需手动触发。

- [ ] **Step 2: RangeCircle.vue(画布圆)**

```vue
<!-- src/components/scene/RangeCircle.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps<{
  characterId: string
  radius: number
}>()

const pieces = usePiecesStore()
const settings = useSettingsStore()

const center = computed(() => pieces.list.find(p => p.characterId === props.characterId) ?? null)
const diameterPx = computed(() => (2 * props.radius + 1) * settings.grid.cellSizePx)
const style = computed(() => {
  if (!center.value)
    return { display: 'none' }
  return {
    left: `${center.value.x - diameterPx.value / 2}px`,
    top: `${center.value.y - diameterPx.value / 2}px`,
    width: `${diameterPx.value}px`,
    height: `${diameterPx.value}px`,
  }
})
</script>

<template>
  <div class="range-circle" :style="style">
    <span class="label">{{ radius }}m</span>
  </div>
</template>

<style scoped>
.range-circle {
  position: absolute;
  border-radius: 50%;
  border: 2px dashed rgba(80, 200, 200, 0.9);
  background: rgba(80, 200, 200, 0.08);
  pointer-events: none;
  display: grid;
  place-items: center;
}
.label {
  color: rgba(80, 200, 200, 0.95);
  font-size: 12px;
  background: rgba(0, 0, 0, 0.5);
  padding: 1px 4px;
  border-radius: 3px;
}
</style>
```

颜色刻意选青色虚线,区分 AoE 的蓝实线;同角色同时挂 AoE + 开射程圈时两圈叠加视觉区分清楚。直径公式 `(2r+1) * cellSizePx` 与 AoE 圆一致,保证视觉一致。

> 项目 CLAUDE.md 要求 UnoCSS utility class 不写 scoped style。此组件和 Plan 06 已有的 `AoeCircle.vue` 保持同风格以便对照;若统一规范,可一并迁移,不在本 plan 范围。

- [ ] **Step 3: SceneOverlayLayer 追加 RangeCircle 层**

```vue
<!-- SceneOverlayLayer.vue -->
<script setup lang="ts">
// ... 既有
import { useEncounterStore } from '@/stores/encounter'
import RangeCircle from './RangeCircle.vue'

const encounter = useEncounterStore()
</script>

<template>
  <div class="overlay-root">
    <AoeCircle
      v-for="buff in buffsDerived.allAoeBuffs"
      :key="buff.id"
      :buff="buff"
    />
    <RangeCircle
      v-for="(radius, cid) in encounter.local.rangeCircles"
      :key="cid"
      :character-id="cid"
      :radius="radius"
    />
    <!-- pieces / overlay 继续 -->
  </div>
</template>
```

- [ ] **Step 4: 角色行入口(`📏` 切换按钮 + 就地半径输入)**

找角色行组件(roster / 角色 Tab 里的行,文件按项目现状),在 HP / buff 控件附近加:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useEncounterStore } from '@/stores/encounter'

const props = defineProps<{ character: CcfoliaCharacter }>()
const encounter = useEncounterStore()

const hasRange = computed(() => props.character._id in encounter.local.rangeCircles)
const currentRadius = computed(() => encounter.local.rangeCircles[props.character._id] ?? 3)
</script>

<template>
  <button
    class="icon-btn"
    :class="{ 'is-active': hasRange }"
    title="切换射程圈"
    @click="encounter.toggleRangeCircle(character._id, 3)"
  >
    📏
  </button>
  <Input
    v-if="hasRange"
    type="number"
    :model-value="currentRadius"
    min="1"
    class="w-14"
    @update:model-value="(v) => encounter.setRangeRadius(character._id, +v)"
  />
</template>
```

复用 `@/components/ui/Input.vue`(深色 UI 基调);样式走 UnoCSS class,按 CLAUDE.md 要求。

- [ ] **Step 5: piece 点击气泡入口**

- 若项目已有 piece selection popover / 气泡(查 `src/components/scene/` 与 Plan 02 `scene-mount.ts` 的事件出口),在其中追加同款 `📏` + 半径输入;建议把 Step 4 的状态读写抽成 composable `useRangeCircleToggle(characterId)`,两处复用。
- 若当前无 popover 基础设施且 Plan 02 尚未暴露 piece click 事件,本 step 可降级为 **仅保留角色行入口**,在 SceneOverlayLayer 上加 `TODO: piece 气泡入口` 注释,不阻塞 Task 8 其余部分。

- [ ] **Step 6: 手工验证**

1. 角色行点 `📏` → 画布出青色虚线圆,默认半径 3m
2. 修改半径输入 → 圆同步调整
3. 再点 `📏` → 圆消失
4. 多个角色同时开启 → 每个角色各自的圆,互不干扰
5. 同一角色同时有 AoE 圆(蓝实线)+ 射程圈(青虚线)→ 两圈叠加可辨
6. 拖 piece → 射程圈跟随中心
7. piece 气泡里同款 `📏` + 输入,效果一致(若 Step 5 未降级)
8. 刷新 tab → 射程圈保留(sessionStorage)
9. `endCombat` → 所有射程圈清空

- [ ] **Step 7: commit**

```bash
git add src/stores/encounter.ts src/components/scene/RangeCircle.vue src/components/scene/SceneOverlayLayer.vue <角色行文件> <piece 气泡文件>
git commit -m "feat(scene): per-character range circle toggle"
```

## Task 9:确认 endCombat 清空 rangeCircles

**Files:** 无改动(验证即可)

Spec §4.1 尾部 "清理本地派生态"。Task 8 Step 1 已提供 `clearRangeCircles`;本 task 确认 `endCombat` 调用它(或直接 `this.local.rangeCircles = {}`)。持久化由 `$subscribe` 自动 flush。

- [ ] **Step 1: 打开 `src/stores/encounter.ts`,确认 `endCombat` 内清空 `rangeCircles`**

若缺失,补上 `this.local.rangeCircles = {}`(或调 `this.clearRangeCircles()`)。不要加 `this.persistLocal()` —— `$subscribe` 自动处理。

- [ ] **Step 2: 手工验证**

1. 角色行开两个射程圈
2. 开战 → 射程圈保留(spec 默认)
3. `endCombat` → 射程圈全消失,画布圆全移除
4. 刷新 → 仍空(sessionStorage 已被 flush)

- [ ] **Step 3: 若有改动则 commit**

```bash
git add src/stores/encounter.ts
git commit -m "chore(encounter): ensure endCombat clears rangeCircles"
```

---

## Task 10:Plan 06 收尾验证

**Files:** 无新增

- [ ] **Step 1: 全单测**

Run: `pnpm vitest run`
Expected: 全 pass

- [ ] **Step 2: tsc + build**

Run: `pnpm tsc --noEmit && pnpm build`

- [ ] **Step 3: E2E 手工(对齐 spec §7 集成清单 1/4)**

1. 开战 → 挂 AoE 加护(radius=2)在格伦
2. 拖旁边的哥布林 piece 进圈 → 覆盖徽章出现,ActionForm 算它防御 +2
3. 拖出圈 → 徽章消失,防御恢复
4. 格伦 HP 到 0 → AoE 圆半透明,覆盖徽章灰显,ActionForm 算防御恢复基础(enabled=false 跳过)
5. 格伦复活 → 恢复
6. 调 [👥] include 一个远处角色 → 该人徽章出现
7. exclude 一个圈内人 → 该人徽章消失

- [ ] **Step 4: 有改动则 commit**

---

## 自查

- [x] `computeCoverage` 不看 `enabled`,disabled 仍返回 coverage 给 UI 灰显(spec §3.3 明文)
- [x] `resolveDefense` 的 `extraMods` 由 UI 组件从 `aoeBuffsCoveringCharacter().filter(enabled)` 注入,保持 core 纯度
- [x] AoE 中心死亡 → 批量 disable(走 Plan 05 的 `batchSetBuffsEnabledForCharacter`,中心自己身上所有 cs*buff*\* 含 AoE 一并 disable)
- [x] Exclude 优先于 Include(Task 1 单测明验)
- [x] 射程圈只存 `sessionStorage` key `ccs:encounter:local`(Plan 04 `persistLocal`),每 tab 独立,不跨 tab 串,不写 ccfolia(spec §3.6)
- [x] 射程圈在 endCombat 时清空(spec §4.1)
- [x] 射程圈无 buff 语义,不参与 `resolveDefense` 或任何结算,纯视觉
- [x] 射程圈支持多角色同时开启(`Record<characterId, number>`),和 AoE 圆色差区分(青虚线 vs 蓝实线)
- [x] Chebyshev 距离,1 格 = 1 米(硬规则 #9)
- [x] 派生 coverage 不落盘(硬规则 #5)
- [x] 视觉圆 + Chebyshev 判定的分离(spec §5.5 I1)

---

**Plan 06 结束**。下一 plan:Plan 07 · 回合推进 + 跨 tab 同步 + 战斗结束清理 + 角色 Tab 完整化。
