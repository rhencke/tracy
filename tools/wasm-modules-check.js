#!/usr/bin/env node

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function main() {
  const manifestUrl = pathToFileURL(path.resolve(__dirname, "../host/wasm-modules.mjs")).href;
  const {
    instantiateWasmModule,
    wasmModuleGraphIds,
    wasmModuleUrl,
  } = await import(manifestUrl);

  assert.deepEqual(wasmModuleGraphIds("parser"), [
    "std/mem",
    "std/alloc",
    "std/hash",
    "std/strtab",
    "parser_state",
    "parser",
  ]);
  assert.equal(wasmModuleUrl("std/strtab", "/assets/wasm"), "/assets/wasm/std/strtab.wasm");

  const compiledIds = [];
  let compileCompleted = 0;
  const instantiatedIds = [];
  const { exports, imports } = await instantiateWasmModule(
    "parser",
    { env: { memory: "shared-memory" } },
    {
      baseUrl: "/assets/wasm",
      async compile(url, moduleId) {
        compiledIds.push(moduleId);
        await Promise.resolve();
        compileCompleted += 1;
        return { moduleId, url };
      },
      instantiate(module, moduleImports, moduleId, url) {
        assert.equal(compileCompleted, compiledIds.length);
        assert.equal(module.moduleId, moduleId);
        assert.equal(module.url, url);
        assert.equal(moduleImports.env.memory, "shared-memory");
        instantiatedIds.push(moduleId);
        return Promise.resolve({ moduleId });
      },
    },
  );

  assert.deepEqual(compiledIds, [
    "std/mem",
    "std/alloc",
    "std/hash",
    "std/strtab",
    "parser_state",
    "parser",
  ]);
  assert.deepEqual(instantiatedIds, compiledIds);
  assert.equal(exports.moduleId, "parser");
  assert.equal(imports.mem.moduleId, "std/mem");
  assert.equal(imports.parser_state.moduleId, "parser_state");
  assert.equal(imports.alloc.moduleId, "std/alloc");
  assert.equal(imports.hash.moduleId, "std/hash");
  assert.equal(imports.strtab.moduleId, "std/strtab");
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
