#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");

const MiB = 1024 * 1024;
const targetBytes = Number.parseInt(
  process.env.TRACY_GENERATED_TRACE_BYTES ?? String(100 * MiB),
  10,
);
const seedText = process.env.TRACY_GENERATED_TRACE_SEED ?? "generated-trace-ci";
const sourceId = 9001;
const statePtr = 4096;
const inputPtr = 1 * MiB;
const tokenRecordBytes = 12;
const tokenOutputSafetyRecords = 1024;
const wasmRoot = path.resolve(__dirname, "../dist/wasm");
const stdRoot = path.join(wasmRoot, "std");

if (!Number.isInteger(targetBytes) || targetBytes <= 0) {
  throw new Error("TRACY_GENERATED_TRACE_BYTES must be a positive integer");
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

function eventJson(index, random, padLen) {
  const phases = ["B", "E", "X", "i", "M", "C"];
  return JSON.stringify({
    ph: phases[random() % phases.length],
    name: `event-${random() % 256}`,
    ts: index * 10 + (random() % 10),
    dur: random() % 1000,
    pid: random() % 32,
    tid: random() % 512,
    args: {
      pad: hexPad(random, padLen),
      flag: (random() & 1) === 1,
    },
  });
}

function finalEventJson(index, padLen) {
  return JSON.stringify({
    ph: "X",
    name: "final",
    ts: index * 10,
    dur: 1,
    pid: 0,
    tid: 0,
    args: {
      pad: "0".repeat(padLen),
      flag: true,
    },
  });
}

function finalEventBytes(index, padLen) {
  return Buffer.byteLength(finalEventJson(index, padLen));
}

function buildTrace() {
  const random = createRandom(fnv1a(seedText));
  const chunks = [Buffer.from("[")];
  let bytes = 1;
  let count = 0;
  const basePadLen = 384;

  while (true) {
    const prefixLen = count === 0 ? 0 : 1;
    const nextFinalPrefixLen = 1;
    const nextFinalOverhead = finalEventBytes(count + 1, 0);
    const suffixLen = nextFinalPrefixLen + nextFinalOverhead + 1;
    const event = eventJson(count, random, basePadLen);
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
    count += 1;
  }

  const prefixLen = count === 0 ? 0 : 1;
  const finalOverhead = finalEventBytes(count, 0);
  const finalPadLen = targetBytes - bytes - prefixLen - finalOverhead - 1;
  if (finalPadLen < 0) {
    throw new Error(`target size ${targetBytes} is too small for a valid generated trace`);
  }

  if (count > 0) {
    chunks.push(Buffer.from(","));
    bytes += 1;
  }

  const finalEvent = finalEventJson(count, finalPadLen);
  chunks.push(Buffer.from(finalEvent));
  bytes += Buffer.byteLength(finalEvent);
  count += 1;

  chunks.push(Buffer.from("]"));
  bytes += 1;

  const trace = Buffer.concat(chunks);
  if (trace.length !== targetBytes) {
    throw new Error(`generated ${trace.length} bytes, expected ${targetBytes}`);
  }

  return { trace, count };
}

async function instantiateWasm(file, imports) {
  const bytes = await fs.readFile(file);
  const { instance } = await WebAssembly.instantiate(bytes, imports);
  return instance.exports;
}

function pageCount(bytes) {
  return Math.ceil(bytes / 65536);
}

async function instantiateParser(trace) {
  const eventCountEstimate = Math.max(1, Math.ceil(trace.length / 470));
  const recordCap = eventCountEstimate * 48 + tokenOutputSafetyRecords;
  const outputPtr = (inputPtr + trace.length + 7) & ~7;
  const outputBytes = recordCap * tokenRecordBytes;
  const heapPtr = (outputPtr + outputBytes + 7) & ~7;
  const heapEnd = heapPtr + 64 * MiB;
  const memory = new WebAssembly.Memory({
    initial: Math.max(pageCount(heapEnd), 1),
    maximum: 32768,
  });
  const memoryBytes = new Uint8Array(memory.buffer);

  memoryBytes.set(trace, inputPtr);

  const env = { memory };
  const host = {
    opfs_source_read(readSourceId, offset, len, dest) {
      if (readSourceId !== sourceId) {
        return -1;
      }

      const start = Number(offset);
      if (!Number.isInteger(start) || start < 0 || start >= trace.length) {
        return 0;
      }

      const count = Math.max(0, Math.min(len, trace.length - start));
      new Uint8Array(memory.buffer, dest, count).set(trace.subarray(start, start + count));
      return count;
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

  return {
    memory,
    parser,
    parserState,
    outputPtr,
    recordCap,
  };
}

function readI32(memory, ptr) {
  return new DataView(memory.buffer).getInt32(ptr, true);
}

async function main() {
  const { trace, count: generatedCount } = buildTrace();
  const { memory, parser, parserState, outputPtr, recordCap } = await instantiateParser(trace);

  parserState.parser_state_init(statePtr, sourceId);
  const status = parser.parser_tokenize_bytes(
    statePtr,
    inputPtr,
    trace.length,
    outputPtr,
    recordCap,
  );

  if (status !== parserState.PARSER_STATUS_DONE.value) {
    throw new Error(`parser status ${status}, expected ${parserState.PARSER_STATUS_DONE.value}`);
  }

  parser.extractor_init(outputPtr);

  let extractedCount = 0;
  while (parser.extractor_next() !== -1) {
    extractedCount += 1;
  }

  if (extractedCount !== generatedCount) {
    throw new Error(`extracted ${extractedCount} events, generated ${generatedCount}`);
  }

  const parserCount = readI32(
    memory,
    statePtr + parserState.PARSER_STATE_EVENT_COUNT_OFFSET.value,
  );
  if (parserCount !== generatedCount) {
    throw new Error(`parser counted ${parserCount} events, generated ${generatedCount}`);
  }

  console.log(
    `generated ${trace.length} bytes with ${generatedCount} events; extracted ${extractedCount}`,
  );
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
