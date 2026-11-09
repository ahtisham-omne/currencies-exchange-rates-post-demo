import { defineConfig, devices } from '@playwright/test'

/* Browser tests, kept apart from the vitest suite - vitest collects only the
   test files under src, and never looks in here, so the two run independently.

   `webServer` reuses a dev server if one is already up on :8080 and starts one
   otherwise, so `npx playwright test` works from a cold checkout. */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8080',
  },
  projects: [{
    name: 'chromium',
    /* The viewport goes after the device preset, which carries one of its own.
       A column can only be dragged to a place the mouse can reach, and at the
       preset's 1280 the right-hand columns are off the edge of the window. */
    use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 1000 } },
  }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
