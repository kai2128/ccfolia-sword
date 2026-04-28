<script setup lang="ts">
// 角色库顶栏:新建 / 导入 JSON / 导出 JSON / 插入样例数据 / 清空。
// 导入 / 导出走浏览器 File API;样例来自 core/__fixtures__/characters.ts。
import { ref } from 'vue'
import { Button, PopConfirm } from '@/components/ui'
import { makeDragon, makeGoblin, makePc } from '@/core/__fixtures__/characters'
import { ImportValidationError, useCharactersStore } from '@/stores/characters'

const emit = defineEmits<{
  new: []
  status: [msg: string, kind: 'ok' | 'err']
}>()

const store = useCharactersStore()
const fileRef = ref<HTMLInputElement | null>(null)

function onImportClick() {
  fileRef.value?.click()
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // 允许同一个文件连续选 —— 否则 change 不触发
  if (!file)
    return
  try {
    const text = await file.text()
    const r = store.importJson(text)
    emit('status', `导入 ${r.imported} 条,跳过 ${r.skipped} 条(共 ${r.total} 条)`, 'ok')
  }
  catch (err) {
    if (err instanceof ImportValidationError)
      emit('status', `校验失败 @${err.field}: ${err.message}`, 'err')
    else
      emit('status', err instanceof Error ? err.message : String(err), 'err')
  }
}

function onExport() {
  if (store.all.length === 0) {
    emit('status', '角色库为空,没有可导出的内容', 'err')
    return
  }
  const blob = new Blob([store.exportJson()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  a.href = url
  a.download = `ccfolia-sword-characters-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
  emit('status', `已导出 ${store.all.length} 条`, 'ok')
}

function onSeed() {
  const before = store.all.length
  store.upsert(makePc())
  store.upsert(makeGoblin())
  store.upsert(makeDragon())
  emit('status', `插入样例完成(库容 ${before} → ${store.all.length})`, 'ok')
}

function doClear() {
  store.clear()
  emit('status', '角色库已清空', 'ok')
}
</script>

<template>
  <div class="flex flex-wrap gap-1">
    <Button size="sm" @click="emit('new')">
      <div class="i-lucide-plus text-3" /> 新建
    </Button>
    <Button size="sm" variant="ghost" @click="onImportClick">
      <div class="i-lucide-upload text-3" /> 导入
    </Button>
    <Button size="sm" variant="ghost" @click="onExport">
      <div class="i-lucide-download text-3" /> 导出
    </Button>
    <Button size="sm" variant="ghost" @click="onSeed">
      <div class="i-lucide-sparkles text-3" /> 样例
    </Button>
    <PopConfirm
      :message="`确认清空 ${store.all.length} 个角色?`"
      confirm-text="清空"
      @confirm="doClear"
    >
      <Button size="sm" variant="ghost" :disabled="store.all.length === 0">
        <div class="i-lucide-trash text-3" /> 清空
      </Button>
    </PopConfirm>
    <input
      ref="fileRef"
      type="file"
      accept="application/json,.json"
      class="hidden"
      @change="onFileChange"
    >
  </div>
</template>
