import { canvas, render } from "./render";
import type { Settings } from "./types";

export function exportGif(
  subject: HTMLCanvasElement,
  settings: Settings,
  progress: (n: number) => void,
  signal: AbortSignal,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./gif.worker.ts", import.meta.url), {
      type: "module",
    });
    const c = canvas(320);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    const frames = Math.round(settings.duration * 12);
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      worker.terminate();
      signal.removeEventListener("abort", abort);
    };
    const fail = (error: Error) => {
      cleanup();
      reject(error);
    };
    const abort = () => fail(new Error("导出已取消"));
    const watch = () => {
      clearTimeout(timer);
      timer = setTimeout(() => fail(new Error("编码超时，请重试")), 30000);
    };
    const next = (index: number) => {
      watch();
      if (index >= frames) {
        worker.postMessage({ type: "finish" });
        return;
      }
      render(ctx, subject, settings, index / frames);
      const data = ctx.getImageData(0, 0, 320, 320).data;
      worker.postMessage(
        {
          type: "frame",
          buffer: data.buffer,
          index,
          transparent: settings.background === "transparent",
        },
        [data.buffer],
      );
    };
    worker.onmessage = ({ data }) => {
      if (data.type === "ready") next(0);
      if (data.type === "frame") {
        progress((data.index + 1) / frames);
        next(data.index + 1);
      }
      if (data.type === "done") {
        cleanup();
        resolve(new Blob([data.buffer], { type: "image/gif" }));
      }
      if (data.type === "error") fail(new Error(data.message));
    };
    worker.onerror = () =>
      fail(new Error("当前浏览器无法启动编码，请用系统浏览器重试"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    watch();
    worker.postMessage({ type: "start" });
  });
}

export function exportPng(
  subject: HTMLCanvasElement,
  settings: Settings,
): Promise<Blob> {
  const c = canvas(320);
  render(c.getContext("2d")!, subject, settings, 0);
  return new Promise((resolve, reject) =>
    c.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("封面生成失败"))),
      "image/png",
    ),
  );
}
