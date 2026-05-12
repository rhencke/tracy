"use strict";

const assert = require("node:assert/strict");
const {
  importRepoModule,
  makeFakeCanvas,
  makeFakeCanvasContext,
} = require("./browser-harness.js");

let INDEX_QUERY_RESULT_LAYOUT;
let TRACE_RENDERER_CANVAS_OPS;
let TRACE_RENDERER_INCOMPLETE_RANGE_LAYOUT;
let TEST_TRACE_RENDER_COMMAND;
let TEST_TRACE_RENDER_ROW_BYTES;
let TEST_TRACE_RENDER_RANGE_BYTES;

async function loadProgressiveRendererHarnessSpec() {
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

function requireProgressiveRendererHarnessSpec() {
  assert.notEqual(
    TEST_TRACE_RENDER_COMMAND,
    undefined,
    "progressive renderer harness spec must be loaded before use",
  );
}

function progressiveRendererHarnessSpec() {
  requireProgressiveRendererHarnessSpec();
  return {
    INDEX_QUERY_RESULT_LAYOUT,
    TEST_TRACE_RENDER_COMMAND,
    TEST_TRACE_RENDER_RANGE_BYTES,
    TEST_TRACE_RENDER_ROW_BYTES,
    TRACE_RENDERER_CANVAS_OPS,
    TRACE_RENDERER_INCOMPLETE_RANGE_LAYOUT,
  };
}

function writeTraceRenderRow(memory, ptr, row, index = 0) {
  requireProgressiveRendererHarnessSpec();
  const view = new DataView(memory.buffer);
  const base = ptr + index * TEST_TRACE_RENDER_ROW_BYTES;

  view.setUint32(base + INDEX_QUERY_RESULT_LAYOUT.START, row.start ?? 0, true);
  view.setUint32(base + INDEX_QUERY_RESULT_LAYOUT.DUR, row.dur ?? 0, true);
  view.setUint32(base + INDEX_QUERY_RESULT_LAYOUT.DEPTH, row.depth ?? 0, true);
  view.setUint32(base + INDEX_QUERY_RESULT_LAYOUT.COLOR, row.color ?? 0, true);
  view.setUint32(base + INDEX_QUERY_RESULT_LAYOUT.PARTIAL, row.partial ? 1 : 0, true);
}

function readTraceRenderRow(memory, ptr, index) {
  requireProgressiveRendererHarnessSpec();
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

function operationMatches(expected) {
  return (operation) =>
    Object.entries(expected).every(([key, value]) => operation[key] === value);
}

function makeTraceRenderPlannerExports(observed = {}) {
  requireProgressiveRendererHarnessSpec();
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

  function emitCommand(
    view,
    commandPtr,
    commandCap,
    tag,
    styleKind,
    styleValue,
    x,
    y,
    width,
    height,
    x2,
    y2,
  ) {
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

function createProgressiveRendererHarness(options = {}) {
  requireProgressiveRendererHarnessSpec();
  const memory = options.memory ?? new WebAssembly.Memory({ initial: 1 });
  const listeners = new Map();
  const operations = [];
  const queryCalls = [];
  let currentFrameAt = options.frameAt ?? 0;
  let coveredRange =
    options.coveredRange ?? { end: 200, start: 100, type: "covered_range", valid: true };
  let workerState = options.workerState ?? "running";
  let readerState = options.readerState ?? "ready";
  let trackCount = options.trackCount ?? 1;
  let sliceCoveredRange = options.sliceCoveredRange;
  let queryRows = options.queryRows ?? [];
  let queryResult = options.queryResult;
  const context = makeFakeCanvasContext({
    beginPath() {
      operations.push({ at: currentFrameAt, op: "beginPath" });
    },
    clearRect(x, y, width, height) {
      operations.push({ at: currentFrameAt, height, op: "clearRect", width, x, y });
    },
    clip() {
      operations.push({ at: currentFrameAt, op: "clip" });
    },
    fillRect(x, y, width, height) {
      operations.push({
        at: currentFrameAt,
        fillStyle: this.fillStyle ?? this.lastFillStyle,
        height,
        op: "fillRect",
        width,
        x,
        y,
      });
    },
    lineTo(x, y) {
      operations.push({ at: currentFrameAt, op: "lineTo", x, y });
    },
    moveTo(x, y) {
      operations.push({ at: currentFrameAt, op: "moveTo", x, y });
    },
    rect(x, y, width, height) {
      operations.push({ at: currentFrameAt, height, op: "rect", width, x, y });
    },
    restore() {
      operations.push({ at: currentFrameAt, op: "restore" });
    },
    save() {
      operations.push({ at: currentFrameAt, op: "save" });
    },
    stroke() {
      operations.push({
        at: currentFrameAt,
        op: "stroke",
        strokeStyle: this.strokeStyle,
      });
    },
  });
  const canvas = makeFakeCanvas({
    context,
    height: options.height ?? 120,
    width: options.width ?? 240,
    elementOverrides: {
      height: options.height ?? 120,
      width: options.width ?? 240,
      addEventListener(type, callback) {
        listeners.set(type, callback);
      },
      getContext(type) {
        assert.equal(type, "2d");
        return context;
      },
      releasePointerCapture() {},
      setPointerCapture() {},
      ...options.canvasOverrides,
    },
  });
  const reader = {
    queryRange(trackId, tsMin, tsMax, outPtr, maxRows) {
      const call = { maxRows, outPtr, trackId, tsMax, tsMin };

      queryCalls.push(call);

      if (typeof options.queryRange === "function") {
        return options.queryRange({ ...call, memory, writeTraceRenderRow });
      }

      queryRows.forEach((row, index) => {
        const resolvedRow =
          typeof row === "function" ? row({ ...call, index, memory }) : row;

        writeTraceRenderRow(memory, outPtr, resolvedRow, index);
      });
      if (queryResult !== undefined) {
        return queryResult;
      }
      return queryRows.length;
    },
    status() {
      return { state: readerState };
    },
    trackCount() {
      return trackCount;
    },
  };
  if (sliceCoveredRange !== undefined || options.readerCoveredRange === true) {
    reader.coveredRange = () => sliceCoveredRange;
  }
  const ingestWorker = {
    indexReader: reader,
    status() {
      return { coveredRange, state: workerState };
    },
  };

  function findOperation(expected) {
    return operations.find(operationMatches(expected));
  }

  function assertOperation(expected, message) {
    assert.notEqual(findOperation(expected), undefined, message);
  }

  return {
    canvas,
    context,
    ingestWorker,
    listeners,
    memory,
    operations,
    queryCalls,
    reader,
    assertOperation,
    assertOperationsInclude(expected, message) {
      assertOperation(expected, message);
    },
    assertQueryCalls(expected, message) {
      assert.deepEqual(queryCalls, expected, message);
    },
    clearOperations() {
      operations.length = 0;
    },
    findOperation,
    readTraceRenderRow(ptr, index) {
      return readTraceRenderRow(memory, ptr, index);
    },
    renderPlannerExports(observed = {}) {
      return makeTraceRenderPlannerExports({ memory, ...observed });
    },
    setCoveredRange(nextCoveredRange) {
      coveredRange = nextCoveredRange;
    },
    setFrameAt(nextFrameAt) {
      currentFrameAt = nextFrameAt;
    },
    setQueryResult(nextQueryResult) {
      queryResult = nextQueryResult;
    },
    setQueryRows(nextQueryRows) {
      queryRows = nextQueryRows;
    },
    setReaderState(nextReaderState) {
      readerState = nextReaderState;
    },
    setSliceCoveredRange(nextSliceCoveredRange) {
      sliceCoveredRange = nextSliceCoveredRange;
    },
    setTrackCount(nextTrackCount) {
      trackCount = nextTrackCount;
    },
    setWorkerState(nextWorkerState) {
      workerState = nextWorkerState;
    },
    status() {
      return {
        coveredRange,
        readerState,
        sliceCoveredRange,
        trackCount,
        workerState,
      };
    },
  };
}

module.exports = {
  createProgressiveRendererHarness,
  loadProgressiveRendererHarnessSpec,
  makeTraceRenderPlannerExports,
  progressiveRendererHarnessSpec,
  readTraceRenderRow,
  writeTraceRenderRow,
};
