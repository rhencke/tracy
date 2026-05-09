#!/usr/bin/env node

const { readFileSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");

const root = dirname(__dirname);
const checkOnly = process.argv.includes("--check");
const sourcePath = join(root, "abi/parser-state.json");
const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const constants = source.constants;
const fields = source.fields;
const enumGroups = source.enums;
const enums = Object.fromEntries(enumGroups.map((entry) => [entry.name, entry]));
const enumConstants = enumGroups.flatMap((entry) => entry.constants);
const allConstants = [
  ...constants,
  ...fields.map((field) => ({
    name: field.name,
    value: field.offset,
    description: field.field,
  })),
  ...enumConstants,
];
const constantsByName = new Map(allConstants.map((entry) => [entry.name, entry]));

function watValue(entry) {
  return entry.wat ?? String(entry.value);
}

function globalLine(entry) {
  return `  (global $${entry.name} (export "${entry.name}") i32 (i32.const ${watValue(entry)}))`;
}

function importLine(name) {
  return `  (import "parser_state" "${name}" (global $${name} i32))`;
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

function renderGlobalBlock() {
  const lines = [
    ...constants.map(globalLine),
    "",
    ...fields
      .filter((field) => !field.name.includes("RESERVED"))
      .map((field) => globalLine({ name: field.name, value: field.offset })),
    "",
  ];

  for (const group of enumGroups) {
    lines.push(...group.constants.map(globalLine), "");
  }

  lines.pop();
  return lines.join("\n");
}

function renderImportBlock(setName) {
  return source.importSets[setName].map(importLine).join("\n");
}

function assertEqI32(entry, code) {
  return [
    `    global.get $${entry.name}`,
    `    i32.const ${watValue(entry)}`,
    `    i32.const ${code}`,
    "    call $assert_eq_i32",
  ].join("\n");
}

function renderAssertions(entries, startCode) {
  const lines = [];
  let code = startCode;

  for (const entry of entries) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(assertEqI32(entry, code));
    code += 1;
  }

  return lines.join("\n");
}

function renderLayoutAssertions() {
  return renderAssertions(
    [
      ...constants,
      ...fields
        .filter((field) => !field.name.includes("RESERVED"))
        .map((field) => ({ name: field.name, value: field.offset })),
    ],
    1,
  );
}

function renderEnumAssertions() {
  return renderAssertions(enumConstants, 70);
}

function renderEnumList(entries) {
  return entries.map((entry) => `- \`${entry.name} = ${entry.value}\`: ${entry.description}`).join("\n");
}

function renderMemorySection() {
  const value = (name) => constantsByName.get(name).value;
  const status = enums["parser status"].constants;
  const token = enums["partial token kind"].constants;
  const dfa = enums["tokenizer DFA state"].constants;
  const outputToken = enums["tokenizer output token kind"].constants;
  const stack = enums["stack entry kind"].constants;
  const event = enums["event field id"].constants;
  const lines = [
    "## Parser resume state ABI",
    "",
    "This section is generated from `abi/parser-state.json` by",
    "`tools/generate-parser-state-abi.js`.  The same source generates WAT",
    "parser-state constants/imports and test assertions.",
    "",
    `The streaming JSON parser state is a fixed ${value("PARSER_STATE_BYTES")}-byte little-endian record.`,
    "It may be stored anywhere the caller owns memory, then serialized byte-for-byte",
    "to OPFS for crash/reload recovery.  Pointers are deliberately excluded from",
    "the record; every location is an offset, id, enum, count, or inline byte span",
    "that remains meaningful after reload.",
    "",
    "The parser state format is versioned by `PARSER_STATE_MAGIC` (`TRPJ`) and",
    `\`PARSER_STATE_VERSION\` (\`${value("PARSER_STATE_VERSION")}\`).  A parser must reject resume records whose magic`,
    "or version do not match, and return `PARSER_STATUS_STATE_INVALID` rather than",
    "guessing how to interpret old bytes.",
    "",
    `The default yield budget is \`PARSER_DEFAULT_YIELD_BUDGET_MS = ${value("PARSER_DEFAULT_YIELD_BUDGET_MS")}\`.  Callers may`,
    "lower or raise `yield_budget_ms`, but the default stays at or below 8 ms so the",
    "JSPI-fallback profile yields before a long single-threaded turn risks starving",
    "the page.",
    "",
    "### Parser state layout",
    "",
    "| Offset | Size | Field |",
    "|---:|---:|---|",
  ];

  for (const field of fields) {
    lines.push(`| ${field.offset} | ${field.size} | ${field.field} |`);
  }

  lines.push(
    "",
    `The inline stack capacity is \`PARSER_STACK_CAP = ${value("PARSER_STACK_CAP")}\`.  Stack entries are`,
    "`PARSER_STACK_ARRAY = 1` or `PARSER_STACK_OBJECT = 2`; unused bytes are zero.",
    "Deeper input is malformed for v0.1 and should fail closed instead of spilling",
    "stack state into another allocation.",
    "",
    `The partial-token buffer capacity is \`PARSER_PARTIAL_TOKEN_CAP = ${value("PARSER_PARTIAL_TOKEN_CAP")}\`.  It is`,
    "used only for tokens that cross chunk or yield boundaries, such as string",
    "bytes, escaped string substates, number text, and literal text.  A token that",
    "cannot fit in the buffer must be rejected or routed through a later explicit",
    "large-token path; the resume record must never contain a borrowed pointer into",
    "the ring.",
    "",
    `Tokenizer output records are fixed-width \`PARSER_TOKEN_RECORD_BYTES = ${value("PARSER_TOKEN_RECORD_BYTES")}\``,
    "byte records: token kind, payload pointer, and payload length.  The resume",
    "record stores output cursors as offsets, record counts, and capacities; it",
    "never stores the caller's output buffer pointer, so crash recovery does not",
    "depend on a stale borrowed pointer.",
    `The default streaming turn capacity is \`PARSER_DEFAULT_OUTPUT_RECORD_CAP = ${value("PARSER_DEFAULT_OUTPUT_RECORD_CAP")}\`;`,
    "hosts should use that parser ABI value when releasing output after a yield",
    "instead of copying the cap into JavaScript policy.",
    "",
    "### Parser status and field enums",
    "",
    "Parser statuses are:",
    "",
    renderEnumList(status),
    "",
    "Partial token kinds are:",
    "",
    renderEnumList(token),
    "",
    "Tokenizer DFA states are:",
    "",
    renderEnumList(dfa),
    "",
    "Tokenizer output token kinds are:",
    "",
    renderEnumList(outputToken),
    "",
    "Stack entry kinds are:",
    "",
    renderEnumList(stack),
    "",
    "Event field ids are:",
    "",
    renderEnumList(event),
    "",
    "The current field and seen-field bitmask let the parser yield in the middle",
    "of one event object without losing which output column the next token belongs to.",
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
    console.error(`${path} is out of date; run node tools/generate-parser-state-abi.js`);
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
  updateMarkedFile("wat/parser_state.wat", [
    {
      start: "  ;; @generated parser-state-globals:start",
      end: "  ;; @generated parser-state-globals:end",
      body: renderGlobalBlock(),
    },
  ]),
  updateMarkedFile("wat/parser.wat", [
    {
      start: "  ;; @generated parser-state-imports parser:start",
      end: "  ;; @generated parser-state-imports parser:end",
      body: renderImportBlock("parser"),
    },
  ]),
  updateMarkedFile("wat/parser.test.wat", [
    {
      start: "  ;; @generated parser-state-imports parser-test:start",
      end: "  ;; @generated parser-state-imports parser-test:end",
      body: renderImportBlock("parserTest"),
    },
  ]),
  updateMarkedFile("wat/parser_state.test.wat", [
    {
      start: "  ;; @generated parser-state-imports parser-state-test:start",
      end: "  ;; @generated parser-state-imports parser-state-test:end",
      body: renderImportBlock("parserStateTest"),
    },
    {
      start: "    ;; @generated parser-state-layout-assertions:start",
      end: "    ;; @generated parser-state-layout-assertions:end",
      body: renderLayoutAssertions(),
    },
    {
      start: "    ;; @generated parser-state-enum-assertions:start",
      end: "    ;; @generated parser-state-enum-assertions:end",
      body: renderEnumAssertions(),
    },
  ]),
  updateMarkedFile("MEMORY.md", [
    {
      start: "<!-- @generated parser-state-abi:start -->",
      end: "<!-- @generated parser-state-abi:end -->",
      body: renderMemorySection(),
    },
  ]),
].every(Boolean);

if (!ok) {
  process.exitCode = 1;
}
