/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import unocss from '@unocss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import monkey from 'vite-plugin-monkey'

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    vue(),
    unocss(),
    monkey({
      entry: 'src/main.ts',
      userscript: {
        'name': 'ccfolia-sword',
        'namespace': 'https://github.com/tofu/ccfolia-sword',
        'description': '剑之世界 2.5 战斗引擎 · ccfolia 伴侣',
        'icon': 'https://ccfolia.com/favicon.ico',
        'match': ['https://ccfolia.com/rooms/*'],
        'run-at': 'document-idle',
        'noframes': true,
        'grant': [
          'GM_setValue',
          'GM_getValue',
          'GM_deleteValue',
          'GM_listValues',
        ],
      },
      build: {
        // 所有 CSS(含 UnoCSS)都交给 Shadow DOM 自行注入。
        // 写成字符串以便 monkey 原样嵌进 userscript;避免 node tsconfig 缺少 DOM lib 误报。
        cssSideEffects: '(css) => { (window.__CCS_CSS__ ||= []).push(css) }',
      },
    }),
  ],
  test: {
    include: ['src/core/**/*.test.ts'],
    environment: 'node',
  },
})
