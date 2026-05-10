#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const {
  FIXTURE_OPERATION: OP,
  DEFAULT_HOST_IMPORT_NAME: HOST,
  makeProductionTopologyFixture,
} = require("./production-topology-fixture.js");

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
  assert.throws(
    () => fixture.createWorkerHost({ memory: mainMemory }),
    /makeSameMemoryWorkerHostForTests/,
    "same-memory workers should require the narrowly named test helper",
  );
  assert.equal(
    fixture.makeSameMemoryWorkerHostForTests().memory,
    mainMemory,
    "same-memory shortcut should be explicit in the helper name",
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
  const file = {
    bytes: new Uint8Array([11, 12, 13, 14, 15]),
    name: "trace.json",
  };
  const selected = [];
  const acceptLen = writeString(mainMemory, 8, ".json");

  fixture.mainHost.setFileSelectedCallback((event) => selected.push(event));
  const picker = fixture.mainHost[HOST.FILE_PICKER_OPEN](8, acceptLen);
  fixture.mainHost.selectPickedFile(77, file);
  assert.equal(await picker, 77);
  await Promise.resolve();
  assert.deepEqual(selected, [{ file, handle: 77 }]);

  const workerHost = fixture.createWorkerHost({
    files: new Map(fixture.selectedFiles),
  });

  assert.equal(Object.hasOwn(workerHost, "undefined"), false);
  assert.equal(typeof workerHost.opfs_create_from_file, "function");
  const sourceId = workerHost[HOST.OPFS_CREATE_FROM_FILE](77);

  assert.equal(workerHost[HOST.OPFS_SOURCE_SIZE](sourceId), 5n);
  assert.equal(workerHost[HOST.OPFS_READ_CHUNK](sourceId, 1n, 3, 32), 3);
  assert.deepEqual(readBytes(workerHost.memory, 32, 4), [12, 13, 14, 0]);

  const sourceName = "sources/trace.json";
  const sourceNameLen = writeString(mainMemory, 48, sourceName);
  const mainSourceId = fixture.mainHost[HOST.OPFS_SOURCE_OPEN](48, sourceNameLen);

  assert.equal(fixture.mainHost[HOST.OPFS_SOURCE_READ](mainSourceId, 2n, 2, 64), 2);
  assert.deepEqual(readBytes(mainMemory, 64, 3), [13, 14, 0]);
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

async function main() {
  checkHostImportNameGuard();
  await checkDefaultSeparation();
  await checkSelectedFileAndDurableSourceReads();
  await checkDurableIndexAcrossHosts();
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
