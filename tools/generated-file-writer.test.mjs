import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";

import {
  HOST_IMPORT_NAME,
  OPFS_BRIDGE_CONTRACT,
} from "../host/abi.mjs";
import {
  makeMainThreadHost,
  makeShim,
  makeWorkerThreadHost,
} from "../host/shim.mjs";

const require = createRequire(import.meta.url);
const {
  installBrowserGlobals,
  installRuntimeBrowserGlobals,
} = require("./browser-harness.js");
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

function hostKeys(host) {
  return new Set(Object.keys(host));
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

      await expect(writer.writeIfChangedAsync("generated.txt", "fresh\n")).resolves.toBe(true);
      await expect(readFile("generated.txt", root)).resolves.toBe("fresh\n");
      await expect(writer.writeIfChangedAsync("generated.txt", "fresh\n")).resolves.toBe(true);

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

      await expect(checkWriter.writeIfChangedAsync("generated.txt", "stale\n")).resolves.toBe(
        false,
      );
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

describe("host shim invariant", () => {
  test("installs runtime canvas globals with Tracy defaults", () => {
    const runtimeGlobals = installRuntimeBrowserGlobals({ raf: false, jspi: false });

    expect(runtimeGlobals.canvas.id).toBe("tracy");
    expect(runtimeGlobals.canvas.hidden).toBe(false);
    expect(typeof runtimeGlobals.canvas.getContext).toBe("function");
    expect(typeof runtimeGlobals.canvas.getBoundingClientRect).toBe("function");
    expect(typeof runtimeGlobals.canvas.addEventListener).toBe("function");
    expect(runtimeGlobals.canvas.clientWidth).toBe(320);
    expect(runtimeGlobals.canvas.clientHeight).toBe(240);
  });

  test("preserves provided runtime canvas dimensions", () => {
    const partialRuntimeGlobals = installRuntimeBrowserGlobals({
      canvas: { height: 180, width: 360 },
      raf: false,
      jspi: false,
    });

    expect(partialRuntimeGlobals.canvas.id).toBe("tracy");
    expect(typeof partialRuntimeGlobals.canvas.getContext).toBe("function");
    expect(partialRuntimeGlobals.canvas.clientWidth).toBe(360);
    expect(partialRuntimeGlobals.canvas.clientHeight).toBe(180);
  });

  test("separates browser-only and worker-only host imports", () => {
    installBrowserGlobals({ raf: false, jspi: false });
    const memory = new WebAssembly.Memory({ initial: 1 });
    const mainKeys = hostKeys(makeMainThreadHost(memory));
    const workerKeys = hostKeys(makeWorkerThreadHost(memory));
    const legacyHost = makeShim(memory);

    for (const name of [
      HOST_IMPORT_NAME.CANVAS_GET_SIZE,
      HOST_IMPORT_NAME.CANVAS_LISTEN_RESIZE,
      HOST_IMPORT_NAME.FILE_PICKER_OPEN,
      HOST_IMPORT_NAME.POINTER_LISTEN,
    ]) {
      expect(mainKeys.has(name), `main host missing ${name}`).toBe(true);
      expect(workerKeys.has(name), `worker host should not expose ${name}`).toBe(false);
    }

    for (const name of [
      HOST_IMPORT_NAME.OPFS_SOURCE_OPEN,
      HOST_IMPORT_NAME.OPFS_SOURCE_READ,
      HOST_IMPORT_NAME.OPFS_INDEX_CREATE,
      HOST_IMPORT_NAME.OPFS_INDEX_OPEN,
      HOST_IMPORT_NAME.OPFS_INDEX_READ,
      HOST_IMPORT_NAME.OPFS_INDEX_WRITE,
      HOST_IMPORT_NAME.OPFS_INDEX_FLUSH,
      HOST_IMPORT_NAME.OPFS_INDEX_SIZE,
    ]) {
      expect(workerKeys.has(name), `worker host missing ${name}`).toBe(true);
      expect(Object.hasOwn(legacyHost, name), `legacy host missing ${name}`).toBe(true);
    }

    expect(mainKeys.has(HOST_IMPORT_NAME.OPFS_INDEX_OPEN), "main host missing index open").toBe(
      true,
    );
    expect(mainKeys.has(HOST_IMPORT_NAME.OPFS_INDEX_READ), "main host missing index read").toBe(
      true,
    );
    expect(
      mainKeys.has(HOST_IMPORT_NAME.OPFS_INDEX_CREATE),
      "main host missing index create",
    ).toBe(true);
    expect(mainKeys.has(HOST_IMPORT_NAME.OPFS_INDEX_WRITE), "main host missing index write").toBe(
      true,
    );
    expect(mainKeys.has(HOST_IMPORT_NAME.OPFS_INDEX_FLUSH), "main host missing index flush").toBe(
      true,
    );
    expect(mainKeys.has(HOST_IMPORT_NAME.OPFS_INDEX_SIZE), "main host missing index size").toBe(
      true,
    );
  });

  test("marks main OPFS index size as possibly stale", () => {
    installBrowserGlobals({ raf: false, jspi: false });
    const memory = new WebAssembly.Memory({ initial: 1 });
    const mainHost = makeMainThreadHost(memory);
    const workerHost = makeWorkerThreadHost(memory);

    expect(
      mainHost[OPFS_BRIDGE_CONTRACT.indexSizeMayBeStaleMarker],
      "main OPFS host should probe for worker-appended index pages",
    ).toBe(OPFS_BRIDGE_CONTRACT.mainIndexSizeMayBeStale);
    expect(
      workerHost[OPFS_BRIDGE_CONTRACT.indexSizeMayBeStaleMarker],
      "worker OPFS host should not expose main-thread catalog probe marker",
    ).toBeUndefined();
  });

  test("rejects worker file sources without main-thread file handles", () => {
    const memory = new WebAssembly.Memory({ initial: 1 });
    const workerHost = makeWorkerThreadHost(memory);

    expect(
      () => workerHost[HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE](1),
      "worker file source import should explain main-thread file ownership",
    ).toThrow(new RegExp(OPFS_BRIDGE_CONTRACT.workerUnsupportedFileReason));
  });

  test("reads worker file-backed sources into wasm memory", async () => {
    const memory = new WebAssembly.Memory({ initial: 1 });
    const workerFileHost = makeWorkerThreadHost(
      memory,
      new Map([
        [
          7,
          {
            size: 3,
            slice(start, end) {
              expect(start, "worker file source read should preserve start offset").toBe(1);
              expect(end, "worker file source read should preserve end offset").toBe(3);
              return {
                async arrayBuffer() {
                  return Uint8Array.from([8, 9]).buffer;
                },
              };
            },
          },
        ],
      ]),
    );

    const sourceId = await workerFileHost[HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE](7);

    expect(sourceId).toBe(1);
    await expect(
      workerFileHost[HOST_IMPORT_NAME.OPFS_SOURCE_READ](sourceId, 1n, 2, 32),
    ).resolves.toBe(2);
    expect(Array.from(new Uint8Array(memory.buffer, 32, 2))).toEqual([8, 9]);
  });
});
