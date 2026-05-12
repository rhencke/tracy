#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const hostAbi = require("../abi/host.json");
const runtimeAbi = require("../abi/runtime.json");
const {
  FIXTURE_OPERATION: OP,
  DEFAULT_HOST_IMPORT_NAME: HOST,
  makeProductionTopologyFixture,
} = require("./production-topology-fixture.js");

const MAIN_HOST_ROLE = "main";
const WORKER_HOST_ROLE = "worker";
const STALE_SIZE_MARKER = hostAbi.opfsBridge.indexSizeMayBeStaleMarker;
const WORKER_EVENT = runtimeAbi.runtimeBridge.worker;
const FILE_SELECTION = runtimeAbi.runtimeBridge.fileSelection;
const WORKER_MESSAGE = runtimeAbi.runtimeBridge.workerMessages;
const WORKER_INDEX_GENERATION_HANDOFF_OPERATIONS = Object.freeze(
  hostAbi.opfsBridge.workerIndexGenerationHandoffOperationKeys.map((key) => {
    assert.ok(
      Object.hasOwn(OP, key),
      `worker index generation handoff operation ${key} must exist in fixture operations`,
    );
    return OP[key];
  }),
);
// The fresh-reader helper models the main thread after it has observed the
// currently published worker handoff generation.
const FRESH_MAIN_THREAD_INDEX_READER_DEST_PTR = 120;

function writeString(memory, ptr, value) {
  const bytes = new TextEncoder().encode(value);

  new Uint8Array(memory.buffer, ptr, bytes.byteLength).set(bytes);
  return bytes.byteLength;
}

function readBytes(memory, ptr, len) {
  return Array.from(new Uint8Array(memory.buffer, ptr, len));
}

async function makeFreshMainThreadIndexReader({
  bytes,
  fixture,
  indexName,
  namePtr,
  observeOnlyOpen = false,
  offset = 0n,
  workerHost,
}) {
  const workerIndexId = await fixture.scenario.workerIndexGeneration({
    bytes,
    indexName,
    namePtr,
    offset,
    workerHost,
  });
  const mainIndexId = fixture.scenario.mainThreadIndexOpen({
    indexName,
    observeOnly: observeOnlyOpen,
  });

  return Object.freeze({
    mainIndexId,
    observeOnlyRead({
      len = bytes.byteLength,
      offset: readOffset = 0n,
    } = {}) {
      return fixture.scenario.mainThreadIndexRead({
        indexId: mainIndexId,
        len,
        observeOnly: true,
        offset: readOffset,
      });
    },
    observeOnlyOpen() {
      return fixture.scenario.mainThreadIndexOpen({
        indexName,
        observeOnly: true,
      });
    },
    rawRead({
      destPtr = FRESH_MAIN_THREAD_INDEX_READER_DEST_PTR,
      len = bytes.byteLength,
      offset: readOffset = 0n,
    } = {}) {
      return fixture.mainHost[HOST.OPFS_INDEX_READ](
        mainIndexId,
        readOffset,
        len,
        destPtr,
      );
    },
    size() {
      return fixture.mainHost[HOST.OPFS_INDEX_SIZE](mainIndexId);
    },
    workerIndexId,
  });
}

function indexPathForTraceName(traceName) {
  const safeLeaf = traceName.replace(
    new RegExp(FILE_SELECTION.UNSAFE_LEAF_PATTERN, "g"),
    FILE_SELECTION.UNSAFE_LEAF_REPLACEMENT,
  );

  return `${FILE_SELECTION.INDEX_PREFIX}${safeLeaf}${FILE_SELECTION.INDEX_SUFFIX}`;
}

function withoutImportName(importNames, key) {
  const copy = { ...importNames };

  delete copy[key];
  return copy;
}

function checkHostImportNameGuard() {
  assert.equal(HOST.OPFS_CREATE_FROM_FILE, "opfs_create_from_file");
  assert.throws(
    () => makeProductionTopologyFixture({
      HOST_IMPORT_NAME: withoutImportName(HOST, "OPFS_CREATE_FROM_FILE"),
    }),
    /OPFS_CREATE_FROM_FILE must be defined/,
    "fixture should fail before creating a host with an undefined computed import key",
  );
}

async function checkDefaultSeparation() {
  const mainMemory = new WebAssembly.Memory({ initial: 2 });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const workerHost = fixture.createWorkerHost();

  assert.notEqual(
    workerHost,
    fixture.mainHost,
    "production topology fixture should default to separate main and worker hosts",
  );
  assert.notEqual(
    workerHost.memory,
    mainMemory,
    "production topology fixture should default to independent worker memory",
  );
  assert.equal(
    fixture.mainHost[STALE_SIZE_MARKER],
    hostAbi.opfsBridge.mainIndexSizeMayBeStale,
    "main host should expose the production OPFS stale-size marker",
  );
  assert.equal(
    Object.hasOwn(workerHost, STALE_SIZE_MARKER),
    false,
    "worker hosts should not expose the main-thread OPFS stale-size marker",
  );
  assert.throws(
    () => fixture.createWorkerHost({ memory: mainMemory }),
    /makeSameMemoryWorkerHostForTests/,
    "same-memory workers should require the narrowly named test helper",
  );
  const sameMemoryWorkerHost = fixture.makeSameMemoryWorkerHostForTests();

  assert.equal(
    sameMemoryWorkerHost.memory,
    mainMemory,
    "same-memory shortcut should be explicit in the helper name",
  );
  assert.equal(
    Object.hasOwn(sameMemoryWorkerHost, STALE_SIZE_MARKER),
    false,
    "same-memory worker hosts should not expose the main-thread OPFS stale-size marker",
  );
  assert.equal(
    fixture.makeSameHostWorkerHostForTests(),
    fixture.mainHost,
    "same-host shortcut should be explicit in the helper name",
  );
}

