#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  createFakeWorkerClass,
  createRuntimeAppHarness,
  flushRuntimeMicrotasks,
  importRepoModule,
  installRuntimeBrowserGlobals,
} = require("./browser-harness.js");

let OPFS_PAGE_SIZE;
let INDEX_DECODE_HINT_COMPACT_SLICES;
let INDEX_DECODE_HINT_TRACK_ID_SHIFT;
let INDEX_PAGE_HEADER_BUCKET_START_OFFSET;
let INDEX_PAGE_HEADER_BUCKET_END_OFFSET;
let INDEX_PAGE_HEADER_RECORD_COUNT_OFFSET;
let INDEX_PAGE_HEADER_DECODE_HINTS_OFFSET;
let INDEX_QUERY_RESULT_LAYOUT;
let TRACE_RENDERER_CANVAS_OPS;
let TRACE_RENDERER_INCOMPLETE_RANGE_LAYOUT;
let TEST_TRACE_RENDER_COMMAND;
let TEST_TRACE_RENDER_ROW_BYTES;
let TEST_TRACE_RENDER_RANGE_BYTES;

async function loadGeneratedIndexFormatSpec() {
  const { INDEX_DECODE_HINTS, INDEX_FORMAT, INDEX_PAGE_HEADER_OFFSETS } =
    await importRepoModule("host/index-format-spec.mjs");

  OPFS_PAGE_SIZE = INDEX_FORMAT.OPFS_PAGE_SIZE;
  INDEX_DECODE_HINT_COMPACT_SLICES = INDEX_DECODE_HINTS.COMPACT_SLICES;
  INDEX_DECODE_HINT_TRACK_ID_SHIFT = INDEX_DECODE_HINTS.TRACK_ID_SHIFT;
  INDEX_PAGE_HEADER_BUCKET_START_OFFSET = INDEX_PAGE_HEADER_OFFSETS.BUCKET_START;
  INDEX_PAGE_HEADER_BUCKET_END_OFFSET = INDEX_PAGE_HEADER_OFFSETS.BUCKET_END;
  INDEX_PAGE_HEADER_RECORD_COUNT_OFFSET = INDEX_PAGE_HEADER_OFFSETS.RECORD_COUNT;
  INDEX_PAGE_HEADER_DECODE_HINTS_OFFSET = INDEX_PAGE_HEADER_OFFSETS.DECODE_HINTS;
}

async function loadGeneratedTraceRendererSpec() {
  ({
    INDEX_QUERY_RESULT_LAYOUT,
    TRACE_RENDERER_CANVAS_OPS,
    TRACE_RENDERER_INCOMPLETE_RANGE_LAYOUT,
  } = await importRepoModule("host/trace-renderer-spec.mjs"));
  TEST_TRACE_RENDER_COMMAND = Object.freeze({
    BYTES: TRACE_RENDERER_CANVAS_OPS.DRAW_COMMAND_BYTES,
    CLEAR_RECT: TRACE_RENDERER_CANVAS_OPS.DRAW_CLEAR_RECT_TAG,
    END: TRACE_RENDERER_CANVAS_OPS.END_TAG,
    FILL_RECT: TRACE_RENDERER_CANVAS_OPS.DRAW_FILL_RECT_TAG,
    HATCH_RECT: TRACE_RENDERER_CANVAS_OPS.DRAW_HATCH_RECT_TAG,
    INCOMPLETE_FILL: TRACE_RENDERER_CANVAS_OPS.DRAW_STYLE_ROLE_INCOMPLETE_FILL,
    INCOMPLETE_QUERY_RANGE: TRACE_RENDERER_CANVAS_OPS.INCOMPLETE_QUERY_RANGE_TAG,
    INCOMPLETE_STRIPE: TRACE_RENDERER_CANVAS_OPS.DRAW_STYLE_ROLE_INCOMPLETE_STRIPE,
    PARTIAL_HATCH: TRACE_RENDERER_CANVAS_OPS.DRAW_STYLE_ROLE_PARTIAL_HATCH,
    PARTIAL_SLICE: TRACE_RENDERER_CANVAS_OPS.DRAW_STYLE_ROLE_PARTIAL_SLICE,
    QUERY_RANGE: TRACE_RENDERER_CANVAS_OPS.QUERY_RANGE_TAG,
    RGB_STYLE: TRACE_RENDERER_CANVAS_OPS.DRAW_STYLE_RGB_KIND,
    ROLE_BACKGROUND: TRACE_RENDERER_CANVAS_OPS.DRAW_STYLE_ROLE_BACKGROUND,
    ROLE_DEFAULT_SLICE: TRACE_RENDERER_CANVAS_OPS.DRAW_STYLE_ROLE_DEFAULT_SLICE,
    ROLE_STYLE: TRACE_RENDERER_CANVAS_OPS.DRAW_STYLE_ROLE_KIND,
    UNKNOWN_FILL: TRACE_RENDERER_CANVAS_OPS.DRAW_STYLE_ROLE_UNKNOWN_FILL,
    UNKNOWN_STRIPE: TRACE_RENDERER_CANVAS_OPS.DRAW_STYLE_ROLE_UNKNOWN_STRIPE,
  });
  TEST_TRACE_RENDER_ROW_BYTES = INDEX_QUERY_RESULT_LAYOUT.BYTES;
  TEST_TRACE_RENDER_RANGE_BYTES = TRACE_RENDERER_INCOMPLETE_RANGE_LAYOUT.BYTES;
}

const FakeWorker = createFakeWorkerClass();

function readTraceRenderRow(memory, ptr, index) {
  const view = new DataView(memory.buffer);
  const base = ptr + index * TEST_TRACE_RENDER_ROW_BYTES;

  return {
    color: view.getUint32(base + INDEX_QUERY_RESULT_LAYOUT.COLOR, true),
    depth: view.getUint32(base + INDEX_QUERY_RESULT_LAYOUT.DEPTH, true),
    dur: view.getUint32(base + INDEX_QUERY_RESULT_LAYOUT.DUR, true),
    partial: view.getUint32(base + INDEX_QUERY_RESULT_LAYOUT.PARTIAL, true) !== 0,
    start: view.getUint32(base + INDEX_QUERY_RESULT_LAYOUT.START, true),
  };
}

