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

### Encoding ids

Column directory entries identify the payload format with these v0.1
encoding ids:

| Encoding id | Name | Payload shape |
|---:|---|---|
| 0 | `absent` | Reserved for missing optional columns; not valid for required columns. |
| 1 | `uvarint` | Packed unsigned LEB128 value stream. |
| 2 | `zigzag-varint` | Packed signed values after zigzag transform and unsigned LEB128 storage. |
| 3 | `dict8` | One byte per row, interpreted in the page dictionary epoch. |
| 4 | `dict16` | Two little-endian bytes per row, interpreted in the page dictionary epoch. |
| 5 | `fixed8` | One byte per row for phases, flags, and small enums. |
| 6 | `rle` | Run packets for sparse optional columns. |
| 7 | `side-ref` | Packed references to side pages for values too large for the hot stream. |

Unknown encoding ids make the page unreadable for v0.1.  A later format may
add new ids only by bumping the page format version so old decoders fail
closed instead of silently misreading column bytes.

### Varints

Integer fields use unsigned LEB128 unless their column encoding id is
`zigzag-varint`.  Each byte contributes seven payload bits; bit `0x80`
indicates that another byte follows.  Encoders must use the shortest legal
form, so values `0..127` use one byte and a decoder rejects overlong forms.

Signed values use the standard zigzag mapping before unsigned LEB128
storage:

```text
zigzag(n) = (n << 1) ^ (n >> 63)
```

Timestamp columns are page-local.  `ts_delta` stores the unsigned delta from
the page header's inclusive bucket start timestamp.  Duration stores an
unsigned event duration, with zero for instant events.  A column may use
`zigzag-varint` only when the design explicitly permits negative values,
such as future clock-correction or async relationship columns; raw-event
`ts_delta` and `dur` are non-negative in v0.1.

Varint streams are self-delimiting but not self-counting.  The column
directory's decoded row count is the authoritative number of values to scan.
A decoder reaches the end of a varint column only after reading that many
values and landing exactly on `payload_offset + payload_byte_length`.

### Dictionaries

The dictionary region at `MEM_DICT_BASE` stores interned values for event
names, categories, process/thread tracks, and other repeated strings or
small ids.  The page header's dictionary epoch selects the immutable snapshot
used to decode every dictionary-coded column in that page.

Dictionary id `0` is reserved for null or missing.  Non-zero ids are scoped
to their dictionary kind and epoch; `name_id 10` and `cat_id 10` are not the
same entry unless their kind also matches.  Epoch metadata must include the
committed OPFS location of each dictionary kind, the number of entries, and
the code-width tier used by hot pages.

The v0.1 code-width tiers are:

| Tier | Range | Use |
|---|---:|---|
| `dict8` | `0..255` | Page-local hot code table for common values. |
| `dict16` | `0..65535` | Normal compressed ids for names, categories, and tracks. |
| `side-ref` | Larger ids or large values | Rare values stored through a side page reference. |

`dict8` values are page-local aliases into the epoch dictionary.  A page that
uses `dict8` must include a hot-code table for that column in the same page
payload so decoding does not require neighboring pages.  The hot-code table
maps each one-byte code to a full epoch dictionary id.  Code `0` still means
null.

`dict16` stores full epoch dictionary ids directly as little-endian unsigned
16-bit values.  If an epoch grows beyond 65,535 entries for a kind, newly
introduced rare values must be emitted as `side-ref` values until a later
epoch compacts or retires the dictionary.

Dictionary compaction is epoch based.  Committing a new epoch never mutates
the meaning of old ids; old OPFS pages remain decodable as long as their
epoch metadata is retained.  A dictionary epoch may be garbage-collected only
after no committed page header references it.

### RLE packets

RLE is used for optional columns with high null rates, especially `args` and
future flow metadata.  An RLE payload is a sequence of packets.  Each packet
starts with one unsigned LEB128 header:

```text
header = (run_length << 2) | mode
```

The low two mode bits are:

| Mode | Meaning | Packet body |
|---:|---|---|
| 0 | Null run | No body; all rows in the run decode to null. |
| 1 | Literal run | `run_length` values encoded with the column's value encoding. |
| 2 | Repeated value | One encoded value repeated for `run_length` rows. |
| 3 | Side-reference run | One or more side-page references covering the run. |

`run_length` must be non-zero.  Runs are concatenated until their decoded row
counts equal the page header's record count.  A decoder rejects an RLE column
if the runs underflow, overflow, or leave trailing bytes after the final
packet.

The column directory flags for an RLE column identify the value encoding used
inside literal and repeated-value bodies: unsigned varint, zigzag varint,
`dict8`, `dict16`, `fixed8`, or `side-ref`.  Literal bodies contain exactly
one value per row in the run.  Repeated-value bodies contain one value total.

### Side pages

Values that would blow the hot stream budget are stored in side pages and
referenced from `side-ref` payloads or RLE side-reference packets.  Side
pages use the index page magic `TRCI`, a non-zero side-page level reserved by
the index module, and the same 64 KiB header/footer rules as raw-event pages.

A side reference stores four unsigned LEB128 values:

```text
page_id, byte_offset, byte_length, row_count
```

Offsets are relative to the start of the referenced side page payload, not
to the 64-byte page header.  `row_count` is the number of raw-event rows
covered by the reference.  For a scalar large value, `row_count` is `1`; for
an RLE side-reference packet, the sum of referenced row counts must equal the
packet's run length.

