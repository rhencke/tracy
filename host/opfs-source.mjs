import { HOST_IMPORT_NAME } from "./abi.mjs";
import { u64ToNumber } from "./memory.mjs";

function makeUnsupportedHostImport(name, reason) {
  return () => {
    throw new Error(`${name}: ${reason}`);
  };
}

function makeHostImports(source, importNames) {
  return Object.fromEntries(importNames.map((name) => [name, source[name]]));
}

const OPFS_SOURCE_IMPORTS = Object.freeze([
  HOST_IMPORT_NAME.OPFS_CREATE_FROM_FILE,
  HOST_IMPORT_NAME.OPFS_READ_CHUNK,
  HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE,
  HOST_IMPORT_NAME.OPFS_SOURCE_NAME,
  HOST_IMPORT_NAME.OPFS_SOURCE_NAME_LEN,
  HOST_IMPORT_NAME.OPFS_SOURCE_OPEN,
  HOST_IMPORT_NAME.OPFS_SOURCE_READ,
  HOST_IMPORT_NAME.OPFS_SOURCE_SIZE,
]);

const OPFS_INDEX_READER_IMPORTS = Object.freeze([
  HOST_IMPORT_NAME.OPFS_INDEX_OPEN,
  HOST_IMPORT_NAME.OPFS_INDEX_READ,
  HOST_IMPORT_NAME.OPFS_INDEX_SIZE,
]);

const OPFS_INDEX_WRITER_IMPORTS = Object.freeze([
  HOST_IMPORT_NAME.OPFS_INDEX_CREATE,
  HOST_IMPORT_NAME.OPFS_INDEX_FLUSH,
  HOST_IMPORT_NAME.OPFS_INDEX_WRITE,
]);
const OPFS_INDEX_SIZE_MAY_BE_STALE = "tracy.opfsIndexSizeMayBeStale";

const OPFS_MAIN_IMPORTS = Object.freeze([
  ...OPFS_SOURCE_IMPORTS,
  ...OPFS_INDEX_READER_IMPORTS,
  ...OPFS_INDEX_WRITER_IMPORTS,
]);

const OPFS_WORKER_IMPORTS = Object.freeze([
  ...OPFS_SOURCE_IMPORTS,
  ...OPFS_INDEX_READER_IMPORTS,
  ...OPFS_INDEX_WRITER_IMPORTS,
]);

const WORKER_UNSUPPORTED_FILE_IMPORTS = Object.freeze([
  HOST_IMPORT_NAME.OPFS_CREATE_FROM_FILE,
  HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE,
]);

