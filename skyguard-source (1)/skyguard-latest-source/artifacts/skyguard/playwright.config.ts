import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Optional URL targets an already-running preview. Otherwise use an isolated
// frontend: no API server, credentials, database or live providers are needed.
const externalUrl = process.env.SKYGUARD_E2E_BASE_URL;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || (existsSync('/repl/tools/bin/chromium') ? '/repl/tools/bin/chromium' : undefined);

export default defineConfig({
  testDir: './e2e',
  outputDir: '../../generated-artifacts/skyguard-e2e/results',
  fullyParallel: true,
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: '../../generated-artifacts/skyguard-e2e/report', open: 'never' }],
  ],
  use: {
    baseURL: externalUrl || 'http://127.0.0.1:5199',
    timezoneId: 'UTC',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 }, launchOptions: { executablePath } },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions: { executablePath } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 1000 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 1000 } } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
  webServer: externalUrl ? undefined : {
    command: 'PORT=5199 BASE_PATH=/ pnpm run dev',
    url: 'http://127.0.0.1:5199',
    reuseExistingServer: false,
  },
});
