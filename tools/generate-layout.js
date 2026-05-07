#!/usr/bin/env node

const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { assertLayoutSpec, constantEntries, spec } = require("./layout-spec.js");

const root = join(__dirname, "..");
const checkOnly = process.argv.includes("--check");

assertLayoutSpec();

function hex(value) {
  return `0x${value.toString(16).toUpperCase().padStart(8, "0")}`;
}

function watValue(entry) {
  return entry.hex ? hex(entry.value) : String(entry.value);
}

function formatValue(entry) {
  return entry.hex ? hex(entry.value) : String(entry.value);
}

function mib(value) {
  return `${value / (1024 * 1024)} MiB`;
}

function byteRange(base, size) {
  return `${hex(base)}..${hex(base + size - 1)}`;
}

function generatedHeader(kind) {
  return [
    `;; Generated from abi/layout.json by tools/generate-layout.js.`,
    `;; Do not edit ${kind} by hand.`,
  ].join("\n");
}

function renderMemWat() {
  const lines = ["(module", "  ;; @thread shared"];
  for (const entry of constantEntries()) {
    lines.push(
      `  (global $${entry.name} (export "${entry.name}") i32 (i32.const ${watValue(entry)}))`,
    );
  }
  lines.push(")");
  return `${generatedHeader("wat/std/mem.wat")}\n${lines.join("\n")}\n`;
}

function renderMemTest() {
  let assertionId = 1;
  const lines = [
    generatedHeader("wat/std/mem.test.wat"),
    "(module",
    "  (import \"env\" \"memory\" (memory $memory 1))",
    "  (import \"watwat\" \"assert_eq_i32\"",
    "    (func $assert_eq_i32 (param i32) (param i32) (param i32)))",
  ];

  for (const entry of constantEntries()) {
    lines.push(`  (import "mem" "${entry.name}" (global $${entry.name} i32))`);
  }

  lines.push(
    "",
    "  (data (i32.const 1024) \"mem test failed\")",
    "",
    "  (func (export \"message_for\") (param $code i32) (result i32 i32)",
    "    i32.const 1024",
    "    i32.const 15",
    "  )",
  );

  function emitTest(name, entries) {
    lines.push("", `  (func (export "${name}")`);
    for (const entry of entries) {
      lines.push(
        `    global.get $${entry.name}`,
        `    i32.const ${watValue(entry)}`,
        `    i32.const ${assertionId}`,
        "    call $assert_eq_i32",
        "",
      );
      assertionId += 1;
    }
    if (entries.length > 0) {
      lines.pop();
    }
    lines.push("  )");
  }

  emitTest("test_page_sizes", spec.pageSizes);
  emitTest(
    "test_region_bases",
    spec.memoryRegions.map((region) => ({
      name: region.baseConstant,
      value: region.base,
      hex: true,
    })),
  );
  emitTest(
    "test_region_sizes",
    spec.memoryRegions.map((region) => ({
      name: region.sizeConstant,
      value: region.size,
      hex: true,
    })),
  );
  emitTest("test_memory_budget", spec.memoryBudgets);

  lines.push(")");
  return `${lines.join("\n")}\n`;
}

