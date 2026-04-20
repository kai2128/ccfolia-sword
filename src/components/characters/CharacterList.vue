<script setup lang="ts">
// 角色库列表。接收 runtime 视图,主要显示名字、阵营、主 part 的 HP/MP。
// 编辑按钮 emit('edit', id);删除按钮直接 confirm + store.remove。
import type { RuntimeCharacter } from '@/types/character'
import { Button } from '@/components/ui'

defineProps<{
  items: RuntimeCharacter[]
}>()

const emit = defineEmits<{
  edit: [id: string]
  remove: [id: string]
}>()

const factionLabel: Record<RuntimeCharacter['faction'], string> = {
  friendly: '友',
  enemy: '敌',
  neutral: '中',
}

const factionClass: Record<RuntimeCharacter['faction'], string> = {
  friendly: 'bg-buff/20 text-buff',
  enemy: 'bg-debuff/20 text-debuff',
  neutral: 'bg-white/10 text-white/70',
}

function primary(ch: RuntimeCharacter) {
  return ch.parts[0]
}

function confirmRemove(ch: RuntimeCharacter) {
  if (window.confirm(`确认删除角色「${ch.name}」?`))
    emit('remove', ch.id)
}
</script>

<template>
  <ul v-if="items.length" class="flex flex-col gap-1">
    <li
      v-for="ch in items"
      :key="ch.id"
      class="w-full flex items-center gap-2 border border-white/10 rounded bg-surface/50 px-2 py-1.5 text-xs"
    >
      <span
        class="h-5 inline-flex items-center rounded px-1.5 text-[10px]"
        :class="factionClass[ch.faction]"
      >{{ factionLabel[ch.faction] }}</span>
      <span class="flex-1 truncate" :title="ch.nickname ?? ch.name">
        {{ ch.name }}
        <span v-if="ch.isMultiPart" class="ml-1 text-white/40">×{{ ch.parts.length }}</span>
      </span>
      <span class="text-hp font-mono">{{ primary(ch).hp.current }}/{{ primary(ch).hp.max }}</span>
      <span class="text-mp font-mono">{{ primary(ch).mp.current }}/{{ primary(ch).mp.max }}</span>
      <Button size="sm" variant="ghost" :title="`编辑 ${ch.name}`" @click="emit('edit', ch.id)">
        <div class="i-lucide-pencil text-3" />
      </Button>
      <Button size="sm" variant="ghost" :title="`删除 ${ch.name}`" @click="confirmRemove(ch)">
        <div class="i-lucide-trash text-3 text-hp/80" />
      </Button>
    </li>
  </ul>
</template>