async function checkSelectedFileAndDurableSourceReads() {
  const fixtureMemoryPageCount = 2;
  const mainMemory = new WebAssembly.Memory({ initial: fixtureMemoryPageCount });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const mainFile = {
    bytes: new Uint8Array([11, 12, 13, 14, 15]),
    name: "trace.json",
  };
  const workerFile = {
    bytes: new Uint8Array([21, 22, 23, 24, 25]),
    name: "worker-trace.json",
  };
  const selected = [];
  const jsonFilePickerAccept = ".json";
  const filePickerAcceptPtr = 8;
  // Synthetic file-picker handles model opaque browser FileSystemFileHandle values.
  const selectedMainFileHandle = 77;
  const mainSourceName = `sources/${mainFile.name}`;
  const mainSourceNamePtr = 48;
  const mainSourceReadOffset = 2n;
  const mainSourceReadLen = 2;
  const mainSourceReadDest = 64;
  const mainSourceReadBufferLen = mainSourceReadLen + 1;
  const expectedMainSelectedSourceSize = BigInt(mainFile.bytes.byteLength);
  const expectedMainSourceReadBytes = [
    ...mainFile.bytes.slice(
      Number(mainSourceReadOffset),
      Number(mainSourceReadOffset) + mainSourceReadLen,
    ),
    0,
  ];
  const acceptLen = writeString(mainMemory, filePickerAcceptPtr, jsonFilePickerAccept);

  fixture.mainHost.setFileSelectedCallback((event) => selected.push(event));
  const picker = fixture.mainHost[HOST.FILE_PICKER_OPEN](filePickerAcceptPtr, acceptLen);
  fixture.scenario.selectedFileIngest({ file: mainFile, handle: selectedMainFileHandle });
  assert.equal(await picker, selectedMainFileHandle);
  await Promise.resolve();
  assert.deepEqual(selected, [{ file: mainFile, handle: selectedMainFileHandle }]);

  const mainSelectedSourceId = fixture.mainHost[HOST.OPFS_SOURCE_FROM_FILE](selectedMainFileHandle);

  assert.equal(
    fixture.mainHost[HOST.OPFS_SOURCE_SIZE](mainSelectedSourceId),
    expectedMainSelectedSourceSize,
  );

  const sourceNameLen = writeString(mainMemory, mainSourceNamePtr, mainSourceName);
  const mainSourceId = fixture.mainHost[HOST.OPFS_SOURCE_OPEN](
    mainSourceNamePtr,
    sourceNameLen,
  );

  assert.equal(
    fixture.mainHost[HOST.OPFS_SOURCE_READ](
      mainSourceId,
      mainSourceReadOffset,
      mainSourceReadLen,
      mainSourceReadDest,
    ),
    mainSourceReadLen,
  );
  assert.deepEqual(
    readBytes(mainMemory, mainSourceReadDest, mainSourceReadBufferLen),
    expectedMainSourceReadBytes,
  );

  const workerFixture = makeProductionTopologyFixture({
    mainMemory: new WebAssembly.Memory({ initial: fixtureMemoryPageCount }),
  });
  const undefinedImportSentinel = "undefined";
  const expectedWorkerImportType = "function";
  const selectedWorkerFileHandle = 88;
  const workerSourceName = `sources/${workerFile.name}`;
  const workerSourceNamePtr = 80;
  const workerSourceReadOffset = 1n;
  const workerSourceReadLen = 3;
  const workerSourceReadDest = 32;
  const workerSourceReadBufferLen = workerSourceReadLen + 1;
  const expectedWorkerSelectedSourceSize = BigInt(workerFile.bytes.byteLength);
  const expectedWorkerSourceReadBytes = [
    ...workerFile.bytes.slice(
      Number(workerSourceReadOffset),
      Number(workerSourceReadOffset) + workerSourceReadLen,
    ),
    0,
  ];
  const escapedWorkerSourceName = workerSourceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const workerSourceMissingPattern = new RegExp(
    `OPFS source ${escapedWorkerSourceName} should exist before open`,
  );
  const workerAcceptLen = writeString(
    workerFixture.mainMemory,
    filePickerAcceptPtr,
    jsonFilePickerAccept,
  );

  workerFixture.mainHost.setFileSelectedCallback(() => {});
  const workerPicker = workerFixture.mainHost[HOST.FILE_PICKER_OPEN](
    filePickerAcceptPtr,
    workerAcceptLen,
  );
  workerFixture.scenario.selectedFileIngest({
    file: workerFile,
    handle: selectedWorkerFileHandle,
  });
  assert.equal(await workerPicker, selectedWorkerFileHandle);
  const workerHost = workerFixture.createWorkerHost();

  assert.equal(Object.hasOwn(workerHost, undefinedImportSentinel), false);
  assert.equal(typeof workerHost[HOST.OPFS_CREATE_FROM_FILE], expectedWorkerImportType);
  const sourceId = workerHost[HOST.OPFS_CREATE_FROM_FILE](selectedWorkerFileHandle);

  assert.equal(workerHost[HOST.OPFS_SOURCE_SIZE](sourceId), expectedWorkerSelectedSourceSize);
  assert.equal(
    workerHost[HOST.OPFS_READ_CHUNK](
      sourceId,
      workerSourceReadOffset,
      workerSourceReadLen,
      workerSourceReadDest,
    ),
    workerSourceReadLen,
  );
  assert.deepEqual(
    readBytes(workerHost.memory, workerSourceReadDest, workerSourceReadBufferLen),
    expectedWorkerSourceReadBytes,
  );
  const workerSourceNameLen = writeString(
    workerFixture.mainMemory,
    workerSourceNamePtr,
    workerSourceName,
  );

  assert.throws(
    () => workerFixture.mainHost[HOST.OPFS_SOURCE_OPEN](
      workerSourceNamePtr,
      workerSourceNameLen,
    ),
    workerSourceMissingPattern,
    "worker-created selected-file sources should not be durable in the main host",
  );
}

async function checkDurableIndexAcrossHosts() {
  const fixtureMemoryPageCount = 2;
  const mainMemory = new WebAssembly.Memory({ initial: fixtureMemoryPageCount });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const workerHost = fixture.createWorkerHost();
  const indexName = "indexes/trace.idx";
  const workerIndexBytes = new Uint8Array([21, 22, 23, 24]);
  const workerIndexWriteOffset = 2n;
  const expectedWorkerIndexId = 222;
  const expectedMainIndexSize = workerIndexWriteOffset + BigInt(workerIndexBytes.byteLength);
  const mainIndexReadDest = 120;
  const expectedMainIndexReadBytes = [
    ...Array(Number(workerIndexWriteOffset)).fill(0),
    ...workerIndexBytes,
  ];
  const mainIndexReadLen = expectedMainIndexReadBytes.length;
  const reader = await makeFreshMainThreadIndexReader({
    bytes: workerIndexBytes,
    fixture,
    indexName,
    offset: workerIndexWriteOffset,
    workerHost,
  });

  assert.equal(reader.workerIndexId, expectedWorkerIndexId);
  assert.equal(reader.size(), expectedMainIndexSize);
  assert.equal(
    reader.rawRead({
      destPtr: mainIndexReadDest,
      len: mainIndexReadLen,
    }),
    mainIndexReadLen,
  );
  assert.deepEqual(
    readBytes(mainMemory, mainIndexReadDest, mainIndexReadLen),
    expectedMainIndexReadBytes,
  );
  assert.deepEqual(
    fixture.calls.filter((call) => [
      OP.workerPublication,
      OP.mainThreadIndexOpen,
      OP.mainThreadIndexRead,
    ].includes(call.op)).map((call) => [call.host, call.op, call.name]),
    [
      [WORKER_HOST_ROLE, OP.workerPublication, indexName],
      [MAIN_HOST_ROLE, OP.mainThreadIndexOpen, indexName],
      [MAIN_HOST_ROLE, OP.mainThreadIndexRead, indexName],
    ],
  );
}

async function checkTypedScenarioHelpers() {
  const fixtureMemoryPageCount = 2;
  const mainMemory = new WebAssembly.Memory({ initial: fixtureMemoryPageCount });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const selected = [];
  const selectedFileBytes = new Uint8Array([31, 32, 33, 34]);
  const selectedFileName = "scenario.json";
  const selectedFileHandle = 91;
  const selectedFileAcceptPointer = 8;
  const selectedFileAcceptValue = ".json";
  const selectedFile = {
    bytes: selectedFileBytes,
    name: selectedFileName,
  };
  const expectedSelectedFileSourceName = `sources/${selectedFileName}`;
  const acceptLen = writeString(
    mainMemory,
    selectedFileAcceptPointer,
    selectedFileAcceptValue,
  );

  fixture.mainHost.setFileSelectedCallback((event) => selected.push(event));
  const picker = fixture.mainHost[HOST.FILE_PICKER_OPEN](
    selectedFileAcceptPointer,
    acceptLen,
  );

  assert.equal(
    fixture.scenario.selectedFileIngest({ file: selectedFile, handle: selectedFileHandle }),
    selectedFileHandle,
  );
  assert.equal(await picker, selectedFileHandle);
  await Promise.resolve();
  assert.deepEqual(selected, [{ file: selectedFile, handle: selectedFileHandle }]);
  assert.ok(
    fixture.calls.some(
      (call) => call.host === MAIN_HOST_ROLE &&
        call.op === OP.selectedFileIngest &&
        call.handle === selectedFileHandle,
    ),
    "typed selected-file ingest helper should record the named scenario operation",
  );

  const workerHost = fixture.createWorkerHost();
  const workerPublicationIndexName = "indexes/scenario.idx";
  const workerPublicationBytes = new Uint8Array([41, 42, 43, 44]);
  const expectedWorkerPublicationIndexId = 222;
  const expectedMainThreadIndexId = 122;
  const mainThreadReadLength = workerPublicationBytes.byteLength;
  const mainThreadReadDestinationPointer = 120;
  const expectedMainThreadReadBytes = Array.from(workerPublicationBytes);

  assert.equal(
    await fixture.scenario.workerIndexGeneration({
      bytes: workerPublicationBytes,
      indexName: workerPublicationIndexName,
      workerHost,
    }),
    expectedWorkerPublicationIndexId,
  );
  const mainIndexId = fixture.scenario.mainThreadIndexOpen({
    indexName: workerPublicationIndexName,
  });

  assert.equal(mainIndexId, expectedMainThreadIndexId);
  assert.equal(
    fixture.scenario.mainThreadIndexRead({
      indexId: mainIndexId,
      len: mainThreadReadLength,
    }),
    mainThreadReadLength,
  );
  assert.deepEqual(
    readBytes(mainMemory, mainThreadReadDestinationPointer, mainThreadReadLength),
    expectedMainThreadReadBytes,
  );
  assert.deepEqual(
    fixture.calls.filter((call) => [
      OP.selectedFileIngest,
      ...WORKER_INDEX_GENERATION_HANDOFF_OPERATIONS,
      OP.mainThreadIndexOpen,
      OP.mainThreadIndexRead,
    ].includes(call.op)).map((call) => [call.host, call.op, call.name ?? call.messageType]),
    [
      [MAIN_HOST_ROLE, OP.selectedFileIngest, expectedSelectedFileSourceName],
      [WORKER_HOST_ROLE, OP.indexCreate, workerPublicationIndexName],
      [WORKER_HOST_ROLE, OP.indexWrite, workerPublicationIndexName],
      [WORKER_HOST_ROLE, OP.indexFlush, workerPublicationIndexName],
      [WORKER_HOST_ROLE, OP.workerPublication, workerPublicationIndexName],
      [MAIN_HOST_ROLE, OP.mainThreadIndexOpen, workerPublicationIndexName],
      [MAIN_HOST_ROLE, OP.mainThreadIndexRead, workerPublicationIndexName],
    ],
  );

  let delivered = null;
  const workerMessageIngestId = 1;
  const workerMessageType = "progress";
  const workerMessage = { ingestId: workerMessageIngestId, type: workerMessageType };
  const expectedWorkerMessageDeliveryResult = true;
  const expectedWorkerMessageEmitType = WORKER_EVENT.EVENT_MESSAGE;

  assert.equal(
    fixture.scenario.workerMessageDelivery({
      message: workerMessage,
      worker: {
        emit(type, message) {
          delivered = { message, type };
        },
      },
    }),
    expectedWorkerMessageDeliveryResult,
  );
  assert.deepEqual(delivered, {
    message: workerMessage,
    type: expectedWorkerMessageEmitType,
  });
}

