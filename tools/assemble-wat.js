#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");

const includePattern = /^(\s*);; @include\s+(.+?)\s*$/;

async function collectWatInputs(inputPath) {
  const inputs = [];
  const visited = new Set();
  const active = new Set();

  async function visit(filePath) {
    const resolved = path.resolve(filePath);
    if (active.has(resolved)) {
      throw new Error(`recursive WAT include: ${filePath}`);
    }
    if (visited.has(resolved)) {
      return;
    }

    visited.add(resolved);
    active.add(resolved);
    inputs.push(resolved);

    const source = await fs.readFile(resolved, "utf8");
    const lines = source.split("\n");
    for (const line of lines) {
      const match = line.match(includePattern);
      if (match === null) {
        continue;
      }

      const [, , includePath] = match;
      await visit(path.resolve(path.dirname(resolved), includePath));
    }

    active.delete(resolved);
  }

  await visit(inputPath);
  return inputs;
}

async function assembleWatFile(inputPath, outputPath) {
  const seen = new Set();

  async function expand(filePath) {
    const resolved = path.resolve(filePath);
    if (seen.has(resolved)) {
      throw new Error(`recursive WAT include: ${filePath}`);
    }

    seen.add(resolved);
    const source = await fs.readFile(resolved, "utf8");
    const lines = source.split("\n");
    const out = [];

    for (const line of lines) {
      const match = line.match(includePattern);
      if (match === null) {
        out.push(line);
        continue;
      }

      const [, indent, includePath] = match;
      const includeFile = path.resolve(path.dirname(resolved), includePath);
      out.push(`${indent};; begin include ${includePath}`);
      out.push(await expand(includeFile));
      out.push(`${indent};; end include ${includePath}`);
    }

    seen.delete(resolved);
    return out.join("\n");
  }

  const assembled = await expand(inputPath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, assembled.endsWith("\n") ? assembled : `${assembled}\n`);
}

function formatInputPath(inputPath, relativeTo) {
  if (!relativeTo) {
    return inputPath;
  }
  return path.relative(path.resolve(relativeTo), inputPath).split(path.sep).join("/");
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--inputs") {
    const inputPath = args[1];
    const relativeToIndex = args.indexOf("--relative-to");
    const relativeTo = relativeToIndex === -1 ? null : args[relativeToIndex + 1];
    if (!inputPath || (relativeToIndex !== -1 && !relativeTo)) {
      console.error("usage: assemble-wat --inputs input.wat [--relative-to dir]");
      process.exitCode = 64;
      return;
    }

    const inputs = await collectWatInputs(inputPath);
    process.stdout.write(`${inputs.map((filePath) => formatInputPath(filePath, relativeTo)).join("\n")}\n`);
    return;
  }

  const [inputPath, outputPath] = args;
  if (!inputPath || !outputPath) {
    console.error("usage: assemble-wat input.wat output.wat");
    process.exitCode = 64;
    return;
  }

  await assembleWatFile(inputPath, outputPath);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  assembleWatFile,
  collectWatInputs,
};
