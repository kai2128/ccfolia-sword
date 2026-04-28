<h1 align="center">
  <img src="src/assets/logo.png" alt="" width="96" align="center" />
  &nbsp;ccfolia-sword
</h1>

<p align="center">
  剑之世界 2.5 战斗助手 · ccfolia 浏览器 userscript。在 ccfolia 房间里挂上 HP/MP/buff/回合等战斗流程的增强面板。
</p>

## 安装

1. 浏览器装一个 userscript 管理器，推荐 [Tampermonkey](https://www.tampermonkey.net/)。
2. 点这个链接安装：[**ccfolia-sword.user.js**](https://github.com/kai2128/ccfolia-sword/releases/latest/download/ccfolia-sword.user.js)
   Tampermonkey 会自动识别并弹出确认框。
3. 打开 `https://ccfolia.com/rooms/*` 任意房间，面板会出现在画布上。

之后 Tampermonkey 会按 `@updateURL` 周期检查更新，无需手动操作。

## 开发

```bash
pnpm install
pnpm dev          # 启动 vite userscript dev 模式
pnpm build        # 输出 dist/ccfolia-sword.user.js
pnpm lint
pnpm test         # vitest run
```

## 发版

版本号唯一来源是 `package.json`。本地：

```bash
pnpm release:patch    # 0.1.0 → 0.1.1，自动 commit + tag + push
pnpm release:minor
pnpm release:major
```

推上 tag 后，[GitHub Actions](.github/workflows/release.yml) 会跑 lint + test + build，并把 `ccfolia-sword.user.js` 和 `ccfolia-sword.meta.js` 作为 asset 发布到 [Releases](https://github.com/kai2128/ccfolia-sword/releases)，release notes 由 GitHub 基于 commit 自动生成。

## 反馈

bug / 功能请求 → [Issues](https://github.com/kai2128/ccfolia-sword/issues)。

## License

[MIT](./LICENSE) © kai2128
