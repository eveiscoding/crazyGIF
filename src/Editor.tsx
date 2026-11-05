import { useEffect, useRef, useState } from "react";
import type { PointerEvent as Pointer } from "react";
import { defaults, templates } from "./types";
import type { Layer, RenderLayer, Settings, Tool, Transform } from "./types";
import { canvas, demoSubject, pose, render } from "./render";
import {
  composeAsset,
  createAsset,
  MAX_ASSETS,
  MAX_LAYERS,
  readAsset,
  refreshThumbnail,
} from "./assets";
import type { Asset } from "./assets";
import { exportGif, exportPng } from "./export";
import { removeLocalBackground } from "./ai";

type Point = { x: number; y: number };
type Result = { url: string; blob: Blob; kind: "gif" | "png" };
type Gesture = {
  points: Point[];
  pointer: number;
  start: Point;
  layerId: string;
  asset: Asset;
  x: number;
  y: number;
};
const sourceUrl = __SOURCE_URL__ || "https://github.com/eveiscoding/crazyGIF";
const tools = [
  { id: "move", label: "预览" },
  { id: "lasso", label: "套索保留" },
  { id: "erase", label: "橡皮擦" },
  { id: "restore", label: "恢复画笔" },
] as const;
const identity: Transform = { x: 0, y: 0, scale: 1, rotation: 0 };
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
        <span className="range-value">
          {Number(value.toFixed(2))}
          {suffix}
        </span>
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

