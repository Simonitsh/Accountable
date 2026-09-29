import { fileURLToPath, URL } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
    ],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    // Pin the pool and its worker bounds explicitly. The build environment
    // exports VITEST_MAX_FORKS / VITEST_MAX_THREADS without matching MIN
    // values, which makes tinypool throw
    // "options.minThreads and options.maxThreads must not conflict" at
    // startup. Explicit bounds keep the run deterministic.
    pool: "forks",
    poolOptions: {
      forks: {
        minForks: 1,
        maxForks: 2,
      },
    },
  },
});
