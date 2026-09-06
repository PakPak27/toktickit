import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // API tests hit the real dev database (not mocked), so running test
    // files in parallel causes race conditions (e.g. duplicate ticketNumber
    // generation across files). Run files sequentially instead.
    fileParallelism: false,
  },
});