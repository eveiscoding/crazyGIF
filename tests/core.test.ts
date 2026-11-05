import { describe, it, expect } from "vitest";
import { GifReader } from "omggif";
import { pose, textPose } from "../src/render";
import { MaskHistory } from "../src/history";
import { createEncoder, addFrame } from "../src/encode";
import { defaults, templates } from "../src/types";

describe("caption animation", () => {
  it("starts with the requested caption and an enabled effect", () => {
    expect(defaults.caption).toBe("我也可以动哦");
    expect(defaults.textMotion).toBe("bounce");
  });
  for (const motion of ["none", "bounce", "shake", "pulse"] as const) {
    it(`${motion} closes its loop and respects zero intensity`, () => {
      const first = textPose(motion, 0, 1, 1.7),
        last = textPose(motion, 1, 1, 1.7);
      for (const key of ["x", "y", "r", "s"] as const)
        expect(first[key]).toBeCloseTo(last[key]);
      const p = textPose(motion, 0.19, 0, 1);
      expect(p.x).toBeCloseTo(0);
      expect(p.y).toBeCloseTo(0);
      expect(p.r).toBeCloseTo(0);
      expect(p.s).toBeCloseTo(1);
    });
  }
});

describe("loop motion", () => {
  it("zero intensity leaves the composition still for every template", () => {
    for (const { id } of templates) {
      const p = pose(id, 0.37, 0, 1);
      expect(p.x).toBeCloseTo(0);
      expect(p.y).toBeCloseTo(0);
      expect(p.r).toBeCloseTo(0);
      expect(p.s).toBe(1);
    }
  });
  for (const { id } of templates)
    for (const speed of [0.5, 1, 1.7, 2]) {
      it(`${id} closes the loop at speed ${speed}`, () => {
        const first = pose(id, 0, 1, speed),
          last = pose(id, 1, 1, speed);
        expect(first.x).toBeCloseTo(last.x);
        expect(first.y).toBeCloseTo(last.y);
        expect(first.s).toBeCloseTo(last.s);
        expect(Math.sin(first.r)).toBeCloseTo(Math.sin(last.r));
        expect(Math.cos(first.r)).toBeCloseTo(Math.cos(last.r));
      });
    }
});

describe("mask history", () => {
  const state = (n: number) =>
    ({
      data: new Uint8ClampedArray([n]),
      width: 1,
      height: 1,
      colorSpace: "srgb",
    }) as ImageData;
  it("undoes, redoes, and discards redo after a new edit", () => {
    const h = new MaskHistory();
    h.push(state(1));
    h.push(state(2));
    h.push(state(3));
    expect(h.undo()?.data[0]).toBe(2);
    expect(h.redo()?.data[0]).toBe(3);
    h.undo();
    h.push(state(4));
    expect(h.canRedo).toBe(false);
    expect(h.undo()?.data[0]).toBe(2);
    expect(h.undo()?.data[0]).toBe(1);
    expect(h.canUndo).toBe(false);
  });
  it("bounds memory and retains committed state for cancelled touch", () => {
    const h = new MaskHistory(3);
    [1, 2, 3, 4].forEach((n) => h.push(state(n)));
    expect(h.current().data[0]).toBe(4);
    expect(h.undo()?.data[0]).toBe(3);
    expect(h.undo()?.data[0]).toBe(2);
    expect(h.undo()).toBeUndefined();
  });
});

describe("real GIF encoding and decoding", () => {
  for (const duration of [1.5, 2])
    for (const transparent of [false, true]) {
      it(`encodes ${duration}s with transparent=${transparent}`, () => {
        const gif = createEncoder();
        const frames = duration * 12;
        const pixels = new Uint8Array(320 * 320 * 4);
        for (let i = 0; i < pixels.length; i += 4) {
          pixels[i] = 255;
          pixels[i + 3] = transparent && i % 8 === 0 ? 0 : 255;
        }
        for (let i = 0; i < frames; i++) addFrame(gif, pixels, i, transparent);
        gif.finish();
        const bytes = gif.bytes();
        expect(new TextDecoder().decode(bytes.subarray(0, 6))).toBe("GIF89a");
        const reader = new GifReader(bytes);
        expect(reader.width).toBe(320);
        expect(reader.height).toBe(320);
        expect(reader.numFrames()).toBe(frames);
        expect(reader.loopCount()).toBe(0);
        let delay = 0;
        for (let i = 0; i < frames; i++) delay += reader.frameInfo(i).delay;
        expect(delay).toBe(duration * 100);
        const output = new Uint8Array(320 * 320 * 4);
        reader.decodeAndBlitFrameRGBA(0, output);
        expect(output[3]).toBe(transparent ? 0 : 255);
        expect(output[7]).toBe(255);
        expect(output[4]).toBeGreaterThan(240);
      });
    }
});
