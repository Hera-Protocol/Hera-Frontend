import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// Nest relies on decorator metadata, which esbuild does not emit; SWC does.
// The PDF templates are TSX on React's automatic runtime, matching tsconfig's "jsx": "react-jsx".
export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" }, jsc: { transform: { react: { runtime: "automatic" } } } })],
  test: {
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: "forks",
  },
});
