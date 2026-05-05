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

The index cache at `MEM_INDEX_CACHE_BASE` is a page cache, not an arena for
the whole index.  OPFS page id `n` maps to byte offset `n * 65536` in the
index file, and a loaded page occupies exactly one 64 KiB cache slot.  Slot
metadata is module-private index state; bytes inside the slot always keep the
same header, payload, unused space, and optional footer layout used on disk.

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

### Raw-event index pages

Raw-event index pages use page magic `TRCI` and level `0`.  Each page covers
one contiguous timestamp bucket for one track group.  Events inside a page
are sorted by `(track_id, timestamp, input_order)` so timestamp deltas stay
small and a decoder can scan forward without seeking into another page.

The 64-byte page header is followed by a compact column directory.  Directory
entries are fixed-width so the decoder can find any column with one indexed
load:

| Offset | Size | Field |
|---:|---:|---|
| 0 | 1 | Column id. |
| 1 | 1 | Encoding id for the column payload. |
| 2 | 2 | Flags, zero unless specified by the encoding. |
| 4 | 4 | Payload offset from the start of the page. |
| 8 | 4 | Payload byte length. |
| 12 | 4 | Decoded row count or run count, depending on encoding. |

The directory starts with a 4-byte prelude:

| Offset from payload start | Size | Field |
|---:|---:|---|
| 0 | 1 | Directory version, `1` for v0.1. |
| 1 | 1 | Directory entry count. |
| 2 | 2 | Directory byte length, including this prelude. |

Column payload offsets are relative to the start of the 64 KiB page, not to
the payload start.  The directory is the first payload segment, column
payloads follow it in ascending column id order, and every unused byte after
the last payload segment is zeroed until the optional footer.

The v0.1 raw-event stream has these required columns:

| Column id | Column | Meaning |
|---:|---|---|
| 1 | `track_id` | Dictionary-coded process/thread track for each row. |
| 2 | `ts_delta` | Timestamp delta from the page bucket start. |
| 3 | `dur` | Event duration, or zero for instant events. |
| 4 | `name_id` | Dictionary id for the trace event `name`. |
| 5 | `cat_id` | Dictionary id for the trace event `cat`, with `0` for missing. |
| 6 | `phase` | Chrome trace phase code, stored as a compact integer column. |
| 7 | `flags` | Bitset for row-local properties such as async, flow, or side data. |

Optional columns are present only when at least one row in the page needs
them.  v0.1 reserves optional column ids `32..63` for sparse trace fields
such as `args`, flow ids, bind ids, scope strings, and source locations.
Optional columns must use an encoding that preserves row alignment, usually
RLE for absent values plus a packed non-null value stream.

Every required column decodes to exactly the page header's record count.
Optional columns either decode to that same row count or name a side page and
row range in their payload.  A page is malformed if a required column is
missing, a column range overlaps another range, a payload extends past the
declared payload byte length, or a non-zero byte appears in unused page space.

### Resumable index writes

Index pages are committed in page-id order.  The writer fills the header with
the header CRC field zeroed, writes the directory and column payloads, zeroes
unused space, computes the payload CRC32C, then writes the footer magic
`DONE` last.  The footer is the commit marker; a page without `DONE` is
treated as absent even if its header and payload look complete.

The `previous committed page id` footer field forms a backward chain through
the committed index.  On resume, the indexer reads candidate pages from the
highest known page id downward until it finds a page whose header CRC,
payload CRC, commit sequence, previous-page link, and `DONE` marker agree.
Indexing resumes at the next page id and may overwrite any later incomplete
pages.

The dictionary epoch in the page header is part of the resumability contract:
the epoch must already be committed before any page that references it is
accepted.  A resumed indexer must either reuse the committed epoch or start a
new epoch; it must not rewrite an already committed page to point at a
different dictionary layout.

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
