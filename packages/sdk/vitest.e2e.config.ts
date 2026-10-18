import { defineConfig } from "vitest/config";

/** Opt-in: builds and boots the real API on :4123 with a throwaway PGlite database. */
export default defineConfig({
  test: {
    include: ["e2e/**/*.e2e.test.ts"],
    environment: "node",
    globalSetup: ["e2e/global-setup.ts"],
    testTimeout: 90_000,
    hookTimeout: 240_000,
    fileParallelism: false,
  },
});
