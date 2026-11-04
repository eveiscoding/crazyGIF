# IMG.LY 自动抠图评估

核查日期：2026-11-04。实际依赖锁定 `@imgly/background-removal@1.7.0`，peer `onnxruntime-web@1.21.0`；以 npm 已发布包声明为准。

## 许可证与发布选择

上游库使用 AGPL。动态 import、在客户端运行及免费使用均不等于免除许可证义务。仓库已有 MIT LICENSE 保留；新增自有代码也以 MIT 提供，MIT 与 AGPL 兼容，但含该库的完整组合产物按 AGPL 要求分发，不能宣传为完全 MIT 或默认可闭源。

本实现包含库的许可证全文、第三方声明、公开应用源码/构建说明，并在界面页脚提供源码入口。Actions 发布时链接到对应 commit，npm lockfile 标识所用库版本。正式分发时保留通知及可获取的完整对应源码。若将来需要闭源，应先取得 IMG.LY 商业授权或替换库，再调整分发说明；当前不实施商业许可绕过。

此处记录依赖和工程决策，不代替针对特定商业分发方式的法律判断。

## 移动端与 GitHub Pages

官方 README 给出量化模型约 40 MB，默认中型约 80 MB；这里选用小模型，质量与边缘可能较差。下载还有 WASM 等运行资源，不能将 40 MB 作为总流量承诺。`publicPath` 使用上游版本对应静态资源端点，不是推理 API，也不提交图片。首次点击才下载。

上游建议 COOP/COEP 开启 SharedArrayBuffer 提升性能。GitHub Pages 不能由仓库文件配置自定义 HTTP 响应头，因此不假定 crossOriginIsolated=true，也不引入额外 Service Worker 修改隔离状态。源码核查表明 IMG.LY 1.7.0 设置 hardwareConcurrency 线程数，但 ONNX 1.21.0 的 wasm-factory 会在 SharedArrayBuffer 不可用时将 flags.numThreads 降到 1。CPU/WASM 模式不依赖 WebGPU。

特别注意：1.7.0 的 `proxyToWorker` 实际以 `useWebGPU && config.proxyToWorker` 开关，仅设置该选项并不能让 CPU 推理离开主线程。本应用在用户点击后创建自己的 AI Worker，由它加载库、模型和执行推理。需要 OffscreenCanvas 和 createImageBitmap，能力不足时使用手动路径；支持取消和 180 秒超时。Safari/微信能力以实际版本与设备测试为准。

GitHub Pages 静态部署与 AI 模型下载是两条链路：站点可加载不代表模型 CDN 可达。国内网络、微信浏览器、iOS 内存限制可能导致下载/推理失败。小模型仍需解码与 tensor 中间内存；512 工作面不意味着模型只需要 512px 内存。不要宣称所有手机均兼容或已完成真机测试。

## 回退与验收

- 不支持 WebAssembly/Worker 时提示手动或透明 PNG。
- 下载/推理失败保留原图和历史，显示重试与替代路径。
- 处理时锁定换图/编辑，进度为单文件进度，不能标作整体完成百分比。
- AI 运行中为防止竞态锁定编辑；取消或失败后立即恢复手动编辑、模板和本地导出。
- 首次/缓存后下载、无 SAB、低内存、后台回前台、微信 CDN 可达性均须记录实测结果。

## 一手资料

本地验证记录：已在桌面 Chrome、`crossOriginIsolated=false` 的静态构建页完成一次真实模型冷下载、推理和 GIF 导出，整项 Playwright 用例 17.2 秒。该结果证明本实现不强制依赖 Pages 的隔离响应头，不代表 Safari、微信或低内存设备已经通过验收。

- [库与许可证](https://github.com/imgly/background-removal-js)
- [Web 使用和模型大小、COOP/COEP](https://github.com/imgly/background-removal-js/blob/main/packages/web/README.md)
- [配置定义](https://github.com/imgly/background-removal-js/blob/main/packages/web/src/schema.ts)
- [对应 npm 发布版本](https://www.npmjs.com/package/@imgly/background-removal/v/1.7.0)
- [GitHub Pages 工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Vite 静态部署](https://vite.dev/guide/static-deploy.html)
