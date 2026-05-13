import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { checkCoverageRoot } = require("./coverage-core.js");

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COVERAGE_ROOT = path.join(ROOT_DIR, "dist/wasm-cov");

class WatCoverageProvider {
  name = "watwat";

  initialize(ctx) {
    this.ctx = ctx;
    process.env.VITEST_WAT_COVERAGE = "1";
  }

  resolveOptions() {
    return {
      ...this.ctx.config.coverage,
      enabled: true,
      provider: "custom",
      customProviderModule: path.join(ROOT_DIR, "tools/vitest-wat-coverage-provider.mjs"),
      reportsDirectory: COVERAGE_ROOT,
      reporter: [["text", {}]],
    };
  }

  async clean() {}

  async onAfterSuiteRun() {}

  async generateCoverage() {
    return checkCoverageRoot(COVERAGE_ROOT);
  }

  async reportCoverage(result) {
    for (const line of result.lines) {
      console.error(line);
    }

    if (result.failed) {
      throw new Error(result.lines.join("\n"));
    }
  }
}

export default {
  getProvider() {
    return new WatCoverageProvider();
  },
};