async function checkTypedScenarioOrderGuards() {
  const orderGuardMemoryPageCount = 2;
  const mainMemory = new WebAssembly.Memory({ initial: orderGuardMemoryPageCount });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const workerHost = fixture.createWorkerHost();
  const indexName = "indexes/out-of-order.idx";
  const workerIndexNamePointer = 16;
  const workerWriteBytes = new Uint8Array([51, 52]);
  const workerWritePointer = 96;
  const workerWriteOffset = 0n;
  const workerWriteLength = workerWriteBytes.byteLength;
  const expectedWorkerWriteCount = workerWriteLength;
  const expectedFlushResult = 0;
  const mainThreadReadLengthBeforeOpen = workerWriteLength;
  const noSelectionWorkerMessageIngestId = 1;
  const noSelectionWorkerMessageType = "progress";
  const noSelectionWorkerMessage = {
    ingestId: noSelectionWorkerMessageIngestId,
    type: noSelectionWorkerMessageType,
  };
  const expectedCreateBeforePublicationError = {
    message: `${OP.mainThreadIndexOpen}: worker must create OPFS index ${indexName} before publication`,
  };
  const expectedFlushBeforeHandoffError = {
    message: `${OP.mainThreadIndexOpen}: worker must flush OPFS index ${indexName} before main-thread handoff`,
  };
  const expectedBytesBeforePublicationError = {
    message: `worker publication requires worker OPFS index ${indexName} to contain bytes`,
  };
  const expectedNoSelectionMessageError = {
    message: `${OP.workerMessageDelivery} requires selected-file ingest first`,
  };

  assert.throws(
    () => fixture.scenario.mainThreadIndexOpen({ indexName }),
    expectedCreateBeforePublicationError,
    "main-thread open helper should reject indexes the worker has not created",
  );

  const nameLen = writeString(workerHost.memory, workerIndexNamePointer, indexName);
  const workerIndexId = workerHost[HOST.OPFS_INDEX_CREATE](workerIndexNamePointer, nameLen);

  assert.throws(
    () => fixture.scenario.mainThreadIndexOpen({ indexName }),
    expectedFlushBeforeHandoffError,
    "main-thread open helper should reject unflushed worker indexes",
  );
  await assert.rejects(
    () => fixture.scenario.workerPublication({ indexName }),
    expectedBytesBeforePublicationError,
    "worker publication helper should reject empty indexes",
  );

  new Uint8Array(workerHost.memory.buffer, workerWritePointer, workerWriteLength).set(
    workerWriteBytes,
  );
  assert.equal(
    workerHost[HOST.OPFS_INDEX_WRITE](
      workerIndexId,
      workerWriteOffset,
      workerWritePointer,
      workerWriteLength,
    ),
    expectedWorkerWriteCount,
  );
  assert.throws(
    () => fixture.scenario.mainThreadIndexOpen({ indexName }),
    expectedFlushBeforeHandoffError,
    "main-thread open helper should reject unflushed worker indexes",
  );
  assert.equal(await workerHost[HOST.OPFS_INDEX_FLUSH](workerIndexId), expectedFlushResult);
  assert.equal(await fixture.scenario.workerPublication({ indexName }), workerIndexId);
  assert.throws(
    () => fixture.scenario.mainThreadIndexRead({
      indexId: workerIndexId,
      len: mainThreadReadLengthBeforeOpen,
    }),
    { message: `${OP.mainThreadIndexRead}: main thread must open OPFS index before read` },
    "main-thread read helper should reject reads before a typed main-thread open",
  );

  const noSelectionFixture = makeProductionTopologyFixture();

  assert.throws(
    () => noSelectionFixture.scenario.workerMessageDelivery({
      message: noSelectionWorkerMessage,
      worker: { emit() {} },
    }),
    expectedNoSelectionMessageError,
    "worker message helper should reject delivery before selected-file ingest",
  );
}

async function checkWorkerMessageDeliveryRequiresActiveIngest() {
  const activeIngestMemoryPageCount = 2;
  const mainMemory = new WebAssembly.Memory({ initial: activeIngestMemoryPageCount });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const selectedFileBytes = new Uint8Array([81, 82]);
  const selectedFileName = "active-ingest.json";
  const selectedFileHandle = 93;
  const selectedFileAcceptPointer = 8;
  const selectedFileAcceptValue = ".json";
  const firstSelectedFileIngestId = 1;
  const workerMessageType = "progress";
  const workerMessage = {
    ingestId: firstSelectedFileIngestId,
    type: workerMessageType,
  };
  const expectedCallbackBeforeDeliveryError = {
    message: `${OP.workerMessageDelivery} requires selected-file callback for ingest ${firstSelectedFileIngestId} to run before worker message delivery`,
  };
  const selectedFile = {
    bytes: selectedFileBytes,
    name: selectedFileName,
  };
  const acceptLen = writeString(
    mainMemory,
    selectedFileAcceptPointer,
    selectedFileAcceptValue,
  );
  let callbackRan = false;
  let delivered = null;
  const worker = {
    emit(type, message) {
      delivered = { message, type };
    },
  };

  fixture.mainHost.setFileSelectedCallback(() => {
    callbackRan = true;
  });
  const picker = fixture.mainHost[HOST.FILE_PICKER_OPEN](
    selectedFileAcceptPointer,
    acceptLen,
  );

  assert.equal(
    fixture.scenario.selectedFileIngest({ file: selectedFile, handle: selectedFileHandle }),
    selectedFileHandle,
  );
  assert.equal(callbackRan, false);
  assert.throws(
    () => fixture.scenario.workerMessageDelivery({
      message: workerMessage,
      worker,
    }),
    expectedCallbackBeforeDeliveryError,
    "worker message delivery should reject a selected-file ingest before its callback runs",
  );
  assert.equal(await picker, selectedFileHandle);
  await Promise.resolve();
  assert.equal(callbackRan, true);
  assert.equal(
    fixture.scenario.workerMessageDelivery({
      message: workerMessage,
      worker,
    }),
    true,
  );
  assert.deepEqual(delivered, {
    message: workerMessage,
    type: WORKER_EVENT.EVENT_MESSAGE,
  });
}

