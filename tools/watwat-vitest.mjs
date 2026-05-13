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
  runExpectedFailure,
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

function watwatExpectedFailureError({ file, result, rootDir }) {
  const moduleName = relativeModuleName(file, rootDir);
  return new Error(`${moduleName} ${result.name}: ${result.message}`);
}

async function watwatOptions(options) {
  return {
    rootDir: options.rootDir ?? ROOT_DIR,
    assertPath: options.assertPath ?? DEFAULT_ASSERT_PATH,
    harness: options.harness ?? (await loadHarness(options.harnessPath ?? null)),
  };
}

export async function registerWatwatTests(files, options = {}) {
  const { rootDir, assertPath, harness } = await watwatOptions(options);
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

    if (tests.length === 0) {
      continue;
    }

    suites.push({ name: moduleName, tests });
  }

  if (suites.length === 0) {
    return suites;
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

export async function registerWatwatExpectedFailureTests(probes, options = {}) {
  const { rootDir, assertPath, harness } = await watwatOptions(options);
  const suiteName = options.suiteName ?? "watwat expected failures";
  const cases = probes.map((probe) => {
    const wasmPath = path.resolve(rootDir, probe.file);
    return {
      ...probe,
      file: wasmPath,
      moduleName: relativeModuleName(wasmPath, rootDir),
      name: probe.name ?? probe.exportName,
    };
  });

  if (cases.length === 0) {
    return cases;
  }

  describe(suiteName, () => {
    for (const testCase of cases) {
      test(`${testCase.moduleName} ${testCase.name}`, async () => {
        const result = await runExpectedFailure(
          testCase.exportName,
          testCase.expectedMessage,
          testCase.file,
          assertPath,
          null,
          harness,
        );

        if (!result.ok) {
          throw watwatExpectedFailureError({
            file: testCase.file,
            result,
            rootDir,
          });
        }
      });
    }
  });

  return cases;
}
