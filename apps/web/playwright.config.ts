import { defineConfig, devices } from "@playwright/test";

const useExternalApp = Boolean(process.env.APP_URL);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.APP_URL ?? "http://localhost:3000",
    trace: "on-first-retry"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ],
  webServer: useExternalApp ? undefined : [
    {
      command: "pnpm --filter @eventflow/api dev",
      url: "http://localhost:3001/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120000
    },
    {
      command: "pnpm --filter @eventflow/web dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120000
    }
  ]
});
