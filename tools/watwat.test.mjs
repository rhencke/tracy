import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { registerWatwatTests } from "./watwat-vitest.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WAT_TEST_DIRS = Object.freeze(["dist/wasm", "dist/wasm/std"]);

async function watTestFilesIn(dir) {
  const entries = await fs.readdir(path.join(ROOT_DIR, dir), { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".test.wasm"))
    .map((entry) => path.join(dir, entry.name));
}

const watTestFiles = (
  await Promise.all(WAT_TEST_DIRS.map((dir) => watTestFilesIn(dir)))
).flat().sort();

await registerWatwatTests(watTestFiles, {
  harnessPath: "tools/tracy-watwat-harness.js",
});
