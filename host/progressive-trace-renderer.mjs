import { TRACE_RENDERER_COLORS } from "./palette.mjs";

const DEFAULT_TRACE_QUERY_OUT_PTR = 12288;
const DEFAULT_TRACE_QUERY_WINDOW = 1000;
const DEFAULT_TRACE_QUERY_ROW_CAP = 1024;
const DEFAULT_TRACE_QUERY_RANGE_BUDGET = 64;
const INDEX_QUERY_RESULT_BYTES = 28;
const INDEX_QUERY_RESULT_START_TS_OFFSET = 0;
const INDEX_QUERY_RESULT_DUR_OFFSET = 4;
const INDEX_QUERY_RESULT_DEPTH_OFFSET = 12;
const INDEX_QUERY_RESULT_COLOR_OFFSET = 20;
const INDEX_QUERY_RESULT_PARTIAL_OFFSET = 24;
const DEFAULT_MIN_VIEWPORT_SPAN = 1;
const DEFAULT_UNKNOWN_AFFORDANCE_WIDTH = 72;
const DEFAULT_INCOMPLETE_QUERY_STRIPE_SPACING = 10;

function globalValue(value) {
  return value instanceof WebAssembly.Global ? value.value : value;
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
    : `#${(rgb & 0xffffff).toString(16).padStart(6, "0")}`;
}

function readerQueryResultBytes(reader) {
  return Number(
    globalValue(reader?.exports?.()?.INDEX_QUERY_RESULT_BYTES ?? INDEX_QUERY_RESULT_BYTES),
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
      color: view.getUint32(ptr + INDEX_QUERY_RESULT_COLOR_OFFSET, true),
      dur: view.getUint32(ptr + INDEX_QUERY_RESULT_DUR_OFFSET, true),
      depth: view.getUint32(ptr + INDEX_QUERY_RESULT_DEPTH_OFFSET, true),
      partial:
        view.getUint32(ptr + INDEX_QUERY_RESULT_PARTIAL_OFFSET, true) !== 0,
      start: view.getUint32(ptr + INDEX_QUERY_RESULT_START_TS_OFFSET, true),
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

function drawPartialHatch(context, x, y, width, height, spacing) {
  context.save?.();
  context.beginPath?.();
  if (typeof context.rect === "function" && typeof context.clip === "function") {
    context.rect(x, y, width, height);
    context.clip();
  }
  context.strokeStyle = TRACE_RENDERER_COLORS.PARTIAL_HATCH_STROKE;
  context.lineWidth = 1;

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
  const spacing = options.unknownStripeSpacing ?? 8;

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
  context.lineWidth = 1;

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
  context.lineWidth = 1;

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
  options,
) {
  const width = canvasDimension(canvas, "width", 800);
  const height = canvasDimension(canvas, "height", 400);
  const laneHeight = options.laneHeight ?? 10;
  const laneGap = options.laneGap ?? 3;
  const top = options.top ?? 18;
  const maxDepth = rows.reduce((max, row) => Math.max(max, row.depth), 0);
  const bandHeight = Math.min(height, top + (maxDepth + 1) * (laneHeight + laneGap) + 8);
  const span = Math.max(1, viewport.end - viewport.start);
  const ingestActive = isIngestActive(workerStatus);

  context.save?.();
  context.clearRect?.(0, 0, width, bandHeight);
  context.fillStyle =
    options.backgroundFillStyle ?? TRACE_RENDERER_COLORS.TRACE_BACKGROUND_FILL;
  context.fillRect?.(0, 0, width, bandHeight);

  for (const row of rows) {
    const sliceEnd = Math.min(viewport.end, row.start + Math.max(1, row.dur));
    const x = Math.max(0, ((row.start - viewport.start) / span) * width);
    const endX = Math.min(width, ((sliceEnd - viewport.start) / span) * width);
    const sliceWidth = Math.max(1, endX - x);
    const y = top + row.depth * (laneHeight + laneGap);
    const showPartial = row.partial && ingestActive;

    context.fillStyle = showPartial
      ? (options.partialFillStyle ?? TRACE_RENDERER_COLORS.PARTIAL_SLICE_FILL)
      : colorForSlice(row.color);
    context.fillRect?.(x, y, sliceWidth, laneHeight);

    if (showPartial) {
      drawPartialHatch(context, x, y, sliceWidth, laneHeight, options.hatchSpacing ?? 6);
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
    const width = canvasDimension(canvas, "width", 800);
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
    const width = canvasDimension(canvas, "width", 800);
    const ratio = Math.min(1, Math.max(0, pixelX / Math.max(1, width)));
    const span = viewport.end - viewport.start;
    const factor = Math.exp(Math.max(-500, Math.min(500, deltaY)) * 0.001);
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
        eventCanvasX(canvas, event, canvasDimension(canvas, "width", 800)),
        event.deltaY ?? 0,
        coveredRange,
      );
      event.preventDefault?.();
    }, { passive: false });
  }

  installInteractions();

  function draw() {
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
    const viewportSpan = viewport.end - viewport.start;
    const queryRangesPerTrack = Math.max(
      1,
      Math.floor(queryRangeBudget / trackCount),
    );
    const queryTileSpan = Math.max(
      1,
      queryWindow,
      Math.ceil(viewportSpan / queryRangesPerTrack),
    );
    const cappedQueries = [];
    const incompleteQueryRanges = [];
    const rows = [];
    let queryRangeCount = 0;

    try {
      queryLoop:
      for (let trackId = 0; trackId < trackCount; trackId += 1) {
        for (
          let queryStart = viewport.start;
          queryStart < viewport.end;
          queryStart = Math.min(viewport.end, queryStart + queryTileSpan)
        ) {
          if (queryRangeCount >= queryRangeBudget) {
            break queryLoop;
          }
          const queryEnd = Math.min(viewport.end, queryStart + queryTileSpan);
          const result = normalizeQueryResult(
            reader.queryRange(
              trackId,
              queryStart,
              queryEnd,
              queryOutPtr,
              queryRowCap,
            ),
          );

          queryRangeCount += 1;
          rows.push(
            ...readQueryRows(memory, reader, queryOutPtr, result.count, trackId, options),
          );
          if (result.capped || result.matchedRows > result.writtenRows) {
            cappedQueries.push({
              matchedRows: result.matchedRows,
              trackId,
              writtenRows: result.writtenRows,
            });
            incompleteQueryRanges.push({
              end: queryEnd,
              start: queryStart,
              trackId,
            });
          }
        }
      }

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
        options,
      );
    } catch (error) {
      state.error = errorMessage(error);
      options.onError?.(error);
    }

    return state.lastRows;
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
