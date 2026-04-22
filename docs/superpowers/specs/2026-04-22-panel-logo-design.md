# Panel Logo Component — Design

**Date**: 2026-04-22
**Status**: Approved (pending spec review)

## 目标

用一个自定义 logo 图（`https://i.imgur.com/M5ZRBm4.png`）替换 PanelShell 标题栏和 PanelLauncher 当前使用的 `i-lucide-sword` icon。图片加载失败时自动回落到 sword icon。PanelShell 标题栏右侧增加 "by rara" credit。

## 适用范围

- 替换：`src/components/shell/PanelShell.vue:83`、`src/components/shell/PanelLauncher.vue:16`
- 新增：`src/components/ui/Logo.vue`、PanelShell 标题栏 credit 文本
- 不动：任何其它 `i-lucide-*` 图标、userscript meta（不加 `@resource` / `@grant`）

## 组件 API

```vue
<Logo :size="16" class="text-hp" />    <!-- PanelShell 标题 -->
<Logo :size="18" subtle />              <!-- PanelLauncher -->
```

**Props**

| prop     | type      | default | 说明                                                                    |
| -------- | --------- | ------- | ----------------------------------------------------------------------- |
| `size`   | `number`  | `16`    | px 方形尺寸，同时作为 fallback icon 的 `font-size`                      |
| `subtle` | `boolean` | `false` | 启用 `filter: grayscale(1) brightness(1.2) opacity(0.75)`，图和 fallback icon 都生效 |

Fallback icon 继承 `currentColor`，所以外层加 `class="text-hp"` 时失败态也是红色剑。

## 加载策略

模块级 singleton 状态（首次 import 时启动一次探测，所有挂载共享）：

```ts
type State = 'pending' | 'ok' | 'failed'
const state = ref<State>('pending')

const probe = new Image()
probe.onload = () => (state.value = 'ok')
probe.onerror = () => (state.value = 'failed')
probe.src = LOGO_URL
```

渲染分支：

- `pending` → 空占位（`div` 固定 `size × size`），避免 sword→image 闪烁
- `ok` → `<img :src="LOGO_URL" :width="size" :height="size" class="object-contain">`
- `failed` → `<div class="i-lucide-sword" :style="{ fontSize: size + 'px' }">`

浏览器自身会缓存 imgur 的图，因此模板里的 `<img>` 和 probe 共享同一份字节，不会二次请求。

## 失败行为

- ccfolia 的 CSP 若拦截 `i.imgur.com`，`<img>` 触发 `error`，`state = 'failed'`，永久显示 sword。
- 无 `@grant` / `@resource`，所以没有 GM_xmlhttpRequest 兜底 — 这是可接受的：失败态视觉效果与改造前一致。

## Call-site 变更

**PanelShell.vue** —— 标题栏（第 83 行那一块）：

```vue
<div ref="handleRef" class="h-8 flex cursor-move select-none items-center gap-2 border-b border-white/10 px-3">
  <Logo :size="16" class="text-hp" />
  <span class="text-sm font-medium">ccfolia-sword</span>
  <span class="ml-auto text-xs text-white/40 italic">by rara</span>
  <button type="button" class="h-6 w-6 flex items-center justify-center rounded hover:bg-white/10" ...>
    <div class="i-lucide-x text-4" />
  </button>
  <button ...> <!-- 折叠按钮不变 --> </button>
</div>
```

关键 diff：

- `i-lucide-sword` div → `<Logo :size="16" class="text-hp" />`
- 新增 `<span class="ml-auto text-xs text-white/40 italic">by rara</span>`
- 原来写在关闭按钮上的 `ml-auto` 移到 credit span（credit 吃掉弹性空间，两个按钮自然靠右）

**PanelLauncher.vue** —— 第 16 行 + `<style>`：

```vue
<button class="ccs-launcher" ...>
  <Logo :size="18" subtle />
</button>
```

并删除 `<style scoped>` 里 `.ccs-launcher-icon { width: 18px; height: 18px }` 一段（尺寸交给 prop）。

**src/components/ui/index.ts** —— 加一行 `export { default as Logo } from './Logo.vue'`。

## 测试

纯视觉组件，无纯函数逻辑，不加单测。手动验证：

- [ ] 正常网络：PanelShell 标题栏左侧显示 logo 图，右侧显示 "by rara"，launcher 显示灰度化的 logo。
- [ ] DevTools 屏蔽 `i.imgur.com`：PanelShell 显示红色 sword icon，launcher 显示灰度低亮 sword icon。
- [ ] Credit 文字不挤压关闭/折叠按钮位置。

## 不做

- 不加 `@resource` / `@connect` 到 userscript meta（增加包体、目前不需要）。
- 不加图片预加载重试（失败一次即永久 fallback，避免请求风暴）。
- 不改造其它位置的 `i-lucide-sword` / `i-lucide-swords` 使用（`src/core/tag/builtin.ts:16` 属于领域 tag 定义，与品牌 logo 无关）。
