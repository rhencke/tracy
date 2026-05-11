"use strict";

const assert = require("node:assert/strict");
const hostAbi = require("../abi/host.json");
const runtimeAbi = require("../abi/runtime.json");

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
const FIXTURE_OPERATION = Object.freeze(hostAbi.opfsBridge.fixtureOperations);
const INDEX_SIZE_MAY_BE_STALE_MARKER = hostAbi.opfsBridge.indexSizeMayBeStaleMarker;
const MAIN_INDEX_SIZE_MAY_BE_STALE = hostAbi.opfsBridge.mainIndexSizeMayBeStale;
const MAIN_PERSISTS_FILE_SOURCES = hostAbi.opfsBridge.defaultPersistsFileSources;
const WORKER_PERSISTS_FILE_SOURCES = hostAbi.opfsBridge.workerPersistsFileSources;
const REQUIRED_FIXTURE_OPERATION_KEYS = Object.freeze(Object.keys(FIXTURE_OPERATION));
// Fixture host-role labels mirror the production topology boundary that decides
// whether OPFS state is owned by the browser main thread or by a worker handoff.
const MAIN_HOST_ROLE = "main";
const WORKER_HOST_ROLE = "worker";
// The fixture writes only small scratch buffers, but two pages catches accidental
// main/worker memory sharing without pretending this is a production heap size.
const DEFAULT_FIXTURE_MEMORY_PAGES = 2;
// Fixture handle IDs use separate sentinel ranges so assertions and failures can
// distinguish main/worker state and source/index handles at a glance.
const DEFAULT_MAIN_SOURCE_ID_SEED = 112;
const DEFAULT_MAIN_INDEX_ID_SEED = 122;
const DEFAULT_WORKER_SOURCE_ID_SEED = 212;
const DEFAULT_WORKER_INDEX_ID_SEED = 222;
// Scenario helpers write short resource names and payload bytes into scratch
// memory owned by the fixture, not into production heap regions.
const DEFAULT_SCENARIO_NAME_PTR = 16;
const DEFAULT_SCENARIO_SRC_PTR = 96;
const DEFAULT_SCENARIO_DEST_PTR = 120;
const INITIAL_WORKER_HANDOFF_GENERATION = 0;
const PUBLISHED_HANDOFF_WORKER_MESSAGE_TYPES = Object.freeze(
  new Set([
    runtimeAbi.runtimeBridge.workerMessages.COMPLETE,
    runtimeAbi.runtimeBridge.workerMessages.COVERED_RANGE,
  ]),
);
const ACTIVE_INGEST_WORKER_MESSAGE_TYPES = Object.freeze(
  new Set([
    runtimeAbi.runtimeBridge.workerMessages.COMPLETE,
    runtimeAbi.runtimeBridge.workerMessages.COVERED_RANGE,
    runtimeAbi.runtimeBridge.workerMessages.ERROR,
    runtimeAbi.runtimeBridge.workerMessages.PROGRESS,
  ]),
);
const FILE_SELECTION = runtimeAbi.runtimeBridge.fileSelection;

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

function assertFixtureOperations(fixtureOperations) {
  for (const key of REQUIRED_FIXTURE_OPERATION_KEYS) {
    assert.equal(
      typeof fixtureOperations[key],
      "string",
      `production topology fixture operation ${key} must be defined`,
    );
    assert.notEqual(
      fixtureOperations[key].length,
      0,
      `production topology fixture operation ${key} must not be empty`,
    );
  }
}

function makeDefaultMemory() {
  return new WebAssembly.Memory({ initial: DEFAULT_FIXTURE_MEMORY_PAGES });
}

function decodeString(memory, ptr, len) {
  return new TextDecoder().decode(new Uint8Array(memory.buffer, ptr, len));
}

