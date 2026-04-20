# ccfolia-sword · 需求与开发蓝图 v2.1

> **项目**:ccfolia-sword
> **版本**:v2.1(v2.0 基础上收口:写入路径从 REST :commit 换到 Firebase SDK 直调)
> **日期**:2026-04-19(v2.0)· 2026-04-19 补丁(v2.1)
> **状态**:Phase 1-4 已完成(脚手架 → ccfolia 集成 → 数据层 → 浮层面板 + 角色库),进入 Phase 5 威力表
> **文档目的**:作者自查 + AI 协作开发上下文(非对外宣传)
> **对比 v1.0**:v1.0 基于假设;v2.0 基于三轮验证的事实;v2.1 并入 Phase 2 实测修正(详见 §14)

---

## 0. 前置阅读(AI 协作者必看)

### 0.1 这个项目是什么

剑之世界 2.5 TRPG 的**战斗引擎**,以 Tampermonkey 用户脚本形式浮在 ccfolia 房间页面上,给 GM 用。

**关键词**:剑系、SW2.5、ccfolia 伴侣、Tampermonkey、Vue 3 + Shadow DOM 浮层、纯 GM 工具、战斗判定流程、webpack 运行时 hook 复用 ccfolia Firebase SDK。

### 0.2 它不是什么

- ❌ 不是独立桌面应用
- ❌ 不是 Chrome Extension
- ❌ 不是给玩家用的工具(玩家全程用 ccfolia 原生 UI,被动观看)
- ❌ 不是通用 TRPG 工具(只为 SW2.5 设计)
- ❌ 不管地图、棋子、立绘、BGM、场景、聊天(ccfolia 负责)
- ❌ 不做线上多 GM 实时协作(MVP 假设线下单人操作)

### 0.3 它的唯一职责

**ccfolia 没有的、剑系战斗需要的东西:**

1. 物理三段判定流程(命中 → 回避 → 伤害)
2. 魔法两段判定(行使 → 抵抗 → 伤害)
3. 威力表查表 + 命令语法(`k40@10+3`)
4. 先攻轨道 + 回合状态机
5. 加减值管理(Buff/Debuff,含一次性触发)
6. 状态效果追踪(中毒、麻痹等,含倒计时)
7. 战斗日志

### 0.4 设计哲学(不可妥协)

1. **工具算,GM 判** — 数值自动化,决策人工化
2. **工具记,GM 改** — 记录透明,任何数值 GM 可随时覆盖
3. **工具提醒,GM 决定** — 状态到期、被动触发都是提示,不自动执行
4. **骰子永远手动** — 工具永不代掷,GM 手动输入骰子结果
5. **ccfolia 做的 ccfolia 做,sword 做补的** — HP/MP 显示借 ccfolia 原生;buff 存 ccfolia params,sword 自己画 UI

### 0.5 生态分工(v2.0 锁定)

```
┌────────────────────────────────────────────────────────┐
│                    ccfolia(已有)                      │
│  · 房间 / 多端同步(Firestore)                         │
│  · 立绘 / 位置 / 缩放 / 平移                           │
│  · 侧边栏角色卡(HP/MP 血条)                          │
│  · 自定义网格背景图(作战斗地图)                      │
│  · 聊天(骰子、GM 播报、系统消息)                     │
│  · 场景 / BGM / 立绘差分                              │
└────────────────────────────────────────────────────────┘
                          +
┌────────────────────────────────────────────────────────┐
│              ccfolia-sword(本项目)                    │
│  · 浮层面板(Shadow DOM,Vue 3,可拖动)                │
│  · 战斗判定流程引擎(三段/两段状态机)                 │
│  · 威力表 + 命令语法(k40@10+3)                        │
│  · 先攻轨道 + 回合状态机                               │
│  · Buff/Debuff 管理(存 ccfolia params)                │
│  · 状态效果追踪 + 倒计时                               │
│  · 战斗日志(本地 GM_setValue)                         │
│  · HP/MP 写回(Firebase SDK setDoc 修改 ccfolia status)│
└────────────────────────────────────────────────────────┘
```

### 0.6 相关文档交叉引用

基础阅读顺序(第一次接手时):

1. 本文档(REQUIREMENTS v2.0)——产品需求
2. `tech/00-index.md`——技术决策索引
3. `tech/10-ccfolia-storage.md`——存储层数据模型(schema 部分仍有效,写入方案已换)
4. `tech/11-runtime-hooks.md`——运行时 Hook 架构(webpack + Redux store subscribe + Firebase SDK 直调;Fiber 仅 bootstrap 兜底。关键)

支持阅读(需要时):

- `tech/01-09*.md`——各项技术选型
- `RESEARCH_REPORT.md`——Stage 1 ccfolia 调研(实测事实)
- `TARGETED_TESTS_REPORT.md`——Stage 2 status 承载 buff 验证
- `PARAMS_TESTS_REPORT.md`——Stage 3 params 能力调研
- `TARGETED_TESTS.md` / `PARAMS_TESTS.md`——测试任务书(已执行)

---

## 1. 用户场景

### 1.1 用户画像

- **唯一用户**:跑剑之世界 2.5 的 GM
- **已有习惯**:已在用 ccfolia 跑团,熟悉 Chat Palette、骰子命令
- **技术水平**:能装 Tampermonkey
- **痛点**:ccfolia 对战斗只提供骰子,不提供判定流程编排。GM 要心算 / 纸笔追踪 Buff、Debuff、HP、状态效果、回合,容易出错

