<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { detectGridFromCanvas } from '@/ccfolia/grid-detect'
import { findCanvasContainer } from '@/ccfolia/scene-mount'
import { Button, Field, Input, PopConfirm, Select, Switch } from '@/components/ui'
import { deleteValuesByPrefix } from '@/infra/gm-values'
import { clearLog, getLogEntries, getLogSize } from '@/infra/log'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()

const anchorOptions = [
  { value: 'center', label: 'center' },
  { value: 'top-left', label: 'top-left' },
]

// 本地 draft。不能直接把 `:model-value="settings.grid.xxx"` 绑到 input —— 下方
// logSize 的 setInterval 每秒触发 SettingsTab 重渲染,Vue 会把 input DOM value 回填成
// store 值,用户输到一半(比如 "20" 只输了 "2" 停顿 > 1s)会被打回旧值。
// 做法:本地 ref 承接输入,`@change`(失焦/回车)才提交到 store;同时 watch store
// 回灌 draft,覆盖 resetGrid /手动校准 等外部改动。
const colsDraft = ref<number | string>(settings.grid.cols)
const rowsDraft = ref<number | string>(settings.grid.rows)
const cellSizeDraft = ref<number | string>(settings.grid.cellSizePx)
const originXDraft = ref<number | string>(settings.grid.originPx.x)
const originYDraft = ref<number | string>(settings.grid.originPx.y)

watch(() => settings.grid.cols, (v) => { colsDraft.value = v })
watch(() => settings.grid.rows, (v) => { rowsDraft.value = v })
watch(() => settings.grid.cellSizePx, (v) => { cellSizeDraft.value = v })
watch(() => settings.grid.originPx.x, (v) => { originXDraft.value = v })
watch(() => settings.grid.originPx.y, (v) => { originYDraft.value = v })

function commitCols() { settings.setGrid({ cols: Number(colsDraft.value) }) }
function commitRows() { settings.setGrid({ rows: Number(rowsDraft.value) }) }
function commitCellSize() { settings.setGrid({ cellSizePx: Number(cellSizeDraft.value) }) }
function commitOriginX() {
  settings.setGrid({ originPx: { ...settings.grid.originPx, x: Number(originXDraft.value) } })
}
function commitOriginY() {
  settings.setGrid({ originPx: { ...settings.grid.originPx, y: Number(originYDraft.value) } })
}

function onAnchorChange(v: string | undefined) {
  if (v === 'center' || v === 'top-left')
    settings.setGrid({ pieceAnchor: v })
}

// --- 手动校准 ---
// 从 ccfolia 画布读出当前 Field 的格网参数并写入 settings。结果通过 calibrateStatus
// 短暂显示,3 秒后自动清除,避免需要引入 toast 系统。
const calibrateStatus = ref<{ kind: 'ok' | 'err', msg: string } | null>(null)
let calibrateStatusTimer: ReturnType<typeof setTimeout> | null = null

function showCalibrateStatus(kind: 'ok' | 'err', msg: string) {
  calibrateStatus.value = { kind, msg }
  if (calibrateStatusTimer !== null)
    clearTimeout(calibrateStatusTimer)
  calibrateStatusTimer = setTimeout(() => {
    calibrateStatus.value = null
    calibrateStatusTimer = null
  }, 3000)
}

function calibrateGrid() {
  const canvas = findCanvasContainer()
  if (!canvas) {
    showCalibrateStatus('err', '找不到 ccfolia 画布,请先进入房间')
    return
  }
  const detected = detectGridFromCanvas(canvas)
  if (!detected) {
    showCalibrateStatus('err', '探不到 Field,场景还没渲染完')
    return
  }
  settings.$patch({ grid: detected })
  showCalibrateStatus('ok', `已同步 · ${detected.cols}×${detected.rows} · ${detected.cellSizePx}px`)
}

// --- 日志 ---
const logSize = ref(getLogSize())
let logTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  logTimer = setInterval(() => {
    logSize.value = getLogSize()
  }, 1000)
})

onBeforeUnmount(() => {
  if (logTimer !== null) {
    clearInterval(logTimer)
    logTimer = null
  }
  if (calibrateStatusTimer !== null) {
    clearTimeout(calibrateStatusTimer)
    calibrateStatusTimer = null
  }
})

// 文件系统禁止 `:`,本地时间格式化为 `YYYY-MM-DDTHH-mm-ss`。
function formatLocalTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
}

