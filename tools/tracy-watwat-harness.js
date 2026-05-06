const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const wasmModulesUrl = pathToFileURL(path.resolve(__dirname, "../host/wasm-modules.mjs")).href;
const wasmModules = import(wasmModulesUrl);

const parserFixtureEncoder = new TextEncoder();
const encodeParserFixture = (source) => parserFixtureEncoder.encode(source);
const parserTraceFixture = encodeParserFixture(
  '{"traceEvents":[{"name":"lo\\u0061d","cat":"io","ph":"X","ts":123,"dur":2,"pid":3,"tid":4},{"name":"paint","args":{"layer":"ro\\\"ot"},"ts":5}]}',
);
const parserFixtures = new Map([
  [99, parserTraceFixture],
  [100, encodeParserFixture('{"traceEvents":[}')],
  [101, encodeParserFixture('{"traceEvents":[{"name":"\\q"}]}')],
  [102, encodeParserFixture('{"traceEvents":[{"name":"open}')],
  [103, encodeParserFixture('"root"')],
  [104, encodeParserFixture("[".repeat(65))],
  [105, encodeParserFixture('{"traceEvents":[{"name":"\\u00X0"}]}')],
  [106, encodeParserFixture('{"traceEvents":[{"name":"bad\n"}]}')],
  [107, encodeParserFixture(' \n { } \t')],
  [108, encodeParserFixture('{"a"}')],
  [109, encodeParserFixture('{:"x"}')],
  [110, encodeParserFixture('{"traceEvents":[{"name":true,"ts":123}]}')],
]);

function writeFixture(memory, bytes, offset, len, dest) {
  const start = Number(offset);
  const count = Math.max(0, Math.min(len, bytes.length - start));

  if (count <= 0) {
    return 0;
  }

  new Uint8Array(memory.buffer, dest, count).set(bytes.subarray(start, start + count));
  return count;
}

function memoryMaximumPagesFor(file) {
  const constrainedSuites = new Set(["array.test.wasm", "hash.test.wasm", "pool.test.wasm"]);

  return constrainedSuites.has(path.basename(file)) ? 1 : 32768;
}

function imports({ memory }) {
  let indexBytes = Buffer.alloc(0);

  return {
    host: {
      canvas_get_size() {
        return (BigInt(600) << 32n) | BigInt(800);
      },
      canvas_listen_resize() {},
      pointer_listen() {},
      file_picker_open() {
        return 7;
      },
      opfs_create_from_file() {
        return 11;
      },
      opfs_read_chunk() {
        return 16;
      },
      opfs_source_from_file() {
        return 11;
      },
      opfs_source_open() {
        return 12;
      },
      opfs_source_name_len() {
        return 14;
      },
      opfs_source_name() {
        return 14;
      },
      opfs_source_size() {
        return BigInt(1048576);
      },
      opfs_source_read(sourceId, offset, len, dest) {
        if (sourceId === 111) {
          return -1;
        }

        const fixture = parserFixtures.get(sourceId);
        if (fixture !== undefined) {
          return writeFixture(memory, fixture, offset, len, dest);
        }

        return 64;
      },
      opfs_index_create() {
        return 21;
      },
      opfs_index_open() {
        return 22;
      },
      opfs_index_read(indexId, offset, len, dest) {
        if (indexId === 113) {
          return -1;
        }

        if (indexId === 114) {
          new Uint8Array(memory.buffer, dest, len).fill(0);
          return len;
        }

        if (indexId === 21 && Number(offset) >= 0) {
          const destEnd = dest + len;
          const start = Number(offset);

          if (destEnd <= memory.buffer.byteLength && start + len <= indexBytes.length) {
            new Uint8Array(memory.buffer, dest, len).set(indexBytes.subarray(start, start + len));
            return len;
          }

          const source = 65536 + start;
          const sourceEnd = source + len;

          if (sourceEnd <= memory.buffer.byteLength && destEnd <= memory.buffer.byteLength) {
            new Uint8Array(memory.buffer, dest, len).set(new Uint8Array(memory.buffer, source, len));
          }
        }

        return 65536;
      },
      opfs_index_write(indexId, offset, src, len) {
        if (indexId === 111) {
          return -1;
        }

        if (indexId === 21 && Number(offset) >= 0) {
          const start = Number(offset);
          const end = start + len;
          const srcEnd = src + len;

          if (srcEnd <= memory.buffer.byteLength) {
            if (end > indexBytes.length) {
              const next = Buffer.alloc(end);
              indexBytes.copy(next);
              indexBytes = next;
            }

            indexBytes.set(new Uint8Array(memory.buffer, src, len), start);
          }
        }

        return 65536;
      },
      opfs_index_flush(indexId) {
        if (indexId === 112) {
          return -1;
        }

        return 0;
      },
      opfs_index_size() {
        return BigInt(131072);
      },
    },
  };
}

function modulePathForTest(file) {
  if (!file.endsWith(".test.wasm")) {
    return null;
  }

  const parsed = path.parse(file);
  return path.join(parsed.dir, `${parsed.name.replace(/\.test$/, "")}.wasm`);
}

function wasmRootFor(modulePath) {
  const dir = path.dirname(modulePath);
  return path.basename(dir) === "std" ? path.dirname(dir) : dir;
}

function modulePathForId(rootDir, moduleId, wasmModulePath) {
  return path.join(rootDir, wasmModulePath(moduleId));
}

async function instantiateManifestModule(
  moduleId,
  moduleImports,
  aliases,
  rootDir,
  manifest,
  instantiated,
  instantiateWasm,
) {
  if (instantiated.has(moduleId)) {
    return true;
  }

  const wasmPath = modulePathForId(rootDir, moduleId, manifest.wasmModulePath);

  try {
    await fs.access(wasmPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }

    throw error;
  }

  for (const dependency of manifest.wasmModuleDependencies(moduleId)) {
    await instantiateManifestModule(
      dependency,
      moduleImports,
      aliases,
      rootDir,
      manifest,
      instantiated,
      instantiateWasm,
    );
  }

  const instance = await instantiateWasm(wasmPath, moduleImports);

  for (const alias of manifest.wasmModuleAliases(moduleId)) {
    moduleImports[alias] = instance.exports;
    aliases[alias] = instance.exports;
  }

  instantiated.add(moduleId);
  return true;
}

async function dependencies({ file, imports: baseImports, instantiateWasm }) {
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

  const rootDir = wasmRootFor(modulePath);
  const manifest = await wasmModules;
  const moduleId = manifest.wasmModuleIdForPath(modulePath);
  const moduleImports = { ...baseImports };
  const aliases = {};
  const instantiated = new Set();

  if (moduleId === null) {
    return {};
  }

  await instantiateManifestModule(
    moduleId,
    moduleImports,
    aliases,
    rootDir,
    manifest,
    instantiated,
    instantiateWasm,
  );

  return aliases;
}

module.exports = {
  dependencies,
  imports,
  memoryMaximumPagesFor,
};
