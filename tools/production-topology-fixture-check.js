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
  const mainMemory = new WebAssembly.Memory({ initial: 2 });
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
  const acceptLen = writeString(mainMemory, 8, ".json");

  fixture.mainHost.setFileSelectedCallback((event) => selected.push(event));
  const picker = fixture.mainHost[HOST.FILE_PICKER_OPEN](8, acceptLen);
  fixture.mainHost.selectPickedFile(77, mainFile);
  assert.equal(await picker, 77);
  await Promise.resolve();
  assert.deepEqual(selected, [{ file: mainFile, handle: 77 }]);

  const mainSelectedSourceId = fixture.mainHost[HOST.OPFS_SOURCE_FROM_FILE](77);

  assert.equal(fixture.mainHost[HOST.OPFS_SOURCE_SIZE](mainSelectedSourceId), 5n);

  fixture.selectedFiles.set(88, workerFile);
  const workerHost = fixture.createWorkerHost({
    files: new Map(fixture.selectedFiles),
  });

  assert.equal(Object.hasOwn(workerHost, "undefined"), false);
  assert.equal(typeof workerHost.opfs_create_from_file, "function");
  const sourceId = workerHost[HOST.OPFS_CREATE_FROM_FILE](88);

  assert.equal(workerHost[HOST.OPFS_SOURCE_SIZE](sourceId), 5n);
  assert.equal(workerHost[HOST.OPFS_READ_CHUNK](sourceId, 1n, 3, 32), 3);
  assert.deepEqual(readBytes(workerHost.memory, 32, 4), [22, 23, 24, 0]);

  const sourceName = "sources/trace.json";
  const sourceNameLen = writeString(mainMemory, 48, sourceName);
  const mainSourceId = fixture.mainHost[HOST.OPFS_SOURCE_OPEN](48, sourceNameLen);

  assert.equal(fixture.mainHost[HOST.OPFS_SOURCE_READ](mainSourceId, 2n, 2, 64), 2);
  assert.deepEqual(readBytes(mainMemory, 64, 3), [13, 14, 0]);

  const workerSourceName = "sources/worker-trace.json";
  const workerSourceNameLen = writeString(mainMemory, 80, workerSourceName);

  assert.throws(
    () => fixture.mainHost[HOST.OPFS_SOURCE_OPEN](80, workerSourceNameLen),
    /OPFS source sources\/worker-trace\.json should exist before open/,
    "worker-created selected-file sources should not be durable in the main host",
  );
}

async function checkDurableIndexAcrossHosts() {
  const mainMemory = new WebAssembly.Memory({ initial: 2 });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const workerHost = fixture.createWorkerHost();
  const indexName = "indexes/trace.idx";
  const workerNameLen = writeString(workerHost.memory, 16, indexName);
  const workerIndexId = workerHost[HOST.OPFS_INDEX_CREATE](16, workerNameLen);

  new Uint8Array(workerHost.memory.buffer, 96, 4).set([21, 22, 23, 24]);
  assert.equal(workerHost[HOST.OPFS_INDEX_WRITE](workerIndexId, 2n, 96, 4), 4);
  assert.equal(await workerHost[HOST.OPFS_INDEX_FLUSH](workerIndexId), 0);

  const mainNameLen = writeString(mainMemory, 16, indexName);
  const mainIndexId = fixture.mainHost[HOST.OPFS_INDEX_OPEN](16, mainNameLen);

  assert.equal(fixture.mainHost[HOST.OPFS_INDEX_SIZE](mainIndexId), 6n);
  assert.equal(fixture.mainHost[HOST.OPFS_INDEX_READ](mainIndexId, 0n, 6, 120), 6);
  assert.deepEqual(readBytes(mainMemory, 120, 6), [0, 0, 21, 22, 23, 24]);
  assert.deepEqual(
    fixture.calls.filter((call) => [
      OP.indexCreate,
      OP.indexFlush,
      OP.indexOpen,
      OP.indexRead,
      OP.indexWrite,
    ].includes(call.op)).map((call) => [call.host, call.op, call.name]),
    [
      ["worker", OP.indexCreate, indexName],
      ["worker", OP.indexWrite, indexName],
      ["worker", OP.indexFlush, indexName],
      ["main", OP.indexOpen, indexName],
      ["main", OP.indexRead, indexName],
    ],
  );
}

