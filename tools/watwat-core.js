const fs = require("node:fs/promises");
const path = require("node:path");

const testNamePattern = /^test_/;

class WatwatFailure extends Error {
  constructor(code) {
    super(`watwat failure ${code}`);
    this.name = "WatwatFailure";
    this.code = code;
  }
}

function usage() {
  console.error("usage: watwat [--harness tools/harness.js] dist/wasm/foo.test.wasm [dist/wasm/bar.test.wasm ...]");
  console.error("usage: watwat [--harness tools/harness.js] --cov dist/wasm/foo.cov.json dist/wasm/foo.test.wasm");
  console.error("usage: watwat [--harness tools/harness.js] --expect-failure export_name expected_message dist/wasm/foo.test.wasm");
}

function hasGlobMeta(value) {
  return /[*?\[]/.test(value);
}

function tapEscape(value) {
  return String(value).replace(/[\\\n\r]/g, (match) => {
    if (match === "\\") {
      return "\\\\";
    }
    if (match === "\n") {
      return "\\n";
    }
    return "\\r";
  });
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

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
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

function parseOptions(args) {
  let harnessPath = null;
  const files = [...args];

  if (files[0] === "--harness") {
    if (files.length < 2) {
      return { error: true };
    }

    harnessPath = files[1];
    files.splice(0, 2);
  }

  return { files, harnessPath };
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

  return 32768;
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

function emitTap(results) {
  console.log("TAP version 13");
  console.log(`1..${results.length}`);

  results.forEach((result, index) => {
    const number = index + 1;
    const name = tapEscape(result.name);

    if (result.ok) {
      console.log(`ok ${number} - ${name}`);
      return;
    }

    console.log(`not ok ${number} - ${name} # ${tapEscape(result.message)}`);
  });
}

async function runCli(args = process.argv.slice(2)) {
  const options = parseOptions(args);

  if (options.error || options.files.length === 0) {
    usage();
    process.exitCode = 64;
    return;
  }

  let files = options.files;
  const harness = await loadHarness(options.harnessPath);
  const assertPath = path.resolve(__dirname, "../dist/wasm/std/assert.wasm");

  if (files[0] === "--expect-failure") {
    if (files.length !== 4) {
      usage();
      process.exitCode = 64;
      return;
    }

    const [, exportName, expectedMessage, file] = files;
    const result = await runExpectedFailure(exportName, expectedMessage, file, assertPath, null, harness);
    emitTap([result]);
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  let coverage = null;
  let coverageManifest = null;
  let coverageManifestPath = null;

  if (files[0] === "--cov") {
    if (files.length < 3) {
      usage();
      process.exitCode = 64;
      return;
    }

    coverageManifestPath = files[1];
    coverageManifest = await readJson(coverageManifestPath);
    coverage = createCoverageContext(coverageManifest);
    files = files.slice(2);

    if (files[0] === "--expect-failure") {
      if (files.length !== 4) {
        usage();
        process.exitCode = 64;
        return;
      }

      const [, exportName, expectedMessage, file] = files;
      const result = await runExpectedFailure(exportName, expectedMessage, file, assertPath, coverage, harness);
      emitTap([result]);
      if (!result.ok) {
        process.exitCode = 1;
        return;
      }

      await writeCoverageReport(coverageManifestPath, coverageManifest, coverage);
      return;
    }
  }

  const results = [];
  let harnessFailed = false;

  for (const file of files) {
    try {
      await fs.access(file);
      results.push(...(await runTestFile(file, assertPath, coverage, harness)));
    } catch (error) {
      if (error.code === "ENOENT" && hasGlobMeta(file)) {
        continue;
      }

      harnessFailed = true;
      results.push({
        ok: false,
        name: file,
        message: error.message || String(error),
      });
    }
  }

  emitTap(results);

  if (harnessFailed || results.some((result) => !result.ok)) {
    process.exitCode = 1;
    return;
  }

  if (coverage !== null) {
    await writeCoverageReport(coverageManifestPath, coverageManifest, coverage);
  }
}

module.exports = {
  WatwatFailure,
  coverageOutputPath,
  coverageReport,
  createCoverageContext,
  emitTap,
  instantiateTestModule,
  loadHarness,
  messageFor,
  parseOptions,
  runCli,
  runExpectedFailure,
  runTestFile,
  testExports,
  writeCoverageReport,
};
