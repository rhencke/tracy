# tracy

[![ci](https://github.com/rhencke/tracy/actions/workflows/ci.yml/badge.svg)](https://github.com/rhencke/tracy/actions/workflows/ci.yml)

A trace viewer.  Mobile-first.  Material 3 throughout.  Client-side
only — your traces never leave your device.  Handles 10 GB+ traces
without choking.

Hand-rolled in WebAssembly Text format.  No app framework runtime;
the core trace machinery stays in `.wat`.  JavaScript is still part
of the project where the browser requires it: the ≤50-line bootstrap,
the host/browser boundary, build and ABI tooling, browser-boundary
checks, and the generic `watwat` wasm test runner.  The streaming JSON
parser, the columnar index, index page codec, cache and eviction policy,
the time-bucket pyramid, the gesture state machine, and the HCT colour
math behind every Material 3 surface are all WAT-owned.

## Status

Pre-v0.1.  Active work: the **[tracy v0.1 epic — proof of
concept](https://github.com/rhencke/tracy/issues/1)**.  Next:
[v0.5 — functional viewer](https://github.com/rhencke/tracy/issues/21);
then [v1.0 — release](https://github.com/rhencke/tracy/issues/35).

## Locked design decisions

| | |
|---|---|
| Trace size target | 10 GB+ (server-recording scale) |
| Input format (v0.1) | Chrome JSON Trace Event Format |
| Design language | Material 3 (everywhere) |
| Hosting | Client-side only.  GitHub Pages at <https://rhencke.github.io/tracy/>. |
| Implementation | Core app logic in WAT.  JavaScript is used for the bootstrap, host/browser boundary, build tooling, and browser-boundary checks. |
| Build | `make` drives the artifact DAG: `wat2wasm` (wabt), generated ABI/test artifacts, copied unminified ESM files, coverage wasm, and the deployable `dist/` tree.  Driven by GitHub Actions. |
| Tests | `watwat` — agnostic wasm test runner for WAT modules, TAP output, plus Node/browser-boundary checks where the host surface needs JavaScript. |

## Why this way

- **No framework runtime tax.**  No virtual DOM, no GC pauses
  during pan, no packaging bloat.  The whole app can be measured in
  KB before compression.
- **Memory you control.**  Linear memory laid out region-by-region
  in [`MEMORY.md`](MEMORY.md).  No per-allocation `malloc`/`free`
  in tracy: append-only typed columns for trace data, slab pools
  for fixed-size records, bump arenas reset per-trace, per-frame
  scratch reset every `tracy_tick`.
- **Streaming all the way.**  The JSON parser reads from a 4 MB
  ring buffer; the columnar index never holds the whole trace in
  memory.  10 GB traces work.
- **Privacy.**  No server.  The trace stays on your device.
  Sharing happens via deep-linkable URL fragments — the recipient
  must already have the same trace file (matched by content hash).

## Build + run

The CI workflow builds `dist/` on every PR and deploys that artifact
to GitHub Pages on every merge to `main`.  Local dev:

```sh
# install wabt (once)
brew install wabt   # or: apt install wabt

# install locked JS build and test tooling
npm ci

# build
make dist

# or opt into parallelism
make -j4 dist

# produced app shell
ls dist/index.html dist/bootstrap.mjs dist/host/runtime.mjs dist/wasm/app.wasm

# run the local test gate
make test

# run the coverage gate
make coverage

# serve dist/ locally
python3 -m http.server -d dist 8000
```

## Browser smoke checks

Build `dist/` with `make dist` before running the browser smoke checks.
The smoke fixture uses the same host imports as the app and is meant for a
manual run in a JSPI-capable browser.

1. Serve the repository root after building:

   ```sh
   python3 -m http.server 8000
   ```

2. Open `http://localhost:8000/smoke/host-shim.html`.  The page imports
   `shim.js`, loads `dist/wasm/host_smoke.wasm`, and calls `tracy_main()` to
   install resize and pointer listeners.  Press **Canvas size** to call
   `canvas_get_size()` through wasm; the result packs width in the low 32 bits
   and height in the high 32 bits.

3. Tap or drag on the canvas, then press **Canvas size** again.  The displayed
   pointer record count should increase.  The same value is visible in
   DevTools from the documented scratch ring:

   ```js
   const {
     HOST_POINTER_RECORDS_OFFSET,
     HOST_POINTER_RING_COUNT_OFFSET,
   } = await import("./shim.js");
   const memory = await import("./host-shim.js").then((module) => module.memory);
   const view = new DataView(memory.buffer);
   view.getUint32(HOST_POINTER_RING_COUNT_OFFSET, true); // unread pointer record count
   view.getUint8(HOST_POINTER_RECORDS_OFFSET);           // first record kind
   ```

4. Press **File round trip** and choose a small trace or JSON file.  A
   non-negative byte count means the file picker resolved, the file was copied
   into OPFS, and the first chunk was copied back into linear memory at
   `0x800`.

The hosted scaffold is <https://rhencke.github.io/tracy/>.  At this
stage it is intentionally only a blank full-screen canvas loaded from
the placeholder wasm module.

`watwat` provides behavioral coverage for hand-written WAT modules in
CI as a generic wasm test runner.  Browser-only boundaries such as OPFS,
file handles, JSPI, bootstrap wiring, and generated host ABI checks use
JavaScript tooling because those surfaces are JavaScript/browser APIs.
Tracy does not currently report WAT/WASM line or branch coverage; that
needs a separate tooling evaluation once there is a practical path for
this stack.

## Contributing

This is a personal project, but issues and PRs are welcome.  The
roadmap is the three epics linked above.

## License

See [LICENSE](LICENSE).
