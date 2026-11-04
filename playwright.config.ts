import { defineConfig, devices } from '@playwright/test';

/** Emulazione dispositivi: iPhone piccoli e grandi, Android, tablet, desktop. */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60000,
  fullyParallel: true,
  workers: 3,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4199/' },
  webServer: {
    command: 'npx vite preview --port 4199 --strictPort',
    url: 'http://localhost:4199/',
    reuseExistingServer: true,
    timeout: 60000,
  },
  projects: [
    { name: 'iphone-se', use: { ...devices['iPhone SE'] } },
    { name: 'iphone-15-pro-max', use: { ...devices['iPhone 15 Pro Max'] } },
    { name: 'iphone-15-landscape', use: { ...devices['iPhone 15 landscape'] } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
    { name: 'galaxy-s9', use: { ...devices['Galaxy S9+'] } },
    { name: 'ipad', use: { ...devices['iPad (gen 7)'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
});