export function makeOpfsSourceHost(memoryView, files = new Map()) {
  const sources = new Map();
  const indexes = new Map();
  let nextSourceId = 1;
  let nextIndexId = 1;

  function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
  }

  function requireSource(operation, sourceId) {
    const entry = sources.get(sourceId);

    if (entry === undefined) {
      throw new Error(`${operation}: unknown OPFS source id ${sourceId}`);
    }

    return entry;
  }

  function requireIndex(operation, indexId) {
    const entry = indexes.get(indexId);

    if (entry === undefined) {
      throw new Error(`${operation}: unknown OPFS index id ${indexId}`);
    }

    return entry;
  }

  async function opfsRoot() {
    return navigator.storage?.getDirectory?.() ?? null;
  }

  function decodeName(operation, namePtr, nameLen) {
    const name = memoryView.decodeString(namePtr, nameLen).trim();

    if (name.length === 0) {
      throw new Error(`${operation}: name is empty`);
    }

    return name;
  }

  function pathParts(operation, name) {
    const parts = name.split("/").filter((part) => part.length > 0);

    if (parts.length === 0 || parts.some((part) => part === "." || part === "..")) {
      throw new Error(`${operation}: invalid OPFS path ${name}`);
    }

    return parts;
  }

  async function fileHandleAt(root, operation, name, create) {
    const parts = pathParts(operation, name);
    let directory = root;

    for (const part of parts.slice(0, -1)) {
      directory = await directory.getDirectoryHandle(part, { create });
    }

    return directory.getFileHandle(parts.at(-1), { create });
  }

  function cacheSource(handle, name, size) {
    const sourceId = nextSourceId;
    nextSourceId += 1;
    sources.set(sourceId, { handle, name, size, access: null });
    return sourceId;
  }

  function cacheIndex(handle, name, size) {
    const indexId = nextIndexId;
    nextIndexId += 1;
    indexes.set(indexId, { handle, name, size, access: null });
    return indexId;
  }

  function reserveSource(handle, name, size, sourceId) {
    sources.set(sourceId, { handle, name, size, access: null });
    return sourceId;
  }

  async function maybeSyncAccess(entry) {
    if (entry.access !== null) {
      return entry.access;
    }

    if (typeof entry.handle.createSyncAccessHandle !== "function") {
      return null;
    }

    try {
      entry.access = await entry.handle.createSyncAccessHandle();
      return entry.access;
    } catch (error) {
      return null;
    }
  }

  async function opfsSourceFromFile(fileHandle) {
    const file = files.get(fileHandle);
    const root = await opfsRoot();

    if (file === undefined) {
      throw new Error(`opfs_source_from_file: unknown file handle ${fileHandle}`);
    }

    if (root === null) {
      throw new Error("opfs_source_from_file: OPFS root is unavailable");
    }

    try {
      const sourceId = nextSourceId;
      nextSourceId += 1;
      const opfsName = `trace-${Date.now().toString(36)}-${sourceId}.bin`;
      const handle = await root.getFileHandle(opfsName, { create: true });
      const writable = await handle.createWritable();

      await writable.write(file);
      await writable.close();

      return reserveSource(handle, opfsName, file.size, sourceId);
    } catch (error) {
      throw new Error(`opfs_source_from_file: ${errorMessage(error)}`);
    }
  }

  async function opfsSourceOpen(namePtr, nameLen) {
    const name = decodeName("opfs_source_open", namePtr, nameLen);
    const root = await opfsRoot();

    if (root === null) {
      throw new Error("opfs_source_open: OPFS root is unavailable");
    }

    try {
      const handle = await fileHandleAt(root, "opfs_source_open", name, false);
      const file = await handle.getFile();

      return cacheSource(handle, name, file.size);
    } catch (error) {
      throw new Error(`opfs_source_open: ${errorMessage(error)}`);
    }
  }

  function opfsSourceNameLen(sourceId) {
    const entry = requireSource("opfs_source_name_len", sourceId);

    return new TextEncoder().encode(entry.name).byteLength;
  }

  function opfsSourceName(sourceId, destPtr, destLen) {
    const entry = requireSource("opfs_source_name", sourceId);
    const dest = memoryView.span(destPtr, destLen);

    if (dest === null) {
      throw new Error(`opfs_source_name: invalid destination span ${destPtr}:${destLen}`);
    }

    const encoded = new TextEncoder().encode(entry.name);

    if (destLen < encoded.byteLength) {
      throw new Error(
        `opfs_source_name: destination length ${destLen} is smaller than source name length ${encoded.byteLength}`,
      );
    }

    dest.set(encoded);
    return encoded.byteLength;
  }

  function opfsSourceSize(sourceId) {
    const entry = requireSource("opfs_source_size", sourceId);

    return BigInt(entry.size);
  }

  async function opfsSourceRead(sourceId, offset, len, destPtr) {
    const entry = requireSource("opfs_source_read", sourceId);
    const start = u64ToNumber(offset);
    const dest = memoryView.span(destPtr, len);

    if (start < 0) {
      throw new Error(`opfs_source_read: invalid offset ${offset}`);
    }

    if (dest === null) {
      throw new Error(`opfs_source_read: invalid destination span ${destPtr}:${len}`);
    }

    try {
      const access = await maybeSyncAccess(entry);

      if (access !== null) {
        return access.read(dest, { at: start });
      }

      const file = await entry.handle.getFile();
      const chunk = await file.slice(start, start + len).arrayBuffer();
      const src = new Uint8Array(chunk);

      dest.set(src);
      return src.byteLength;
    } catch (error) {
      throw new Error(`opfs_source_read: ${errorMessage(error)}`);
    }
  }

  async function opfsIndexCreate(namePtr, nameLen) {
    const name = decodeName("opfs_index_create", namePtr, nameLen);
    const root = await opfsRoot();

    if (root === null) {
      throw new Error("opfs_index_create: OPFS root is unavailable");
    }

    try {
      const handle = await fileHandleAt(root, "opfs_index_create", name, true);
      const writable = await handle.createWritable({ keepExistingData: false });

      await writable.close();
      return cacheIndex(handle, name, 0);
    } catch (error) {
      throw new Error(`opfs_index_create: ${errorMessage(error)}`);
    }
  }

  async function opfsIndexOpen(namePtr, nameLen) {
    const name = decodeName("opfs_index_open", namePtr, nameLen);
    const root = await opfsRoot();

    if (root === null) {
      throw new Error("opfs_index_open: OPFS root is unavailable");
    }

    try {
      const handle = await fileHandleAt(root, "opfs_index_open", name, false);
      const file = await handle.getFile();

      return cacheIndex(handle, name, file.size);
    } catch (error) {
      throw new Error(`opfs_index_open: ${errorMessage(error)}`);
    }
  }

  function opfsIndexSize(indexId) {
    const entry = requireIndex("opfs_index_size", indexId);

    return BigInt(entry.size);
  }

  async function opfsIndexRead(indexId, offset, len, destPtr) {
    const entry = requireIndex("opfs_index_read", indexId);
    const start = u64ToNumber(offset);
    const dest = memoryView.span(destPtr, len);

    if (start < 0) {
      throw new Error(`opfs_index_read: invalid offset ${offset}`);
    }

    if (dest === null) {
      throw new Error(`opfs_index_read: invalid destination span ${destPtr}:${len}`);
    }

    try {
      const access = await maybeSyncAccess(entry);

      if (access !== null) {
        return access.read(dest, { at: start });
      }

      const file = await entry.handle.getFile();
      const chunk = await file.slice(start, start + len).arrayBuffer();
      const src = new Uint8Array(chunk);

      dest.set(src);
      return src.byteLength;
    } catch (error) {
      throw new Error(`opfs_index_read: ${errorMessage(error)}`);
    }
  }

  async function opfsIndexWrite(indexId, offset, srcPtr, len) {
    const entry = requireIndex("opfs_index_write", indexId);
    const start = u64ToNumber(offset);
    const src = memoryView.span(srcPtr, len);

    if (start < 0) {
      throw new Error(`opfs_index_write: invalid offset ${offset}`);
    }

    if (src === null) {
      throw new Error(`opfs_index_write: invalid source span ${srcPtr}:${len}`);
    }

    try {
      const access = await maybeSyncAccess(entry);
      let written = 0;

      if (access !== null) {
        written = access.write(src, { at: start });
      } else {
        const writable = await entry.handle.createWritable({ keepExistingData: true });

        await writable.seek(start);
        await writable.write(src);
        await writable.close();
        written = src.byteLength;
      }

      entry.size = Math.max(entry.size, start + written);
      return written;
    } catch (error) {
      throw new Error(`opfs_index_write: ${errorMessage(error)}`);
    }
  }

  async function opfsIndexFlush(indexId) {
    const entry = requireIndex("opfs_index_flush", indexId);

    try {
      const access = await maybeSyncAccess(entry);

      if (access !== null && typeof access.flush === "function") {
        await access.flush();
      }

      return 0;
    } catch (error) {
      throw new Error(`opfs_index_flush: ${errorMessage(error)}`);
    }
  }

  const opfsHost = {
    [HOST_IMPORT_NAME.OPFS_CREATE_FROM_FILE]: opfsSourceFromFile,
    [HOST_IMPORT_NAME.OPFS_READ_CHUNK]: opfsSourceRead,
    [HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE]: opfsSourceFromFile,
    [HOST_IMPORT_NAME.OPFS_SOURCE_NAME]: opfsSourceName,
    [HOST_IMPORT_NAME.OPFS_SOURCE_NAME_LEN]: opfsSourceNameLen,
    [HOST_IMPORT_NAME.OPFS_SOURCE_OPEN]: opfsSourceOpen,
    [HOST_IMPORT_NAME.OPFS_SOURCE_READ]: opfsSourceRead,
    [HOST_IMPORT_NAME.OPFS_SOURCE_SIZE]: opfsSourceSize,
    [HOST_IMPORT_NAME.OPFS_INDEX_OPEN]: opfsIndexOpen,
    [HOST_IMPORT_NAME.OPFS_INDEX_READ]: opfsIndexRead,
    [HOST_IMPORT_NAME.OPFS_INDEX_SIZE]: opfsIndexSize,
    [HOST_IMPORT_NAME.OPFS_INDEX_CREATE]: opfsIndexCreate,
    [HOST_IMPORT_NAME.OPFS_INDEX_FLUSH]: opfsIndexFlush,
    [HOST_IMPORT_NAME.OPFS_INDEX_WRITE]: opfsIndexWrite,
  };

  return makeHostImports(opfsHost, OPFS_WORKER_IMPORTS);
}

export function makeOpfsMainHost(memoryView, files = new Map()) {
  const opfsHost = makeOpfsSourceHost(memoryView, files);

  return {
    ...makeHostImports(opfsHost, OPFS_MAIN_IMPORTS),
    [OPFS_INDEX_SIZE_MAY_BE_STALE]: true,
  };
}

export function makeOpfsWorkerHost(memoryView) {
  const opfsHost = makeOpfsSourceHost(memoryView);
  const workerHost = makeHostImports(opfsHost, OPFS_WORKER_IMPORTS);

  for (const name of WORKER_UNSUPPORTED_FILE_IMPORTS) {
    workerHost[name] = makeUnsupportedHostImport(
      name,
      "file handles are owned by the main thread",
    );
  }

  return workerHost;
}
