// @generated trace-renderer-contract:start
const TRACE_RENDERER_QUERY_DEFAULTS = Object.freeze({
  DEFAULT_TRACE_QUERY_OUT_PTR: 12288,
  DEFAULT_TRACE_QUERY_WINDOW: 1000,
  DEFAULT_TRACE_QUERY_ROW_CAP: 1024,
  DEFAULT_TRACE_QUERY_RANGE_BUDGET: 64,
});

const TRACE_RENDERER_LAYOUT_DEFAULTS = Object.freeze({
  DEFAULT_MIN_VIEWPORT_SPAN: 1,
  DEFAULT_UNKNOWN_AFFORDANCE_WIDTH: 72,
  DEFAULT_UNKNOWN_STRIPE_SPACING: 8,
  DEFAULT_INCOMPLETE_QUERY_STRIPE_SPACING: 10,
});

const TRACE_RENDERER_CANVAS_OPS = Object.freeze({
  END_TAG: 0,
  QUERY_RANGE_TAG: 1,
  INCOMPLETE_QUERY_RANGE_TAG: 2,
  TERMINATOR_OP_BUDGET: 1,
});

const TRACE_RENDERER_DRAW_DEFAULTS = Object.freeze({
  DEFAULT_CANVAS_WIDTH: 800,
  DEFAULT_CANVAS_HEIGHT: 400,
  DEFAULT_LANE_HEIGHT: 10,
  DEFAULT_LANE_GAP: 3,
  DEFAULT_TRACE_TOP: 18,
  DEFAULT_BAND_PADDING: 8,
  DEFAULT_PARTIAL_HATCH_SPACING: 6,
  DEFAULT_STROKE_WIDTH: 1,
});

const TRACE_RENDERER_INTERACTION_DEFAULTS = Object.freeze({
  WHEEL_DELTA_MIN: -500,
  WHEEL_DELTA_MAX: 500,
  WHEEL_DELTA_SCALE: 0.001,
});

const TRACE_RENDERER_COLOR_DEFAULTS = Object.freeze({
  RGB_COLOR_MASK: 16777215,
  RGB_HEX_WIDTH: 6,
});

const INDEX_QUERY_RESULT_LAYOUT = Object.freeze({
  BYTES: 28,
  START: 0,
  DUR: 4,
  NAME: 8,
  DEPTH: 12,
  CAT: 16,
  COLOR: 20,
  PARTIAL: 24,
});
// @generated trace-renderer-contract:end
const {
  DEFAULT_TRACE_QUERY_OUT_PTR,
  DEFAULT_TRACE_QUERY_RANGE_BUDGET,
  DEFAULT_TRACE_QUERY_ROW_CAP,
  DEFAULT_TRACE_QUERY_WINDOW,
} = TRACE_RENDERER_QUERY_DEFAULTS;
const {
  DEFAULT_INCOMPLETE_QUERY_STRIPE_SPACING,
  DEFAULT_MIN_VIEWPORT_SPAN,
  DEFAULT_UNKNOWN_AFFORDANCE_WIDTH,
  DEFAULT_UNKNOWN_STRIPE_SPACING,
} = TRACE_RENDERER_LAYOUT_DEFAULTS;
const {
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_BAND_PADDING,
  DEFAULT_LANE_GAP,
  DEFAULT_LANE_HEIGHT,
  DEFAULT_PARTIAL_HATCH_SPACING,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_TRACE_TOP,
} = TRACE_RENDERER_DRAW_DEFAULTS;
const {
  RGB_COLOR_MASK,
  RGB_HEX_WIDTH,
} = TRACE_RENDERER_COLOR_DEFAULTS;
const {
  TERMINATOR_OP_BUDGET,
} = TRACE_RENDERER_CANVAS_OPS;
const {
  WHEEL_DELTA_MAX,
  WHEEL_DELTA_MIN,
  WHEEL_DELTA_SCALE,
} = TRACE_RENDERER_INTERACTION_DEFAULTS;
const CANVAS_OP = Object.freeze({
  END: TRACE_RENDERER_CANVAS_OPS.END_TAG,
  INCOMPLETE_QUERY_RANGE: "incomplete_query_range",
  INCOMPLETE_QUERY_RANGE_TAG: TRACE_RENDERER_CANVAS_OPS.INCOMPLETE_QUERY_RANGE_TAG,
  QUERY_RANGE: "query_range",
  QUERY_RANGE_TAG: TRACE_RENDERER_CANVAS_OPS.QUERY_RANGE_TAG,
  SLICE_RECT: "slice_rect",
});
// Keep renderer colors inline so cold app-ready does not pay a second module
// fetch; tools/generate-runtime-spec.js checks this block against abi/palette.json.
const TRACE_RENDERER_COLORS = Object.freeze({
  DEFAULT_SLICE_FILL: "#3f6ea8",
  TRACE_BACKGROUND_FILL: "rgba(251, 248, 244, 0.92)",
  PARTIAL_SLICE_FILL: "rgba(92, 109, 130, 0.58)",
  PARTIAL_HATCH_STROKE: "rgba(40, 45, 52, 0.35)",
  UNKNOWN_RANGE_FILL: "rgba(126, 134, 146, 0.18)",
  UNKNOWN_RANGE_STRIPE: "rgba(76, 85, 99, 0.38)",
  INCOMPLETE_QUERY_FILL: "rgba(180, 83, 9, 0.16)",
  INCOMPLETE_QUERY_STRIPE: "rgba(146, 64, 14, 0.42)",
});

