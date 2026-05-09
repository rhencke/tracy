#!/usr/bin/env node

const { readFileSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");

const root = dirname(__dirname);
const checkOnly = process.argv.includes("--check");
const sourcePath = join(root, "abi/host.json");
const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const constants = source.constants;
const imports = source.hostImports;
const importsByName = new Map(imports.map((entry) => [entry.name, entry]));

function hex(value) {
  return `0x${value.toString(16).toUpperCase().padStart(8, "0")}`;
}

function formatValue(entry) {
  return entry.hex ? hex(entry.value) : String(entry.value);
}

function watImport(entry) {
  const params =
    entry.params.length === 0 ? "" : ` (param ${entry.params.join(" ")})`;
  const result = entry.result === null ? "" : ` (result ${entry.result})`;

  return `  (import "host" "${entry.name}" (func $${entry.name}${params}${result}))`;
}

function generatedHeader(kind) {
  return [
    `// Generated from abi/host.json by tools/generate-host-abi.js.`,
    `// Do not edit ${kind} by hand.`,
  ].join("\n");
}

function readonlyArray(values) {
  return `Object.freeze([${values.map((value) => JSON.stringify(value)).join(", ")}])`;
}

function renderFrozenValue(value, indent = "") {
  if (Array.isArray(value)) {
    return readonlyArray(value);
  }

  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return "Object.freeze({})";
    }

    const lines = ["Object.freeze({"];
    const childIndent = `${indent}  `;
    for (const [key, child] of entries) {
      lines.push(`${childIndent}${key}: ${renderFrozenValue(child, childIndent)},`);
    }
    lines.push(`${indent}})`);
    return lines.join("\n");
  }

  return JSON.stringify(value);
}

function importConstantName(name) {
  return name.toUpperCase();
}

function renderHostAbiModule() {
  const lines = [generatedHeader("host/abi.mjs"), ""];

  for (const entry of constants) {
    lines.push(`export const ${entry.name} = ${formatValue(entry)};`);
  }

  lines.push(
    "",
    `export const HOST_ASYNC_IMPORTS = ${readonlyArray(
      imports.filter((entry) => entry.async).map((entry) => entry.name),
    )};`,
    "",
    "export const HOST_IMPORT_NAME = Object.freeze({",
  );

  for (const entry of imports) {
    lines.push(`  ${importConstantName(entry.name)}: ${JSON.stringify(entry.name)},`);
  }

  lines.push(
    "});",
    "",
    "export const HOST_IMPORTS = Object.freeze([",
  );

  for (const entry of imports) {
    lines.push(
      "  Object.freeze({",
      `    name: ${JSON.stringify(entry.name)},`,
      `    params: ${readonlyArray(entry.params)},`,
      `    result: ${JSON.stringify(entry.result)},`,
      `    async: ${entry.async},`,
      "  }),",
    );
  }

  lines.push("]);", "");
  lines.push(`export const OPFS_BRIDGE_CONTRACT = ${renderFrozenValue(source.opfsBridge)};`, "");
  return lines.join("\n");
}

function renderWatBlock(setName) {
  const names = source.watImportSets[setName];
  return names.map((name) => watImport(importsByName.get(name))).join("\n");
}

function replaceGeneratedBlock(text, start, end, body) {
  const startIndex = text.indexOf(start);
  const endIndex = text.indexOf(end);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`missing generated block ${start} ${end}`);
  }

  const bodyStart = startIndex + start.length;
  return `${text.slice(0, bodyStart)}\n${body}\n${text.slice(endIndex)}`;
}

