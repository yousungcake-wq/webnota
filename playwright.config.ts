import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      testMatch: /desktop\..*spec\.ts/,
    },
    { name: 'android', use: { ...devices['Pixel 7'] }, testMatch: /mobile\..*spec\.ts/ },
    // iPhone viewport/UA on Chromium: CDP is needed for the IME composition test. WebKit runs are added in M7.
    { name: 'iphone', use: { ...devices['iPhone 14'], browserName: 'chromium' }, testMatch: /mobile\..*spec\.ts/ },
  ],
  webServer: {
    // CI builds a separate root-based bundle (E2E_DIST) because the Pages build uses a /webnota/ base path.
    command: `npx vite preview --port ${PORT} --strictPort${process.env.E2E_DIST ? ` --outDir ${process.env.E2E_DIST}` : ''}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
})
