import { test, expect } from "@playwright/test";
import { GifReader } from "omggif";

test("cancelling AI and GIF releases editing and allows a new export", async ({
  page,
  context,
}) => {
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route("https://staticimgly.com/**", async (route) => {
    await blocked;
    await route.abort().catch(() => {});
  });
  await page.goto("./");
  await page.getByRole("button", { name: /选素材/ }).click();
  const supportsAi = await page.evaluate(() =>
    Boolean(
      window.WebAssembly &&
      window.Worker &&
      window.OffscreenCanvas &&
      window.createImageBitmap,
    ),
  );
  await page.getByRole("button", { name: /AI 自动抠图/ }).click();
  if (supportsAi) {
    await page.getByRole("button", { name: "取消抠图", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("自动抠图已取消");
  } else {
    await expect(page.getByRole("status")).toContainText("不支持本地 AI");
  }
  release();
  await page.getByRole("button", { name: /导出 GIF/ }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("导出已取消");
  await page.getByRole("button", { name: /导出封面/ }).click();
  await expect(page.getByRole("link", { name: "下载 PNG" })).toBeVisible();
});

test("four templates export real worker GIFs with no AI requests on load", async ({
  page,
}) => {
  const errors: string[] = [],
    modelRequests: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/staticimgly|ai\.worker|ort[.-]/.test(r.url()))
      modelRequests.push(r.url());
  });
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "鬼畜制造所" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const name of ["疯狂摇头", "精神蹦迪", "旋转升天", "抽搐抖动"]) {
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page.getByRole("button", { name: /导出 GIF/ }).click();
    const link = page.getByRole("link", { name: "下载 GIF" });
    await expect(link).toBeVisible();
    const bytes = await link.evaluate(async (a: HTMLAnchorElement) =>
      Array.from(new Uint8Array(await (await fetch(a.href)).arrayBuffer())),
    );
    const reader = new GifReader(new Uint8Array(bytes));
    expect(reader.width).toBe(320);
    expect(reader.height).toBe(320);
    expect(reader.numFrames()).toBe(24);
    expect(reader.loopCount()).toBe(0);
    const download = page.waitForEvent("download");
    await link.click();
    expect((await download).suggestedFilename()).toMatch(/\.gif$/);
    await page.getByRole("button", { name: "关闭导出结果" }).click();
  }
  expect(modelRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("transparent PNG import, erase, undo, redo, restore, lasso and PNG cover", async ({
  page,
}) => {
  await page.goto("./");
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "#f05f43";
    g.fillRect(12, 12, 104, 104);
    return c.toDataURL("image/png");
  });
  await page.locator("input[type=file]").setInputFiles({
    name: "transparent-test.png",
    mimeType: "image/png",
    buffer: Buffer.from(dataUrl.split(",")[1], "base64"),
  });
  await expect(
    page
      .locator(".asset-list")
      .getByText("transparent-test.png", { exact: false }),
  ).toBeVisible();
  await page
    .locator(".tools")
    .getByRole("button", { name: "橡皮擦", exact: true })
    .click();
  const preview = page.locator("canvas");
  const centerClick = async () => {
    await preview.scrollIntoViewIfNeeded();
    const b = (await preview.boundingBox())!;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  };
  const pixel = () =>
    preview.evaluate(
      (el: HTMLCanvasElement) =>
        el.getContext("2d")!.getImageData(320, 320, 1, 1).data[3],
    );
  const before = await pixel();
  await centerClick();
  await expect.poll(pixel).toBeLessThan(before);
  const erased = await pixel();
  await page.getByRole("button", { name: "↶ 撤销", exact: true }).click();
  await expect.poll(pixel).toBe(before);
  await page.getByRole("button", { name: "↷ 重做", exact: true }).click();
  await expect.poll(pixel).toBe(erased);
  await page.locator(".tools").getByRole("button", { name: /恢复/ }).click();
  await centerClick();
  await expect.poll(pixel).toBe(before);
  await page
    .locator(".tools")
    .getByRole("button", { name: "套索保留", exact: true })
    .click();
  await preview.scrollIntoViewIfNeeded();
  const bounds = (await preview.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width * 0.3,
    bounds.y + bounds.height * 0.3,
  );
  await page.mouse.down();
  for (const [x, y] of [
    [0.7, 0.3],
    [0.7, 0.7],
    [0.3, 0.7],
    [0.3, 0.3],
  ])
    await page.mouse.move(
      bounds.x + bounds.width * x,
      bounds.y + bounds.height * y,
      { steps: 5 },
    );
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "↶ 撤销", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "构图与文字", exact: true }).click();
  await page
    .getByRole("button", { name: "背景 transparent", exact: true })
    .click();
  await page.getByLabel("表情文案", { exact: false }).fill("");
  await page.getByRole("button", { name: /导出封面/ }).click();
  const img = page.getByRole("img", { name: /生成的 PNG/ });
  await expect(img).toBeVisible();
  await expect(img).toHaveJSProperty("complete", true);
  await expect(img).toHaveJSProperty("naturalWidth", 320);
  const info = await img.evaluate((el: HTMLImageElement) => {
    const c = document.createElement("canvas");
    c.width = c.height = 320;
    const g = c.getContext("2d")!;
    g.drawImage(el, 0, 0);
    return {
      width: el.naturalWidth,
      height: el.naturalHeight,
      alpha: g.getImageData(0, 0, 1, 1).data[3],
      centerAlpha: g.getImageData(160, 158, 1, 1).data[3],
    };
  });
  expect(info).toEqual({ width: 320, height: 320, alpha: 0, centerAlpha: 255 });
});

test("AI network failure releases controls and preserves local export", async ({
  page,
  context,
}) => {
  await context.route("https://staticimgly.com/**", (route) => route.abort());
  await page.goto("./");
  await page.getByRole("button", { name: /选素材/ }).click();
  await page.getByRole("button", { name: /AI 自动抠图/ }).click();
  await expect(page.getByRole("status")).toContainText(
    /本地 AI 未能完成|不支持本地 AI/,
    { timeout: 20000 },
  );
  await expect(page.getByRole("button", { name: /导出 GIF/ })).toBeEnabled();
  await page.getByRole("button", { name: /导出 GIF/ }).click();
  await expect(page.getByRole("link", { name: "下载 GIF" })).toBeVisible();
});

test("1.5 second transparent GIF and touch drag stay within page", async ({
  page,
  context,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "1.5 秒", exact: true }).click();
  await page.getByRole("button", { name: "构图与文字", exact: true }).click();
  await page
    .getByRole("button", { name: "背景 transparent", exact: true })
    .click();
  const c = page.locator("canvas");
  await c.scrollIntoViewIfNeeded();
  const box = (await c.boundingBox())!;
  const session = await context.newCDPSession(page);
  const touch = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [touch],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...touch, x: touch.x + 30, y: touch.y + 20 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.getByLabel("水平位置")).not.toHaveValue("0");
  await page.getByRole("button", { name: /导出 GIF/ }).click();
  const a = page.getByRole("link", { name: "下载 GIF" });
  await expect(a).toBeVisible();
  const bytes = await a.evaluate(async (el: HTMLAnchorElement) =>
    Array.from(new Uint8Array(await (await fetch(el.href)).arrayBuffer())),
  );
  const r = new GifReader(new Uint8Array(bytes));
  expect(r.numFrames()).toBe(18);
  expect(
    Array.from({ length: 18 }, (_, i) => r.frameInfo(i).delay).reduce(
      (a, b) => a + b,
      0,
    ),
  ).toBe(150);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