### 1.2 使用环境

**线下跑团,GM 一台笔记本开两个 ccfolia tab:**

- Tab 1(GM 操作):GM 主屏,ccfolia-sword 面板活跃,所有操作在这里进行
- Tab 2(玩家视图):投屏给玩家看,ccfolia 原生界面,**ccfolia-sword 面板不显示**(脚本识别到非主 tab 时静默)

玩家全程观看 Tab 2,不触碰 GM 的笔记本。

**MVP 明确不支持的场景**:

- 线上跑团(玩家各自电脑连 ccfolia)
- 多个 GM 同时操作同一房间
- 一个 GM 同时操作多个房间

### 1.3 典型战斗流程(从 GM 视角)

```
[战前]
  1. GM 在 ccfolia 开房间,正常跑剧情
  2. 战斗触发 → GM 点 ccfolia-sword 面板上的"开始战斗"
  3. 面板展开 → 从 sword 内部的角色库拖 PC/怪物到参战者列表
  4. GM 拖拽排序先攻 → 确认 → 进入 R1

[战斗中:物理攻击]
  5. R1 轮到格伦 → 面板高亮格伦
  6. GM 点"攻击" → 选目标 哥布林A
  7. 面板进入 "等待命中" 状态,显示加值提示(格伦身上祝福 +1)
  8. 玩家在 ccfolia 聊天框掷 2d6+6+1,报数 13
  9. GM 在面板输入 13 → 面板显示 "请掷回避"
  10. GM 在 ccfolia 掷哥布林 A 回避,报数 10
  11. GM 在面板输入 10 → 面板判定命中 → 进入伤害阶段
  12. 玩家 / GM 掷伤害 11(或用 k40@10+3 语法算)
  13. GM 输入 11 → 面板自动算 9 最终伤害 → 写 ccfolia status(哥布林 A HP - 9)
  14. ccfolia 立绘血条自动缩短(原生)→ 玩家 Tab 2 看到
  15. 日志记录 "[R1] 格伦→哥布林A 命中13 回避10 伤害9(最终9)"

[战斗中:挂 Buff]
  16. GM 觉得需要给格伦"祝福 3 回合"
  17. 点格伦 → "添加 Buff" → 选"祝福"或自定义
  18. 面板写 params:新增 cs_buff_<uuid> = {name:祝福, lifecycle:{kind:turns,remaining:3}, modifiers:[...]}
  19. ccfolia 聊天不刷屏(写 params 无副作用)
  20. 面板上 格伦 卡片显示祝福图标 + "3R"

[战斗中:状态效果倒计时]
  21. R2 开始 → 面板自动对所有 lifecycle=turns 的 buff remaining -= 1
  22. 一次 updateDoc(或多角色并发 writeBatch)更新该角色所有 buff 的 params
  23. 到 0 的 buff 自动移除

[战斗结束]
  24. 敌方全灭 → GM 点"结束战斗"
  25. 面板显示各 PC 最终 HP/MP(已写回 ccfolia status,GM 不用手动同步)
  26. 所有 cs_buff_* params 自动清理(战斗结束 buff 无意义)
  27. 战斗日志归档到 GM_setValue
```

---

## 2. 技术决策集(引用 tech/ 目录)

| #   | 项           | 决策                                                                                     | 细节                |
| --- | ------------ | ---------------------------------------------------------------------------------------- | ------------------- |
| 1   | 形态         | Tampermonkey userscript                                                                  | —                   |
| 2   | 构建         | Vite + vite-plugin-monkey                                                                | tech/01             |
| 3   | UI 框架      | Vue 3                                                                                    | tech/02             |
| 4   | 状态         | Pinia + core 纯函数分层                                                                  | tech/03             |
| 5   | 样式         | UnoCSS + presetUno + presetIcons                                                         | tech/04             |
| 6   | 语言         | TypeScript 严格模式                                                                      | tech/05             |
| 7   | 测试         | Vitest(仅 core)                                                                          | tech/06             |
| 8   | 代码质量     | @antfu/eslint-config                                                                     | tech/07             |
| 9   | 打包         | 全内联 + GM_setValue                                                                     | tech/08             |
| 10  | 版本控制     | GitHub 公开 + MIT + SemVer                                                               | tech/09             |
| 11  | ccfolia 存储 | 方案 M,HP/MP→status,buff→params                                                          | **tech/10(schema)** |
| 12  | 运行时 hook  | webpack 注入 + Redux store subscribe + Firebase SDK 直调(Fiber 仅 bootstrap 兜底)        | **tech/11(关键)**   |
|     | ├ 契约 1     | `webpackChunkccfolia` setter 劫持 → 拿 `__webpack_require__`                             | tech/11 §1          |
|     | ├ 契约 2     | 源码指纹扫 `wreq.m`(`"setDoc"`、`"no-app"`、`container.getProvider`)→ 拿 Firebase SDK    | tech/11 §1          |
|     | ├ 契约 3     | `_getProvider(app,'firestore').getImmediate({identifier:'(default)'})` → ccfolia db 实例 | tech/11 §1          |
|     | └ 契约 4     | React Fiber 爬 `<Provider>` 拿 Redux store → `subscribeSlice` 订阅数据                   | tech/11 §2          |

