import { defineConfig, devices } from "@playwright/test";
const localUrl = `http://127.0.0.1:4173${process.env.VITE_BASE_PATH || "/crazyGIF/"}`;
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.TEST_BASE_URL || localUrl,
    channel: process.env.CI ? undefined : "chrome",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    {
      name: "narrow",
      use: {
        viewport: { width: 320, height: 740 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : {
        command: `npm run preview -- --port 4173 --base ${process.env.VITE_BASE_PATH || "/crazyGIF/"}`,
        url: localUrl,
        reuseExistingServer: !process.env.CI,
      },
});
