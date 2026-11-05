# Web V1 技术设计

## 架构与数据边界

静态 HTML → React 状态/Ref → Canvas 2D → GIF Worker → Blob URL → 下载/分享。输入图片只有 File/Blob 和本地对象 URL，不进入 fetch/FormData。远端请求仅为静态程序、按需 AI 模型与 WASM，无用户素材提交代码。没有服务端 API。

## 图像与编辑

导入限制 15 MB 和 4000 万像素，浏览器 Image 解码后将最长边缩放到 460px，居中置入 512×512 工作面。解码仍可能受低内存设备限制；导入失败保留旧素材。工作面为原图、蒙版、合成主体三个 Canvas，均 512px。蒙版绘制后通过 destination-in 合成原图；原图不可变，使恢复画笔可以重现擦除区域。

套索通过离屏多边形蒙版与当前蒙版取交集；擦除使用 destination-out；恢复使用 source-over 白色笔刷。连续笔刷线段支持粗细、圆角；每次完整手势提交一个历史状态，每个素材最多 10 份 ImageData，约 10 MiB。最多 6 个素材，历史上限约 60 MiB。撤销后新操作截断重做分支；pointercancel 回滚到当前已提交状态。追加素材不清空其他素材历史。

素材 Asset 各自持有原图/蒙版/主体/历史/缩略图；Layer 仅保存 assetId 与独立的 x/y/scale/rotation。最多 12 个图层，同源副本复用主体，不重复存储蒙版。点击画布按逆变换采样 alpha，从上到下命中图层；列表提供选择、复制、置顶、移除。删除素材同时删除引用它的图层。首次有效单素材导入替换默认示例，其后追加；批量导入自动排布。

抠图页单独显示选中素材，透明/黑/白辅助背景设置在画布容器 CSS 上。画笔范围是同坐标空间的 SVG 虚线圆，直径等于真实笔宽；两者均不进入 Canvas 像素。导出始终读取场景 RenderLayer[] 与导出背景，从任何页导出都保持作品内容一致。

Pointer Events 和 setPointerCapture 支持鼠标与单指，忽略额外指针；坐标由实际 CSS 画布尺寸映射到 512 工作面。构图位移转换到 320 输出坐标。导出/AI 期间锁定编辑，避免不同步骤竞争写入。

## 动画和预览

四模板均由周期相位驱动。速度量化成整数周期，以保证循环首尾的变换一致。摇头为水平正弦加旋转；蹦迪为周期横摆和平方正弦弹跳；升天为周期旋转与上升缩放；抽搐为多个整数频率叠加。强度为零时所有模板停止变换。

Canvas 预览内部 640×640，逻辑空间 320×320，CSS 响应式显示。输出固定 320×320。`render()` 同时用于预览和每帧导出，顺序为背景 → 按图层顺序绘制各主体变换 → 文字变换和描边填充。默认文案“我也可以动哦”，限 18 Unicode 码点，maxWidth 280px；文字静止/弹跳/摇摆/缩放共用循环相位，受速度和强度控制。后台页面停止调度，回前台恢复。减少动态效果偏好默认暂停。

## GIF Worker 协议

1. 主线程冻结所有图层主体、构图与 Settings，创建 Vite 模块 Worker。
2. start → ready，主线程渲染一帧并发送可转移 RGBA ArrayBuffer。
3. Worker 用 gifenc 量化调色板并编码；frame ack 后才发送下一帧。帧内存约 0.39 MiB，不一次攒满 24 帧。
4. 18/24 帧完成后 finish → done，将 GIF bytes 移交主线程生成 Blob。
5. Worker 出错、超时或用户取消会 terminate 并恢复 UI。连续导出复用不到旧 Worker。

每帧 12fps 用 GIF 百分之一秒精度交替分配 80/90ms，保证 1.5/2 秒总长。repeat=0 无限循环，dispose=2 清除旧帧；彩色背景使用 rgb565 量化。透明背景最多 255 色加一个保留透明索引，alpha<128 的像素强制映射到该索引，避免最近邻颜色误匹配。PNG 直接导出同一渲染器的第 0 帧。

编码 worker 避免量化/LZW 占用 UI；主线程逐帧渲染小尺寸 Canvas 并读取 RGBA，ack 之间浏览器可响应。取消通过 AbortSignal；每次 worker 回复刷新 30 秒超时。

## AI 路径

点击才创建独立 AI Worker，由该 Worker 加载 IMG.LY 及量化模型 `isnet_quint8`、CPU/WASM、`proxyToWorker:false`。1.7.0 的内置代理仅对 GPU 路径开启，CPU 需要由应用自己移入 Worker；不依赖该代理标志。ONNX Runtime 1.21.0 检测 SharedArrayBuffer 能力并在不可用时回退单线程。详见评估文档。AI 需要 OffscreenCanvas 与 createImageBitmap；不支持时保留手动入口。下载失败/WASM/内存错误保留素材，支持用户取消和 180 秒超时终止 Worker。依赖版本使用 lockfile 固定，不采用上游 README 中不匹配的预发行 ONNX peer。

## 资源与隐私

输入临时 URL 解码结束即撤销；AI 结果 URL 读取结束撤销；输出 URL 在替换、关闭、卸载时撤销。旧 Worker 终止；没有 IndexedDB 或 localStorage 持久化图片。模型库可能缓存模型，不包含用户图像。首次 AI 需网络，普通编辑和导出不依赖网络服务。

## 部署

Vite base 从环境变量注入；Actions configure-pages 读取 Pages base_path，正确兼容项目站/用户站/自定义域名。Worker 使用 `new URL(..., import.meta.url)` 随构建变换。Pages 上传 dist，按 main 推送或 workflow_dispatch 发布；PR 独立 CI。源码链接包含部署 commit。无服务工作线程，不通过伪造响应头实现跨源隔离。

## 兼容性边界

核心依赖 Canvas2D、Blob/URL、Worker、Pointer Events、ES2020。Web Share 按能力检测；a[download] 失效时保留结果图片长按保存。iOS Safari、Android Chrome 与微信必须实机验证，桌面缩放不能代替。AI 下载量、WASM 内存、浏览器缓存与微信限制应单独记录。HEIC 未支持，导入提示转换格式。