---

## 2A. 运行时 Hook 架构(摘要)

> 本节是 tech/11 的一页纸摘要。AI 协作改数据读写路径、或者 ccfolia 升级 debug 时先看这里;细节走 tech/11。

### 为什么不走 REST :commit(v2.0 原方案 γ,已废弃)

- UI 有 200-500ms 延迟:REST 写完要等 ccfolia 的 Listen/channel 把同一份数据推回来,onSnapshot 才刷
- streamToken 冷启动:sword 启动后必须等 GM 先在 ccfolia 操作一次才能嗅到 token
- 两套会话并行:REST 和 ccfolia 的 Write/channel 不同步,RID 错位会让 ccfolia 本地崩

改走 ccfolia 自家的 Firebase SDK 后,以上三条全部消失。

### 四层契约(ccfolia 升级时按这四层定位哪层断了)

| #   | 契约                                                                                                               | 失效信号                      | 处理                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------- |
| 1   | `webpackChunkccfolia` setter 劫持(必须 `@run-at document-start`)拿到 `__webpack_require__`                         | `__CCS_WEBPACK__.wreq = null` | ccfolia 换了构建策略,需重查 chunk 名                                               |
| 2   | 源码指纹扫 `wreq.m`:`"setDoc"`、`"doc"+"path"`、`"no-app"+appName`、`container.getProvider` 识别 Firebase SDK 函数 | 指纹 miss(dbFound: false)     | Firebase 大版本升级(v10→v11)重打指纹;小版本通常稳定                                |
| 3   | `_getProvider(app,'firestore').getImmediate({identifier:'(default)'})` 拿 ccfolia 已初始化的 db 实例               | `db` undefined 或抛错         | ccfolia 改用 getFirestore 后可简化;否则保留此路径(getFirestore 被 tree-shake 掉了) |
| 4   | React Fiber 爬 `<Provider>` 拿 Redux store,`subscribeSlice` 选择 `state.entities.roomCharacters` 订阅              | store 找不到 / slice 路径变   | react-redux 大改版;或 ccfolia 改 slice 命名                                        |

### 数据流

- **读**:ccfolia Firestore → ccfolia 自家 onSnapshot → ccfolia Redux store → `subscribeSlice` → sword Vue ref(0ms 推送)
- **写**:sword UI → `optimisticUpdateCharacter` dispatch Redux(UI 0ms 反映)→ SDK `setDoc` → ccfolia 自家本地 cache 标 `hasPendingWrites=true` → mutation 塞进 ccfolia 现有 Write/channel → 最终 onSnapshot 刷同值(幂等)
- **失败回滚**:SDK 抛错 → dispatch 回原值;成功时服务端值覆盖本地(一致性由 SDK 保证)

### 自写回路不闪烁(容易踩的隐含前提)

sword 自己 dispatch 后,`subscribeSlice` 也会被通知 — 但 RTK/Immer 保证未变子树复用原引用,且我们 dispatch 的是同一个完整 entity 对象,`Object.is` 比较直接 false positive 跳过,`subscribeSlice` 不 tick。所以"写 → 自触发回调 → 重设 Vue ref → 闪烁"不会发生。这是 `subscribeSlice` 用 `Object.is` 而不是深比较的前提条件 — 改这个比较逻辑前先想清楚。

### 兜底

Fiber reader(`src/ccfolia/fiber-reader.ts`)只在 store 未就位时轮询,一旦 `subscribeSlice` 成功立刻停用。不允许把 Fiber 当主读路径。

---

## 3. 数据模型

### 3.1 层次关系

```
ccfolia 真相源(存在 Firestore,跨 tab 同步由 ccfolia SDK 原生负责,sword 不参与订阅)
  └─ character 对象(每个立绘一个)
      ├─ status[]  ← sword 写 HP/MP
      └─ params[]  ← sword 写 cs_buff_*, cs_part_*, cs_meta

      ↑ sword 通过 ccfolia 的 Redux store subscribe 实时读
        (state.entities.roomCharacters,subscribeSlice 只在引用变化时 tick)
        Fiber reader 仅 bootstrap 兜底 — store 未就位时轮询,成功后停用

GM_setValue 本地存储(不同步到其他 tab 和设备)
  ├─ 角色模板库(CharacterTemplate[])
  ├─ 威力表库(PowerTable[])
  ├─ 状态效果定义库(StatusEffectDefinition[])
  ├─ 当前战斗会话(Encounter)
  ├─ 战斗历史归档
  └─ 用户设置

sword 运行时状态(Pinia,内存,派生)
  └─ 从 ccfolia + GM_setValue 合并而来,战斗引擎操作这个
```

### 3.2 角色统一模型(Character)

PC / NPC / 召唤物 / 怪物 / 多部位怪物都用这一个结构,区别仅在 faction / control / parts 的有无。

**存储形态(可序列化,双形态):**

