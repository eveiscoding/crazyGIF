export function removeLocalBackground(
  image: Blob,
  progress: (message: string) => void,
  signal: AbortSignal,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./ai.worker.ts", import.meta.url), {
      type: "module",
    });
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      worker.terminate();
      signal.removeEventListener("abort", abort);
    };
    const fail = (e: Error) => {
      cleanup();
      reject(e);
    };
    const abort = () => fail(new Error("自动抠图已取消"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    // Bound cold downloads and slow inference, while allowing older phones time.
    timer = setTimeout(() => fail(new Error("本地 AI 超时")), 180000);
    worker.onerror = () => fail(new Error("本地 AI Worker 不可用"));
    worker.onmessage = ({ data }) => {
      if (data.type === "progress")
        progress(
          data.total
            ? `正在下载模型文件 ${Math.round((data.current / data.total) * 100)}%（分文件进度）`
            : "正在本地处理…",
        );
      if (data.type === "done") {
        cleanup();
        resolve(data.blob);
      }
      if (data.type === "error") fail(new Error(data.message));
    };
    worker.postMessage({ image });
  });
}
