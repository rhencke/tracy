#!/usr/bin/env node

const { readFileSync } = require("node:fs");
const { dirname, join } = require("node:path");
const { createGeneratedFileWriter } = require("./generated-file-writer.js");

const root = dirname(__dirname);
const checkOnly = process.argv.includes("--check");
const { writeIfChanged } = createGeneratedFileWriter({
  root,
  checkOnly,
  command: "node tools/generate-runtime-spec.js",
});
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

function renderStringArrayConstant(groupName, values, { local }) {
  const keyword = local ? "const" : "export const";
  const lines = [`${keyword} ${groupName} = Object.freeze([`];

  for (const value of values) {
    lines.push(`  ${JSON.stringify(value)},`);
  }

  lines.push("]);");
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

function colorEntriesByScope(paletteName, scope) {
  const selected = {};
  const palette = paletteSpec.palettes?.[paletteName] ?? {};

  for (const group of Object.values(palette)) {
    for (const [name, entry] of Object.entries(group)) {
      if (entry.scope === scope) {
        selected[name] = entry;
      }
    }
  }

  return selected;
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
    renderNumbers("TRACE_RENDERER_CANVAS_OPS", spec.traceRenderer.canvasOps),
    "",
    renderNumbers("TRACE_RENDERER_INCOMPLETE_RANGE_LAYOUT", spec.traceRenderer.incompleteRangeLayout),
    "",
    renderNumbers("TRACE_RENDERER_DRAW_DEFAULTS", spec.traceRenderer.draw),
    "",
    renderNumbers("TRACE_RENDERER_INTERACTION_DEFAULTS", spec.traceRenderer.interaction),
    "",
    renderNumbers("TRACE_RENDERER_COLOR_DEFAULTS", spec.traceRenderer.color),
    "",
    renderStringArrayConstant(
      "TRACE_RENDERER_REQUIRED_EXPORTS",
      spec.traceRenderer.requiredExports,
      { local },
    ),
    "",
    indexLayout,
  ].join("\n");
}

function watGlobal(name, value) {
  return `  (global $${name} i32 (i32.const ${value}))`;
}

