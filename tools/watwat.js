#!/usr/bin/env node

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
  console.error("usage: watwat dist/wasm/foo.test.wasm [dist/wasm/bar.test.wasm ...]");
  console.error("usage: watwat --cov dist/wasm/foo.cov.json dist/wasm/foo.test.wasm");
  console.error("usage: watwat --expect-failure export_name expected_message dist/wasm/foo.test.wasm");
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

  return {
    counters,
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

function modulePathForTest(file) {
  if (!file.endsWith(".test.wasm")) {
    return null;
  }

  const parsed = path.parse(file);
  return path.join(parsed.dir, `${parsed.name.replace(/\.test$/, "")}.wasm`);
}

function moduleImportAliases(file) {
  const parsed = path.parse(file);
  const name = parsed.name;
  const parent = path.basename(parsed.dir);

  return [name, `${parent}/${name}`, `wat/${parent}/${name}`];
}

async function instantiateSiblingModule(file, imports) {
  const modulePath = modulePathForTest(file);

  if (modulePath === null) {
    return {};
  }

  try {
    await fs.access(modulePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }

    throw error;
  }

  const allocPath = path.join(path.dirname(modulePath), "alloc.wasm");
  const moduleImports = { ...imports };
  const aliases = {};

  if (path.basename(modulePath) !== "alloc.wasm") {
    try {
      await fs.access(allocPath);
      const allocBytes = await fs.readFile(allocPath);
      const { instance } = await WebAssembly.instantiate(allocBytes, moduleImports);
      moduleImports.alloc = instance.exports;
      aliases.alloc = instance.exports;
      aliases["std/alloc"] = instance.exports;
      aliases["wat/std/alloc"] = instance.exports;
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  const hashPath = path.join(path.dirname(modulePath), "hash.wasm");

  if (path.basename(modulePath) === "strtab.wasm") {
    try {
      await fs.access(hashPath);
      const hashBytes = await fs.readFile(hashPath);
      const { instance } = await WebAssembly.instantiate(hashBytes, moduleImports);
      moduleImports.hash = instance.exports;
      aliases.hash = instance.exports;
      aliases["std/hash"] = instance.exports;
      aliases["wat/std/hash"] = instance.exports;
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  const bytes = await fs.readFile(modulePath);
  const { instance } = await WebAssembly.instantiate(bytes, moduleImports);

  for (const name of moduleImportAliases(modulePath)) {
    aliases[name] = instance.exports;
  }

  return aliases;
}

async function instantiateTestModule(file, assertPath, coverage = null) {
  const memory = new WebAssembly.Memory({ initial: 1, maximum: 32768 });
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
  Object.assign(imports, await instantiateSiblingModule(file, imports));

  const bytes = await fs.readFile(file);
  const { instance } = await WebAssembly.instantiate(bytes, imports);

  return {
    instance,
    memory: memoryFor(instance, memory),
  };
}

async function runTestFile(file, assertPath, coverage = null) {
  const { instance, memory } = await instantiateTestModule(file, assertPath, coverage);
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

async function runExpectedFailure(exportName, expectedMessage, file, assertPath) {
  const { instance, memory } = await instantiateTestModule(file, assertPath);
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

async function main() {
  let files = process.argv.slice(2);

  if (files.length === 0) {
    usage();
    process.exitCode = 64;
    return;
  }

  const assertPath = path.resolve(__dirname, "../dist/wasm/std/assert.wasm");

  if (files[0] === "--expect-failure") {
    if (files.length !== 4) {
      usage();
      process.exitCode = 64;
      return;
    }

    const [, exportName, expectedMessage, file] = files;
    const result = await runExpectedFailure(exportName, expectedMessage, file, assertPath);
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
  }

  const results = [];
  let harnessFailed = false;

  for (const file of files) {
    try {
      await fs.access(file);
      results.push(...(await runTestFile(file, assertPath, coverage)));
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

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
