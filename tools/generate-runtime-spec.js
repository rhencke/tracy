#!/usr/bin/env node

const { readFileSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");

const root = dirname(__dirname);
const checkOnly = process.argv.includes("--check");
const sourcePath = join(root, "abi/runtime.json");
const spec = JSON.parse(readFileSync(sourcePath, "utf8"));

function generatedHeader(kind) {
  return [
    "// Generated from abi/runtime.json by tools/generate-runtime-spec.js.",
    `// Do not edit ${kind} by hand.`,
  ].join("\n");
}

function renderNumberConstants(groupName, entries) {
  const lines = [`export const ${groupName} = Object.freeze({`];

  for (const [name, entry] of Object.entries(entries)) {
    lines.push(`  ${name}: ${entry.value},`);
  }

  lines.push("});");
  return lines.join("\n");
}

function renderStringConstants(groupName, entries) {
  const lines = [`export const ${groupName} = Object.freeze({`];

  for (const [name, entry] of Object.entries(entries)) {
    lines.push(`  ${name}: ${JSON.stringify(entry.value)},`);
  }

  lines.push("});");
  return lines.join("\n");
}

function renderNamedStrings(groupName, entries) {
  const lines = [`export const ${groupName} = Object.freeze({`];

  for (const [name, value] of Object.entries(entries)) {
    lines.push(`  ${name}: ${JSON.stringify(value)},`);
  }

  lines.push("});");
  return lines.join("\n");
}

function renderRuntimeSpecModule() {
  return [
    generatedHeader("host/runtime-spec.mjs"),
    "",
    renderStringConstants("RUNTIME_URLS", spec.urls),
    "",
    renderNumberConstants("BOOTSTRAP_WASM_MEMORY", spec.wasmMemory),
    "",
    renderNumberConstants("BOOTSTRAP_TIMING", spec.bootstrap),
    "",
    renderNumberConstants("RUNTIME_DEFAULTS", spec.runtimeDefaults),
    "",
    renderNamedStrings("PERFORMANCE_MARKS", spec.performanceMarks),
    "",
    renderNamedStrings("PERFORMANCE_MEASURES", spec.performanceMeasures),
    "",
  ].join("\n");
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
    console.error(`${path} is out of date; run node tools/generate-runtime-spec.js`);
    return false;
  }

  writeFileSync(absolute, content);
  return true;
}

const ok = writeIfChanged("host/runtime-spec.mjs", renderRuntimeSpecModule());

if (!ok) {
  process.exitCode = 1;
}
