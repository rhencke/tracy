#!/usr/bin/env node

const { readFileSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");

const root = dirname(__dirname);
const checkOnly = process.argv.includes("--check");
const sourcePath = join(root, "abi/runtime.json");
const spec = JSON.parse(readFileSync(sourcePath, "utf8"));
const paletteSpec = JSON.parse(readFileSync(join(root, "abi/palette.json"), "utf8"));

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

function renderStartupSpecModule() {
  return [
    [
      "// Generated from abi/runtime.json and abi/palette.json by tools/generate-runtime-spec.js.",
      "// Do not edit host/startup-spec.mjs by hand.",
    ].join("\n"),
    "",
    renderStringConstants("RUNTIME_URLS", spec.urls),
    "",
    renderStringConstants("APP_SHELL_COLORS", paletteSpec.palettes.default.appShell),
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

function renderTraceRendererSpecModule() {
  return [
    [
      "// Generated from abi/palette.json by tools/generate-runtime-spec.js.",
      "// Do not edit host/trace-renderer-spec.mjs by hand.",
    ].join("\n"),
    "",
    renderStringConstants("TRACE_RENDERER_COLORS", paletteSpec.palettes.default.traceRenderer),
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

const ok = [
  writeIfChanged("host/startup-spec.mjs", renderStartupSpecModule()),
  writeIfChanged("host/trace-renderer-spec.mjs", renderTraceRendererSpecModule()),
].every(Boolean);

if (!ok) {
  process.exitCode = 1;
}
