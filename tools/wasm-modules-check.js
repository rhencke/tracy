#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  aliasesForModuleId,
  extractWasmModules,
  resolveDependencies,
  scanImportNames,
  scanThreadMarker,
} = require("./extract-wasm-modules.js");

async function withFixtureWat(source, callback) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "tracy-wasm-modules-test-"));
  const fixturePath = path.join(tmpDir, "fixture.wat");

  try {
    await fs.writeFile(fixturePath, source);
    return await callback(fixturePath);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

async function testExtractorFixtures() {
  assert.deepEqual(aliasesForModuleId("parser"), ["parser"]);
  assert.deepEqual(aliasesForModuleId("std/strtab"), ["strtab", "std/strtab", "wat/std/strtab"]);

  await withFixtureWat("(module)\n", async (fixturePath) => {
    assert.deepEqual(await scanImportNames(fixturePath), []);
  });

  await withFixtureWat(";; @thread worker\n(module)\n", async (fixturePath) => {
    assert.equal(await scanThreadMarker(fixturePath), "worker");
  });

  await withFixtureWat(";; @thread main\n;; @thread worker\n(module)\n", async (fixturePath) => {
    await assert.rejects(scanThreadMarker(fixturePath), /duplicate @thread marker/);
  });

  await withFixtureWat(";; @thread render\n(module)\n", async (fixturePath) => {
    await assert.rejects(scanThreadMarker(fixturePath), /invalid @thread marker render/);
  });

  await withFixtureWat("(module)\n", async (fixturePath) => {
    await assert.rejects(scanThreadMarker(fixturePath), /missing @thread marker/);
  });

  await withFixtureWat(
    `(module
      ;; (import "comment-line" "ignored" (func))
      (; (import "comment-block" "ignored" (func)) ;)
      (import "env" "memory" (memory 1))
      (func (import "peer" "folded"))
      (func $body
        (block
          i32.const 1))
      (import "peer" "again" (func))
    )
`,
    async (fixturePath) => {
      assert.deepEqual(await scanImportNames(fixturePath), ["env", "peer", "peer"]);
    },
  );

  const aliasIndex = new Map([
    ["peer", "std/peer"],
    ["wat/std/peer", "std/peer"],
  ]);
  assert.deepEqual(
    resolveDependencies(["env", "peer", "wat/std/peer", "host"], aliasIndex),
    ["std/peer"],
  );

  const manifest = await extractWasmModules();
  assert.equal(manifest.modules.app.thread, "main");
  assert.equal(manifest.modules.index.thread, "shared");
  assert.equal(manifest.modules.parser.thread, "worker");
  assert.equal(manifest.modules["std/mem"].thread, "shared");
  assert.deepEqual(manifest.modules.app.dependencies, []);
  assert.deepEqual(manifest.modules.index.dependencies, ["std/mem"]);
  assert.deepEqual(manifest.modules.parser.dependencies, ["std/mem", "std/strtab", "parser_state"]);
}

function assertComesBefore(values, before, after) {
  assert(values.includes(before), `${before} missing from ${JSON.stringify(values)}`);
  assert(values.includes(after), `${after} missing from ${JSON.stringify(values)}`);
  assert(values.indexOf(before) < values.indexOf(after), `${before} should be ready before ${after}`);
}

async function main() {
  const manifestUrl = pathToFileURL(path.resolve(__dirname, "../host/wasm-modules.mjs")).href;
  const {
    compileWasmModuleGraph,
    compileWasmModuleGraphForThread,
    instantiateWasmModuleForThread,
    instantiateWasmModule,
    wasmModuleGraphIds,
    wasmModuleGraphIdsForThread,
    wasmModuleIds,
    wasmModuleIdsForThread,
    wasmModuleRunsOnThread,
    wasmModuleThread,
    wasmModuleUrl,
  } = await import(manifestUrl);

  await testExtractorFixtures();

  const parserGraphIds = wasmModuleGraphIds("parser");
  assert.deepEqual(parserGraphIds, [...parserGraphIds].sort());
  assert.deepEqual(new Set(parserGraphIds), new Set([
    "std/mem",
    "std/alloc",
    "std/hash",
    "std/strtab",
    "parser_state",
    "parser",
  ]));
  assert.equal(wasmModuleThread("app"), "main");
  assert.equal(wasmModuleThread("index"), "shared");
  assert.equal(wasmModuleThread("parser"), "worker");
  assert.equal(wasmModuleThread("std/mem"), "shared");
  assert.equal(wasmModuleRunsOnThread("app", "main"), true);
  assert.equal(wasmModuleRunsOnThread("app", "worker"), false);
  assert.equal(wasmModuleRunsOnThread("index", "main"), true);
  assert.equal(wasmModuleRunsOnThread("index", "worker"), true);
  assert.equal(wasmModuleRunsOnThread("std/mem", "main"), true);
  assert.equal(wasmModuleRunsOnThread("std/mem", "worker"), true);
  assert.deepEqual(new Set(wasmModuleIdsForThread("main")), new Set([
    "app",
    "index",
    "std/alloc",
    "std/array",
    "std/assert",
    "std/hash",
    "std/mem",
    "std/pool",
    "std/ring",
    "std/strtab",
  ]));
  assert.deepEqual(new Set(wasmModuleIdsForThread("worker")), new Set([
    "index",
    "parser",
    "parser_state",
    "std/alloc",
    "std/array",
    "std/assert",
    "std/hash",
    "std/mem",
    "std/pool",
    "std/ring",
    "std/strtab",
  ]));
  assert.deepEqual(new Set(wasmModuleGraphIdsForThread("parser", "worker")), new Set(parserGraphIds));
  assert.throws(
    () => wasmModuleGraphIdsForThread("parser", "main"),
    /wasm module parser does not run on main/,
  );
  assert.equal(wasmModuleUrl("std/strtab", "/assets/wasm"), "/assets/wasm/std/strtab.wasm");

  const registryModuleIds = wasmModuleIds();
  const compiledGraph = await compileWasmModuleGraph("parser", {
    baseUrl: "/assets/wasm",
    compile(url, moduleId) {
      return Promise.resolve({ moduleId, url });
    },
  });
  assert.deepEqual(new Set(compiledGraph.keys()), new Set(registryModuleIds));

  const workerCompileStartedIds = [];
  const compiledWorkerGraph = await compileWasmModuleGraphForThread("parser", "worker", {
    baseUrl: "/assets/wasm",
    compile(url, moduleId) {
      workerCompileStartedIds.push(moduleId);
      assert(wasmModuleIdsForThread("worker").includes(moduleId));
      return Promise.resolve({ moduleId, url });
    },
  });
  assert.deepEqual(new Set(workerCompileStartedIds), new Set(wasmModuleIdsForThread("worker")));
  assert.deepEqual(new Set(compiledWorkerGraph.keys()), new Set(wasmModuleIdsForThread("worker")));

  const mainCompileStartedIds = [];
  const compiledMainGraph = await compileWasmModuleGraphForThread("app", "main", {
    baseUrl: "/assets/wasm",
    compile(url, moduleId) {
      mainCompileStartedIds.push(moduleId);
      assert(wasmModuleIdsForThread("main").includes(moduleId));
      return Promise.resolve({ moduleId, url });
    },
  });
  assert.deepEqual(new Set(mainCompileStartedIds), new Set(wasmModuleIdsForThread("main")));
  assert.deepEqual(new Set(compiledMainGraph.keys()), new Set(wasmModuleIdsForThread("main")));

  const compileStartedIds = [];
  const instantiatedIds = [];
  const { exports, imports } = await instantiateWasmModule(
    "parser",
    { env: { memory: "shared-memory" } },
    {
      baseUrl: "/assets/wasm",
      async compile(url, moduleId) {
        compileStartedIds.push(moduleId);
        if (!parserGraphIds.includes(moduleId)) {
          return new Promise(() => {});
        }
        await Promise.resolve();
        return { moduleId, url };
      },
      instantiate(module, moduleImports, moduleId, url) {
        assert.equal(module.moduleId, moduleId);
        assert.equal(module.url, url);
        assert.equal(moduleImports.env.memory, "shared-memory");
        instantiatedIds.push(moduleId);
        return Promise.resolve({ moduleId });
      },
    },
  );

  assert.deepEqual(new Set(compileStartedIds), new Set(registryModuleIds));
  assert.deepEqual(new Set(instantiatedIds), new Set(parserGraphIds));
  assertComesBefore(instantiatedIds, "std/mem", "parser");
  assertComesBefore(instantiatedIds, "parser_state", "parser");
  assertComesBefore(instantiatedIds, "std/alloc", "std/hash");
  assertComesBefore(instantiatedIds, "std/hash", "std/strtab");
  assertComesBefore(instantiatedIds, "std/strtab", "parser");
  assert.equal(exports.moduleId, "parser");
  assert.equal(imports.mem.moduleId, "std/mem");
  assert.equal(imports.parser_state.moduleId, "parser_state");
  assert.equal(imports.alloc.moduleId, "std/alloc");
  assert.equal(imports.hash.moduleId, "std/hash");
  assert.equal(imports.strtab.moduleId, "std/strtab");

  const workerInstantiatedIds = [];
  const workerInstantiateCompileStartedIds = [];
  const workerLoaded = await instantiateWasmModuleForThread(
    "parser",
    "worker",
    { env: { memory: "worker-memory" } },
    {
      baseUrl: "/assets/wasm",
      compile(url, moduleId) {
        workerInstantiateCompileStartedIds.push(moduleId);
        assert(wasmModuleIdsForThread("worker").includes(moduleId));
        return Promise.resolve({ moduleId, url });
      },
      instantiate(module, moduleImports, moduleId) {
        assert.equal(moduleImports.env.memory, "worker-memory");
        workerInstantiatedIds.push(moduleId);
        return Promise.resolve({ moduleId, thread: "worker" });
      },
    },
  );
  assert.deepEqual(new Set(workerInstantiateCompileStartedIds), new Set(parserGraphIds));
  assert.deepEqual(new Set(workerInstantiatedIds), new Set(parserGraphIds));
  assert.equal(workerLoaded.exports.moduleId, "parser");
  assert.equal(workerLoaded.imports.mem.thread, "worker");

  const mainIndexCompileStartedIds = [];
  const mainLoadedIndex = await instantiateWasmModuleForThread(
    "index",
    "main",
    { env: { memory: "main-memory" } },
    {
      compile(url, moduleId) {
        mainIndexCompileStartedIds.push(moduleId);
        assert(wasmModuleIdsForThread("main").includes(moduleId));
        return Promise.resolve({ moduleId, url });
      },
      instantiate(module, moduleImports, moduleId) {
        assert.equal(moduleImports.env.memory, "main-memory");
        return Promise.resolve({ moduleId, thread: "main" });
      },
    },
  );
  assert.deepEqual(new Set(mainIndexCompileStartedIds), new Set([
    "std/mem",
    "index",
  ]));
  assert.equal(mainLoadedIndex.exports.moduleId, "index");
  assert.equal(mainLoadedIndex.imports.mem.thread, "main");

  const mainLoadedShared = await instantiateWasmModuleForThread(
    "std/mem",
    "main",
    { env: { memory: "main-memory" } },
    {
      compile(url, moduleId) {
        assert(wasmModuleIdsForThread("main").includes(moduleId));
        return Promise.resolve({ moduleId, url });
      },
      instantiate(module, moduleImports, moduleId) {
        assert.equal(moduleImports.env.memory, "main-memory");
        return Promise.resolve({ moduleId, thread: "main" });
      },
    },
  );
  const workerLoadedShared = await instantiateWasmModuleForThread(
    "std/mem",
    "worker",
    { env: { memory: "worker-memory" } },
    {
      compile(url, moduleId) {
        assert(wasmModuleIdsForThread("worker").includes(moduleId));
        return Promise.resolve({ moduleId, url });
      },
      instantiate(module, moduleImports, moduleId) {
        assert.equal(moduleImports.env.memory, "worker-memory");
        return Promise.resolve({ moduleId, thread: "worker" });
      },
    },
  );
  assert.notEqual(mainLoadedShared.exports, workerLoadedShared.exports);
  assert.equal(mainLoadedShared.exports.thread, "main");
  assert.equal(workerLoadedShared.exports.thread, "worker");

  for (const moduleId of registryModuleIds) {
    const loaded = await instantiateWasmModule(
      moduleId,
      { env: { memory: "shared-memory" } },
      {
        baseUrl: "/assets/wasm",
        compile(url, compiledModuleId) {
          return Promise.resolve({ moduleId: compiledModuleId, url });
        },
        instantiate(module, moduleImports, instantiatedModuleId) {
          assert.equal(module.moduleId, instantiatedModuleId);
          assert.equal(moduleImports.env.memory, "shared-memory");
          return Promise.resolve({ moduleId: instantiatedModuleId });
        },
      },
    );

    assert.equal(loaded.exports.moduleId, moduleId);
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
