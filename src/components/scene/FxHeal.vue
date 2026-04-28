<script setup lang="ts">
defineProps<{
  x: number
  y: number
  amount: number
}>()

// 张扬·二次元爆闪:符文圆 + 浮动治疗数字。
// 设计稿见 docs/superpowers/plans/design_handoff_fx_expressive。
// 与原稿差异:**不渲染 6 颗上飘粒子**(loading dots 似的那串),只保留符文圈+扩散绿环+浮字。

const ringDots = Array.from({ length: 6 }, (_, i) => {
  const angle = (i / 6) * Math.PI * 2
  return { cx: 60 + Math.cos(angle) * 48, cy: 60 + Math.sin(angle) * 48 }
})
</script>

<template>
  <div
    class="pointer-events-none absolute h-[120px] w-[120px] -translate-x-1/2 -translate-y-1/2"
    :style="{ left: `${x}px`, top: `${y}px` }"
  >
    <!-- 符文圈(SVG,慢转,fx-aura 6s 无限循环但只播一会儿) -->
    <svg
      class="fx-aura absolute"
      width="120"
      height="120"
      viewBox="0 0 120 120"
      :style="{ inset: 0, opacity: 0.9 }"
    >
      <circle cx="60" cy="60" r="48" fill="none" stroke="#9bf2b6" stroke-width="1" stroke-dasharray="3 5" opacity="0.7" />
      <circle cx="60" cy="60" r="42" fill="none" stroke="#9bf2b6" stroke-width="0.6" opacity="0.4" />
      <circle
        v-for="(d, i) in ringDots"
        :key="i"
        :cx="d.cx"
        :cy="d.cy"
        r="2.5"
        fill="#9bf2b6"
      />
    </svg>
    <!-- 扩散绿环(2px solid + 内外发光,healBloom 0.4→1.6 缩放) -->
    <div
      class="fx-heal absolute rounded-full"
      :style="{
        inset: 0,
        border: '2px solid #9bf2b6',
        boxShadow: '0 0 18px #4ea582, inset 0 0 18px #4ea58233',
      }"
    />
    <!-- 浮动治疗数字 -->
    <div
      class="fx-float absolute font-bold font-serif"
      :style="{
        left: '50%',
        top: '-10px',
        fontSize: '26px',
        color: '#9bf2b6',
        textShadow: '0 2px 6px rgba(0,0,0,.9), 0 0 14px #9bf2b6',
      }"
    >
      +{{ amount }}
    </div>
  </div>
</template>
