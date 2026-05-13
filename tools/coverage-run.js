#!/usr/bin/env node

const { checkCoverageRoot, runCoverageRoot } = require("./coverage-core.js");

function usage() {
  console.error("usage: coverage-run [--check] dist/wasm-cov");
}

async function main() {
  const args = process.argv.slice(2);
  const check = args[0] === "--check";
  const [root] = check ? args.slice(1) : args;

  if (!root) {
    usage();
    process.exitCode = 64;
    return;
  }

  await runCoverageRoot(root);

  if (check) {
    const result = await checkCoverageRoot(root);

    for (const line of result.lines) {
      console.error(line);
    }

    if (result.failed) {
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
