const fs = require("node:fs/promises");
const path = require("node:path");

const testNamePattern = /^test_/;
const ASSERT_FAILURE_PROBE_PREFIX = "probe_assert_";
const ASSERT_FAILURE_EXPECTED_MESSAGE = "assert test failed";
// WAT modules import env.memory with a 32768-page maximum unless a harness
// intentionally constrains a suite to exercise memory-limit behavior.
const DEFAULT_WAT_MEMORY_MAXIMUM_PAGES = 32768;

class WatwatFailure extends Error {
  constructor(code) {
    super(`watwat failure ${code}`);
    this.name = "WatwatFailure";
    this.code = code;
  }
}

function resultPair(result) {
  if (Array.isArray(result)) {
    return result;
  }

  return [result, 0];
}

function memoryFor(instance, fallback) {
  return instance.exports.memory instanceof WebAssembly.Memory
    ? instance.exports.memory
    : fallback;
}

function decodeUtf8(memory, ptr, len) {
  if (!Number.isInteger(ptr) || !Number.isInteger(len) || ptr < 0 || len < 0) {
    return "";
  }

  const end = ptr + len;
  if (end < ptr || end > memory.buffer.byteLength) {
    return "";
  }

  return new TextDecoder().decode(new Uint8Array(memory.buffer, ptr, len));
}

function messageFor(instance, memory, code) {
  if (typeof instance.exports.message_for !== "function") {
    return `error code ${code}`;
  }

  try {
    const [ptr, len] = resultPair(instance.exports.message_for(code));
    const message = decodeUtf8(memory, ptr, len);
    return message || `error code ${code}`;
  } catch (error) {
    return `error code ${code}`;
  }
}

function testExports(instance) {
  return Object.entries(instance.exports)
    .filter(([name, value]) => testNamePattern.test(name) && typeof value === "function")
    .map(([name, value]) => [name, value]);
}

async function functionExportNamesWithPrefix(file, prefix) {
  const bytes = await fs.readFile(file);
  const module = await WebAssembly.compile(bytes);

  return WebAssembly.Module.exports(module)
    .filter((entry) => entry.kind === "function" && entry.name.startsWith(prefix))
    .map((entry) => entry.name)
    .sort();
}

async function assertFailureProbeExportNames(file) {
  const probes = await functionExportNamesWithPrefix(file, ASSERT_FAILURE_PROBE_PREFIX);
  if (probes.length === 0) {
    throw new Error(`missing assertion failure probe exports in ${file}`);
  }

  return probes;
}

function coverageOutputPath(manifestPath) {
  return path.join(
    path.dirname(manifestPath),
    `${path.basename(manifestPath, ".cov.json")}.coverage.json`,
  );
}

function createCoverageContext(manifest) {
  const blockCount = Array.isArray(manifest.blocks) ? manifest.blocks.length : 0;
  const counters = new Uint8Array(blockCount);
  const moduleBase = path.basename(manifest.module ?? "", ".wat");

  return {
    counters,
    moduleBase,
    imports: {
      hit(id) {
        if (!Number.isInteger(id) || id < 0 || id >= counters.length) {
          return;
        }

        if (counters[id] < 255) {
          counters[id] += 1;
        }
      },
    },
  };
}

function coverageReport(manifest, coverage) {
  const hits = Array.from(coverage.counters);
  return {
    module: manifest.module,
    hits,
    uncovered_ids: hits
      .map((hit, id) => (hit === 0 ? id : -1))
      .filter((id) => id !== -1),
  };
}

async function writeCoverageReport(manifestPath, manifest, coverage) {
  await fs.writeFile(
    coverageOutputPath(manifestPath),
    `${JSON.stringify(coverageReport(manifest, coverage), null, 2)}\n`,
  );
}

async function instantiateAssert(assertPath, memory, watwat, coverage = null) {
  const bytes = await fs.readFile(assertPath);
  const imports = {
    env: { memory },
    watwat,
  };

  if (coverage !== null) {
    imports.cov = coverage.imports;
  }

  const { instance } = await WebAssembly.instantiate(bytes, imports);

  return instance.exports;
}

function dependencyImportsFor(imports) {
  if (imports.cov === undefined) {
    return imports;
  }

  return {
    ...imports,
    cov: {
      hit() {},
    },
  };
}

