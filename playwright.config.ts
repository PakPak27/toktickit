import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  fullyParallel: false, // shares the same dev DB — avoid cross-test interference
  workers: 1, // fullyParallel:false only limits intra-file parallelism; this
  // also stops separate spec files from running in different workers
  // against the same shared database
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});