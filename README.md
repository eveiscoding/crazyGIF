# crazyGIF · 鬼畜制造所

手机优先的纯前端表情包工具。React + TypeScript + Vite，Canvas 预览，Web Worker 本地 GIF 编码。素材不上传；无账号、后端、云函数、对象存储或数据库。

已上线：<https://eveiscoding.github.io/crazyGIF/>。GitHub Actions 构建、测试与部署均已通过，线上真实 AI 和 GIF/PNG 闭环已验收。

## 本地运行

Node.js 22.12+ 或 24，npm：

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

浏览器回归：`npm run test:e2e`（本机已安装 Chrome）；可选 WebKit 引擎检查先运行 `npx playwright install webkit`，再运行 `npx playwright test -c playwright.webkit.config.ts`。实际设备验收矩阵和线上实测记录见测试清单，模拟视口不替代真机。

## 已实现闭环

- 多选/追加上传 JPEG / PNG / WebP，单张最大 15 MB / 4000 万像素；最多 6 个素材、12 个图层。透明 PNG 可直接使用。
- 支持同素材复制、独立构图、置顶/移除图层；同源副本共用抠图结果，删除素材会移除其全部图层。
- 按需加载 IMG.LY AI 自动抠图；支持手动套索保留、橡皮擦、恢复画笔。每素材 10 个蒙版状态；透明/黑/白辅助背景与可调大小的虚线画笔不进入导出。
- 疯狂摇头、精神蹦迪、旋转升天、抽搐抖动；统一 Canvas 渲染用于预览及导出。
- 拖动位移、缩放、旋转、背景与透明背景、文案与字号颜色、速度、强度、时长。默认文案“我也可以动哦”，文字可静止、弹跳、摇摆或缩放。
- 默认 320×320、12fps、2 秒（可选 1.5 秒）无限循环 GIF；Worker 逐帧编码、进度和取消。PNG 导出第 0 帧。
- 结果图片预览、Blob 下载、支持时系统文件分享；微信内置浏览器提供长按/系统浏览器保存提示。

所有编辑仅保存在内存；刷新清空。初次 AI 需要联网下载模型和 WASM。GIF 支持二值透明，PNG 保留半透明。

## GitHub Pages

仓库 Settings → Pages → Source 选择 **GitHub Actions**，将本项目推送到 `main`。`.github/workflows/pages.yml` 会安装、测试、构建、上传并部署。PR 只运行检查，不部署。

Vite 的 `base` 由 `VITE_BASE_PATH` 设置。Actions 从 `configure-pages` 读取真实 `base_path`，仓库站为 `/crazyGIF/`，用户站/自定义域名为 `/`。Worker 地址由 Vite 解析，不写死根路径。无 history 路由，无 SPA 404 重写要求。

可手动验证仓库前缀（PowerShell）：

```powershell
$env:VITE_BASE_PATH = '/crazyGIF/'
$env:VITE_SOURCE_URL = 'https://github.com/eveiscoding/crazyGIF'
npm run build
npm run preview
```

CI 将源码链接设置到部署 commit，对应页脚“开源代码”。发布前还会运行 Chromium 的三尺寸浏览器闭环测试。不要提交个人访问令牌；工作流仅使用平台 `GITHUB_TOKEN`。

## 许可证

保留仓库原有 [MIT LICENSE](LICENSE)。本仓库新增应用代码也按 MIT 提供；**包含 `@imgly/background-removal` 的组合发布版本须遵守其 AGPL-3.0 义务**，不可仅按 MIT 分发整个打包产物。完整声明和源码获取方式见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。发布源码和构建脚本随仓库开放；闭源分发前应替换依赖或取得 IMG.LY 商业许可。依赖动态加载不免除许可证义务。

## 文档

- [PRD](docs/PRD.md)
- [前端页面清单](docs/PAGES.md)
- [技术设计](docs/TECHNICAL_DESIGN.md)
- [测试清单与实测记录](docs/TEST_CHECKLIST.md)
- [自动抠图许可证与移动端评估](docs/AI_EVALUATION.md)
