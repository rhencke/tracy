export const WASM_MODULES = Object.freeze({
  app: Object.freeze({
    wasmPath: "app.wasm",
    aliases: Object.freeze(["app"]),
    dependencies: Object.freeze([]),
  }),
  index: Object.freeze({
    wasmPath: "index.wasm",
    aliases: Object.freeze(["index"]),
    dependencies: Object.freeze(["std/mem"]),
  }),
  parser: Object.freeze({
    wasmPath: "parser.wasm",
    aliases: Object.freeze(["parser"]),
    dependencies: Object.freeze(["std/mem", "parser_state", "std/hash", "std/strtab"]),
  }),
  parser_state: Object.freeze({
    wasmPath: "parser_state.wasm",
    aliases: Object.freeze(["parser_state"]),
    dependencies: Object.freeze([]),
  }),
  "std/assert": Object.freeze({
    wasmPath: "std/assert.wasm",
    aliases: Object.freeze(["assert", "std/assert", "wat/std/assert"]),
    dependencies: Object.freeze([]),
  }),
  "std/alloc": Object.freeze({
    wasmPath: "std/alloc.wasm",
    aliases: Object.freeze(["alloc", "std/alloc", "wat/std/alloc"]),
    dependencies: Object.freeze([]),
  }),
  "std/array": Object.freeze({
    wasmPath: "std/array.wasm",
    aliases: Object.freeze(["array", "std/array", "wat/std/array"]),
    dependencies: Object.freeze(["std/alloc"]),
  }),
  "std/hash": Object.freeze({
    wasmPath: "std/hash.wasm",
    aliases: Object.freeze(["hash", "std/hash", "wat/std/hash"]),
    dependencies: Object.freeze(["std/alloc"]),
  }),
  "std/mem": Object.freeze({
    wasmPath: "std/mem.wasm",
    aliases: Object.freeze(["mem", "std/mem", "wat/std/mem"]),
    dependencies: Object.freeze([]),
  }),
  "std/pool": Object.freeze({
    wasmPath: "std/pool.wasm",
    aliases: Object.freeze(["pool", "std/pool", "wat/std/pool"]),
    dependencies: Object.freeze(["std/alloc"]),
  }),
  "std/ring": Object.freeze({
    wasmPath: "std/ring.wasm",
    aliases: Object.freeze(["ring", "std/ring", "wat/std/ring"]),
    dependencies: Object.freeze(["std/alloc"]),
  }),
  "std/strtab": Object.freeze({
    wasmPath: "std/strtab.wasm",
    aliases: Object.freeze(["strtab", "std/strtab", "wat/std/strtab"]),
    dependencies: Object.freeze(["std/alloc", "std/hash"]),
  }),
});

function normalizePath(value) {
  return String(value).replace(/\\/g, "/").replace(/^\.?\//, "");
}

export function wasmModuleIds() {
  return Object.keys(WASM_MODULES);
}

export function wasmModule(id) {
  const module = WASM_MODULES[id];
  if (module === undefined) {
    throw new Error(`unknown wasm module ${id}`);
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
  return `${baseUrl.replace(/\/?$/, "/")}${wasmModulePath(id)}`;
}

function appendWasmModuleGraph(id, ordered, seen, active) {
  if (active.has(id)) {
    throw new Error(`recursive wasm module dependency: ${id}`);
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
  const loaded = new Map();
  const compiled = await compileWasmModuleGraph(id, { baseUrl, compile });

  async function load(moduleId) {
    if (loaded.has(moduleId)) {
      return loaded.get(moduleId);
    }

    for (const dependency of wasmModuleDependencies(moduleId)) {
      const dependencyExports = await load(dependency);
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
    loaded.set(moduleId, exports);

    for (const alias of wasmModuleAliases(moduleId)) {
      imports[alias] = exports;
    }

    return exports;
  }

  return {
    exports: await load(id),
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
}
