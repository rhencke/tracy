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

module.exports = {
  spec,
  constantEntries,
  constantValue,
  OPFS_PAGE_SIZE: constantValue("OPFS_PAGE_SIZE"),
  WASM_PAGE_SIZE: constantValue("WASM_PAGE_SIZE"),
  TOKEN_RECORD_BYTES: spec.parser.TOKEN_RECORD_BYTES.value,
  INDEX_TARGET_ENCODED_BYTES_PER_EVENT:
    spec.index.INDEX_TARGET_ENCODED_BYTES_PER_EVENT.value,
};
