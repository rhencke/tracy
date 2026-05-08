// Generated from abi/wasm-modules.json by tools/generate-wasm-modules-abi.js.
// Do not edit host/wasm-modules.mjs by hand.

export const WASM_MODULES = Object.freeze({
  "app": Object.freeze({
    thread: "main",
    wasmPath: "app.wasm",
    aliases: Object.freeze(["app"]),
    dependencies: Object.freeze([]),
  }),
  "index": Object.freeze({
    thread: "worker",
    wasmPath: "index.wasm",
    aliases: Object.freeze(["index"]),
    dependencies: Object.freeze(["std/mem"]),
  }),
  "parser": Object.freeze({
    thread: "worker",
    wasmPath: "parser.wasm",
    aliases: Object.freeze(["parser"]),
    dependencies: Object.freeze(["std/mem", "std/strtab", "parser_state"]),
  }),
  "parser_state": Object.freeze({
    thread: "worker",
    wasmPath: "parser_state.wasm",
    aliases: Object.freeze(["parser_state"]),
    dependencies: Object.freeze([]),
  }),
  "std/alloc": Object.freeze({
    thread: "shared",
    wasmPath: "std/alloc.wasm",
    aliases: Object.freeze(["alloc", "std/alloc", "wat/std/alloc"]),
    dependencies: Object.freeze([]),
  }),
  "std/array": Object.freeze({
    thread: "shared",
    wasmPath: "std/array.wasm",
    aliases: Object.freeze(["array", "std/array", "wat/std/array"]),
    dependencies: Object.freeze(["std/alloc"]),
  }),
  "std/assert": Object.freeze({
    thread: "shared",
    wasmPath: "std/assert.wasm",
    aliases: Object.freeze(["assert", "std/assert", "wat/std/assert"]),
    dependencies: Object.freeze([]),
  }),
  "std/hash": Object.freeze({
    thread: "shared",
    wasmPath: "std/hash.wasm",
    aliases: Object.freeze(["hash", "std/hash", "wat/std/hash"]),
    dependencies: Object.freeze(["std/alloc"]),
  }),
  "std/mem": Object.freeze({
    thread: "shared",
    wasmPath: "std/mem.wasm",
    aliases: Object.freeze(["mem", "std/mem", "wat/std/mem"]),
    dependencies: Object.freeze([]),
  }),
  "std/pool": Object.freeze({
    thread: "shared",
    wasmPath: "std/pool.wasm",
    aliases: Object.freeze(["pool", "std/pool", "wat/std/pool"]),
    dependencies: Object.freeze(["std/alloc"]),
  }),
  "std/ring": Object.freeze({
    thread: "shared",
    wasmPath: "std/ring.wasm",
    aliases: Object.freeze(["ring", "std/ring", "wat/std/ring"]),
    dependencies: Object.freeze(["std/alloc"]),
  }),
  "std/strtab": Object.freeze({
    thread: "shared",
    wasmPath: "std/strtab.wasm",
    aliases: Object.freeze(["strtab", "std/strtab", "wat/std/strtab"]),
    dependencies: Object.freeze(["std/alloc", "std/hash"]),
  }),
});

