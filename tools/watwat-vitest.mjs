import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, test } from "vitest";

const require = createRequire(import.meta.url);
const {
  WatwatFailure,
  instantiateTestModule,
  loadHarness,
  messageFor,
  testExports,
} = require("./watwat-core.js");

const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(TOOLS_DIR, "..");
const DEFAULT_ASSERT_PATH = path.join(ROOT_DIR, "dist/wasm/std/assert.wasm");

function relativeModuleName(file, rootDir) {
  return path.relative(rootDir, file).replaceAll(path.sep, "/");
}

function watwatAssertionError({ code, file, message, rootDir, testName }) {
  const moduleName = relativeModuleName(file, rootDir);
  return new Error(`${moduleName} ${testName} assertion ${code}: ${message}`);
}

function watwatTrapError({ error, file, rootDir, testName }) {
  const moduleName = relativeModuleName(file, rootDir);
  const message = error?.message || String(error);
  return new Error(`${moduleName} ${testName}: ${message}`);
}

export async function registerWatwatTests(files, options = {}) {
  const rootDir = options.rootDir ?? ROOT_DIR;
  const assertPath = options.assertPath ?? DEFAULT_ASSERT_PATH;
  const harness =
    options.harness ?? (await loadHarness(options.harnessPath ?? null));
  const suiteName = options.suiteName ?? "watwat WAT modules";
  const suites = [];

  for (const file of files) {
    const wasmPath = path.resolve(rootDir, file);
    const moduleName = relativeModuleName(wasmPath, rootDir);
    let loaded;

    try {
      loaded = await instantiateTestModule(wasmPath, assertPath, null, harness);
    } catch (error) {
      suites.push({
        name: moduleName,
        tests: [
          {
            name: "instantiate",
            run() {
              throw watwatTrapError({
                error,
                file: wasmPath,
                rootDir,
                testName: "instantiate",
              });
            },
          },
        ],
      });
      continue;
    }

    const { instance, memory } = loaded;
    const tests = testExports(instance).map(([testName, run]) => ({
      name: testName,
      run() {
        try {
          run();
        } catch (error) {
          if (error instanceof WatwatFailure) {
            throw watwatAssertionError({
              code: error.code,
              file: wasmPath,
              message: messageFor(instance, memory, error.code),
              rootDir,
              testName,
            });
          }

          throw watwatTrapError({ error, file: wasmPath, rootDir, testName });
        }
      },
    }));

    suites.push({ name: moduleName, tests });
  }

  describe(suiteName, () => {
    for (const suite of suites) {
      describe(suite.name, () => {
        for (const testCase of suite.tests) {
          test(testCase.name, testCase.run);
        }
      });
    }
  });

  return suites;
}