function traceRendererWatGlobals() {
  const canvasOps = spec.traceRenderer.canvasOps;
  const drawDefaults = spec.traceRenderer.draw;
  const incompleteRangeLayout = spec.traceRenderer.incompleteRangeLayout;
  const layoutDefaults = spec.traceRenderer.layout;
  const indexQueryResultBytes =
    layoutSpec.INDEX_QUERY_RESULT_FIELD_BYTES * layoutSpec.INDEX_QUERY_RESULT_FIELDS.length;
  const globals = [
    ["TRACE_RENDER_DEFAULT_MIN_VIEWPORT_SPAN", layoutDefaults.DEFAULT_MIN_VIEWPORT_SPAN.value],
    [
      "TRACE_RENDER_DEFAULT_UNKNOWN_AFFORDANCE_WIDTH",
      layoutDefaults.DEFAULT_UNKNOWN_AFFORDANCE_WIDTH.value,
    ],
    ["TRACE_RENDER_DEFAULT_UNKNOWN_STRIPE_SPACING", layoutDefaults.DEFAULT_UNKNOWN_STRIPE_SPACING.value],
    [
      "TRACE_RENDER_DEFAULT_INCOMPLETE_QUERY_STRIPE_SPACING",
      layoutDefaults.DEFAULT_INCOMPLETE_QUERY_STRIPE_SPACING.value,
    ],
    ["TRACE_RENDER_DEFAULT_LANE_HEIGHT", drawDefaults.DEFAULT_LANE_HEIGHT.value],
    ["TRACE_RENDER_DEFAULT_LANE_GAP", drawDefaults.DEFAULT_LANE_GAP.value],
    ["TRACE_RENDER_DEFAULT_TRACE_TOP", drawDefaults.DEFAULT_TRACE_TOP.value],
    ["TRACE_RENDER_DEFAULT_BAND_PADDING", drawDefaults.DEFAULT_BAND_PADDING.value],
    [
      "TRACE_RENDER_DEFAULT_PARTIAL_HATCH_SPACING",
      drawDefaults.DEFAULT_PARTIAL_HATCH_SPACING.value,
    ],
    ["TRACE_RENDER_OP_END", canvasOps.END_TAG.value],
    ["TRACE_RENDER_OP_QUERY_RANGE", canvasOps.QUERY_RANGE_TAG.value],
    ["TRACE_RENDER_OP_INCOMPLETE_QUERY_RANGE", canvasOps.INCOMPLETE_QUERY_RANGE_TAG.value],
    ["TRACE_RENDER_COMMAND_FILL_RECT", canvasOps.DRAW_FILL_RECT_TAG.value],
    ["TRACE_RENDER_COMMAND_STROKE_LINE", canvasOps.DRAW_STROKE_LINE_TAG.value],
    ["TRACE_RENDER_COMMAND_CLEAR_RECT", canvasOps.DRAW_CLEAR_RECT_TAG.value],
    ["TRACE_RENDER_COMMAND_HATCH_RECT", canvasOps.DRAW_HATCH_RECT_TAG.value],
    ["TRACE_RENDER_STYLE_ROLE", canvasOps.DRAW_STYLE_ROLE_KIND.value],
    ["TRACE_RENDER_STYLE_RGB", canvasOps.DRAW_STYLE_RGB_KIND.value],
    ["TRACE_RENDER_ROLE_BACKGROUND", canvasOps.DRAW_STYLE_ROLE_BACKGROUND.value],
    ["TRACE_RENDER_ROLE_DEFAULT_SLICE", canvasOps.DRAW_STYLE_ROLE_DEFAULT_SLICE.value],
    ["TRACE_RENDER_ROLE_PARTIAL_SLICE", canvasOps.DRAW_STYLE_ROLE_PARTIAL_SLICE.value],
    ["TRACE_RENDER_ROLE_PARTIAL_HATCH", canvasOps.DRAW_STYLE_ROLE_PARTIAL_HATCH.value],
    ["TRACE_RENDER_ROLE_UNKNOWN_FILL", canvasOps.DRAW_STYLE_ROLE_UNKNOWN_FILL.value],
    ["TRACE_RENDER_ROLE_UNKNOWN_STRIPE", canvasOps.DRAW_STYLE_ROLE_UNKNOWN_STRIPE.value],
    ["TRACE_RENDER_ROLE_INCOMPLETE_FILL", canvasOps.DRAW_STYLE_ROLE_INCOMPLETE_FILL.value],
    ["TRACE_RENDER_ROLE_INCOMPLETE_STRIPE", canvasOps.DRAW_STYLE_ROLE_INCOMPLETE_STRIPE.value],
    ["TRACE_RENDER_COMMAND_BYTES", canvasOps.DRAW_COMMAND_BYTES.value],
    ["TRACE_RENDER_COMMAND_TAG_OFFSET", canvasOps.DRAW_COMMAND_TAG_OFFSET.value],
    ["TRACE_RENDER_COMMAND_STYLE_KIND_OFFSET", canvasOps.DRAW_COMMAND_STYLE_KIND_OFFSET.value],
    ["TRACE_RENDER_COMMAND_STYLE_VALUE_OFFSET", canvasOps.DRAW_COMMAND_STYLE_VALUE_OFFSET.value],
    ["TRACE_RENDER_COMMAND_X_OFFSET", canvasOps.DRAW_COMMAND_X_OFFSET.value],
    ["TRACE_RENDER_COMMAND_Y_OFFSET", canvasOps.DRAW_COMMAND_Y_OFFSET.value],
    ["TRACE_RENDER_COMMAND_WIDTH_OFFSET", canvasOps.DRAW_COMMAND_WIDTH_OFFSET.value],
    ["TRACE_RENDER_COMMAND_HEIGHT_OFFSET", canvasOps.DRAW_COMMAND_HEIGHT_OFFSET.value],
    ["TRACE_RENDER_COMMAND_X2_OFFSET", canvasOps.DRAW_COMMAND_X2_OFFSET.value],
    ["TRACE_RENDER_COMMAND_Y2_OFFSET", canvasOps.DRAW_COMMAND_Y2_OFFSET.value],
    ["INDEX_QUERY_RESULT_BYTES", indexQueryResultBytes],
    ...layoutSpec.INDEX_QUERY_RESULT_FIELDS.map((field) => [
      `INDEX_QUERY_RESULT_${field.property.toUpperCase()}_OFFSET`,
      field.offset,
    ]),
    ["TRACE_RENDER_INCOMPLETE_RANGE_BYTES", incompleteRangeLayout.BYTES.value],
    ["TRACE_RENDER_INCOMPLETE_RANGE_START_OFFSET", incompleteRangeLayout.START.value],
    ["TRACE_RENDER_INCOMPLETE_RANGE_END_OFFSET", incompleteRangeLayout.END.value],
    ["TRACE_RENDER_INCOMPLETE_RANGE_TRACK_ID_OFFSET", incompleteRangeLayout.TRACK_ID.value],
  ];

  return globals.map(([name, value]) => watGlobal(name, value)).join("\n");
}

