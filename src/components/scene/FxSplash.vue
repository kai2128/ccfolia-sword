<script setup lang="ts">
// 张扬·二次元爆闪:十字斩 + 浮动伤害数字。
// 设计稿见 docs/superpowers/plans/design_handoff_fx_expressive。
// 与原稿差异:**不渲染 CRITICAL 飘带**,数字统一白色不区分暴击,字号常态化。

defineProps<{
  // x/y 是相对于 offset parent 的画布像素(立绘中心)
  x: number
  y: number
  damage: number
}>()
</script>

<template>
  <div
    class="pointer-events-none absolute h-[160px] w-[160px] -translate-x-1/2 -translate-y-1/2"
    :style="{ left: `${x}px`, top: `${y}px` }"
  >
    <!-- 中心爆闪(白心金晕) -->
    <div
      class="absolute rounded-full"
      :style="{
        left: '50%',
        top: '50%',
        width: '70px',
        height: '70px',
        marginLeft: '-35px',
        marginTop: '-35px',
        background: 'radial-gradient(circle, #fff 0%, #f7e7a8 30%, transparent 70%)',
        animation: 'healBloom 480ms cubic-bezier(.2,.7,.3,1) forwards',
      }"
    />
    <!-- 主斩(横向金白渐变) -->
    <div
      class="fx-slash absolute"
      :style="{
        left: '50%',
        top: '50%',
        width: '130px',
        height: '5px',
        background: 'linear-gradient(90deg, transparent, #fff 30%, #f7e7a8 50%, #fff 70%, transparent)',
        boxShadow: '0 0 14px #f7e7a8, 0 0 28px #e7c66a',
      }"
    />
    <!-- 副斩(细白线,90ms 延迟) -->
    <div
      class="fx-slash absolute"
      :style="{
        left: '50%',
        top: '50%',
        width: '90px',
        height: '2px',
        background: 'linear-gradient(90deg, transparent, #fff, transparent)',
        transform: 'translate(-50%,-50%) rotate(35deg)',
        animationDelay: '90ms',
      }"
    />
    <!-- 浮动伤害数字 -->
    <div
      class="fx-float absolute font-bold font-serif"
      :style="{
        left: '50%',
        top: '-10px',
        fontSize: '24px',
        color: '#fff',
        textShadow: '0 2px 8px rgba(0,0,0,.9), 0 0 16px currentColor',
      }"
    >
      -{{ damage }}
    </div>
  </div>
</template>