async function checkWorkerMessageDeliveryRejectsRetiredIngests() {
  const retiredIngestMemoryPageCount = 2;
  const mainMemory = new WebAssembly.Memory({ initial: retiredIngestMemoryPageCount });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const workerHost = fixture.createWorkerHost();
  const firstSelectedFileBytes = new Uint8Array([81, 82]);
  const firstSelectedFileName = "retired-ingest-first.json";
  const firstSelectedFileHandle = 93;
  const firstIndexName = indexPathForTraceName(firstSelectedFileName);
  const secondSelectedFileBytes = new Uint8Array([83, 84]);
  const secondSelectedFileName = "retired-ingest-second.json";
  const secondSelectedFileHandle = 94;
  const selectedFileAcceptPointer = 8;
  const selectedFileAcceptValue = ".json";
  const firstSelectedFileIngestId = 1;
  const secondSelectedFileIngestId = 2;
  const completeMessage = {
    ingestId: firstSelectedFileIngestId,
    type: WORKER_MESSAGE.COMPLETE,
  };
  const staleProgressAfterCompleteMessage = {
    ingestId: firstSelectedFileIngestId,
    type: WORKER_MESSAGE.PROGRESS,
  };
  const staleProgressAfterNewSelectionMessage = {
    ingestId: firstSelectedFileIngestId,
    type: WORKER_MESSAGE.PROGRESS,
  };
  const activeProgressMessage = {
    ingestId: secondSelectedFileIngestId,
    type: WORKER_MESSAGE.PROGRESS,
  };
  const expectedFirstIngestNoLongerActiveError = new RegExp(
    `${OP.workerMessageDelivery} requires worker message ingestId ${firstSelectedFileIngestId} to match the current active selected-file ingest`,
  );
  const firstSelectedFile = {
    bytes: firstSelectedFileBytes,
    name: firstSelectedFileName,
  };
  const secondSelectedFile = {
    bytes: secondSelectedFileBytes,
    name: secondSelectedFileName,
  };
  const acceptLen = writeString(
    mainMemory,
    selectedFileAcceptPointer,
    selectedFileAcceptValue,
  );
  const delivered = [];
  const worker = {
    emit(type, message) {
      delivered.push({ message, type });
    },
  };

  fixture.mainHost.setFileSelectedCallback(() => {});
  const firstPicker = fixture.mainHost[HOST.FILE_PICKER_OPEN](
    selectedFileAcceptPointer,
    acceptLen,
  );

  assert.equal(
    fixture.scenario.selectedFileIngest({
      file: firstSelectedFile,
      handle: firstSelectedFileHandle,
    }),
    firstSelectedFileHandle,
  );
  assert.equal(await firstPicker, firstSelectedFileHandle);
  await Promise.resolve();
  await fixture.scenario.workerIndexGeneration({
    bytes: firstSelectedFileBytes,
    indexName: firstIndexName,
    workerHost,
  });
  assert.equal(
    fixture.scenario.workerMessageDelivery({
      message: completeMessage,
      worker,
    }),
    true,
    "terminal complete should deliver for the current active ingest",
  );
  assert.throws(
    () => fixture.scenario.workerMessageDelivery({
      message: staleProgressAfterCompleteMessage,
      worker,
    }),
    expectedFirstIngestNoLongerActiveError,
    "worker message delivery should reject messages for an ingest retired by complete",
  );

  const secondPicker = fixture.mainHost[HOST.FILE_PICKER_OPEN](
    selectedFileAcceptPointer,
    acceptLen,
  );

  assert.equal(
    fixture.scenario.selectedFileIngest({
      file: secondSelectedFile,
      handle: secondSelectedFileHandle,
    }),
    secondSelectedFileHandle,
  );
  assert.equal(await secondPicker, secondSelectedFileHandle);
  await Promise.resolve();
  assert.throws(
    () => fixture.scenario.workerMessageDelivery({
      message: staleProgressAfterNewSelectionMessage,
      worker,
    }),
    expectedFirstIngestNoLongerActiveError,
    "worker message delivery should reject messages for an ingest superseded by a newer selection",
  );
  assert.equal(
    fixture.scenario.workerMessageDelivery({
      message: activeProgressMessage,
      worker,
    }),
    true,
    "worker message delivery should still accept the current active ingest",
  );
  assert.deepEqual(delivered, [
    {
      message: completeMessage,
      type: WORKER_EVENT.EVENT_MESSAGE,
    },
    {
      message: activeProgressMessage,
      type: WORKER_EVENT.EVENT_MESSAGE,
    },
  ]);
}

async function checkWorkerMessageDeliveryRequiresPublishedCompleteIndex() {
  const completeMessageMemoryPageCount = 2;
  const mainMemory = new WebAssembly.Memory({ initial: completeMessageMemoryPageCount });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const workerHost = fixture.createWorkerHost();
  const selectedFileBytes = new Uint8Array([81, 82]);
  const selectedFileName = "complete-before-publication.json";
  const selectedFileHandle = 93;
  const selectedFileAcceptPointer = 8;
  const selectedFileAcceptValue = ".json";
  const activeIndexName = indexPathForTraceName(selectedFileName);
  const unrelatedIndexName = indexPathForTraceName("unrelated-complete.json");
  const unrelatedIndexBytes = new Uint8Array([83, 84]);
  const workerIndexNamePointer = 16;
  const workerWritePointer = 96;
  const indexWriteOffset = 0n;
  const expectedFlushResult = 0;
  const firstSelectedFileIngestId = 1;
  const completeMessage = {
    ingestId: firstSelectedFileIngestId,
    type: WORKER_MESSAGE.COMPLETE,
  };
  const expectedPublishBeforeCompleteError = {
    message: `${OP.workerMessageDelivery}: worker must publish OPFS index ${activeIndexName} before main-thread handoff`,
  };
  const expectedUnrelatedIndexError =
    /requires worker message index .* to match active selected-file ingest index/;
  const selectedFile = {
    bytes: selectedFileBytes,
    name: selectedFileName,
  };
  let delivered = null;
  const worker = {
    emit(type, message) {
      delivered = { message, type };
    },
  };
  const acceptLen = writeString(
    mainMemory,
    selectedFileAcceptPointer,
    selectedFileAcceptValue,
  );

  fixture.mainHost.setFileSelectedCallback(() => {});
  const picker = fixture.mainHost[HOST.FILE_PICKER_OPEN](
    selectedFileAcceptPointer,
    acceptLen,
  );

  assert.equal(
    fixture.scenario.selectedFileIngest({ file: selectedFile, handle: selectedFileHandle }),
    selectedFileHandle,
  );
  assert.equal(await picker, selectedFileHandle);
  await Promise.resolve();

  await fixture.scenario.workerIndexGeneration({
    bytes: unrelatedIndexBytes,
    indexName: unrelatedIndexName,
    workerHost,
  });
  assert.throws(
    () => fixture.scenario.workerMessageDelivery({
      indexName: unrelatedIndexName,
      message: completeMessage,
      worker,
    }),
    expectedUnrelatedIndexError,
    "complete delivery should reject an unrelated published index from the helper argument",
  );

  const nameLen = writeString(workerHost.memory, workerIndexNamePointer, activeIndexName);
  const workerIndexId = workerHost[HOST.OPFS_INDEX_CREATE](
    workerIndexNamePointer,
    nameLen,
  );

  new Uint8Array(
    workerHost.memory.buffer,
    workerWritePointer,
    selectedFileBytes.byteLength,
  ).set(selectedFileBytes);
  assert.equal(
    workerHost[HOST.OPFS_INDEX_WRITE](
      workerIndexId,
      indexWriteOffset,
      workerWritePointer,
      selectedFileBytes.byteLength,
    ),
    selectedFileBytes.byteLength,
  );
  assert.equal(await workerHost[HOST.OPFS_INDEX_FLUSH](workerIndexId), expectedFlushResult);
  assert.throws(
    () => fixture.scenario.workerMessageDelivery({
      message: completeMessage,
      worker,
    }),
    expectedPublishBeforeCompleteError,
    "complete delivery should reject unpublished worker index handoffs",
  );
  assert.equal(delivered, null);

  assert.equal(
    await fixture.scenario.workerPublication({ indexName: activeIndexName }),
    workerIndexId,
  );
  assert.equal(
    fixture.scenario.workerMessageDelivery({
      message: completeMessage,
      worker,
    }),
    true,
    "complete delivery should accept the active ingest index after publication",
  );
  assert.deepEqual(delivered, {
    message: completeMessage,
    type: WORKER_EVENT.EVENT_MESSAGE,
  });
}