function renderTraceRendererWatAbi() {
  return [
    ";; Generated from abi/runtime.json and abi/layout.json by tools/generate-runtime-spec.js.",
    ";; Do not edit wat/trace-renderer-abi.wat.inc by hand.",
    traceRendererWatGlobals(),
    "",
  ].join("\n");
}

function renderTraceRendererLoaderBridge({ local }) {
  const keyword = local ? "const" : "export const";
  const bridge = spec.traceRenderer.loaderBridge;

  return [
    `${keyword} TRACE_RENDERER_LOADER_BRIDGE = Object.freeze({`,
    `  API_METHODS: Object.freeze(${JSON.stringify(bridge.apiMethods)}),`,
    `  STATUS_METHOD: ${JSON.stringify(bridge.statusMethod)},`,
    `  LOADING_STATUS_FIELD: ${JSON.stringify(bridge.loadingStatusField)},`,
    `  ERROR_STATUS_FIELD: ${JSON.stringify(bridge.errorStatusField)},`,
    "});",
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

function renderObjectConstant(groupName, value) {
  return `export const ${groupName} = Object.freeze(${JSON.stringify(value, null, 2)});`;
}

function renderStartupSpecModule() {
  const initColors = colorEntriesByScope("default", "init");
  const bootstrapTiming =
    Object.keys(spec.bootstrap).length === 0
      ? []
      : ["", renderNumberConstants("BOOTSTRAP_TIMING", spec.bootstrap)];

  return [
    [
      "// Generated from abi/runtime.json and abi/palette.json by tools/generate-runtime-spec.js.",
      "// Do not edit host/startup-spec.mjs by hand.",
    ].join("\n"),
    "",
    renderStringConstants("RUNTIME_URLS", spec.urls),
    "",
    renderStringConstants("APP_SHELL_COLORS", initColors),
    "",
    renderNumberConstants("BOOTSTRAP_WASM_MEMORY", spec.wasmMemory),
    ...bootstrapTiming,
    "",
    renderNumberConstants("RUNTIME_DEFAULTS", spec.runtimeDefaults),
    "",
    renderNumberConstants("INTERACTIVE_INGEST_CHECK", spec.interactiveIngestCheck),
    "",
    renderObjectConstant("RUNTIME_WORKER_ORCHESTRATION_CHECK", spec.runtimeWorkerOrchestrationCheck),
    "",
    renderObjectConstant("RUNTIME_BRIDGE", spec.runtimeBridge),
    "",
    renderNamedStrings("PERFORMANCE_MARKS", spec.performanceMarks),
    "",
    renderNamedStrings("PERFORMANCE_MEASURES", spec.performanceMeasures),
    "",
  ].join("\n");
}

function renderTraceRendererSpecModule() {
  const fullColors = colorEntriesByScope("default", "full");

  return [
    [
      "// Generated from abi/runtime.json, abi/layout.json, and abi/palette.json by tools/generate-runtime-spec.js.",
      "// Do not edit host/trace-renderer-spec.mjs by hand.",
    ].join("\n"),
    "",
    renderTraceRendererContractBlock({ local: false }),
    "",
    renderTraceRendererLoaderBridge({ local: false }),
    "",
    renderStringConstants("TRACE_RENDERER_COLORS", fullColors),
    "",
  ].join("\n");
}

function assertTraceRendererInlinePalette() {
  const rendererPath = join(root, "host/progressive-trace-renderer.mjs");
  const renderer = readFileSync(rendererPath, "utf8");
  const expected = renderLocalStringConstants(
    "TRACE_RENDERER_COLORS",
    colorEntriesByScope("default", "full"),
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

assertDuplicateNumericValuesAudited();
assertTraceRendererInlineContract();
assertTraceRendererInlinePalette();

const ok = [
  writeIfChanged("host/startup-spec.mjs", renderStartupSpecModule()),
  writeIfChanged("host/trace-renderer-spec.mjs", renderTraceRendererSpecModule()),
  writeIfChanged("wat/trace-renderer-abi.wat.inc", renderTraceRendererWatAbi()),
].every(Boolean);

if (!ok) {
  process.exitCode = 1;
}
