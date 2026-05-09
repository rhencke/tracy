// Generated from abi/runtime.json, abi/layout.json, and abi/palette.json by tools/generate-runtime-spec.js.
// Do not edit host/trace-renderer-spec.mjs by hand.

export const TRACE_RENDERER_QUERY_DEFAULTS = Object.freeze({
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

export const TRACE_RENDERER_LAYOUT_DEFAULTS = Object.freeze({
  DEFAULT_MIN_VIEWPORT_SPAN: 1,
  DEFAULT_UNKNOWN_AFFORDANCE_WIDTH: 72,
  DEFAULT_UNKNOWN_STRIPE_SPACING: 8,
  DEFAULT_INCOMPLETE_QUERY_STRIPE_SPACING: 10,
});

export const TRACE_RENDERER_CANVAS_OPS = Object.freeze({
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

export const TRACE_RENDERER_INCOMPLETE_RANGE_LAYOUT = Object.freeze({
  BYTES: 12,
  START: 0,
  END: 4,
  TRACK_ID: 8,
});

export const TRACE_RENDERER_DRAW_DEFAULTS = Object.freeze({
  DEFAULT_CANVAS_WIDTH: 800,
  DEFAULT_CANVAS_HEIGHT: 400,
  DEFAULT_LANE_HEIGHT: 10,
  DEFAULT_LANE_GAP: 3,
  DEFAULT_TRACE_TOP: 18,
  DEFAULT_BAND_PADDING: 8,
  DEFAULT_PARTIAL_HATCH_SPACING: 6,
  DEFAULT_STROKE_WIDTH: 1,
});

export const TRACE_RENDERER_INTERACTION_DEFAULTS = Object.freeze({
  WHEEL_DELTA_MIN: -500,
  WHEEL_DELTA_MAX: 500,
  WHEEL_DELTA_SCALE: 0.001,
});

export const TRACE_RENDERER_COLOR_DEFAULTS = Object.freeze({
  RGB_COLOR_MASK: 16777215,
  RGB_HEX_WIDTH: 6,
});

export const TRACE_RENDERER_REQUIRED_EXPORTS = Object.freeze([
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

export const INDEX_QUERY_RESULT_LAYOUT = Object.freeze({
  BYTES: 28,
  START: 0,
  DUR: 4,
  NAME: 8,
  DEPTH: 12,
  CAT: 16,
  COLOR: 20,
  PARTIAL: 24,
});

export const TRACE_RENDERER_LOADER_BRIDGE = Object.freeze({
  API_METHODS: Object.freeze(["draw","panByPixels","zoomAtPixel"]),
  STATUS_METHOD: "status",
  LOADING_STATUS_FIELD: "loading",
  ERROR_STATUS_FIELD: "error",
});

export const TRACE_RENDERER_COLORS = Object.freeze({
  DEFAULT_SLICE_FILL: "#3f6ea8",
  TRACE_BACKGROUND_FILL: "rgba(251, 248, 244, 0.92)",
  PARTIAL_SLICE_FILL: "rgba(92, 109, 130, 0.58)",
  PARTIAL_HATCH_STROKE: "rgba(40, 45, 52, 0.35)",
  UNKNOWN_RANGE_FILL: "rgba(126, 134, 146, 0.18)",
  UNKNOWN_RANGE_STRIPE: "rgba(76, 85, 99, 0.38)",
  INCOMPLETE_QUERY_FILL: "rgba(180, 83, 9, 0.16)",
  INCOMPLETE_QUERY_STRIPE: "rgba(146, 64, 14, 0.42)",
});