```typescript
interface StoredCharacter {
  // 共同字段
  id: string // sword 内部 ID
  ccfoliaCharacterId?: string // 对应 ccfolia character._id(导入时绑定)
  name: string
  nickname?: string
  faction: 'friendly' | 'enemy' | 'neutral'
  control: 'pc' | 'gm'
  memo?: string

  classes: CharacterClass[]
  skills: Skill[] // 合并了战技/魔法/特技/被动
  equipment: Equipment
  inventory: InventoryItem[]
  gold?: number
  palette: PaletteCategory[]

  // 形态 A:单部位(绝大多数 PC 和怪物)
  hp?: { current: number, max: number }
  mp?: { current: number, max: number }
  abilities?: AbilityScores
  combat?: { evasion: number, lifeResistance: number, mentalResistance: number, armor: number }
  defaultInitiative?: number

  // 形态 B:多部位(v1.1+ 激活)
  parts?: CharacterPart[]
}

interface CharacterPart {
  id: string
  name: string // "本体" / "头" / "胴"
  hp: { current: number, max: number }
  mp: { current: number, max: number }
  abilities: AbilityScores
  combat: { evasion: number, lifeResistance: number, mentalResistance: number, armor: number }
  defaultInitiative?: number
}
```

**运行时形态(Pinia 内,永远 normalized):**

```typescript
interface RuntimeCharacter {
  id: string
  ccfoliaCharacterId?: string
  name: string
  // ... 共同字段

  parts: CharacterPart[] // 永远至少 1 个(单部位 = 长度 1)
  isMultiPart: boolean
  primaryPartId: string // 主部位 ID
}
```

**规则**:

- 加载时(GM_setValue → 运行时):`normalizeCharacter(stored) → runtime`
- 保存时(运行时 → GM_setValue):`denormalizeCharacter(runtime) → stored`
- 战斗引擎全部基于 `RuntimeCharacter`,不感知双形态
- **MVP 只写单部位路径**:`parts` 总是长度 1,`isMultiPart=false`

### 3.3 Combatant(战斗参战者)

```typescript
interface Combatant {
  id: string // uuid,每个战斗新生成
  characterId: string // 引用 StoredCharacter
  partId: string // 引用 RuntimeCharacter.parts[i].id
  snapshot: CharacterPart // 战斗开始时 part 的快照
  display: {
    name: string // "格伦" / "龙·头"
    color?: string
  }

  // 战斗态
  currentHp: number
  currentMp: number
  modifiers: Modifier[] // 内存,不持久到 ccfolia(sword 算完直接应用,不挂 Buff 时不进 params)
  statusEffects: StatusEffectInstance[] // 同步到 ccfolia params(玩家不可见但跨 tab)
  hasActed: boolean
  downed: boolean
}
```

**重要**:Combatant 指向 part,不指向 character。

### 3.4 Modifier / StatusEffect 结构

引用 `tech/10-ccfolia-storage.md` 里的 `BuffPayload` schema 作为权威定义。

Modifier 是数值层概念:`{target, value, source, lifecycle}`。
StatusEffect 是语义层概念:`{name, icon, bundledModifiers, hooks}`。
StatusEffect 挂到角色上就成为一个 StatusEffectInstance,对应 ccfolia 里一条 `cs_buff_*` param。

(详细 schema 参见 tech/10,本文不重复。)

### 3.5 PowerTable

```typescript
interface PowerTable {
  id: string
  name: string // "SW2.5 标准威力表"
  description?: string
  // 二维表:[powerValue][dice2d6Result] => damage
  entries: Array<{
    power: number
    rolls: number[] // 长度 11,索引 0=2 ... 10=12
  }>
}
```

**存储位置**:GM_setValue(`ccs:powertable:<id>`)。sword 不内置官方威力表(版权),GM 自导入。

### 3.6 Encounter

```typescript
interface Encounter {
  id: string
  name: string
  startedAt: string // ISO datetime
  endedAt?: string
  combatants: Combatant[]
  turnOrder: string[] // combatant ids
  currentRound: number
  currentTurnIndex: number
  phase: EncounterPhase
  pendingRoll?: PendingRoll
  log: LogEntry[]
}

type EncounterPhase = 'pre-battle' | 'round-start' | 'action' | 'round-end' | 'ended'

interface PendingRoll {
  combatantId: string
  phase: CombatPhase
  expression?: string
  modifiersReminder: string[]
  targetValue?: number
  targetCombatantId?: string
}

type CombatPhase = 'attack' | 'evasion' | 'damage' | 'casting' | 'resist-life' | 'resist-mental' | 'generic'

interface LogEntry {
  id: string
  round: number
  timestamp: string
  type: 'action' | 'roll' | 'damage' | 'status' | 'modifier' | 'manual' | 'note'
  text: string
  relatedIds?: string[]
}
```

**存储位置**:活跃 encounter 在 Pinia state,持久化到 `ccs:store:encounter`(debounce 300ms)。结束后归档到 `ccs:encounter:history:<id>`。

---

## 4. 战斗判定流程(状态机)

### 4.1 物理三段

```
[choose-target] GM 选攻击方 + 目标(Combatant 粒度)
       ↓
[await-attack] pendingRoll.phase='attack',显示 attack modifiers 提示
       ↓ GM 输入命中值 N
[await-evasion] pendingRoll.phase='evasion',targetValue=N
       ↓ GM 输入回避值 M
[compare]
       ├─ M >= N → miss → 记 log,回 action
       └─ M < N → hit → 进伤害
       ↓
[await-damage] 支持 k 语法输入
       ↓ GM 输入伤害值 D
[apply-damage]
       ├─ 最终伤害 = max(0, D - targetCombatant.snapshot.combat.armor)
       ├─ 调用 ccfolia writer:setDoc 更新 status(把对应角色 HP -= 最终伤害)
       ├─ 本地 combatant.currentHp -= 最终伤害
       ├─ 若 currentHp ≤ 0 → downed = true,自动挂"行动不能"状态效果
       ├─ 消费 attacker 的所有 lifecycle.kind='once' + target='damage' modifiers
       ↓
[done] 回 action,准备下一动作
```

