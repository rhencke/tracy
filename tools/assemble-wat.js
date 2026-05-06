#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");

const includePattern = /^(\s*);; @include\s+(.+?)\s*$/;

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

async function main() {
  const [, , inputPath, outputPath] = process.argv;
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
};