function globalValue(value) {
  return value instanceof WebAssembly.Global ? value.value : value;
}

function wasmNumber(value, fallback) {
  const numeric = Number(globalValue(value));

  return Number.isFinite(numeric) ? numeric : fallback;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function canvasDimension(canvas, property, fallback) {
  const suffix = `${property[0].toUpperCase()}${property.slice(1)}`;
  const value = canvas?.[property] ?? canvas?.[`client${suffix}`];

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function eventCanvasX(canvas, event, fallbackWidth) {
  const rect = canvas?.getBoundingClientRect?.();

  if (rect !== undefined) {
    return Math.min(
      fallbackWidth,
      Math.max(0, (event.clientX ?? 0) - (rect.left ?? 0)),
    );
  }

  return Math.min(fallbackWidth, Math.max(0, event.offsetX ?? 0));
}

function colorForSlice(color) {
  const rgb = Number(color) >>> 0;

  return rgb === 0
    ? TRACE_RENDERER_COLORS.DEFAULT_SLICE_FILL
    : `#${(rgb & RGB_COLOR_MASK).toString(16).padStart(RGB_HEX_WIDTH, "0")}`;
}

function readerQueryResultBytes(reader) {
  return Number(
    globalValue(
      reader?.exports?.()?.INDEX_QUERY_RESULT_BYTES ??
        INDEX_QUERY_RESULT_LAYOUT.BYTES,
    ),
  );
}

function normalizeRange(range) {
  if (!range?.valid || !Number.isFinite(range.start) || !Number.isFinite(range.end)) {
    return null;
  }
  if (range.end <= range.start) {
    return null;
  }

  return {
    end: Number(range.end),
    start: Number(range.start),
    valid: true,
  };
}

function intersectRanges(firstRange, secondRange) {
  const first = normalizeRange(firstRange);
  const second = normalizeRange(secondRange);

  if (first === null || second === null) {
    return null;
  }

  return normalizeRange({
    end: Math.min(first.end, second.end),
    start: Math.max(first.start, second.start),
    valid: true,
  });
}

function clampViewportToCovered(viewport, coveredRange, minSpan) {
  const covered = normalizeRange(coveredRange);

  if (covered === null) {
    return null;
  }

  const coveredSpan = covered.end - covered.start;
  const span = Math.min(
    coveredSpan,
    Math.max(minSpan, viewport === null ? coveredSpan : viewport.end - viewport.start),
  );
  const requestedStart = viewport === null ? covered.start : viewport.start;
  const start = Math.min(
    covered.end - span,
    Math.max(covered.start, requestedStart),
  );

  return {
    end: start + span,
    start,
    valid: true,
  };
}

function readQueryRows(memory, reader, outPtr, count, trackId, options) {
  if (typeof options.decodeQueryRows === "function") {
    return options.decodeQueryRows({ count, memory, outPtr, reader, trackId });
  }

  const view = new DataView(memory.buffer);
  const rowBytes = readerQueryResultBytes(reader);
  const rows = [];

  for (let i = 0; i < count; i += 1) {
    const ptr = outPtr + i * rowBytes;

    rows.push({
      color: view.getUint32(ptr + INDEX_QUERY_RESULT_LAYOUT.COLOR, true),
      dur: view.getUint32(ptr + INDEX_QUERY_RESULT_LAYOUT.DUR, true),
      depth: view.getUint32(ptr + INDEX_QUERY_RESULT_LAYOUT.DEPTH, true),
      partial:
        view.getUint32(ptr + INDEX_QUERY_RESULT_LAYOUT.PARTIAL, true) !== 0,
      start: view.getUint32(ptr + INDEX_QUERY_RESULT_LAYOUT.START, true),
      trackId,
    });
  }

  return rows;
}

function normalizeQueryResult(result) {
  if (typeof result === "number") {
    return {
      capped: false,
      count: result,
      matchedRows: result,
      writtenRows: result,
    };
  }

  return {
    capped: result?.capped === true,
    count: Number(result?.count ?? result?.writtenRows ?? 0),
    matchedRows: Number(result?.matchedRows ?? result?.count ?? 0),
    writtenRows: Number(result?.writtenRows ?? result?.count ?? 0),
  };
}

function isPromiseLike(value) {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    typeof value.then === "function"
  );
}

function normalizedRowCap(value, fallback) {
  const numeric = Number(value);

  return Number.isFinite(numeric) && numeric >= 0
    ? Math.floor(numeric)
    : fallback;
}

function normalizedPositiveInteger(value, fallback) {
  const numeric = Number(value);

  return Number.isFinite(numeric) && numeric > 0
    ? Math.floor(numeric)
    : fallback;
}

function appendSkippedQueryRanges(ranges, viewport, trackId, queryStart, trackCount) {
  const start = Math.max(viewport.start, queryStart);

  if (start < viewport.end) {
    ranges.push({
      end: viewport.end,
      start,
      trackId,
    });
  }

  for (let skippedTrackId = trackId + 1; skippedTrackId < trackCount; skippedTrackId += 1) {
    ranges.push({
      end: viewport.end,
      start: viewport.start,
      trackId: skippedTrackId,
    });
  }
}

const REQUIRED_TRACE_RENDER_EXPORTS = Object.freeze([
  "trace_render_plan_begin",
  "trace_render_plan_next",
  "trace_render_plan_op_end",
  "trace_render_plan_op_start",
  "trace_render_plan_op_track_id",
  "trace_render_query_ranges_per_track",
  "trace_render_query_tile_span",
  "trace_render_slice_end_x",
  "trace_render_slice_x",
  "trace_render_slice_y",
]);

function requireTraceRenderExports(plannerExports) {
  const missing = REQUIRED_TRACE_RENDER_EXPORTS.filter(
    (name) => typeof plannerExports?.[name] !== "function",
  );

  if (missing.length > 0) {
    throw new Error(`renderer planner missing required Wasm exports: ${missing.join(", ")}`);
  }
}

function createWasmCanvasOpPlanner(exports = null, options = {}) {
  const plannerExports = exports ?? {};
  const requireExports = options.requireExports === true;

  if (requireExports) {
    requireTraceRenderExports(plannerExports);
  }

  function queryRangesPerTrack(queryRangeBudget, trackCount) {
    const fallback = Math.max(1, Math.floor(queryRangeBudget / trackCount));

    if (typeof plannerExports.trace_render_query_ranges_per_track !== "function") {
      return fallback;
    }

    return normalizedPositiveInteger(
      plannerExports.trace_render_query_ranges_per_track(
        queryRangeBudget,
        trackCount,
      ),
      fallback,
    );
  }

  function queryTileSpan(viewportSpan, queryWindow, rangesPerTrack) {
    const fallback = Math.max(
      1,
      queryWindow,
      Math.ceil(viewportSpan / rangesPerTrack),
    );

    if (typeof plannerExports.trace_render_query_tile_span !== "function") {
      return fallback;
    }

    return Math.max(
      1,
      wasmNumber(
        plannerExports.trace_render_query_tile_span(
          viewportSpan,
          queryWindow,
          rangesPerTrack,
        ),
        fallback,
      ),
    );
  }

  function queryOps({ queryRangeBudget, queryWindow, trackCount, viewport }) {
    if (
      typeof plannerExports.trace_render_plan_begin === "function" &&
      typeof plannerExports.trace_render_plan_next === "function"
    ) {
      const ops = [];
      const maxOps = queryRangeBudget + trackCount + TERMINATOR_OP_BUDGET;

      plannerExports.trace_render_plan_begin(
        viewport.start,
        viewport.end,
        trackCount,
        queryRangeBudget,
        queryWindow,
      );
      for (let i = 0; i < maxOps; i += 1) {
        const tag = Number(plannerExports.trace_render_plan_next());

        if (tag === CANVAS_OP.END) {
          return ops;
        }

        const op = {
          end: wasmNumber(plannerExports.trace_render_plan_op_end?.(), viewport.end),
          start: wasmNumber(plannerExports.trace_render_plan_op_start?.(), viewport.start),
          trackId: normalizedRowCap(
            plannerExports.trace_render_plan_op_track_id?.(),
            0,
          ),
        };

        if (tag === CANVAS_OP.QUERY_RANGE_TAG) {
          ops.push({ ...op, op: CANVAS_OP.QUERY_RANGE });
        } else if (tag === CANVAS_OP.INCOMPLETE_QUERY_RANGE_TAG) {
          ops.push({ ...op, op: CANVAS_OP.INCOMPLETE_QUERY_RANGE });
        }
      }

      throw new Error("wasm trace render planner did not terminate");
    }

    const viewportSpan = viewport.end - viewport.start;
    const rangesPerTrack = queryRangesPerTrack(queryRangeBudget, trackCount);
    const tileSpan = queryTileSpan(viewportSpan, queryWindow, rangesPerTrack);
    const ops = [];
    let queryRangeCount = 0;

    queryLoop:
    for (let trackId = 0; trackId < trackCount; trackId += 1) {
      for (
        let queryStart = viewport.start;
        queryStart < viewport.end;
        queryStart = Math.min(viewport.end, queryStart + tileSpan)
      ) {
        if (queryRangeCount >= queryRangeBudget) {
          const skipped = [];
          appendSkippedQueryRanges(
            skipped,
            viewport,
            trackId,
            queryStart,
            trackCount,
          );
          for (const range of skipped) {
            ops.push({ ...range, op: CANVAS_OP.INCOMPLETE_QUERY_RANGE });
          }
          break queryLoop;
        }

        const queryEnd = Math.min(viewport.end, queryStart + tileSpan);
        ops.push({
          end: queryEnd,
          op: CANVAS_OP.QUERY_RANGE,
          start: queryStart,
          trackId,
        });
        queryRangeCount += 1;
      }
    }

    return ops;
  }

  function rowCanvasOp({ height, laneGap, laneHeight, row, span, top, viewport, width }) {
    const sliceEnd = Math.min(viewport.end, row.start + Math.max(1, row.dur));
    const fallbackX = Math.max(0, ((row.start - viewport.start) / span) * width);
    const fallbackEndX = Math.min(width, ((sliceEnd - viewport.start) / span) * width);
    const fallbackY = top + row.depth * (laneHeight + laneGap);
    const x = typeof plannerExports.trace_render_slice_x === "function"
      ? wasmNumber(
        plannerExports.trace_render_slice_x(row.start, viewport.start, span, width),
        fallbackX,
      )
      : fallbackX;
    const endX = typeof plannerExports.trace_render_slice_end_x === "function"
      ? wasmNumber(
        plannerExports.trace_render_slice_end_x(sliceEnd, viewport.start, span, width),
        fallbackEndX,
      )
      : fallbackEndX;
    const y = typeof plannerExports.trace_render_slice_y === "function"
      ? wasmNumber(
        plannerExports.trace_render_slice_y(row.depth, top, laneHeight, laneGap),
        fallbackY,
      )
      : fallbackY;
    const clippedX = Math.min(width, Math.max(0, x));
    const clippedEndX = Math.min(width, Math.max(clippedX, endX));

    return {
      height,
      op: CANVAS_OP.SLICE_RECT,
      width: Math.max(1, clippedEndX - clippedX),
      x: clippedX,
      y,
    };
  }

  return {
    queryOps,
    rowCanvasOp,
  };
}

function drawPartialHatch(context, x, y, width, height, spacing) {
  context.save?.();
  context.beginPath?.();
  if (typeof context.rect === "function" && typeof context.clip === "function") {
    context.rect(x, y, width, height);
    context.clip();
  }
  context.strokeStyle = TRACE_RENDERER_COLORS.PARTIAL_HATCH_STROKE;
  context.lineWidth = DEFAULT_STROKE_WIDTH;

  for (let sx = x - height; sx < x + width + height; sx += spacing) {
    context.beginPath?.();
    context.moveTo?.(sx, y + height);
    context.lineTo?.(sx + height, y);
    context.stroke?.();
  }

  context.restore?.();
}

function drawUnknownRangeAffordance(context, width, bandHeight, options) {
  const affordanceWidth = Math.min(
    width,
    options.unknownAffordanceWidth ?? DEFAULT_UNKNOWN_AFFORDANCE_WIDTH,
  );
  const x = width - affordanceWidth;
  const spacing = options.unknownStripeSpacing ?? DEFAULT_UNKNOWN_STRIPE_SPACING;

  context.save?.();
  context.fillStyle =
    options.unknownFillStyle ?? TRACE_RENDERER_COLORS.UNKNOWN_RANGE_FILL;
  context.fillRect?.(x, 0, affordanceWidth, bandHeight);
  context.beginPath?.();
  if (typeof context.rect === "function" && typeof context.clip === "function") {
    context.rect(x, 0, affordanceWidth, bandHeight);
    context.clip();
  }
  context.strokeStyle =
    options.unknownStripeStyle ?? TRACE_RENDERER_COLORS.UNKNOWN_RANGE_STRIPE;
  context.lineWidth = DEFAULT_STROKE_WIDTH;

  for (let sx = x - bandHeight; sx < width + bandHeight; sx += spacing) {
    context.beginPath?.();
    context.moveTo?.(sx, bandHeight);
    context.lineTo?.(sx + bandHeight, 0);
    context.stroke?.();
  }

  context.restore?.();
}

function drawIncompleteQueryAffordances(context, width, bandHeight, viewport, ranges, options) {
  if (ranges.length === 0) {
    return;
  }

  const span = Math.max(1, viewport.end - viewport.start);
  const spacing = options.incompleteQueryStripeSpacing ??
    DEFAULT_INCOMPLETE_QUERY_STRIPE_SPACING;

  context.save?.();
  context.fillStyle =
    options.incompleteQueryFillStyle ?? TRACE_RENDERER_COLORS.INCOMPLETE_QUERY_FILL;
  context.strokeStyle =
    options.incompleteQueryStripeStyle ??
    TRACE_RENDERER_COLORS.INCOMPLETE_QUERY_STRIPE;
  context.lineWidth = DEFAULT_STROKE_WIDTH;

  for (const range of ranges) {
    const start = Math.max(viewport.start, range.start);
    const end = Math.min(viewport.end, range.end);

    if (end <= start) {
      continue;
    }

    const x = Math.max(0, ((start - viewport.start) / span) * width);
    const endX = Math.min(width, ((end - viewport.start) / span) * width);
    const rangeWidth = Math.max(1, endX - x);

    context.fillRect?.(x, 0, rangeWidth, bandHeight);
    context.save?.();
    context.beginPath?.();
    if (typeof context.rect === "function" && typeof context.clip === "function") {
      context.rect(x, 0, rangeWidth, bandHeight);
      context.clip();
    }

    for (let sx = x - bandHeight; sx < x + rangeWidth + bandHeight; sx += spacing) {
      context.beginPath?.();
      context.moveTo?.(sx, bandHeight);
      context.lineTo?.(sx + bandHeight, 0);
      context.stroke?.();
    }
    context.restore?.();
  }

  context.restore?.();
}

function isIngestActive(workerStatus) {
  return workerStatus?.state !== "complete" && workerStatus?.state !== "idle";
}

function drawTraceRows(
  context,
  canvas,
  rows,
  viewport,
  coveredRange,
  workerStatus,
  incompleteQueryRanges,
  renderPlanner,
  options,
) {
  const width = canvasDimension(canvas, "width", DEFAULT_CANVAS_WIDTH);
  const height = canvasDimension(canvas, "height", DEFAULT_CANVAS_HEIGHT);
  const laneHeight = options.laneHeight ?? DEFAULT_LANE_HEIGHT;
  const laneGap = options.laneGap ?? DEFAULT_LANE_GAP;
  const top = options.top ?? DEFAULT_TRACE_TOP;
  const maxDepth = rows.reduce((max, row) => Math.max(max, row.depth), 0);
  const bandHeight = Math.min(
    height,
    top + (maxDepth + 1) * (laneHeight + laneGap) + DEFAULT_BAND_PADDING,
  );
  const span = Math.max(1, viewport.end - viewport.start);
  const ingestActive = isIngestActive(workerStatus);

  context.save?.();
  context.clearRect?.(0, 0, width, bandHeight);
  context.fillStyle =
    options.backgroundFillStyle ?? TRACE_RENDERER_COLORS.TRACE_BACKGROUND_FILL;
  context.fillRect?.(0, 0, width, bandHeight);

  for (const row of rows) {
    const sliceRect = renderPlanner.rowCanvasOp({
      height: laneHeight,
      laneGap,
      laneHeight,
      row,
      span,
      top,
      viewport,
      width,
    });
    const showPartial = row.partial && ingestActive;

    context.fillStyle = showPartial
      ? (options.partialFillStyle ?? TRACE_RENDERER_COLORS.PARTIAL_SLICE_FILL)
      : colorForSlice(row.color);
    context.fillRect?.(sliceRect.x, sliceRect.y, sliceRect.width, sliceRect.height);

    if (showPartial) {
      drawPartialHatch(
        context,
        sliceRect.x,
        sliceRect.y,
        sliceRect.width,
        sliceRect.height,
        options.hatchSpacing ?? DEFAULT_PARTIAL_HATCH_SPACING,
      );
    }
  }

  drawIncompleteQueryAffordances(
    context,
    width,
    bandHeight,
    viewport,
    incompleteQueryRanges,
    options,
  );

  if (coveredRange.end <= viewport.end && ingestActive) {
    drawUnknownRangeAffordance(context, width, bandHeight, options);
  }

  context.restore?.();
}

export function createProgressiveTraceRenderer(memory, ingestWorker, options = {}) {
  const documentRef = options.document ?? globalThis.document;
  const canvas = options.canvas ?? documentRef?.getElementById?.("tracy");
  const context = options.context ?? canvas?.getContext?.("2d");
  const queryOutPtr = options.queryOutPtr ?? DEFAULT_TRACE_QUERY_OUT_PTR;
  const queryWindow = options.queryWindow ?? DEFAULT_TRACE_QUERY_WINDOW;
  const queryRowCap = normalizedRowCap(
    options.queryRowCap,
    DEFAULT_TRACE_QUERY_ROW_CAP,
  );
  const queryRangeBudget = normalizedPositiveInteger(
    options.queryRangeBudget,
    DEFAULT_TRACE_QUERY_RANGE_BUDGET,
  );
  const minViewportSpan = options.minViewportSpan ?? DEFAULT_MIN_VIEWPORT_SPAN;
  const renderPlanner = options.renderPlanner ??
    createWasmCanvasOpPlanner(
      options.renderPlannerExports,
      { requireExports: true },
    );
  const state = {
    cappedQueries: [],
    drag: null,
    error: null,
    incompleteQueryRanges: [],
    lastRows: [],
    unknownRange: null,
    userInteracted: false,
    viewport: normalizeRange(options.initialViewport),
  };
  let pendingDraw = null;

  function currentCoveredRange(reader, readerStatus, workerStatus) {
    const workerRange = normalizeRange(workerStatus.coveredRange);

    if (readerStatus.state !== "ready" || typeof reader?.coveredRange !== "function") {
      return workerRange;
    }

    const sliceRange = normalizeRange(reader.coveredRange());

    if (workerRange === null) {
      return sliceRange;
    }

    return intersectRanges(workerRange, sliceRange);
  }

  function setViewport(nextViewport, coveredRange) {
    state.viewport = clampViewportToCovered(
      nextViewport,
      coveredRange,
      minViewportSpan,
    );
    return state.viewport;
  }

  function panByPixels(deltaX, coveredRange) {
    state.userInteracted = true;
    const viewport = setViewport(state.viewport, coveredRange);
    const width = canvasDimension(canvas, "width", DEFAULT_CANVAS_WIDTH);
    const span = viewport.end - viewport.start;
    const timeDelta = (deltaX / Math.max(1, width)) * span;

    return setViewport({
      end: viewport.end - timeDelta,
      start: viewport.start - timeDelta,
      valid: true,
    }, coveredRange);
  }

  function zoomAtPixel(pixelX, deltaY, coveredRange) {
    state.userInteracted = true;
    const viewport = setViewport(state.viewport, coveredRange);
    const width = canvasDimension(canvas, "width", DEFAULT_CANVAS_WIDTH);
    const ratio = Math.min(1, Math.max(0, pixelX / Math.max(1, width)));
    const span = viewport.end - viewport.start;
    const factor = Math.exp(
      Math.max(WHEEL_DELTA_MIN, Math.min(WHEEL_DELTA_MAX, deltaY)) *
        WHEEL_DELTA_SCALE,
    );
    const nextSpan = Math.max(minViewportSpan, span * factor);
    const focus = viewport.start + ratio * span;

    return setViewport({
      end: focus + (1 - ratio) * nextSpan,
      start: focus - ratio * nextSpan,
      valid: true,
    }, coveredRange);
  }

  function coveredRangeForInteraction() {
    const reader = options.indexReader ?? ingestWorker?.indexReader;
    const workerStatus = ingestWorker?.status?.() ?? {};
    const readerStatus = reader?.status?.() ?? {};

    return currentCoveredRange(reader, readerStatus, workerStatus);
  }

  function installInteractions() {
    if (options.interactions === false || typeof canvas?.addEventListener !== "function") {
      return;
    }

    canvas.addEventListener("pointerdown", (event) => {
      const coveredRange = coveredRangeForInteraction();

      if (coveredRange === null || event.button !== 0) {
        return;
      }

      canvas.setPointerCapture?.(event.pointerId);
      state.drag = {
        lastX: event.clientX ?? 0,
        pointerId: event.pointerId,
      };
      event.preventDefault?.();
    });
    canvas.addEventListener("pointermove", (event) => {
      if (state.drag === null || state.drag.pointerId !== event.pointerId) {
        return;
      }

      const coveredRange = coveredRangeForInteraction();
      const nextX = event.clientX ?? state.drag.lastX;

      if (coveredRange !== null) {
        panByPixels(nextX - state.drag.lastX, coveredRange);
      }
      state.drag.lastX = nextX;
      event.preventDefault?.();
    });
    for (const type of ["pointerup", "pointercancel"]) {
      canvas.addEventListener(type, (event) => {
        if (state.drag?.pointerId === event.pointerId) {
          canvas.releasePointerCapture?.(event.pointerId);
          state.drag = null;
        }
      });
    }
    canvas.addEventListener("wheel", (event) => {
      const coveredRange = coveredRangeForInteraction();

      if (coveredRange === null) {
        return;
      }

      zoomAtPixel(
        eventCanvasX(
          canvas,
          event,
          canvasDimension(canvas, "width", DEFAULT_CANVAS_WIDTH),
        ),
        event.deltaY ?? 0,
        coveredRange,
      );
      event.preventDefault?.();
    }, { passive: false });
  }

  installInteractions();

  function drawOnce() {
    const reader = options.indexReader ?? ingestWorker?.indexReader;
    const workerStatus = ingestWorker?.status?.() ?? {};
    const readerStatus = reader?.status?.() ?? {};
    const coveredRange = currentCoveredRange(reader, readerStatus, workerStatus);

    if (
      context === undefined ||
      context === null ||
      readerStatus.state !== "ready" ||
      coveredRange === null
    ) {
      return state.lastRows;
    }

    const viewport = setViewport(
      state.userInteracted ? state.viewport : coveredRange,
      coveredRange,
    );
    const trackCount = Math.max(
      1,
      Number(options.trackCount ?? reader.trackCount?.() ?? 0),
    );
    const cappedQueries = [];
    const incompleteQueryRanges = [];
    const rows = [];

    function appendQueryResult(op, rawResult) {
      const result = normalizeQueryResult(rawResult);

      rows.push(
        ...readQueryRows(
          memory,
          reader,
          queryOutPtr,
          result.count,
          op.trackId,
          options,
        ),
      );
      if (result.capped || result.matchedRows > result.writtenRows) {
        cappedQueries.push({
          matchedRows: result.matchedRows,
          trackId: op.trackId,
          writtenRows: result.writtenRows,
        });
        incompleteQueryRanges.push({
          end: op.end,
          start: op.start,
          trackId: op.trackId,
        });
      }
    }

    function runQuery(op) {
      const result = reader.queryRange(
        op.trackId,
        op.start,
        op.end,
        queryOutPtr,
        queryRowCap,
      );

      if (isPromiseLike(result)) {
        return result.then((resolved) => appendQueryResult(op, resolved));
      }

      appendQueryResult(op, result);
      return null;
    }

    function finishDraw() {
      state.error = null;
      state.cappedQueries = cappedQueries;
      state.incompleteQueryRanges = incompleteQueryRanges;
      state.lastRows = rows;
      state.unknownRange = isIngestActive(workerStatus)
        ? { pending: true, start: coveredRange.end }
        : null;
      drawTraceRows(
        context,
        canvas,
        rows,
        viewport,
        coveredRange,
        workerStatus,
        incompleteQueryRanges,
        renderPlanner,
        options,
      );
      return state.lastRows;
    }

    function failDraw(error) {
      state.error = errorMessage(error);
      options.onError?.(error);
      return state.lastRows;
    }

    try {
      let pendingQueries = null;

      for (const op of renderPlanner.queryOps({
        queryRangeBudget,
        queryWindow,
        trackCount,
        viewport,
      })) {
        if (op.op === CANVAS_OP.INCOMPLETE_QUERY_RANGE) {
          incompleteQueryRanges.push({
            end: op.end,
            start: op.start,
            trackId: op.trackId,
          });
          continue;
        }
        if (op.op === CANVAS_OP.QUERY_RANGE) {
          if (pendingQueries !== null) {
            pendingQueries = pendingQueries.then(() => runQuery(op));
            continue;
          }

          const maybePendingQuery = runQuery(op);
          if (isPromiseLike(maybePendingQuery)) {
            pendingQueries = maybePendingQuery;
          }
        }
      }

      return pendingQueries === null
        ? finishDraw()
        : pendingQueries.then(finishDraw, failDraw);
    } catch (error) {
      return failDraw(error);
    }
  }

  function draw() {
    if (pendingDraw !== null) {
      return pendingDraw;
    }

    const result = drawOnce();
    if (!isPromiseLike(result)) {
      return result;
    }

    pendingDraw = result.finally(() => {
      pendingDraw = null;
    });
    return pendingDraw;
  }

  return {
    draw,
    panByPixels,
    status() {
      return {
        cappedQueries: state.cappedQueries,
        error: state.error,
        incompleteQueryRanges: state.incompleteQueryRanges,
        rows: state.lastRows.length,
        unknownRange: state.unknownRange,
        userInteracted: state.userInteracted,
        viewport: state.viewport,
      };
    },
    zoomAtPixel,
  };
}

export const __test = Object.freeze({
  CANVAS_OP,
  createWasmCanvasOpPlanner,
});
