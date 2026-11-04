import { GIFEncoder, quantize, applyPalette } from "gifenc";

export function createEncoder() {
  return GIFEncoder();
}
export function addFrame(
  gif: ReturnType<typeof GIFEncoder>,
  rgba: Uint8Array,
  index: number,
  transparent: boolean,
) {
  // Reserve one GIF palette index explicitly. Nearest RGBA matching can map
  // transparent colored pixels to an opaque entry of the same RGB color.
  const palette = quantize(rgba, transparent ? 255 : 256, { format: "rgb565" });
  const indexed = applyPalette(rgba, palette, "rgb565");
  const transparentIndex = transparent ? palette.length : -1;
  if (transparent) {
    palette.push([0, 0, 0]);
    for (let p = 0; p < indexed.length; p++)
      if (rgba[p * 4 + 3] < 128) indexed[p] = transparentIndex;
  }
  // GIF delays use hundredths: 80 + 90 + 80 ms averages to 12 fps.
  const delay =
    (Math.round(((index + 1) * 100) / 12) - Math.round((index * 100) / 12)) *
    10;
  gif.writeFrame(indexed, 320, 320, {
    palette,
    delay,
    repeat: 0,
    transparent: transparentIndex >= 0,
    transparentIndex: Math.max(0, transparentIndex),
    dispose: 2,
  });
}
