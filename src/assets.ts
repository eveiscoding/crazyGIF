import { canvas } from "./render";
import { MaskHistory } from "./history";

export const MAX_ASSETS = 6;
export const MAX_LAYERS = 12;
export interface Asset {
  id: string;
  name: string;
  original: HTMLCanvasElement;
  mask: HTMLCanvasElement;
  subject: HTMLCanvasElement;
  history: MaskHistory;
  thumbnail: string;
}
export function refreshThumbnail(asset: Asset) {
  const thumb = canvas(72);
  thumb.getContext("2d")!.drawImage(asset.subject, 0, 0, 72, 72);
  asset.thumbnail = thumb.toDataURL("image/png");
}
export function composeAsset(asset: Asset) {
  const g = asset.subject.getContext("2d")!;
  g.clearRect(0, 0, 512, 512);
  g.globalCompositeOperation = "source-over";
  g.drawImage(asset.original, 0, 0);
  g.globalCompositeOperation = "destination-in";
  g.drawImage(asset.mask, 0, 0);
  g.globalCompositeOperation = "source-over";
}
export function createAsset(
  id: string,
  name: string,
  source: CanvasImageSource,
): Asset {
  const asset: Asset = {
    id,
    name,
    original: canvas(),
    mask: canvas(),
    subject: canvas(),
    history: new MaskHistory(10),
    thumbnail: "",
  };
  asset.original.getContext("2d")!.drawImage(source, 0, 0, 512, 512);
  const g = asset.mask.getContext("2d")!;
  g.fillStyle = "white";
  g.fillRect(0, 0, 512, 512);
  asset.history.push(g.getImageData(0, 0, 512, 512));
  composeAsset(asset);
  refreshThumbnail(asset);
  return asset;
}
export async function readAsset(file: File, id: string): Promise<Asset> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type))
    throw new Error(`${file.name}：仅支持 PNG、JPEG、WebP`);
  if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name}：超过 15 MB`);
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`${file.name}：无法读取图片`));
      img.src = url;
    });
    if (!img.naturalWidth || img.naturalWidth * img.naturalHeight > 40_000_000)
      throw new Error(`${file.name}：请使用 4000 万像素以内的图片`);
    const c = canvas();
    const scale = 460 / Math.max(img.naturalWidth, img.naturalHeight);
    const w = img.naturalWidth * scale,
      h = img.naturalHeight * scale;
    c.getContext("2d")!.drawImage(img, (512 - w) / 2, (512 - h) / 2, w, h);
    return createAsset(id, file.name, c);
  } finally {
    URL.revokeObjectURL(url);
  }
}
