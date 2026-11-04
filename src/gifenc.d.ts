declare module "gifenc" {
  export function GIFEncoder(): {
    writeFrame(
      data: Uint8Array,
      width: number,
      height: number,
      opts: {
        palette: number[][];
        delay: number;
        repeat?: number;
        transparent?: boolean;
        transparentIndex?: number;
        dispose?: number;
      },
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  };
  export function quantize(
    rgba: Uint8Array,
    count: number,
    opts?: { format: string; oneBitAlpha?: boolean },
  ): number[][];
  export function applyPalette(
    rgba: Uint8Array,
    palette: number[][],
    format?: string,
  ): Uint8Array;
}
declare const __SOURCE_URL__: string;
