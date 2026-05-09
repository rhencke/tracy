// @generated trace-renderer-contract:start
const TRACE_RENDERER_QUERY_DEFAULTS = Object.freeze({
  DEFAULT_TRACE_QUERY_OUT_PTR: 12288,
  DEFAULT_TRACE_QUERY_WINDOW: 1000,
  DEFAULT_TRACE_QUERY_ROW_CAP: 1024,
  DEFAULT_TRACE_QUERY_RANGE_BUDGET: 64,
  DEFAULT_TRACE_RENDER_ROW_PTR: 65536,
  DEFAULT_TRACE_RENDER_ROW_CAP: 4096,
  DEFAULT_TRACE_RENDER_INCOMPLETE_RANGE_PTR: 196608,
  DEFAULT_TRACE_RENDER_INCOMPLETE_RANGE_CAP: 4096,
  DEFAULT_TRACE_RENDER_COMMAND_PTR: 262144,
  DEFAULT_TRACE_RENDER_COMMAND_CAP: 8192,
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
  DRAW_FILL_RECT_TAG: 3,
  DRAW_STROKE_LINE_TAG: 4,
  DRAW_CLEAR_RECT_TAG: 5,
  DRAW_HATCH_RECT_TAG: 6,
  TERMINATOR_OP_BUDGET: 1,
  DRAW_COMMAND_BYTES: 36,
  DRAW_COMMAND_TAG_OFFSET: 0,
  DRAW_COMMAND_STYLE_KIND_OFFSET: 4,
  DRAW_COMMAND_STYLE_VALUE_OFFSET: 8,
  DRAW_COMMAND_X_OFFSET: 12,
  DRAW_COMMAND_Y_OFFSET: 16,
  DRAW_COMMAND_WIDTH_OFFSET: 20,
  DRAW_COMMAND_HEIGHT_OFFSET: 24,
  DRAW_COMMAND_X2_OFFSET: 28,
  DRAW_COMMAND_Y2_OFFSET: 32,
  DRAW_STYLE_ROLE_KIND: 1,
  DRAW_STYLE_RGB_KIND: 2,
  DRAW_STYLE_ROLE_BACKGROUND: 1,
  DRAW_STYLE_ROLE_DEFAULT_SLICE: 2,
  DRAW_STYLE_ROLE_PARTIAL_SLICE: 3,
  DRAW_STYLE_ROLE_PARTIAL_HATCH: 4,
  DRAW_STYLE_ROLE_UNKNOWN_FILL: 5,
  DRAW_STYLE_ROLE_UNKNOWN_STRIPE: 6,
  DRAW_STYLE_ROLE_INCOMPLETE_FILL: 7,
  DRAW_STYLE_ROLE_INCOMPLETE_STRIPE: 8,
});