async function checkTypedScenarioHelpers() {
  const mainMemory = new WebAssembly.Memory({ initial: 2 });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const selected = [];
  const selectedFile = {
    bytes: new Uint8Array([31, 32, 33, 34]),
    name: "scenario.json",
  };
  const acceptLen = writeString(mainMemory, 8, ".json");

  fixture.mainHost.setFileSelectedCallback((event) => selected.push(event));
  const picker = fixture.mainHost[HOST.FILE_PICKER_OPEN](8, acceptLen);

  assert.equal(fixture.scenario.selectedFileIngest({ file: selectedFile, handle: 91 }), 91);
  assert.equal(await picker, 91);
  await Promise.resolve();
  assert.deepEqual(selected, [{ file: selectedFile, handle: 91 }]);
  assert.ok(
    fixture.calls.some(
      (call) => call.host === "main" &&
        call.op === OP.selectedFileIngest &&
        call.handle === 91,
    ),
    "typed selected-file ingest helper should record the named scenario operation",
  );

  const workerHost = fixture.createWorkerHost();
  const indexName = "indexes/scenario.idx";

  assert.equal(
    await fixture.scenario.workerPublication({
      bytes: new Uint8Array([41, 42, 43, 44]),
      indexName,
      workerHost,
    }),
    222,
  );
  const mainIndexId = fixture.scenario.mainThreadIndexOpen({ indexName });

  assert.equal(mainIndexId, 122);
  assert.equal(
    fixture.scenario.mainThreadIndexRead({ indexId: mainIndexId, len: 4 }),
    4,
  );
  assert.deepEqual(readBytes(mainMemory, 120, 4), [41, 42, 43, 44]);
  assert.deepEqual(
    fixture.calls.filter((call) => [
      OP.selectedFileIngest,
      OP.workerPublication,
      OP.mainThreadIndexOpen,
      OP.mainThreadIndexRead,
    ].includes(call.op)).map((call) => [call.host, call.op, call.name ?? call.messageType]),
    [
      ["main", OP.selectedFileIngest, "sources/scenario.json"],
      ["worker", OP.workerPublication, indexName],
      ["main", OP.mainThreadIndexOpen, indexName],
      ["main", OP.mainThreadIndexRead, indexName],
    ],
  );

  let delivered = null;

  assert.equal(
    fixture.scenario.workerMessageDelivery({
      message: { ingestId: 1, type: "progress" },
      worker: {
        emit(type, message) {
          delivered = { message, type };
        },
      },
    }),
    true,
  );
  assert.deepEqual(delivered, {
    message: { ingestId: 1, type: "progress" },
    type: "message",
  });
}

async function checkTypedScenarioOrderGuards() {
  const mainMemory = new WebAssembly.Memory({ initial: 2 });
  const fixture = makeProductionTopologyFixture({ mainMemory });
  const workerHost = fixture.createWorkerHost();
  const indexName = "indexes/out-of-order.idx";

  assert.throws(
    () => fixture.scenario.mainThreadIndexOpen({ indexName }),
    /worker must create OPFS index indexes\/out-of-order\.idx before publication/,
    "main-thread open helper should reject indexes the worker has not created",
  );

  const nameLen = writeString(workerHost.memory, 16, indexName);
  const workerIndexId = workerHost[HOST.OPFS_INDEX_CREATE](16, nameLen);

  assert.throws(
    () => fixture.scenario.mainThreadIndexOpen({ indexName }),
    /worker must flush OPFS index indexes\/out-of-order\.idx before main-thread handoff/,
    "main-thread open helper should reject unflushed worker indexes",
  );
  await assert.rejects(
    () => fixture.scenario.workerPublication({ indexName }),
    /worker publication requires worker OPFS index indexes\/out-of-order\.idx to contain bytes/,
    "worker publication helper should reject empty indexes",
  );

  new Uint8Array(workerHost.memory.buffer, 96, 2).set([51, 52]);
  assert.equal(workerHost[HOST.OPFS_INDEX_WRITE](workerIndexId, 0n, 96, 2), 2);
  assert.throws(
    () => fixture.scenario.mainThreadIndexOpen({ indexName }),
    /worker must flush OPFS index indexes\/out-of-order\.idx before main-thread handoff/,
    "main-thread open helper should reject unflushed worker indexes",
  );
  assert.equal(await workerHost[HOST.OPFS_INDEX_FLUSH](workerIndexId), 0);
  assert.equal(await fixture.scenario.workerPublication({ indexName }), workerIndexId);
  assert.throws(
    () => fixture.scenario.mainThreadIndexRead({ indexId: workerIndexId, len: 2 }),
    /main thread must open OPFS index before read/,
    "main-thread read helper should reject reads before a typed main-thread open",
  );

  const noSelectionFixture = makeProductionTopologyFixture();

  assert.throws(
    () => noSelectionFixture.scenario.workerMessageDelivery({
      message: { ingestId: 1, type: "progress" },
      worker: { emit() {} },
    }),
    /requires selected-file ingest first/,
    "worker message helper should reject delivery before selected-file ingest",
  );
}

async function main() {
  checkHostImportNameGuard();
  await checkDefaultSeparation();
  await checkSelectedFileAndDurableSourceReads();
  await checkDurableIndexAcrossHosts();
  await checkTypedScenarioHelpers();
  await checkTypedScenarioOrderGuards();
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