function exportLogJson() {
  const entries = getLogEntries()
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ccs-log-${formatLocalTimestamp(new Date())}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function onClearLog() {
  clearLog()
  logSize.value = 0
}

// --- 重置 ---
// 所有 store 的 persist key 都以 `ccs:` 起头(见各 store 的 persist.key)。
// 直接清掉 GM 值 + 内存日志,然后刷新页面让 store 用 default state 重建。
function resetAllData() {
  deleteValuesByPrefix('ccs:')
  clearLog()
  window.location.reload()
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- 格网校准 -->
    <section class="flex flex-col gap-2 rounded p-3 bg-surface/75">
      <div class="flex items-center justify-between">
        <h4 class="text-sm text-white font-medium">
          格网校准
        </h4>
        <div class="flex items-center gap-1">
          <Button size="sm" @click="calibrateGrid">
            <span class="i-lucide-crosshair text-3" />
            从画布校准
          </Button>
          <Button size="sm" variant="ghost" @click="settings.resetGrid()">
            恢复默认
          </Button>
        </div>
      </div>

      <p
        v-if="calibrateStatus"
        class="text-xs"
        :class="calibrateStatus.kind === 'ok' ? 'text-accent' : 'text-hp'"
      >
        {{ calibrateStatus.msg }}
      </p>

      <label class="flex items-center gap-2 text-xs text-white/80">
        <Switch
          :model-value="settings.gridOverlayVisible"
          @update:model-value="settings.setGridOverlayVisible($event ?? false)"
        />
        显示在画布上
      </label>

      <p class="flex items-start gap-1 rounded bg-white/5 px-2 py-1.5 text-[11px] text-white/60 leading-relaxed">
        <span class="i-lucide-info mt-0.5 flex-shrink-0 text-3 text-accent" />
        <span>
          要让「从画布校准」映射到 SW2.5 标准 19×34,请在 ccfolia 房间设置里
          <span class="text-white">Change the foreground and background &gt; Field settings — Width: 38 &amp; Height: 68</span>。
          sword 一格 = ccfolia 两格。
        </span>
      </p>

      <div class="grid grid-cols-2 gap-2">
        <Field label="Cols">
          <Input
            v-model="colsDraft"
            type="number"
            min="1"
            @change="commitCols"
          />
        </Field>
        <Field label="Rows">
          <Input
            v-model="rowsDraft"
            type="number"
            min="1"
            @change="commitRows"
          />
        </Field>
        <Field label="Cell (px)">
          <Input
            v-model="cellSizeDraft"
            type="number"
            min="1"
            @change="commitCellSize"
          />
        </Field>
        <Field label="Anchor">
          <Select
            :model-value="settings.grid.pieceAnchor"
            :options="anchorOptions"
            @update:model-value="onAnchorChange"
          />
        </Field>
        <Field label="Origin X">
          <Input
            v-model="originXDraft"
            type="number"
            @change="commitOriginX"
          />
        </Field>
        <Field label="Origin Y">
          <Input
            v-model="originYDraft"
            type="number"
            @change="commitOriginY"
          />
        </Field>
      </div>
    </section>

    <!-- 重置 -->
    <section class="flex flex-col gap-2 rounded p-3 bg-surface/75">
      <h4 class="text-sm text-white font-medium">
        重置
      </h4>
      <p class="flex items-start gap-1 rounded bg-hp/10 px-2 py-1.5 text-[11px] text-white/70 leading-relaxed">
        <span class="i-lucide-triangle-alert mt-0.5 flex-shrink-0 text-3 text-hp" />
        <span>
          清除所有 cc-sword 本地配置和数据(角色、Buff/Tag 库、面板位置、格网设置等),并刷新页面。<span class="text-hp">不可撤销</span>。
        </span>
      </p>
      <div>
        <PopConfirm
          message="确认清除全部本地配置和数据?此操作不可撤销,页面会立即刷新。"
          confirm-text="清除并刷新"
          @confirm="resetAllData"
        >
          <button
            type="button"
            class="inline-flex items-center gap-1 border border-hp/40 rounded bg-hp/10 px-2 py-1 text-xs text-hp transition-colors hover:bg-hp/20"
          >
            <span class="i-lucide-trash-2 text-3" />
            清除全部数据
          </button>
        </PopConfirm>
      </div>
    </section>

    <!-- 调试 -->
    <section class="flex flex-col gap-2 rounded p-3 bg-surface/75">
      <h4 class="text-sm text-white font-medium">
        调试
      </h4>
      <p class="text-xs text-white/60">
        日志缓冲: <span class="text-white">{{ logSize }}</span> 条
      </p>
      <div class="flex gap-2">
        <Button size="sm" @click="exportLogJson">
          <span class="i-lucide-download text-3" />
          导出 JSON
        </Button>
        <Button size="sm" variant="ghost" @click="onClearLog">
          清空
        </Button>
      </div>
    </section>

    <p class="pt-1 text-center text-sm text-white/40 italic">
      - by rara -
    </p>
  </div>
</template>
