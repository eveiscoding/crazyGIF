// Loaded only when the user asks for AI. OffscreenCanvas is capability-checked
// by the caller; this worker owns the model and all its CPU/WASM processing.
import { removeBackground } from "@imgly/background-removal";
self.onmessage = async ({ data }: MessageEvent<{ image: Blob }>) => {
  try {
    const blob = await removeBackground(data.image, {
      model: "isnet_quint8",
      device: "cpu",
      proxyToWorker: false,
      progress: (_key, current, total) =>
        self.postMessage({ type: "progress", current, total }),
      output: { format: "image/png", quality: 1 },
    });
    self.postMessage({ type: "done", blob });
  } catch (e) {
    self.postMessage({ type: "error", message: String(e) });
  }
};