function makeTraceRenderPlannerExports(observed = {}) {
  const state = {
    commandOverflow: 0,
    ops: [],
    viewportEnd: 0,
    viewportStart: 0,
  };

  function sliceX(sliceStart, viewportStart, viewportSpan, canvasWidth) {
    if (viewportSpan === 0) {
      return 0;
    }

    const x = Math.trunc(((sliceStart - viewportStart) * canvasWidth) / viewportSpan);

    if (x < 0) {
      return 0;
    }
    if (x > canvasWidth) {
      return canvasWidth;
    }
    return x;
  }

  function rangeX(rangeStart, rangeEnd, viewportStart, viewportSpan, canvasWidth) {
    const viewportEnd = viewportStart + viewportSpan;
    const clippedStart = Math.min(viewportEnd, Math.max(viewportStart, rangeStart));

    return sliceX(clippedStart, viewportStart, viewportSpan, canvasWidth);
  }

  function rangeWidth(rangeStart, rangeEnd, viewportStart, viewportSpan, canvasWidth) {
    const viewportEnd = viewportStart + viewportSpan;
    const clippedStart = Math.max(viewportStart, rangeStart);
    const clippedEnd = Math.min(viewportEnd, rangeEnd);

    if (clippedEnd <= clippedStart) {
      return 0;
    }

    const x = sliceX(clippedStart, viewportStart, viewportSpan, canvasWidth);
    const endX = sliceX(clippedEnd, viewportStart, viewportSpan, canvasWidth);
    const width = endX - x;

    return width <= 0 ? 1 : width;
  }

  function emitCommand(view, commandPtr, commandCap, tag, styleKind, styleValue, x, y, width, height, x2, y2) {
    if (state.commandCount >= commandCap) {
      state.commandOverflow = 1;
      return;
    }

    const base = commandPtr + state.commandCount * TEST_TRACE_RENDER_COMMAND.BYTES;

    view.setUint32(base + TRACE_RENDERER_CANVAS_OPS.DRAW_COMMAND_TAG_OFFSET, tag, true);
    view.setUint32(
      base + TRACE_RENDERER_CANVAS_OPS.DRAW_COMMAND_STYLE_KIND_OFFSET,
      styleKind,
      true,
    );
    view.setUint32(
      base + TRACE_RENDERER_CANVAS_OPS.DRAW_COMMAND_STYLE_VALUE_OFFSET,
      styleValue,
      true,
    );
    view.setInt32(base + TRACE_RENDERER_CANVAS_OPS.DRAW_COMMAND_X_OFFSET, x, true);
    view.setInt32(base + TRACE_RENDERER_CANVAS_OPS.DRAW_COMMAND_Y_OFFSET, y, true);
    view.setInt32(base + TRACE_RENDERER_CANVAS_OPS.DRAW_COMMAND_WIDTH_OFFSET, width, true);
    view.setInt32(base + TRACE_RENDERER_CANVAS_OPS.DRAW_COMMAND_HEIGHT_OFFSET, height, true);
    view.setInt32(base + TRACE_RENDERER_CANVAS_OPS.DRAW_COMMAND_X2_OFFSET, x2, true);
    view.setInt32(base + TRACE_RENDERER_CANVAS_OPS.DRAW_COMMAND_Y2_OFFSET, y2, true);
    state.commandCount += 1;
  }

  function emitFillRect(view, commandPtr, commandCap, styleKind, styleValue, x, y, width, height) {
    if (width <= 0 || height <= 0) {
      return;
    }

    emitCommand(
      view,
      commandPtr,
      commandCap,
      TEST_TRACE_RENDER_COMMAND.FILL_RECT,
      styleKind,
      styleValue,
      x,
      y,
      width,
      height,
      0,
      0,
    );
  }

  function emitHatches(view, commandPtr, commandCap, x, y, width, height, spacing, styleValue) {
    emitCommand(
      view,
      commandPtr,
      commandCap,
      TEST_TRACE_RENDER_COMMAND.HATCH_RECT,
      TEST_TRACE_RENDER_COMMAND.ROLE_STYLE,
      styleValue,
      x,
      y,
      width,
      height,
      Math.max(1, spacing),
      0,
    );
  }

  return {
    trace_render_append_query_rows(sourcePtr, sourceCount, destPtr, destCount, destCap) {
      if (observed.memory === undefined) {
        return 0;
      }

      const bytes = new Uint8Array(observed.memory.buffer);
      let copied = 0;
      while (copied < sourceCount && destCount + copied < destCap) {
        const source = sourcePtr + copied * TEST_TRACE_RENDER_ROW_BYTES;
        const dest = destPtr + (destCount + copied) * TEST_TRACE_RENDER_ROW_BYTES;

        bytes.copyWithin(dest, source, source + TEST_TRACE_RENDER_ROW_BYTES);
        copied += 1;
      }
      return copied;
    },
    trace_render_commands_begin(
      commandPtr,
      commandCap,
      rowPtr,
      rowCount,
      incompletePtr,
      incompleteCount,
      viewportStart,
      viewportEnd,
      coveredEnd,
      canvasWidth,
      canvasHeight,
      laneHeight,
      laneGap,
      top,
      bandPadding,
      ingestActive,
      partialHatchSpacing,
      unknownAffordanceWidth,
      unknownStripeSpacing,
      incompleteStripeSpacing,
    ) {
      observed.commandsBegin?.({
        canvasHeight,
        canvasWidth,
        commandCap,
        commandPtr,
        coveredEnd,
        incompleteCount,
        incompletePtr,
        rowCount,
        rowPtr,
        viewportEnd,
        viewportStart,
      });
      state.commandOverflow = 0;
      state.commandCount = 0;

      if (observed.memory === undefined) {
        return 0;
      }

      const view = new DataView(observed.memory.buffer);
      const viewportSpan = Math.max(1, viewportEnd - viewportStart);
      let maxDepth = 0;

      for (let i = 0; i < rowCount; i += 1) {
        maxDepth = Math.max(
          maxDepth,
          view.getUint32(
            rowPtr + i * TEST_TRACE_RENDER_ROW_BYTES + INDEX_QUERY_RESULT_LAYOUT.DEPTH,
            true,
          ),
        );
      }

      const bandHeight = Math.min(
        canvasHeight,
        top + (maxDepth + 1) * (laneHeight + laneGap) + bandPadding,
      );

      emitCommand(
        view,
        commandPtr,
        commandCap,
        TEST_TRACE_RENDER_COMMAND.CLEAR_RECT,
        0,
        0,
        0,
        0,
        canvasWidth,
        bandHeight,
        0,
        0,
      );
      emitFillRect(
        view,
        commandPtr,
        commandCap,
        TEST_TRACE_RENDER_COMMAND.ROLE_STYLE,
        TEST_TRACE_RENDER_COMMAND.ROLE_BACKGROUND,
        0,
        0,
        canvasWidth,
        bandHeight,
      );

      for (let i = 0; i < rowCount; i += 1) {
        const base = rowPtr + i * TEST_TRACE_RENDER_ROW_BYTES;
        const rowStart = view.getUint32(base + INDEX_QUERY_RESULT_LAYOUT.START, true);
        const rowDur = Math.max(1, view.getUint32(base + INDEX_QUERY_RESULT_LAYOUT.DUR, true));
        const rowDepth = view.getUint32(base + INDEX_QUERY_RESULT_LAYOUT.DEPTH, true);
        const rowColor = view.getUint32(base + INDEX_QUERY_RESULT_LAYOUT.COLOR, true);
        const rowPartial = view.getUint32(base + INDEX_QUERY_RESULT_LAYOUT.PARTIAL, true) !== 0;
        const sliceEnd = Math.min(viewportEnd, rowStart + rowDur);
        const x = sliceX(rowStart, viewportStart, viewportSpan, canvasWidth);
        const endX = sliceX(sliceEnd, viewportStart, viewportSpan, canvasWidth);
        const width = Math.max(1, endX - x);
        const y = top + rowDepth * (laneHeight + laneGap);

        if (rowPartial && ingestActive !== 0) {
          emitFillRect(
            view,
            commandPtr,
            commandCap,
            TEST_TRACE_RENDER_COMMAND.ROLE_STYLE,
            TEST_TRACE_RENDER_COMMAND.PARTIAL_SLICE,
            x,
            y,
            width,
            laneHeight,
          );
          emitHatches(
            view,
            commandPtr,
            commandCap,
            x,
            y,
            width,
            laneHeight,
            partialHatchSpacing,
            TEST_TRACE_RENDER_COMMAND.PARTIAL_HATCH,
          );
        } else if (rowColor === 0) {
          emitFillRect(
            view,
            commandPtr,
            commandCap,
            TEST_TRACE_RENDER_COMMAND.ROLE_STYLE,
            TEST_TRACE_RENDER_COMMAND.ROLE_DEFAULT_SLICE,
            x,
            y,
            width,
            laneHeight,
          );
        } else {
          emitFillRect(
            view,
            commandPtr,
            commandCap,
            TEST_TRACE_RENDER_COMMAND.RGB_STYLE,
            rowColor,
            x,
            y,
            width,
            laneHeight,
          );
        }
      }

      for (let i = 0; i < incompleteCount; i += 1) {
        const base = incompletePtr + i * TEST_TRACE_RENDER_RANGE_BYTES;
        const start = view.getUint32(base + TRACE_RENDERER_INCOMPLETE_RANGE_LAYOUT.START, true);
        const end = view.getUint32(base + TRACE_RENDERER_INCOMPLETE_RANGE_LAYOUT.END, true);
        const width = rangeWidth(start, end, viewportStart, viewportSpan, canvasWidth);

        if (width <= 0) {
          continue;
        }

        const x = rangeX(start, end, viewportStart, viewportSpan, canvasWidth);

        emitFillRect(
          view,
          commandPtr,
          commandCap,
          TEST_TRACE_RENDER_COMMAND.ROLE_STYLE,
          TEST_TRACE_RENDER_COMMAND.INCOMPLETE_FILL,
          x,
          0,
          width,
          bandHeight,
        );
        emitHatches(
          view,
          commandPtr,
          commandCap,
          x,
          0,
          width,
          bandHeight,
          incompleteStripeSpacing,
          TEST_TRACE_RENDER_COMMAND.INCOMPLETE_STRIPE,
        );
      }

      if (ingestActive !== 0 && coveredEnd <= viewportEnd) {
        const width = Math.max(0, Math.min(canvasWidth, unknownAffordanceWidth));

        if (width > 0) {
          const x = Math.max(0, canvasWidth - width);

          emitFillRect(
            view,
            commandPtr,
            commandCap,
            TEST_TRACE_RENDER_COMMAND.ROLE_STYLE,
            TEST_TRACE_RENDER_COMMAND.UNKNOWN_FILL,
            x,
            0,
            width,
            bandHeight,
          );
          emitHatches(
            view,
            commandPtr,
            commandCap,
            x,
            0,
            width,
            bandHeight,
            unknownStripeSpacing,
            TEST_TRACE_RENDER_COMMAND.UNKNOWN_STRIPE,
          );
        }
      }

      return state.commandCount;
    },
    trace_render_commands_overflow() {
      return state.commandOverflow;
    },
    trace_render_plan_begin(
      viewportStart,
      viewportEnd,
      trackCount,
      queryRangeBudget,
      queryWindow,
    ) {
      observed.planBegin?.({
        queryRangeBudget,
        queryWindow,
        trackCount,
        viewportEnd,
        viewportStart,
      });
      state.viewportStart = viewportStart;
      state.viewportEnd = viewportEnd;
      const rangesPerTrack = Math.max(1, Math.floor(queryRangeBudget / trackCount));
      const tileSpan = Math.max(
        1,
        queryWindow,
        Math.ceil((viewportEnd - viewportStart) / rangesPerTrack),
      );
      const ops = [];
      let queryRangeCount = 0;

      queryLoop:
      for (let trackId = 0; trackId < trackCount; trackId += 1) {
        for (
          let queryStart = viewportStart;
          queryStart < viewportEnd;
          queryStart = Math.min(viewportEnd, queryStart + tileSpan)
        ) {
          if (queryRangeCount >= queryRangeBudget) {
            if (queryStart < viewportEnd) {
              ops.push({
                end: viewportEnd,
                start: Math.max(viewportStart, queryStart),
                tag: TEST_TRACE_RENDER_COMMAND.INCOMPLETE_QUERY_RANGE,
                trackId,
              });
            }
            for (
              let skippedTrackId = trackId + 1;
              skippedTrackId < trackCount;
              skippedTrackId += 1
            ) {
              ops.push({
                end: viewportEnd,
                start: viewportStart,
                tag: TEST_TRACE_RENDER_COMMAND.INCOMPLETE_QUERY_RANGE,
                trackId: skippedTrackId,
              });
            }
            break queryLoop;
          }

          ops.push({
            end: Math.min(viewportEnd, queryStart + tileSpan),
            start: queryStart,
            tag: TEST_TRACE_RENDER_COMMAND.QUERY_RANGE,
            trackId,
          });
          queryRangeCount += 1;
        }
      }

      state.ops = ops;
    },
    trace_render_plan_next() {
      const op = state.ops.shift();

      if (op === undefined) {
        return TEST_TRACE_RENDER_COMMAND.END;
      }

      state.currentOp = op;
      return op.tag;
    },
    trace_render_plan_op_end() {
      return state.currentOp?.end ?? state.viewportEnd;
    },
    trace_render_plan_op_start() {
      return state.currentOp?.start ?? state.viewportStart;
    },
    trace_render_plan_op_track_id() {
      return state.currentOp?.trackId ?? 0;
    },
    trace_render_query_ranges_per_track(queryRangeBudget, trackCount) {
      observed.queryRangesPerTrack?.({ queryRangeBudget, trackCount });
      return Math.max(1, Math.floor(queryRangeBudget / trackCount));
    },
    trace_render_query_tile_span(viewportSpan, queryWindow, rangesPerTrack) {
      observed.queryTileSpan?.({ queryWindow, rangesPerTrack, viewportSpan });
      return Math.max(1, queryWindow, Math.ceil(viewportSpan / rangesPerTrack));
    },
    trace_render_range_x(rangeStart, rangeEnd, viewportStart, viewportSpan, canvasWidth) {
      observed.rangeX?.({
        canvasWidth,
        rangeEnd,
        rangeStart,
        viewportSpan,
        viewportStart,
      });
      const viewportEnd = viewportStart + viewportSpan;
      const start = Math.min(viewportEnd, Math.max(viewportStart, rangeStart));
      return Math.max(0, ((start - viewportStart) / viewportSpan) * canvasWidth);
    },
    trace_render_range_width(rangeStart, rangeEnd, viewportStart, viewportSpan, canvasWidth) {
      observed.rangeWidth?.({
        canvasWidth,
        rangeEnd,
        rangeStart,
        viewportSpan,
        viewportStart,
      });
      const viewportEnd = viewportStart + viewportSpan;
      const start = Math.max(viewportStart, rangeStart);
      const end = Math.min(viewportEnd, rangeEnd);

      if (end <= start) {
        return 0;
      }

      const x = Math.max(0, ((start - viewportStart) / viewportSpan) * canvasWidth);
      const endX = Math.min(canvasWidth, ((end - viewportStart) / viewportSpan) * canvasWidth);
      return Math.max(1, endX - x);
    },
    trace_render_slice_end_x(sliceEnd, viewportStart, viewportSpan, canvasWidth) {
      observed.sliceEndX?.({ canvasWidth, sliceEnd, viewportSpan, viewportStart });
      return Math.min(
        canvasWidth,
        ((sliceEnd - viewportStart) / viewportSpan) * canvasWidth,
      );
    },
    trace_render_slice_x(sliceStart, viewportStart, viewportSpan, canvasWidth) {
      observed.sliceX?.({ canvasWidth, sliceStart, viewportSpan, viewportStart });
      return Math.max(0, ((sliceStart - viewportStart) / viewportSpan) * canvasWidth);
    },
    trace_render_slice_y(depth, top, laneHeight, laneGap) {
      observed.sliceY?.({ depth, laneGap, laneHeight, top });
      return top + depth * (laneHeight + laneGap);
    },
    trace_render_stripe_end(x, width, height) {
      observed.stripeEnd?.({ height, width, x });
      return x + width + height;
    },
    trace_render_stripe_start(x, height) {
      observed.stripeStart?.({ height, x });
      return x - height;
    },
    trace_render_unknown_width(canvasWidth, affordanceWidth) {
      observed.unknownWidth?.({ affordanceWidth, canvasWidth });
      return Math.max(0, Math.min(canvasWidth, affordanceWidth));
    },
    trace_render_unknown_x(canvasWidth, affordanceWidth) {
      observed.unknownX?.({ affordanceWidth, canvasWidth });
      return canvasWidth - Math.max(0, Math.min(canvasWidth, affordanceWidth));
    },
  };
}

function makeAppExports(extra = {}) {
  return {
    ...makeTraceRenderPlannerExports(),
    tracy_main() {},
    tracy_tick() {},
    ...extra,
  };
}

async function checkRuntimeOrchestratesWorker() {
  const workerMessages = [];
  const instantiateCalls = [];
  const performanceEntries = [];
  const ticks = [];
  const indexReaderOpenCalls = [];
  const host = {
    opfs_index_create() {
      return 0;
    },
  };
  const workerStatus = [];
  const performance = {
    mark(name) {
      performanceEntries.push({ kind: "mark", name });
    },
    measure(name, start, end) {
      performanceEntries.push({ kind: "measure", name, start, end });
    },
  };
  const harness = createRuntimeAppHarness({
    host,
    memoryOptions: { initial: 512 },
    runAppOptions: {
      ingest: {
        indexName: "indexes/trace.idx",
        sourceName: "sources/trace.json",
      },
      indexReader: {
        open(indexName) {
          indexReaderOpenCalls.push(indexName);
          return Promise.resolve(true);
        },
      },
      instantiateWasmModuleForThread: async (id, thread, imports) => {
        instantiateCalls.push({
          hostImport: imports.host.opfs_index_create,
          id,
          memory: imports.env.memory,
          thread,
        });
        return {
          exports: makeAppExports({
            tracy_main() {
              ticks.push("main");
            },
            tracy_tick(ts) {
              ticks.push(ts);
            },
          }),
        };
      },
      importProgressiveTraceRenderer: async () => ({
        createProgressiveTraceRenderer() {
          return {
            draw() {},
          };
        },
      }),
      performance,
      worker: {
        Worker: FakeWorker,
        onWorkerStatus(status, message) {
          workerStatus.push({ status, message });
        },
        workerUrl: "worker.js",
      },
    },
  });

  const controller = await harness.boot();
  const { memory } = harness;

  assert.equal(FakeWorker.instances.length, 0);
  assert.ok(
    harness.frames.length >= 1,
    "draw loop should be scheduled before ingest preload",
  );
  await harness.runFrame(0);
  assert.equal(FakeWorker.instances.length, 0);
  assert.ok(
    harness.frames.length >= 2,
    "app-ready follow-up frame should be scheduled before ingest preload",
  );
  await harness.advanceAppReadyFrame();

  assert.equal(FakeWorker.instances.length, 1);
  const worker = FakeWorker.instances[0];
  assert.equal(worker.url, "worker.js");
  assert.deepEqual(worker.options, { type: "module" });
  assert.deepEqual(worker.posted, [{ type: "preload" }]);
  worker.emit("message", { type: "preloaded" });
  await harness.flushRuntimeWork();
  assert.deepEqual(instantiateCalls, [
    { hostImport: host.opfs_index_create, id: "app", memory, thread: "main" },
  ]);
  assert.deepEqual(performanceEntries, [
    { kind: "mark", name: "tracy.core.start" },
    { kind: "mark", name: "tracy.wasm.instantiate.start" },
    { kind: "mark", name: "tracy.wasm.instantiate.end" },
    {
      kind: "measure",
      name: "tracy.wasm.instantiate",
      start: "tracy.wasm.instantiate.start",
      end: "tracy.wasm.instantiate.end",
    },
    { kind: "mark", name: "tracy.main.start" },
    { kind: "mark", name: "tracy.main.end" },
    {
      kind: "measure",
      name: "tracy.main",
      start: "tracy.main.start",
      end: "tracy.main.end",
    },
    { kind: "mark", name: "tracy.core.ready" },
    { kind: "mark", name: "tracy.app.ready" },
    {
      kind: "measure",
      name: "tracy.app.load",
      start: "tracy.bootstrap.start",
      end: "tracy.app.ready",
    },
  ]);
  assert.equal(
    harness.frames.length,
    1,
    "draw loop should continue after ingest preload",
  );
  assert.deepEqual(worker.posted, [
    {
      type: "preload",
    },
    {
      ingestId: 1,
      indexName: "indexes/trace.idx",
      sourceName: "sources/trace.json",
      type: "start",
    },
  ]);
  assert.equal(controller.status().state, "running");

  worker.emit("message", {
    ingestId: 1,
    type: "progress",
    committedPages: 2,
    etaSeconds: null,
    phase: "parse",
    fileOffset: 32,
    indexedEvents: 4,
    parsedEvents: 5,
    throughputBytesPerSecond: 8000,
    totalBytes: 64,
  });
  worker.emit("message", {
    ingestId: 1,
    type: "covered_range",
    valid: true,
    start: 100,
    end: 132,
  });
  worker.emit("message", {
    ingestId: 1,
    type: "complete",
    committedEvents: 7,
  });

  await harness.runFrame(122);
  await harness.runFrame(123);
  await importRepoModule("host/trace-renderer-spec.mjs");
  await harness.flushRuntimeWork();
  assert.deepEqual(performanceEntries.slice(-2), [
    { kind: "mark", name: "tracy.app.ready" },
    {
      kind: "measure",
      name: "tracy.app.load",
      start: "tracy.bootstrap.start",
      end: "tracy.app.ready",
    },
  ]);
  assert.deepEqual(ticks, ["main", 16, 122, 123]);
  assert.equal(controller.status().state, "complete");
  assert.equal(controller.status().progress.fileOffset, 32);
  assert.equal(controller.status().progress.committedPages, 2);
  assert.equal(controller.status().coveredRange.start, 100);
  assert.equal(controller.status().coveredRange.end, 132);
  assert.deepEqual(indexReaderOpenCalls, ["indexes/trace.idx"]);
  assert.equal(controller.status().result.committedEvents, 7);
  assert.equal(workerStatus.at(-1).status.state, "complete");

  const runtime = await importRepoModule("host/runtime.mjs");
  const controllerWithError = runtime.createIngestWorkerController({
    Worker: FakeWorker,
    onWorkerStatus(status, message) {
      workerMessages.push({ status, message });
    },
  });
  assert.equal(controllerWithError.worker, null);
  controllerWithError.start();
  const errorWorker = FakeWorker.instances.at(-1);

  errorWorker.events.get("error")({ message: "worker crashed" });
  assert.equal(controllerWithError.status().state, "error");
  assert.equal(controllerWithError.status().error, "worker crashed");
  assert.equal(workerMessages.at(-1).status.state, "error");
}

