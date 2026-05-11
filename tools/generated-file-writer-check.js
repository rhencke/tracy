#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  createGeneratedFileWriter,
  replaceGeneratedBlock,
} = require("./generated-file-writer.js");

function readFile(relativePath, root) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tracy-generated-writer-"));

  try {
    const writer = createGeneratedFileWriter({
      root,
      checkOnly: false,
      command: "node tools/example-generator.js",
    });

    assert.equal(writer.writeIfChanged("generated.txt", "fresh\n"), true);
    assert.equal(readFile("generated.txt", root), "fresh\n");
    assert.equal(writer.writeIfChanged("generated.txt", "fresh\n"), true);

    fs.writeFileSync(
      path.join(root, "marked.txt"),
      ["header", "<!-- start -->", "old body", "<!-- end -->", "footer"].join("\n"),
    );
    assert.equal(
      writer.updateMarkedFile("marked.txt", [
        {
          start: "<!-- start -->",
          end: "<!-- end -->",
          body: "new body",
        },
      ]),
      true,
    );
    assert.equal(
      readFile("marked.txt", root),
      ["header", "<!-- start -->", "new body", "<!-- end -->", "footer"].join("\n"),
    );

    assert.equal(
      replaceGeneratedBlock("a\n// start\nold\n// end\nz", "// start", "// end", "new"),
      "a\n// start\nnew\n// end\nz",
    );
    assert.throws(
      () => replaceGeneratedBlock("a\n// start\nold", "// start", "// end", "new"),
      /missing generated block \/\/ start \/\/ end/,
    );

    const staleMessages = [];
    const checkWriter = createGeneratedFileWriter({
      root,
      checkOnly: true,
      command: "node tools/example-generator.js",
      reportStale: (message) => staleMessages.push(message),
    });

    assert.equal(checkWriter.writeIfChanged("generated.txt", "stale\n"), false);
    assert.equal(readFile("generated.txt", root), "fresh\n");
    assert.deepEqual(staleMessages, [
      "generated.txt is out of date; run node tools/example-generator.js",
    ]);

    assert.equal(await checkWriter.writeIfChangedAsync("missing.txt", "created\n"), false);
    assert.equal(fs.existsSync(path.join(root, "missing.txt")), false);
    assert.equal(staleMessages.at(-1), "missing.txt is out of date; run node tools/example-generator.js");

    fs.writeFileSync(
      path.join(root, "marked.txt"),
      ["header", "<!-- start -->", "old body", "<!-- end -->", "footer"].join("\n"),
    );
    assert.equal(
      checkWriter.updateMarkedFile("marked.txt", [
        {
          start: "<!-- start -->",
          end: "<!-- end -->",
          body: "new body",
        },
      ]),
      false,
    );
    assert.equal(
      readFile("marked.txt", root),
      ["header", "<!-- start -->", "old body", "<!-- end -->", "footer"].join("\n"),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
