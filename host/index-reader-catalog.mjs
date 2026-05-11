import { HOST_IMPORT_NAME } from "./abi.mjs";
import { INDEX_FORMAT } from "./index-format-spec.mjs";
import { globalValue, promisingWasmExport } from "./memory.mjs";
export const OPFS_INDEX_SIZE_MAY_BE_STALE =
  "tracy.opfsIndexSizeMayBeStale";

function indexPageCountFromSize(size) {
  return typeof size === "bigint"
    ? Number(size / BigInt(INDEX_FORMAT.OPFS_PAGE_SIZE))
    : Math.floor(Number(size) / INDEX_FORMAT.OPFS_PAGE_SIZE);
}

function hasCatalogRebuildExports(index) {
  return (
    typeof index.index_page_catalog_reset === "function" &&
    typeof index.index_page_catalog_add_page === "function" &&
    typeof index.read_page === "function" &&
    "INDEX_WRITER_STATUS_CATALOG_FULL" in index
  );
}

export async function rebuildMainThreadSliceCatalog(
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
  let rebuilt = false;
  let nextPageId = startPage;
  const endPage = probeUntilMissing ? Number.MAX_SAFE_INTEGER : pageCount;
  const maxProbePages = Math.max(
    1,
    Math.floor(options.maxProbePages ?? Number.MAX_SAFE_INTEGER),
  );
  const readPage = promisingWasmExport(index.read_page, index);
  for (let pageId = startPage; pageId < endPage; pageId += 1) {
    if (pageId - startPage >= maxProbePages) {
      return { catalogFull: false, pageCount: nextPageId, rebuilt };
    }

    const page = await readPage(0, pageId);
    if (page === 0) {
      if (probeUntilMissing) {
        return { pageCount: pageId, rebuilt };
      }
      throw new Error(`main-thread index reader failed to read page ${pageId}`);
    }
    rebuilt = true;
    nextPageId = pageId + 1;

    const status = globalValue(
      index.index_page_catalog_add_page(
        page,
        INDEX_FORMAT.OPFS_PAGE_SIZE,
        pageId,
      ),
    );
    if (status === globalValue(index.INDEX_STATUS_OK ?? 0)) {
      continue;
    }
    if (status === globalValue(index.INDEX_WRITER_STATUS_CATALOG_FULL ?? -1)) {
      return {
        catalogFull: true,
        pageCount: probeUntilMissing ? pageId : pageCount,
        rebuilt,
      };
    }
    throw new Error(`main-thread index reader rejected page ${pageId}`);
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
