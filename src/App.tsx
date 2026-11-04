import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { defaults, templates } from "./types";
import type { Settings, Tool } from "./types";
import { canvas, demoSubject, render } from "./render";
import { MaskHistory } from "./history";
import { exportGif, exportPng } from "./export";
import { removeLocalBackground } from "./ai";

type Point = { x: number; y: number };
type Result = { url: string; blob: Blob; kind: "gif" | "png" };
const sourceUrl = __SOURCE_URL__ || "https://github.com/eveiscoding/crazyGIF";

function Range({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="range">
      <span>
        {label}
        <output>
          {Number(value.toFixed(2))}
          {suffix}
        </output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export default function App() {
  const [settings, setSettings] = useState<Settings>({ ...defaults });
  const [pane, setPane] = useState<"material" | "motion" | "style">("motion");
  const [tool, setTool] = useState<Tool>("move");
  const [playing, setPlaying] = useState(
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [brush, setBrush] = useState(32);
  const [revision, setRevision] = useState(0);
  const [fileName, setFileName] = useState("发疯熊猫 · 示例素材");
  const [notice, setNotice] = useState("示例已就位，选个模板，让它动起来。");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProgress, setAiProgress] = useState("");
  const [encoding, setEncoding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [loading, setLoading] = useState(false);
  const view = useRef<HTMLCanvasElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const original = useRef<HTMLCanvasElement | null>(null);
  const subject = useRef<HTMLCanvasElement | null>(null);
  const mask = useRef<HTMLCanvasElement | null>(null);
  const history = useRef(new MaskHistory());
  const gesture = useRef<{
    points: Point[];
    pointer: number;
    start: Point;
    x: number;
    y: number;
  } | null>(null);
  const abortExport = useRef<AbortController | null>(null);
  const aiGeneration = useRef(0);
  const abortAi = useRef<AbortController | null>(null);
  const resultUrl = useRef<string | null>(null);
  const resultPanel = useRef<HTMLElement>(null);
  const busy = encoding || loading || aiBusy;
  const editing = pane === "material" && tool !== "move";
  const update = (patch: Partial<Settings>) =>
    setSettings((s) => ({ ...s, ...patch }));
  useEffect(() => {
    if (result)
      resultPanel.current?.scrollIntoView({
        block: "center",
        behavior: "instant",
      });
  }, [result]);

  const compose = () => {
    if (!original.current || !mask.current || !subject.current) return;
    const g = subject.current.getContext("2d")!;
    g.clearRect(0, 0, 512, 512);
    g.globalCompositeOperation = "source-over";
    g.drawImage(original.current, 0, 0);
    g.globalCompositeOperation = "destination-in";
    g.drawImage(mask.current, 0, 0);
    g.globalCompositeOperation = "source-over";
    setRevision((n) => n + 1);
  };
  const saveMask = () => {
    history.current.push(
      mask.current!.getContext("2d")!.getImageData(0, 0, 512, 512),
    );
    compose();
  };
  const install = (image: CanvasImageSource) => {
    const c = canvas();
    c.getContext("2d")!.drawImage(image, 0, 0, 512, 512);
    original.current = c;
    subject.current = canvas();
    mask.current = canvas();
    const g = mask.current.getContext("2d")!;
    g.fillStyle = "white";
    g.fillRect(0, 0, 512, 512);
    history.current = new MaskHistory();
    saveMask();
    update({ x: 0, y: 0, scale: 1, rotation: 0 });
    setTool("move");
  };

  useEffect(() => {
    install(demoSubject());
    return () => {
      aiGeneration.current++;
      abortExport.current?.abort();
      abortAi.current?.abort();
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    };
    // Initialize the in-memory document once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let raf = 0;
    let start: number | undefined;
    const draw = (time: number) => {
      if (start === undefined) start = time;
      const c = view.current,
        image = subject.current;
      if (c && image) {
        const g = c.getContext("2d")!;
        if (editing) {
          g.clearRect(0, 0, 640, 640);
          g.save();
          g.scale(640 / 512, 640 / 512);
          g.globalAlpha = 0.15;
          g.drawImage(original.current!, 0, 0);
          g.globalAlpha = 1;
          g.drawImage(image, 0, 0);
          const points = gesture.current?.points;
          if (tool === "lasso" && points?.length) {
            g.beginPath();
            points.forEach((p, i) =>
              i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y),
            );
            g.strokeStyle = "#636f19";
            g.lineWidth = 3;
            g.setLineDash([8, 5]);
            g.stroke();
          }
          g.restore();
        } else
          render(
            g,
            image,
            settings,
            playing
              ? ((time - start) % (settings.duration * 1000)) /
                  (settings.duration * 1000)
              : 0,
          );
      }
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };
    const resume = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    document.addEventListener("visibilitychange", resume);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [settings, playing, editing, tool, revision]);

  async function loadFile(file?: File) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setNotice("请选择 PNG、JPEG 或 WebP 图片；HEIC 请先转为 JPEG。");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setNotice("图片超过 15 MB，请缩小后再试。");
      return;
    }
    setLoading(true);
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("图片无法读取"));
        img.src = url;
      });
      if (
        !img.naturalWidth ||
        img.naturalWidth * img.naturalHeight > 40_000_000
      )
        throw new Error("图片像素过大，请使用 4000 万像素以内的图片");
      const c = canvas(),
        g = c.getContext("2d")!;
      const scale = 460 / Math.max(img.naturalWidth, img.naturalHeight);
      const w = img.naturalWidth * scale,
        h = img.naturalHeight * scale;
      g.drawImage(img, (512 - w) / 2, (512 - h) / 2, w, h);
      install(c);
      setFileName(file.name);
      setPane("material");
      setNotice(
        "素材已导入。透明 PNG 可直接选动画，也可以自动抠图或手动精修。",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "图片读取失败");
    } finally {
      URL.revokeObjectURL(url);
      setLoading(false);
    }
  }

  const point = (e: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 512,
      y: ((e.clientY - rect.top) / rect.height) * 512,
    };
  };
  const paint = (from: Point, to: Point) => {
    const g = mask.current!.getContext("2d")!;
    g.globalCompositeOperation =
      tool === "erase" ? "destination-out" : "source-over";
    g.strokeStyle = g.fillStyle = "white";
    g.lineWidth = brush;
    g.lineCap = g.lineJoin = "round";
    g.beginPath();
    g.moveTo(from.x, from.y);
    g.lineTo(to.x, to.y);
    g.stroke();
    g.beginPath();
    g.arc(to.x, to.y, brush / 2, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "source-over";
    compose();
  };
  const pointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (busy || gesture.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = point(e);
    gesture.current = {
      points: [p],
      pointer: e.pointerId,
      start: p,
      x: settings.x,
      y: settings.y,
    };
    if (editing && (tool === "erase" || tool === "restore")) paint(p, p);
  };
  const pointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const g = gesture.current;
    if (!g || g.pointer !== e.pointerId || busy) return;
    const p = point(e);
    if (!editing) {
      update({
        x: Math.max(-160, Math.min(160, g.x + ((p.x - g.start.x) * 320) / 512)),
        y: Math.max(-160, Math.min(160, g.y + ((p.y - g.start.y) * 320) / 512)),
      });
    } else {
      if (tool === "erase" || tool === "restore")
        paint(g.points[g.points.length - 1], p);
      g.points.push(p);
    }
  };
  const pointerEnd = (
    e: ReactPointerEvent<HTMLCanvasElement>,
    cancelled = false,
  ) => {
    const active = gesture.current;
    if (!active || active.pointer !== e.pointerId) return;
    if (editing) {
      const g = mask.current!.getContext("2d")!;
      if (cancelled) {
        // A cancelled touch is rolled back, rather than becoming a half stroke.
        const last = history.current.current();
        if (last) g.putImageData(last, 0, 0);
      } else if (tool === "lasso" && active.points.length > 2) {
        const selection = canvas(),
          s = selection.getContext("2d")!;
        s.fillStyle = "white";
        s.beginPath();
        active.points.forEach((p, i) =>
          i ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y),
        );
        s.closePath();
        s.fill();
        g.globalCompositeOperation = "destination-in";
        g.drawImage(selection, 0, 0);
        g.globalCompositeOperation = "source-over";
      }
      if (!cancelled) saveMask();
      else compose();
    }
    gesture.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };

  async function removeBackground() {
    if (busy || !original.current) return;
    if (
      !window.WebAssembly ||
      !window.Worker ||
      !window.OffscreenCanvas ||
      !window.createImageBitmap
    ) {
      setNotice("当前浏览器不支持本地 AI，请用手动抠图或上传透明 PNG。");
      return;
    }
    setAiBusy(true);
    setAiProgress("准备模型，首次使用需要下载约 40 MB 及运行文件…");
    const generation = ++aiGeneration.current;
    const controller = new AbortController();
    abortAi.current = controller;
    try {
      const image = await new Promise<Blob>((resolve, reject) =>
        original.current!.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("素材读取失败"))),
          "image/png",
        ),
      );
      const blob = await removeLocalBackground(
        image,
        (message) => {
          if (generation === aiGeneration.current) setAiProgress(message);
        },
        controller.signal,
      );
      if (generation !== aiGeneration.current) return;
      const url = URL.createObjectURL(blob);
      try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("抠图结果读取失败"));
          img.src = url;
        });
        const g = mask.current!.getContext("2d")!;
        g.clearRect(0, 0, 512, 512);
        g.drawImage(img, 0, 0, 512, 512);
        saveMask();
        setNotice("自动抠图完成，可以用恢复画笔或橡皮擦精修。");
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      if (generation === aiGeneration.current)
        setNotice(
          controller.signal.aborted
            ? "自动抠图已取消，原素材已保留。"
            : "本地 AI 未能完成，可能是模型网络或浏览器内存限制。请尝试手动抠图、透明 PNG，或在系统浏览器重试。",
        );
    } finally {
      if (generation === aiGeneration.current) {
        setAiBusy(false);
        setAiProgress("");
        abortAi.current = null;
      }
    }
  }

  function publishResult(blob: Blob, kind: "gif" | "png") {
    if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    const url = URL.createObjectURL(blob);
    resultUrl.current = url;
    setResult({ url, blob, kind });
    setNotice(
      kind === "gif"
        ? "GIF 已生成！可下载或分享，也可以长按下方图片保存。"
        : "PNG 封面已生成，可下载或长按保存。",
    );
  }
  async function generate(kind: "gif" | "png") {
    if (busy || !subject.current) return;
    setEncoding(true);
    setProgress(0);
    setPlaying(false);
    const controller = new AbortController();
    abortExport.current = controller;
    const frozen = canvas();
    frozen.getContext("2d")!.drawImage(subject.current, 0, 0);
    try {
      publishResult(
        kind === "gif"
          ? await exportGif(
              frozen,
              { ...settings },
              setProgress,
              controller.signal,
            )
          : await exportPng(frozen, { ...settings }),
        kind,
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "导出失败，请重试");
    } finally {
      setEncoding(false);
      abortExport.current = null;
    }
  }
  async function share() {
    if (!result) return;
    const file = new File([result.blob], `鬼畜制造所.${result.kind}`, {
      type: result.blob.type,
    });
    try {
      if (navigator.canShare?.({ files: [file] }))
        await navigator.share({ files: [file], title: "我的鬼畜表情包" });
      else
        setNotice(
          "当前浏览器不支持文件分享，请下载或长按生成图片保存；微信中可从右上角选择系统浏览器。",
        );
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setNotice("分享未完成，请下载图片后分享。");
    }
  }
  const undo = (redo = false) => {
    const data = redo ? history.current.redo() : history.current.undo();
    if (data) {
      mask.current!.getContext("2d")!.putImageData(data, 0, 0);
      compose();
    }
  };

  return (
    <>
      <header className="header">
        <a className="brand" href="#">
          <span className="brand-icon">✳</span>
          <span>
            鬼畜制造所<small>MEME LAB / 表情包实验室</small>
          </span>
        </a>
        <div className="header-right">
          <span className="local-tag">
            <i />
            素材只在你的设备处理
          </span>
          <button
            className="icon-button"
            aria-label="使用帮助"
            onClick={() => setShowHelp(true)}
          >
            ?
          </button>
        </div>
      </header>
      <main>
        <section className="intro">
          <div>
            <div className="eyebrow">LESS SERIOUS. MORE MEMES.</div>
            <h1>
              让你的快乐，<span>动静大一点。</span>
              <svg viewBox="0 0 130 18" aria-hidden="true">
                <path d="M3 13 Q62 -3 127 9 M10 17 Q66 3 117 14" />
              </svg>
            </h1>
            <p>一张照片，一点脑洞。把普通瞬间，变成发疯现场。</p>
          </div>
          <div className="intro-stamp">
            100%
            <br />
            <span>本地制造</span>
            <b>↙</b>
          </div>
        </section>
        <div className="workspace">
          <section className="preview-panel" aria-label="实时预览">
            <div className="panel-top">
              <span>
                <i className="live-dot" />
                {editing ? "素材精修" : "实时预览"}
                <small>LIVE CANVAS</small>
              </span>
              <span className="size-badge">320 × 320</span>
            </div>
            {pane === "material" && (
              <div className="quick-tools" aria-label="画布快捷工具">
                <div>
                  {(
                    [
                      { id: "move", label: "移动" },
                      { id: "lasso", label: "套索" },
                      { id: "erase", label: "擦除" },
                      { id: "restore", label: "恢复" },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      disabled={busy}
                      className={tool === t.id ? "active" : ""}
                      onClick={() => {
                        setTool(t.id);
                        setPlaying(false);
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                  <button
                    disabled={busy || !history.current.canUndo}
                    onClick={() => undo()}
                    aria-label="画布撤销"
                  >
                    ↶
                  </button>
                  <button
                    disabled={busy || !history.current.canRedo}
                    onClick={() => undo(true)}
                    aria-label="画布重做"
                  >
                    ↷
                  </button>
                </div>
                {(tool === "erase" || tool === "restore") && (
                  <Range
                    label="画笔"
                    value={brush}
                    min={4}
                    max={100}
                    suffix=" px"
                    onChange={setBrush}
                  />
                )}
              </div>
            )}
            <div className="stage-wrap">
              <span className="stage-note">你的精神状态，有画面了 ↘</span>
              <div
                className={`stage ${settings.background === "transparent" || editing ? "checker" : ""}`}
              >
                <canvas
                  ref={view}
                  width={640}
                  height={640}
                  aria-label={
                    editing
                      ? "抠图画布，拖动进行编辑"
                      : "动画预览，拖动调整素材位置"
                  }
                  onPointerDown={pointerDown}
                  onPointerMove={pointerMove}
                  onPointerUp={(e) => pointerEnd(e)}
                  onPointerCancel={(e) => pointerEnd(e, true)}
                />
              </div>
              <span className="stage-corner">✦</span>
            </div>
            <div className="preview-controls">
              <button
                className="play-button"
                disabled={editing}
                onClick={() => setPlaying((v) => !v)}
                aria-label={playing ? "暂停动画" : "播放动画"}
              >
                {playing ? "Ⅱ" : "▶"}
              </button>
              <div>
                <strong>
                  {editing
                    ? (
                        {
                          lasso: "画圈保留主体",
                          erase: "擦去多余区域",
                          restore: "恢复原图区域",
                        } as Record<string, string>
                      )[tool]
                    : templates.find((t) => t.id === settings.template)?.name}
                </strong>
                <small>
                  {editing
                    ? "手指离开时应用 · 支持撤销"
                    : "拖动画面调位置 · 滑块调大小"}
                </small>
              </div>
              <span className="loop">↻ 循环</span>
            </div>
            <div className="meta-row">
              <span>12 FPS</span>
              <span>{settings.duration} 秒</span>
              <span>GIF / PNG</span>
              <span>无水印</span>
            </div>
          </section>

          <section className="editor-panel" aria-label="编辑工具">
            <nav className="tabs" aria-label="制作步骤">
              {(
                [
                  { id: "material", number: "01", label: "选素材" },
                  { id: "motion", number: "02", label: "加点疯" },
                  { id: "style", number: "03", label: "调个味" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  className={pane === t.id ? "selected" : ""}
                  onClick={() => {
                    if (busy) return;
                    setPane(t.id);
                    setTool("move");
                  }}
                  disabled={busy}
                >
                  <small>{t.number}</small>
                  {t.label}
                </button>
              ))}
            </nav>
            <div className="editor-content">
              <fieldset disabled={busy}>
                {pane === "motion" && (
                  <>
                    <div className="section-title">
                      <h2>选一种发疯方式</h2>
                      <span>4 款灵魂模板</span>
                    </div>
                    <div className="template-grid">
                      {templates.map((t) => (
                        <button
                          key={t.id}
                          className={`template-card ${settings.template === t.id ? "active" : ""}`}
                          onClick={() => {
                            update({ template: t.id });
                            setPlaying(true);
                          }}
                        >
                          <span
                            className={`template-art art-${t.id}`}
                            style={{ background: t.color }}
                          >
                            <span>{t.icon}</span>
                            <i>☺</i>
                          </span>
                          <span className="template-label">
                            <strong>{t.name}</strong>
                            <small>{t.sub}</small>
                          </span>
                          {settings.template === t.id && (
                            <span className="check">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="divider" />
                    <Range
                      label="发疯速度"
                      value={settings.speed}
                      min={0.5}
                      max={2}
                      step={0.1}
                      suffix="×"
                      onChange={(speed) => update({ speed })}
                    />
                    <Range
                      label="发疯强度"
                      value={Math.round(settings.intensity * 100)}
                      min={0}
                      max={100}
                      suffix="%"
                      onChange={(v) => update({ intensity: v / 100 })}
                    />
                    <div className="tip">
                      <span>✧</span>
                      小提示：强度拉满，快乐翻倍。头晕的话记得暂停。
                    </div>
                  </>
                )}
                {pane === "material" && (
                  <>
                    <div className="section-title">
                      <h2>主角，该你登场了</h2>
                      <span>PNG / JPG / WebP</span>
                    </div>
                    <button
                      className="upload-box"
                      onClick={() => input.current?.click()}
                    >
                      <span>＋</span>
                      <strong>选择一张照片</strong>
                      <small>点击从相册上传 · 最大 15 MB</small>
                    </button>
                    <p className="file-name">▧ {fileName}</p>
                    <button className="ai-button" onClick={removeBackground}>
                      ✦ AI 自动抠图 <small>首次按需下载模型</small>
                    </button>
                    <p className="micro">
                      AI 在本机运行，首次下载约 40 MB 模型及运行文件。透明 PNG
                      可直接进入下一步。
                    </p>
                    <div className="divider" />
                    <div className="section-title">
                      <h2>手动精修</h2>
                      <span>圈住想保留的部分</span>
                    </div>
                    <div className="tools">
                      {(
                        [
                          { id: "move", label: "移动", icon: "✥" },
                          { id: "lasso", label: "套索保留", icon: "♧" },
                          { id: "erase", label: "橡皮擦", icon: "▱" },
                          { id: "restore", label: "恢复", icon: "↶" },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.id}
                          className={tool === t.id ? "active" : ""}
                          onClick={() => {
                            setTool(t.id);
                            setPlaying(false);
                          }}
                        >
                          <span>{t.icon}</span>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    {(tool === "erase" || tool === "restore") && (
                      <Range
                        label="画笔大小"
                        value={brush}
                        min={4}
                        max={100}
                        suffix=" px"
                        onChange={setBrush}
                      />
                    )}
                    <div className="history-buttons">
                      <button
                        disabled={!history.current.canUndo || busy}
                        onClick={() => undo()}
                      >
                        ↶ 撤销
                      </button>
                      <button
                        disabled={!history.current.canRedo || busy}
                        onClick={() => undo(true)}
                      >
                        ↷ 重做
                      </button>
                      <button
                        onClick={() => {
                          const g = mask.current!.getContext("2d")!;
                          g.fillStyle = "white";
                          g.fillRect(0, 0, 512, 512);
                          saveMask();
                        }}
                      >
                        恢复原图
                      </button>
                    </div>
                    <button
                      className="next-button"
                      onClick={() => {
                        setPane("motion");
                        setTool("move");
                        setPlaying(true);
                      }}
                    >
                      素材好了，选动画 →
                    </button>
                  </>
                )}
                {pane === "style" && (
                  <>
                    <div className="section-title">
                      <h2>给快乐加点料</h2>
                      <span>最后亿点点调整</span>
                    </div>
                    <Range
                      label="主体大小"
                      value={settings.scale}
                      min={0.3}
                      max={1.8}
                      step={0.05}
                      suffix="×"
                      onChange={(scale) => update({ scale })}
                    />
                    <Range
                      label="旋转角度"
                      value={settings.rotation}
                      min={-180}
                      max={180}
                      suffix="°"
                      onChange={(rotation) => update({ rotation })}
                    />
                    <div className="position-fields">
                      <label>
                        水平位置
                        <input
                          type="number"
                          min={-160}
                          max={160}
                          value={Math.round(settings.x)}
                          onChange={(e) =>
                            update({
                              x: Math.max(
                                -160,
                                Math.min(160, Number(e.target.value)),
                              ),
                            })
                          }
                        />
                      </label>
                      <label>
                        垂直位置
                        <input
                          type="number"
                          min={-160}
                          max={160}
                          value={Math.round(settings.y)}
                          onChange={(e) =>
                            update({
                              y: Math.max(
                                -160,
                                Math.min(160, Number(e.target.value)),
                              ),
                            })
                          }
                        />
                      </label>
                      <button
                        onClick={() =>
                          update({ scale: 1, rotation: 0, x: 0, y: 0 })
                        }
                      >
                        居中
                      </button>
                    </div>
                    <label className="field-label">背景颜色</label>
                    <div className="swatches">
                      {[
                        "#e8f59b",
                        "#e8def8",
                        "#ffd8c3",
                        "#d0e9f0",
                        "#ffffff",
                        "#242424",
                        "transparent",
                      ].map((color) => (
                        <button
                          key={color}
                          aria-label={`背景 ${color}`}
                          aria-pressed={settings.background === color}
                          onClick={() => update({ background: color })}
                          className={`${settings.background === color ? "active" : ""} ${color === "transparent" ? "checker" : ""}`}
                          style={{
                            backgroundColor:
                              color === "transparent" ? undefined : color,
                          }}
                        >
                          {settings.background === color ? "✓" : ""}
                        </button>
                      ))}
                      <label className="custom-color" title="自定义背景颜色">
                        ＋
                        <input
                          aria-label="自定义背景颜色"
                          type="color"
                          value={
                            settings.background === "transparent"
                              ? "#ffffff"
                              : settings.background
                          }
                          onChange={(e) =>
                            update({ background: e.target.value })
                          }
                        />
                      </label>
                    </div>
                    <label className="field-label" htmlFor="caption">
                      表情文案
                      <span>{Array.from(settings.caption).length}/18</span>
                    </label>
                    <input
                      className="caption-input"
                      id="caption"
                      value={settings.caption}
                      placeholder="给你的精神状态配个字…"
                      onChange={(e) =>
                        update({
                          caption: Array.from(e.target.value)
                            .slice(0, 18)
                            .join(""),
                        })
                      }
                    />
                    <div className="text-settings">
                      <label>
                        文字颜色
                        <input
                          type="color"
                          aria-label="文字颜色"
                          value={settings.textColor}
                          onChange={(e) =>
                            update({ textColor: e.target.value })
                          }
                        />
                      </label>
                      <Range
                        label="字号"
                        value={settings.textSize}
                        min={16}
                        max={44}
                        onChange={(textSize) => update({ textSize })}
                      />
                    </div>
                    <div className="duration">
                      <span>循环时长</span>
                      {[1.5, 2].map((duration) => (
                        <button
                          key={duration}
                          className={
                            settings.duration === duration ? "active" : ""
                          }
                          onClick={() => update({ duration })}
                        >
                          {duration} 秒
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </fieldset>
            </div>
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => {
                void loadFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <div className="export-bar">
              <button
                className="export-primary"
                disabled={busy}
                onClick={() => generate("gif")}
              >
                {encoding
                  ? `正在制作 ${Math.round(progress * 100)}%`
                  : "↓ 导出 GIF"}
                <small>320 × 320 · 12fps</small>
              </button>
              <button
                className="export-secondary"
                disabled={busy}
                onClick={() => generate("png")}
              >
                导出封面<span>PNG</span>
              </button>
              {encoding && (
                <button
                  className="cancel"
                  onClick={() => abortExport.current?.abort()}
                >
                  取消
                </button>
              )}
            </div>
          </section>
        </div>
        <div className="notice" role="status" aria-live="polite">
          <span>{busy ? "◌" : "✧"}</span>
          {loading ? "正在读取素材…" : aiBusy ? aiProgress : notice}
          {aiBusy && (
            <button className="cancel" onClick={() => abortAi.current?.abort()}>
              取消抠图
            </button>
          )}
        </div>
        {result && (
          <section
            ref={resultPanel}
            className="result-panel"
            aria-label="导出结果"
          >
            <img
              src={result.url}
              alt={`生成的 ${result.kind.toUpperCase()} 表情包，可长按保存`}
            />
            <div>
              <div className="eyebrow">FRESH FROM THE LAB</div>
              <h2>你的快乐，打包好了。</h2>
              <p>
                {result.kind.toUpperCase()} · 320 × 320 ·{" "}
                {(result.blob.size / 1024).toFixed(0)} KB
              </p>
              <div className="result-actions">
                <a
                  className="download"
                  href={result.url}
                  download={`鬼畜制造所.${result.kind}`}
                >
                  下载 {result.kind.toUpperCase()}
                </a>
                <button onClick={share}>分享图片 ↗</button>
                <button
                  onClick={() => {
                    if (resultUrl.current)
                      URL.revokeObjectURL(resultUrl.current);
                    resultUrl.current = null;
                    setResult(null);
                  }}
                  aria-label="关闭导出结果"
                >
                  关闭
                </button>
              </div>
              <small>
                手机可长按图片保存。微信中下载受限时，请选择「在浏览器打开」。
              </small>
            </div>
          </section>
        )}
        <footer>
          <span>
            ✳ 鬼畜制造所 <b>让生活多一点不正经。</b>
          </span>
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            开源代码 · AGPL-3.0 ↗
          </a>
        </footer>
      </main>
      {showHelp && (
        <div className="modal-backdrop" onClick={() => setShowHelp(false)}>
          <section
            className="help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              autoFocus
              className="modal-close"
              aria-label="关闭帮助"
              onClick={() => setShowHelp(false)}
            >
              ×
            </button>
            <h2 id="help-title">三步，把快乐动起来</h2>
            <ol>
              <li>
                选择素材：上传照片、AI 抠图或手动精修。透明 PNG 可以直接使用。
              </li>
              <li>选择动画：四款模板，调整速度和强度。拖动画布调整位置。</li>
              <li>
                调整文案和背景，然后导出 GIF 或
                PNG。图片只在设备内存中处理，刷新会清空。
              </li>
            </ol>
            <p>
              自动抠图需要下载模型。低内存手机或微信浏览器可能无法运行，可切换手动工具。AI
              处理中请保持页面打开。
            </p>
            <p>
              套索拖动画圈，松手自动闭合，只保留圈内区域。画笔恢复来自原图；撤销重做最多保存
              20 个蒙版状态。精修时画布显示原始素材，不含动画和文案。
            </p>
            <p>
              GIF
              仅支持二值透明，半透明边缘可能出现锯齿；浅色背景更适合分享。动画较快时可暂停或降低强度。
            </p>
            <p>
              本应用使用 AGPL-3.0 的 IMG.LY 自动抠图库；模型由 IMG.LY
              提供下载，素材不会随下载请求发送。源码与许可证见页脚。
            </p>
            <button className="next-button" onClick={() => setShowHelp(false)}>
              开始制造快乐 →
            </button>
          </section>
        </div>
      )}
    </>
  );
}
