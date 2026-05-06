import { HOST_IMPORT_NAME } from "./abi.mjs";
import { u64ToNumber } from "./memory.mjs";

export function makeOpfsSourceHost(memoryView, files) {
  const sources = new Map();
  let nextSourceId = 1;

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

  async function opfsRoot() {
    return navigator.storage?.getDirectory?.() ?? null;
  }

  function cacheSource(handle, name, size) {
    const sourceId = nextSourceId;
    nextSourceId += 1;
    sources.set(sourceId, { handle, name, size, access: null });
    return sourceId;
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
    const name = memoryView.decodeString(namePtr, nameLen).trim();
    const root = await opfsRoot();

    if (name.length === 0) {
      throw new Error("opfs_source_open: source name is empty");
    }

    if (root === null) {
      throw new Error("opfs_source_open: OPFS root is unavailable");
    }

    try {
      const handle = await root.getFileHandle(name, { create: false });
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

  return {
    [HOST_IMPORT_NAME.OPFS_CREATE_FROM_FILE]: opfsSourceFromFile,
    [HOST_IMPORT_NAME.OPFS_READ_CHUNK]: opfsSourceRead,
    [HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE]: opfsSourceFromFile,
    [HOST_IMPORT_NAME.OPFS_SOURCE_NAME]: opfsSourceName,
    [HOST_IMPORT_NAME.OPFS_SOURCE_NAME_LEN]: opfsSourceNameLen,
    [HOST_IMPORT_NAME.OPFS_SOURCE_OPEN]: opfsSourceOpen,
    [HOST_IMPORT_NAME.OPFS_SOURCE_READ]: opfsSourceRead,
    [HOST_IMPORT_NAME.OPFS_SOURCE_SIZE]: opfsSourceSize,
  };
}
