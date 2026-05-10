"use strict";

const assert = require("node:assert/strict");
const hostAbi = require("../abi/host.json");

function hostImportConstantName(name) {
  return name.toUpperCase();
}

function makeHostImportNameMap(hostImports) {
  return Object.freeze(
    Object.fromEntries(
      hostImports.map((entry) => [hostImportConstantName(entry.name), entry.name]),
    ),
  );
}

const DEFAULT_HOST_IMPORT_NAME = makeHostImportNameMap(hostAbi.hostImports);
const REQUIRED_HOST_IMPORT_KEYS = Object.freeze(Object.keys(DEFAULT_HOST_IMPORT_NAME));
// The fixture writes only small scratch buffers, but two pages catches accidental
// main/worker memory sharing without pretending this is a production heap size.
const DEFAULT_FIXTURE_MEMORY_PAGES = 2;
// Fixture handle IDs use separate sentinel ranges so assertions and failures can
// distinguish main/worker state and source/index handles at a glance.
const DEFAULT_MAIN_SOURCE_ID_SEED = 112;
const DEFAULT_MAIN_INDEX_ID_SEED = 122;
const DEFAULT_WORKER_SOURCE_ID_SEED = 212;
const DEFAULT_WORKER_INDEX_ID_SEED = 222;

function assertHostImportNames(HOST_IMPORT_NAME) {
  for (const key of REQUIRED_HOST_IMPORT_KEYS) {
    assert.equal(
      typeof HOST_IMPORT_NAME[key],
      "string",
      `production topology fixture host import ${key} must be defined`,
    );
    assert.notEqual(
      HOST_IMPORT_NAME[key].length,
      0,
      `production topology fixture host import ${key} must not be empty`,
    );
  }
}

function makeDefaultMemory() {
  return new WebAssembly.Memory({ initial: DEFAULT_FIXTURE_MEMORY_PAGES });
}

function decodeString(memory, ptr, len) {
  return new TextDecoder().decode(new Uint8Array(memory.buffer, ptr, len));
}

function copyToMemory(memory, src, destPtr, len) {
  const dest = new Uint8Array(memory.buffer, destPtr, len);

  dest.fill(0);
  dest.set(src.subarray(0, len));
}

function bytesFrom(value) {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }

  if (typeof value === "string") {
    return new TextEncoder().encode(value);
  }

  throw new Error(`unsupported fixture file bytes ${typeof value}`);
}

function readFileRange(file, start, len) {
  if (typeof file.readAt === "function") {
    return bytesFrom(file.readAt(start, len));
  }

  if (file.bytes !== undefined) {
    const bytes = bytesFrom(file.bytes);
    return bytes.subarray(start, Math.min(bytes.byteLength, start + len));
  }

  if (file.content !== undefined) {
    const bytes = bytesFrom(file.content);
    return bytes.subarray(start, Math.min(bytes.byteLength, start + len));
  }

  throw new Error(`fixture file ${file.name ?? "<unnamed>"} has no readable bytes`);
}

function fileSize(file) {
  if (typeof file.size === "number") {
    return file.size;
  }

  if (file.bytes !== undefined) {
    return bytesFrom(file.bytes).byteLength;
  }

  if (file.content !== undefined) {
    return bytesFrom(file.content).byteLength;
  }

  return 0;
}

function defaultSourceName(file) {
  return `sources/${file.name ?? "trace"}`;
}

