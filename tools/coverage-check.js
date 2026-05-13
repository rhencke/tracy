#!/usr/bin/env node

const { checkCoverageRoot } = require("./coverage-core.js");

function usage() {
  console.error("usage: coverage-check dist/wasm-cov");
}

async function main() {
  const [root] = process.argv.slice(2);

  if (!root) {
    usage();
    process.exitCode = 64;
    return;
  }

  const result = await checkCoverageRoot(root);

  for (const line of result.lines) {
    console.error(line);
  }

  if (result.failed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
