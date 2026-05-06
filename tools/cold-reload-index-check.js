#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const {
  INDEX_TARGET_ENCODED_BYTES_PER_EVENT,
  OPFS_PAGE_SIZE,
  TOKEN_RECORD_BYTES,
  WASM_PAGE_SIZE,
} = require("./layout-spec.js");

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;
const targetBytes = Number.parseInt(
  process.env.TRACY_COLD_RELOAD_TRACE_BYTES ?? String(4 * MiB),
  10,
);
const seedText = process.env.TRACY_COLD_RELOAD_TRACE_SEED ?? "cold-reload-index-ci";
const sourceId = 9101;
const indexId = 77;
const statePtr = 4096;
const writerPagePtr = WASM_PAGE_SIZE;
const inputPtr = 1 * MiB;
const tokenOutputSafetyRecords = 1024;
const queryOutPtr = writerPagePtr + 2 * OPFS_PAGE_SIZE;
const wasmRoot = path.resolve(__dirname, "../dist/wasm");
const stdRoot = path.join(wasmRoot, "std");

if (!Number.isInteger(targetBytes) || targetBytes <= 0) {
  throw new Error("TRACY_COLD_RELOAD_TRACE_BYTES must be a positive integer");
}

function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
}

function hexPad(random, len) {
  let value = "";
  while (value.length < len) {
    value += random().toString(16).padStart(8, "0");
  }
  return value.slice(0, len);
}

function eventJson(event, random, padLen) {
  return JSON.stringify({
    ph: event.ph,
    name: event.name,
    ts: event.ts,
    dur: event.dur,
    pid: event.pid,
    tid: event.tid,
    args: {
      pad: hexPad(random, padLen),
      flag: (random() & 1) === 1,
    },
  });
}

function finalEventJson(event, padLen) {
  return JSON.stringify({
    ph: event.ph,
    name: event.name,
    ts: event.ts,
    dur: event.dur,
    pid: event.pid,
    tid: event.tid,
    args: {
      pad: "0".repeat(padLen),
      flag: true,
    },
  });
}

function finalEventBytes(event, padLen) {
  return Buffer.byteLength(finalEventJson(event, padLen));
}

function fillEvent(index) {
  return {
    ph: "X",
    name: `fill-${String(index % 1000).padStart(3, "0")}`,
    ts: 1000 + index * 10 + (index % 3),
    dur: 1 + (index % 5),
    pid: 2,
    tid: 2,
  };
}

function buildTrace() {
  const random = createRandom(fnv1a(seedText));
  const chunks = [Buffer.from("[")];
  let bytes = 1;
  const events = [
    { ph: "X", name: "known-x-a", ts: 10, dur: 5, pid: 1, tid: 1 },
    { ph: "B", name: "known-pair", ts: 20, dur: 0, pid: 1, tid: 1 },
    { ph: "E", name: "known-pair-end", ts: 30, dur: 0, pid: 1, tid: 1 },
    { ph: "X", name: "known-x-b", ts: 40, dur: 4, pid: 1, tid: 1 },
  ];
  let count = 0;
  let sliceCount = 0;
  const basePadLen = 384;

  while (true) {
    const prefixLen = count === 0 ? 0 : 1;
    const nextFinalPrefixLen = 1;
    const nextFinalEvent = fillEvent(count + 1);
    const nextFinalOverhead = finalEventBytes(nextFinalEvent, 0);
    const suffixLen = nextFinalPrefixLen + nextFinalOverhead + 1;
    const event = eventJson(events[count] ?? fillEvent(count), random, basePadLen);
    const eventLen = Buffer.byteLength(event);

    if (bytes + prefixLen + eventLen + suffixLen > targetBytes) {
      break;
    }

    if (prefixLen > 0) {
      chunks.push(Buffer.from(","));
      bytes += 1;
    }

    chunks.push(Buffer.from(event));
    bytes += eventLen;
    sliceCount += count === 2 ? 0 : 1;
    count += 1;
  }

  const prefixLen = count === 0 ? 0 : 1;
  const finalEventModel = fillEvent(count);
  const finalOverhead = finalEventBytes(finalEventModel, 0);
  const finalPadLen = targetBytes - bytes - prefixLen - finalOverhead - 1;
  if (finalPadLen < 0) {
    throw new Error(`target size ${targetBytes} is too small for a valid generated trace`);
  }

  if (count > 0) {
    chunks.push(Buffer.from(","));
    bytes += 1;
  }

  const finalEvent = finalEventJson(finalEventModel, finalPadLen);
  chunks.push(Buffer.from(finalEvent));
  bytes += Buffer.byteLength(finalEvent);
  sliceCount += 1;
  count += 1;

  chunks.push(Buffer.from("]"));
  bytes += 1;

  const trace = Buffer.concat(chunks);
  if (trace.length !== targetBytes) {
    throw new Error(`generated ${trace.length} bytes, expected ${targetBytes}`);
  }

  return { trace, count, sliceCount };
}