async function checkRuntimeStartsIngestFromFileSelection() {
  const abi = await importRepoModule("host/abi.mjs");
  const sourceName = "sources/selected trace.json";
  const callbacks = [];
  const workerStatus = [];
  const selectedFile = { name: "selected trace.json", size: 1234 };
  let opfsCopyStarted = false;
  const host = {
    [abi.HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE]() {
      opfsCopyStarted = true;
      return new Promise(() => {});
    },
    opfs_index_create() {
      return 0;
    },
    setFileSelectedCallback(callback) {
      callbacks.push(callback);
    },
  };
  const harness = createRuntimeAppHarness({
    host,
    memoryOptions: { initial: 512 },
    runAppOptions: {
      indexReader: false,
      importProgressiveTraceRenderer: async () => ({
        createProgressiveTraceRenderer() {
          return { draw() {} };
        },
      }),
      instantiateWasmModuleForThread: async () => ({
        exports: makeAppExports(),
      }),
      worker: {
        Worker: FakeWorker,
        onWorkerStatus(status, message) {
          workerStatus.push({ status, message });
        },
        workerUrl: "worker.js",
      },
    },
  });

  const controller = await harness.boot();

  assert.equal(controller.worker, null);
  await harness.runFrame(0);
  assert.equal(controller.worker, null);
  assert.ok(harness.frames.length >= 2);
  await harness.advanceAppReadyFrame();

  const preloadWorker = controller.worker;
  assert.deepEqual(preloadWorker.posted, [{ type: "preload" }]);
  preloadWorker.emit("message", { type: "preloaded" });
  await harness.flushRuntimeWork();

  assert.equal(callbacks.length, 1);
  assert.equal(controller.worker, preloadWorker);

  callbacks[0]({ file: selectedFile, handle: 9 });
  await harness.flushRuntimeWork();

  const worker = controller.worker;
  assert.equal(
    opfsCopyStarted,
    false,
    "file selection should post worker ingest before any full OPFS copy",
  );
  assert.deepEqual(worker.posted, [
    {
      type: "preload",
    },
    {
      ingestId: 1,
      indexName: "indexes/selected_trace.json.idx",
      sourceFile: selectedFile,
      sourceFileHandle: 9,
      sourceName,
      sourceSize: 1234,
      type: "start",
    },
  ]);
  assert.equal(controller.status().state, "running");
  assert.equal(workerStatus.at(-1).status.state, "running");

  callbacks[0]({ handle: -1 });
  await harness.flushRuntimeWork();
  assert.equal(worker.posted.length, 2, "cancelled picker should not start ingest");
}

async function checkRuntimePreloadsIndexReaderBeforeWorkerPreloadSignal() {
  const preloadCalls = [];
  let resolveIndexPreload;
  const indexPreload = new Promise((resolve) => {
    resolveIndexPreload = resolve;
  });
  const ingestWorker = {
    indexReader: {
      preload() {
        preloadCalls.push("index-reader");
        return indexPreload;
      },
    },
    preload() {
      preloadCalls.push("worker");
      return Promise.resolve(true);
    },
  };
  const harness = createRuntimeAppHarness({
    runAppOptions: {
      ingestWorker,
      instantiateWasmModuleForThread: async () => ({
        exports: makeAppExports(),
      }),
      progressiveTraceRenderer: false,
    },
  });

  await harness.boot();
  await harness.runFrame(0);
  await harness.advanceAppReadyFrame();

  assert.deepEqual(
    preloadCalls,
    ["index-reader"],
    "worker preload signal should wait until the main-thread reader preload has started",
  );

  resolveIndexPreload(true);
  await harness.flushRuntimeWork();

  assert.deepEqual(
    preloadCalls,
    ["index-reader", "worker"],
    "worker preload signal should mean the reader and worker ingest dependencies are warm",
  );
}

async function checkRuntimeSkipsLateWorkerPreloadAfterFileSelectionStart() {
  FakeWorker.reset();

  const abi = await importRepoModule("host/abi.mjs");
  const runtimeMemoryPages = 1;
  const selectedFileSizeBytes = 1234;
  const selectedFile = Object.freeze({
    name: "pending preload trace.json",
    size: selectedFileSizeBytes,
  });
  const selectedFileHandle = 9;
  const expectedSourceName = `sources/${selectedFile.name}`;
  const expectedIndexName = "indexes/pending_preload_trace.json.idx";
  const workerUrl = "worker.js";
  const preloadCalls = [];
  const callbacks = [];
  let resolveIndexPreload;
  const indexPreload = new Promise((resolve) => {
    resolveIndexPreload = resolve;
  });
  const host = {
    [abi.HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE]() {
      throw new Error("file object selections should not need an OPFS source copy");
    },
    opfs_index_create() {
      return 0;
    },
    setFileSelectedCallback(callback) {
      callbacks.push(callback);
    },
  };
  const harness = createRuntimeAppHarness({
    host,
    memoryOptions: { initial: runtimeMemoryPages },
    runAppOptions: {
      indexReader: {
        preload() {
          preloadCalls.push("index-reader");
          return indexPreload;
        },
      },
      instantiateWasmModuleForThread: async () => ({
        exports: makeAppExports(),
      }),
      progressiveTraceRenderer: false,
      worker: {
        Worker: FakeWorker,
        workerUrl,
      },
    },
  });

  const controller = await harness.boot();
  await harness.runFrame(0);
  await harness.advanceAppReadyFrame();

  assert.deepEqual(
    preloadCalls,
    ["index-reader"],
    "reader preload should be held before the worker preload can run",
  );
  assert.equal(controller.worker, null);
  assert.equal(callbacks.length, 1);

  callbacks[0]({ file: selectedFile, handle: selectedFileHandle });
  await harness.flushRuntimeWork();

  const worker = controller.worker;
  assert.deepEqual(worker.posted, [
    {
      ingestId: 1,
      indexName: expectedIndexName,
      sourceFile: selectedFile,
      sourceFileHandle: selectedFileHandle,
      sourceName: expectedSourceName,
      sourceSize: selectedFile.size,
      type: "start",
    },
  ]);

  resolveIndexPreload(true);
  await harness.flushRuntimeWork();

  assert.deepEqual(
    worker.posted.map((message) => message.type),
    ["start"],
    "late worker preload should not post after selected-file ingest has started",
  );
}

async function checkRuntimeIgnoresStaleIngestWorkerMessages() {
  installRuntimeBrowserGlobals();

  const runtime = await importRepoModule("host/runtime.mjs");
  const indexReaderOpenCalls = [];
  const workerStatus = [];
  const controller = runtime.createIngestWorkerController({
    Worker: FakeWorker,
    indexReader: {
      open(indexName) {
        indexReaderOpenCalls.push(indexName);
        return Promise.resolve(true);
      },
    },
    onWorkerStatus(status, message) {
      workerStatus.push({ message, status });
    },
    workerUrl: "worker.js",
  });

  assert.equal(
    controller.start({
      indexName: "indexes/first.idx",
      sourceName: "sources/first.json",
    }),
    true,
  );
  const firstWorker = controller.worker;

  assert.deepEqual(firstWorker.posted, [
    {
      ingestId: 1,
      indexName: "indexes/first.idx",
      sourceName: "sources/first.json",
      type: "start",
    },
  ]);

  assert.equal(
    controller.start({
      indexName: "indexes/second.idx",
      sourceName: "sources/second.json",
    }),
    true,
  );
  const secondWorker = controller.worker;

  assert.notEqual(secondWorker, firstWorker);
  assert.equal(firstWorker.terminated, true);
  assert.deepEqual(secondWorker.posted, [
    {
      ingestId: 2,
      indexName: "indexes/second.idx",
      sourceName: "sources/second.json",
      type: "start",
    },
  ]);

  firstWorker.emit("message", {
    committedPages: 99,
    fileOffset: 999,
    ingestId: 1,
    type: "progress",
  });
  firstWorker.emit("message", {
    end: 999,
    ingestId: 1,
    start: 900,
    type: "covered_range",
    valid: true,
  });
  firstWorker.emit("message", {
    committedEvents: 999,
    ingestId: 1,
    type: "complete",
  });

  assert.equal(controller.status().state, "running");
  assert.equal(controller.status().progress, null);
  assert.equal(controller.status().coveredRange, null);
  assert.equal(controller.status().result, null);
  assert.deepEqual(indexReaderOpenCalls, []);

  firstWorker.events.get("error")({ message: "old worker crashed" });
  assert.equal(controller.status().state, "running");
  assert.equal(controller.status().error, null);

  secondWorker.emit("message", {
    committedPages: 2,
    fileOffset: 64,
    ingestId: 2,
    type: "progress",
  });
  secondWorker.emit("message", {
    end: 132,
    ingestId: 2,
    start: 100,
    type: "covered_range",
    valid: true,
  });
  secondWorker.emit("message", {
    committedEvents: 7,
    ingestId: 2,
    type: "complete",
  });

  assert.equal(controller.status().state, "complete");
  assert.equal(controller.status().progress.fileOffset, 64);
  assert.equal(controller.status().coveredRange.end, 132);
  assert.equal(controller.status().result.committedEvents, 7);
  assert.deepEqual(indexReaderOpenCalls, ["indexes/second.idx"]);
  assert.equal(workerStatus.at(-1).message.ingestId, 2);

  secondWorker.emit("message", {
    committedPages: 99,
    fileOffset: 999,
    ingestId: 2,
    type: "progress",
  });
  secondWorker.emit("message", {
    end: 999,
    ingestId: 2,
    start: 900,
    type: "covered_range",
    valid: true,
  });
  assert.equal(
    controller.status().state,
    "complete",
    "late same-ingest messages should not revive a completed ingest",
  );
  assert.equal(controller.status().progress.fileOffset, 64);
  assert.equal(controller.status().coveredRange.end, 132);
  assert.deepEqual(indexReaderOpenCalls, ["indexes/second.idx"]);

  assert.equal(controller.preload() instanceof Promise, true);
  assert.equal(secondWorker.posted.at(-1).type, "preload");
  secondWorker.emit("message", { type: "preloaded" });
  assert.equal(await controller.preload(), true);

  const errorController = runtime.createIngestWorkerController({
    Worker: FakeWorker,
    indexReader: {
      open(indexName) {
        indexReaderOpenCalls.push(indexName);
        return Promise.resolve(true);
      },
    },
    workerUrl: "worker.js",
  });
  assert.equal(
    errorController.start({
      indexName: "indexes/error.idx",
      sourceName: "sources/error.json",
    }),
    true,
  );
  const errorWorker = errorController.worker;
  errorWorker.emit("message", {
    ingestId: 1,
    message: "ingest failed",
    type: "error",
  });
  errorWorker.emit("message", {
    committedPages: 42,
    fileOffset: 4242,
    ingestId: 1,
    type: "progress",
  });
  errorWorker.emit("message", {
    end: 4242,
    ingestId: 1,
    start: 4200,
    type: "covered_range",
    valid: true,
  });
  assert.equal(errorController.status().state, "error");
  assert.equal(errorController.status().error, "ingest failed");
  assert.equal(errorController.status().progress, null);
  assert.equal(errorController.status().coveredRange, null);
  assert.equal(errorController.preload() instanceof Promise, true);
  assert.equal(errorWorker.posted.at(-1).type, "preload");
}

async function checkFileSelectionSetupErrorsReportStatus() {
  installRuntimeBrowserGlobals();

  const runtime = await importRepoModule("host/runtime.mjs");
  const abi = await importRepoModule("host/abi.mjs");
  const memory = new WebAssembly.Memory({ initial: 512 });
  let callback;
  const workerStatus = [];
  const host = {
    [abi.HOST_IMPORT_NAME.OPFS_SOURCE_FROM_FILE]() {
      return Promise.reject(new Error("OPFS write failed"));
    },
    opfs_index_create() {
      return 0;
    },
    setFileSelectedCallback(nextCallback) {
      callback = nextCallback;
    },
  };

  const controller = runtime.runApp(memory, host, {
    indexReader: false,
    instantiateWasmModuleForThread: async () => ({
      exports: makeAppExports(),
    }),
    worker: {
      Worker: FakeWorker,
      onWorkerStatus(status, message) {
        workerStatus.push({ status, message });
      },
      workerUrl: "worker.js",
    },
  });

  await Promise.resolve();
  await Promise.resolve();

  callback({ handle: 10 });
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(controller.status().state, "error");
  assert.equal(controller.status().error, "OPFS write failed");
  assert.equal(workerStatus.at(-1).status.state, "error");
}