function renderDocs() {
  const lines = [
    "# Host ABI",
    "",
    "Generated from `abi/host.json` by `tools/generate-host-abi.js`.",
    "Do not edit generated ABI values by hand.",
    "",
    "## Host Imports",
    "",
    "| Name | Params | Result | Async |",
    "|---|---|---|---|",
  ];

  for (const entry of imports) {
    lines.push(
      `| \`${entry.name}\` | ${entry.params.length === 0 ? "" : entry.params.map((param) => `\`${param}\``).join(", ")} | ${entry.result === null ? "" : `\`${entry.result}\``} | ${entry.async ? "yes" : "no"} |`,
    );
  }

  lines.push(
    "",
    "## Host Constants",
    "",
    "| Constant | Value | Description |",
    "|---|---:|---|",
  );

  for (const entry of constants) {
    lines.push(`| \`${entry.name}\` | \`${formatValue(entry)}\` | ${entry.description} |`);
  }

  lines.push(
    "",
    "## OPFS Bridge Contract",
    "",
    "Generated from `abi/host.json`. JavaScript owns only browser OPFS/File API",
    "mechanics; import grouping, bridge markers, unsupported worker capabilities,",
    "and generated source-name shape live in this shared contract.",
    "",
    `- Main OPFS index size marker: \`${source.opfsBridge.indexSizeMayBeStaleMarker}\``,
    `- Worker file-handle unsupported reason: \`${source.opfsBridge.workerUnsupportedFileReason}\``,
    `- File source name shape: \`${source.opfsBridge.fileSourceName.prefix}<base36-time>${source.opfsBridge.fileSourceName.separator}<source-id>${source.opfsBridge.fileSourceName.suffix}\``,
  );

  lines.push("");
  return lines.join("\n");
}

function renderMemorySection() {
  const value = (name) => constants.find((entry) => entry.name === name).value;
  const named = (name) => constants.find((entry) => entry.name === name);
  const lines = [
    "### Generated host scratch ABI",
    "",
    "This section is generated from `abi/host.json` by `tools/generate-host-abi.js`.",
    "The same source also generates JavaScript host constants and WAT host import declarations.",
    "",
    "The browser host shim owns the first page of `MEM_SCRATCH_BASE` for v0.1",
    "browser input state.  Wasm may read these bytes during `tracy_tick`; no wasm",
    "module may allocate from or overwrite this range.  The app may clear the rest",
    "of scratch every tick, but it must preserve the host range below.",
    "",
    "Multi-byte fields are little-endian.",
    "",
    "Canvas sizes are physical pixels: `floor(canvas.clientWidth * devicePixelRatio)`",
    "and `floor(canvas.clientHeight * devicePixelRatio)`, clamped to at least `1`.",
    "The packed canvas size returned by `canvas_get_size()` is a 64-bit value with",
    "width in bits `0..31` and height in bits `32..63`.",
    "",
    "| Offset | Constant | Size | Field |",
    "|---:|---|---:|---|",
    `| \`${hex(value("HOST_CANVAS_SIZE_OFFSET"))}\` | \`HOST_CANVAS_SIZE_OFFSET\` | 4 | Canvas width, \`u32\`. |`,
    `| \`${hex(value("HOST_CANVAS_HEIGHT_OFFSET"))}\` | \`HOST_CANVAS_HEIGHT_OFFSET\` | 4 | Canvas height, \`u32\`. |`,
    `| \`${hex(value("HOST_CANVAS_RESIZE_SEQ_OFFSET"))}\` | \`HOST_CANVAS_RESIZE_SEQ_OFFSET\` | 4 | Incremented after each resize write. |`,
    "| `0x0000000C..0x0000003F` | | 52 | Reserved, zero for v0.1. |",
    `| \`${hex(value("HOST_POINTER_RING_OFFSET"))}\` | \`HOST_POINTER_RING_OFFSET\` | ${value("HOST_POINTER_RING_HEADER_BYTES")} | Pointer ring header. |`,
    `| \`${hex(value("HOST_POINTER_RECORDS_OFFSET"))}\` | \`HOST_POINTER_RECORDS_OFFSET\` | ${value("HOST_POINTER_RECORDS_BYTES")} | Pointer event records. |`,
    "| `0x00002060..0x0000FFFF` | | 57248 | Reserved for future host scratch fields. |",
    "",
    "The resize observer writes width and height first, then increments",
    "`HOST_CANVAS_RESIZE_SEQ_OFFSET`.  Readers that need a stable pair should read",
    "the sequence before and after the size fields and retry when it changes.",
    "",
    "### Pointer ring",
    "",
    "`pointer_listen()` appends fixed-width records to a circular ring in host",
    `scratch memory.  The ring capacity is ${value("HOST_POINTER_RECORD_CAPACITY")} records, and each record is ${value("HOST_POINTER_RECORD_SIZE")}`,
    "bytes.  When the ring is full, the host drops the newest event and increments",
    "the dropped counter; wasm advances the read index as it consumes records.",
    "",
    "The ring header at `HOST_POINTER_RING_OFFSET` is:",
    "",
    "| Header offset | Size | Field |",
    "|---:|---:|---|",
    "| 0 | 4 | `read_index`, `u32`, written by wasm. |",
    "| 4 | 4 | `write_index`, `u32`, written by the host. |",
    "| 8 | 4 | `count`, `u32`, number of unread records. |",
    "| 12 | 4 | `dropped`, `u32`, count of events dropped because the ring was full. |",
    `| 16 | 4 | \`capacity\`, \`u32\`, always \`${value("HOST_POINTER_RECORD_CAPACITY")}\` for v0.1. |`,
    `| 20 | 4 | \`record_size\`, \`u32\`, always \`${value("HOST_POINTER_RECORD_SIZE")}\` for v0.1. |`,
    "| 24 | 8 | Reserved, zero for v0.1. |",
    "",
    "Each pointer record is:",
    "",
    "| Record offset | Size | Type | Field |",
    "|---:|---:|---|---|",
    "| 0 | 1 | `u8` | Kind: `1` down, `2` move, `3` up, `4` cancel. |",
    "| 1 | 3 | | Padding, zero. |",
    "| 4 | 4 | `u32` | `pointerId`. |",
    "| 8 | 4 | `f32` | Canvas-local x in CSS pixels. |",
    "| 12 | 4 | `f32` | Canvas-local y in CSS pixels. |",
    "| 16 | 8 | `f64` | DOM event timestamp. |",
    "| 24 | 4 | `f32` | Pressure, or `0` when unavailable. |",
    "| 28 | 4 | `u32` | Modifier bitset. |",
    "",
    "Modifier bits are:",
    "",
    "| Bit | Constant | Meaning |",
    "|---:|---|---|",
  ];

  for (const entry of constants.filter((constant) => constant.name.startsWith("HOST_POINTER_MOD_"))) {
    lines.push(`| \`${formatValue(entry)}\` | \`${entry.name}\` | ${entry.description} |`);
  }

  lines.push(
    "",
    "Host import names, signatures, and async/sync status are generated in",
    "[HOST_ABI.md](HOST_ABI.md).",
  );

  return lines.join("\n");
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
    console.error(`${path} is out of date; run node tools/generate-host-abi.js`);
    return false;
  }

  writeFileSync(absolute, content);
  return true;
}

