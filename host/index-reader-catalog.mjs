import { HOST_IMPORT_NAME } from "./abi.mjs";
import {
  INDEX_DECODE_HINTS,
  INDEX_FORMAT,
  INDEX_PAGE_HEADER_OFFSETS,
} from "./index-format-spec.mjs";
export const OPFS_INDEX_SIZE_MAY_BE_STALE =
  "tracy.opfsIndexSizeMayBeStale";

function globalValue(value) {
  return value instanceof WebAssembly.Global ? value.value : value;
}

function indexPageCountFromSize(size) {
  return typeof size === "bigint"
    ? Number(size / BigInt(INDEX_FORMAT.OPFS_PAGE_SIZE))
    : Math.floor(Number(size) / INDEX_FORMAT.OPFS_PAGE_SIZE);
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

    const status = index.index_validate_page(page, INDEX_FORMAT.OPFS_PAGE_SIZE);
    if (globalValue(status) !== globalValue(index.INDEX_STATUS_OK ?? 0)) {
      throw new Error(`main-thread index reader rejected page ${pageId}`);
    }

    const hints = view.getUint32(
      page + INDEX_PAGE_HEADER_OFFSETS.DECODE_HINTS,
      true,
    );
    if ((hints & INDEX_DECODE_HINTS.COMPACT_SLICES) === 0) {
      continue;
    }

    const added = index.index_page_catalog_add_slice_page(
      hints >>> INDEX_DECODE_HINTS.TRACK_ID_SHIFT,
      pageId,
      view.getUint32(page + INDEX_PAGE_HEADER_OFFSETS.BUCKET_START, true),
      view.getUint32(page + INDEX_PAGE_HEADER_OFFSETS.BUCKET_END, true),
      view.getUint32(page + INDEX_PAGE_HEADER_OFFSETS.RECORD_COUNT, true),
    );
    if (added === 0) {
      return {
        catalogFull: true,
        pageCount: probeUntilMissing ? pageId : pageCount,
        rebuilt,
      };
    }
  }

  return { catalogFull: false, pageCount: nextPageId, rebuilt };
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