async function checkMainThreadIndexReaderQueriesCommittedPages() {
  const runtime = await importRepoModule("host/runtime.mjs");
  const abi = await importRepoModule("host/abi.mjs");
  const memory = new WebAssembly.Memory({ initial: 512 });
  const view = new DataView(memory.buffer);
  const pagePtr = 32768;
  const pageCatalog = [];
  const pageRecords = [
    {
      bucketEnd: 140,
      bucketStart: 100,
      recordCount: 3,
      trackId: 4,
    },
    {
      bucketEnd: 180,
      bucketStart: 140,
      recordCount: 2,
      trackId: 4,
    },
    {
      bucketEnd: 220,
      bucketStart: 180,
      recordCount: 4,
      trackId: 4,
    },
  ];
  let visiblePageCount = 1;
  const openedNames = [];
  const calls = [];
  const readerInitIds = [];
  const readPages = [];
  let lastQueryRangeCount = 0;
  const host = {
    [abi.HOST_IMPORT_NAME.OPFS_INDEX_OPEN](namePtr, nameLen) {
      openedNames.push(
        new TextDecoder().decode(new Uint8Array(memory.buffer, namePtr, nameLen)),
      );
      return 70;
    },
    [abi.HOST_IMPORT_NAME.OPFS_INDEX_SIZE](indexId) {
      assert.equal(indexId, 70);
      return BigInt(visiblePageCount * OPFS_PAGE_SIZE);
    },
  };
  const reader = runtime.createMainThreadIndexReaderController(memory, host, {
    instantiateWasmModuleForThread: async (id, thread, imports, options) => {
      assert.equal(thread, "main");
      calls.push({
        id,
        hasMemory: imports.env.memory === memory,
        baseUrl: options.baseUrl,
      });
      return {
        exports: {
          index_query_range(trackId, tsMin, tsMax, outPtr, maxRows) {
            assert.equal(trackId, 4);
            assert.equal(tsMin, 100);
            assert.equal(outPtr, 4096);
            assert.equal(maxRows, 1024);
            if (tsMax === 140) {
              assert.deepEqual(pageCatalog, [
                {
                  bucketEnd: 140,
                  bucketStart: 100,
                  pageId: 0,
                  recordCount: 3,
                  trackId: 4,
                },
              ]);
              lastQueryRangeCount = 3;
              return lastQueryRangeCount;
            }

            if (tsMax === 180) {
              assert.deepEqual(pageCatalog, [
                {
                  bucketEnd: 140,
                  bucketStart: 100,
                  pageId: 0,
                  recordCount: 3,
                  trackId: 4,
                },
                {
                  bucketEnd: 180,
                  bucketStart: 140,
                  pageId: 1,
                  recordCount: 2,
                  trackId: 4,
                },
              ]);
              lastQueryRangeCount = 5;
              return lastQueryRangeCount;
            }

            assert.equal(tsMax, 220);
            assert.deepEqual(pageCatalog, [
              {
                bucketEnd: 140,
                bucketStart: 100,
                pageId: 0,
                recordCount: 3,
                trackId: 4,
              },
              {
                bucketEnd: 180,
                bucketStart: 140,
                pageId: 1,
                recordCount: 2,
                trackId: 4,
              },
              {
                bucketEnd: 220,
                bucketStart: 180,
                pageId: 2,
                recordCount: 4,
                trackId: 4,
              },
            ]);
            lastQueryRangeCount = 9;
            return lastQueryRangeCount;
          },
          index_query_range_capped() {
            return 0;
          },
          index_query_range_matched_rows() {
            return lastQueryRangeCount;
          },
          index_query_range_written_rows() {
            return lastQueryRangeCount;
          },
          INDEX_STATUS_OK: 0,
          INDEX_WRITER_STATUS_CATALOG_FULL: 23,
          index_page_catalog_add_page(ptr, len, pageId) {
            assert.equal(ptr, pagePtr);
            assert.equal(len, OPFS_PAGE_SIZE);
            const record = pageRecords[pageId];
            pageCatalog.push({
              bucketEnd: record.bucketEnd,
              bucketStart: record.bucketStart,
              pageId,
              recordCount: record.recordCount,
              trackId: record.trackId,
            });
            return 0;
          },
          index_page_catalog_reset() {
            pageCatalog.length = 0;
          },
          index_reader_configure_cache(slotCount) {
            assert.equal(slotCount, 2);
            return slotCount;
          },
          index_reader_covered_range_end() {
            return 100 + visiblePageCount * 40;
          },
          index_reader_covered_range_start() {
            return 100;
          },
          index_reader_covered_range_valid() {
            return 1;
          },
          index_reader_init(indexId) {
            assert.equal(indexId, 70);
            readerInitIds.push(indexId);
          },
          read_page(level, pageId) {
            assert.equal(level, 0);
            assert.ok(pageId < visiblePageCount);
            readPages.push(pageId);
            const record = pageRecords[pageId];
            view.setUint32(
              pagePtr + INDEX_PAGE_HEADER_BUCKET_START_OFFSET,
              record.bucketStart,
              true,
            );
            view.setUint32(
              pagePtr + INDEX_PAGE_HEADER_BUCKET_END_OFFSET,
              record.bucketEnd,
              true,
            );
            view.setUint32(
              pagePtr + INDEX_PAGE_HEADER_RECORD_COUNT_OFFSET,
              record.recordCount,
              true,
            );
            view.setUint32(
              pagePtr + INDEX_PAGE_HEADER_DECODE_HINTS_OFFSET,
              INDEX_DECODE_HINT_COMPACT_SLICES |
                (record.trackId << INDEX_DECODE_HINT_TRACK_ID_SHIFT),
              true,
            );
            return pagePtr;
          },
        },
      };
    },
    readerCacheSlots: 2,
  });

  assert.deepEqual(reader.status(), {
    catalogFull: false,
    error: null,
    indexId: null,
    indexName: null,
    state: "idle",
  });
  assert.deepEqual(reader.coveredRange(), { valid: false, start: 0, end: 0 });

  await reader.open("indexes/trace.idx");

  assert.deepEqual(openedNames, ["indexes/trace.idx"]);
  assert.deepEqual(calls, [
    { id: "index", hasMemory: true, baseUrl: "wasm/" },
  ]);
  assert.deepEqual(reader.status(), {
    catalogFull: false,
    error: null,
    indexId: 70,
    indexName: "indexes/trace.idx",
    state: "ready",
  });
  assert.deepEqual(readerInitIds, [70, 70]);
  assert.deepEqual(readPages, [0]);
  assert.deepEqual(reader.coveredRange(), { valid: true, start: 100, end: 140 });
  assert.equal((await reader.queryRange(4, 100, 140, 4096)).count, 3);
  assert.deepEqual(readPages, [0], "unchanged catalog should not rebuild per query");

  visiblePageCount = 2;
  await reader.open("indexes/trace.idx");
  assert.deepEqual(reader.coveredRange(), { valid: true, start: 100, end: 180 });
  assert.equal((await reader.queryRange(4, 100, 180, 4096)).count, 5);
  assert.deepEqual(
    readPages,
    [0, 1],
    "query after worker append should refresh only newly published pages",
  );
  assert.deepEqual(readerInitIds, [70, 70, 70]);

  visiblePageCount = 3;
  await reader.open("indexes/trace.idx");
  assert.deepEqual(reader.coveredRange(), { valid: true, start: 100, end: 220 });
  assert.equal((await reader.queryRange(4, 100, 220, 4096)).count, 9);
  assert.deepEqual(
    readPages,
    [0, 1, 2],
    "later render-time queries should not rescan page 0 through the current page count",
  );
  assert.deepEqual(readerInitIds, [70, 70, 70, 70]);

  await reader.open("indexes/trace.idx");
  assert.deepEqual(openedNames, ["indexes/trace.idx"]);
}

async function checkMainThreadIndexReaderRequiresCappedQueryMetadataExports() {
  const runtime = await importRepoModule("host/runtime.mjs");
  const abi = await importRepoModule("host/abi.mjs");
  const memory = new WebAssembly.Memory({ initial: 512 });
  let opened = false;
  const host = {
    [abi.HOST_IMPORT_NAME.OPFS_INDEX_OPEN]() {
      opened = true;
      return 70;
    },
  };
  const reader = runtime.createMainThreadIndexReaderController(memory, host, {
    instantiateWasmModuleForThread: async () => ({
      exports: {
        index_query_range() {
          return 0;
        },
        index_query_range_matched_rows() {
          return 0;
        },
        index_query_range_written_rows() {
          return 0;
        },
      },
    }),
  });

  await assert.rejects(
    reader.open("indexes/trace.idx"),
    /index reader module missing required export index_query_range_capped/,
  );
  assert.equal(opened, false);
  assert.deepEqual(reader.status(), {
    catalogFull: false,
    error: "index reader module missing required export index_query_range_capped",
    indexId: null,
    indexName: "indexes/trace.idx",
    state: "error",
  });
}

async function checkMainThreadIndexReaderIgnoresStalePreloadExports() {
  const runtime = await importRepoModule("host/runtime.mjs");
  const abi = await importRepoModule("host/abi.mjs");
  const memory = new WebAssembly.Memory({ initial: 512 });
  const indexName = "indexes/preload-race.idx";
  const openedIndexId = 70;
  const stalePreloadTrackCount = 0;
  const initializedOpenTrackCount = 7;
  const instantiateRequests = [];
  const initializedIndexIds = [];
  const host = {
    [abi.HOST_IMPORT_NAME.OPFS_INDEX_OPEN](namePtr, nameLen) {
      assert.equal(
        new TextDecoder().decode(new Uint8Array(memory.buffer, namePtr, nameLen)),
        indexName,
      );
      return openedIndexId;
    },
  };

  function deferredInstantiate(label, trackCount) {
    let resolve;
    const promise = new Promise((promiseResolve) => {
      resolve = () => promiseResolve({
        exports: {
          index_query_range() {
            return 0;
          },
          index_query_range_capped() {
            return 0;
          },
          index_query_range_matched_rows() {
            return 0;
          },
          index_query_range_written_rows() {
            return 0;
          },
          index_reader_init(indexId) {
            initializedIndexIds.push({ indexId, label });
          },
          index_track_count() {
            return trackCount;
          },
        },
      });
    });

    return { label, promise, resolve };
  }

  const reader = runtime.createMainThreadIndexReaderController(memory, host, {
    instantiateWasmModuleForThread: async (id, thread) => {
      assert.equal(id, "index");
      assert.equal(thread, "main");
      const request = instantiateRequests.length === 0
        ? deferredInstantiate("preload", stalePreloadTrackCount)
        : deferredInstantiate("open", initializedOpenTrackCount);
      instantiateRequests.push(request);
      return request.promise;
    },
  });

  const preloadPromise = reader.preload();
  await Promise.resolve();
  assert.deepEqual(
    instantiateRequests.map((request) => request.label),
    ["preload"],
  );

  const openPromise = reader.open(indexName, { forceReopen: true });
  await Promise.resolve();
  assert.deepEqual(
    instantiateRequests.map((request) => request.label),
    ["preload", "open"],
  );

  instantiateRequests[1].resolve();
  await openPromise;
  assert.deepEqual(initializedIndexIds, [
    { indexId: openedIndexId, label: "open" },
  ]);
  assert.equal(reader.status().state, "ready");
  assert.equal(reader.trackCount(), initializedOpenTrackCount);

  instantiateRequests[0].resolve();
  await preloadPromise;
  assert.equal(
    reader.trackCount(),
    initializedOpenTrackCount,
    "older preload exports must not replace the initialized open reader",
  );
  assert.deepEqual(initializedIndexIds, [
    { indexId: openedIndexId, label: "open" },
  ]);
}

