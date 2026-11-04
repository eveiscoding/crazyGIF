# 测试清单与记录

日期：2026-11-04。必须区分自动化桌面浏览器、手机视口模拟和真实设备。

## 已执行的自动化

| 检查                       | 覆盖内容                                                                  | 结果                                                                 |
| -------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| TypeScript + Vite 生产构建 | React、GIF Worker、AI Worker、延迟 AI 资源、许可证打包                    | 已通过                                                               |
| 核心单元测试               | 四模板循环首尾、多档速度、零强度、历史分支与边界、真实 GIF 编码解码       | 23 项全部通过                                                        |
| Chrome 桌面 1280×900       | 四模板导出、下载、透明 PNG、橡皮擦/恢复、撤销重做、套索、PNG、AI 断网回退 | 已通过                                                               |
| Chrome Pixel 7 模拟        | 同一套闭环；页面无水平溢出                                                | 已通过；不等于 Android 真机                                          |
| Chrome 320×740 模拟        | 同一套闭环；页面无水平溢出                                                | 已通过；不等于 iOS 真机                                              |
| 子路径部署模拟             | VITE_BASE_PATH=/crazyGIF/，从构建预览访问                                 | 已通过；Worker 实际运行                                              |
| 首屏模型请求               | 首次访问和普通 GIF 导出没有 AI Worker / ONNX / 模型请求                   | 已通过                                                               |
| GIF 文件结构               | 320×320，18/24 帧，总时长 150/200 个百分之一秒，repeat=0，透明像素正确    | 已通过                                                               |
| 实际 AI 冷启动             | 非隔离页面，小模型 + CPU/WASM + 独立 Worker                               | 桌面 Chrome 通过，含下载、推理、导出整项约 17.2 秒；不是手机性能承诺 |

执行：`npm test`、`npm run build`、`npm run test:e2e`。浏览器测试使用本机已安装 Chrome；可在 Playwright 配置中修改 channel。AI 真下载单独按需运行：设置 TEST_REAL_AI=1 后运行 `npx playwright test ai-real --project=desktop`。该测试会下载真实模型，普通自动化默认跳过。远端测试可设置 TEST_BASE_URL 为完整 Pages URL，避免另起本地预览。

## 手工回归清单

补充自动化：三类 Chrome 视口均已验证 AI 中途取消、GIF 中途取消、取消后再次导出 PNG，3 项通过。加上此前 12 项闭环，共 15 项 Chrome 浏览器检查。

补充 WebKit：Windows Playwright WebKit 27.2（iPhone 13 视口）访问真实 Pages 地址，4 项通过：能力回退/取消恢复、四模板 GIF、透明 PNG 导入与完整手工精修/PNG 导出、AI 不可用后仍可导出。该引擎检测值：WebAssembly=true、Worker=true、OffscreenCanvas=false、createImageBitmap=true、crossOriginIsolated=false；因此 AI 被能力门槛阻止，已验证提示和替代路径，不标记为 AI 推理通过。该结果不是 iPhone Safari 真机测试。浏览器 CDP 触控拖动专项只在 Chromium 运行，WebKit 配置明确排除；真实 AI 专项默认跳过。

复测 WebKit：`npx playwright install webkit` 后运行 `npx playwright test -c playwright.webkit.config.ts`；可设置 TEST_BASE_URL 指向线上站点。配置将 Chrome channel 从通用设置移除，避免引擎串用。

- [ ] 相册与摄像头选择 JPEG、透明 PNG、WebP；设备 EXIF 方向正确。
- [ ] 大于 15 MB、4000 万像素、HEIC、损坏图与空文件均不覆盖已有素材。
- [ ] 套索越过边界、少于 3 点、曲线、重复相交；橡皮擦/恢复不同笔宽、边缘半透明。
- [ ] pointercancel 回滚、拖动出画布释放、额外手指忽略、撤销后新画笔清空重做分支。
- [ ] 连续导出与取消、Worker 异常与超时、切后台与回前台、长时间编辑无明显资源增长。
- [ ] 文案中英文、Emoji、空文案、18 字上限、宽文案压缩与颜色可读性。
- [ ] 透明 GIF 多帧无残影、PNG 半透明正常；下载后在系统相册与微信聊天内查看动效。
- [ ] 帮助、键盘、屏幕阅读器、减少动态效果偏好、横屏、安全区、系统大字体。
- [ ] AI 首次下载、缓存后重复运行、弱网、无网络、内存不足、取消与重试。
- [ ] Network 检查素材无上传；唯一 AI 出站为静态模型/WASM GET 请求。

## 真机验收矩阵（待实测，不以模拟替代）

| 环境                     | 导入/触控 | AI 冷/热 | GIF/PNG 保存 | 分享/微信收发 | 记录                                |
| ------------------------ | --------- | -------- | ------------ | ------------- | ----------------------------------- |
| iPhone / iOS Safari      | 待实测    | 待实测   | 待实测       | 待实测        | 填机型、iOS/Safari 版本、内存与耗时 |
| Android / Chrome         | 待实测    | 待实测   | 待实测       | 待实测        | 填机型、系统/Chrome 版本、冷/热耗时 |
| iPhone / 微信内置浏览器  | 待实测    | 待实测   | 待实测       | 待实测        | 填微信版本、长按和系统浏览器回退    |
| Android / 微信内置浏览器 | 待实测    | 待实测   | 待实测       | 待实测        | 填微信/XWeb 版本、CDN 可达性        |

AI 需要 WebAssembly SIMD、Worker、createImageBitmap、OffscreenCanvas；较旧 Safari/微信可采用手动/透明 PNG 路径。用户素材仅内存保存，刷新清空。GitHub Pages 无自定义 COOP/COEP，必须验证非隔离下 WASM 回退。当前源码核查发现：IMG.LY 1.7.0 设置 hardwareConcurrency，ONNX 1.21.0 在 SharedArrayBuffer 不可用时降为 1 线程；并非 IMG.LY 自行检测隔离状态。

## 依赖审计

测试工具已更新到 Vitest 5.1.0，消除旧测试依赖公告。当前 IMG.LY 的 zod 3.x 传递依赖被 npm audit 标记高危（GHSA-mrhx-c7xc-m3w5，超大受约束集合验证导致内存耗尽）。本应用只给库传固定本地配置，不接受远端 schema/任意集合配置，未将 zod 越级替换成不兼容的 4.x；保留上游依赖并记录待上游修复。上线前应按具体分发和威胁模型复核。不要使用 audit fix --force 将抠图库自动降级到不同接口版本。

## 发布记录

本地 23 项单元测试、12 项浏览器闭环、1 项真实 AI 冷启动均通过；三类视口均完成真实浏览器触控事件路径。普通回归中的 3 个真实 AI 项默认跳过，只在 opt-in 专项中执行桌面验证。生产构建和 /crazyGIF/ 子路径通过。

2026-11-04 已部署到 <https://eveiscoding.github.io/crazyGIF/>，应用版本 `9daec25141589518a88653e6de88e935fa1f4dde`，[Actions 发布记录](https://github.com/eveiscoding/crazyGIF/actions/runs/41860908452) 全部成功，包括 Linux Chromium 三尺寸回归。使用 TEST_BASE_URL 指向真实线上地址后，桌面 Chrome 的 5 项实测全部通过：真实 AI 冷启动（含模型下载、推理、GIF 导出整项 19.9 秒）、四模板 GIF、手动精修和 PNG、AI 断网降级、透明 GIF 与真实触控事件拖动。未将桌面引擎或手机视口模拟标作真机测试。