function updateMarkedFile(path, replacements) {
  const absolute = join(root, path);
  let text = readFileSync(absolute, "utf8");

  for (const replacement of replacements) {
    text = replaceGeneratedBlock(text, replacement.start, replacement.end, replacement.body);
  }

  return writeIfChanged(path, text);
}

const ok = [
  writeIfChanged("host/abi.mjs", renderHostAbiModule()),
  writeIfChanged("HOST_ABI.md", renderDocs()),
  updateMarkedFile("wat/app.wat", [
    {
      start: "  ;; @generated host-imports app:start",
      end: "  ;; @generated host-imports app:end",
      body: renderWatBlock("app"),
    },
  ]),
  updateMarkedFile("wat/app.test.wat", [
    {
      start: "  ;; @generated host-imports app:start",
      end: "  ;; @generated host-imports app:end",
      body: renderWatBlock("app"),
    },
  ]),
  updateMarkedFile("wat/parser.wat", [
    {
      start: "  ;; @generated host-imports parser:start",
      end: "  ;; @generated host-imports parser:end",
      body: renderWatBlock("parser"),
    },
  ]),
  updateMarkedFile("MEMORY.md", [
    {
      start: "<!-- @generated host-abi:start -->",
      end: "<!-- @generated host-abi:end -->",
      body: renderMemorySection(),
    },
  ]),
].every(Boolean);

if (!ok) {
  process.exitCode = 1;
}