async function instantiateWasm(file, imports) {
  const bytes = await fs.readFile(file);
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  return instance.exports;
}

function pageCount(bytes) {
  return Math.ceil(bytes / WASM_PAGE_SIZE);
}

function globalValue(value) {
  return value instanceof WebAssembly.Global ? value.value : value;
}

async function instantiateModules(trace, indexBytes) {
  const eventCountEstimate = Math.max(1, Math.ceil(trace.length / 470));
  const recordCap = eventCountEstimate * 48 + tokenOutputSafetyRecords;
  const outputPtr = (inputPtr + trace.length + 7) & ~7;
  const outputBytes = recordCap * TOKEN_RECORD_BYTES;
  const heapPtr = (outputPtr + outputBytes + 7) & ~7;
  const heapEnd = heapPtr + 64 * MiB;
  const memory = new WebAssembly.Memory({
    initial: Math.max(pageCount(heapEnd), 1),
    maximum: 32768,
  });
  const memoryBytes = new Uint8Array(memory.buffer);
  let sourceReads = 0;

  memoryBytes.set(trace, inputPtr);

  const env = { memory };
  const host = {
    opfs_source_read(readSourceId, offset, len, dest) {
      if (readSourceId !== sourceId) {
        return -1;
      }

      sourceReads += 1;
      const start = Number(offset);
      if (!Number.isInteger(start) || start < 0 || start >= trace.length) {
        return 0;
      }

      const count = Math.max(0, Math.min(len, trace.length - start));
      new Uint8Array(memory.buffer, dest, count).set(trace.subarray(start, start + count));
      return count;
    },
    opfs_index_read(readIndexId, offset, len, dest) {
      if (readIndexId !== indexId) {
        return -1;
      }

      const start = Number(offset);
      if (!Number.isInteger(start) || start < 0 || start >= indexBytes.length) {
        return 0;
      }

      const count = Math.max(0, Math.min(len, indexBytes.length - start));
      new Uint8Array(memory.buffer, dest, count).set(indexBytes.subarray(start, start + count));
      return count;
    },
    opfs_index_write(writeIndexId, offset, src, len) {
      if (writeIndexId !== indexId) {
        return -1;
      }

      const start = Number(offset);
      if (!Number.isInteger(start) || start < 0) {
        return -1;
      }

      const end = start + len;
      if (end > indexBytes.length) {
        const next = Buffer.alloc(end);
        indexBytes.copy(next);
        indexBytes = next;
      }

      new Uint8Array(indexBytes.buffer, indexBytes.byteOffset + start, len).set(
        new Uint8Array(memory.buffer, src, len),
      );
      return len;
    },
    opfs_index_flush(writeIndexId) {
      return writeIndexId === indexId ? 0 : -1;
    },
  };

  const alloc = await instantiateWasm(path.join(stdRoot, "alloc.wasm"), { env });
  alloc.bump_init(heapPtr, heapEnd);
  const hash = await instantiateWasm(path.join(stdRoot, "hash.wasm"), { env, alloc });
  const strtab = await instantiateWasm(path.join(stdRoot, "strtab.wasm"), {
    env,
    alloc,
    hash,
  });
  const mem = await instantiateWasm(path.join(stdRoot, "mem.wasm"), { env });
  const parserState = await instantiateWasm(path.join(wasmRoot, "parser_state.wasm"), {
    env,
  });
  const parser = await instantiateWasm(path.join(wasmRoot, "parser.wasm"), {
    env,
    host,
    mem,
    parser_state: parserState,
    strtab,
  });
  const index = await instantiateWasm(path.join(wasmRoot, "index.wasm"), {
    env,
    host,
    mem,
  });

  return {
    memory,
    parser,
    parserState,
    index,
    outputPtr,
    recordCap,
    getIndexBytes: () => indexBytes,
    sourceReads: () => sourceReads,
  };
}

function readI32(memory, ptr) {
  return new DataView(memory.buffer).getInt32(ptr, true);
}

function readU32(memory, ptr) {
  return new DataView(memory.buffer).getUint32(ptr, true);
}

function expectEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: got ${actual}, expected ${expected}`);
  }
}

function expectDeepEq(actual, expected, label) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${label}: got ${actualJson}, expected ${expectedJson}`);
  }
}

