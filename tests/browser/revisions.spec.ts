import { test, expect, type Page } from "@playwright/test";
import { GifReader } from "omggif";

async function imageFile(page: Page, color: string, name: string) {
  const url = await page.evaluate((color) => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = color;
    g.fillRect(12, 12, 104, 104);
    return c.toDataURL("image/png");
  }, color);
  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.from(url.split(",")[1], "base64"),
  };
}
async function pngPixels(page: Page, points: number[][]) {
  await page.getByRole("button", { name: /导出封面/ }).click();
  const img = page.getByRole("img", { name: /生成的 PNG/ });
  await expect(img).toBeVisible();
  return img.evaluate(async (el: HTMLImageElement, points) => {
    await el.decode();
    const c = document.createElement("canvas");
    c.width = c.height = 320;
    const g = c.getContext("2d")!;
    g.drawImage(el, 0, 0);
    return points.map(([x, y]) => Array.from(g.getImageData(x, y, 1, 1).data));
  }, points);
}

test("multiple uploads, independent copies and deletion export the actual layers", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .locator("input[type=file]")
    .setInputFiles([
      await imageFile(page, "#ff0000", "red.png"),
      await imageFile(page, "#0000ff", "blue.png"),
    ]);
  await expect(page.locator(".asset-item")).toHaveCount(2);
  await expect(page.locator(".layer-item")).toHaveCount(2);
  await page.getByRole("button", { name: "构图与文字", exact: true }).click();
  await expect(page.getByLabel("表情文案", { exact: false })).toHaveValue(
    "我也可以动哦",
  );
  await page.getByLabel("表情文案", { exact: false }).fill("");
  const colors = await pngPixels(page, [
    [90, 158],
    [230, 158],
  ]);
  expect(colors[0]).toEqual([255, 0, 0, 255]);
  expect(colors[1]).toEqual([0, 0, 255, 255]);
  await page.getByRole("button", { name: "关闭导出结果" }).click();
  await page.getByRole("button", { name: "复制图层", exact: true }).click();
  await expect(page.locator(".layer-item")).toHaveCount(3);
  await page.getByLabel("水平位置").fill("0");
  await page.getByLabel("垂直位置").fill("-65");
  await page
    .getByRole("button", { name: "选择图层 2 blue.png", exact: true })
    .click();
  await expect(page.getByLabel("水平位置")).toHaveValue("70");
  await expect(page.getByLabel("垂直位置")).toHaveValue("0");
  await page
    .getByRole("button", { name: "选择图层 3 blue.png", exact: true })
    .click();
  await expect(page.getByLabel("水平位置")).toHaveValue("0");
  await expect(page.getByLabel("垂直位置")).toHaveValue("-65");
  const copies = await pngPixels(page, [
    [230, 158],
    [160, 93],
  ]);
  expect(copies).toEqual([
    [0, 0, 255, 255],
    [0, 0, 255, 255],
  ]);
  await page.getByRole("button", { name: "关闭导出结果" }).click();
  await page.getByRole("button", { name: "选素材", exact: true }).click();
  await page
    .getByRole("button", { name: "删除素材及其图层 blue.png", exact: true })
    .click();
  await expect(page.locator(".asset-item")).toHaveCount(1);
  await expect(page.locator(".layer-item")).toHaveCount(1);
  await expect(page.locator(".asset-list").getByText("red.png")).toBeVisible();
});

test("cutout backdrops and dashed brush stay out of the exported PNG", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "构图与文字", exact: true }).click();
  await page
    .getByRole("button", { name: "背景 transparent", exact: true })
    .click();
  await page.getByRole("button", { name: "选素材", exact: true }).click();
  await page
    .locator(".tools")
    .getByRole("button", { name: "橡皮擦", exact: true })
    .click();
  const group = page.getByRole("group", { name: "抠图辅助背景" });
  const range = page.getByLabel("画笔大小", { exact: false });
  await range.fill("80");
  await expect(
    page.getByTestId("brush-outline").locator(".brush-ring"),
  ).toHaveAttribute("r", "40");
  const dash = await page
    .locator(".brush-ring")
    .evaluate((el) => getComputedStyle(el).strokeDasharray);
  expect(dash).not.toBe("none");
  for (const [label, color] of [
    ["黑色", "rgb(0, 0, 0)"],
    ["白色", "rgb(255, 255, 255)"],
  ]) {
    await group.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator(".stage")).toHaveCSS("background-color", color);
    const pixels = await pngPixels(page, [
      [0, 0],
      [160, 158],
    ]);
    expect(pixels[0][3]).toBe(0);
    expect(pixels[1][3]).toBe(255);
    await page.getByRole("button", { name: "关闭导出结果" }).click();
  }
  await group.getByRole("button", { name: "透明", exact: true }).click();
  await expect(page.locator(".stage")).toHaveClass(/checker/);
});

test("caption motion changes real GIF pixels and can be disabled", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "移除图层", exact: true }).click();
  await expect(page.locator(".layer-item")).toHaveCount(0);
  const decode = async () => {
    await page.getByRole("button", { name: /导出 GIF/ }).click();
    const a = page.getByRole("link", { name: "下载 GIF" });
    await expect(a).toBeVisible();
    const data = await a.evaluate(async (el: HTMLAnchorElement) =>
      Array.from(new Uint8Array(await (await fetch(el.href)).arrayBuffer())),
    );
    const reader = new GifReader(new Uint8Array(data));
    const a0 = new Uint8Array(320 * 320 * 4),
      a3 = new Uint8Array(a0.length);
    reader.decodeAndBlitFrameRGBA(0, a0);
    reader.decodeAndBlitFrameRGBA(3, a3);
    return a0.reduce((n, v, i) => n + (v !== a3[i] ? 1 : 0), 0);
  };
  await page.getByLabel("文字动效", { exact: true }).selectOption("bounce");
  expect(await decode()).toBeGreaterThan(100);
  await page.getByRole("button", { name: "关闭导出结果" }).click();
  await page.getByLabel("文字动效", { exact: true }).selectOption("none");
  expect(await decode()).toBe(0);
});

test("source and layer limits preserve imported work", async ({ page }) => {
  await page.goto("./");
  const file = await imageFile(page, "#ff0000", "source.png");
  await page
    .locator("input[type=file]")
    .setInputFiles(
      Array.from({ length: 6 }, (_, i) => ({
        ...file,
        name: `source-${i}.png`,
      })),
    );
  await expect(page.locator(".asset-item")).toHaveCount(6);
  await page.locator("input[type=file]").setInputFiles(file);
  await expect(page.getByRole("status")).toContainText("最多 6 个素材");
  await expect(page.locator(".asset-item")).toHaveCount(6);
  for (let i = 0; i < 6; i++)
    await page.getByRole("button", { name: "复制图层", exact: true }).click();
  await expect(page.locator(".layer-item")).toHaveCount(12);
  await expect(
    page.getByRole("button", { name: "复制图层", exact: true }),
  ).toBeDisabled();
});
