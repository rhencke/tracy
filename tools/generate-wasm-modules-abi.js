#!/usr/bin/env node

const { readFileSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");

const root = dirname(__dirname);
const checkOnly = process.argv.includes("--check");
const sourcePath = join(root, "abi/wasm-modules.json");
const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const modules = source.modules;

function generatedHeader(kind) {
  return [
    "// Generated from abi/wasm-modules.json by tools/generate-wasm-modules-abi.js.",
    `// Do not edit ${kind} by hand.`,
  ].join("\n");
}

function readonlyArray(values) {
  return `Object.freeze([${values.map((value) => JSON.stringify(value)).join(", ")}])`;
}

function renderModuleEntry(id, module) {
  return [
    `  ${JSON.stringify(id)}: Object.freeze({`,
    `    wasmPath: ${JSON.stringify(module.wasmPath)},`,
    `    aliases: ${readonlyArray(module.aliases)},`,
    `    dependencies: ${readonlyArray(module.dependencies)},`,
    "  }),",
  ].join("\n");
}

function renderWasmModulesObject() {
  const lines = [
    "export const WASM_MODULES = Object.freeze({",
  ];

  for (const [id, module] of Object.entries(modules)) {
    lines.push(renderModuleEntry(id, module));
  }

  lines.push("});");
  return lines.join("\n");
}

function renderWasmModulesModule() {
  return `${[
    generatedHeader("host/wasm-modules.mjs"),
    "",
    renderWasmModulesObject(),
    "",
    `function normalizePath(value) {
  return String(value).replace(/\\\\/g, "/").replace(/^\\.?\\//, "");
}

export function wasmModuleIds() {
  return Object.keys(WASM_MODULES);
}

export function wasmModule(id) {
  const module = WASM_MODULES[id];
  if (module === undefined) {
    throw new Error(\`unknown wasm module \${id}\`);
  }

  return module;
}

export function wasmModuleAliases(id) {
  return wasmModule(id).aliases;
}

export function wasmModuleDependencies(id) {
  return wasmModule(id).dependencies;
}

export function wasmModulePath(id) {
  return wasmModule(id).wasmPath;
}

export function wasmModuleUrl(id, baseUrl = "wasm/") {
  return \`\${baseUrl.replace(/\\/?$/, "/")}\${wasmModulePath(id)}\`;
}

function appendWasmModuleGraph(id, ordered, seen, active) {
  if (active.has(id)) {
    throw new Error(\`recursive wasm module dependency: \${id}\`);
  }
  if (seen.has(id)) {
    return;
  }

  active.add(id);
  for (const dependency of wasmModuleDependencies(id)) {
    appendWasmModuleGraph(dependency, ordered, seen, active);
  }
  active.delete(id);

  seen.add(id);
  ordered.push(id);
}

export function wasmModuleGraphIds(id) {
  const ordered = [];
  appendWasmModuleGraph(id, ordered, new Set(), new Set());
  return Object.freeze(ordered);
}

async function defaultCompile(url) {
  return WebAssembly.compileStreaming(fetch(url));
}

async function defaultInstantiate(module, imports) {
  const instance = await WebAssembly.instantiate(module, imports);
  return instance.exports;
}

export async function compileWasmModuleGraph(
  id,
  { baseUrl = "wasm/", compile = defaultCompile } = {},
) {
  const graphIds = wasmModuleGraphIds(id);
  const compiledEntries = await Promise.all(
    graphIds.map(async (moduleId) => [
      moduleId,
      await compile(wasmModuleUrl(moduleId, baseUrl), moduleId),
    ]),
  );

  return new Map(compiledEntries);
}

export async function instantiateWasmModule(
  id,
  baseImports,
  {
    baseUrl = "wasm/",
    compile = defaultCompile,
    instantiate = defaultInstantiate,
  } = {},
) {
  const imports = { ...baseImports };
  const instances = new Map();
  const graphIds = wasmModuleGraphIds(id);
  const compiled = await compileWasmModuleGraph(id, { baseUrl, compile });

  for (const moduleId of graphIds) {
    for (const dependency of wasmModuleDependencies(moduleId)) {
      const dependencyExports = instances.get(dependency);
      for (const alias of wasmModuleAliases(dependency)) {
        imports[alias] = dependencyExports;
      }
    }

    const exports = await instantiate(
      compiled.get(moduleId),
      imports,
      moduleId,
      wasmModuleUrl(moduleId, baseUrl),
    );
    instances.set(moduleId, exports);

    for (const alias of wasmModuleAliases(moduleId)) {
      imports[alias] = exports;
    }
  }

  return {
    exports: instances.get(id),
    imports,
  };
}

export function wasmModuleIdForPath(value) {
  const normalized = normalizePath(value);

  for (const [id, module] of Object.entries(WASM_MODULES)) {
    if (normalized.endsWith(module.wasmPath)) {
      return id;
    }
  }

  return null;
}`,
  ].join("\n")}\n`;
}

function writeIfChanged(path, content) {
  const absolute = join(root, path);
  let previous = null;

  try {
    previous = readFileSync(absolute, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  if (previous === content) {
    return true;
  }

  if (checkOnly) {
    console.error(`${path} is out of date; run node tools/generate-wasm-modules-abi.js`);
    return false;
  }

  writeFileSync(absolute, content);
  return true;
}

const ok = writeIfChanged("host/wasm-modules.mjs", renderWasmModulesModule());

if (!ok) {
  process.exitCode = 1;
}

module.exports = {
  renderWasmModulesModule,
};