function renderMemoryLayoutSection() {
  const initialBytes = spec.memoryBudgets.find((entry) => entry.name === "MEM_INITIAL_BYTES");
  const initialPages = spec.memoryBudgets.find((entry) => entry.name === "MEM_INITIAL_PAGES");
  const workingPages = spec.memoryBudgets.find(
    (entry) => entry.name === "MEM_WORKING_TARGET_PAGES",
  );
  const ceilingPages = spec.memoryBudgets.find((entry) => entry.name === "MEM_HEAP_CEILING_PAGES");
  const workingBytes = spec.memoryBudgets.find(
    (entry) => entry.name === "MEM_WORKING_TARGET_BYTES",
  );
  const ceilingBytes = spec.memoryBudgets.find((entry) => entry.name === "MEM_HEAP_CEILING_BYTES");
  const total = spec.memoryRegions.reduce((sum, region) => sum + region.size, 0);
  const lines = [
    "## Region map",
    "",
    "Generated from `abi/layout.json` by `tools/generate-layout.js`.",
    "Do not edit generated layout values by hand.",
    "",
    "| Region | Constant | Byte range | Size | Owner | Growth policy | Notes |",
    "|---|---:|---:|---:|---|---|---|",
  ];

  for (const region of spec.memoryRegions) {
    lines.push(
      `| ${region.label} | \`${region.baseConstant}\` | \`${byteRange(region.base, region.size)}\` | ${mib(region.size)} | ${region.owner} | ${region.growthPolicy} | ${region.notes} |`,
    );
  }

  lines.push(
    `| **Total planned heap** | | \`${byteRange(0, total)}\` | **${mib(total)}** | | | Leaves about 83 MiB within the 600 MiB working target, plus headroom for Canvas2D backing and JS bootstrap under the 1 GiB ceiling. |`,
    "",
    `The minimum initial memory for the v0.1 layout is ${initialPages.value.toLocaleString()} wasm pages`,
    `(\`${formatValue(initialBytes)}\` bytes).  The ${mib(workingBytes.value)} working target is ${workingPages.value.toLocaleString()} wasm pages,`,
    `and the ${mib(ceilingBytes.value)} heap ceiling is ${ceilingPages.value.toLocaleString()} wasm pages.  Region bases are`,
    "MiB-aligned so `OPFS_PAGE_SIZE` pages never straddle two regions.",
    "",
    "## Constants",
    "",
    "The shared constants are exported by `wat/std/mem.wat` and generated from",
    "`abi/layout.json` so design docs and module code use the same names.",
    "",
    "| Constant | Value | Meaning |",
    "|---|---:|---|",
  );

  for (const entry of constantEntries()) {
    lines.push(`| \`${entry.name}\` | \`${formatValue(entry)}\` | ${entry.description} |`);
  }

  lines.push(
    `| \`TOKEN_RECORD_BYTES\` | \`${spec.parser.TOKEN_RECORD_BYTES.value}\` | ${spec.parser.TOKEN_RECORD_BYTES.description} |`,
  );

  for (const [name, entry] of Object.entries(spec.coldReload.performanceBudgets)) {
    lines.push(`| \`${name}\` | \`${formatValue(entry)}\` | ${entry.description} |`);
  }

  lines.push(
    `| \`INDEX_TARGET_ENCODED_BYTES_PER_EVENT\` | \`${spec.index.INDEX_TARGET_ENCODED_BYTES_PER_EVENT.value}\` | ${spec.index.INDEX_TARGET_ENCODED_BYTES_PER_EVENT.description} |`,
    `| \`INDEX_COLUMN_ENTRY_BYTES\` | \`${spec.index.directory.INDEX_COLUMN_ENTRY_BYTES.value}\` | ${spec.index.directory.INDEX_COLUMN_ENTRY_BYTES.description} |`,
    `| \`INDEX_QUERY_RESULT_FIELD_BYTES\` | \`${spec.index.queryResult.INDEX_QUERY_RESULT_FIELD_BYTES.value}\` | ${spec.index.queryResult.INDEX_QUERY_RESULT_FIELD_BYTES.description} |`,
  );

  for (const [name, entry] of Object.entries(spec.index.decodeHints)) {
    lines.push(`| \`${name}\` | \`${formatValue(entry)}\` | ${entry.description} |`);
  }

  for (const section of [spec.index.pageHeader, spec.index.directory, spec.index.queryResult]) {
    for (const entry of section.fields) {
      lines.push(`| \`${entry.name}\` | \`${entry.value}\` | ${entry.description} |`);
    }
  }

  lines.push(
    "",
    "Index page header, directory, and query-result offsets are part of the",
    "generated layout spec so cold-reload parity checks and binary readers use",
    "documented names rather than ad hoc byte arithmetic.",
    "",
    "Cold-reload performance budgets are also spec values so CI checks scale",
    "small generated fixtures against the same documented v0.1 target.",
    "",
    "`MEM_STACK_BASE`, region sizes, page size constants, and end addresses may",
    "also be exported for convenience, but the base constants above are the",
    "cross-module ABI surface required by v0.1.",
  );

  return lines.join("\n");
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

function writeIfChanged(path, content) {
  const absolute = join(root, path);
  const previous = readFileSync(absolute, "utf8");

  if (previous === content) {
    return true;
  }

  if (checkOnly) {
    console.error(`${path} is out of date; run node tools/generate-layout.js`);
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
  writeIfChanged("wat/std/mem.wat", renderMemWat()),
  writeIfChanged("wat/std/mem.test.wat", renderMemTest()),
  updateMarkedFile("MEMORY.md", [
    {
      start: "<!-- @generated layout:start -->",
      end: "<!-- @generated layout:end -->",
      body: renderMemoryLayoutSection(),
    },
  ]),
].every(Boolean);

if (!ok) {
  process.exitCode = 1;
}