async function checkWorkerMessageDeliveryRequiresPublishedCoveredRangeIndex() {
  const coveredRangeMemoryPageCount = 2;
  const mainMemory = new WebAssembly.Memory({ initial: coveredRangeMemoryPageCount });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const selectedFileName = "covered-range.json";
  const selectedFileBytes = new Uint8Array([81, 82]);
  const selectedFileHandle = 93;
  const selectedFileAcceptPointer = 8;
  const selectedFileAcceptValue = ".json";
  const indexName = indexPathForTraceName(selectedFileName);
  const workerIndexNamePointer = 16;
  const workerWritePointer = 96;
  const indexWriteOffset = 0n;
  const expectedFlushResult = 0;
  const firstSelectedFileIngestId = 1;
  const coveredRangeMessage = {
    end: selectedFileBytes.byteLength,
    ingestId: firstSelectedFileIngestId,
    start: 0,
    type: WORKER_MESSAGE.COVERED_RANGE,
  };
  const expectedCreateBeforeMessageError = {
    message: `${OP.workerMessageDelivery}: worker must create OPFS index ${indexName} before publication`,
  };
  const expectedPublishBeforeMessageError = {
    message: `${OP.workerMessageDelivery}: worker must publish OPFS index ${indexName} before main-thread handoff`,
  };
  const selectedFile = {
    bytes: selectedFileBytes,
    name: selectedFileName,
  };
  let delivered = null;
  const expectedWorkerMessageEmitType = "message";
  const worker = {
    emit(type, message) {
      delivered = { message, type };
    },
  };
  const acceptLen = writeString(
    mainMemory,
    selectedFileAcceptPointer,
    selectedFileAcceptValue,
  );

  fixture.mainHost.setFileSelectedCallback(() => {});
  const picker = fixture.mainHost[HOST.FILE_PICKER_OPEN](
    selectedFileAcceptPointer,
    acceptLen,
  );

  assert.equal(
    fixture.scenario.selectedFileIngest({ file: selectedFile, handle: selectedFileHandle }),
    selectedFileHandle,
  );
  assert.equal(await picker, selectedFileHandle);
  await Promise.resolve();
  assert.throws(
    () => fixture.scenario.workerMessageDelivery({
      indexName,
      message: coveredRangeMessage,
      worker,
    }),
    expectedCreateBeforeMessageError,
    "covered_range delivery should reject missing worker index handoffs",
  );

  const workerHost = fixture.createWorkerHost();
  const nameLen = writeString(workerHost.memory, workerIndexNamePointer, indexName);
  const workerIndexId = workerHost[HOST.OPFS_INDEX_CREATE](
    workerIndexNamePointer,
    nameLen,
  );

  new Uint8Array(
    workerHost.memory.buffer,
    workerWritePointer,
    selectedFileBytes.byteLength,
  ).set(selectedFileBytes);
  assert.equal(
    workerHost[HOST.OPFS_INDEX_WRITE](
      workerIndexId,
      indexWriteOffset,
      workerWritePointer,
      selectedFileBytes.byteLength,
    ),
    selectedFileBytes.byteLength,
  );
  assert.equal(await workerHost[HOST.OPFS_INDEX_FLUSH](workerIndexId), expectedFlushResult);
  assert.throws(
    () => fixture.scenario.workerMessageDelivery({
      indexName,
      message: coveredRangeMessage,
      worker,
    }),
    expectedPublishBeforeMessageError,
    "covered_range delivery should reject unpublished worker index handoffs",
  );

  assert.equal(await fixture.scenario.workerPublication({ indexName }), workerIndexId);
  assert.equal(
    fixture.scenario.workerMessageDelivery({
      indexName,
      message: coveredRangeMessage,
      worker,
    }),
    true,
  );
  assert.deepEqual(delivered, {
    message: coveredRangeMessage,
    type: expectedWorkerMessageEmitType,
  });
}

async function checkWorkerMessageDeliveryRejectsUnrelatedCoveredRangeIndex() {
  const coveredRangeMemoryPageCount = 2;
  const mainMemory = new WebAssembly.Memory({ initial: coveredRangeMemoryPageCount });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const workerHost = fixture.createWorkerHost();
  const selectedFileName = "active-covered-range.json";
  const selectedFileBytes = new Uint8Array([81, 82]);
  const selectedFileHandle = 93;
  const selectedFileAcceptPointer = 8;
  const selectedFileAcceptValue = ".json";
  const activeIndexName = indexPathForTraceName(selectedFileName);
  const unrelatedIndexName = indexPathForTraceName("unrelated-covered-range.json");
  const unrelatedIndexBytes = new Uint8Array([83, 84]);
  const firstSelectedFileIngestId = 1;
  const coveredRangeMessage = {
    end: selectedFileBytes.byteLength,
    ingestId: firstSelectedFileIngestId,
    start: 0,
    type: WORKER_MESSAGE.COVERED_RANGE,
  };
  const coveredRangeMessageWithUnrelatedIndex = {
    ...coveredRangeMessage,
    indexName: unrelatedIndexName,
  };
  const expectedUnrelatedIndexError =
    /requires worker message index .* to match active selected-file ingest index/;
  const selectedFile = {
    bytes: selectedFileBytes,
    name: selectedFileName,
  };
  let delivered = null;
  const worker = {
    emit(type, message) {
      delivered = { message, type };
    },
  };
  const acceptLen = writeString(
    mainMemory,
    selectedFileAcceptPointer,
    selectedFileAcceptValue,
  );

  fixture.mainHost.setFileSelectedCallback(() => {});
  const picker = fixture.mainHost[HOST.FILE_PICKER_OPEN](
    selectedFileAcceptPointer,
    acceptLen,
  );

  assert.equal(
    fixture.scenario.selectedFileIngest({ file: selectedFile, handle: selectedFileHandle }),
    selectedFileHandle,
  );
  assert.equal(await picker, selectedFileHandle);
  await Promise.resolve();
  await fixture.scenario.workerIndexGeneration({
    bytes: unrelatedIndexBytes,
    indexName: unrelatedIndexName,
    workerHost,
  });
  assert.throws(
    () => fixture.scenario.workerMessageDelivery({
      message: coveredRangeMessageWithUnrelatedIndex,
      worker,
    }),
    expectedUnrelatedIndexError,
    "covered_range delivery should reject an unrelated published index from the message payload",
  );
  assert.throws(
    () => fixture.scenario.workerMessageDelivery({
      indexName: unrelatedIndexName,
      message: coveredRangeMessage,
      worker,
    }),
    expectedUnrelatedIndexError,
    "covered_range delivery should reject an unrelated published index from the helper argument",
  );
  await fixture.scenario.workerIndexGeneration({
    bytes: selectedFileBytes,
    indexName: activeIndexName,
    workerHost,
  });
  assert.equal(
    fixture.scenario.workerMessageDelivery({
      indexName: activeIndexName,
      message: coveredRangeMessage,
      worker,
    }),
    true,
    "covered_range delivery should accept the active ingest index after publication",
  );
  assert.deepEqual(delivered, {
    message: coveredRangeMessage,
    type: WORKER_EVENT.EVENT_MESSAGE,
  });
}

