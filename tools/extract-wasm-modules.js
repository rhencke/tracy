#!/usr/bin/env node

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { assembleWatFile, collectWatInputs } = require("./assemble-wat.js");
const { TokenReader, WatParseError, skipWatList } = require("./wat-parser.js");

const root = path.dirname(__dirname);
const checkOnly = process.argv.includes("--check");
const watRoot = path.join(root, "wat");
const outputPath = path.join(root, "abi/wasm-modules.json");
const validThreads = new Set(["main", "worker", "shared"]);

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function moduleIdForWatPath(relativePath) {
  return relativePath.replace(/\.wat$/, "");
}

function wasmPathForModuleId(id) {
  return `${id}.wasm`;
}

function aliasesForModuleId(id) {
  if (!id.includes("/")) {
    return [id];
  }

  return [path.posix.basename(id), id, `wat/${id}`];
}

async function scanThreadMarker(inputPath) {
  const source = await fs.readFile(inputPath, "utf8");
  const markers = [];

  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (!/;;\s*@thread\b/.test(line)) {
      continue;
    }

    const match = line.match(/^\s*;;\s*@thread\s+(\S+)\s*$/);
    if (match === null) {
      throw new Error(`${inputPath}:${index + 1}: malformed @thread marker`);
    }

    markers.push({ thread: match[1], line: index + 1 });
  }

  if (markers.length === 0) {
    throw new Error(`${inputPath}: missing @thread marker`);
  }

  if (markers.length > 1) {
    throw new Error(`${inputPath}:${markers[1].line}: duplicate @thread marker`);
  }

  const [{ thread, line }] = markers;
  if (!validThreads.has(thread)) {
    throw new Error(`${inputPath}:${line}: invalid @thread marker ${thread}`);
  }

  return thread;
}

async function listProductionWatFiles(dir = watRoot) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listProductionWatFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".wat") && !entry.name.endsWith(".test.wat")) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

async function scanImportNames(inputPath) {
  const reader = new TokenReader(inputPath);
  const imports = [];

  async function scanList() {
    while ((await reader.peek()).type !== ")") {
      const token = await reader.next();
      if (token.type !== "(") {
        continue;
      }

      const head = await reader.next();
      if (head.type === "atom" && head.value === "import") {
        const moduleName = await reader.next();
        if (moduleName.type === "string") {
          imports.push(moduleName.raw.slice(1, -1));
        }

        await skipWatList(reader);
      } else {
        await scanList();
      }
    }

    await reader.expect(")", "missing close paren");
  }

  try {
    await reader.expect("(", "expected a single WAT module");
    const moduleHead = await reader.next();
    if (moduleHead.type !== "atom" || moduleHead.value !== "module") {
      throw new WatParseError("expected a single WAT module", moduleHead.loc);
    }

    await scanList();
    const trailing = await reader.next();
    if (trailing.type !== "eof") {
      throw new WatParseError("expected a single WAT module", trailing.loc);
    }

    return imports;
  } finally {
    await reader.close();
  }
}

function buildAliasIndex(modules) {
  const aliases = new Map();

  for (const [id, module] of Object.entries(modules)) {
    for (const alias of module.aliases) {
      const existing = aliases.get(alias);
      if (existing !== undefined && existing !== id) {
        throw new Error(`duplicate wasm module alias ${alias}: ${existing} and ${id}`);
      }

      aliases.set(alias, id);
    }
  }

  return aliases;
}

function resolveDependencies(importNames, aliasIndex) {
  const dependencies = [];
  const seen = new Set();

  for (const importName of importNames) {
    const id = aliasIndex.get(importName);
    if (id === undefined || seen.has(id)) {
      continue;
    }

    seen.add(id);
    dependencies.push(id);
  }

  return dependencies;
}

async function scanModuleImports(watFile, tmpDir) {
  const inputs = await collectWatInputs(watFile);
  if (inputs.length === 1) {
    return scanImportNames(watFile);
  }

  const assembledPath = path.join(tmpDir, toPosixPath(path.relative(watRoot, watFile)));
  await assembleWatFile(watFile, assembledPath);
  return scanImportNames(assembledPath);
}

async function extractWasmModules() {
  const watFiles = await listProductionWatFiles();
  const modules = {};

  for (const watFile of watFiles) {
    const relativePath = toPosixPath(path.relative(watRoot, watFile));
    const id = moduleIdForWatPath(relativePath);

    modules[id] = {
      thread: await scanThreadMarker(watFile),
      wasmPath: wasmPathForModuleId(id),
      aliases: aliasesForModuleId(id),
      dependencies: [],
    };
  }

  const aliasIndex = buildAliasIndex(modules);
  const importNamesById = new Map();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "tracy-wasm-modules-"));

  try {
    for (const watFile of watFiles) {
      const relativePath = toPosixPath(path.relative(watRoot, watFile));
      const id = moduleIdForWatPath(relativePath);
      importNamesById.set(id, await scanModuleImports(watFile, tmpDir));
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }

  for (const [id, importNames] of importNamesById.entries()) {
    modules[id].dependencies = resolveDependencies(importNames, aliasIndex);
  }

  return { modules };
}

function renderJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function writeIfChanged(filePath, content) {
  let previous = null;

  try {
    previous = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  if (previous === content) {
    return false;
  }

  if (checkOnly) {
    throw new Error(`${path.relative(root, filePath)} is out of date`);
  }

  await fs.writeFile(filePath, content);
  return true;
}

async function main() {
  const manifest = await extractWasmModules();
  await writeIfChanged(outputPath, renderJson(manifest));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  aliasesForModuleId,
  extractWasmModules,
  moduleIdForWatPath,
  resolveDependencies,
  scanImportNames,
  scanThreadMarker,
  wasmPathForModuleId,
};
