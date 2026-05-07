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
    instantiateWasmModule,
    wasmModuleGraphIds,
    wasmModuleIds,
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
  assert.equal(wasmModuleUrl("std/strtab", "/assets/wasm"), "/assets/wasm/std/strtab.wasm");

  const registryModuleIds = wasmModuleIds();
  const compiledGraph = await compileWasmModuleGraph("parser", {
    baseUrl: "/assets/wasm",
    compile(url, moduleId) {
      return Promise.resolve({ moduleId, url });
    },
  });
  assert.deepEqual(new Set(compiledGraph.keys()), new Set(registryModuleIds));

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