**注意多部位**:combatant.partId 决定扣哪个部位的 HP。ccfolia status 只挂 primaryPart 的 HP(MVP 全是 primaryPart)。

### 4.2 魔法两段 + 伤害

```
[choose-spell] 选施法方 + 魔法 + 目标(可多个)
       ↓
[consume-mp] currentMp -= mpCost,setDoc 写回 ccfolia status(MP 字段)
       ↓
[await-casting] 等魔法行使骰
       ↓
[await-resist-per-target] 对每个目标单独等抵抗骰
       ↓(全部完成)
[await-damage] 若魔法有伤害
       ↓
[apply-damage]
       ├─ 对每个目标:抵抗成功 → 半伤 / 无效(按魔法规则)
       ├─ 抵抗失败 → 全额 - 魔防
       ├─ 用 writeBatch 批量更新各目标 status(一次提交)
       ↓
[done]
```

### 4.3 状态机实现

用 XState 过重,手写 `EncounterPhase` + `pendingRoll` 字段 + 纯 reducer 即可。

```typescript
// src/core/combat/state-machine.ts
export function submitRoll(encounter: Encounter, value: number): Encounter
export function beginAttack(encounter: Encounter, attackerId: string, targetId: string): Encounter
export function beginSpell(encounter: Encounter, casterId: string, spellId: string, targetIds: string[]): Encounter
export function endTurn(encounter: Encounter): Encounter
export function addModifier(encounter: Encounter, combatantId: string, mod: Modifier): Encounter
// ...
```

单测覆盖这些函数,详见 `tech/06-testing.md`。

---

## 5. 威力表命令语法

### 5.1 语法(沿用 sw25-fvtt)

```
k<威力>[@<暴击>][修正...]
```

| 片段            | 含义             | 默认 |
| --------------- | ---------------- | ---- |
| `k<N>`          | 威力值(必填)     | —    |
| `@<N>`          | 暴击值           | 10   |
| `+<N>` / `-<N>` | 修正             | 0    |
| `h` / `h±N`     | 半减,暴击改 13   | —    |
| `#<N>`          | 必杀攻击威力+N   | 0    |
| `$±<N>`         | 克里蒂卡雷修正   | 0    |
| `$f+<N>`        | 首次掷骰固定为 N | —    |
| `tf<N>`         | 单骰固定为 N     | —    |
| `r<N>`          | 处刑者之刃威力+N | 0    |

### 5.2 解析求值

```typescript
function parsePowerCommand(input: string): ParsedPowerCommand
function rollPowerCommand(
  parsed: ParsedPowerCommand,
  table: PowerTable,
  dice: [number, number] // GM 输入的 2d6
): { baseDamage: number, total: number, breakdown: string }
```

### 5.3 Apply 按钮(结果卡上)

| 按钮 | 含义                   |
| ---- | ---------------------- |
| PDMG | 物理:D − 目标防护 → HP |
| MDMG | 魔法:D − 目标魔防 → HP |
| FDMG | 固定:直接 − HP         |
| HPR  | HP 回复                |
| MPR  | MP 回复                |

### 5.4 重算按钮

Half / Half Critical / No C — 基于已输入的 2d6 结果重新计算。

---

## 6. 加减值系统(Modifier)

### 6.1 Target 维度

`attack` | `evasion` | `damage` | `casting` | `resist-life` | `resist-mental` | 六能力各一 | `armor` | `max-hp` | `max-mp` | `custom`

### 6.2 Lifecycle

```typescript
type ModifierLifecycle
  = | { kind: 'permanent' }
    | { kind: 'turns', remaining: number }
    | { kind: 'once', consumed: boolean }
    | { kind: 'manual' }
```

### 6.3 工作方式(核心原则)