function normalizePath(value) {
  return String(value).replace(/\\/g, "/").replace(/^\.?\//, "");
}

const WASM_MODULE_THREADS = Object.freeze(["main", "worker", "shared"]);
export const CORE_SHELL_MODULE_ID = "app";
export const CORE_SHELL_THREAD = "main";

function assertWasmModuleThread(thread) {
  if (!WASM_MODULE_THREADS.includes(thread)) {
    throw new Error(`unknown wasm module thread ${thread}`);
  }
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

export function wasmModuleThread(id) {
  return wasmModule(id).thread;
}

export function wasmModulePath(id) {
  return wasmModule(id).wasmPath;
}

export function wasmModuleUrl(id, baseUrl = "wasm/") {
  return `${baseUrl.replace(/\/?$/, "/")}${wasmModulePath(id)}`;
}

export function wasmModuleRunsOnThread(id, thread) {
  assertWasmModuleThread(thread);
  const moduleThread = wasmModuleThread(id);
  return moduleThread === thread || moduleThread === "shared";
}

export function wasmModuleIdsForThread(thread) {
  assertWasmModuleThread(thread);
  return Object.freeze(
    wasmModuleIds().filter((id) => wasmModuleRunsOnThread(id, thread)),
  );
}

function collectWasmModuleGraph(id, collected, active) {
  if (active.has(id)) {
    throw new Error(`recursive wasm module dependency: ${id}`);
  }
  if (collected.has(id)) {
    return;
  }

  active.add(id);
  for (const dependency of wasmModuleDependencies(id)) {
    collectWasmModuleGraph(dependency, collected, active);
  }
  active.delete(id);

  collected.add(id);
}

export function wasmModuleGraphIds(id) {
  const graphIds = new Set();
  collectWasmModuleGraph(id, graphIds, new Set());
  return Object.freeze([...graphIds].sort());
}

export function wasmModuleGraphIdsForThread(id, thread) {
  if (!wasmModuleRunsOnThread(id, thread)) {
    throw new Error(`wasm module ${id} does not run on ${thread}`);
  }

  const graphIds = wasmModuleGraphIds(id);
  for (const moduleId of graphIds) {
    if (!wasmModuleRunsOnThread(moduleId, thread)) {
      throw new Error(
        `wasm module ${id} depends on ${moduleId}, which does not run on ${thread}`,
      );
    }
  }

  return graphIds;
}

export function coreShellWasmModuleGraphIds() {
  return wasmModuleGraphIdsForThread(CORE_SHELL_MODULE_ID, CORE_SHELL_THREAD);
}

async function defaultCompile(url) {
  return WebAssembly.compileStreaming(fetch(url));
}

async function defaultInstantiate(module, imports) {
  const instance = await WebAssembly.instantiate(module, imports);
  return instance.exports;
}

function compileWasmModuleRegistry(
  { baseUrl = "wasm/", compile = defaultCompile, moduleIds = wasmModuleIds() } = {},
) {
  const compiled = new Map();

  for (const moduleId of moduleIds) {
    let promise;
    try {
      promise = Promise.resolve(compile(wasmModuleUrl(moduleId, baseUrl), moduleId));
    } catch (error) {
      promise = Promise.reject(error);
    }
    promise.catch(() => {});
    compiled.set(moduleId, promise);
  }

  return compiled;
}

export async function compileWasmModuleGraph(
  id,
  { baseUrl = "wasm/", compile = defaultCompile } = {},
) {
  wasmModuleGraphIds(id);
  const compiled = compileWasmModuleRegistry({ baseUrl, compile });
  const compiledEntries = await Promise.all(
    [...compiled].map(async ([moduleId, promise]) => [moduleId, await promise]),
  );

  return new Map(compiledEntries);
}

export async function compileWasmModuleGraphForThread(
  id,
  thread,
  { baseUrl = "wasm/", compile = defaultCompile } = {},
) {
  wasmModuleGraphIdsForThread(id, thread);
  const compiled = compileWasmModuleRegistry({
    baseUrl,
    compile,
    moduleIds: wasmModuleIdsForThread(thread),
  });
  const compiledEntries = await Promise.all(
    [...compiled].map(async ([moduleId, promise]) => [moduleId, await promise]),
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
  wasmModuleGraphIds(id);
  const compiled = compileWasmModuleRegistry({ baseUrl, compile });
  const instantiating = new Map();

  async function instantiateModule(moduleId) {
    if (instances.has(moduleId)) {
      return instances.get(moduleId);
    }
    if (instantiating.has(moduleId)) {
      return instantiating.get(moduleId);
    }

    const promise = (async () => {
      await Promise.all(wasmModuleDependencies(moduleId).map(instantiateModule));

      for (const dependency of wasmModuleDependencies(moduleId)) {
        const dependencyExports = instances.get(dependency);
        for (const alias of wasmModuleAliases(dependency)) {
          imports[alias] = dependencyExports;
        }
      }

      const exports = await instantiate(
        await compiled.get(moduleId),
        imports,
        moduleId,
        wasmModuleUrl(moduleId, baseUrl),
      );
      instances.set(moduleId, exports);

      for (const alias of wasmModuleAliases(moduleId)) {
        imports[alias] = exports;
      }

      return exports;
    })();
    instantiating.set(moduleId, promise);
    return promise;
  }

  const exports = await instantiateModule(id);

  for (const moduleId of wasmModuleGraphIds(id)) {
    for (const dependency of wasmModuleDependencies(moduleId)) {
      const dependencyExports = instances.get(dependency);
      for (const alias of wasmModuleAliases(dependency)) {
        imports[alias] = dependencyExports;
      }
    }
  }

  return {
    exports,
    imports,
  };
}

export async function instantiateWasmModuleForThread(
  id,
  thread,
  baseImports,
  {
    baseUrl = "wasm/",
    compile = defaultCompile,
    instantiate = defaultInstantiate,
  } = {},
) {
  const imports = { ...baseImports };
  const instances = new Map();
  wasmModuleGraphIdsForThread(id, thread);
  const compiled = compileWasmModuleRegistry({
    baseUrl,
    compile,
    moduleIds: wasmModuleIdsForThread(thread),
  });
  const instantiating = new Map();

  async function instantiateModule(moduleId) {
    if (instances.has(moduleId)) {
      return instances.get(moduleId);
    }
    if (instantiating.has(moduleId)) {
      return instantiating.get(moduleId);
    }

    const promise = (async () => {
      await Promise.all(wasmModuleDependencies(moduleId).map(instantiateModule));

      for (const dependency of wasmModuleDependencies(moduleId)) {
        const dependencyExports = instances.get(dependency);
        for (const alias of wasmModuleAliases(dependency)) {
          imports[alias] = dependencyExports;
        }
      }

      const exports = await instantiate(
        await compiled.get(moduleId),
        imports,
        moduleId,
        wasmModuleUrl(moduleId, baseUrl),
      );
      instances.set(moduleId, exports);

      for (const alias of wasmModuleAliases(moduleId)) {
        imports[alias] = exports;
      }

      return exports;
    })();
    instantiating.set(moduleId, promise);
    return promise;
  }

  const exports = await instantiateModule(id);

  for (const moduleId of wasmModuleGraphIdsForThread(id, thread)) {
    for (const dependency of wasmModuleDependencies(moduleId)) {
      const dependencyExports = instances.get(dependency);
      for (const alias of wasmModuleAliases(dependency)) {
        imports[alias] = dependencyExports;
      }
    }
  }

  return {
    exports,
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