export default function Editor() {
  const [settings, setSettings] = useState<Settings>({ ...defaults });
  const [assets, setAssets] = useState<Asset[]>(() => [
    createAsset("demo", "示例素材", demoSubject()),
  ]);
  const [layers, setLayers] = useState<Layer[]>([
    { id: "layer-demo", assetId: "demo", ...identity },
  ]);
  const [selectedId, setSelectedId] = useState("layer-demo");
  const [pane, setPane] = useState<"material" | "motion" | "style">("motion");
  const [tool, setTool] = useState<Tool>("move");
  const [aux, setAux] = useState("transparent");
  const [cursor, setCursor] = useState<Point | null>({ x: 256, y: 256 });
  const [playing, setPlaying] = useState(
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [brush, setBrush] = useState(32);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProgress, setAiProgress] = useState("");
  const [encoding, setEncoding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [help, setHelp] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    view = useRef<HTMLCanvasElement>(null),
    resultPanel = useRef<HTMLElement>(null);
  const resultUrl = useRef<string | null>(null),
    gesture = useRef<Gesture | null>(null);
  const phaseRef = useRef(0),
    sequence = useRef(0);
  const abortExport = useRef<AbortController | null>(null),
    abortAi = useRef<AbortController | null>(null);
  const busy = encoding || loading || aiBusy;
  const selected = layers.find((l) => l.id === selectedId),
    asset = assets.find((a) => a.id === selected?.assetId);
  const editing = pane === "material" && Boolean(asset);
  const brushMode = editing && (tool === "erase" || tool === "restore");
  const update = (p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p }));
  const updateLayer = (p: Partial<Transform>, id = selectedId) =>
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const scene = (): RenderLayer[] =>
    layers.flatMap((l) => {
      const a = assets.find((a) => a.id === l.assetId);
      return a ? [{ ...l, subject: a.subject }] : [];
    });
  const repaint = (a: Asset, commit = false) => {
    composeAsset(a);
    if (commit) {
      a.history.push(a.mask.getContext("2d")!.getImageData(0, 0, 512, 512));
      refreshThumbnail(a);
    }
    setRevision((n) => n + 1);
  };
  useEffect(() => {
    if (result)
      resultPanel.current?.scrollIntoView({
        block: "center",
        behavior: "instant",
      });
  }, [result]);
  useEffect(
    () => () => {
      abortAi.current?.abort();
      abortExport.current?.abort();
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    },
    [],
  );
  useEffect(() => {
    let raf = 0,
      start: number | undefined;
    const images = scene();
    const draw = (time: number) => {
      if (start === undefined) start = time;
      const phase = playing
        ? ((time - start) % (settings.duration * 1000)) /
          (settings.duration * 1000)
        : 0;
      phaseRef.current = phase;
      const g = view.current?.getContext("2d");
      if (g) {
        if (editing && asset) {
          g.clearRect(0, 0, 640, 640);
          g.save();
          g.scale(640 / 512, 640 / 512);
          g.drawImage(asset.subject, 0, 0);
          const points = gesture.current?.points;
          if (tool === "lasso" && points?.length) {
            g.beginPath();
            points.forEach((p, i) =>
              i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y),
            );
            g.strokeStyle = "#7c9432";
            g.lineWidth = 3;
            g.setLineDash([8, 5]);
            g.stroke();
          }
          g.restore();
        } else render(g, images, settings, phase);
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
  }, [assets, layers, settings, playing, editing, tool, revision, asset]);

  const chooseLayer = (id: string) => {
    if (!busy && !gesture.current) {
      setSelectedId(id);
      setCursor({ x: 256, y: 256 });
    }
  };
  const changeTool = (t: Tool) => {
    if (!busy && !gesture.current) {
      setTool(t);
      setCursor({ x: 256, y: 256 });
      setPlaying(false);
    }
  };
  const changeBrush = (value: number) => {
    setBrush(value);
    setCursor((current) => current || { x: 256, y: 256 });
  };
  function addLayer(a: Asset, copy = false) {
    if (busy) return;
    if (layers.length >= MAX_LAYERS) {
      setNotice(`画布最多 ${MAX_LAYERS} 个图层`);
      return;
    }
    const id = `layer-${++sequence.current}`,
      base = copy && selected ? selected : identity;
    setLayers((ls) => [
      ...ls,
      {
        ...base,
        id,
        assetId: a.id,
        x: Math.min(160, base.x + (copy ? 24 : 0)),
        y: Math.min(160, base.y + (copy ? 24 : 0)),
      },
    ]);
    setSelectedId(id);
    setTool("move");
    if (copy) setPane("style");
    setNotice("");
  }
  function removeLayer() {
    if (busy) return;
    const ls = layers.filter((l) => l.id !== selectedId);
    setLayers(ls);
    setSelectedId(ls[ls.length - 1]?.id || "");
    setTool("move");
  }
  function deleteAsset(id: string) {
    if (busy) return;
    const ls = layers.filter((l) => l.assetId !== id);
    setLayers(ls);
    setAssets((as) => as.filter((a) => a.id !== id));
    if (!ls.some((l) => l.id === selectedId))
      setSelectedId(ls[ls.length - 1]?.id || "");
    setTool("move");
  }
  async function loadFiles(files: File[]) {
    if (!files.length || busy) return;
    setLoading(true);
    setNotice("");
    const replace =
      assets.length === 1 && assets[0].id === "demo" && layers.length === 1;
    const baseAssets = replace ? [] : assets,
      baseLayers = replace ? [] : layers;
    const added: Asset[] = [],
      newLayers: Layer[] = [],
      errors: string[] = [];
    try {
      for (const file of files) {
        if (
          baseAssets.length + added.length >= MAX_ASSETS ||
          baseLayers.length + newLayers.length >= MAX_LAYERS
        ) {
          errors.push(`最多 ${MAX_ASSETS} 个素材、${MAX_LAYERS} 个图层`);
          break;
        }
        try {
          const id = `asset-${++sequence.current}`,
            a = await readAsset(file, id);
          added.push(a);
          newLayers.push({
            id: `layer-${++sequence.current}`,
            assetId: id,
            ...identity,
          });
        } catch (e) {
          errors.push(e instanceof Error ? e.message : "图片读取失败");
        }
      }
      if (newLayers.length > 1) {
        const columns = newLayers.length === 2 ? 2 : 3;
        newLayers.forEach((l, i) => {
          l.scale = columns === 2 ? 0.6 : 0.42;
          l.x =
            ((i % columns) - (columns - 1) / 2) * (columns === 2 ? 140 : 92);
          l.y =
            newLayers.length > columns
              ? (Math.floor(i / columns) - 0.5) * 130
              : 0;
        });
      }
      if (added.length) {
        setAssets([...baseAssets, ...added]);
        setLayers([...baseLayers, ...newLayers]);
        setSelectedId(newLayers[newLayers.length - 1].id);
        setPane("material");
        setTool("move");
      }
      setNotice(errors.join("；"));
    } finally {
      setLoading(false);
    }
  }
  const point = (e: Pointer<HTMLCanvasElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 512,
      y: ((e.clientY - r.top) / r.height) * 512,
    };
  };
  const paint = (a: Asset, from: Point, to: Point) => {
    const g = a.mask.getContext("2d")!;
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
    repaint(a);
  };
  function hitLayer(p: Point) {
    const m = pose(
      settings.template,
      phaseRef.current,
      settings.intensity,
      settings.speed,
    );
    for (const l of [...layers].reverse()) {
      const a = assets.find((a) => a.id === l.assetId);
      if (!a) continue;
      const x = (p.x * 320) / 512 - 160 - l.x - m.x,
        y = (p.y * 320) / 512 - 158 - l.y - m.y,
        r = (l.rotation * Math.PI) / 180 + m.r,
        s = l.scale * m.s;
      const u = (((x * Math.cos(r) + y * Math.sin(r)) / s + 125) * 512) / 250,
        v = (((-x * Math.sin(r) + y * Math.cos(r)) / s + 125) * 512) / 250;
      if (
        u >= 0 &&
        v >= 0 &&
        u < 512 &&
        v < 512 &&
        a.subject
          .getContext("2d")!
          .getImageData(Math.floor(u), Math.floor(v), 1, 1).data[3] > 20
      )
        return l;
    }
    return selected;
  }
  const pointerDown = (e: Pointer<HTMLCanvasElement>) => {
    if (busy || gesture.current || (editing && tool === "move")) return;
    const p = point(e),
      l = editing ? selected : hitLayer(p),
      a = assets.find((a) => a.id === l?.assetId);
    if (!l || !a) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedId(l.id);
    setCursor(p);
    gesture.current = {
      points: [p],
      pointer: e.pointerId,
      start: p,
      layerId: l.id,
      asset: a,
      x: l.x,
      y: l.y,
    };
    if (brushMode) paint(a, p, p);
  };
  const pointerMove = (e: Pointer<HTMLCanvasElement>) => {
    const p = point(e);
    if (brushMode) setCursor(p);
    const g = gesture.current;
    if (!g || g.pointer !== e.pointerId || busy) return;
    if (!editing)
      updateLayer(
        {
          x: Math.max(
            -160,
            Math.min(160, g.x + ((p.x - g.start.x) * 320) / 512),
          ),
          y: Math.max(
            -160,
            Math.min(160, g.y + ((p.y - g.start.y) * 320) / 512),
          ),
        },
        g.layerId,
      );
    else {
      if (brushMode) paint(g.asset, g.points[g.points.length - 1], p);
      g.points.push(p);
    }
  };
  const pointerEnd = (e: Pointer<HTMLCanvasElement>, cancelled = false) => {
    const a = gesture.current;
    if (!a || a.pointer !== e.pointerId) return;
    if (editing) {
      const g = a.asset.mask.getContext("2d")!;
      if (cancelled) g.putImageData(a.asset.history.current(), 0, 0);
      else if (tool === "lasso" && a.points.length > 2) {
        const c = canvas(),
          s = c.getContext("2d")!;
        s.fillStyle = "white";
        s.beginPath();
        a.points.forEach((p, i) =>
          i ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y),
        );
        s.closePath();
        s.fill();
        g.globalCompositeOperation = "destination-in";
        g.drawImage(c, 0, 0);
        g.globalCompositeOperation = "source-over";
      }
      repaint(a.asset, !cancelled && (tool !== "lasso" || a.points.length > 2));
    } else if (cancelled) updateLayer({ x: a.x, y: a.y }, a.layerId);
    gesture.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };
  function undo(redo = false) {
    if (busy || !asset) return;
    const data = redo ? asset.history.redo() : asset.history.undo();
    if (data) {
      asset.mask.getContext("2d")!.putImageData(data, 0, 0);
      repaint(asset);
      refreshThumbnail(asset);
    }
  }
  async function removeBackground() {
    if (busy || !asset) return;
    if (
      !window.WebAssembly ||
      !window.Worker ||
      !window.OffscreenCanvas ||
      !window.createImageBitmap
    ) {
      setNotice("当前浏览器不支持本地 AI，请用手动抠图或透明 PNG。");
      return;
    }
    const target = asset,
      controller = new AbortController();
    abortAi.current = controller;
    setAiBusy(true);
    setAiProgress("首次使用需下载约 40 MB 模型及运行文件…");
    try {
      const image = await new Promise<Blob>((resolve, reject) =>
        target.original.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("图片读取失败"))),
          "image/png",
        ),
      );
      const blob = await removeLocalBackground(
        image,
        setAiProgress,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("结果读取失败"));
          img.src = url;
        });
        if (controller.signal.aborted) return;
        const g = target.mask.getContext("2d")!;
        g.clearRect(0, 0, 512, 512);
        g.drawImage(img, 0, 0, 512, 512);
        repaint(target, true);
        setNotice("自动抠图完成");
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      setNotice(
        controller.signal.aborted
          ? "自动抠图已取消"
          : "本地 AI 未能完成，请重试、手动抠图或使用透明 PNG。",
      );
    } finally {
      setAiBusy(false);
      setAiProgress("");
      abortAi.current = null;
    }
  }
  async function generate(kind: "gif" | "png") {
    if (busy) return;
    const images = scene().map((l) => {
      const c = canvas();
      c.getContext("2d")!.drawImage(l.subject, 0, 0);
      return { ...l, subject: c };
    });
    const controller = new AbortController();
    abortExport.current = controller;
    setEncoding(true);
    setProgress(0);
    setPlaying(false);
    try {
      const blob =
        kind === "gif"
          ? await exportGif(
              images,
              { ...settings },
              setProgress,
              controller.signal,
            )
          : await exportPng(images, { ...settings });
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
      const url = URL.createObjectURL(blob);
      resultUrl.current = url;
      setResult({ url, blob, kind });
      setNotice("");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "导出失败");
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
        await navigator.share({ files: [file], title: "表情包" });
      else setNotice("请下载或长按图片保存；微信中可选择「在浏览器打开」。");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError"))
        setNotice("分享未完成，请下载后分享。");
    }
  }
  const transform = selected || identity;
  return (
    <>
      <header className="header">
        <h1 className="brand">
          <span className="brand-icon" aria-hidden="true">
            ✳
          </span>
          鬼畜制造所
        </h1>
        <div className="header-right">
          <span className="local-tag">
            <i />
            本地处理
          </span>
          <button
            className="icon-button"
            aria-label="使用帮助"
            onClick={() => setHelp(true)}
          >
            ?
          </button>
        </div>
      </header>
      <main className="functional-main">
        <div className="workspace">
          <section className="preview-panel" aria-label="实时预览">
            <div className="panel-top">
              <span>
                <i className="live-dot" />
                {editing ? "抠图编辑" : "实时预览"}
              </span>
              <span className="size-badge">320 × 320</span>
            </div>
            {pane === "material" && (
              <div className="canvas-edit-controls">
                <div className="quick-tools">
                  <div>
                    {tools.map((t) => (
                      <button
                        key={t.id}
                        aria-label={`画布${t.label}`}
                        disabled={busy || !asset}
                        className={tool === t.id ? "active" : ""}
                        onClick={() => changeTool(t.id)}
                      >
                        {t.label === "橡皮擦"
                          ? "擦除"
                          : t.label === "套索保留"
                            ? "套索"
                            : t.label === "恢复画笔"
                              ? "恢复"
                              : t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div
                  className="aux-background"
                  role="group"
                  aria-label="抠图辅助背景"
                >
                  <span>辅助背景</span>
                  {[
                    { value: "transparent", label: "透明" },
                    { value: "#000000", label: "黑色" },
                    { value: "#ffffff", label: "白色" },
                  ].map((b) => (
                    <button
                      key={b.value}
                      aria-pressed={aux === b.value}
                      disabled={busy}
                      className={aux === b.value ? "active" : ""}
                      onClick={() => setAux(b.value)}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
                {brushMode && (
                  <Range
                    label="画笔大小"
                    value={brush}
                    min={4}
                    max={100}
                    suffix=" px"
                    onChange={changeBrush}
                  />
                )}
              </div>
            )}
            <div className="stage-wrap">
              <div
                className={`stage ${editing ? (aux === "transparent" ? "checker" : "") : settings.background === "transparent" ? "checker" : ""}`}
                style={
                  editing
                    ? {
                        backgroundColor:
                          aux === "transparent" ? "#ffffff" : aux,
                      }
                    : undefined
                }
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
                  onPointerLeave={() => {
                    if (!gesture.current) setCursor(null);
                  }}
                />
                {brushMode && cursor && (
                  <svg
                    className="brush-outline"
                    data-testid="brush-outline"
                    viewBox="0 0 512 512"
                    aria-label={`画笔直径 ${brush} 像素`}
                  >
                    <circle
                      cx={cursor.x}
                      cy={cursor.y}
                      r={brush / 2}
                      className="brush-ring-under"
                    />
                    <circle
                      cx={cursor.x}
                      cy={cursor.y}
                      r={brush / 2}
                      className="brush-ring"
                    />
                  </svg>
                )}
              </div>
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
                    ? tools.find((t) => t.id === tool)?.label
                    : templates.find((t) => t.id === settings.template)?.name}
                </strong>
                <small>
                  {editing
                    ? tool === "lasso"
                      ? "画圈保留，松手应用"
                      : brushMode
                        ? "虚线内为画笔范围"
                        : "选择工具进行抠图"
                    : "点击素材选择，拖动调整位置"}
                </small>
              </div>
              <span className="loop">{settings.duration} 秒 · 12fps</span>
            </div>
            <div className="layer-section">
              <div className="section-title">
                <h2>画布图层</h2>
                <span>
                  {layers.length}/{MAX_LAYERS}
                </span>
              </div>
              <div className="layer-list" aria-label="画布图层">
                {[...layers].reverse().map((l, i) => {
                  const a = assets.find((a) => a.id === l.assetId)!;
                  return (
                    <button
                      key={l.id}
                      className={`layer-item ${l.id === selectedId ? "active" : ""}`}
                      aria-pressed={l.id === selectedId}
                      aria-label={`选择图层 ${layers.length - i} ${a.name}`}
                      disabled={busy}
                      onClick={() => chooseLayer(l.id)}
                    >
                      <img src={a.thumbnail} alt="" />
                      <span>{a.name}</span>
                      <small>{layers.length - i}</small>
                    </button>
                  );
                })}
                {!layers.length && (
                  <p className="micro">上传素材或从素材列表添加图层</p>
                )}
              </div>
              <div className="layer-actions">
                <button
                  disabled={busy || !asset || layers.length >= MAX_LAYERS}
                  onClick={() => asset && addLayer(asset, true)}
                >
                  复制图层
                </button>
                <button
                  disabled={busy || !selected}
                  onClick={() =>
                    setLayers((ls) => [
                      ...ls.filter((l) => l.id !== selectedId),
                      selected!,
                    ])
                  }
                >
                  置于顶层
                </button>
                <button disabled={busy || !selected} onClick={removeLayer}>
                  移除图层
                </button>
              </div>
            </div>
          </section>
          <section className="editor-panel" aria-label="编辑工具">
            <nav className="tabs" aria-label="制作步骤">
              {(
                [
                  { id: "material", label: "选素材" },
                  { id: "motion", label: "动画" },
                  { id: "style", label: "构图与文字" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  className={pane === t.id ? "selected" : ""}
                  disabled={busy}
                  onClick={() => {
                    setPane(t.id);
                    setTool("move");
                  }}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            <div className="editor-content">
              <fieldset disabled={busy}>
                {pane === "material" && (
                  <>
                    <div className="section-title">
                      <h2>素材</h2>
                      <span>
                        {assets.length}/{MAX_ASSETS}
                      </span>
                    </div>
                    <button
                      className="upload-box compact-upload"
                      onClick={() => input.current?.click()}
                    >
                      <strong>＋ 上传素材</strong>
                      <small>可多选 PNG / JPEG / WebP，单张 ≤15 MB</small>
                    </button>
                    <div className="asset-list" aria-label="素材列表">
                      {assets.map((a) => (
                        <div
                          className={`asset-item ${asset?.id === a.id ? "active" : ""}`}
                          key={a.id}
                        >
                          <button
                            className="asset-select"
                            onClick={() => {
                              const l = layers.find((l) => l.assetId === a.id);
                              if (l) chooseLayer(l.id);
                              else addLayer(a);
                            }}
                          >
                            <img src={a.thumbnail} alt="" />
                            <span>{a.name}</span>
                          </button>
                          <button
                            aria-label={`添加素材到画布 ${a.name}`}
                            disabled={layers.length >= MAX_LAYERS}
                            onClick={() => addLayer(a)}
                          >
                            ＋
                          </button>
                          <button
                            aria-label={`删除素材及其图层 ${a.name}`}
                            onClick={() => deleteAsset(a.id)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      className="ai-button"
                      disabled={!asset || busy}
                      onClick={removeBackground}
                    >
                      AI 自动抠图
                    </button>
                    <p className="micro">首次下载模型；透明 PNG 可直接使用。</p>
                    <div className="divider" />
                    <div className="section-title">
                      <h2>手动抠图</h2>
                    </div>
                    <div className="tools">
                      {tools.map((t) => (
                        <button
                          key={t.id}
                          disabled={!asset || busy}
                          className={tool === t.id ? "active" : ""}
                          onClick={() => changeTool(t.id)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <div className="history-buttons">
                      <button
                        disabled={busy || !asset?.history.canUndo}
                        onClick={() => undo()}
                      >
                        ↶ 撤销
                      </button>
                      <button
                        disabled={busy || !asset?.history.canRedo}
                        onClick={() => undo(true)}
                      >
                        ↷ 重做
                      </button>
                      <button
                        disabled={!asset || busy}
                        onClick={() => {
                          if (!asset) return;
                          const g = asset.mask.getContext("2d")!;
                          g.fillStyle = "white";
                          g.fillRect(0, 0, 512, 512);
                          repaint(asset, true);
                        }}
                      >
                        恢复原图
                      </button>
                    </div>
                    <p className="micro">
                      副本共用抠图结果，位置、大小和角度独立调整。
                    </p>
                  </>
                )}
                {pane === "motion" && (
                  <>
                    <div className="section-title">
                      <h2>动画模板</h2>
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
                            aria-hidden="true"
                          >
                            <i>{t.icon}</i>
                          </span>
                          <span className="template-label">
                            <strong>{t.name}</strong>
                          </span>
                          {settings.template === t.id && (
                            <span className="check" aria-hidden="true">
                              ✓
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="divider" />
                    <Range
                      label="速度"
                      value={settings.speed}
                      min={0.5}
                      max={2}
                      step={0.1}
                      suffix="×"
                      onChange={(speed) => update({ speed })}
                    />
                    <Range
                      label="强度"
                      value={Math.round(settings.intensity * 100)}
                      min={0}
                      max={100}
                      suffix="%"
                      onChange={(v) => update({ intensity: v / 100 })}
                    />
                    <label className="field-label" htmlFor="text-motion">
                      文字动效
                    </label>
                    <select
                      id="text-motion"
                      value={settings.textMotion}
                      onChange={(e) => {
                        update({
                          textMotion: e.target.value as Settings["textMotion"],
                        });
                        setPlaying(true);
                      }}
                    >
                      <option value="none">静止</option>
                      <option value="bounce">弹跳</option>
                      <option value="shake">摇摆</option>
                      <option value="pulse">缩放</option>
                    </select>
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
                {pane === "style" && (
                  <>
                    <div className="section-title">
                      <h2>选中图层</h2>
                      <span className="selected-name">
                        {asset?.name || "未选择"}
                      </span>
                    </div>
                    <fieldset disabled={!selected || busy}>
                      <Range
                        label="主体大小"
                        value={transform.scale}
                        min={0.3}
                        max={1.8}
                        step={0.05}
                        suffix="×"
                        onChange={(scale) => updateLayer({ scale })}
                      />
                      <Range
                        label="旋转角度"
                        value={transform.rotation}
                        min={-180}
                        max={180}
                        suffix="°"
                        onChange={(rotation) => updateLayer({ rotation })}
                      />
                      <div className="position-fields">
                        <label>
                          水平位置
                          <input
                            type="number"
                            min={-160}
                            max={160}
                            value={Math.round(transform.x)}
                            onChange={(e) =>
                              updateLayer({
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
                            value={Math.round(transform.y)}
                            onChange={(e) =>
                              updateLayer({
                                y: Math.max(
                                  -160,
                                  Math.min(160, Number(e.target.value)),
                                ),
                              })
                            }
                          />
                        </label>
                        <button onClick={() => updateLayer(identity)}>
                          重置构图
                        </button>
                      </div>
                    </fieldset>
                    <label className="field-label">导出背景</label>
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
                          className={`${settings.background === color ? "active" : ""} ${color === "transparent" ? "checker" : ""}`}
                          style={{
                            backgroundColor:
                              color === "transparent" ? undefined : color,
                          }}
                          onClick={() => update({ background: color })}
                        >
                          {settings.background === color ? "✓" : ""}
                        </button>
                      ))}
                      <label className="custom-color">
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
                  </>
                )}
              </fieldset>
            </div>
            <input
              ref={input}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => {
                void loadFiles(Array.from(e.target.files || []));
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
                  ? `正在导出 ${Math.round(progress * 100)}%`
                  : "导出 GIF"}
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
        <div
          className={`notice ${!notice && !busy ? "empty-notice" : ""}`}
          role="status"
          aria-live="polite"
        >
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
              <h2>导出结果</h2>
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
                <button onClick={share}>分享图片</button>
                <button
                  aria-label="关闭导出结果"
                  onClick={() => {
                    if (resultUrl.current)
                      URL.revokeObjectURL(resultUrl.current);
                    resultUrl.current = null;
                    setResult(null);
                  }}
                >
                  关闭
                </button>
              </div>
              <small>
                可长按图片保存；微信下载受限时请选择「在浏览器打开」。
              </small>
            </div>
          </section>
        )}
        <footer>
          <span>素材不上传，刷新后清空</span>
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            源码与许可证 ↗
          </a>
        </footer>
      </main>
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
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
              onClick={() => setHelp(false)}
            >
              ×
            </button>
            <h2 id="help-title">功能说明</h2>
            <p>
              最多 {MAX_ASSETS} 个素材、{MAX_LAYERS}{" "}
              个图层。点选图层后拖动，可复制、置顶、移除。副本共用抠图结果；删除素材会删除对应全部图层。
            </p>
            <p>
              套索松手闭合，保留圈内区域。画笔按虚线范围生效，每个素材保留 10
              个蒙版状态。辅助背景不参与导出。
            </p>
            <p>
              AI
              首次需下载模型，在本机运行；浏览器不支持或内存不足时使用手动抠图或透明
              PNG。
            </p>
            <p>
              GIF 包含所有图层与文字动效，透明度为二值。PNG 为第 0
              帧。刷新会清空素材。
            </p>
            <p>IMG.LY 依赖采用 AGPL-3.0，源码与许可证见页脚。</p>
          </section>
        </div>
      )}
    </>
  );
}
