import { test, expect } from "@playwright/test";
test("real cold AI inference on a non-isolated static page", async ({
  page,
}) => {
  test.skip(
    !process.env.TEST_REAL_AI,
    "Opt-in: downloads the real model and WASM assets",
  );
  test.setTimeout(210000);
  const failures: string[] = [];
  page.on("pageerror", (e) => failures.push(e.message));
  await page.goto("./");
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(false);
  await page.getByRole("button", { name: /选素材/ }).click();
  await page.getByRole("button", { name: /AI 自动抠图/ }).click();
  await expect(page.getByRole("status")).toContainText("自动抠图完成", {
    timeout: 185000,
  });
  await expect(page.getByRole("button", { name: /导出 GIF/ })).toBeEnabled();
  await page.getByRole("button", { name: /导出 GIF/ }).click();
  await expect(page.getByRole("link", { name: "下载 GIF" })).toBeVisible();
  expect(failures).toEqual([]);
});
