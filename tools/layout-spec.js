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

function memoryBudgetValue(name) {
  const entry = spec.memoryBudgets.find((candidate) => candidate.name === name);
  if (entry === undefined) {
    throw new Error(`unknown memory budget ${name}`);
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

function layoutInvariantErrors() {
  const errors = [];
  const wasmPageSize = constantValue("WASM_PAGE_SIZE");
  const opfsPageSize = constantValue("OPFS_PAGE_SIZE");
  const initialBytes = memoryBudgetValue("MEM_INITIAL_BYTES");
  const initialPages = memoryBudgetValue("MEM_INITIAL_PAGES");
  const workingBytes = memoryBudgetValue("MEM_WORKING_TARGET_BYTES");
  const workingPages = memoryBudgetValue("MEM_WORKING_TARGET_PAGES");
  const ceilingBytes = memoryBudgetValue("MEM_HEAP_CEILING_BYTES");
  const ceilingPages = memoryBudgetValue("MEM_HEAP_CEILING_PAGES");

  if (initialPages * wasmPageSize !== initialBytes) {
    errors.push("MEM_INITIAL_PAGES does not match MEM_INITIAL_BYTES");
  }
  if (workingPages * wasmPageSize !== workingBytes) {
    errors.push("MEM_WORKING_TARGET_PAGES does not match MEM_WORKING_TARGET_BYTES");
  }
  if (ceilingPages * wasmPageSize !== ceilingBytes) {
    errors.push("MEM_HEAP_CEILING_PAGES does not match MEM_HEAP_CEILING_BYTES");
  }
  if (initialBytes > workingBytes) {
    errors.push("MEM_INITIAL_BYTES exceeds MEM_WORKING_TARGET_BYTES");
  }
  if (workingBytes > ceilingBytes) {
    errors.push("MEM_WORKING_TARGET_BYTES exceeds MEM_HEAP_CEILING_BYTES");
  }

  let cursor = 0;
  let previousBase = -1;
  for (const region of spec.memoryRegions) {
    const { label, base, size } = region;
    if (!Number.isInteger(base) || base < 0) {
      errors.push(`${label} has invalid base ${base}`);
    }
    if (!Number.isInteger(size) || size <= 0) {
      errors.push(`${label} has invalid size ${size}`);
    }
    if (base < previousBase) {
      errors.push(`${label} is out of ascending base order`);
    }
    if (base < cursor) {
      errors.push(`${label} overlaps the previous memory region`);
    }
    if (base > cursor) {
      errors.push(`${label} leaves unexpected gap ${cursor}..${base - 1}`);
    }
    if (base % opfsPageSize !== 0) {
      errors.push(`${label} base is not OPFS-page aligned`);
    }
    if (size % opfsPageSize !== 0) {
      errors.push(`${label} size is not OPFS-page aligned`);
    }
    cursor = base + size;
    previousBase = base;
  }

  if (cursor !== initialBytes) {
    errors.push("memory regions do not exactly fill MEM_INITIAL_BYTES");
  }
  if (cursor > workingBytes) {
    errors.push("memory regions exceed MEM_WORKING_TARGET_BYTES");
  }

  return errors;
}

function assertLayoutSpec() {
  const errors = layoutInvariantErrors();
  if (errors.length > 0) {
    throw new Error(
      `layout spec invariant failure:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
  }
}

module.exports = {
  spec,
  assertLayoutSpec,
  constantEntries,
  constantValue,
  layoutInvariantErrors,
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
