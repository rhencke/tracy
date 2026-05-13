import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import istanbulCoverageModule from "@vitest/coverage-istanbul";

const require = createRequire(import.meta.url);
const { checkCoverageRoot } = require("./coverage-core.js");

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COVERAGE_ROOT = path.join(ROOT_DIR, "dist/wasm-cov");
const JS_COVERAGE_ROOT = "dist/js-cov";

class IstanbulWatCoverageProvider {
  name = "istanbul + watwat";

  async initialize(ctx) {
    this.ctx = ctx;
    process.env.VITEST_WAT_COVERAGE = "1";
    this.istanbul = await istanbulCoverageModule.getProvider();

    const istanbulContext = Object.create(ctx);
    Object.defineProperty(istanbulContext, "_coverageOptions", {
      value: {
        ...ctx._coverageOptions,
        provider: "istanbul",
        reportsDirectory: JS_COVERAGE_ROOT,
      },
    });

    await this.istanbul.initialize(istanbulContext);
  }

  resolveOptions() {
    return {
      ...this.istanbul.resolveOptions(),
      enabled: true,
      provider: "custom",
      customProviderModule: path.join(ROOT_DIR, "tools/vitest-wat-coverage-provider.mjs"),
    };
  }

  async clean(clean) {
    await this.istanbul.clean(clean);
  }

  async onTestRunStart() {
    await this.istanbul.onTestRunStart?.();
  }

  async onTestFailure() {
    await this.istanbul.onTestFailure?.();
  }

  async onAfterSuiteRun(meta) {
    await this.istanbul.onAfterSuiteRun(meta);
  }

  onFileTransform(sourceCode, id, pluginCtx) {
    return this.istanbul.onFileTransform(sourceCode, id, pluginCtx);
  }

  requiresTransform(id) {
    return this.istanbul.requiresTransform(id);
  }

  async onEnabled() {
    await this.istanbul.onEnabled?.();
  }

  async generateCoverage(reportContext) {
    const [istanbul, watwat] = await Promise.all([
      this.istanbul.generateCoverage(reportContext),
      checkCoverageRoot(COVERAGE_ROOT),
    ]);

    return { istanbul, watwat };
  }

  async reportCoverage(result, reportContext) {
    await this.istanbul.reportCoverage(result.istanbul, reportContext);

    for (const line of result.watwat.lines) {
      console.error(line);
    }

    if (result.watwat.failed) {
      throw new Error(result.watwat.lines.join("\n"));
    }
  }

  async mergeReports(coverages) {
    await this.istanbul.mergeReports?.(coverages.map((coverage) => coverage.istanbul));
  }
}

function takeCoverage() {
  return istanbulCoverageModule.takeCoverage();
}

function startCoverage() {
  return istanbulCoverageModule.startCoverage();
}

export default {
  takeCoverage,
  startCoverage,
  getProvider() {
    return new IstanbulWatCoverageProvider();
  },
};
