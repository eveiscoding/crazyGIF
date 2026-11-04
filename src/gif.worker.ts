import { createEncoder, addFrame } from "./encode";

let gif: ReturnType<typeof createEncoder> | undefined;
self.onmessage = (event: MessageEvent) => {
  try {
    const m = event.data;
    if (m.type === "start") {
      gif = createEncoder();
      self.postMessage({ type: "ready" });
    }
    if (m.type === "frame" && gif) {
      addFrame(gif, new Uint8Array(m.buffer), m.index, m.transparent);
      self.postMessage({ type: "frame", index: m.index });
    }
    if (m.type === "finish" && gif) {
      gif.finish();
      const buffer = gif.bytes().slice().buffer;
      self.postMessage({ type: "done", buffer }, { transfer: [buffer] });
      gif = undefined;
    }
  } catch (error) {
    self.postMessage({ type: "error", message: String(error) });
  }
};