async function checkMainThreadIndexReaderProbesStaleCatalogSize() {
  const runtime = await importRepoModule("host/runtime.mjs");
  const abi = await importRepoModule("host/abi.mjs");
  const memory = new WebAssembly.Memory({ initial: 512 });
  const view = new DataView(memory.buffer);
  const pagePtr = 32768;
  const pageCatalog = [];
  const pageRecords = [
    {
      bucketEnd: 140,
      bucketStart: 100,
      recordCount: 3,
      trackId: 4,
    },
    {
      bucketEnd: 180,
      bucketStart: 140,
      recordCount: 2,
      trackId: 4,
    },
  ];
  let readablePageCount = 1;
  const readPages = [];
  const readerInitIds = [];
  let lastQueryRangeCount = 0;
  const host = {
    "tracy.opfsIndexSizeMayBeStale": true,
    [abi.HOST_IMPORT_NAME.OPFS_INDEX_OPEN]() {
      return 70;
    },
    [abi.HOST_IMPORT_NAME.OPFS_INDEX_SIZE](indexId) {
      assert.equal(indexId, 70);
      return BigInt(OPFS_PAGE_SIZE);
    },
  };
  const reader = runtime.createMainThreadIndexReaderController(memory, host, {
    instantiateWasmModuleForThread: async () => ({
      exports: {
        index_query_range(trackId, tsMin, tsMax, outPtr, maxRows) {
          assert.equal(trackId, 4);
          assert.equal(tsMin, 100);
          assert.equal(outPtr, 4096);
          assert.equal(maxRows, 1024);
          if (tsMax === 140) {
            assert.deepEqual(pageCatalog, [
              {
                bucketEnd: 140,
                bucketStart: 100,
                pageId: 0,
                recordCount: 3,
                trackId: 4,
              },
            ]);
            lastQueryRangeCount = 3;
            return lastQueryRangeCount;
          }

          assert.equal(tsMax, 180);
          assert.deepEqual(pageCatalog, [
            {
              bucketEnd: 140,
              bucketStart: 100,
              pageId: 0,
              recordCount: 3,
              trackId: 4,
            },
            {
              bucketEnd: 180,
              bucketStart: 140,
              pageId: 1,
              recordCount: 2,
              trackId: 4,
            },
          ]);
          lastQueryRangeCount = 5;
          return lastQueryRangeCount;
        },
        index_query_range_capped() {
          return 0;
        },
        index_query_range_matched_rows() {
          return lastQueryRangeCount;
        },
        index_query_range_written_rows() {
          return lastQueryRangeCount;
        },
        INDEX_STATUS_OK: 0,
        INDEX_WRITER_STATUS_CATALOG_FULL: 23,
        index_page_catalog_add_page(ptr, len, pageId) {
          assert.equal(ptr, pagePtr);
          assert.equal(len, OPFS_PAGE_SIZE);
          const record = pageRecords[pageId];
          pageCatalog.push({
            bucketEnd: record.bucketEnd,
            bucketStart: record.bucketStart,
            pageId,
            recordCount: record.recordCount,
            trackId: record.trackId,
          });
          return 0;
        },
        index_page_catalog_reset() {
          pageCatalog.length = 0;
        },
        index_reader_init(indexId) {
          assert.equal(indexId, 70);
          readerInitIds.push(indexId);
        },
        index_reader_covered_range_end() {
          return pageCatalog.length === 0
            ? 0
            : pageCatalog.at(-1).bucketEnd;
        },
        index_reader_covered_range_start() {
          return pageCatalog.length === 0
            ? 0
            : pageCatalog[0].bucketStart;
        },
        index_reader_covered_range_valid() {
          return pageCatalog.length > 0 ? 1 : 0;
        },
        read_page(level, pageId) {
          assert.equal(level, 0);
          readPages.push(pageId);
          if (pageId >= readablePageCount) {
            return 0;
          }

          const record = pageRecords[pageId];
          view.setUint32(
            pagePtr + INDEX_PAGE_HEADER_BUCKET_START_OFFSET,
            record.bucketStart,
            true,
          );
          view.setUint32(
            pagePtr + INDEX_PAGE_HEADER_BUCKET_END_OFFSET,
            record.bucketEnd,
            true,
          );
          view.setUint32(
            pagePtr + INDEX_PAGE_HEADER_RECORD_COUNT_OFFSET,
            record.recordCount,
            true,
          );
          view.setUint32(
            pagePtr + INDEX_PAGE_HEADER_DECODE_HINTS_OFFSET,
            INDEX_DECODE_HINT_COMPACT_SLICES |
              (record.trackId << INDEX_DECODE_HINT_TRACK_ID_SHIFT),
            true,
          );
          return pagePtr;
        },
      },
    }),
  });

  await reader.open("indexes/trace.idx");
  assert.deepEqual(readPages, [0]);
  assert.deepEqual(reader.coveredRange(), { valid: true, start: 100, end: 140 });
  assert.deepEqual(
    readPages,
    [0],
    "covered range should report the currently refreshed catalog",
  );
  assert.equal((await reader.queryRange(4, 100, 140, 4096)).count, 3);
  assert.deepEqual(
    readPages,
    [0],
    "unchanged stale-size catalog should not rebuild per query",
  );
  assert.deepEqual(readerInitIds, [70, 70]);

  readablePageCount = 2;
  await reader.open("indexes/trace.idx");
  assert.deepEqual(reader.coveredRange(), { valid: true, start: 100, end: 180 });
  assert.deepEqual(
    readPages,
    [0, 1],
    "ready reader refresh should discover worker-published pages by probing",
  );
  assert.deepEqual(readerInitIds, [70, 70, 70]);
  assert.equal((await reader.queryRange(4, 100, 180, 4096)).count, 5);
  assert.deepEqual(
    readPages,
    [0, 1],
    "stale-size hosts should not rebuild per query after refresh",
  );
  assert.deepEqual(readerInitIds, [70, 70, 70]);

  assert.equal((await reader.queryRange(4, 100, 180, 4096)).count, 5);
  assert.deepEqual(
    readPages,
    [0, 1],
    "stale-size hosts should keep the refreshed catalog stable across queries",
  );
  assert.deepEqual(readerInitIds, [70, 70, 70]);
}

async function checkMainThreadCoveredRangeRereadsUnqueryablePartialPage() {
  const runtime = await importRepoModule("host/runtime.mjs");
  const abi = await importRepoModule("host/abi.mjs");
  const memory = new WebAssembly.Memory({ initial: 512 });
  const view = new DataView(memory.buffer);
  const pagePtr = 32768;
  const pageCatalog = [];
  const readPages = [];
  const readerInitIds = [];
  let pageIsQueryable = false;
  const host = {
    [abi.HOST_IMPORT_NAME.OPFS_INDEX_OPEN]() {
      return 70;
    },
    [abi.HOST_IMPORT_NAME.OPFS_INDEX_SIZE](indexId) {
      assert.equal(indexId, 70);
      return BigInt(OPFS_PAGE_SIZE);
    },
  };
  const reader = runtime.createMainThreadIndexReaderController(memory, host, {
    instantiateWasmModuleForThread: async () => ({
      exports: {
        INDEX_STATUS_OK: 0,
        INDEX_WRITER_STATUS_CATALOG_FULL: 23,
        index_query_range_capped() {
          return 0;
        },
        index_query_range_matched_rows() {
          return 0;
        },
        index_query_range_written_rows() {
          return 0;
        },
        index_page_catalog_add_page(ptr, len, pageId) {
          assert.equal(ptr, pagePtr);
          assert.equal(len, OPFS_PAGE_SIZE);
          const hints = view.getUint32(
            pagePtr + INDEX_PAGE_HEADER_DECODE_HINTS_OFFSET,
            true,
          );
          if ((hints & INDEX_DECODE_HINT_COMPACT_SLICES) === 0) {
            return 0;
          }

          pageCatalog.push({
            bucketEnd: view.getUint32(
              pagePtr + INDEX_PAGE_HEADER_BUCKET_END_OFFSET,
              true,
            ),
            bucketStart: view.getUint32(
              pagePtr + INDEX_PAGE_HEADER_BUCKET_START_OFFSET,
              true,
            ),
            pageId,
          });
          return 0;
        },
        index_page_catalog_reset() {
          pageCatalog.length = 0;
        },
        index_reader_covered_range_end() {
          return pageCatalog.length === 0
            ? 0
            : pageCatalog.at(-1).bucketEnd;
        },
        index_reader_covered_range_start() {
          return pageCatalog.length === 0
            ? 0
            : pageCatalog[0].bucketStart;
        },
        index_reader_covered_range_valid() {
          return pageCatalog.length > 0 ? 1 : 0;
        },
        index_reader_init(indexId) {
          assert.equal(indexId, 70);
          readerInitIds.push(indexId);
        },
        read_page(level, pageId) {
          assert.equal(level, 0);
          assert.equal(pageId, 0);
          readPages.push(pageId);
          view.setUint32(
            pagePtr + INDEX_PAGE_HEADER_BUCKET_START_OFFSET,
            100,
            true,
          );
          view.setUint32(
            pagePtr + INDEX_PAGE_HEADER_BUCKET_END_OFFSET,
            140,
            true,
          );
          view.setUint32(
            pagePtr + INDEX_PAGE_HEADER_RECORD_COUNT_OFFSET,
            3,
            true,
          );
          view.setUint32(
            pagePtr + INDEX_PAGE_HEADER_DECODE_HINTS_OFFSET,
            pageIsQueryable
              ? INDEX_DECODE_HINT_COMPACT_SLICES |
                (4 << INDEX_DECODE_HINT_TRACK_ID_SHIFT)
              : 0,
            true,
          );
          return pagePtr;
        },
      },
    }),
  });

  await reader.open("indexes/trace.idx");
  assert.deepEqual(readPages, [0]);
  assert.deepEqual(reader.coveredRange(), { valid: false, start: 0, end: 0 });
  assert.deepEqual(readPages, [0]);

  pageIsQueryable = true;
  await reader.open("indexes/trace.idx");
  assert.deepEqual(reader.coveredRange(), { valid: true, start: 100, end: 140 });
  assert.deepEqual(
    readPages,
    [0, 0],
    "ready reader refresh should reread an unqueryable partial page whose page count did not change",
  );
  assert.deepEqual(readerInitIds, [70, 70, 70, 70]);
}

async function checkMainThreadSliceCatalogReportsCapacityOverflow() {
  const catalog = await importRepoModule("host/index-reader-catalog.mjs");
  const abi = await importRepoModule("host/abi.mjs");
  const memory = new WebAssembly.Memory({ initial: 512 });
  const view = new DataView(memory.buffer);
  const pagePtr = 32768;
  const addedPages = [];
  const host = {
    [abi.HOST_IMPORT_NAME.OPFS_INDEX_SIZE](indexId) {
      assert.equal(indexId, 70);
      return BigInt(2 * OPFS_PAGE_SIZE);
    },
  };
  const index = {
    INDEX_STATUS_OK: 0,
    INDEX_WRITER_STATUS_CATALOG_FULL: 23,
    index_page_catalog_add_page(ptr, len, pageId) {
      assert.equal(ptr, pagePtr);
      assert.equal(len, OPFS_PAGE_SIZE);
      if (pageId === 1) {
        return 23;
      }
      addedPages.push({
        bucketEnd: pageId * 40 + 40,
        bucketStart: pageId * 40,
        pageId,
        recordCount: 2,
        trackId: 4,
      });
      return 0;
    },
    index_page_catalog_reset() {
      addedPages.length = 0;
    },
    read_page(level, pageId) {
      assert.equal(level, 0);
      view.setUint32(pagePtr + INDEX_PAGE_HEADER_BUCKET_START_OFFSET, pageId * 40, true);
      view.setUint32(pagePtr + INDEX_PAGE_HEADER_BUCKET_END_OFFSET, pageId * 40 + 40, true);
      view.setUint32(pagePtr + INDEX_PAGE_HEADER_RECORD_COUNT_OFFSET, 2, true);
      view.setUint32(
        pagePtr + INDEX_PAGE_HEADER_DECODE_HINTS_OFFSET,
        INDEX_DECODE_HINT_COMPACT_SLICES | (4 << INDEX_DECODE_HINT_TRACK_ID_SHIFT),
        true,
      );
      return pagePtr;
    },
  };

  const result = await catalog.rebuildMainThreadSliceCatalog(memory, host, index, 70);

  assert.deepEqual(result, { catalogFull: true, pageCount: 2, rebuilt: true });
  assert.deepEqual(addedPages, [
    {
      bucketEnd: 40,
      bucketStart: 0,
      pageId: 0,
      recordCount: 2,
      trackId: 4,
    },
  ]);
}

async function checkMainThreadIndexReaderFailsOnCatalogOverflow() {
  const runtime = await importRepoModule("host/runtime.mjs");
  const abi = await importRepoModule("host/abi.mjs");
  const memory = new WebAssembly.Memory({ initial: 512 });
  const view = new DataView(memory.buffer);
  const pagePtr = 32768;
  const host = {
    [abi.HOST_IMPORT_NAME.OPFS_INDEX_OPEN]() {
      return 70;
    },
    [abi.HOST_IMPORT_NAME.OPFS_INDEX_SIZE](indexId) {
      assert.equal(indexId, 70);
      return BigInt(2 * OPFS_PAGE_SIZE);
    },
  };
  const reader = runtime.createMainThreadIndexReaderController(memory, host, {
    instantiateWasmModuleForThread: async () => ({
      exports: {
        INDEX_STATUS_OK: 0,
        INDEX_WRITER_STATUS_CATALOG_FULL: 23,
        index_query_range_capped() {
          return 0;
        },
        index_query_range_matched_rows() {
          return 0;
        },
        index_query_range_written_rows() {
          return 0;
        },
        index_page_catalog_add_page(ptr, len, pageId) {
          assert.equal(ptr, pagePtr);
          assert.equal(len, OPFS_PAGE_SIZE);
          return pageId === 0 ? 0 : 23;
        },
        index_page_catalog_reset() {},
        index_reader_init(indexId) {
          assert.equal(indexId, 70);
        },
        read_page(level, pageId) {
          assert.equal(level, 0);
          view.setUint32(
            pagePtr + INDEX_PAGE_HEADER_BUCKET_START_OFFSET,
            pageId * 40,
            true,
          );
          view.setUint32(
            pagePtr + INDEX_PAGE_HEADER_BUCKET_END_OFFSET,
            pageId * 40 + 40,
            true,
          );
          view.setUint32(
            pagePtr + INDEX_PAGE_HEADER_RECORD_COUNT_OFFSET,
            2,
            true,
          );
          view.setUint32(
            pagePtr + INDEX_PAGE_HEADER_DECODE_HINTS_OFFSET,
            INDEX_DECODE_HINT_COMPACT_SLICES |
              (4 << INDEX_DECODE_HINT_TRACK_ID_SHIFT),
            true,
          );
          return pagePtr;
        },
      },
    }),
  });

  await assert.rejects(
    reader.open("indexes/trace.idx"),
    /main-thread slice catalog full/,
  );
  assert.deepEqual(reader.status(), {
    catalogFull: true,
    error: "main-thread slice catalog full while rebuilding index 70 at page 2",
    indexId: null,
    indexName: "indexes/trace.idx",
    state: "error",
  });
}

