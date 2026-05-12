import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);
const {
  createGeneratedFileWriter,
  replaceGeneratedBlock,
} = require("./generated-file-writer.js");

function readFile(relativePath, root) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("generated-file writer invariant", () => {
  test("preserves writes, marked blocks, and async stale-file reporting", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tracy-generated-writer-"));

    try {
      const writer = createGeneratedFileWriter({
        root,
        checkOnly: false,
        command: "node tools/example-generator.js",
      });

      expect(writer.writeIfChanged("generated.txt", "fresh\n")).toBe(true);
      expect(readFile("generated.txt", root)).toBe("fresh\n");
      expect(writer.writeIfChanged("generated.txt", "fresh\n")).toBe(true);

      fs.writeFileSync(
        path.join(root, "marked.txt"),
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
      expect(readFile("marked.txt", root)).toBe(
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
      expect(readFile("generated.txt", root)).toBe("fresh\n");
      expect(staleMessages).toEqual([
        "generated.txt is out of date; run node tools/example-generator.js",
      ]);

      await expect(checkWriter.writeIfChangedAsync("missing.txt", "created\n")).resolves.toBe(
        false,
      );
      expect(fs.existsSync(path.join(root, "missing.txt"))).toBe(false);
      expect(staleMessages.at(-1)).toBe(
        "missing.txt is out of date; run node tools/example-generator.js",
      );

      fs.writeFileSync(
        path.join(root, "marked.txt"),
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
      expect(readFile("marked.txt", root)).toBe(
        ["header", "<!-- start -->", "old body", "<!-- end -->", "footer"].join("\n"),
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
