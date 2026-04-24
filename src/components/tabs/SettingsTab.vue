<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Button, Field, Input, Select, Switch } from '@/components/ui'
import { clearLog, getLogEntries, getLogSize } from '@/infra/log'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()

const anchorOptions = [
  { value: 'center', label: 'center' },
  { value: 'top-left', label: 'top-left' },
]

// UnoCSS 的 attributify / utility 搭配时,number input 的 v-model.number 在空串时会回落成
// 0 → normalizer 再兜底成默认值,视觉上会跳字。这里用 @change(失焦时触发)而不是 @input,
// 调参节奏上也更符合校准场景(用户填完才提交)。
function onGridFieldChange(key: 'cols' | 'rows' | 'cellSizePx', raw: unknown) {
  const n = Number(raw)
  settings.setGrid({ [key]: n })
}

function onOriginChange(axis: 'x' | 'y', raw: unknown) {
  const n = Number(raw)
  settings.setGrid({ originPx: { ...settings.grid.originPx, [axis]: n } })
}

function onAnchorChange(v: string | undefined) {
  if (v === 'center' || v === 'top-left')
    settings.setGrid({ pieceAnchor: v })
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
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- 格网校准 -->
    <section class="flex flex-col gap-2 card">
      <div class="flex items-center justify-between">
        <h4 class="text-sm text-white font-medium">
          格网校准
        </h4>
        <Button size="sm" variant="ghost" @click="settings.resetGrid()">
          恢复默认
        </Button>
      </div>

      <label class="flex items-center gap-2 text-xs text-white/80">
        <Switch
          :model-value="settings.gridOverlayVisible"
          @update:model-value="settings.setGridOverlayVisible($event ?? false)"
        />
        显示在画布上
      </label>

      <div class="grid grid-cols-2 gap-2">
        <Field label="Cols">
          <Input
            type="number"
            min="1"
            :model-value="settings.grid.cols"
            @change="onGridFieldChange('cols', ($event.target as HTMLInputElement).value)"
          />
        </Field>
        <Field label="Rows">
          <Input
            type="number"
            min="1"
            :model-value="settings.grid.rows"
            @change="onGridFieldChange('rows', ($event.target as HTMLInputElement).value)"
          />
        </Field>
        <Field label="Cell (px)">
          <Input
            type="number"
            min="1"
            :model-value="settings.grid.cellSizePx"
            @change="onGridFieldChange('cellSizePx', ($event.target as HTMLInputElement).value)"
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
            type="number"
            :model-value="settings.grid.originPx.x"
            @change="onOriginChange('x', ($event.target as HTMLInputElement).value)"
          />
        </Field>
        <Field label="Origin Y">
          <Input
            type="number"
            :model-value="settings.grid.originPx.y"
            @change="onOriginChange('y', ($event.target as HTMLInputElement).value)"
          />
        </Field>
      </div>
    </section>

    <!-- 调试 -->
    <section class="flex flex-col gap-2 card">
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
  </div>
</template>
