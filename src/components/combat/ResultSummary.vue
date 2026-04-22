<script setup lang="ts">
import type { DamageType, ResistOutcome, ResistResult, ResistType } from '@/types/action'
import { computed, ref } from 'vue'

export interface SummaryRow {
  charName: string
  finalValue: number
  currentHp: number
  newHp: number
  resistResult?: ResistResult
  resistOutcome?: ResistOutcome
}

const props = defineProps<{
  kind: 'damage' | 'heal'
  damageType?: DamageType
  resistType: ResistType
  actorName?: string
  actorMp?: number
  mpConsumed: boolean
  rawValue: number
  hitValue?: number
  hitValueLabel: string
  mpCost: number
  note: string
  rows: SummaryRow[]
}>()

const copied = ref(false)

const logText = computed(() => formatLog())

// MP 预览:有行动者 + mpCost>0 时,summary 里即使没目标也能看到 MP 轨迹。
const mpPreview = computed(() => {
  if (props.mpCost <= 0 || props.actorMp === undefined)
    return null
  const after = Math.max(0, props.actorMp - props.mpCost)
  return {
    before: props.actorMp,
    after,
    consumed: props.mpConsumed,
  }
})

const hasContent = computed(() => props.rows.length > 0 || mpPreview.value !== null)

async function copyLog() {
  try {
    await navigator.clipboard.writeText(logText.value)
    copied.value = true
    window.setTimeout(() => {
      copied.value = false
    }, 1200)
  }
  catch {
    // 剪贴板不可用就静默失败,不影响结算流程。
  }
}

function formatLog(): string {
  return [formatHeader(), ...props.rows.map(formatRow)].join('\n')
}

function formatHeader(): string {
  const actor = props.actorName || '行动者'
  const kindLabel = props.kind === 'heal'
    ? '治疗'
    : props.damageType === 'magical' ? '魔法伤害' : '物理伤害'
  const parts = [`【${actor} · ${kindLabel} ${props.rawValue}】`]
  if (props.kind === 'damage' && props.resistType !== 'none' && props.hitValue !== undefined)
    parts.push(`${props.hitValueLabel} ${props.hitValue}`)
  const mpPart = formatMpPart()
  if (mpPart)
    parts.push(mpPart)
  if (props.note)
    parts.push(`「${props.note}」`)
  return parts.join(' ')
}

// 带 actor MP 时尽量给出 `before→after` 的完整轨迹,GM 一眼能看出是否扣成功。
function formatMpPart(): string | null {
  if (props.mpCost <= 0)
    return null
  if (props.actorMp === undefined)
    return `MP -${props.mpCost}`
  if (props.mpConsumed)
    return `MP ${props.actorMp}(已扣 ${props.mpCost})`
  const after = Math.max(0, props.actorMp - props.mpCost)
  return `MP ${props.actorMp}→${after}`
}

function formatRow(row: SummaryRow): string {
  const hpText = `HP ${row.currentHp}→${row.newHp}`
  if (props.kind === 'heal')
    return ` ${row.charName} +${row.finalValue} / ${hpText}`
  const resist = formatResist(row)
  return ` ${row.charName}${resist} -${row.finalValue} / ${hpText}`
}

function formatResist(row: SummaryRow): string {
  if (props.resistType === 'none' || !row.resistResult)
    return ''
  if (props.resistType === 'evasion')
    return row.resistResult === 'success' ? '(未命中)' : '(命中)'
  const outcome = row.resistOutcome === 'nullify' ? '无效' : '半减'
  return row.resistResult === 'success' ? `(抵抗成功·${outcome})` : '(抵抗失败)'
}
</script>

<template>
  <div class="flex flex-col gap-2 rounded bg-white/5 p-2">
    <div class="flex items-center justify-between">
      <div class="text-xs text-white/60 font-medium">
        结果预览
      </div>
      <button
        type="button"
        class="h-7 rounded bg-white/10 px-2 text-xs text-white transition-colors disabled:cursor-not-allowed hover:bg-white/15 disabled:opacity-40"
        :disabled="!hasContent"
        @click="copyLog"
      >
        {{ copied ? '已复制' : '复制日志' }}
      </button>
    </div>

    <div v-if="!hasContent" class="rounded bg-black/20 py-3 text-center text-xs text-white/40">
      添加目标后会显示结算预览
    </div>

    <template v-else>
      <div class="grid gap-1 text-xs">
        <div
          v-if="mpPreview"
          class="flex items-center justify-between gap-2 rounded bg-black/20 px-2 py-1"
        >
          <span class="truncate text-white/80">{{ actorName || '行动者' }} · MP</span>
          <span class="flex items-center gap-2 font-mono">
            <span class="text-mp">{{ mpPreview.consumed ? '已扣' : `-${mpCost}` }}</span>
            <span class="text-white/50">
              MP {{ mpPreview.before }}{{ mpPreview.consumed ? '' : `→${mpPreview.after}` }}
            </span>
          </span>
        </div>
        <div
          v-for="(row, index) in rows"
          :key="index"
          class="flex items-center justify-between gap-2 rounded bg-black/20 px-2 py-1"
        >
          <span class="truncate text-white/80">{{ row.charName }}</span>
          <span class="flex items-center gap-2 font-mono">
            <span :class="kind === 'heal' ? 'text-hp' : 'text-accent'">
              {{ kind === 'heal' ? '+' : '-' }}{{ row.finalValue }}
            </span>
            <span class="text-white/50">
              HP {{ row.currentHp }}→{{ row.newHp }}
            </span>
          </span>
        </div>
      </div>

      <pre class="overflow-auto whitespace-pre-wrap rounded bg-black/20 p-2 text-xs text-white/80 font-mono">{{ logText }}</pre>
    </template>
  </div>
</template>
