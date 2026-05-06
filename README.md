# tracy

[![ci](https://github.com/rhencke/tracy/actions/workflows/ci.yml/badge.svg)](https://github.com/rhencke/tracy/actions/workflows/ci.yml)

A trace viewer.  Mobile-first.  Material 3 throughout.  Client-side
only — your traces never leave your device.  Handles 10 GB+ traces
without choking.

Hand-rolled in WebAssembly Text format.  No frameworks; the JS
bootstrap is ≤50 lines and exists only to fetch the wasm and
mediate the browser API surface.  The streaming JSON parser, the
columnar index, the time-bucket pyramid, the gesture state machine,
the HCT colour math behind every Material 3 surface — all `.wat`.

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
| Implementation | Pure WAT.  ≤50 LOC JS bootstrap + thin host shim. |
| Build | `wat2wasm` (wabt) + `esbuild` for the bootstrap bundle.  Driven by GitHub Actions. |
| Tests | `watwat` — WAT-native test framework, TAP output. |

## Why this way

- **No framework runtime tax.**  No virtual DOM, no GC pauses
  during pan, no bundle bloat.  The whole app can be measured in
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

# install locked JS build tools
npm ci

# build
bash tools/build.sh

# produced app shell
ls dist/index.html dist/bootstrap.bundle.js dist/wasm/app.wasm

# run watwat tests
node tools/watwat.js dist/wasm/*.test.wasm dist/wasm/std/*.test.wasm

# serve dist/ locally
python3 -m http.server -d dist 8000
```

The hosted scaffold is <https://rhencke.github.io/tracy/>.  At this
stage it is intentionally only a blank full-screen canvas loaded from
the placeholder wasm module.

`watwat` provides behavioral coverage for hand-written WAT modules in
CI.  Tracy does not currently report WAT/WASM line or branch coverage;
that needs a separate tooling evaluation once there is a practical path
for this stack.

## Contributing

This is a personal project, but issues and PRs are welcome.  The
roadmap is the three epics linked above.

## License

See [LICENSE](LICENSE).
