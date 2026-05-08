// Generated from abi/palette.json by tools/generate-palette-spec.js.
// Do not edit host/palette.mjs by hand.

export const APP_SHELL_COLORS = Object.freeze({
  APP_SHELL_BACKGROUND: "#fbf8f4",
  ERROR_TEXT: "#1f1b16",
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

export const PALETTE_CONTRAST_REQUIREMENTS = Object.freeze(
  [
    {
      "background": "default.appShell.APP_SHELL_BACKGROUND",
      "foreground": "default.appShell.ERROR_TEXT",
      "minimumRatio": 7,
      "description": "Fallback errors are text and should meet enhanced contrast."
    },
    {
      "background": "default.appShell.APP_SHELL_BACKGROUND",
      "foreground": "default.traceRenderer.DEFAULT_SLICE_FILL",
      "minimumRatio": 3,
      "description": "Default slices are non-text graphical marks."
    }
  ],
);