async function checkWorkerHandoffGenerationReset() {
  const generationResetMemoryPageCount = 2;
  const mainMemory = new WebAssembly.Memory({ initial: generationResetMemoryPageCount });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const workerHost = fixture.createWorkerHost();
  const indexName = "indexes/reused-worker.idx";
  const workerIndexNamePointer = 16;
  const firstWriteBytes = new Uint8Array([61, 62]);
  const firstWritePointer = 96;
  const secondWriteBytes = new Uint8Array([63, 64]);
  const secondWritePointer = 100;
  const indexWriteOffset = 0n;
  const secondWriteLength = secondWriteBytes.byteLength;
  const expectedSecondWriteCount = secondWriteLength;
  const expectedFlushResult = 0;
  const expectedFlushBeforeHandoffError = {
    message: `${OP.mainThreadIndexOpen}: worker must flush OPFS index ${indexName} before main-thread handoff`,
  };
  const expectedPublishBeforeHandoffError = {
    message: `${OP.mainThreadIndexOpen}: worker must publish OPFS index ${indexName} before main-thread handoff`,
  };
  const nameLen = writeString(workerHost.memory, workerIndexNamePointer, indexName);
  const firstIndexId = await fixture.scenario.workerIndexGeneration({
    bytes: firstWriteBytes,
    indexName,
    srcPtr: firstWritePointer,
    workerHost,
  });

  new Uint8Array(workerHost.memory.buffer, secondWritePointer, secondWriteLength).set(secondWriteBytes);
  assert.equal(
    workerHost[HOST.OPFS_INDEX_WRITE](
      firstIndexId,
      indexWriteOffset,
      secondWritePointer,
      secondWriteLength,
    ),
    expectedSecondWriteCount,
  );
  assert.throws(
    () => fixture.scenario.mainThreadIndexOpen({ indexName }),
    expectedFlushBeforeHandoffError,
    "worker writes should clear flushed state from a previously published generation",
  );
  assert.equal(await workerHost[HOST.OPFS_INDEX_FLUSH](firstIndexId), expectedFlushResult);
  assert.throws(
    () => fixture.scenario.mainThreadIndexOpen({ indexName }),
    expectedPublishBeforeHandoffError,
    "worker writes should clear published state from a previously published generation",
  );
  assert.equal(await fixture.scenario.workerPublication({ indexName }), firstIndexId);

  const secondIndexId = workerHost[HOST.OPFS_INDEX_CREATE](workerIndexNamePointer, nameLen);

  assert.notEqual(secondIndexId, firstIndexId);
  assert.throws(
    () => fixture.scenario.mainThreadIndexOpen({ indexName }),
    expectedFlushBeforeHandoffError,
    "worker index recreate should reset flushed and published handoff state",
  );
}

async function checkWorkerPublicationRequiresWrittenBytes() {
  const workerPublicationMemoryPageCount = 2;
  const workerIndexName = "indexes/zero-byte-write.idx";
  const workerIndexNamePointer = 16;
  const indexWriteOffset = 0n;
  const zeroByteWritePointer = 96;
  const zeroByteWriteLength = 0;
  const expectedZeroByteWriteCount = zeroByteWriteLength;
  const expectedFlushResult = 0;
  const escapedWorkerIndexName = workerIndexName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expectedPublicationWithoutBytesError = new RegExp(
    `worker publication requires worker OPFS index ${escapedWorkerIndexName} to contain bytes`,
  );
  const mainMemory = new WebAssembly.Memory({ initial: workerPublicationMemoryPageCount });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const workerHost = fixture.createWorkerHost();
  const createWorkerIndex = () => {
    const nameLen = writeString(workerHost.memory, workerIndexNamePointer, workerIndexName);

    return workerHost[HOST.OPFS_INDEX_CREATE](workerIndexNamePointer, nameLen);
  };
  const workerIndexId = createWorkerIndex();

  assert.equal(
    workerHost[HOST.OPFS_INDEX_WRITE](
      workerIndexId,
      indexWriteOffset,
      zeroByteWritePointer,
      zeroByteWriteLength,
    ),
    expectedZeroByteWriteCount,
  );
  assert.equal(await workerHost[HOST.OPFS_INDEX_FLUSH](workerIndexId), expectedFlushResult);
  await assert.rejects(
    () => fixture.scenario.workerPublication({ indexName: workerIndexName }),
    expectedPublicationWithoutBytesError,
    "zero-length worker writes should not satisfy the publication contains-bytes guard",
  );
}

async function checkWorkerPublicationRequiresCurrentGenerationBytes() {
  const workerPublicationMemoryPageCount = 2;
  const workerIndexName = "indexes/zero-byte-republish.idx";
  const workerIndexNamePointer = 16;
  const indexWriteOffset = 0n;
  const firstWriteBytes = new Uint8Array([67, 68]);
  const firstWritePointer = 96;
  const zeroByteWritePointer = 100;
  const zeroByteWriteLength = 0;
  const expectedZeroByteWriteCount = zeroByteWriteLength;
  const expectedFlushResult = 0;
  const escapedWorkerIndexName = workerIndexName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expectedPublicationWithoutCurrentBytesError = new RegExp(
    `worker publication requires worker OPFS index ${escapedWorkerIndexName} to contain bytes`,
  );
  const mainMemory = new WebAssembly.Memory({ initial: workerPublicationMemoryPageCount });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const workerHost = fixture.createWorkerHost();
  const workerIndexId = await fixture.scenario.workerIndexGeneration({
    bytes: firstWriteBytes,
    indexName: workerIndexName,
    namePtr: workerIndexNamePointer,
    srcPtr: firstWritePointer,
    workerHost,
  });

  assert.equal(
    workerHost[HOST.OPFS_INDEX_WRITE](
      workerIndexId,
      indexWriteOffset,
      zeroByteWritePointer,
      zeroByteWriteLength,
    ),
    expectedZeroByteWriteCount,
  );
  assert.equal(await workerHost[HOST.OPFS_INDEX_FLUSH](workerIndexId), expectedFlushResult);
  await assert.rejects(
    () => fixture.scenario.workerPublication({ indexName: workerIndexName }),
    expectedPublicationWithoutCurrentBytesError,
    "zero-length writes after publication should not reuse bytes from an older generation",
  );
}

