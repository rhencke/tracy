"use strict";

const {
  BROWSER_INGEST_STATE_KEY,
} = require("./browser-file-selection-page-helper.js");

const DRAW_TIMING_SAMPLE_LIMIT = 16;

function emptyDrawTimingSnapshot() {
  return {
    fillRectCount: 0,
    fillRectSamples: [],
    firstDrawAt: null,
    firstPresentedAt: null,
    frameDurationsSample: [],
    maxFrameDuration: 0,
  };
}

function drawTimingSnapshot(value = {}) {
  const snapshot = value ?? {};
  const fillRectSamples = Array.isArray(snapshot.fillRectSamples)
    ? snapshot.fillRectSamples
    : [];
  const frameDurations = Array.isArray(snapshot.frameDurations)
    ? snapshot.frameDurations
    : [];

  return {
    fillRectCount: snapshot.fillRectCount ?? 0,
    fillRectSamples: fillRectSamples.slice(0, DRAW_TIMING_SAMPLE_LIMIT),
    firstDrawAt: snapshot.firstDrawAt ?? null,
    firstPresentedAt: snapshot.firstPresentedAt ?? null,
    frameDurationsSample:
      snapshot.frameDurationsSample ??
      frameDurations.slice(0, DRAW_TIMING_SAMPLE_LIMIT),
    maxFrameDuration: snapshot.maxFrameDuration ?? 0,
  };
}

async function installBrowserDrawTimingInstrumentation(page) {
  await page.evaluateOnNewDocument((stateKey, sampleLimit) => {
    const state = globalThis[stateKey] ?? {};
    const drawTiming = {
      fillRectCount: 0,
      fillRectSamples: [],
      firstDrawAt: null,
      firstPresentedAt: null,
      frameDurations: [],
      maxFrameDuration: 0,
    };

    state.drawTiming = drawTiming;
    globalThis[stateKey] = state;
    const fileSelectionStarted = () =>
      state.fileSelection?.selectedAt !== null &&
      state.fileSelection?.selectedAt !== undefined;

    const requestAnimationFrame = globalThis.requestAnimationFrame.bind(globalThis);
    globalThis.requestAnimationFrame = (callback) =>
      requestAnimationFrame((timestamp) => {
        const startedAt = performance.now();
        try {
          return callback(timestamp);
        } finally {
          if (fileSelectionStarted()) {
            const duration = performance.now() - startedAt;
            drawTiming.frameDurations.push(duration);
            drawTiming.maxFrameDuration = Math.max(
              drawTiming.maxFrameDuration,
              duration,
            );
          }
        }
      });

    const fillRect = CanvasRenderingContext2D.prototype.fillRect;
    CanvasRenderingContext2D.prototype.fillRect = function instrumentedFillRect(
      x,
      y,
      width,
      height,
    ) {
      const result = fillRect.apply(this, arguments);
      if (this.canvas?.id === "tracy" && fileSelectionStarted()) {
        drawTiming.fillRectCount += 1;
        if (drawTiming.fillRectSamples.length < sampleLimit) {
          drawTiming.fillRectSamples.push({ height, width, x, y });
        }
      }
      if (
        this.canvas?.id === "tracy" &&
        fileSelectionStarted() &&
        drawTiming.firstDrawAt === null &&
        y > 0 &&
        height > 0 &&
        width > 0
      ) {
        drawTiming.firstDrawAt = performance.now();
        requestAnimationFrame(() => {
          drawTiming.firstPresentedAt ??= performance.now();
        });
      }
      return result;
    };
  }, BROWSER_INGEST_STATE_KEY, DRAW_TIMING_SAMPLE_LIMIT);
}

module.exports = {
  DRAW_TIMING_SAMPLE_LIMIT,
  drawTimingSnapshot,
  emptyDrawTimingSnapshot,
  installBrowserDrawTimingInstrumentation,
};