Side pages are immutable once committed.  A raw-event page may reference only
side pages whose footer commit sequence is less than or equal to its own
commit sequence, so resume never leaves a committed hot page pointing at an
uncommitted side page.

### Independent page decode

Page payloads are independently decodable.  A decoder needs only the page
header, the column directory, the dictionary epoch named in the header, and
any side pages named by `side-ref` payloads.  This keeps cache eviction
simple: no hot page may depend on a different hot page being resident.

All page-local lookup tables needed by a column, including `dict8` hot-code
tables, live inside that page's payload and are covered by its payload CRC.
Cross-page state is limited to immutable dictionary epochs and committed side
pages named by explicit page id.  A page is malformed if decoding any column
requires scanning a previous or next raw-event page.

### 100 MB fixture byte budget

The v0.1 index must average at most 12 encoded bytes per raw event on the
100 MB synthetic Chrome trace fixture used to gate index work.  The fixture
models one sorted trace with dense timestamps, common names and categories,
stable process/thread tracks, mostly complete `dur`, and sparse optional
`args` data.  Side pages count toward the average; OPFS page slack, page
headers, and column directories also count.

The budget target is:

| Component | Encoding | Budget B/event | Notes |
|---|---|---:|---|
| Page overhead | Header, footer, directory, padding | 0.30 | Assumes pages are filled to at least 90% before commit. |
| `track_id` | `dict8` hot table, `dict16` fallback | 1.00 | Synthetic tracks fit in the page-local hot tier. |
| `ts_delta` | `uvarint` | 2.00 | Sorted track-local deltas usually fit in one or two bytes. |
| `dur` | `uvarint` | 1.50 | Short durations dominate; long spans use wider varints. |
| `name_id` | `dict8` hot table, `dict16` fallback | 1.25 | Common event names take one byte; uncommon names take two. |
| `cat_id` | `dict8` hot table, `dict16` fallback | 0.75 | Missing category uses id `0`; common categories use one byte. |
| `phase` | `fixed8` | 1.00 | Chrome trace phase code. |
| `flags` | `fixed8` | 1.00 | Row-local side-data and relationship bits. |
| Optional fields | `rle` plus `side-ref` | 1.60 | Null runs dominate; non-null `args` live in side pages. |
| **Total target** | | **10.40** | Leaves 1.60 B/event headroom below the 12 B/event cap. |

The gate assertion for #11 is: after indexing the 100 MB synthetic fixture,
`(raw index page bytes + side page bytes + committed dictionary bytes used by
the fixture) / event_count <= 12.0`.  The measurement uses committed OPFS byte
lengths, not just in-memory payload lengths, so page padding and resumability
metadata stay visible.

### Decoder API contract

The index implementation must expose a page-oriented decoder API.  The API
is a design contract here; exact WAT function names can change when #11
implements it, but the behavior and ownership rules are fixed.

| Operation | Inputs | Output | Contract |
|---|---|---|---|
| `index_validate_page` | Cache-slot pointer, page byte length | Status code | Checks magic, format version, payload bounds, CRCs, footer, and required columns before decode. |
| `index_column_span` | Validated page pointer, column id | Pointer, byte length, encoding id, row count | Returns a zero-copy span inside the page payload. |
| `index_varint_scan` | Column span, start row, row limit | Last row, last byte offset, optional decoded value | Scans without materializing a full column and may stop at any row boundary. |
| `index_dict_lookup` | Dictionary epoch, kind, dictionary id | Pointer, byte length, type tag | Resolves ids through immutable epoch tables without copying string bytes. |
| `index_rle_seek` | RLE column span, target row | Run descriptor | Skips null and repeated runs without expanding them. |
| `index_side_ref_open` | Side reference tuple | Validated side-page span | Loads or pins the named side page and validates its commit marker before use. |
| `index_page_cursor_next` | Cursor over one raw-event page | Row view or end status | Advances across columns in lockstep and never crosses to another raw-event page implicitly. |

Zero-copy scan means decoders read directly from the 64 KiB cache slot at
`MEM_INDEX_CACHE_BASE` or from a validated side-page slot.  Varint scans may
return intermediate byte offsets so later calls resume from the same column
without rescanning from row zero.  They must reject overlong varints, values
that exceed the field's documented range, and streams that end before the
directory row count is satisfied.

Dictionary lookup returns borrowed spans into `MEM_DICT_BASE` or a committed
dictionary side page.  Callers must not retain those spans after the owning
dictionary epoch is evicted from the dictionary cache.  A raw-event page pins
its dictionary epoch for the duration of decode so page scans see stable
strings and ids.

Page boundary handling is explicit.  A cursor reaches `end` at the end of
one raw-event page; callers choose the next page id from the page index or
time bucket metadata and validate that page separately.  Side-page access is
also explicit through `index_side_ref_open`, so optional payloads cannot
silently pull arbitrary pages into the cache while scanning hot columns.

## Host-shim GC pressure

The parser and host shim must stream text with
`TextDecoder({ stream: true })`.  The shim should reuse `Uint8Array` views
across the host/WAT boundary instead of allocating a fresh view per chunk.

The ring buffer is the ownership boundary for incoming JSON bytes.  Host
code writes into vacant ring spans, parser code advances the consumed cursor,
and neither side allocates per-token JS objects during ingest.
