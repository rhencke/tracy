#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const hostAbi = require("../abi/host.json");
const {
  FIXTURE_OPERATION: OP,
  DEFAULT_HOST_IMPORT_NAME: HOST,
  makeProductionTopologyFixture,
} = require("./production-topology-fixture.js");

const STALE_SIZE_MARKER = hostAbi.opfsBridge.indexSizeMayBeStaleMarker;

function writeString(memory, ptr, value) {
  const bytes = new TextEncoder().encode(value);

  new Uint8Array(memory.buffer, ptr, bytes.byteLength).set(bytes);
  return bytes.byteLength;
}

function readBytes(memory, ptr, len) {
  return Array.from(new Uint8Array(memory.buffer, ptr, len));
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
  const mainMemory = new WebAssembly.Memory({ initial: 2 });
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
  const workerIndexId = await fixture.scenario.workerPublication({
    bytes: workerIndexBytes,
    indexName,
    offset: workerIndexWriteOffset,
    workerHost,
  });
  const mainIndexId = fixture.scenario.mainThreadIndexOpen({ indexName });

  assert.equal(workerIndexId, expectedWorkerIndexId);
  assert.equal(fixture.mainHost[HOST.OPFS_INDEX_SIZE](mainIndexId), expectedMainIndexSize);
  assert.equal(
    fixture.scenario.mainThreadIndexRead({
      destPtr: mainIndexReadDest,
      indexId: mainIndexId,
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
      ["worker", OP.workerPublication, indexName],
      ["main", OP.mainThreadIndexOpen, indexName],
      ["main", OP.mainThreadIndexRead, indexName],
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
      (call) => call.host === "main" &&
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
    await fixture.scenario.workerPublication({
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
      OP.workerPublication,
      OP.mainThreadIndexOpen,
      OP.mainThreadIndexRead,
    ].includes(call.op)).map((call) => [call.host, call.op, call.name ?? call.messageType]),
    [
      ["main", OP.selectedFileIngest, expectedSelectedFileSourceName],
      ["worker", OP.workerPublication, workerPublicationIndexName],
      ["main", OP.mainThreadIndexOpen, workerPublicationIndexName],
      ["main", OP.mainThreadIndexRead, workerPublicationIndexName],
    ],
  );

  let delivered = null;
  const workerMessageIngestId = 1;
  const workerMessageType = "progress";
  const workerMessage = { ingestId: workerMessageIngestId, type: workerMessageType };
  const expectedWorkerMessageDeliveryResult = true;
  const expectedWorkerMessageEmitType = "message";

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
  const noSelectionWorkerMessage = { ingestId: 1, type: "progress" };
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
    /main thread must open OPFS index before read/,
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
  const firstWriteLength = firstWriteBytes.byteLength;
  const secondWriteLength = secondWriteBytes.byteLength;
  const expectedFirstWriteCount = firstWriteLength;
  const expectedSecondWriteCount = secondWriteLength;
  const expectedFlushResult = 0;
  const expectedFlushBeforeHandoffError = {
    message: `${OP.mainThreadIndexOpen}: worker must flush OPFS index ${indexName} before main-thread handoff`,
  };
  const expectedPublishBeforeHandoffError = {
    message: `${OP.mainThreadIndexOpen}: worker must publish OPFS index ${indexName} before main-thread handoff`,
  };
  const nameLen = writeString(workerHost.memory, workerIndexNamePointer, indexName);
  const firstIndexId = workerHost[HOST.OPFS_INDEX_CREATE](workerIndexNamePointer, nameLen);

  new Uint8Array(workerHost.memory.buffer, firstWritePointer, firstWriteLength).set(firstWriteBytes);
  assert.equal(
    workerHost[HOST.OPFS_INDEX_WRITE](
      firstIndexId,
      indexWriteOffset,
      firstWritePointer,
      firstWriteLength,
    ),
    expectedFirstWriteCount,
  );
  assert.equal(await workerHost[HOST.OPFS_INDEX_FLUSH](firstIndexId), expectedFlushResult);
  assert.equal(await fixture.scenario.workerPublication({ indexName }), firstIndexId);

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

async function checkTypedScenarioChronology() {
  const chronologyMemoryPageCount = 2;
  const mainThreadHostRole = "main";
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
    (call) => call.host === mainThreadHostRole &&
      call.op === OP.mainThreadIndexOpen &&
      call.name === earlyIndexName,
  );

  assert.equal(
    typedEarlyOpen.sourceCallIndex,
    fixture.calls.findIndex(
      (call) => call.host === mainThreadHostRole &&
        call.op === OP.indexOpen &&
        call.name === earlyIndexName,
    ),
    "observe-only open should carry the original valid raw open index",
  );

  const readIndexName = "indexes/read-order.idx";
  const readIndexNamePointer = 48;
  const readWorkerWriteBytes = new Uint8Array([72]);
  const readWorkerWritePointer = 104;
  const expectedReadWriteCount = readWorkerWriteBytes.byteLength;
  const rawReadOffset = 0n;
  const rawReadLength = readWorkerWriteBytes.byteLength;
  const rawReadDestinationPointer = 120;
  const expectedRawReadCount = rawReadLength;
  const readWorkerNameLen = writeString(workerHost.memory, readIndexNamePointer, readIndexName);
  const readWorkerIndexId = workerHost[HOST.OPFS_INDEX_CREATE](readIndexNamePointer, readWorkerNameLen);

  new Uint8Array(workerHost.memory.buffer, readWorkerWritePointer, readWorkerWriteBytes.byteLength)
    .set(readWorkerWriteBytes);
  assert.equal(
    workerHost[HOST.OPFS_INDEX_WRITE](
      readWorkerIndexId,
      indexWriteOffset,
      readWorkerWritePointer,
      readWorkerWriteBytes.byteLength,
    ),
    expectedReadWriteCount,
  );
  assert.equal(await workerHost[HOST.OPFS_INDEX_FLUSH](readWorkerIndexId), expectedFlushSuccess);
  assert.equal(await fixture.scenario.workerPublication({ indexName: readIndexName }), readWorkerIndexId);
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

  await fixture.scenario.workerPublication({
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
    (call) => call.host === mainThreadHostRole &&
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

async function checkObservedIndexReadPreservesRawReadCount() {
  const mainMemory = new WebAssembly.Memory({ initial: 2 });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const workerHost = fixture.createWorkerHost();
  const indexName = "indexes/short-read.idx";
  const requestedLen = 4;
  const actualBytes = new Uint8Array([81, 82]);

  await fixture.scenario.workerPublication({
    bytes: actualBytes,
    indexName,
    workerHost,
  });
  const mainIndexId = fixture.scenario.mainThreadIndexOpen({ indexName });

  assert.equal(
    fixture.mainHost[HOST.OPFS_INDEX_READ](mainIndexId, 0n, requestedLen, 120),
    actualBytes.byteLength,
    "raw index read should report the bytes actually copied",
  );
  assert.equal(
    fixture.scenario.mainThreadIndexRead({
      indexId: mainIndexId,
      len: requestedLen,
      observeOnly: true,
    }),
    actualBytes.byteLength,
    "observe-only typed read should preserve the raw read count",
  );

  const rawRead = fixture.calls.find(
    (call) => call.host === "main" &&
      call.id === mainIndexId &&
      call.op === OP.indexRead &&
      call.name === indexName,
  );
  const typedRead = fixture.calls.find(
    (call) => call.host === "main" &&
      call.id === mainIndexId &&
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
  await checkWorkerHandoffGenerationReset();
  await checkWorkerPublicationRequiresWrittenBytes();
  await checkTypedScenarioChronology();
  await checkObservedIndexReadPreservesRawReadCount();
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
