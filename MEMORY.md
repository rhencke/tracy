# Linear memory layout

This file is the v0.1 contract for every WAT module that touches tracy
linear memory.  The 10 GB trace target is handled with OPFS-backed pages:
linear memory holds fixed-size working regions and caches, not the whole
trace index.

All byte sizes use binary units.  One wasm page is 64 KiB.

## Region map

| Region | Constant | Byte range | Size | Owner | Growth policy | Notes |
|---|---:|---:|---:|---|---|---|
| Scratch (per-tick) | `MEM_SCRATCH_BASE` | `0x00000000..0x000FFFFF` | 1 MiB | app | Fixed | Reset every `tracy_tick`; no persistent pointers. |
| Token ring buffer | `MEM_RING_BASE` | `0x00100000..0x004FFFFF` | 4 MiB | parser | Fixed | Streaming JSON input from OPFS and the host shim. |
| String/dict table | `MEM_DICT_BASE` | `0x00500000..0x014FFFFF` | 16 MiB | parser/index | Fixed for v0.1 | Dictionary-coded names, categories, process ids, and thread ids. |
| Index page LRU cache | `MEM_INDEX_CACHE_BASE` | `0x01500000..0x114FFFFF` | 256 MiB | index | Fixed cache window | Demand-paged from OPFS by later index work. |
| LOD pyramid page cache | `MEM_PYRAMID_CACHE_BASE` | `0x11500000..0x194FFFFF` | 128 MiB | renderer | Fixed cache window | Demand-paged from OPFS by later renderer work. |
| Render scratch | `MEM_RENDER_SCRATCH` | `0x19500000..0x1B4FFFFF` | 32 MiB | renderer | Fixed | Per-frame compositing and transient draw preparation. |
| Bump-allocator heap | `MEM_HEAP_BASE` | `0x1B500000..0x1F4FFFFF` | 64 MiB | shared | Grow only through `app.wat` | Short-lived allocations; modules request extension through `grow_heap(pages)`. |
| Wasm stack + globals | `MEM_STACK_BASE` | `0x1F500000..0x204FFFFF` | 16 MiB | wasm | Fixed initial reservation | Stack, globals, and module-private runtime state. |
| **Total planned heap** | | `0x00000000..0x204FFFFF` | **517 MiB** | | | Leaves about 83 MiB within the 600 MiB working target, plus headroom for Canvas2D backing and JS bootstrap under the 1 GiB ceiling. |

The minimum initial memory for the v0.1 layout is 8,272 wasm pages
(`0x20500000` bytes).  The 600 MiB working target is 9,600 wasm pages,
and the 1 GiB heap ceiling is 16,384 wasm pages.  Region bases are
MiB-aligned so 64 KiB OPFS pages never straddle two regions.

## Constants

The shared constants are exported by `wat/std/mem.wat` and mirrored here
so design docs and module code use the same names.

| Constant | Value | Meaning |
|---|---:|---|
| `MEM_SCRATCH_BASE` | `0x00000000` | Per-tick app scratch base. |
| `MEM_RING_BASE` | `0x00100000` | Parser token ring base. |
| `MEM_DICT_BASE` | `0x00500000` | Shared dictionary table base. |
| `MEM_INDEX_CACHE_BASE` | `0x01500000` | Index page cache base. |
| `MEM_PYRAMID_CACHE_BASE` | `0x11500000` | LOD pyramid page cache base. |
| `MEM_RENDER_SCRATCH` | `0x19500000` | Renderer scratch base. |
| `MEM_HEAP_BASE` | `0x1B500000` | Shared bump heap base. |

`MEM_STACK_BASE`, region sizes, page size constants, and end addresses may
also be exported for convenience, but the base constants above are the
cross-module ABI surface required by v0.1.

## Ownership rules

Each region has exactly one writer.  Reads are unrestricted, but a reader
must treat any bytes owned by another module as immutable unless the owning
module exposes a function that says otherwise.

The app owns frame lifecycle and memory growth.  Parser code writes the
ring and string dictionaries.  Index code writes index-cache pages and may
read parser dictionaries.  Renderer code writes pyramid-cache pages and
render scratch.  The shared bump heap is written only by the allocator entry
points; callers receive spans and must release them by arena reset, not by
freeing individual allocations.

