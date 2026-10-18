import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Files run one at a time so perf.test.ts measures the engine, not CPU
    // contention from parallel property tests. The whole suite takes seconds.
    fileParallelism: false,
  },
});
