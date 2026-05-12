#!/usr/bin/env node

const { runCli } = require("./watwat-core.js");

runCli().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