No module may write the same byte as another module without an explicit
handoff protocol in the owning module.  Handoffs should be page-granular
where possible, with a state word moving through `empty`, `loading`,
`ready`, and `evicting`.

## Growth policy

Only `app.wat` may call `memory.grow`.  Other modules request heap growth
through `grow_heap(pages)`, where `pages` is a count of 64 KiB wasm pages.

Growth can extend only the shared bump-allocator heap reservation.  Fixed
regions do not slide, resize, or change base address after startup.  A
failed growth request returns failure to the caller; the caller must evict
cache pages, reset scratch arenas, or report an ingest/render failure rather
than retrying in a tight loop.

Future modules that need persistent data beyond these budgets must store it
in OPFS pages and cache a bounded working set in one of the page-cache
regions.

## Page format

Index and LOD data are stored in fixed 64 KiB pages.  OPFS offsets are page
aligned, and cache slots in linear memory are page aligned.  A cache slot
contains exactly one decoded or partially decoded page.

Every page starts with a 64-byte header:

| Offset | Size | Field |
|---:|---:|---|
| 0 | 4 | Magic: `TRCI` for index pages, `TRCP` for pyramid pages. |
| 4 | 2 | Format version. |
| 6 | 2 | Header size in bytes. |
| 8 | 4 | Level: `0` for raw-event index pages, higher values for LOD buckets. |
| 12 | 8 | Inclusive bucket start timestamp delta from trace start. |
| 20 | 8 | Exclusive bucket end timestamp delta from trace start. |
| 28 | 4 | Event or aggregate record count. |
| 32 | 4 | Payload byte length. |
| 36 | 4 | Decode hints bitset. |
| 40 | 4 | Dictionary epoch used by this page. |
| 44 | 4 | Header CRC32C with this field zeroed. |
| 48 | 8 | Source OPFS page id or monotonically assigned page number. |
| 56 | 8 | Reserved, zero for v0.1. |

Payload bytes follow the header and end before the 64 KiB page boundary.
Unused bytes at the end of a page are zeroed.  A page footer occupies the
last 16 bytes when resumability is enabled:

| Offset from page end | Size | Field |
|---:|---:|---|
| -16 | 4 | Payload CRC32C. |
| -12 | 4 | Previous committed page id, or `0xFFFFFFFF` if none. |
| -8 | 4 | Commit sequence. |
| -4 | 4 | Footer magic: `DONE`. |

Readers accept a page only when the header, payload length, checksum, and
footer commit marker agree.  On resume after interruption, the indexer scans
backward to the last committed page and resumes from the next page id.

## Encoding spec

The average encoded event budget is at most 12 bytes per event in index
pages.  Wide strings and uncommon fields are dictionary-coded or moved into
side tables so the hot event stream stays compact.

Integer fields use unsigned LEB128 varints unless a field explicitly says it
is zigzag-encoded.  Timestamp and duration values are stored as deltas from
the page base timestamp.  Negative deltas, when needed for clock correction
or async relationships, use zigzag encoding before unsigned LEB128 storage.

Name, category, process id, and thread id are dictionary-coded.  The event
stream stores dictionary ids, not repeated strings.  Dictionary id `0` is
reserved for null or missing, and ids are scoped by dictionary epoch so OPFS
pages remain decodable after dictionary compaction.

Fields with high null rates use run-length encoding.  A run header records
the target field id, null/non-null mode, and run length as varints.  Non-null
runs then store a packed stream of values using that field's normal encoding.
Sparse optional data that still exceeds the per-event budget belongs in a
side page referenced by page id and row range.

Page payloads are independently decodable.  A decoder needs only the page
header, the dictionary epoch named in the header, and any side pages named by
decode hints.  This keeps cache eviction simple: no hot page may depend on a
different hot page being resident.

## Host-shim GC pressure

The parser and host shim must stream text with
`TextDecoder({ stream: true })`.  The shim should reuse `Uint8Array` views
across the host/WAT boundary instead of allocating a fresh view per chunk.

The ring buffer is the ownership boundary for incoming JSON bytes.  Host
code writes into vacant ring spans, parser code advances the consumed cursor,
and neither side allocates per-token JS objects during ingest.