function writeString(memory, ptr, value) {
  const bytes = new TextEncoder().encode(value);

  new Uint8Array(memory.buffer, ptr, bytes.byteLength).set(bytes);
  return bytes.byteLength;
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
  const rawName =
    typeof file?.name === "string" && file.name.length > 0
      ? file.name
      : FILE_SELECTION.DEFAULT_TRACE_NAME;

  return `${FILE_SELECTION.SOURCE_PREFIX}${rawName}`;
}

function defaultIndexName(file) {
  const sourceName = defaultSourceName(file);
  const leaf = sourceName
    .split(FILE_SELECTION.PATH_SEPARATOR)
    .filter((part) => part.length > 0)
    .at(-1);
  const safeLeaf = (leaf ?? FILE_SELECTION.DEFAULT_TRACE_NAME).replace(
    new RegExp(FILE_SELECTION.UNSAFE_LEAF_PATTERN, "g"),
    FILE_SELECTION.UNSAFE_LEAF_REPLACEMENT,
  );

  return `${FILE_SELECTION.INDEX_PREFIX}${safeLeaf}${FILE_SELECTION.INDEX_SUFFIX}`;
}

function makeProductionTopologyFixture(options = {}) {
  const HOST_IMPORT_NAME = options.HOST_IMPORT_NAME ?? DEFAULT_HOST_IMPORT_NAME;

  assertHostImportNames(HOST_IMPORT_NAME);
  assertFixtureOperations(FIXTURE_OPERATION);

  const mainMemory = options.mainMemory ?? makeDefaultMemory();
  const workerMemoryFactory = options.workerMemoryFactory ?? makeDefaultMemory;
  const calls = [];
  const selectedFiles = new Map(options.selectedFiles ?? []);
  const durableSources = new Map(options.durableSources ?? []);
  const durableIndexes = new Map(options.durableIndexes ?? []);
  const createdWorkerHosts = [];
  const selectedFileIngestsByHandle = new Map();
  const selectedFileIngestsByIngestId = new Map();
  const workerIndexHandoffs = new Map();
  const mainThreadIndexOpens = new Map();
  let fileSelectedCallback = null;
  let pendingFilePickerOpen = null;
  let activeSelectedFileIngestId = null;
  let nextSelectedFileIngestId = 1;
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

  function requireIndexName(value, operation) {
    assert.equal(
      typeof value,
      "string",
      `${operation} requires a non-empty OPFS index name`,
    );
    assert.notEqual(value.length, 0, `${operation} requires a non-empty OPFS index name`);
    return value;
  }

  function workerIndexHandoff(name) {
    let handoff = workerIndexHandoffs.get(name);

    if (handoff === undefined) {
      handoff = makeWorkerIndexHandoff();
      workerIndexHandoffs.set(name, handoff);
    }
    return handoff;
  }

  function makeWorkerIndexHandoff() {
    return {
      bytesWrittenThisGeneration: 0,
      flushed: false,
      generation: INITIAL_WORKER_HANDOFF_GENERATION,
      lastIndexId: null,
      published: false,
      publicationCallIndex: null,
    };
  }

  function requireWorkerIndexHandoff(name, operation) {
    const handoff = workerIndexHandoffs.get(name);

    assert.ok(
      handoff !== undefined,
      `${operation}: worker must create OPFS index ${name} before publication`,
    );
    return handoff;
  }

  function requireWorkerPublishedIndex(name, operation) {
    const handoff = requireWorkerIndexHandoff(name, operation);

    assert.ok(
      handoff.flushed,
      `${operation}: worker must flush OPFS index ${name} before main-thread handoff`,
    );
    assert.ok(
      handoff.published,
      `${operation}: worker must publish OPFS index ${name} before main-thread handoff`,
    );
    assert.notEqual(
      handoff.publicationCallIndex,
      null,
      `${operation}: worker publication for OPFS index ${name} must record chronology`,
    );
    return handoff;
  }

  function requirePublishedWorkerMessageHandoff({
    indexName,
    ingest,
    message,
    messageType,
  }) {
    if (!PUBLISHED_HANDOFF_WORKER_MESSAGE_TYPES.has(messageType)) {
      return null;
    }
    const name = requireIndexName(
      indexName ?? message.indexName ?? ingest?.indexName,
      FIXTURE_OPERATION.workerMessageDelivery,
    );

    if (ingest !== null) {
      assert.equal(
        name,
        ingest.indexName,
        `${FIXTURE_OPERATION.workerMessageDelivery} requires worker message index ${name} to match active selected-file ingest index ${ingest.indexName}`,
      );
    }

    return requireWorkerPublishedIndex(name, FIXTURE_OPERATION.workerMessageDelivery);
  }

  function requireActiveSelectedFileIngest(message) {
    if (!ACTIVE_INGEST_WORKER_MESSAGE_TYPES.has(message.type)) {
      return null;
    }
    assert.ok(
      selectedFileIngestsByIngestId.size > 0,
      `${FIXTURE_OPERATION.workerMessageDelivery} requires selected-file ingest first`,
    );
    assert.ok(
      Number.isInteger(message.ingestId),
      `${FIXTURE_OPERATION.workerMessageDelivery} requires worker message ingestId`,
    );
    const ingest = selectedFileIngestsByIngestId.get(message.ingestId);

    assert.ok(
      ingest !== undefined,
      `${FIXTURE_OPERATION.workerMessageDelivery} requires worker message ingestId ${message.ingestId} to match an active selected-file ingest`,
    );
    assert.equal(
      activeSelectedFileIngestId,
      message.ingestId,
      `${FIXTURE_OPERATION.workerMessageDelivery} requires worker message ingestId ${message.ingestId} to match the current active selected-file ingest`,
    );
    assert.ok(
      ingest.callbackRan,
      `${FIXTURE_OPERATION.workerMessageDelivery} requires selected-file callback for ingest ${message.ingestId} to run before worker message delivery`,
    );
    return ingest;
  }

  function retireActiveSelectedFileIngest(message) {
    if (
      message.type === runtimeAbi.runtimeBridge.workerMessages.COMPLETE ||
      message.type === runtimeAbi.runtimeBridge.workerMessages.ERROR
    ) {
      activeSelectedFileIngestId = null;
    }
  }

  function startWorkerIndexGeneration(handoff, indexId) {
    handoff.bytesWrittenThisGeneration = 0;
    handoff.flushed = false;
    handoff.generation += 1;
    handoff.lastIndexId = indexId;
    handoff.published = false;
    handoff.publicationCallIndex = null;
  }

  function prepareWorkerIndexWriteGeneration(handoff, indexId) {
    if (
      handoff.generation === INITIAL_WORKER_HANDOFF_GENERATION ||
      handoff.flushed ||
      handoff.published
    ) {
      startWorkerIndexGeneration(handoff, indexId);
      return;
    }
    handoff.lastIndexId = indexId;
  }

  function canRecordMainThreadIndexOpen(name) {
    const handoff = workerIndexHandoffs.get(name);

    return handoff !== undefined &&
      handoff.flushed &&
      handoff.published &&
      handoff.publicationCallIndex !== null;
  }

  function recordMainThreadIndexOpen(indexId, name, sourceCallIndex) {
    const handoff = requireWorkerPublishedIndex(name, FIXTURE_OPERATION.mainThreadIndexOpen);

    mainThreadIndexOpens.set(indexId, {
      generation: handoff.generation,
      indexId,
      name,
      publicationCallIndex: handoff.publicationCallIndex,
      sourceCallIndex,
    });
    calls.push({
      generation: handoff.generation,
      host: MAIN_HOST_ROLE,
      id: indexId,
      name,
      op: FIXTURE_OPERATION.mainThreadIndexOpen,
      sourceCallIndex,
    });
  }

  function requireFreshMainThreadIndexOpen(indexId, operation) {
    const opened = mainThreadIndexOpens.get(indexId);

    assert.ok(
      opened !== undefined,
      `${operation}: main thread must open OPFS index before read`,
    );
    const handoff = requireWorkerPublishedIndex(opened.name, operation);

    assert.equal(
      opened.generation,
      handoff.generation,
      `${operation}: main-thread OPFS index ${opened.name} open must match current published worker generation`,
    );
    return opened;
  }

  function requireFreshMainThreadIndexRead(indexId, name, operation) {
    if (!workerIndexHandoffs.has(name)) {
      return null;
    }
    const opened = mainThreadIndexOpens.get(indexId);

    assert.ok(
      opened !== undefined,
      `${operation}: main thread must open OPFS index ${name} after worker publication before read`,
    );
    return requireFreshMainThreadIndexOpen(indexId, operation);
  }

  function recordMainThreadIndexRead({
    indexId,
    len,
    name,
    offset,
    readCount,
    sourceCallIndex,
  }) {
    calls.push({
      generation: mainThreadIndexOpens.get(indexId)?.generation ?? null,
      host: MAIN_HOST_ROLE,
      id: indexId,
      len,
      name,
      offset: Number(offset),
      op: FIXTURE_OPERATION.mainThreadIndexRead,
      readCount,
      sourceCallIndex,
    });
  }

  function sourceFromSelectedFile(host, sources, files, fileHandle) {
    const file = files.get(fileHandle);
    const sourceId = host === MAIN_HOST_ROLE ? nextMainSourceId : nextWorkerSourceId;
    const persistFileSource =
      host === MAIN_HOST_ROLE ? MAIN_PERSISTS_FILE_SOURCES : WORKER_PERSISTS_FILE_SOURCES;

    assert.ok(file !== undefined, `unknown ${host} selected file handle ${fileHandle}`);
    if (host === MAIN_HOST_ROLE) {
      nextMainSourceId += 1;
    } else {
      nextWorkerSourceId += 1;
    }

    const name = defaultSourceName(file);

    calls.push({ handle: fileHandle, host, op: FIXTURE_OPERATION.sourceFromFile });
    if (persistFileSource) {
      durableSources.set(name, { file, name, size: fileSize(file) });
    }
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

        calls.push({ host, name, op: FIXTURE_OPERATION.sourceOpen });
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
        if (host === WORKER_HOST_ROLE) {
          const handoff = workerIndexHandoff(name);

          startWorkerIndexGeneration(handoff, indexId);
        }
        calls.push({ host, id: indexId, name, op: FIXTURE_OPERATION.indexCreate });
        return indexId;
      },
      [HOST_IMPORT_NAME.OPFS_INDEX_OPEN](namePtr, nameLen) {
        const name = putNameFrom(namePtr, nameLen);
        const indexId = idState.nextIndexId();
        const workerHandoff = workerIndexHandoffs.get(name);

        if (host === MAIN_HOST_ROLE && workerHandoff !== undefined) {
          assert.ok(
            workerHandoff.flushed,
            `main-thread index open must wait for worker publication of ${name}`,
          );
          assert.ok(
            workerHandoff.published,
            `main-thread index open must wait for worker publication of ${name}`,
          );
        }
        durableIndex(name);
        indexes.set(indexId, { id: indexId, name });
        calls.push({ host, id: indexId, name, op: FIXTURE_OPERATION.indexOpen });
        const sourceCallIndex = calls.length - 1;

        if (host === MAIN_HOST_ROLE && canRecordMainThreadIndexOpen(name)) {
          recordMainThreadIndexOpen(indexId, name, sourceCallIndex);
        }
        return indexId;
      },
      [HOST_IMPORT_NAME.OPFS_INDEX_SIZE](indexId) {
        const index = requireIndex(indexId);

        if (host === MAIN_HOST_ROLE) {
          requireFreshMainThreadIndexRead(
            indexId,
            index.name,
            FIXTURE_OPERATION.indexRead,
          );
        }
        return BigInt(durableIndex(index.name).bytes.byteLength);
      },
      [HOST_IMPORT_NAME.OPFS_INDEX_READ](indexId, offset, len, destPtr) {
        const index = requireIndex(indexId);

        if (host === MAIN_HOST_ROLE) {
          requireFreshMainThreadIndexRead(
            indexId,
            index.name,
            FIXTURE_OPERATION.indexRead,
          );
        }
        const start = Number(offset);
        const bytes = durableIndex(index.name).bytes;
        const chunk = bytes.subarray(start, Math.min(bytes.byteLength, start + len));
        const readCount = chunk.byteLength;

        calls.push({
          host,
          id: indexId,
          len,
          name: index.name,
          offset: start,
          op: FIXTURE_OPERATION.indexRead,
          readCount,
        });
        if (host === MAIN_HOST_ROLE && mainThreadIndexOpens.has(indexId)) {
          recordMainThreadIndexRead({
            indexId,
            len,
            name: index.name,
            offset: start,
            readCount,
            sourceCallIndex: calls.length - 1,
          });
        }
        copyToMemory(memory, chunk, destPtr, len);
        return readCount;
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
        if (host === WORKER_HOST_ROLE) {
          const handoff = workerIndexHandoff(index.name);

          prepareWorkerIndexWriteGeneration(handoff, indexId);
          handoff.bytesWrittenThisGeneration += len;
        }
        calls.push({
          host,
          id: indexId,
          len,
          name: index.name,
          offset: start,
          op: FIXTURE_OPERATION.indexWrite,
        });
        return len;
      },
      async [HOST_IMPORT_NAME.OPFS_INDEX_FLUSH](indexId) {
        const index = requireIndex(indexId);

        if (host === WORKER_HOST_ROLE) {
          const handoff = workerIndexHandoff(index.name);

          handoff.flushed = true;
          handoff.lastIndexId = indexId;
        }
        calls.push({ host, id: indexId, name: index.name, op: FIXTURE_OPERATION.indexFlush });
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
    [INDEX_SIZE_MAY_BE_STALE_MARKER]: MAIN_INDEX_SIZE_MAY_BE_STALE,
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
      const ingestId = nextSelectedFileIngestId;
      const ingest = {
        callbackRan: false,
        handle,
        ingestId,
        indexName: defaultIndexName(file),
      };

      nextSelectedFileIngestId += 1;
      selectedFiles.set(handle, file);
      selectedFileIngestsByHandle.set(handle, ingest);
      selectedFileIngestsByIngestId.set(ingestId, ingest);
      activeSelectedFileIngestId = ingestId;
      calls.push({
        handle,
        host: MAIN_HOST_ROLE,
        ingestId,
        name: defaultSourceName(file),
        op: FIXTURE_OPERATION.selectedFileIngest,
      });
      queueMicrotask(() => {
        ingest.callbackRan = true;
        callback({ file, handle });
      });
      pendingFilePickerOpen.resolve(handle);
      pendingFilePickerOpen = null;
    },
    setFileSelectedCallback(callback) {
      calls.push({
        callbackType: typeof callback,
        host: MAIN_HOST_ROLE,
        op: FIXTURE_OPERATION.setFileSelectedCallback,
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
        host: MAIN_HOST_ROLE,
        op: FIXTURE_OPERATION.filePickerOpen,
      });
      return new Promise((resolve) => {
        pendingFilePickerOpen = { resolve };
      });
    },
    ...makeOpfsHost(MAIN_HOST_ROLE, mainMemory, selectedFiles, mainIdState),
  };

  function createWorkerHost(options = {}) {
    const workerMemory = options.memory ?? makeWorkerMemory();

    assert.notEqual(
      workerMemory,
      mainMemory,
      "production topology fixture requires independent worker memory; use makeSameMemoryWorkerHostForTests for same-memory tests",
    );

    const files = options.files ?? new Map(selectedFiles);
    const workerHost = makeOpfsHost(WORKER_HOST_ROLE, workerMemory, files, workerIdState);

    assert.notEqual(workerHost, mainHost);
    workerHost.memory = workerMemory;
    createdWorkerHosts.push(workerHost);
    return workerHost;
  }

  function makeSameMemoryWorkerHostForTests(options = {}) {
    const files = options.files ?? new Map(selectedFiles);
    const workerHost = makeOpfsHost(WORKER_HOST_ROLE, mainMemory, files, workerIdState);

    workerHost.memory = mainMemory;
    createdWorkerHosts.push(workerHost);
    return workerHost;
  }

  function makeSameHostWorkerHostForTests() {
    calls.push({ host: WORKER_HOST_ROLE, op: FIXTURE_OPERATION.sameHostTestShortcut });
    createdWorkerHosts.push(mainHost);
    return mainHost;
  }

  const scenario = Object.freeze({
    selectedFileIngest({ file, handle }) {
      mainHost.selectPickedFile(handle, file);
      return handle;
    },
    async workerPublication({
      bytes,
      indexName,
      namePtr = DEFAULT_SCENARIO_NAME_PTR,
      offset = 0n,
      srcPtr = DEFAULT_SCENARIO_SRC_PTR,
      workerHost,
    }) {
      const name = requireIndexName(indexName, FIXTURE_OPERATION.workerPublication);
      let indexId = null;

      if (workerHost !== undefined) {
        assert.equal(
          typeof workerHost[HOST_IMPORT_NAME.OPFS_INDEX_CREATE],
          "function",
          "worker publication requires a worker OPFS host",
        );
        const nameLen = writeString(workerHost.memory, namePtr, name);

        indexId = workerHost[HOST_IMPORT_NAME.OPFS_INDEX_CREATE](namePtr, nameLen);
        if (bytes !== undefined) {
          const payload = bytesFrom(bytes);

          new Uint8Array(workerHost.memory.buffer, srcPtr, payload.byteLength).set(payload);
          workerHost[HOST_IMPORT_NAME.OPFS_INDEX_WRITE](
            indexId,
            offset,
            srcPtr,
            payload.byteLength,
          );
        }
        await workerHost[HOST_IMPORT_NAME.OPFS_INDEX_FLUSH](indexId);
      }

      const handoff = requireWorkerIndexHandoff(name, FIXTURE_OPERATION.workerPublication);

      assert.ok(
        handoff.bytesWrittenThisGeneration > 0,
        `worker publication requires worker OPFS index ${name} to contain bytes`,
      );
      assert.ok(
        handoff.flushed,
        `worker publication requires worker OPFS index ${name} to be flushed`,
      );
      if (handoff.published && handoff.publicationCallIndex !== null) {
        return indexId ?? handoff.lastIndexId;
      }
      handoff.published = true;
      handoff.publicationCallIndex = calls.length;
      calls.push({
        generation: handoff.generation,
        host: WORKER_HOST_ROLE,
        id: indexId ?? handoff.lastIndexId,
        name,
        op: FIXTURE_OPERATION.workerPublication,
      });
      return indexId ?? handoff.lastIndexId;
    },
    mainThreadIndexOpen({
      indexName,
      namePtr = DEFAULT_SCENARIO_NAME_PTR,
      observeOnly = false,
    }) {
      const name = requireIndexName(indexName, FIXTURE_OPERATION.mainThreadIndexOpen);
      const handoff = requireWorkerPublishedIndex(name, FIXTURE_OPERATION.mainThreadIndexOpen);
      const rawOpenCallNotFoundIndex = -1;
      const opened = calls.find(
        (call) => call.host === MAIN_HOST_ROLE &&
          call.op === FIXTURE_OPERATION.mainThreadIndexOpen &&
          call.name === name &&
          call.generation === handoff.generation &&
          call.sourceCallIndex > handoff.publicationCallIndex,
      );
      const rawOpenCallIndex = calls.findIndex(
        (call, callIndex) => call.host === MAIN_HOST_ROLE &&
          call.op === FIXTURE_OPERATION.indexOpen &&
          call.name === name &&
          callIndex > handoff.publicationCallIndex,
      );

      if (opened !== undefined) {
        return opened.id;
      }
      if (rawOpenCallIndex !== rawOpenCallNotFoundIndex) {
        const rawOpenCall = calls[rawOpenCallIndex];

        recordMainThreadIndexOpen(rawOpenCall.id, name, rawOpenCallIndex);
        return rawOpenCall.id;
      }

      assert.equal(
        observeOnly,
        false,
        `${FIXTURE_OPERATION.mainThreadIndexOpen}: production must open OPFS index ${name}`,
      );
      const nameLen = writeString(mainMemory, namePtr, name);
      const indexId = mainHost[HOST_IMPORT_NAME.OPFS_INDEX_OPEN](namePtr, nameLen);

      return indexId;
    },
    mainThreadIndexRead({
      destPtr = DEFAULT_SCENARIO_DEST_PTR,
      indexId,
      len,
      observeOnly = false,
      offset = 0n,
    }) {
      const openRecord = requireFreshMainThreadIndexOpen(
        indexId,
        FIXTURE_OPERATION.mainThreadIndexRead,
      );
      const { name } = openRecord;
      const readCall = calls.find(
        (call) => call.host === MAIN_HOST_ROLE &&
          call.id === indexId &&
          call.op === FIXTURE_OPERATION.mainThreadIndexRead &&
          Number(call.offset) === Number(offset) &&
          call.sourceCallIndex > openRecord.sourceCallIndex &&
          call.len >= len,
      );
      const rawReadCallIndex = calls.findIndex(
        (call, callIndex) => call.host === MAIN_HOST_ROLE &&
          call.id === indexId &&
          call.op === FIXTURE_OPERATION.indexRead &&
          Number(call.offset) === Number(offset) &&
          callIndex > openRecord.sourceCallIndex &&
          call.len >= len,
      );
      if (readCall !== undefined) {
        return readCall.readCount;
      }
      if (rawReadCallIndex !== -1) {
        const rawReadCall = calls[rawReadCallIndex];

        recordMainThreadIndexRead({
          indexId,
          len: rawReadCall.len,
          name,
          offset: rawReadCall.offset,
          readCount: rawReadCall.readCount,
          sourceCallIndex: rawReadCallIndex,
        });
        return rawReadCall.readCount;
      }

      assert.equal(
        observeOnly,
        false,
        `${FIXTURE_OPERATION.mainThreadIndexRead}: production must read OPFS index ${name}`,
      );
      const read = mainHost[HOST_IMPORT_NAME.OPFS_INDEX_READ](indexId, offset, len, destPtr);

      return read;
    },
    workerMessageDelivery({ indexName, message, worker }) {
      assert.equal(
        typeof message,
        "object",
        `${FIXTURE_OPERATION.workerMessageDelivery} requires a worker message object`,
      );
      assert.notEqual(
        message,
        null,
        `${FIXTURE_OPERATION.workerMessageDelivery} requires a worker message object`,
      );
      const ingest = requireActiveSelectedFileIngest(message);
      const handoff = requirePublishedWorkerMessageHandoff({
        indexName,
        ingest,
        message,
        messageType: message.type,
      });
      const deliveredIndexName = indexName ?? message.indexName ?? null;
      calls.push({
        handle: ingest?.handle ?? null,
        host: WORKER_HOST_ROLE,
        ingestId: message.ingestId,
        messageType: message.type,
        name: deliveredIndexName,
        op: FIXTURE_OPERATION.workerMessageDelivery,
        generation: handoff?.generation ?? null,
        publicationCallIndex: handoff?.publicationCallIndex ?? null,
      });
      if (typeof worker?.emit === "function") {
        worker.emit("message", message);
        retireActiveSelectedFileIngest(message);
        return true;
      }
      if (typeof worker?.onmessage === "function") {
        worker.onmessage({ data: message });
        retireActiveSelectedFileIngest(message);
        return true;
      }
      throw new Error("worker message delivery requires emit or onmessage");
    },
  });

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
    scenario,
    selectedFiles,
  };
}

module.exports = {
  DEFAULT_HOST_IMPORT_NAME,
  FIXTURE_OPERATION,
  makeProductionTopologyFixture,
};
