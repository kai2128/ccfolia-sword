/// <reference types="vite/client" />
/// <reference types="vite-plugin-monkey/client" />
/// <reference types="vite-plugin-monkey/global" />
/// <reference types="@types/tampermonkey" />
/// <reference types="unocss/reset" />

declare module 'virtual:uno.css?inline' {
  const css: string
  export default css
}

// 由 vite.config.ts 的 define 注入,值来自 package.json#version。
declare const __APP_VERSION__: string
