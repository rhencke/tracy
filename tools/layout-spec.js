const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const spec = JSON.parse(readFileSync(join(root, "abi/layout.json"), "utf8"));

function constantEntries() {
  const entries = [];
  for (const entry of spec.pageSizes) {
    entries.push(entry);
  }
  for (const region of spec.memoryRegions) {
    entries.push({
      name: region.baseConstant,
      value: region.base,
      hex: true,
      description: region.description,
    });
  }
  for (const region of spec.memoryRegions) {
    entries.push({
      name: region.sizeConstant,
      value: region.size,
      hex: true,
      description: `${region.label} byte length.`,
    });
  }
  for (const entry of spec.memoryBudgets) {
    entries.push(entry);
  }
  return entries;
}

function constantValue(name) {
  const entry = constantEntries().find((candidate) => candidate.name === name);
  if (entry === undefined) {
    throw new Error(`unknown layout constant ${name}`);
  }
  return entry.value;
}

function indexFieldEntries(sectionName) {
  const section = spec.index[sectionName];
  if (section === undefined || !Array.isArray(section.fields)) {
    throw new Error(`unknown index layout field section ${sectionName}`);
  }
  return section.fields;
}

function indexFieldValue(sectionName, name) {
  const entry = indexFieldEntries(sectionName).find((candidate) => candidate.name === name);
  if (entry === undefined) {
    throw new Error(`unknown index layout field ${sectionName}.${name}`);
  }
  return entry.value;
}

function indexConstantValue(sectionName, name) {
  const section = spec.index[sectionName];
  const entry = section?.[name];
  if (entry === undefined) {
    throw new Error(`unknown index layout constant ${sectionName}.${name}`);
  }
  return entry.value;
}

function coldReloadPerformanceBudgetValue(name) {
  const entry = spec.coldReload?.performanceBudgets?.[name];
  if (entry === undefined) {
    throw new Error(`unknown cold-reload performance budget ${name}`);
  }
  return entry.value;
}

module.exports = {
  spec,
  constantEntries,
  constantValue,
  COLD_RELOAD_MIN_BUDGET_MS: coldReloadPerformanceBudgetValue(
    "COLD_RELOAD_MIN_BUDGET_MS",
  ),
  COLD_RELOAD_TARGET_BUDGET_MS: coldReloadPerformanceBudgetValue(
    "COLD_RELOAD_TARGET_BUDGET_MS",
  ),
  COLD_RELOAD_TARGET_TRACE_BYTES: coldReloadPerformanceBudgetValue(
    "COLD_RELOAD_TARGET_TRACE_BYTES",
  ),
  OPFS_PAGE_SIZE: constantValue("OPFS_PAGE_SIZE"),
  WASM_PAGE_SIZE: constantValue("WASM_PAGE_SIZE"),
  TOKEN_RECORD_BYTES: spec.parser.TOKEN_RECORD_BYTES.value,
  INDEX_TARGET_ENCODED_BYTES_PER_EVENT:
    spec.index.INDEX_TARGET_ENCODED_BYTES_PER_EVENT.value,
  INDEX_COLUMN_ENTRY_BYTES: indexConstantValue("directory", "INDEX_COLUMN_ENTRY_BYTES"),
  INDEX_COLUMN_ENTRY_BYTE_LENGTH_OFFSET: indexFieldValue(
    "directory",
    "INDEX_COLUMN_ENTRY_BYTE_LENGTH_OFFSET",
  ),
  INDEX_DECODE_HINT_TRACK_ID_SHIFT: indexConstantValue(
    "decodeHints",
    "INDEX_DECODE_HINT_TRACK_ID_SHIFT",
  ),
  INDEX_DIRECTORY_BYTES_OFFSET: indexFieldValue("directory", "INDEX_DIRECTORY_BYTES_OFFSET"),
  INDEX_DIRECTORY_COLUMN_COUNT_OFFSET: indexFieldValue(
    "directory",
    "INDEX_DIRECTORY_COLUMN_COUNT_OFFSET",
  ),
  INDEX_DIRECTORY_FIRST_ENTRY_OFFSET: indexFieldValue(
    "directory",
    "INDEX_DIRECTORY_FIRST_ENTRY_OFFSET",
  ),
  INDEX_PAGE_HEADER_BUCKET_END_OFFSET: indexFieldValue(
    "pageHeader",
    "INDEX_PAGE_HEADER_BUCKET_END_OFFSET",
  ),
  INDEX_PAGE_HEADER_BUCKET_START_OFFSET: indexFieldValue(
    "pageHeader",
    "INDEX_PAGE_HEADER_BUCKET_START_OFFSET",
  ),
  INDEX_PAGE_HEADER_DECODE_HINTS_OFFSET: indexFieldValue(
    "pageHeader",
    "INDEX_PAGE_HEADER_DECODE_HINTS_OFFSET",
  ),
  INDEX_PAGE_HEADER_RECORD_COUNT_OFFSET: indexFieldValue(
    "pageHeader",
    "INDEX_PAGE_HEADER_RECORD_COUNT_OFFSET",
  ),
  INDEX_QUERY_RESULT_FIELD_BYTES: indexConstantValue(
    "queryResult",
    "INDEX_QUERY_RESULT_FIELD_BYTES",
  ),
  INDEX_QUERY_RESULT_FIELDS: indexFieldEntries("queryResult").map((entry) => ({
    name: entry.name,
    property: entry.property,
    offset: entry.value,
  })),
};