async function checkTypedScenarioChronology() {
  const chronologyMemoryPageCount = 2;
  const earlyIndexName = "indexes/early-open.idx";
  const earlyIndexNamePointer = 16;
  const earlyWorkerWriteBytes = new Uint8Array([71]);
  const earlyWorkerWritePointer = 96;
  const indexWriteOffset = 0n;
  const expectedFlushSuccess = 0;
  const expectedEarlyWriteCount = earlyWorkerWriteBytes.byteLength;
  const escapedEarlyIndexName = earlyIndexName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expectedEarlyOpenBeforePublicationError =
    new RegExp(`main-thread index open must wait for worker publication of ${escapedEarlyIndexName}`);
  const mainMemory = new WebAssembly.Memory({ initial: chronologyMemoryPageCount });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const workerHost = fixture.createWorkerHost();
  const earlyNameLen = writeString(workerHost.memory, earlyIndexNamePointer, earlyIndexName);
  const earlyWorkerIndexId = workerHost[HOST.OPFS_INDEX_CREATE](earlyIndexNamePointer, earlyNameLen);

  new Uint8Array(workerHost.memory.buffer, earlyWorkerWritePointer, earlyWorkerWriteBytes.byteLength)
    .set(earlyWorkerWriteBytes);
  assert.equal(
    workerHost[HOST.OPFS_INDEX_WRITE](
      earlyWorkerIndexId,
      indexWriteOffset,
      earlyWorkerWritePointer,
      earlyWorkerWriteBytes.byteLength,
    ),
    expectedEarlyWriteCount,
  );
  assert.equal(await workerHost[HOST.OPFS_INDEX_FLUSH](earlyWorkerIndexId), expectedFlushSuccess);
  const earlyMainNameLen = writeString(mainMemory, earlyIndexNamePointer, earlyIndexName);

  assert.throws(
    () => fixture.mainHost[HOST.OPFS_INDEX_OPEN](earlyIndexNamePointer, earlyMainNameLen),
    expectedEarlyOpenBeforePublicationError,
    "raw main-thread open should reject flushed but unpublished worker indexes",
  );
  assert.equal(await fixture.scenario.workerPublication({ indexName: earlyIndexName }), earlyWorkerIndexId);
  const earlyMainIndexId = fixture.scenario.mainThreadIndexOpen({ indexName: earlyIndexName });

  assert.equal(
    fixture.scenario.mainThreadIndexOpen({
      indexName: earlyIndexName,
      observeOnly: true,
    }),
    earlyMainIndexId,
  );
  const typedEarlyOpen = fixture.calls.find(
    (call) => call.host === MAIN_HOST_ROLE &&
      call.op === OP.mainThreadIndexOpen &&
      call.name === earlyIndexName,
  );

  assert.equal(
    typedEarlyOpen.sourceCallIndex,
    fixture.calls.findIndex(
      (call) => call.host === MAIN_HOST_ROLE &&
        call.op === OP.indexOpen &&
        call.name === earlyIndexName,
    ),
    "observe-only open should carry the original valid raw open index",
  );

  const readIndexName = "indexes/read-order.idx";
  const readWorkerWriteBytes = new Uint8Array([72]);
  const readWorkerWritePointer = 104;
  const rawReadOffset = 0n;
  const rawReadLength = readWorkerWriteBytes.byteLength;
  const rawReadDestinationPointer = 120;
  const expectedRawReadCount = rawReadLength;
  await fixture.scenario.workerIndexGeneration({
    bytes: readWorkerWriteBytes,
    indexName: readIndexName,
    srcPtr: readWorkerWritePointer,
    workerHost,
  });
  const readMainIndexId = fixture.scenario.mainThreadIndexOpen({ indexName: readIndexName });

  assert.equal(
    fixture.mainHost[HOST.OPFS_INDEX_READ](
      readMainIndexId,
      rawReadOffset,
      rawReadLength,
      rawReadDestinationPointer,
    ),
    expectedRawReadCount,
  );
  const laterIndexName = "indexes/later-marker.idx";
  const laterMarkerBytes = new Uint8Array([73]);
  const observeOnlyReadLength = rawReadLength;
  const expectedObserveOnlyReadCount = observeOnlyReadLength;

  await fixture.scenario.workerIndexGeneration({
    bytes: laterMarkerBytes,
    indexName: laterIndexName,
    workerHost,
  });
  assert.equal(
    fixture.scenario.mainThreadIndexRead({
      indexId: readMainIndexId,
      len: observeOnlyReadLength,
      observeOnly: true,
    }),
    expectedObserveOnlyReadCount,
  );
  const typedOps = fixture.calls.filter((call) => [
    OP.mainThreadIndexRead,
    OP.workerPublication,
  ].includes(call.op));
  const readIndex = typedOps.findIndex(
    (call) => call.op === OP.mainThreadIndexRead && call.name === readIndexName,
  );
  const laterPublicationIndex = typedOps.findIndex(
    (call) => call.op === OP.workerPublication && call.name === laterIndexName,
  );
  const findIndexMissingSentinel = -1;

  assert.notEqual(
    readIndex,
    findIndexMissingSentinel,
    "raw main-thread read should record typed metadata at read time",
  );
  assert.notEqual(
    laterPublicationIndex,
    findIndexMissingSentinel,
    "later publication marker should be present",
  );
  assert.ok(
    readIndex < laterPublicationIndex,
    "typed-only filtering should preserve the raw read chronology",
  );
  const rawReadCallIndex = fixture.calls.findIndex(
    (call) => call.host === MAIN_HOST_ROLE &&
      call.op === OP.indexRead &&
      call.name === readIndexName,
  );

  assert.notEqual(
    rawReadCallIndex,
    findIndexMissingSentinel,
    "raw main-thread index read should be present",
  );
  assert.equal(
    typedOps[readIndex].sourceCallIndex,
    rawReadCallIndex,
    "typed read metadata should carry the original raw read index",
  );
}

async function checkObserveOnlyIndexOpenRejectsStaleRawOpen() {
  const staleOpenMemoryPageCount = 2;
  const mainMemory = new WebAssembly.Memory({ initial: staleOpenMemoryPageCount });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const workerHost = fixture.createWorkerHost();
  const indexName = "indexes/reused.idx";
  const indexNamePointer = 16;
  const workerWriteBytes = new Uint8Array([91]);
  const escapedIndexName = indexName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expectedObserveOnlyStaleOpenError = new RegExp(
    `${OP.mainThreadIndexOpen}: production must open OPFS index ${escapedIndexName}`,
  );
  const mainNameLen = writeString(mainMemory, indexNamePointer, indexName);
  const staleMainIndexId = fixture.mainHost[HOST.OPFS_INDEX_CREATE](
    indexNamePointer,
    mainNameLen,
  );
  const staleOpenIndexId = fixture.mainHost[HOST.OPFS_INDEX_OPEN](
    indexNamePointer,
    mainNameLen,
  );

  assert.notEqual(
    staleOpenIndexId,
    staleMainIndexId,
    "raw main-thread open before worker publication should create a distinct stale id",
  );
  await assert.rejects(
    () => makeFreshMainThreadIndexReader({
      bytes: workerWriteBytes,
      fixture,
      indexName,
      namePtr: indexNamePointer,
      observeOnlyOpen: true,
      workerHost,
    }),
    expectedObserveOnlyStaleOpenError,
    "observe-only open should reject raw main-thread opens from before worker publication",
  );
  const reader = await makeFreshMainThreadIndexReader({
    bytes: workerWriteBytes,
    fixture,
    indexName,
    namePtr: indexNamePointer,
    workerHost,
  });

  assert.equal(
    reader.observeOnlyOpen(),
    reader.mainIndexId,
    "observe-only open should accept raw main-thread opens after worker publication",
  );
}

async function checkRawIndexReadRejectsPreHandoffMainThreadOpen() {
  const preHandoffReadMemoryPageCount = 2;
  const mainMemory = new WebAssembly.Memory({ initial: preHandoffReadMemoryPageCount });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const workerHost = fixture.createWorkerHost();
  const indexName = "indexes/pre-handoff-read.idx";
  const indexNamePointer = 16;
  const workerWriteBytes = new Uint8Array([95]);
  const mainReadOffset = 0n;
  const mainReadLength = workerWriteBytes.byteLength;
  const mainReadDestinationPointer = 120;
  const escapedIndexName = indexName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expectedPreHandoffReadError = new RegExp(
    `${OP.indexRead}: main thread must open OPFS index ${escapedIndexName} after worker publication before read`,
  );
  const mainNameLen = writeString(mainMemory, indexNamePointer, indexName);
  const staleMainIndexId = fixture.mainHost[HOST.OPFS_INDEX_CREATE](
    indexNamePointer,
    mainNameLen,
  );
  const staleOpenIndexId = fixture.mainHost[HOST.OPFS_INDEX_OPEN](
    indexNamePointer,
    mainNameLen,
  );

  assert.notEqual(
    staleOpenIndexId,
    staleMainIndexId,
    "raw main-thread open before worker handoff should create a distinct stale id",
  );
  const reader = await makeFreshMainThreadIndexReader({
    bytes: workerWriteBytes,
    fixture,
    indexName,
    namePtr: indexNamePointer,
    workerHost,
  });
  assert.throws(
    () => fixture.mainHost[HOST.OPFS_INDEX_READ](
      staleOpenIndexId,
      mainReadOffset,
      mainReadLength,
      mainReadDestinationPointer,
    ),
    expectedPreHandoffReadError,
    "raw main-thread read should reject ids opened before the worker handoff existed",
  );

  assert.equal(
    reader.rawRead({
      destPtr: mainReadDestinationPointer,
      len: mainReadLength,
      offset: mainReadOffset,
    }),
    mainReadLength,
    "raw main-thread read should accept an id opened after worker publication",
  );
}