async function checkWorkerStatusReportsReaderCatalogOverflow() {
  const runtime = await importRepoModule("host/runtime.mjs");
  const workerStatus = [];
  const indexReader = {
    open() {
      return Promise.reject(new Error("main-thread slice catalog full"));
    },
  };
  const controller = runtime.createIngestWorkerController({
    Worker: FakeWorker,
    indexReader,
    onWorkerStatus(status, message) {
      workerStatus.push({ message, status });
    },
  });

  controller.start({ indexName: "indexes/trace.idx" });
  const worker = FakeWorker.instances.at(-1);
  const ingestId = worker.posted.at(-1).ingestId;

  worker.emit("message", {
    end: 140,
    ingestId,
    start: 100,
    type: "covered_range",
    valid: true,
  });
  await Promise.resolve();

  assert.equal(controller.status().state, "error");
  assert.equal(controller.status().error, "main-thread slice catalog full");
  assert.equal(workerStatus.at(-1).status.state, "error");
}

async function checkWorkerCoveredRangeOpensReaderBeforeRangeIsValid() {
  const runtime = await importRepoModule("host/runtime.mjs");
  const indexReaderOpenCalls = [];
  const controller = runtime.createIngestWorkerController({
    Worker: FakeWorker,
    indexReader: {
      open(indexName) {
        indexReaderOpenCalls.push(indexName);
        return Promise.resolve(true);
      },
    },
  });

  assert.equal(
    controller.start({
      indexName: "indexes/trace.idx",
      sourceName: "sources/trace.json",
    }),
    true,
  );
  const worker = FakeWorker.instances.at(-1);
  const ingestId = worker.posted.at(-1).ingestId;

  worker.emit("message", {
    end: 0,
    ingestId,
    start: 0,
    type: "covered_range",
    valid: false,
  });
  await Promise.resolve();

  assert.deepEqual(indexReaderOpenCalls, ["indexes/trace.idx"]);
  assert.deepEqual(controller.status().coveredRange, {
    end: 0,
    ingestId,
    start: 0,
    type: "covered_range",
    valid: false,
  });
}

function checkWatWriterPropagatesCatalogOverflow() {
  const constants = fs.readFileSync(
    path.resolve(__dirname, "../wat/index/constants-and-helpers.wat.inc"),
    "utf8",
  );
  const writer = fs.readFileSync(
    path.resolve(__dirname, "../wat/index/page-layout-and-writer-pages.wat.inc"),
    "utf8",
  );

  assert.match(constants, /INDEX_WRITER_STATUS_CATALOG_FULL/);
  assert.match(
    writer,
    /call \$index_page_catalog_add_slice_page\s+local\.set \$status\s+local\.get \$status\s+i32\.eqz\s+if\s+global\.get \$INDEX_WRITER_STATUS_CATALOG_FULL\s+return\s+end/,
  );
}

async function checkProgressiveTraceRendererDrawsCoveredPartialRows() {
  const rendererModule = await importRepoModule("host/progressive-trace-renderer.mjs");
  const memory = new WebAssembly.Memory({ initial: 1 });
  const operations = [];
  const canvas = {
    height: 160,
    width: 320,
    getContext() {
      return context;
    },
  };
  const context = {
    beginPath() {
      operations.push({ op: "beginPath" });
    },
    clearRect(x, y, width, height) {
      operations.push({ height, op: "clearRect", width, x, y });
    },
    clip() {
      operations.push({ op: "clip" });
    },
    fillRect(x, y, width, height) {
      operations.push({
        fillStyle: this.fillStyle,
        height,
        op: "fillRect",
        width,
        x,
        y,
      });
    },
    lineTo(x, y) {
      operations.push({ op: "lineTo", x, y });
    },
    moveTo(x, y) {
      operations.push({ op: "moveTo", x, y });
    },
    rect(x, y, width, height) {
      operations.push({ height, op: "rect", width, x, y });
    },
    restore() {
      operations.push({ op: "restore" });
    },
    save() {
      operations.push({ op: "save" });
    },
    stroke() {
      operations.push({ op: "stroke", strokeStyle: this.strokeStyle });
    },
  };
  let coveredRange = { end: 140, start: 100, type: "covered_range", valid: true };
  const queryCalls = [];
  const reader = {
    queryRange(trackId, tsMin, tsMax, outPtr, maxRows) {
      queryCalls.push({ maxRows, outPtr, trackId, tsMax, tsMin });
      const view = new DataView(memory.buffer);
      view.setUint32(outPtr, trackId === 0 ? 104 : 120, true);
      view.setUint32(outPtr + 4, trackId === 0 ? 8 : 12, true);
      view.setUint32(outPtr + 12, trackId, true);
      view.setUint32(outPtr + 20, trackId === 0 ? 0x2d74da : 0x6b7280, true);
      view.setUint32(outPtr + 24, trackId === 1 ? 1 : 0, true);
      return 1;
    },
    status() {
      return { state: "ready" };
    },
    trackCount() {
      return 2;
    },
  };
  let workerState = "running";
  const ingestWorker = {
    indexReader: reader,
    status() {
      return { coveredRange, state: workerState };
    },
  };
  const renderer = rendererModule.createProgressiveTraceRenderer(memory, ingestWorker, {
    canvas,
    queryOutPtr: 2048,
    queryWindow: 100,
    renderPlannerExports: makeTraceRenderPlannerExports({ memory }),
  });

  assert.equal(renderer.draw(123), 2);
  assert.deepEqual(
    queryCalls,
    [
      { maxRows: 1024, outPtr: 2048, trackId: 0, tsMax: 140, tsMin: 100 },
      { maxRows: 1024, outPtr: 2048, trackId: 1, tsMax: 140, tsMin: 100 },
    ],
  );
  assert.equal(
    operations.some((operation) => operation.op === "fillRect" && operation.fillStyle === "#2d74da"),
    true,
    "committed row should draw with its resolved color",
  );
  assert.equal(
    operations.some(
      (operation) =>
        operation.op === "fillRect" &&
        operation.fillStyle === "rgba(92, 109, 130, 0.58)",
    ),
    true,
    "partial row should draw with unfinished styling",
  );
  assert.equal(
    operations.some((operation) => operation.op === "stroke"),
    true,
    "partial row should get a hatch overlay",
  );

  coveredRange = { end: 180, start: 100, type: "covered_range", valid: true };
  renderer.draw(124);
  assert.deepEqual(queryCalls.at(-1), {
    maxRows: 1024,
    outPtr: 2048,
    trackId: 1,
    tsMax: 180,
    tsMin: 100,
  });
  assert.deepEqual(renderer.status(), {
    cappedQueries: [],
    error: null,
    incompleteQueryRanges: [],
    rows: 2,
    unknownRange: { pending: true, start: 180 },
    userInteracted: false,
    viewport: { end: 180, start: 100, valid: true },
  });

  workerState = "complete";
  operations.length = 0;
  renderer.draw(125);
  assert.equal(
    operations.some(
      (operation) =>
        operation.op === "fillRect" &&
        operation.fillStyle === "rgba(92, 109, 130, 0.58)",
    ),
    false,
    "completed ingest should stop drawing partial rows with unfinished styling",
  );
  assert.equal(
    operations.some((operation) => operation.op === "stroke"),
    false,
    "completed ingest should stop drawing partial hatch overlays",
  );
  assert.equal(
    operations.some((operation) => operation.op === "fillRect" && operation.fillStyle === "#6b7280"),
    true,
    "completed ingest should draw formerly partial rows with their resolved color",
  );
  assert.deepEqual(renderer.status(), {
    cappedQueries: [],
    error: null,
    incompleteQueryRanges: [],
    rows: 2,
    unknownRange: null,
    userInteracted: false,
    viewport: { end: 180, start: 100, valid: true },
  });
}

async function checkProgressiveTraceRendererClipsLeftEdgeSlices() {
  const rendererModule = await importRepoModule("host/progressive-trace-renderer.mjs");
  const memory = new WebAssembly.Memory({ initial: 1 });
  const operations = [];
  const canvas = {
    height: 160,
    width: 320,
    getContext() {
      return context;
    },
  };
  const context = {
    clearRect(x, y, width, height) {
      operations.push({ height, op: "clearRect", width, x, y });
    },
    fillRect(x, y, width, height) {
      operations.push({
        fillStyle: this.fillStyle,
        height,
        op: "fillRect",
        width,
        x,
        y,
      });
    },
    restore() {
      operations.push({ op: "restore" });
    },
    save() {
      operations.push({ op: "save" });
    },
  };
  const reader = {
    queryRange(trackId, tsMin, tsMax, outPtr, maxRows) {
      assert.deepEqual(
        { maxRows, trackId, tsMax, tsMin },
        { maxRows: 1024, trackId: 0, tsMax: 200, tsMin: 100 },
      );
      const view = new DataView(memory.buffer);
      view.setUint32(outPtr, 50, true);
      view.setUint32(outPtr + 4, 75, true);
      view.setUint32(outPtr + 12, 0, true);
      view.setUint32(outPtr + 20, 0x2d74da, true);
      view.setUint32(outPtr + 24, 0, true);
      return 1;
    },
    status() {
      return { state: "ready" };
    },
    trackCount() {
      return 1;
    },
  };
  const ingestWorker = {
    indexReader: reader,
    status() {
      return {
        coveredRange: { end: 200, start: 100, type: "covered_range", valid: true },
        state: "complete",
      };
    },
  };
  const renderPlannerExports = {
    ...makeTraceRenderPlannerExports({ memory }),
    trace_render_slice_x(sliceStart, viewportStart, viewportSpan, canvasWidth) {
      return ((sliceStart - viewportStart) / viewportSpan) * canvasWidth;
    },
  };
  const renderer = rendererModule.createProgressiveTraceRenderer(memory, ingestWorker, {
    canvas,
    queryOutPtr: 2048,
    queryWindow: 100,
    renderPlannerExports,
  });

  renderer.draw(123);
  const sliceFill = operations.find(
    (operation) => operation.op === "fillRect" && operation.fillStyle === "#2d74da",
  );

  assert.deepEqual(
    sliceFill,
    {
      fillStyle: "#2d74da",
      height: 10,
      op: "fillRect",
      width: 80,
      x: 0,
      y: 18,
    },
    "slice crossing the left viewport edge should draw only its clipped visible span",
  );
}

async function checkProgressiveTraceRendererClampsToSliceCatalogCoverage() {
  const rendererModule = await importRepoModule("host/progressive-trace-renderer.mjs");
  const memory = new WebAssembly.Memory({ initial: 1 });
  const canvas = {
    height: 120,
    width: 240,
    getContext() {
      return {
        clearRect() {},
        fillRect() {},
        restore() {},
        save() {},
      };
    },
  };
  const workerCoveredRange = {
    end: 1000,
    start: 0,
    type: "covered_range",
    valid: true,
  };
  let sliceCoveredRange = {
    end: 320,
    start: 200,
    valid: true,
  };
  const queryCalls = [];
  const reader = {
    coveredRange() {
      return sliceCoveredRange;
    },
    queryRange(trackId, tsMin, tsMax, outPtr, maxRows) {
      queryCalls.push({ maxRows, outPtr, trackId, tsMax, tsMin });
      return 0;
    },
    status() {
      return { state: "ready" };
    },
    trackCount() {
      return 1;
    },
  };
  const ingestWorker = {
    indexReader: reader,
    status() {
      return { coveredRange: workerCoveredRange, state: "running" };
    },
  };
  const renderer = rendererModule.createProgressiveTraceRenderer(memory, ingestWorker, {
    canvas,
    queryOutPtr: 2048,
    queryWindow: 1000,
    renderPlannerExports: makeTraceRenderPlannerExports({ memory }),
  });

  renderer.draw(1);
  assert.deepEqual(queryCalls, [
    { maxRows: 1024, outPtr: 2048, trackId: 0, tsMax: 320, tsMin: 200 },
  ]);
  assert.deepEqual(renderer.status().viewport, {
    end: 320,
    start: 200,
    valid: true,
  });

  sliceCoveredRange = { end: 0, start: 0, valid: false };
  queryCalls.length = 0;
  const emptyRenderer = rendererModule.createProgressiveTraceRenderer(
    memory,
    ingestWorker,
    {
      canvas,
      queryOutPtr: 2048,
      queryWindow: 1000,
      renderPlannerExports: makeTraceRenderPlannerExports({ memory }),
    },
  );

  assert.equal(emptyRenderer.draw(2), 0);
  assert.deepEqual(queryCalls, []);
  assert.equal(emptyRenderer.status().viewport, null);
}

