import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);
const {
  createGeneratedFileWriter,
  replaceGeneratedBlock,
} = require("./generated-file-writer.js");

function filePath(relativePath, root) {
  return path.join(root, relativePath);
}

async function readFile(relativePath, root) {
  return fs.readFile(filePath(relativePath, root), "utf8");
}

async function fileExists(relativePath, root) {
  try {
    await fs.access(filePath(relativePath, root));
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

describe("generated-file writer invariant", () => {
  test("preserves writes, marked blocks, and async stale-file reporting", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "tracy-generated-writer-"));

    try {
      const writer = createGeneratedFileWriter({
        root,
        checkOnly: false,
        command: "node tools/example-generator.js",
      });

      expect(writer.writeIfChanged("generated.txt", "fresh\n")).toBe(true);
      await expect(readFile("generated.txt", root)).resolves.toBe("fresh\n");
      expect(writer.writeIfChanged("generated.txt", "fresh\n")).toBe(true);

      await fs.writeFile(
        filePath("marked.txt", root),
        ["header", "<!-- start -->", "old body", "<!-- end -->", "footer"].join("\n"),
      );
      expect(
        writer.updateMarkedFile("marked.txt", [
          {
            start: "<!-- start -->",
            end: "<!-- end -->",
            body: "new body",
          },
        ]),
      ).toBe(true);
      await expect(readFile("marked.txt", root)).resolves.toBe(
        ["header", "<!-- start -->", "new body", "<!-- end -->", "footer"].join("\n"),
      );

      expect(
        replaceGeneratedBlock("a\n// start\nold\n// end\nz", "// start", "// end", "new"),
      ).toBe("a\n// start\nnew\n// end\nz");
      expect(() =>
        replaceGeneratedBlock("a\n// start\nold", "// start", "// end", "new"),
      ).toThrow(/missing generated block \/\/ start \/\/ end/);

      const staleMessages = [];
      const checkWriter = createGeneratedFileWriter({
        root,
        checkOnly: true,
        command: "node tools/example-generator.js",
        reportStale: (message) => staleMessages.push(message),
      });

      expect(checkWriter.writeIfChanged("generated.txt", "stale\n")).toBe(false);
      await expect(readFile("generated.txt", root)).resolves.toBe("fresh\n");
      expect(staleMessages).toEqual([
        "generated.txt is out of date; run node tools/example-generator.js",
      ]);

      await expect(checkWriter.writeIfChangedAsync("missing.txt", "created\n")).resolves.toBe(
        false,
      );
      await expect(fileExists("missing.txt", root)).resolves.toBe(false);
      expect(staleMessages.at(-1)).toBe(
        "missing.txt is out of date; run node tools/example-generator.js",
      );

      await fs.writeFile(
        filePath("marked.txt", root),
        ["header", "<!-- start -->", "old body", "<!-- end -->", "footer"].join("\n"),
      );
      expect(
        checkWriter.updateMarkedFile("marked.txt", [
          {
            start: "<!-- start -->",
            end: "<!-- end -->",
            body: "new body",
          },
        ]),
      ).toBe(false);
      await expect(readFile("marked.txt", root)).resolves.toBe(
        ["header", "<!-- start -->", "old body", "<!-- end -->", "footer"].join("\n"),
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
