#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function findCoverageManifests(root) {
  const manifests = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile() && entry.name.endsWith(".cov.json")) {
        manifests.push(entryPath);
      }
    }
  }

  await walk(root);
  manifests.sort();
  return manifests;
}

function coveragePathFor(manifestPath) {
  return path.join(
    path.dirname(manifestPath),
    `${path.basename(manifestPath, ".cov.json")}.coverage.json`,
  );
}

function blockById(manifest) {
  const blocks = new Map();

  for (const block of manifest.blocks ?? []) {
    blocks.set(block.id, block);
  }

  return blocks;
}

function uncoveredIds(report) {
  if (Array.isArray(report.uncovered_ids)) {
    return report.uncovered_ids;
  }

  if (!Array.isArray(report.hits)) {
    return [];
  }

  return report.hits
    .map((hit, id) => (hit === 0 ? id : -1))
    .filter((id) => id !== -1);
}

function formatBlock(manifest, blocks, id) {
  const block = blocks.get(id);

  if (block === undefined) {
    return `${manifest.module ?? "unknown"}: block ${id}`;
  }

  const file = manifest.module ?? "unknown";
  const line = block.line ?? "?";
  const col = block.col ?? "?";
  const func = block.func ?? "<unknown>";
  const kind = block.kind ?? "<unknown>";

  return `${file}:${line}:${col} ${func} ${kind} block ${id}`;
}

async function checkManifest(manifestPath) {
  const manifest = await readJson(manifestPath);
  const coveragePath = coveragePathFor(manifestPath);

  let report;
  try {
    report = await readJson(coveragePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    return {
      manifestPath,
      missingCoverage: true,
      uncovered: [],
    };
  }

  const blocks = blockById(manifest);
  return {
    manifestPath,
    missingCoverage: false,
    uncovered: uncoveredIds(report).map((id) => formatBlock(manifest, blocks, id)),
  };
}

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

  const manifests = await findCoverageManifests(root);

  if (manifests.length === 0) {
    console.error(`coverage-check: no coverage manifests found in ${root}`);
    process.exitCode = 1;
    return;
  }

  const results = await Promise.all(manifests.map(checkManifest));
  let failed = false;

  for (const result of results) {
    if (result.missingCoverage) {
      failed = true;
      console.error(`coverage-check: missing ${coveragePathFor(result.manifestPath)}`);
    }

    for (const uncovered of result.uncovered) {
      failed = true;
      console.error(`coverage-check: uncovered ${uncovered}`);
    }
  }

  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