async function checkMainThreadIndexReadRejectsNewerUnpublishedGeneration() {
  const readFreshnessMemoryPageCount = 2;
  const mainMemory = new WebAssembly.Memory({ initial: readFreshnessMemoryPageCount });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const workerHost = fixture.createWorkerHost();
  const indexName = "indexes/read-freshness.idx";
  const firstGenerationBytes = new Uint8Array([101]);
  const secondGenerationBytes = new Uint8Array([102]);
  const secondGenerationWritePointer = 96;
  const indexWriteOffset = 0n;
  const mainReadOffset = 0n;
  const mainReadLength = firstGenerationBytes.byteLength;
  const mainReadDestinationPointer = 120;
  const expectedSecondGenerationWriteCount = secondGenerationBytes.byteLength;
  const escapedIndexName = indexName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expectedRawReadFreshnessError = new RegExp(
    `${OP.indexRead}: worker must flush OPFS index ${escapedIndexName} before main-thread handoff`,
  );
  const expectedTypedReadFreshnessError = new RegExp(
    `${OP.mainThreadIndexRead}: worker must flush OPFS index ${escapedIndexName} before main-thread handoff`,
  );
  const reader = await makeFreshMainThreadIndexReader({
    bytes: firstGenerationBytes,
    fixture,
    indexName,
    workerHost,
  });

  new Uint8Array(
    workerHost.memory.buffer,
    secondGenerationWritePointer,
    secondGenerationBytes.byteLength,
  ).set(secondGenerationBytes);
  assert.equal(
    workerHost[HOST.OPFS_INDEX_WRITE](
      reader.workerIndexId,
      indexWriteOffset,
      secondGenerationWritePointer,
      secondGenerationBytes.byteLength,
    ),
    expectedSecondGenerationWriteCount,
  );
  assert.throws(
    () => reader.rawRead({
      destPtr: mainReadDestinationPointer,
      len: mainReadLength,
      offset: mainReadOffset,
    }),
    expectedRawReadFreshnessError,
    "raw main-thread read should reject newer unpublished worker generations",
  );
  assert.throws(
    () => reader.observeOnlyRead({
      len: mainReadLength,
    }),
    expectedTypedReadFreshnessError,
    "typed main-thread read should reject newer unpublished worker generations",
  );
}

async function checkMainThreadIndexSizeRejectsNewerUnpublishedGeneration() {
  const sizeFreshnessMemoryPageCount = 2;
  const mainMemory = new WebAssembly.Memory({ initial: sizeFreshnessMemoryPageCount });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const workerHost = fixture.createWorkerHost();
  const indexName = "indexes/size-freshness.idx";
  const firstGenerationBytes = new Uint8Array([111]);
  const secondGenerationBytes = new Uint8Array([112, 113]);
  const secondGenerationWritePointer = 96;
  const indexWriteOffset = 0n;
  const expectedSecondGenerationWriteCount = secondGenerationBytes.byteLength;
  const escapedIndexName = indexName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expectedRawSizeFreshnessError = new RegExp(
    `${OP.indexRead}: worker must flush OPFS index ${escapedIndexName} before main-thread handoff`,
  );
  const reader = await makeFreshMainThreadIndexReader({
    bytes: firstGenerationBytes,
    fixture,
    indexName,
    workerHost,
  });

  assert.equal(
    reader.size(),
    BigInt(firstGenerationBytes.byteLength),
    "raw main-thread size should report the current published worker generation",
  );
  new Uint8Array(
    workerHost.memory.buffer,
    secondGenerationWritePointer,
    secondGenerationBytes.byteLength,
  ).set(secondGenerationBytes);
  assert.equal(
    workerHost[HOST.OPFS_INDEX_WRITE](
      reader.workerIndexId,
      indexWriteOffset,
      secondGenerationWritePointer,
      secondGenerationBytes.byteLength,
    ),
    expectedSecondGenerationWriteCount,
  );
  assert.throws(
    () => reader.size(),
    expectedRawSizeFreshnessError,
    "raw main-thread size should reject newer unpublished worker generations",
  );
}

async function checkMainThreadIndexReadRejectsSupersededPublishedGeneration() {
  const readFreshnessMemoryPageCount = 2;
  const mainMemory = new WebAssembly.Memory({ initial: readFreshnessMemoryPageCount });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const workerHost = fixture.createWorkerHost();
  const indexName = "indexes/superseded-read.idx";
  const firstGenerationBytes = new Uint8Array([103]);
  const secondGenerationBytes = new Uint8Array([104]);
  const mainReadOffset = 0n;
  const mainReadLength = firstGenerationBytes.byteLength;
  const mainReadDestinationPointer = 120;
  const escapedIndexName = indexName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expectedRawReadFreshnessError = new RegExp(
    `${OP.indexRead}: main-thread OPFS index ${escapedIndexName} open must match current published worker generation`,
  );
  const expectedTypedReadFreshnessError = new RegExp(
    `${OP.mainThreadIndexRead}: main-thread OPFS index ${escapedIndexName} open must match current published worker generation`,
  );
  const firstReader = await makeFreshMainThreadIndexReader({
    bytes: firstGenerationBytes,
    fixture,
    indexName,
    workerHost,
  });
  const secondReader = await makeFreshMainThreadIndexReader({
    bytes: secondGenerationBytes,
    fixture,
    indexName,
    workerHost,
  });

  assert.notEqual(
    firstReader.workerIndexId,
    secondReader.workerIndexId,
    "second worker publication should model a newer OPFS handoff generation",
  );
  assert.throws(
    () => firstReader.rawRead({
      destPtr: mainReadDestinationPointer,
      len: mainReadLength,
      offset: mainReadOffset,
    }),
    expectedRawReadFreshnessError,
    "raw main-thread read should reject superseded published worker generations",
  );
  assert.throws(
    () => firstReader.observeOnlyRead({
      len: mainReadLength,
    }),
    expectedTypedReadFreshnessError,
    "typed main-thread read should reject superseded published worker generations",
  );
}

async function checkObservedIndexReadPreservesRawReadCount() {
  const observedReadMemoryPageCount = 2;
  const mainMemory = new WebAssembly.Memory({ initial: observedReadMemoryPageCount });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const workerHost = fixture.createWorkerHost();
  const indexName = "indexes/short-read.idx";
  const requestedLen = 4;
  const rawReadOffset = 0n;
  const rawReadDestinationPointer = 120;
  const actualBytes = new Uint8Array([81, 82]);

  const reader = await makeFreshMainThreadIndexReader({
    bytes: actualBytes,
    fixture,
    indexName,
    workerHost,
  });

  assert.equal(
    reader.rawRead({
      destPtr: rawReadDestinationPointer,
      len: requestedLen,
      offset: rawReadOffset,
    }),
    actualBytes.byteLength,
    "raw index read should report the bytes actually copied",
  );
  assert.equal(
    reader.observeOnlyRead({
      len: requestedLen,
    }),
    actualBytes.byteLength,
    "observe-only typed read should preserve the raw read count",
  );

  const rawRead = fixture.calls.find(
    (call) => call.host === MAIN_HOST_ROLE &&
      call.id === reader.mainIndexId &&
      call.op === OP.indexRead &&
      call.name === indexName,
  );
  const typedRead = fixture.calls.find(
    (call) => call.host === MAIN_HOST_ROLE &&
      call.id === reader.mainIndexId &&
      call.op === OP.mainThreadIndexRead &&
      call.name === indexName,
  );

  assert.ok(rawRead !== undefined, "raw index read call should be logged");
  assert.ok(typedRead !== undefined, "typed index read observation should be logged");
  assert.equal(rawRead.len, requestedLen);
  assert.equal(rawRead.readCount, actualBytes.byteLength);
  assert.equal(typedRead.len, requestedLen);
  assert.equal(typedRead.readCount, actualBytes.byteLength);
}

async function main() {
  checkHostImportNameGuard();
  await checkDefaultSeparation();
  await checkSelectedFileAndDurableSourceReads();
  await checkDurableIndexAcrossHosts();
  await checkTypedScenarioHelpers();
  await checkTypedScenarioOrderGuards();
  await checkWorkerMessageDeliveryRequiresActiveIngest();
  await checkWorkerMessageDeliveryRejectsRetiredIngests();
  await checkWorkerMessageDeliveryRequiresPublishedCompleteIndex();
  await checkWorkerMessageDeliveryRequiresPublishedCoveredRangeIndex();
  await checkWorkerMessageDeliveryRejectsUnrelatedCoveredRangeIndex();
  await checkWorkerHandoffGenerationReset();
  await checkWorkerPublicationRequiresWrittenBytes();
  await checkWorkerPublicationRequiresCurrentGenerationBytes();
  await checkTypedScenarioChronology();
  await checkObserveOnlyIndexOpenRejectsStaleRawOpen();
  await checkRawIndexReadRejectsPreHandoffMainThreadOpen();
  await checkMainThreadIndexReadRejectsNewerUnpublishedGeneration();
  await checkMainThreadIndexSizeRejectsNewerUnpublishedGeneration();
  await checkMainThreadIndexReadRejectsSupersededPublishedGeneration();
  await checkObservedIndexReadPreservesRawReadCount();
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