function queryRows(index, memory, trackId, tsMin, tsMax) {
  const count = index.index_query_range(trackId, tsMin, tsMax, queryOutPtr);
  expectEq(
    index.index_reader_status(),
    globalValue(index.INDEX_READER_STATUS_OK),
    "query status",
  );

  const rowBytes = globalValue(index.INDEX_QUERY_RESULT_BYTES);
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const ptr = queryOutPtr + i * rowBytes;
    rows.push({
      start: readU32(memory, ptr),
      dur: readU32(memory, ptr + 4),
      name: readU32(memory, ptr + 8),
      depth: readU32(memory, ptr + 12),
      cat: readU32(memory, ptr + 16),
      color: readU32(memory, ptr + 20),
    });
  }

  return rows;
}

function rebuildSliceCatalog(index, memory, pages) {
  index.index_page_catalog_reset();
  for (let pageId = 0; pageId < pages; pageId += 1) {
    const page = index.read_page(0, pageId);
    expectEq(
      index.index_reader_status(),
      globalValue(index.INDEX_READER_STATUS_OK),
      `catalog page ${pageId} read`,
    );
    expectEq(
      index.index_validate_page(page, OPFS_PAGE_SIZE),
      globalValue(index.INDEX_STATUS_OK),
      `catalog page ${pageId} validates`,
    );

    const hints = readU32(memory, page + 36);
    if ((hints & globalValue(index.INDEX_DECODE_HINT_COMPACT_SLICES)) === 0) {
      continue;
    }

    index.index_page_catalog_add_slice_page(
      hints >>> 8,
      pageId,
      readU32(memory, page + 12),
      readU32(memory, page + 20),
      readU32(memory, page + 28),
    );
  }
}

function compactPayloadBytes(indexBytes, index, pages) {
  let bytes = 0;
  const view = new DataView(indexBytes.buffer, indexBytes.byteOffset, indexBytes.byteLength);
  for (let pageId = 0; pageId < pages; pageId += 1) {
    const page = pageId * OPFS_PAGE_SIZE;
    const hints = view.getUint32(page + 36, true);
    if ((hints & globalValue(index.INDEX_DECODE_HINT_COMPACT_SLICES)) !== 0) {
      const dir = page + globalValue(index.INDEX_HEADER_BYTES);
      const columnCount = view.getUint8(dir + 1);
      bytes += view.getUint16(dir + 2, true);
      for (let i = 0; i < columnCount; i += 1) {
        bytes += view.getUint32(dir + 4 + i * 16 + 8, true);
      }
    }
  }
  return bytes;
}

function scaledColdReloadBudgetMs(bytes) {
  const scaled = (bytes / (10 * GiB)) * 30_000;
  return Math.max(250, Math.ceil(scaled));
}

