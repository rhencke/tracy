const DEFAULT_TRACE_QUERY_OUT_PTR = 12288;
const DEFAULT_TRACE_QUERY_WINDOW = 1000;
const INDEX_QUERY_RESULT_BYTES = 28;
const INDEX_QUERY_RESULT_START_TS_OFFSET = 0;
const INDEX_QUERY_RESULT_DUR_OFFSET = 4;
const INDEX_QUERY_RESULT_DEPTH_OFFSET = 12;
const INDEX_QUERY_RESULT_COLOR_OFFSET = 20;
const INDEX_QUERY_RESULT_PARTIAL_OFFSET = 24;

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

function colorForSlice(color) {
  const rgb = Number(color) >>> 0;

  return rgb === 0 ? "#3f6ea8" : `#${(rgb & 0xffffff).toString(16).padStart(6, "0")}`;
}

function readerQueryResultBytes(reader) {
  return Number(
    globalValue(reader?.exports?.()?.INDEX_QUERY_RESULT_BYTES ?? INDEX_QUERY_RESULT_BYTES),
  );
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

function drawPartialHatch(context, x, y, width, height, spacing) {
  context.save?.();
  context.beginPath?.();
  if (typeof context.rect === "function" && typeof context.clip === "function") {
    context.rect(x, y, width, height);
    context.clip();
  }
  context.strokeStyle = "rgba(40, 45, 52, 0.35)";
  context.lineWidth = 1;

  for (let sx = x - height; sx < x + width + height; sx += spacing) {
    context.beginPath?.();
    context.moveTo?.(sx, y + height);
    context.lineTo?.(sx + height, y);
    context.stroke?.();
  }

  context.restore?.();
}

function drawTraceRows(context, canvas, rows, coveredRange, options) {
  const width = canvasDimension(canvas, "width", 800);
  const height = canvasDimension(canvas, "height", 400);
  const laneHeight = options.laneHeight ?? 10;
  const laneGap = options.laneGap ?? 3;
  const top = options.top ?? 18;
  const maxDepth = rows.reduce((max, row) => Math.max(max, row.depth), 0);
  const bandHeight = Math.min(height, top + (maxDepth + 1) * (laneHeight + laneGap) + 8);
  const span = Math.max(1, coveredRange.end - coveredRange.start);

  context.save?.();
  context.clearRect?.(0, 0, width, bandHeight);
  context.fillStyle = options.backgroundFillStyle ?? "rgba(251, 248, 244, 0.92)";
  context.fillRect?.(0, 0, width, bandHeight);

  for (const row of rows) {
    const sliceEnd = Math.min(coveredRange.end, row.start + Math.max(1, row.dur));
    const x = Math.max(0, ((row.start - coveredRange.start) / span) * width);
    const endX = Math.min(width, ((sliceEnd - coveredRange.start) / span) * width);
    const sliceWidth = Math.max(1, endX - x);
    const y = top + row.depth * (laneHeight + laneGap);

    context.fillStyle = row.partial
      ? (options.partialFillStyle ?? "rgba(92, 109, 130, 0.58)")
      : colorForSlice(row.color);
    context.fillRect?.(x, y, sliceWidth, laneHeight);

    if (row.partial) {
      drawPartialHatch(context, x, y, sliceWidth, laneHeight, options.hatchSpacing ?? 6);
    }
  }

  context.restore?.();
}

export function createProgressiveTraceRenderer(memory, ingestWorker, options = {}) {
  const documentRef = options.document ?? globalThis.document;
  const canvas = options.canvas ?? documentRef?.getElementById?.("tracy");
  const context = options.context ?? canvas?.getContext?.("2d");
  const queryOutPtr = options.queryOutPtr ?? DEFAULT_TRACE_QUERY_OUT_PTR;
  const queryWindow = options.queryWindow ?? DEFAULT_TRACE_QUERY_WINDOW;
  const state = {
    error: null,
    lastRows: [],
  };

  function draw() {
    const reader = options.indexReader ?? ingestWorker?.indexReader;
    const workerStatus = ingestWorker?.status?.() ?? {};
    const readerStatus = reader?.status?.() ?? {};
    const coveredRange =
      workerStatus.coveredRange ??
      (readerStatus.state === "ready" ? reader?.coveredRange?.() : null);

    if (
      context === undefined ||
      context === null ||
      readerStatus.state !== "ready" ||
      !coveredRange?.valid ||
      coveredRange.end <= coveredRange.start
    ) {
      return state.lastRows;
    }

    const queryEnd = Math.min(
      coveredRange.end,
      coveredRange.start + Math.max(1, queryWindow),
    );
    const trackCount = Math.max(
      1,
      Number(options.trackCount ?? reader.trackCount?.() ?? 0),
    );
    const rows = [];

    try {
      for (let trackId = 0; trackId < trackCount; trackId += 1) {
        const count = reader.queryRange(trackId, coveredRange.start, queryEnd, queryOutPtr);
        rows.push(
          ...readQueryRows(memory, reader, queryOutPtr, count, trackId, options),
        );
      }

      state.error = null;
      state.lastRows = rows;
      if (rows.length > 0) {
        drawTraceRows(context, canvas, rows, coveredRange, options);
      }
    } catch (error) {
      state.error = errorMessage(error);
      options.onError?.(error);
    }

    return state.lastRows;
  }

  return {
    draw,
    status() {
      return {
        error: state.error,
        rows: state.lastRows.length,
      };
    },
  };
}
