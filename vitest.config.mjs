import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tools/**/*.test.{js,mjs}"],
    coverage: {
      provider: "custom",
      customProviderModule: "./tools/vitest-wat-coverage-provider.mjs",
      reportsDirectory: "dist/wasm-cov",
      reporter: ["text"],
    },
  },
});