async function main() {
  const { trace, count: generatedCount, sliceCount } = buildTrace();
  let indexBytes = Buffer.alloc(0);
  const ingest = await instantiateModules(trace, indexBytes);

  ingest.parserState.parser_state_init(statePtr, sourceId);
  const status = ingest.parser.parser_tokenize_bytes(
    statePtr,
    inputPtr,
    trace.length,
    ingest.outputPtr,
    ingest.recordCap,
  );

  expectEq(
    status,
    globalValue(ingest.parserState.PARSER_STATUS_DONE),
    "parser status",
  );

  ingest.parser.extractor_init(ingest.outputPtr);
  ingest.index.index_writer_init(indexId, writerPagePtr, 1);

  let extractedCount = 0;
  while (true) {
    const eventPtr = ingest.parser.extractor_next();
    if (eventPtr === -1) {
      break;
    }

    const appendStatus = ingest.index.index_add_event(eventPtr);
    expectEq(appendStatus, globalValue(ingest.index.INDEX_INGEST_STATUS_OK), "ingest status");
    extractedCount += 1;
  }

  expectEq(extractedCount, generatedCount, "extracted event count");

  const flushStatus = ingest.index.index_writer_flush();
  expectEq(flushStatus, globalValue(ingest.index.INDEX_WRITER_STATUS_OK), "writer flush");
  expectEq(ingest.index.index_writer_committed_events(), sliceCount, "indexed slice count");
  expectEq(ingest.index.track_slice_count(0), 3, "known track slice count");
  expectEq(ingest.index.track_min_ts(0), 10, "known track min ts");
  expectEq(ingest.index.track_max_ts(0), 44, "known track max ts");
  expectEq(ingest.index.track_max_depth(0), 0, "known track max depth");

  expectEq(ingest.index.index_reader_configure_cache(2), 2, "warm reader cache slots");
  ingest.index.index_reader_init(indexId);
  const warmRows = queryRows(ingest.index, ingest.memory, 0, 0, 50);
  expectEq(warmRows.length, 3, "warm known query row count");
  expectDeepEq(
    warmRows.map(({ start, dur, depth }) => ({ start, dur, depth })),
    [
      { start: 10, dur: 5, depth: 0 },
      { start: 20, dur: 10, depth: 0 },
      { start: 40, dur: 4, depth: 0 },
    ],
    "warm known query ordering and fields",
  );

  const parserCount = readI32(
    ingest.memory,
    statePtr + globalValue(ingest.parserState.PARSER_STATE_EVENT_COUNT_OFFSET),
  );
  expectEq(parserCount, generatedCount, "parser event count");

  indexBytes = ingest.getIndexBytes();
  const pages = ingest.index.index_writer_committed_pages();
  if (pages < 3) {
    throw new Error(`cold-reload fixture needs at least 3 pages, got ${pages}`);
  }

  const encodedBytes = compactPayloadBytes(indexBytes, ingest.index, pages);
  const encodedBytesPerSlice = encodedBytes / sliceCount;
  if (encodedBytesPerSlice > INDEX_TARGET_ENCODED_BYTES_PER_EVENT) {
    throw new Error(
      `compact slice payload used ${encodedBytesPerSlice.toFixed(2)} bytes/event, budget ${INDEX_TARGET_ENCODED_BYTES_PER_EVENT}`,
    );
  }

  const reloadStart = process.hrtime.bigint();
  const cold = await instantiateModules(Buffer.alloc(0), indexBytes);
  const readsBeforeReload = cold.sourceReads();

  expectEq(cold.index.index_reader_configure_cache(2), 2, "reader cache slots");
  cold.index.index_reader_init(indexId);
  rebuildSliceCatalog(cold.index, cold.memory, pages);
  expectEq(cold.index.index_slice_page_count(), pages, "cold slice page catalog count");
  cold.index.index_reader_init(indexId);

  const coldRows = queryRows(cold.index, cold.memory, 0, 0, 50);
  expectDeepEq(coldRows, warmRows, "cold query parity");
  if (cold.index.index_reader_cache_misses() === 0) {
    throw new Error("cold query did not fault any pages");
  }

  const hitsBeforeRepeat = cold.index.index_reader_cache_hits();
  expectDeepEq(queryRows(cold.index, cold.memory, 0, 0, 50), warmRows, "warm cache query parity");
  if (cold.index.index_reader_cache_hits() <= hitsBeforeRepeat) {
    throw new Error("repeated query did not hit the page cache");
  }

  const page0 = cold.index.read_page(0, 0);
  expectEq(cold.index.index_reader_status(), globalValue(cold.index.INDEX_READER_STATUS_OK), "page0 status");
  expectEq(
    cold.index.index_validate_page(page0, OPFS_PAGE_SIZE),
    globalValue(cold.index.INDEX_STATUS_OK),
    "page0 validates",
  );

  cold.index.read_page(0, 1);
  expectEq(cold.index.index_reader_cache_hit(), 0, "page1 miss");

  expectEq(cold.index.read_page(0, 0), page0, "page0 cached pointer");
  expectEq(cold.index.index_reader_cache_hit(), 1, "page0 hit");

  cold.index.read_page(0, 2);
  expectEq(cold.index.index_reader_cache_hit(), 0, "page2 miss");

  expectEq(cold.index.read_page(0, 0), page0, "page0 remains hot");
  expectEq(cold.index.index_reader_cache_hit(), 1, "page0 remains cached");

  cold.index.read_page(0, 1);
  expectEq(cold.index.index_reader_cache_hit(), 0, "page1 evicted miss");

  expectEq(cold.index.index_reader_evict_cold_pages(1), 1, "memory pressure evicts one");
  cold.index.read_page(0, 2);
  expectEq(cold.index.index_reader_cache_hit(), 0, "page2 reloaded after eviction");

  expectEq(cold.sourceReads(), readsBeforeReload, "cold reload avoided JSON source reads");

  const reloadMs = Number(process.hrtime.bigint() - reloadStart) / 1_000_000;
  const budgetMs = scaledColdReloadBudgetMs(trace.length);
  if (reloadMs > budgetMs) {
    throw new Error(`cold reload took ${reloadMs.toFixed(2)}ms, budget ${budgetMs}ms`);
  }

  console.log(
    `cold reloaded ${pages} TRCI pages from ${trace.length} bytes in ${reloadMs.toFixed(2)}ms (budget ${budgetMs}ms); compact payload ${encodedBytesPerSlice.toFixed(2)} bytes/event`,
  );
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