async function checkProgressiveTraceRendererSurfacesCappedQueries() {
  const rendererModule = await importRepoModule("host/progressive-trace-renderer.mjs");
  const memory = new WebAssembly.Memory({ initial: 1 });
  const queryCalls = [];
  const operations = [];
  const canvas = {
    height: 120,
    width: 240,
    getContext() {
      return {
        beginPath() {
          operations.push({ op: "beginPath" });
        },
        clearRect(x, y, width, height) {
          operations.push({ height, op: "clearRect", width, x, y });
        },
        clip() {
          operations.push({ op: "clip" });
        },
        fillRect(x, y, width, height) {
          operations.push({
            fillStyle: this.fillStyle,
            height,
            op: "fillRect",
            width,
            x,
            y,
          });
        },
        lineTo(x, y) {
          operations.push({ op: "lineTo", x, y });
        },
        moveTo(x, y) {
          operations.push({ op: "moveTo", x, y });
        },
        rect(x, y, width, height) {
          operations.push({ height, op: "rect", width, x, y });
        },
        restore() {
          operations.push({ op: "restore" });
        },
        save() {
          operations.push({ op: "save" });
        },
        stroke() {
          operations.push({ op: "stroke", strokeStyle: this.strokeStyle });
        },
      };
    },
  };
  const reader = {
    queryRange(trackId, tsMin, tsMax, outPtr, maxRows) {
      queryCalls.push({ maxRows, outPtr, trackId, tsMax, tsMin });
      const view = new DataView(memory.buffer);

      view.setUint32(outPtr, 110, true);
      view.setUint32(outPtr + 4, 8, true);
      view.setUint32(outPtr + 12, 0, true);
      view.setUint32(outPtr + 20, 0x2d74da, true);
      view.setUint32(outPtr + 24, 0, true);
      return {
        capped: true,
        count: 1,
        matchedRows: 4096,
        writtenRows: 1,
      };
    },
    status() {
      return { state: "ready" };
    },
    trackCount() {
      return 1;
    },
  };
  const ingestWorker = {
    indexReader: reader,
    status() {
      return {
        coveredRange: { end: 200, start: 100, type: "covered_range", valid: true },
        state: "running",
      };
    },
  };
  const renderer = rendererModule.createProgressiveTraceRenderer(memory, ingestWorker, {
    canvas,
    queryOutPtr: 2048,
    queryRowCap: 1,
    queryWindow: 100,
    renderPlannerExports: makeTraceRenderPlannerExports({ memory }),
  });

  assert.equal(renderer.draw(123), 1);
  assert.deepEqual(queryCalls, [
    { maxRows: 1, outPtr: 2048, trackId: 0, tsMax: 200, tsMin: 100 },
  ]);
  assert.deepEqual(renderer.status().cappedQueries, [
    { matchedRows: 4096, trackId: 0, writtenRows: 1 },
  ]);
  assert.deepEqual(renderer.status().incompleteQueryRanges, [
    { end: 200, start: 100, trackId: 0 },
  ]);
  assert.equal(
    operations.some(
      (operation) =>
        operation.op === "fillRect" &&
        operation.fillStyle === "rgba(180, 83, 9, 0.16)" &&
        operation.x === 0 &&
        operation.width === 240,
    ),
    true,
    "capped query ranges should be visibly marked incomplete",
  );
  assert.equal(
    operations.some(
      (operation) =>
        operation.op === "stroke" &&
        operation.strokeStyle === "rgba(146, 64, 14, 0.42)",
    ),
    true,
    "capped query ranges should include an incomplete-range stripe overlay",
  );
}

async function checkProgressiveTraceRendererTilesFullVisibleViewport() {
  const rendererModule = await importRepoModule("host/progressive-trace-renderer.mjs");
  const memory = new WebAssembly.Memory({ initial: 1 });
  const queryCalls = [];
  const canvas = {
    height: 120,
    width: 240,
    getContext() {
      return {
        clearRect() {},
        fillRect() {},
        restore() {},
        save() {},
      };
    },
  };
  const reader = {
    queryRange(trackId, tsMin, tsMax, outPtr, maxRows) {
      queryCalls.push({ maxRows, outPtr, trackId, tsMax, tsMin });
      const view = new DataView(memory.buffer);

      view.setUint32(outPtr, tsMin >= 2000 ? 2200 : tsMin + 10, true);
      view.setUint32(outPtr + 4, 8, true);
      view.setUint32(outPtr + 12, 0, true);
      view.setUint32(outPtr + 20, 0x2d74da, true);
      view.setUint32(outPtr + 24, 0, true);
      return 1;
    },
    status() {
      return { state: "ready" };
    },
    trackCount() {
      return 1;
    },
  };
  const ingestWorker = {
    indexReader: reader,
    status() {
      return {
        coveredRange: { end: 2500, start: 0, type: "covered_range", valid: true },
        state: "running",
      };
    },
  };
  const renderer = rendererModule.createProgressiveTraceRenderer(memory, ingestWorker, {
    canvas,
    queryOutPtr: 2048,
    renderRowPtr: 4096,
    renderPlannerExports: makeTraceRenderPlannerExports({ memory }),
  });

  assert.equal(renderer.draw(123), 3);

  assert.deepEqual(queryCalls, [
    { maxRows: 1024, outPtr: 2048, trackId: 0, tsMax: 1000, tsMin: 0 },
    { maxRows: 1024, outPtr: 2048, trackId: 0, tsMax: 2000, tsMin: 1000 },
    { maxRows: 1024, outPtr: 2048, trackId: 0, tsMax: 2500, tsMin: 2000 },
  ]);
  assert.deepEqual(
    readTraceRenderRow(memory, 4096, 2),
    { color: 0x2d74da, depth: 0, dur: 8, partial: false, start: 2200 },
    "later visible rows should still render when the viewport exceeds the default query window",
  );
}

async function checkProgressiveTraceRendererBoundsLargeViewportQueries() {
  const rendererModule = await importRepoModule("host/progressive-trace-renderer.mjs");
  const memory = new WebAssembly.Memory({ initial: 1 });
  const queryCalls = [];
  const canvas = {
    height: 120,
    width: 240,
    getContext() {
      return {
        clearRect() {},
        fillRect() {},
        restore() {},
        save() {},
      };
    },
  };
  const reader = {
    queryRange(trackId, tsMin, tsMax, outPtr, maxRows) {
      queryCalls.push({ maxRows, outPtr, trackId, tsMax, tsMin });
      const view = new DataView(memory.buffer);

      view.setUint32(outPtr, Math.floor(tsMin), true);
      view.setUint32(outPtr + 4, 8, true);
      view.setUint32(outPtr + 12, trackId, true);
      view.setUint32(outPtr + 20, 0x2d74da, true);
      view.setUint32(outPtr + 24, 0, true);
      return 1;
    },
    status() {
      return { state: "ready" };
    },
    trackCount() {
      return 2;
    },
  };
  const ingestWorker = {
    indexReader: reader,
    status() {
      return {
        coveredRange: {
          end: 10_000_000,
          start: 0,
          type: "covered_range",
          valid: true,
        },
        state: "running",
      };
    },
  };
  const renderer = rendererModule.createProgressiveTraceRenderer(memory, ingestWorker, {
    canvas,
    queryOutPtr: 2048,
    queryRangeBudget: 8,
    queryWindow: 1000,
    renderRowPtr: 4096,
    renderPlannerExports: makeTraceRenderPlannerExports({ memory }),
  });

  assert.equal(renderer.draw(123), 8);

  assert.equal(queryCalls.length, 8);
  assert.deepEqual(queryCalls, [
    { maxRows: 1024, outPtr: 2048, trackId: 0, tsMax: 2500000, tsMin: 0 },
    { maxRows: 1024, outPtr: 2048, trackId: 0, tsMax: 5000000, tsMin: 2500000 },
    { maxRows: 1024, outPtr: 2048, trackId: 0, tsMax: 7500000, tsMin: 5000000 },
    { maxRows: 1024, outPtr: 2048, trackId: 0, tsMax: 10000000, tsMin: 7500000 },
    { maxRows: 1024, outPtr: 2048, trackId: 1, tsMax: 2500000, tsMin: 0 },
    { maxRows: 1024, outPtr: 2048, trackId: 1, tsMax: 5000000, tsMin: 2500000 },
    { maxRows: 1024, outPtr: 2048, trackId: 1, tsMax: 7500000, tsMin: 5000000 },
    { maxRows: 1024, outPtr: 2048, trackId: 1, tsMax: 10000000, tsMin: 7500000 },
  ]);
  assert.deepEqual(
    readTraceRenderRow(memory, 4096, 7),
    { color: 0x2d74da, depth: 1, dur: 8, partial: false, start: 7500000 },
    "large viewports should still represent later visible data within the query budget",
  );
}

async function checkProgressiveTraceRendererMarksSkippedTracksWhenBudgetExhausted() {
  const rendererModule = await importRepoModule("host/progressive-trace-renderer.mjs");
  const memory = new WebAssembly.Memory({ initial: 1 });
  const queryCalls = [];
  const operations = [];
  const canvas = {
    height: 120,
    width: 240,
    getContext() {
      return {
        beginPath() {
          operations.push({ op: "beginPath" });
        },
        clearRect(x, y, width, height) {
          operations.push({ height, op: "clearRect", width, x, y });
        },
        clip() {
          operations.push({ op: "clip" });
        },
        fillRect(x, y, width, height) {
          operations.push({
            fillStyle: this.fillStyle,
            height,
            op: "fillRect",
            width,
            x,
            y,
          });
        },
        lineTo(x, y) {
          operations.push({ op: "lineTo", x, y });
        },
        moveTo(x, y) {
          operations.push({ op: "moveTo", x, y });
        },
        rect(x, y, width, height) {
          operations.push({ height, op: "rect", width, x, y });
        },
        restore() {
          operations.push({ op: "restore" });
        },
        save() {
          operations.push({ op: "save" });
        },
        stroke() {
          operations.push({ op: "stroke", strokeStyle: this.strokeStyle });
        },
      };
    },
  };
  const reader = {
    queryRange(trackId, tsMin, tsMax, outPtr, maxRows) {
      queryCalls.push({ maxRows, outPtr, trackId, tsMax, tsMin });
      const view = new DataView(memory.buffer);

      view.setUint32(outPtr, 10 + trackId * 10, true);
      view.setUint32(outPtr + 4, 8, true);
      view.setUint32(outPtr + 12, trackId, true);
      view.setUint32(outPtr + 20, 0x2d74da, true);
      view.setUint32(outPtr + 24, 0, true);
      return 1;
    },
    status() {
      return { state: "ready" };
    },
    trackCount() {
      return 4;
    },
  };
  const ingestWorker = {
    indexReader: reader,
    status() {
      return {
        coveredRange: { end: 100, start: 0, type: "covered_range", valid: true },
        state: "running",
      };
    },
  };
  const renderer = rendererModule.createProgressiveTraceRenderer(memory, ingestWorker, {
    canvas,
    queryOutPtr: 2048,
    queryRangeBudget: 2,
    queryWindow: 100,
    renderPlannerExports: makeTraceRenderPlannerExports({ memory }),
  });

  assert.equal(renderer.draw(123), 2);

  assert.deepEqual(queryCalls, [
    { maxRows: 1024, outPtr: 2048, trackId: 0, tsMax: 100, tsMin: 0 },
    { maxRows: 1024, outPtr: 2048, trackId: 1, tsMax: 100, tsMin: 0 },
  ]);
  assert.deepEqual(renderer.status().incompleteQueryRanges, [
    { end: 100, start: 0, trackId: 2 },
    { end: 100, start: 0, trackId: 3 },
  ]);
  assert.equal(
    operations.some(
      (operation) =>
        operation.op === "fillRect" &&
        operation.fillStyle === "rgba(180, 83, 9, 0.16)" &&
        operation.x === 0 &&
        operation.width === 240,
    ),
    true,
    "tracks skipped by query budget exhaustion should be visibly marked incomplete",
  );
  assert.equal(
    operations.some(
      (operation) =>
        operation.op === "stroke" &&
        operation.strokeStyle === "rgba(146, 64, 14, 0.42)",
    ),
    true,
    "tracks skipped by query budget exhaustion should include the incomplete stripe overlay",
  );
}

async function checkProgressiveTraceRendererUsesWasmCanvasOpPlanner() {
  const rendererModule = await importRepoModule("host/progressive-trace-renderer.mjs");
  assert.throws(
    () => rendererModule.createProgressiveTraceRenderer(
      new WebAssembly.Memory({ initial: 1 }),
      { status: () => ({ state: "idle" }) },
      {
        canvas: {
          getContext() {
            return {};
          },
        },
      },
    ),
    /renderer planner missing required Wasm exports/,
    "production renderer construction should fail closed without trace_render_* Wasm exports",
  );
  const streamCalls = [];
  const streamOps = [
    { end: 50, start: 0, tag: TEST_TRACE_RENDER_COMMAND.QUERY_RANGE, trackId: 0 },
    {
      end: 100,
      start: 50,
      tag: TEST_TRACE_RENDER_COMMAND.INCOMPLETE_QUERY_RANGE,
      trackId: 1,
    },
    { tag: TEST_TRACE_RENDER_COMMAND.END },
  ];
  let streamIndex = -1;
  const streamPlanner = rendererModule.__test.createWasmCanvasOpPlanner({
    ...makeTraceRenderPlannerExports(),
    trace_render_plan_begin(viewportStart, viewportEnd, trackCount, queryRangeBudget, queryWindow) {
      streamCalls.push([
        "begin",
        viewportStart,
        viewportEnd,
        trackCount,
        queryRangeBudget,
        queryWindow,
      ]);
      streamIndex = -1;
    },
    trace_render_plan_next() {
      streamIndex += 1;
      streamCalls.push(["next", streamOps[streamIndex].tag]);
      return streamOps[streamIndex].tag;
    },
    trace_render_plan_op_end() {
      return streamOps[streamIndex].end;
    },
    trace_render_plan_op_start() {
      return streamOps[streamIndex].start;
    },
    trace_render_plan_op_track_id() {
      return streamOps[streamIndex].trackId;
    },
  });

  assert.deepEqual(
    streamPlanner.queryOps({
      queryRangeBudget: 3,
      queryWindow: 1000,
      trackCount: 2,
      viewport: { end: 100, start: 0, valid: true },
    }),
    [
      { end: 50, op: "query_range", start: 0, trackId: 0 },
      { end: 100, op: "incomplete_query_range", start: 50, trackId: 1 },
    ],
  );
  assert.deepEqual(streamCalls, [
    ["begin", 0, 100, 2, 3, 1000],
    ["next", TEST_TRACE_RENDER_COMMAND.QUERY_RANGE],
    ["next", TEST_TRACE_RENDER_COMMAND.INCOMPLETE_QUERY_RANGE],
    ["next", TEST_TRACE_RENDER_COMMAND.END],
  ]);
}

