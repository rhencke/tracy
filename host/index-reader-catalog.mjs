import { HOST_IMPORT_NAME } from "./abi.mjs";

const OPFS_PAGE_SIZE = 0x00010000;
const INDEX_DECODE_HINT_COMPACT_SLICES = 1;
const INDEX_DECODE_HINT_TRACK_ID_SHIFT = 8;
const INDEX_PAGE_HEADER_BUCKET_START_OFFSET = 12;
const INDEX_PAGE_HEADER_BUCKET_END_OFFSET = 20;
const INDEX_PAGE_HEADER_RECORD_COUNT_OFFSET = 28;
const INDEX_PAGE_HEADER_DECODE_HINTS_OFFSET = 36;
export const OPFS_INDEX_SIZE_MAY_BE_STALE =
  "tracy.opfsIndexSizeMayBeStale";

function globalValue(value) {
  return value instanceof WebAssembly.Global ? value.value : value;
}

function indexPageCountFromSize(size) {
  return typeof size === "bigint"
    ? Number(size / BigInt(OPFS_PAGE_SIZE))
    : Math.floor(Number(size) / OPFS_PAGE_SIZE);
}

function hasCatalogRebuildExports(index) {
  return (
    typeof index.index_page_catalog_reset === "function" &&
    typeof index.index_page_catalog_add_slice_page === "function" &&
    typeof index.index_validate_page === "function" &&
    typeof index.read_page === "function"
  );
}

export function rebuildMainThreadSliceCatalog(
  memory,
  host,
  index,
  indexId,
  options = {},
) {
  const sizeFn = host[HOST_IMPORT_NAME.OPFS_INDEX_SIZE];
  if (typeof sizeFn !== "function") {
    return false;
  }

  const pageCount =
    options.pageCount ?? mainThreadSliceCatalogPageCount(host, indexId);
  const startPage = Math.max(0, options.startPage ?? 0);
  const probeUntilMissing = options.probeUntilMissing === true;
  if (!probeUntilMissing && (pageCount <= 0 || startPage >= pageCount)) {
    return { pageCount: Math.max(0, pageCount), rebuilt: false };
  }

  if (!hasCatalogRebuildExports(index)) {
    throw new Error("main-thread index reader cannot rebuild slice catalog");
  }

  if (options.reset !== false) {
    index.index_page_catalog_reset();
  }
  const view = new DataView(memory.buffer);
  let rebuilt = false;
  let nextPageId = startPage;
  const endPage = probeUntilMissing ? Number.MAX_SAFE_INTEGER : pageCount;
  for (let pageId = startPage; pageId < endPage; pageId += 1) {
    const page = index.read_page(0, pageId);
    if (page === 0) {
      if (probeUntilMissing) {
        return { pageCount: pageId, rebuilt };
      }
      throw new Error(`main-thread index reader failed to read page ${pageId}`);
    }
    rebuilt = true;
    nextPageId = pageId + 1;

    const status = index.index_validate_page(page, OPFS_PAGE_SIZE);
    if (globalValue(status) !== globalValue(index.INDEX_STATUS_OK ?? 0)) {
      throw new Error(`main-thread index reader rejected page ${pageId}`);
    }

    const hints = view.getUint32(
      page + INDEX_PAGE_HEADER_DECODE_HINTS_OFFSET,
      true,
    );
    if ((hints & INDEX_DECODE_HINT_COMPACT_SLICES) === 0) {
      continue;
    }

    index.index_page_catalog_add_slice_page(
      hints >>> INDEX_DECODE_HINT_TRACK_ID_SHIFT,
      pageId,
      view.getUint32(page + INDEX_PAGE_HEADER_BUCKET_START_OFFSET, true),
      view.getUint32(page + INDEX_PAGE_HEADER_BUCKET_END_OFFSET, true),
      view.getUint32(page + INDEX_PAGE_HEADER_RECORD_COUNT_OFFSET, true),
    );
  }

  return { pageCount: nextPageId, rebuilt };
}

export function mainThreadSliceCatalogPageCount(host, indexId) {
  const sizeFn = host[HOST_IMPORT_NAME.OPFS_INDEX_SIZE];
  if (typeof sizeFn !== "function") {
    return 0;
  }

  return indexPageCountFromSize(sizeFn(indexId));
}

export function shouldProbeMainThreadSliceCatalog(host) {
  return host?.[OPFS_INDEX_SIZE_MAY_BE_STALE] === true;
}