function importsForModule(imports, coverage, modulePath) {
  if (coverage === null || imports.cov === undefined) {
    return imports;
  }

  return path.basename(modulePath, ".wasm") === coverage.moduleBase
    ? imports
    : dependencyImportsFor(imports);
}

async function loadHarness(harnessPath) {
  if (harnessPath === null) {
    return {};
  }

  const loaded = require(path.resolve(harnessPath));
  return loaded.default ?? loaded;
}

async function instantiateHarnessDependencies(file, imports, coverage, harness) {
  if (typeof harness.dependencies !== "function") {
    return {};
  }

  return harness.dependencies({
    coverage,
    file,
    imports,
    async instantiateWasm(wasmPath, moduleImports) {
      const bytes = await fs.readFile(wasmPath);
      const { instance } = await WebAssembly.instantiate(
        bytes,
        importsForModule(moduleImports, coverage, wasmPath),
      );
      return instance;
    },
  });
}

async function harnessImports(file, memory, imports, coverage, harness) {
  if (typeof harness.imports !== "function") {
    return {};
  }

  return harness.imports({
    coverage,
    file,
    imports,
    memory,
  });
}

async function memoryMaximumPagesFor(file, harness) {
  if (typeof harness.memoryMaximumPagesFor === "function") {
    return harness.memoryMaximumPagesFor(file);
  }

  return DEFAULT_WAT_MEMORY_MAXIMUM_PAGES;
}

async function instantiateTestModule(file, assertPath, coverage = null, harness = {}) {
  const memory = new WebAssembly.Memory({
    initial: 1,
    maximum: await memoryMaximumPagesFor(file, harness),
  });
  const watwat = {
    fail(code) {
      throw new WatwatFailure(code);
    },
  };
  const assert = await instantiateAssert(assertPath, memory, watwat, coverage);
  Object.assign(watwat, assert);
  const imports = {
    env: { memory },
    watwat,
    assert,
  };
  if (coverage !== null) {
    imports.cov = coverage.imports;
  }
  Object.assign(imports, await harnessImports(file, memory, imports, coverage, harness));
  Object.assign(imports, await instantiateHarnessDependencies(file, imports, coverage, harness));

  const bytes = await fs.readFile(file);
  const { instance } = await WebAssembly.instantiate(bytes, imports);

  return {
    instance,
    memory: memoryFor(instance, memory),
  };
}

async function runTestFile(file, assertPath, coverage = null, harness = {}) {
  const { instance, memory } = await instantiateTestModule(file, assertPath, coverage, harness);
  const tests = testExports(instance);
  const results = [];

  for (const [name, test] of tests) {
    try {
      test();
      results.push({ ok: true, name });
    } catch (error) {
      const code = error instanceof WatwatFailure ? error.code : null;
      const message =
        code === null ? error.message || String(error) : messageFor(instance, memory, code);
      results.push({ ok: false, name, message });
    }
  }

  return results;
}

async function runExpectedFailure(exportName, expectedMessage, file, assertPath, coverage = null, harness = {}) {
  const { instance, memory } = await instantiateTestModule(file, assertPath, coverage, harness);
  const probe = instance.exports[exportName];

  if (typeof probe !== "function") {
    return {
      ok: false,
      name: exportName,
      message: `missing export ${exportName}`,
    };
  }

  try {
    probe();
    return {
      ok: false,
      name: exportName,
      message: "expected failure did not occur",
    };
  } catch (error) {
    if (!(error instanceof WatwatFailure)) {
      return {
        ok: false,
        name: exportName,
        message: error.message || String(error),
      };
    }

    const message = messageFor(instance, memory, error.code);
    return {
      ok: message === expectedMessage,
      name: exportName,
      message:
        message === expectedMessage
          ? ""
          : `expected ${expectedMessage}, got ${message}`,
    };
  }
}

module.exports = {
  ASSERT_FAILURE_EXPECTED_MESSAGE,
  ASSERT_FAILURE_PROBE_PREFIX,
  WatwatFailure,
  assertFailureProbeExportNames,
  createCoverageContext,
  functionExportNamesWithPrefix,
  instantiateTestModule,
  loadHarness,
  messageFor,
  runExpectedFailure,
  runTestFile,
  testExports,
  writeCoverageReport,
};