function makeProductionTopologyFixture(options = {}) {
  const HOST_IMPORT_NAME = options.HOST_IMPORT_NAME ?? DEFAULT_HOST_IMPORT_NAME;

  assertHostImportNames(HOST_IMPORT_NAME);

  const mainMemory = options.mainMemory ?? makeDefaultMemory();
  const workerMemoryFactory = options.workerMemoryFactory ?? makeDefaultMemory;
  const calls = [];
  const selectedFiles = new Map(options.selectedFiles ?? []);
  const durableSources = new Map(options.durableSources ?? []);
  const durableIndexes = new Map(options.durableIndexes ?? []);
  const createdWorkerHosts = [];
  let fileSelectedCallback = null;
  let pendingFilePickerOpen = null;
  let nextMainSourceId = options.nextMainSourceId ?? DEFAULT_MAIN_SOURCE_ID_SEED;
  let nextMainIndexId = options.nextMainIndexId ?? DEFAULT_MAIN_INDEX_ID_SEED;
  let nextWorkerSourceId = options.nextWorkerSourceId ?? DEFAULT_WORKER_SOURCE_ID_SEED;
  let nextWorkerIndexId = options.nextWorkerIndexId ?? DEFAULT_WORKER_INDEX_ID_SEED;

  function makeWorkerMemory() {
    const workerMemory = workerMemoryFactory();

    assert.notEqual(
      workerMemory,
      mainMemory,
      "production topology fixture worker memory factory must not return the main memory",
    );
    return workerMemory;
  }

  function sourceFromSelectedFile(host, sources, files, fileHandle) {
    const file = files.get(fileHandle);
    const sourceId = host === "main" ? nextMainSourceId : nextWorkerSourceId;

    assert.ok(file !== undefined, `unknown ${host} selected file handle ${fileHandle}`);
    if (host === "main") {
      nextMainSourceId += 1;
    } else {
      nextWorkerSourceId += 1;
    }

    const name = defaultSourceName(file);

    calls.push({ handle: fileHandle, host, op: "source-from-file" });
    durableSources.set(name, { file, name, size: fileSize(file) });
    sources.set(sourceId, { file, name, size: fileSize(file) });
    return sourceId;
  }

  function durableSource(name) {
    const source = durableSources.get(name);

    assert.ok(source !== undefined, `OPFS source ${name} should exist before open`);
    return source;
  }

  function durableIndex(name) {
    const index = durableIndexes.get(name);

    assert.ok(index !== undefined, `OPFS index ${name} should exist before open`);
    return index;
  }

  function makeOpfsHost(host, memory, files, idState) {
    const sources = new Map();
    const indexes = new Map();

    function putNameFrom(ptr, len) {
      return decodeString(memory, ptr, len);
    }

    function requireSource(sourceId) {
      const source = sources.get(sourceId);

      assert.ok(source !== undefined, `unknown ${host} OPFS source id ${sourceId}`);
      return source;
    }

    function requireIndex(indexId) {
      const index = indexes.get(indexId);

      assert.ok(index !== undefined, `unknown ${host} OPFS index id ${indexId}`);
      return index;
    }

    function readSource(sourceId, offset, len, destPtr) {
      const source = requireSource(sourceId);
      const start = Number(offset);
      const chunk = readFileRange(source.file, start, len);

      copyToMemory(memory, chunk, destPtr, len);
      return chunk.byteLength;
    }

    return {
      [HOST_IMPORT_NAME.OPFS_CREATE_FROM_FILE](fileHandle) {
        return sourceFromSelectedFile(host, sources, files, fileHandle);
      },
      [HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE](fileHandle) {
        return sourceFromSelectedFile(host, sources, files, fileHandle);
      },
      [HOST_IMPORT_NAME.OPFS_SOURCE_NAME_LEN](sourceId) {
        return new TextEncoder().encode(requireSource(sourceId).name).byteLength;
      },
      [HOST_IMPORT_NAME.OPFS_SOURCE_NAME](sourceId, destPtr, destLen) {
        const encoded = new TextEncoder().encode(requireSource(sourceId).name);

        assert.ok(destLen >= encoded.byteLength);
        new Uint8Array(memory.buffer, destPtr, destLen).set(encoded);
        return encoded.byteLength;
      },
      [HOST_IMPORT_NAME.OPFS_SOURCE_OPEN](namePtr, nameLen) {
        const name = putNameFrom(namePtr, nameLen);
        const source = durableSource(name);
        const sourceId = idState.nextSourceId();

        calls.push({ host, name, op: "source-open" });
        sources.set(sourceId, source);
        return sourceId;
      },
      [HOST_IMPORT_NAME.OPFS_SOURCE_SIZE](sourceId) {
        return BigInt(requireSource(sourceId).size);
      },
      [HOST_IMPORT_NAME.OPFS_READ_CHUNK](sourceId, offset, len, destPtr) {
        return readSource(sourceId, offset, len, destPtr);
      },
      [HOST_IMPORT_NAME.OPFS_SOURCE_READ](sourceId, offset, len, destPtr) {
        return readSource(sourceId, offset, len, destPtr);
      },
      [HOST_IMPORT_NAME.OPFS_INDEX_CREATE](namePtr, nameLen) {
        const name = putNameFrom(namePtr, nameLen);
        const indexId = idState.nextIndexId();

        durableIndexes.set(name, { bytes: new Uint8Array(0), name });
        indexes.set(indexId, { id: indexId, name });
        calls.push({ host, id: indexId, name, op: "index-create" });
        return indexId;
      },
      [HOST_IMPORT_NAME.OPFS_INDEX_OPEN](namePtr, nameLen) {
        const name = putNameFrom(namePtr, nameLen);
        const indexId = idState.nextIndexId();

        durableIndex(name);
        indexes.set(indexId, { id: indexId, name });
        calls.push({ host, id: indexId, name, op: "index-open" });
        return indexId;
      },
      [HOST_IMPORT_NAME.OPFS_INDEX_SIZE](indexId) {
        const index = requireIndex(indexId);

        return BigInt(durableIndex(index.name).bytes.byteLength);
      },
      [HOST_IMPORT_NAME.OPFS_INDEX_READ](indexId, offset, len, destPtr) {
        const index = requireIndex(indexId);
        const start = Number(offset);
        const bytes = durableIndex(index.name).bytes;
        const chunk = bytes.subarray(start, Math.min(bytes.byteLength, start + len));

        calls.push({
          host,
          id: indexId,
          len,
          name: index.name,
          offset: start,
          op: "index-read",
        });
        copyToMemory(memory, chunk, destPtr, len);
        return chunk.byteLength;
      },
      [HOST_IMPORT_NAME.OPFS_INDEX_WRITE](indexId, offset, srcPtr, len) {
        const index = requireIndex(indexId);
        const start = Number(offset);
        const end = start + len;
        const durable = durableIndex(index.name);
        const nextBytes =
          end > durable.bytes.byteLength
            ? new Uint8Array(end)
            : new Uint8Array(durable.bytes);

        if (end > durable.bytes.byteLength) {
          nextBytes.set(durable.bytes);
        }
        nextBytes.set(new Uint8Array(memory.buffer, srcPtr, len), start);
        durable.bytes = nextBytes;
        calls.push({
          host,
          id: indexId,
          len,
          name: index.name,
          offset: start,
          op: "index-write",
        });
        return len;
      },
      async [HOST_IMPORT_NAME.OPFS_INDEX_FLUSH](indexId) {
        const index = requireIndex(indexId);

        calls.push({ host, id: indexId, name: index.name, op: "index-flush" });
        await new Promise((resolve) => setImmediate(resolve));
        return 0;
      },
    };
  }

  const mainIdState = {
    nextIndexId() {
      const indexId = nextMainIndexId;

      nextMainIndexId += 1;
      return indexId;
    },
    nextSourceId() {
      const sourceId = nextMainSourceId;

      nextMainSourceId += 1;
      return sourceId;
    },
  };
  const workerIdState = {
    nextIndexId() {
      const indexId = nextWorkerIndexId;

      nextWorkerIndexId += 1;
      return indexId;
    },
    nextSourceId() {
      const sourceId = nextWorkerSourceId;

      nextWorkerSourceId += 1;
      return sourceId;
    },
  };
  const mainHost = {
    calls,
    createdWorkerHosts,
    selectPickedFile(handle, file) {
      assert.notEqual(
        pendingFilePickerOpen,
        null,
        "production topology fixture must start selected-file handoff from file_picker_open",
      );
      const callback =
        typeof fileSelectedCallback === "function"
          ? fileSelectedCallback
          : fileSelectedCallback?.fn;

      assert.equal(
        typeof callback,
        "function",
        `production topology fixture must install a file-selection callback; calls=${JSON.stringify(calls)}`,
      );
      selectedFiles.set(handle, file);
      queueMicrotask(() => callback({ file, handle }));
      pendingFilePickerOpen.resolve(handle);
      pendingFilePickerOpen = null;
    },
    setFileSelectedCallback(callback) {
      calls.push({
        callbackType: typeof callback,
        host: "main",
        op: "set-file-selected-callback",
      });
      fileSelectedCallback = callback;
    },
    [HOST_IMPORT_NAME.FILE_PICKER_OPEN](acceptPtr, acceptLen) {
      assert.equal(
        pendingFilePickerOpen,
        null,
        "production topology fixture should not open multiple file pickers at once",
      );
      calls.push({
        accept: decodeString(mainMemory, acceptPtr, acceptLen),
        host: "main",
        op: "file-picker-open",
      });
      return new Promise((resolve) => {
        pendingFilePickerOpen = { resolve };
      });
    },
    ...makeOpfsHost("main", mainMemory, selectedFiles, mainIdState),
  };

  function createWorkerHost(options = {}) {
    const workerMemory = options.memory ?? makeWorkerMemory();

    assert.notEqual(
      workerMemory,
      mainMemory,
      "production topology fixture requires independent worker memory; use makeSameMemoryWorkerHostForTests for same-memory tests",
    );

    const files = options.files ?? new Map(selectedFiles);
    const workerHost = makeOpfsHost("worker", workerMemory, files, workerIdState);

    assert.notEqual(workerHost, mainHost);
    workerHost.memory = workerMemory;
    createdWorkerHosts.push(workerHost);
    return workerHost;
  }

  function makeSameMemoryWorkerHostForTests(options = {}) {
    const files = options.files ?? new Map(selectedFiles);
    const workerHost = makeOpfsHost("worker", mainMemory, files, workerIdState);

    workerHost.memory = mainMemory;
    createdWorkerHosts.push(workerHost);
    return workerHost;
  }

  function makeSameHostWorkerHostForTests() {
    calls.push({ host: "worker", op: "same-host-test-shortcut" });
    createdWorkerHosts.push(mainHost);
    return mainHost;
  }

  return {
    calls,
    createWorkerHost,
    durableIndexes,
    durableSources,
    mainHost,
    mainMemory,
    makeSameHostWorkerHostForTests,
    makeSameMemoryWorkerHostForTests,
    makeWorkerMemory,
    selectedFiles,
  };
}

module.exports = {
  DEFAULT_HOST_IMPORT_NAME,
  makeProductionTopologyFixture,
};
