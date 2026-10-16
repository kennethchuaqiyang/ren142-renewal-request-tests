import { defineConfig } from '@playwright/test';

// REN-142 renewal-request access-control contract — API automation only, no browser.
// Target is the ren142-mock-api Go server (see C:\mockRun). Start it first:
//   cd C:\mockRun && go run main.go
export default defineConfig({
  testDir: './tests',
  // Several specs (persistence-on-reject, concurrency) depend on / manipulate shared
  // server-side state via the /debug endpoints — keep runs serial and single-worker
  // so one spec's state assumptions aren't disturbed by another running in parallel.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:8080',
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  },
});
