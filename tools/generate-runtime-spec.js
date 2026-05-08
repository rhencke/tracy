#!/usr/bin/env node

const { readFileSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");

const root = dirname(__dirname);
const checkOnly = process.argv.includes("--check");
const sourcePath = join(root, "abi/runtime.json");
const spec = JSON.parse(readFileSync(sourcePath, "utf8"));
const paletteSpec = JSON.parse(readFileSync(join(root, "abi/palette.json"), "utf8"));
const layoutSpec = require("./layout-spec.js");

function pathKey(paths) {
  return [...paths].sort().join("\n");
}

function collectNumericConstantLeaves(value, path = [], leaves = []) {
  if (path[0] === "constantAudit") {
    return leaves;
  }

  if (typeof value === "number") {
    leaves.push({ path: path.join("."), value });
    return leaves;
  }

  if (Array.isArray(value) || value === null || typeof value !== "object") {
    return leaves;
  }

  if (typeof value.value === "number") {
    leaves.push({ path: path.join("."), value: value.value });
    return leaves;
  }

  for (const [name, child] of Object.entries(value)) {
    collectNumericConstantLeaves(child, [...path, name], leaves);
  }

  return leaves;
}

function assertDuplicateNumericValuesAudited() {
  const groups = new Map();
  for (const leaf of collectNumericConstantLeaves(spec)) {
    if (!groups.has(leaf.value)) {
      groups.set(leaf.value, []);
    }
    groups.get(leaf.value).push(leaf.path);
  }

  const duplicateGroups = [...groups.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([value, paths]) => ({ value, paths }));
  const audits = spec.constantAudit?.duplicateNumericValues ?? [];

  for (const audit of audits) {
    if (!Number.isFinite(audit.numericValue)) {
      throw new Error("runtime duplicate numeric audit entries must include numericValue");
    }
    if (!Array.isArray(audit.paths) || audit.paths.length < 2) {
      throw new Error(`runtime duplicate numeric audit for ${audit.numericValue} must list at least two paths`);
    }
    if (typeof audit.description !== "string" || audit.description.trim().length === 0) {
      throw new Error(`runtime duplicate numeric audit for ${audit.numericValue} must include a description`);
    }
  }

  for (const group of duplicateGroups) {
    const matchingAudit = audits.find(
      (audit) => audit.numericValue === group.value && pathKey(audit.paths) === pathKey(group.paths),
    );
    if (!matchingAudit) {
      throw new Error(
        `duplicate numeric runtime constants must be audited: ${group.value} at ${group.paths.join(", ")}`,
      );
    }
  }

  for (const audit of audits) {
    const matchingGroup = duplicateGroups.find(
      (group) => group.value === audit.numericValue && pathKey(group.paths) === pathKey(audit.paths),
    );
    if (!matchingGroup) {
      throw new Error(
        `runtime duplicate numeric audit is stale: ${audit.numericValue} at ${audit.paths.join(", ")}`,
      );
    }
  }
}

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

function renderLocalStringConstants(groupName, entries) {
  const lines = [`const ${groupName} = Object.freeze({`];

  for (const [name, entry] of Object.entries(entries)) {
    lines.push(`  ${name}: ${JSON.stringify(entry.value)},`);
  }

  lines.push("});");
  return lines.join("\n");
}

function renderLocalNumberConstants(groupName, entries) {
  const lines = [`const ${groupName} = Object.freeze({`];

  for (const [name, entry] of Object.entries(entries)) {
    lines.push(`  ${name}: ${entry.value},`);
  }

  lines.push("});");
  return lines.join("\n");
}

function renderIndexQueryResultLayout(groupName) {
  const lines = [`const ${groupName} = Object.freeze({`];

  lines.push(
    `  BYTES: ${layoutSpec.INDEX_QUERY_RESULT_FIELD_BYTES * layoutSpec.INDEX_QUERY_RESULT_FIELDS.length},`,
  );
  for (const field of layoutSpec.INDEX_QUERY_RESULT_FIELDS) {
    lines.push(`  ${field.property.toUpperCase()}: ${field.offset},`);
  }

  lines.push("});");
  return lines.join("\n");
}

function renderTraceRendererContractBlock({ local }) {
  const renderNumbers = local ? renderLocalNumberConstants : renderNumberConstants;
  const indexLayout = local
    ? renderIndexQueryResultLayout("INDEX_QUERY_RESULT_LAYOUT")
    : renderIndexQueryResultLayout("INDEX_QUERY_RESULT_LAYOUT").replace(
      "const INDEX_QUERY_RESULT_LAYOUT",
      "export const INDEX_QUERY_RESULT_LAYOUT",
    );

  return [
    renderNumbers("TRACE_RENDERER_QUERY_DEFAULTS", spec.traceRenderer.query),
    "",
    renderNumbers("TRACE_RENDERER_LAYOUT_DEFAULTS", spec.traceRenderer.layout),
    "",
    indexLayout,
  ].join("\n");
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
      "// Generated from abi/runtime.json, abi/layout.json, and abi/palette.json by tools/generate-runtime-spec.js.",
      "// Do not edit host/trace-renderer-spec.mjs by hand.",
    ].join("\n"),
    "",
    renderTraceRendererContractBlock({ local: false }),
    "",
    renderStringConstants("TRACE_RENDERER_COLORS", paletteSpec.palettes.default.traceRenderer),
    "",
  ].join("\n");
}

function assertTraceRendererInlinePalette() {
  const rendererPath = join(root, "host/progressive-trace-renderer.mjs");
  const renderer = readFileSync(rendererPath, "utf8");
  const expected = renderLocalStringConstants(
    "TRACE_RENDERER_COLORS",
    paletteSpec.palettes.default.traceRenderer,
  );

  if (!renderer.includes(expected)) {
    throw new Error(
      "host/progressive-trace-renderer.mjs inline TRACE_RENDERER_COLORS is out of date with abi/palette.json",
    );
  }
}

function assertTraceRendererInlineContract() {
  const rendererPath = join(root, "host/progressive-trace-renderer.mjs");
  const renderer = readFileSync(rendererPath, "utf8");
  const expected = renderTraceRendererContractBlock({ local: true });

  if (!renderer.includes(expected)) {
    throw new Error(
      "host/progressive-trace-renderer.mjs inline renderer contract is out of date with abi/runtime.json and abi/layout.json",
    );
  }
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

assertDuplicateNumericValuesAudited();
assertTraceRendererInlineContract();
assertTraceRendererInlinePalette();

const ok = [
  writeIfChanged("host/startup-spec.mjs", renderStartupSpecModule()),
  writeIfChanged("host/trace-renderer-spec.mjs", renderTraceRendererSpecModule()),
].every(Boolean);

if (!ok) {
  process.exitCode = 1;
}
