import { defineConfig, devices } from "@playwright/test";
import config from "./playwright.config";

const { channel: _chromeChannel, ...engineUse } = config.use || {};

// Supplemental WebKit engine coverage. This is not a real iPhone/Safari test.
export default defineConfig({
  ...config,
  use: engineUse,
  grepInvert: /touch drag/,
  projects: [
    {
      name: "webkit-iphone-viewport",
      use: { ...devices["iPhone 13"], channel: undefined },
    },
  ],
});
