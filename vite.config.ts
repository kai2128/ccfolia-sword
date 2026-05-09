/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import unocss from '@unocss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import monkey from 'vite-plugin-monkey'

// 把 favicon 内联成 data URL,作为 userscript 图标,避免依赖外部图床。
const iconDataUrl = `data:image/x-icon;base64,${readFileSync(
  fileURLToPath(new URL('./src/assets/favicon.ico', import.meta.url)),
).toString('base64')}`

// 从 package.json 读版本号,作为 userscript metadata 的唯一真相源。
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
) as { version: string }

// GitHub Releases 的 latest 链接永远指向最新 release 的 asset,不随版本号变化。
const releaseBase = 'https://github.com/kai2128/ccfolia-sword/releases/latest/download'

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
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
        'namespace': 'https://github.com/kai2128/ccfolia-sword',
        'version': pkg.version,
        'description': '剑之世界 2.5 战斗助手 · ccfolia ',
        'icon': iconDataUrl,
        'homepage': 'https://github.com/kai2128/ccfolia-sword',
        'supportURL': 'https://github.com/kai2128/ccfolia-sword/issues',
        'updateURL': `${releaseBase}/ccfolia-sword.meta.js`,
        'downloadURL': `${releaseBase}/ccfolia-sword.user.js`,
        'match': ['https://ccfolia.com/rooms/*'],
        // sniffer 必须比 ccfolia 的 Firebase SDK 更早装钩子,否则抓不到 Write/channel。
        'run-at': 'document-start',
        'noframes': true,
        'grant': [
          'GM_setValue',
          'GM_getValue',
          'GM_deleteValue',
          'GM_listValues',
          // 跨 tab 同步持久化 store(overlay 可见性等),靠 Tampermonkey 的值变更通知。
          'GM_addValueChangeListener',
          'GM_removeValueChangeListener',
          // 用来在页面真实 window 上 hook fetch/XMLHttpRequest,
          // 否则 sandbox 的假 window 根本影响不到 ccfolia 的 Firebase SDK。
          'unsafeWindow',
        ],
      },
      build: {
        // 所有 CSS(含 UnoCSS)都交给 Shadow DOM 自行注入。
        // 写成字符串以便 monkey 原样嵌进 userscript;避免 node tsconfig 缺少 DOM lib 误报。
        cssSideEffects: '(css) => { (window.__CCS_CSS__ ||= []).push(css) }',
        // 同时产出 *.meta.js,Tampermonkey 检查更新时只拉这个小文件。
        metaFileName: true,
      },
    }),
  ],
  test: {
    include: ['src/core/**/*.test.ts', 'src/ccfolia/**/*.test.ts', 'src/infra/**/*.test.ts', 'src/stores/**/*.test.ts'],
    environment: 'node',
  },
})