- **工具只提示,不自动加**(引用 §0.4 #1)
- 掷骰等待阶段,UI 列出相关 target 的 modifiers
- GM 心算后输入最终值
- `lifecycle.kind='once'` 的 modifier 在对应 phase 完成后标记 consumed
- `lifecycle.kind='turns'` 的 modifier 在回合结束时 remaining -= 1,到 0 移除

### 6.4 存储位置

- **非 buff 附带的 modifier**(如临时 GM 手加"+2 命中"):**只在 Pinia 内存**,不写 ccfolia params
- **Buff 附带的 modifier**:随 `cs_buff_*` param 整体存(BuffPayload.modifiers),跨 tab 同步

---

## 7. 状态效果(StatusEffect)

### 7.1 与 Modifier 的关系

- StatusEffect 是语义包装:"中毒" = 图标 + 描述 + 一组 modifiers + 钩子
- 挂载 StatusEffect 时,写一条 `cs_buff_*` param,展开成完整的 BuffPayload
- 运行时从 params 解析,暴露为 StatusEffectInstance

### 7.2 内置状态库

MVP 预置:中毒、麻痹、睡眠、混乱、魅惑、恐怖、石化、祝福、加护、加速、隐身、行动不能、濒死、狂化。

GM 可新增自定义状态(存 GM_setValue 的 StatusEffectLibrary)。

### 7.3 玩家可见性

**MVP**:玩家**不可见**具体 buff(ccfolia params 不在玩家侧边栏渲染)。

- GM 面板看到完整 buff 列表(图标 + 名字 + 倒计时 + 描述)
- 玩家需要知道 buff 时,GM 口述或在聊天手动播报

**v1.1+**:考虑在 ccfolia status 里塞一条 "buff 摘要" 供玩家看(如 `{label:"状态", value:3, max:10}` 表示 3 个 buff),但细节 v1.1 再定。

---

## 8. Chat Palette

### 8.1 说明

Sword 内部 Palette,和 ccfolia palette **不共享**。

- 用途:玩家角色卡里的指令模板,点一下触发战斗判定流程或通用判定
- 存储:作为 StoredCharacter.palette 字段(MVP)

### 8.2 语法

```
<表达式> <动作名> [#分类]

示例:
2d6+{冒险者等级}+{灵巧度加值} 灵巧判定
```

变量:`{xxx}` → 从 `character.abilities.X.value/bonus` 等字段解析。

特殊前缀:

- `:HP+5` / `:HP-5` / `:HP=20` 命令式改 HP(**MVP 不实现** —— 改 HP 走战斗引擎,不走 palette)
- `:MP±N` 同

### 8.3 绑定战斗流程

palette 命令可声明 `bindsTo`:

```typescript
interface PaletteCommand {
  expression: string
  label: string
  category?: string
  bindsTo?: 'attack' | 'evasion' | 'damage' | 'casting' | 'resist-life' | 'resist-mental' | 'generic'
}
```

绑定战斗 phase 时,点击自动触发对应状态机迁移。

---

## 9. 模块清单与优先级

### 9.1 MVP 模块(必须)

| ID       | 模块                                                                                                        | 估算(全职人日)                                         |
| -------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| M0       | Phase 1 脚手架(Vite + Vue + UnoCSS + Shadow DOM + Pinia)                                                    | 2-3                                                    |
| M1       | ccfolia 基础设施(Webpack hook + Redux store subscribe + Firebase SDK writer;Fiber reader 仅 bootstrap 兜底) | 2-2.5(✅ 已实现,剩 writer 封装)                        |
| M2       | 数据模型 + 持久化(角色模板、威力表、状态库)                                                                 | 3                                                      |
| M3       | 浮层面板基础(可拖动、可收起、Shadow DOM 样式)                                                               | 3                                                      |
| M4       | 角色管理 UI(列表、JSON 导入导出,最简表单)                                                                   | 4                                                      |
| M5       | 威力表管理 + k 语法解析器 + 计算器 UI                                                                       | 3                                                      |
| M6       | 战斗开启 + 先攻排序 UI                                                                                      | 2                                                      |
| M7       | 回合状态机 + Phase 流转                                                                                     | 3                                                      |
| M8       | 物理三段判定 UI + 流程                                                                                      | 4                                                      |
| M9       | 魔法两段判定 + 群体目标                                                                                     | 4                                                      |
| M10      | Apply / 重算按钮                                                                                            | 2                                                      |
| M11      | Modifier CRUD + 提示展示                                                                                    | 3                                                      |
| M12      | StatusEffect 库 + 挂载 / 倒计时 / 周期 prompt                                                               | 4                                                      |
| M13      | Chat Palette 存储 + 解析 + 绑定战斗流程                                                                     | 3                                                      |
| M14      | 战斗日志(只读显示)                                                                                          | 2                                                      |
| M15      | 设置面板 + 导入导出                                                                                         | 2                                                      |
| —        | 集成 + 调试 + 真实跑团测试                                                                                  | 5-8                                                    |
| **合计** |                                                                                                             | **~51-55 人日 ≈ 10-11 周全职**(M1 已完成,从总量里减掉) |

### 9.2 相对 v1.0 的估算修正

- v1.0 估算:10 周全职
- Stage 2 后修正:6-7 周(方案 A+ 简化)
- Stage 3 后重新评估:**11-12 周**(实际)

**为什么又变长?**

- ~~M1(ccfolia 基础设施)比预期重:token sniffer、Firestore writer、错误处理~~ 已消解:webpack hook 直接拿到 ccfolia 自己的 db 实例,不需要 token sniffer;SDK 自带重试。M1 实测 2-2.5 人日完成
- M3(浮层面板)的 Shadow DOM + UnoCSS 集成可能有坑
- 多部位预留(数据模型双形态 + normalize)虽然 UI 不做,但数据层要打好地基
- 真实跑团测试 5-8 天是保守估算(用户体验调优多半在这块)

**当前估算 10-11 周即含典型踩坑预算**(原 11-12 周已扣除 M1 实测节省的 2 人日)。

### 9.3 Post-MVP 模块

v1.1(首次迭代):

- 简单撤销
- 战后结算(经验/战利品)
- ccfolia palette 文本粘贴导入器
- 多部位 UI + 流程
- 玩家侧边栏 buff 摘要显示

v1.2+(长期):

- YutoSheetII JSON 导入
- 跨战役持久化 PC
- 遭遇构筑器
- 主题定制

### 9.4 明确砍掉(永不实现)

- 战斗地图 / 棋子 / 网格(ccfolia 自定义网格图已够用)
- 双屏 / 玩家视图独立渲染 / 竖屏副屏(ccfolia 双 tab 已够用)
- 日常模式 / 场景 / 立绘 / BGM(ccfolia 原生)
- 骰子自动捕获(原则)
- 规则强制校验 / 自动移动合法性 / 视线遮挡
- 账号系统 / 云同步 / 多设备
- 移动端适配
- 线上多人协作 / 乐观并发控制(MVP 范围外,v2 也不打算做)

---

## 10. 开发顺序建议

```
Phase 1 · 基础设施(2-3 人日)
  - M0 脚手架搭建(Vite + vue-plugin-monkey + Vue + TS + UnoCSS)
  - 验证 UnoCSS + Shadow DOM 注入能工作(最大技术风险,tech/04 有三条退路)
  - 在 ccfolia 页面成功显示 "Hello World" 浮层

Phase 2 · ccfolia 集成(✅ 已完成,2-2.5 人日实测)
  - M1 Webpack hook + Redux store subscribe(已落地,src/ccfolia/{webpack-hook,redux-store,fiber-reader}.ts)
  - M1 Firebase SDK writer(setDoc/updateDoc/writeBatch,复用 ccfolia db 实例)
  - M1 Fiber reader(仅 bootstrap 兜底 — store 未就位时临时用,subscribe 成功后停用)
  - 端到端验证:脚本能改一个角色的 HP + 挂一个 buff,刷新后保留

Phase 3 · 数据层(✅ 已完成,3 人日)
  - M2 GM_setValue 封装 + Pinia 适配器
  - M2 CharacterTemplate / PowerTable / StatusEffectDefinition 的 CRUD

Phase 4 · 浮层面板 + 角色管理(✅ 已完成,7 人日)
  - M3 可拖动 / 可折叠 / 双 Tab 的 Shadow DOM 浮层;host 被 React 卸载后自动重挂
  - M4 角色库 CRUD:列表 / 单部位表单 / JSON 导入(id 冲突 skip)/ 导出 / 样例数据

Phase 5 · 威力表模块(3 人日)⭐ 独立可发布的里程碑
  - M5 威力表导入 + k 语法 + 计算器 UI
  - 这个完成就是 **v0.1.0**,可以给朋友试用

Phase 6 · 战斗骨架(5 人日)
  - M6 开战 + 先攻排序
  - M7 回合状态机

Phase 7 · 战斗核心(10 人日)⭐ 最关键
  - M8 物理三段
  - M9 魔法两段 + 群体
  - M10 Apply / 重算

Phase 8 · 加减值与状态(7 人日)
  - M11 Modifier
  - M12 StatusEffect
  - 这一阶段大量涉及 params updateDoc/writeBatch 写入,verify 和 ccfolia 的交互稳定

Phase 9 · 收尾(8 人日)
  - M13 Palette
  - M14 日志
  - M15 设置
  - 真实跑团测试 + bug 修复

—— v1.0.0 MVP 完成 ——
```

**里程碑检查点**:

- Phase 1 完 → 技术可行性验证
- Phase 2 完 → 最大技术风险已过
- Phase 5 完 → **第一个对外可用的 v0.1.0**(威力表计算器)
- Phase 7 完 → 可跑真实战斗(无 buff)
- Phase 9 完 → **MVP v1.0.0**

---

## 11. 风险清单(v2 更新版)

### 11.1 工程风险(已测试但仍要警惕)

**R1 · UnoCSS + Shadow DOM 注入** ⚠️ 最高优先级

- `virtual:uno.css?inline` 在 vite-plugin-monkey 打包后未实测
- 已有三条退路(tech/04)
- Phase 1 第一天必须排查

**R2 · ~~Firestore streamToken 冷启动~~** ✅ 已消除

- 原方案(REST :commit + Proxy fetch 捕获 streamToken)依赖 GM 先在 ccfolia 操作一次才能写
- 已换成 webpack 运行时 hook 直接拿 ccfolia 自己的 db 实例(`_getProvider(app,'firestore').getImmediate(...)`),auth 天然绑定
- 不存在冷启动问题。详见 tech/11

**R3 · ccfolia 升级打破假设**

- 已记录 v1.34.2 作基线
- tech/10 附录有 schema 检查清单
- 升级冒烟同时走 §2A 四层契约(tech/11),按"失效信号"列定位哪层断:
  1. `__CCS_WEBPACK__.wreq` 为 null → chunk setter 劫持失败
  2. `dbFound: false` → 源码指纹 miss(Firebase 大版本升级最可能)
  3. db 实例抛错 → `_getProvider` 路径被换
  4. Redux store 找不到 / slice 路径变 → react-redux 大改或 ccfolia 改 slice 命名
- 每次 ccfolia 升级跑一次冒烟测试(读 + 写 HP + 挂/解 buff)

**R4 · React 重渲染清理浮层**(风险已收窄)

- 角色列表读取现在走 Redux store subscribe,不依赖 DOM / MutationObserver
- MutationObserver 的唯一剩余职责:保证 Shadow DOM 宿主节点存活(React 重渲染时若被卸载就重挂)
- 风险等级从"高"降到"低"——就算 observer 失效,最坏情况是浮层节点被清掉一次,重挂即可;不影响数据正确性

### 11.2 需求风险

**R5 · 多部位 UI 推后的债**

- MVP 只写单部位路径,但数据模型已含双形态
- v1.1 写多部位 UI 时,必须验证 normalize 设计没漏洞
- 应对:core 状态机全部测试用 parts[] 视角,不走单部位捷径

**R6 · 8 条 status 限制 + 多部位**

- 多部位要在 status 里显示多部位 HP 会占多条槽位
- MVP 只显 primaryPart HP,其他部位 HP 只在 sword 面板可见
- v1.1 再讨论玩家可见性策略

**R7 · 剑系规则差异**

- SW2.0 / SW2.5 / 自制系统规则有差
- MVP 以 SW2.5 主流玩法为准,边缘规则 GM 手动覆盖

### 11.3 合规风险

- 威力表、怪物数据不内置(版权)
- 纯工具,不分发任何版权内容
- 明确标注"非官方第三方工具"

---

## 12. 关键边界(工具 vs GM 职责)

| 事情              | 工具     | GM     | 说明                     |
| ----------------- | -------- | ------ | ------------------------ |
| 掷实体骰          | ❌       | ✅     | 工具永不代掷             |
| 接收骰子结果      | ✅       | —      | 输入框                   |
| 对比命中 vs 回避  | ✅       | —      | 自动判定                 |
| 对比行使 vs 抵抗  | ✅       | —      | 自动判定                 |
| 查威力表          | ✅(可选) | ✅     | GM 自查也行              |
| 减防护            | ✅       | —      | 自动                     |
| 扣 HP(写 ccfolia) | ✅       | —      | 自动                     |
| 扣 MP(写 ccfolia) | ✅       | —      | 自动                     |
| 状态倒计时        | ✅       | —      | 自动                     |
| 持续伤害掷骰      | ❌提示   | ✅     | 工具弹 prompt            |
| 被动技能触发      | ❌提示   | ✅     | 工具弹提示               |
| 加减值应用        | ❌展示   | ✅手加 | 工具只展示               |
| 数值修改          | ❌       | ✅随时 | GM 可覆盖                |
| 先攻排序          | ❌       | ✅拖拽 | GM 决定                  |
| buff 挂载 / 移除  | ✅       | ✅触发 | GM 决定挂,工具管生命周期 |

---

## 13. AI 协作接手指引

### 13.1 必读的硬规则(不要讨论,照做)

1. **不是通用 TRPG 工具**——只针对 SW2.5
2. **不扩展 scope**——§9.4 砍掉项不要加回
3. **骰子永远 GM 手动**——违反 §0.4 #4
4. **ccfolia 写操作走 Firebase SDK**(`setDoc`/`updateDoc`/`writeBatch`,复用 ccfolia 自己的 db 实例)——不走 DOM onChange 改 status(会刷屏聊天),也不走 REST PATCH(有 200-500ms UI 回环)
5. **HP/MP 写 status,buff 写 params**——方案 M 固定
6. **读角色列表走 Redux store subscribe**(`subscribeSlice` on `state.entities.roomCharacters`)——不要轮询 Fiber。Fiber reader 只在 store 未就位时 bootstrap 兜底,subscribe 成功后必须停用
7. **Userscript 约束**——体积敏感(< 500KB),无 dynamic import,CSP 可能限制

### 13.2 接手时应附上的上下文

- 当前模块编号(M0-M15)
- 相关数据模型(从 §3 抄)
- 相关状态机(从 §4 抄)
- ccfolia 存储细节(tech/10 对应章节)

### 13.3 代码风格(tech/05-07 已详述)

- TypeScript 严格模式
- 函数式优先
- 单文件 < 300 行
- 业务和 UI 分离
- 核心逻辑写 Vitest 单测

---

## 14. 决策记录(溯源)

本项目是从《剑系 TRPG GM 离线辅助工具》v1.4 → ccfolia-sword v1.0 → 经过三轮调研 → v2.0 的演化结果。

关键决策锁定:

| 决策                 | 版本        | 结论                                                                            |
| -------------------- | ----------- | ------------------------------------------------------------------------------- |
| 形态                 | v1.0        | Tampermonkey(非独立应用 / 非 Extension)                                         |
| 竖屏副屏             | v1.0        | 不做(ccfolia 双 tab 解决)                                                       |
| 战斗地图             | v1.0        | 不做(ccfolia 自定义网格图解决)                                                  |
| 骰子自动捕获         | v1.0        | 不做(GM 手动输入)                                                               |
| 离线                 | v1.0        | 不做(依赖 ccfolia 在线)                                                         |
| ccfolia 存储方案     | v2.0        | **方案 M**(HP/MP→status,buff→params)                                            |
| 多部位架构           | v2.0        | 双存储形态 + 运行时 normalize 为 parts[]                                        |
| 多部位 UI 优先级     | v2.0        | MVP 只写单部位路径,v1.1+ 激活                                                   |
| 乐观并发控制         | v2.0        | MVP 不做,接受线下单人操作假设                                                   |
| ~~streamToken 策略~~ | v2.0 → v2.1 | ~~Proxy 包 fetch 被动捕获(方案 γ)~~ 已废弃                                      |
| 写入路径             | v2.1        | **Webpack 运行时劫持 → 直接复用 ccfolia db 实例,SDK setDoc/updateDoc**(tech/11) |
| params 多部位存法    | v2.0        | 按部位拆多条(方式 B)                                                            |

---

**文档结束 · v2.0**