const TRACE_RENDERER_INCOMPLETE_RANGE_LAYOUT = Object.freeze({
  BYTES: 12,
  START: 0,
  END: 4,
  TRACK_ID: 8,
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

const TRACE_RENDERER_REQUIRED_EXPORTS = Object.freeze([
  "trace_render_append_query_rows",
  "trace_render_commands_begin",
  "trace_render_commands_overflow",
  "trace_render_plan_begin",
  "trace_render_plan_next",
  "trace_render_plan_op_end",
  "trace_render_plan_op_start",
  "trace_render_plan_op_track_id",
  "trace_render_query_ranges_per_track",
  "trace_render_query_tile_span",
  "trace_render_range_width",
  "trace_render_range_x",
  "trace_render_slice_end_x",
  "trace_render_slice_x",
  "trace_render_slice_y",
  "trace_render_stripe_end",
  "trace_render_stripe_start",
  "trace_render_unknown_width",
  "trace_render_unknown_x",
]);

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
  DEFAULT_TRACE_RENDER_COMMAND_CAP,
  DEFAULT_TRACE_RENDER_COMMAND_PTR,
  DEFAULT_TRACE_RENDER_INCOMPLETE_RANGE_CAP,
  DEFAULT_TRACE_RENDER_INCOMPLETE_RANGE_PTR,
  DEFAULT_TRACE_RENDER_ROW_CAP,
  DEFAULT_TRACE_RENDER_ROW_PTR,
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
  DRAW_CLEAR_RECT_TAG,
  DRAW_COMMAND_BYTES,
  DRAW_COMMAND_HEIGHT_OFFSET,
  DRAW_COMMAND_STYLE_KIND_OFFSET,
  DRAW_COMMAND_STYLE_VALUE_OFFSET,
  DRAW_COMMAND_TAG_OFFSET,
  DRAW_COMMAND_WIDTH_OFFSET,
  DRAW_COMMAND_X2_OFFSET,
  DRAW_COMMAND_X_OFFSET,
  DRAW_COMMAND_Y2_OFFSET,
  DRAW_COMMAND_Y_OFFSET,
  DRAW_FILL_RECT_TAG,
  DRAW_HATCH_RECT_TAG,
  DRAW_STROKE_LINE_TAG,
  DRAW_STYLE_RGB_KIND,
  DRAW_STYLE_ROLE_BACKGROUND,
  DRAW_STYLE_ROLE_DEFAULT_SLICE,
  DRAW_STYLE_ROLE_INCOMPLETE_FILL,
  DRAW_STYLE_ROLE_INCOMPLETE_STRIPE,
  DRAW_STYLE_ROLE_KIND,
  DRAW_STYLE_ROLE_PARTIAL_HATCH,
  DRAW_STYLE_ROLE_PARTIAL_SLICE,
  DRAW_STYLE_ROLE_UNKNOWN_FILL,
  DRAW_STYLE_ROLE_UNKNOWN_STRIPE,
  TERMINATOR_OP_BUDGET,
} = TRACE_RENDERER_CANVAS_OPS;
const {
  WHEEL_DELTA_MAX,
  WHEEL_DELTA_MIN,
  WHEEL_DELTA_SCALE,
} = TRACE_RENDERER_INTERACTION_DEFAULTS;
const {
  BYTES: TRACE_RENDER_INCOMPLETE_RANGE_BYTES,
  END: TRACE_RENDER_INCOMPLETE_RANGE_END_OFFSET,
  START: TRACE_RENDER_INCOMPLETE_RANGE_START_OFFSET,
  TRACK_ID: TRACE_RENDER_INCOMPLETE_RANGE_TRACK_ID_OFFSET,
} = TRACE_RENDERER_INCOMPLETE_RANGE_LAYOUT;
const CANVAS_OP = Object.freeze({
  END: TRACE_RENDERER_CANVAS_OPS.END_TAG,
  INCOMPLETE_QUERY_RANGE: "incomplete_query_range",
  INCOMPLETE_QUERY_RANGE_TAG: TRACE_RENDERER_CANVAS_OPS.INCOMPLETE_QUERY_RANGE_TAG,
  QUERY_RANGE: "query_range",
  QUERY_RANGE_TAG: TRACE_RENDERER_CANVAS_OPS.QUERY_RANGE_TAG,
});
const WASM_PAGE_SIZE_BYTES = 65536;
// This is intentionally a tiny VM boundary: Wasm owns renderer decisions and
// JS only replays opcodes against Canvas2D. The first opcode set uses primitive
// draw calls; future renderer work can add SQLite-style state and control
// instructions such as SetStyle, PushClip/PopClip, RepeatLine, or tile loops
// without moving layout policy back into JS.
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

function ensureMemoryRange(memory, ptr, byteLength, label) {
  const end = ptr + byteLength;

  if (
    !Number.isSafeInteger(ptr) ||
    !Number.isSafeInteger(byteLength) ||
    ptr < 0 ||
    byteLength < 0 ||
    end < ptr
  ) {
    throw new Error(`invalid ${label} memory range`);
  }

  if (end <= memory.buffer.byteLength) {
    return;
  }

  const pages = Math.ceil((end - memory.buffer.byteLength) / WASM_PAGE_SIZE_BYTES);
  try {
    memory.grow(pages);
  } catch (error) {
    throw new Error(
      `could not grow Wasm memory for ${label}: ${errorMessage(error)}`,
    );
  }

  if (end > memory.buffer.byteLength) {
    throw new Error(`Wasm memory remains too small for ${label}`);
  }
}

function writeTraceRenderIncompleteRanges(memory, ranges, ptr, cap) {
  if (ranges.length > cap) {
    throw new Error(`trace render incomplete range count ${ranges.length} exceeds command input cap ${cap}`);
  }

  ensureMemoryRange(
    memory,
    ptr,
    cap * TRACE_RENDER_INCOMPLETE_RANGE_BYTES,
    "trace render incomplete range input",
  );
  const view = new DataView(memory.buffer);

  for (let i = 0; i < ranges.length; i += 1) {
    const range = ranges[i];
    const base = ptr + i * TRACE_RENDER_INCOMPLETE_RANGE_BYTES;

    view.setUint32(
      base + TRACE_RENDER_INCOMPLETE_RANGE_START_OFFSET,
      Number(range.start) >>> 0,
      true,
    );
    view.setUint32(
      base + TRACE_RENDER_INCOMPLETE_RANGE_END_OFFSET,
      Number(range.end) >>> 0,
      true,
    );
    view.setUint32(
      base + TRACE_RENDER_INCOMPLETE_RANGE_TRACK_ID_OFFSET,
      Number(range.trackId) >>> 0,
      true,
    );
  }
}

function traceRenderCommandStyle(styleKind, styleValue, options) {
  if (styleKind === DRAW_STYLE_RGB_KIND) {
    return colorForSlice(styleValue);
  }

  if (styleKind !== DRAW_STYLE_ROLE_KIND) {
    throw new Error(`unknown trace render style kind ${styleKind}`);
  }

  switch (styleValue) {
    case DRAW_STYLE_ROLE_BACKGROUND:
      return options.backgroundFillStyle ?? TRACE_RENDERER_COLORS.TRACE_BACKGROUND_FILL;
    case DRAW_STYLE_ROLE_DEFAULT_SLICE:
      return TRACE_RENDERER_COLORS.DEFAULT_SLICE_FILL;
    case DRAW_STYLE_ROLE_PARTIAL_SLICE:
      return options.partialFillStyle ?? TRACE_RENDERER_COLORS.PARTIAL_SLICE_FILL;
    case DRAW_STYLE_ROLE_PARTIAL_HATCH:
      return TRACE_RENDERER_COLORS.PARTIAL_HATCH_STROKE;
    case DRAW_STYLE_ROLE_UNKNOWN_FILL:
      return options.unknownFillStyle ?? TRACE_RENDERER_COLORS.UNKNOWN_RANGE_FILL;
    case DRAW_STYLE_ROLE_UNKNOWN_STRIPE:
      return options.unknownStripeStyle ?? TRACE_RENDERER_COLORS.UNKNOWN_RANGE_STRIPE;
    case DRAW_STYLE_ROLE_INCOMPLETE_FILL:
      return options.incompleteQueryFillStyle ?? TRACE_RENDERER_COLORS.INCOMPLETE_QUERY_FILL;
    case DRAW_STYLE_ROLE_INCOMPLETE_STRIPE:
      return options.incompleteQueryStripeStyle ??
        TRACE_RENDERER_COLORS.INCOMPLETE_QUERY_STRIPE;
    default:
      throw new Error(`unknown trace render style role ${styleValue}`);
  }
}

function hatchTraceRenderRect(context, x, y, width, height, spacing) {
  const step = Math.max(1, spacing);

  context.save?.();
  context.beginPath?.();
  if (typeof context.rect === "function" && typeof context.clip === "function") {
    context.rect(x, y, width, height);
    context.clip();
  }

  for (let sx = x - height; sx < x + width + height; sx += step) {
    context.beginPath?.();
    context.moveTo?.(sx, y + height);
    context.lineTo?.(sx + height, y);
    context.stroke?.();
  }

  context.restore?.();
}

function replayTraceRenderCommands(context, memory, commandPtr, commandCount, options) {
  ensureMemoryRange(
    memory,
    commandPtr,
    commandCount * DRAW_COMMAND_BYTES,
    "trace render command output",
  );
  const view = new DataView(memory.buffer);

  for (let i = 0; i < commandCount; i += 1) {
    const base = commandPtr + i * DRAW_COMMAND_BYTES;
    const tag = view.getUint32(base + DRAW_COMMAND_TAG_OFFSET, true);
    const styleKind = view.getUint32(base + DRAW_COMMAND_STYLE_KIND_OFFSET, true);
    const styleValue = view.getUint32(base + DRAW_COMMAND_STYLE_VALUE_OFFSET, true);
    const x = view.getInt32(base + DRAW_COMMAND_X_OFFSET, true);
    const y = view.getInt32(base + DRAW_COMMAND_Y_OFFSET, true);
    const width = view.getInt32(base + DRAW_COMMAND_WIDTH_OFFSET, true);
    const height = view.getInt32(base + DRAW_COMMAND_HEIGHT_OFFSET, true);
    const x2 = view.getInt32(base + DRAW_COMMAND_X2_OFFSET, true);
    const y2 = view.getInt32(base + DRAW_COMMAND_Y2_OFFSET, true);

    if (tag === DRAW_CLEAR_RECT_TAG) {
      context.clearRect?.(x, y, width, height);
    } else if (tag === DRAW_FILL_RECT_TAG) {
      context.fillStyle = traceRenderCommandStyle(styleKind, styleValue, options);
      context.fillRect?.(x, y, width, height);
    } else if (tag === DRAW_STROKE_LINE_TAG) {
      context.strokeStyle = traceRenderCommandStyle(styleKind, styleValue, options);
      context.lineWidth = DEFAULT_STROKE_WIDTH;
      context.beginPath?.();
      context.moveTo?.(x, y);
      context.lineTo?.(x2, y2);
      context.stroke?.();
    } else if (tag === DRAW_HATCH_RECT_TAG) {
      context.strokeStyle = traceRenderCommandStyle(styleKind, styleValue, options);
      context.lineWidth = DEFAULT_STROKE_WIDTH;
      hatchTraceRenderRect(context, x, y, width, height, x2);
    } else {
      throw new Error(`unknown trace render command tag ${tag}`);
    }
  }
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

function requireTraceRenderExports(plannerExports) {
  const missing = TRACE_RENDERER_REQUIRED_EXPORTS.filter(
    (name) => typeof plannerExports?.[name] !== "function",
  );

  if (missing.length > 0) {
    throw new Error(`renderer planner missing required Wasm exports: ${missing.join(", ")}`);
  }
}

function createWasmCanvasOpPlanner(exports = null) {
  const plannerExports = exports ?? {};
  requireTraceRenderExports(plannerExports);

  function queryOps({ queryRangeBudget, queryWindow, trackCount, viewport }) {
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
        end: wasmNumber(plannerExports.trace_render_plan_op_end(), viewport.end),
        start: wasmNumber(plannerExports.trace_render_plan_op_start(), viewport.start),
        trackId: normalizedRowCap(
          plannerExports.trace_render_plan_op_track_id(),
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

  function appendQueryRows(sourcePtr, sourceCount, destPtr, destCount, destCap) {
    const appended = normalizedRowCap(
      plannerExports.trace_render_append_query_rows(
        sourcePtr,
        sourceCount,
        destPtr,
        destCount,
        destCap,
      ),
      0,
    );

    if (appended !== sourceCount) {
      throw new Error(
        `trace render row buffer accepted ${appended} of ${sourceCount} query rows`,
      );
    }

    return destCount + appended;
  }

  function renderCommands({
    bandPadding,
    canvasHeight,
    canvasWidth,
    commandCap,
    commandPtr,
    coveredEnd,
    incompleteCount,
    incompletePtr,
    incompleteQueryStripeSpacing,
    ingestActive,
    laneGap,
    laneHeight,
    partialHatchSpacing,
    rowCount,
    rowPtr,
    top,
    unknownAffordanceWidth,
    unknownStripeSpacing,
    viewport,
  }) {
    const count = normalizedRowCap(
      plannerExports.trace_render_commands_begin(
        commandPtr,
        commandCap,
        rowPtr,
        rowCount,
        incompletePtr,
        incompleteCount,
        viewport.start,
        viewport.end,
        coveredEnd,
        canvasWidth,
        canvasHeight,
        laneHeight,
        laneGap,
        top,
        bandPadding,
        ingestActive ? 1 : 0,
        partialHatchSpacing,
        unknownAffordanceWidth,
        unknownStripeSpacing,
        incompleteQueryStripeSpacing,
      ),
      0,
    );

    if (wasmNumber(plannerExports.trace_render_commands_overflow?.(), 0) !== 0) {
      throw new Error(`trace render command buffer exceeded cap ${commandCap}`);
    }

    return count;
  }

  return {
    appendQueryRows,
    queryOps,
    renderCommands,
  };
}

function isIngestActive(workerStatus) {
  return workerStatus?.state !== "complete" && workerStatus?.state !== "idle";
}

function drawTraceRows(
  memory,
  context,
  canvas,
  rowPtr,
  rowCount,
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
  const bandPadding = options.bandPadding ?? DEFAULT_BAND_PADDING;
  const incompletePtr = Number(
    options.renderIncompleteRangePtr ??
      DEFAULT_TRACE_RENDER_INCOMPLETE_RANGE_PTR,
  );
  const incompleteCap = normalizedRowCap(
    options.renderIncompleteRangeCap,
    DEFAULT_TRACE_RENDER_INCOMPLETE_RANGE_CAP,
  );
  const commandPtr = Number(options.renderCommandPtr ?? DEFAULT_TRACE_RENDER_COMMAND_PTR);
  const commandCap = normalizedPositiveInteger(
    options.renderCommandCap,
    DEFAULT_TRACE_RENDER_COMMAND_CAP,
  );
  const ingestActive = isIngestActive(workerStatus);

  writeTraceRenderIncompleteRanges(
    memory,
    incompleteQueryRanges,
    incompletePtr,
    incompleteCap,
  );
  ensureMemoryRange(
    memory,
    commandPtr,
    commandCap * DRAW_COMMAND_BYTES,
    "trace render command output",
  );

  const commandCount = renderPlanner.renderCommands({
    bandPadding,
    canvasHeight: height,
    canvasWidth: width,
    commandCap,
    commandPtr,
    coveredEnd: coveredRange.end,
    incompleteCount: incompleteQueryRanges.length,
    incompletePtr,
    incompleteQueryStripeSpacing:
      options.incompleteQueryStripeSpacing ??
      DEFAULT_INCOMPLETE_QUERY_STRIPE_SPACING,
    ingestActive,
    laneGap,
    laneHeight,
    partialHatchSpacing: options.hatchSpacing ?? DEFAULT_PARTIAL_HATCH_SPACING,
    rowCount,
    rowPtr,
    top,
    unknownAffordanceWidth:
      options.unknownAffordanceWidth ?? DEFAULT_UNKNOWN_AFFORDANCE_WIDTH,
    unknownStripeSpacing:
      options.unknownStripeSpacing ?? DEFAULT_UNKNOWN_STRIPE_SPACING,
    viewport,
  });

  context.save?.();
  replayTraceRenderCommands(context, memory, commandPtr, commandCount, options);
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
    );
  const state = {
    cappedQueries: [],
    drag: null,
    error: null,
    incompleteQueryRanges: [],
    lastRowCount: 0,
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
      return state.lastRowCount;
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
    const rowPtr = Number(options.renderRowPtr ?? DEFAULT_TRACE_RENDER_ROW_PTR);
    const rowCap = normalizedRowCap(
      options.renderRowCap,
      DEFAULT_TRACE_RENDER_ROW_CAP,
    );
    const queryRowBytes = readerQueryResultBytes(reader);
    if (queryRowBytes !== INDEX_QUERY_RESULT_LAYOUT.BYTES) {
      throw new Error(`unsupported trace query row size ${queryRowBytes}`);
    }
    ensureMemoryRange(
      memory,
      queryOutPtr,
      queryRowCap * queryRowBytes,
      "trace query output",
    );
    ensureMemoryRange(
      memory,
      rowPtr,
      rowCap * INDEX_QUERY_RESULT_LAYOUT.BYTES,
      "trace render row input",
    );
    let rowCount = 0;

    function appendQueryResult(op, rawResult) {
      const result = normalizeQueryResult(rawResult);
      const queryCount = normalizedRowCap(result.count, 0);

      rowCount = renderPlanner.appendQueryRows(
        queryOutPtr,
        queryCount,
        rowPtr,
        rowCount,
        rowCap,
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
        Math.min(queryRowCap, Math.max(0, rowCap - rowCount)),
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
      state.lastRowCount = rowCount;
      state.unknownRange = isIngestActive(workerStatus)
        ? { pending: true, start: coveredRange.end }
        : null;
      drawTraceRows(
        memory,
        context,
        canvas,
        rowPtr,
        rowCount,
        viewport,
        coveredRange,
        workerStatus,
        incompleteQueryRanges,
        renderPlanner,
        options,
      );
      return state.lastRowCount;
    }

    function failDraw(error) {
      state.error = errorMessage(error);
      options.onError?.(error);
      return state.lastRowCount;
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
        rows: state.lastRowCount,
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