async function checkProgressiveTraceRendererClampsPanZoomAndDrawsUnknownRange() {
  const rendererModule = await importRepoModule("host/progressive-trace-renderer.mjs");
  const memory = new WebAssembly.Memory({ initial: 1 });
  const listeners = new Map();
  const operations = [];
  const canvas = {
    height: 160,
    width: 320,
    addEventListener(type, callback) {
      listeners.set(type, callback);
    },
    getBoundingClientRect() {
      return { left: 0, top: 0 };
    },
    getContext() {
      return context;
    },
    releasePointerCapture() {},
    setPointerCapture() {},
  };
  const context = {
    beginPath() {
      operations.push({ op: "beginPath" });
    },
    clearRect(x, y, width, height) {
      operations.push({ height, op: "clearRect", width, x, y });
    },
    clip() {
      operations.push({ op: "clip" });
    },
    fillRect(x, y, width, height) {
      operations.push({
        fillStyle: this.fillStyle,
        height,
        op: "fillRect",
        width,
        x,
        y,
      });
    },
    lineTo(x, y) {
      operations.push({ op: "lineTo", x, y });
    },
    moveTo(x, y) {
      operations.push({ op: "moveTo", x, y });
    },
    rect(x, y, width, height) {
      operations.push({ height, op: "rect", width, x, y });
    },
    restore() {
      operations.push({ op: "restore" });
    },
    save() {
      operations.push({ op: "save" });
    },
    stroke() {
      operations.push({ op: "stroke", strokeStyle: this.strokeStyle });
    },
  };
  const coveredRange = { end: 200, start: 100, type: "covered_range", valid: true };
  const queryCalls = [];
  const reader = {
    queryRange(trackId, tsMin, tsMax, outPtr, maxRows) {
      queryCalls.push({ maxRows, outPtr, trackId, tsMax, tsMin });
      const view = new DataView(memory.buffer);
      view.setUint32(outPtr, Math.max(100, Math.floor(tsMin)), true);
      view.setUint32(outPtr + 4, 8, true);
      view.setUint32(outPtr + 12, 0, true);
      view.setUint32(outPtr + 20, 0x2d74da, true);
      view.setUint32(outPtr + 24, 0, true);
      return 1;
    },
    status() {
      return { state: "ready" };
    },
    trackCount() {
      return 1;
    },
  };
  const ingestWorker = {
    indexReader: reader,
    status() {
      return { coveredRange, state: "running" };
    },
  };
  const renderer = rendererModule.createProgressiveTraceRenderer(memory, ingestWorker, {
    canvas,
    minViewportSpan: 10,
    queryOutPtr: 2048,
    queryWindow: 1000,
    renderPlannerExports: makeTraceRenderPlannerExports({ memory }),
  });

  renderer.draw(1);
  assert.equal(
    operations.some(
      (operation) =>
        operation.op === "fillRect" &&
        operation.fillStyle === "rgba(126, 134, 146, 0.18)",
    ),
    true,
    "unknown leading edge should draw as a striped affordance while ingest runs",
  );
  assert.equal(
    operations.some(
      (operation) =>
        operation.op === "stroke" &&
        operation.strokeStyle === "rgba(76, 85, 99, 0.38)",
    ),
    true,
    "unknown leading edge should include stripes",
  );

  listeners.get("wheel")({
    clientX: 160,
    deltaY: -700,
    preventDefault() {
      operations.push({ op: "wheelPrevented" });
    },
  });
  renderer.draw(2);
  const zoomedViewport = renderer.status().viewport;
  assert.equal(renderer.status().userInteracted, true);
  assert.equal(zoomedViewport.start >= coveredRange.start, true);
  assert.equal(zoomedViewport.end <= coveredRange.end, true);
  assert.equal(zoomedViewport.end - zoomedViewport.start < 100, true);

  listeners.get("pointerdown")({
    button: 0,
    clientX: 160,
    pointerId: 1,
    preventDefault() {},
  });
  listeners.get("pointermove")({
    clientX: -10000,
    pointerId: 1,
    preventDefault() {},
  });
  listeners.get("pointerup")({ pointerId: 1 });
  renderer.draw(3);
  assert.equal(renderer.status().viewport.end, coveredRange.end);

  listeners.get("pointerdown")({
    button: 0,
    clientX: 160,
    pointerId: 2,
    preventDefault() {},
  });
  listeners.get("pointermove")({
    clientX: 10000,
    pointerId: 2,
    preventDefault() {},
  });
  listeners.get("pointercancel")({ pointerId: 2 });
  renderer.draw(4);
  assert.equal(renderer.status().viewport.start, coveredRange.start);
  assert.equal(queryCalls.at(-1).tsMin, coveredRange.start);
}

async function checkRuntimePreloadsProgressiveTraceRendererImplementation() {
  let coveredRange = null;
  let readerCoveredRange = null;
  let readerState = "idle";
  let importCalls = 0;
  let drawCalls = 0;
  let rendererOptions = null;
  const ingestWorker = {
    indexReader: {
      coveredRange() {
        return readerCoveredRange;
      },
      status() {
        return { state: readerState };
      },
    },
    status() {
      return { coveredRange, state: "running" };
    },
  };
  const harness = createRuntimeAppHarness({
    runAppOptions: {
      importProgressiveTraceRenderer: async () => {
        importCalls += 1;
        return {
          createProgressiveTraceRenderer(nextMemory, nextIngestWorker, options) {
            assert.equal(nextMemory, harness.memory);
            assert.equal(nextIngestWorker, ingestWorker);
            rendererOptions = options;
            return {
              draw() {
                drawCalls += 1;
              },
            };
          },
        };
      },
      ingestWorker,
      preloadIngestDependencies: false,
      instantiateWasmModuleForThread: async () => ({
        exports: makeAppExports(),
      }),
      worker: {
        Worker: FakeWorker,
      },
    },
  });

  await harness.boot();

  assert.equal(
    importCalls,
    1,
    "renderer implementation module import should start before the first animation frame",
  );
  await harness.runFrame(1);
  assert.equal(importCalls, 1, "renderer implementation module should be imported once");
  assert.equal(drawCalls, 0, "renderer should not draw before covered pages are queryable");

  coveredRange = { end: 0, start: 0, type: "covered_range", valid: false };
  readerState = "ready";
  await harness.runFrame(2);
  assert.equal(
    drawCalls,
    0,
    "renderer should wait a frame for creation after the reader becomes queryable",
  );

  await harness.runFrame(3);
  await harness.runFrame(4);
  assert.equal(
    drawCalls,
    1,
    "renderer should be created after the reader is ready and a worker handoff exists",
  );
  assert.equal(
    typeof rendererOptions?.renderPlannerExports?.trace_render_plan_begin,
    "function",
    "production runtime should pass app Wasm trace_render_* exports into the renderer",
  );
  assert.equal(
    typeof rendererOptions?.renderPlannerExports?.trace_render_append_query_rows,
    "function",
    "production runtime should pass the Wasm render row append export into the renderer",
  );

  readerCoveredRange = { end: 120, start: 100, valid: true };
  coveredRange = { end: 120, start: 100, type: "covered_range", valid: true };
  await harness.runFrame(5);
  assert.equal(
    importCalls,
    1,
    "first queryable ingest frame should reuse the preloaded renderer implementation module",
  );

  await harness.runFrame(6);
  assert.equal(importCalls, 1);
  assert.equal(drawCalls, 3);
}

async function checkRuntimeDrawsProgressiveRendererWhenCreatedQueryable() {
  let drawCalls = 0;
  const coveredRange = { end: 120, start: 100, type: "covered_range", valid: true };
  const ingestWorker = {
    indexReader: {
      coveredRange() {
        return coveredRange;
      },
      status() {
        return { state: "ready" };
      },
    },
    status() {
      return { coveredRange, state: "running" };
    },
  };
  const harness = createRuntimeAppHarness({
    runAppOptions: {
      importProgressiveTraceRenderer: async () => ({
        createProgressiveTraceRenderer() {
          return {
            draw() {
              drawCalls += 1;
            },
          };
        },
      }),
      ingestWorker,
      instantiateWasmModuleForThread: async () => ({
        exports: makeAppExports(),
      }),
      worker: {
        Worker: FakeWorker,
      },
    },
  });

  await harness.boot();
  await harness.runFrame(1);
  await harness.runFrame(2);

  assert.equal(
    drawCalls,
    1,
    "queryable renderer creation should draw in the same frame",
  );
}

async function checkAppReadyWaitsForFirstFrameAndDeferredRenderer() {
  const performanceEntries = [];
  const performance = {
    mark(name) {
      performanceEntries.push({ kind: "mark", name });
    },
    measure(name, start, end) {
      performanceEntries.push({ kind: "measure", name, start, end });
    },
  };
  let resolveRendererImport;
  let rendererImportStarted = false;
  const rendererImport = new Promise((resolve) => {
    resolveRendererImport = resolve;
  });
  const harness = createRuntimeAppHarness({
    runAppOptions: {
      indexReader: false,
      preloadIngestDependencies: false,
      importProgressiveTraceRenderer: () => {
        rendererImportStarted = true;
        return rendererImport;
      },
      instantiateWasmModuleForThread: async () => ({
        exports: makeAppExports(),
      }),
      performance,
      worker: {
        Worker: FakeWorker,
      },
    },
  });

  await harness.boot();

  assert.equal(
    performanceEntries.some((entry) => entry.name === "tracy.core.ready"),
    true,
    "core readiness should remain on the tight startup path",
  );
  assert.equal(
    performanceEntries.some((entry) => entry.name === "tracy.app.ready"),
    false,
    "full readiness should not fire before the first frame",
  );
  assert.equal(
    rendererImportStarted,
    true,
    "deferred renderer import should start before the first frame",
  );

  await harness.runFrame(1);
  assert.equal(
    performanceEntries.some((entry) => entry.name === "tracy.app.ready"),
    false,
    "full readiness should wait for deferred renderer import",
  );

  resolveRendererImport({
    createProgressiveTraceRenderer() {
      throw new Error("not expected before queryable pages");
    },
  });
  await importRepoModule("host/trace-renderer-spec.mjs");
  await harness.flushRuntimeWork();
  assert.deepEqual(performanceEntries.slice(-2), [
    { kind: "mark", name: "tracy.app.ready" },
    {
      kind: "measure",
      name: "tracy.app.load",
      start: "tracy.bootstrap.start",
      end: "tracy.app.ready",
    },
  ]);
}

async function checkAppReadyFailsWhenDeferredRendererFails() {
  const performanceEntries = [];
  const previousError = globalThis.__TRACY_APP_LOAD_ERROR__;
  const previousConsoleError = console.error;
  const performance = {
    mark(name) {
      performanceEntries.push({ kind: "mark", name });
    },
    measure(name, start, end) {
      performanceEntries.push({ kind: "measure", name, start, end });
    },
  };

  globalThis.__TRACY_APP_LOAD_ERROR__ = "";
  console.error = () => {};
  const harness = createRuntimeAppHarness({
    runAppOptions: {
      indexReader: false,
      preloadIngestDependencies: false,
      importProgressiveTraceRenderer: async () => {
        throw new Error("deferred renderer unavailable");
      },
      instantiateWasmModuleForThread: async () => ({
        exports: makeAppExports(),
      }),
      performance,
      worker: {
        Worker: FakeWorker,
      },
    },
  });

  await harness.boot();
  await harness.runFrame(1);

  assert.equal(
    performanceEntries.some((entry) => entry.name === "tracy.app.ready"),
    false,
    "full readiness should not pass when deferred renderer import fails",
  );
  assert.equal(globalThis.__TRACY_APP_LOAD_ERROR__, "deferred renderer unavailable");
  globalThis.__TRACY_APP_LOAD_ERROR__ = previousError;
  console.error = previousConsoleError;
}

async function main() {
  await loadGeneratedIndexFormatSpec();
  await loadGeneratedTraceRendererSpec();
  await checkRuntimeOrchestratesWorker();
  await checkRuntimeStartsIngestFromFileSelection();
  await checkRuntimePreloadsIndexReaderBeforeWorkerPreloadSignal();
  await checkRuntimeSkipsLateWorkerPreloadAfterFileSelectionStart();
  await checkRuntimeIgnoresStaleIngestWorkerMessages();
  await checkFileSelectionSetupErrorsReportStatus();
  await checkMainThreadIndexReaderQueriesCommittedPages();
  await checkMainThreadIndexReaderRequiresCappedQueryMetadataExports();
  await checkMainThreadIndexReaderIgnoresStalePreloadExports();
  await checkMainThreadIndexReaderProbesStaleCatalogSize();
  await checkMainThreadCoveredRangeRereadsUnqueryablePartialPage();
  await checkMainThreadSliceCatalogReportsCapacityOverflow();
  await checkMainThreadIndexReaderFailsOnCatalogOverflow();
  await checkWorkerStatusReportsReaderCatalogOverflow();
  await checkWorkerCoveredRangeOpensReaderBeforeRangeIsValid();
  checkWatWriterPropagatesCatalogOverflow();
  await checkProgressiveTraceRendererDrawsCoveredPartialRows();
  await checkProgressiveTraceRendererClipsLeftEdgeSlices();
  await checkProgressiveTraceRendererClampsToSliceCatalogCoverage();
  await checkProgressiveTraceRendererSurfacesCappedQueries();
  await checkProgressiveTraceRendererTilesFullVisibleViewport();
  await checkProgressiveTraceRendererBoundsLargeViewportQueries();
  await checkProgressiveTraceRendererMarksSkippedTracksWhenBudgetExhausted();
  await checkProgressiveTraceRendererUsesWasmCanvasOpPlanner();
  await checkProgressiveTraceRendererClampsPanZoomAndDrawsUnknownRange();
  await checkRuntimePreloadsProgressiveTraceRendererImplementation();
  await checkRuntimeDrawsProgressiveRendererWhenCreatedQueryable();
  await checkAppReadyWaitsForFirstFrameAndDeferredRenderer();
  await checkAppReadyFailsWhenDeferredRendererFails();
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
