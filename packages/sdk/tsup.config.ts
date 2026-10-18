import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  // Runs on Node >= 18, Bun, Deno, Workers and edge runtimes: no Node built-ins.
  platform: "neutral",
  external: ["@hera/core"],
});
