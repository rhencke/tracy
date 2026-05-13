"use strict";

const DEFAULT_READINESS_POLL_INTERVAL_MS = 50;

function readinessFailureMessage(label, reason, state) {
  return `${label} ${reason}; readiness diagnostics=${JSON.stringify(state)}`;
}

async function waitForBrowserReadiness({
  collectState,
  failureReason,
  isReady,
  label,
  pollIntervalMs = DEFAULT_READINESS_POLL_INTERVAL_MS,
  timeoutMs,
}) {
  const start = Date.now();
  let state = {};

  while (Date.now() - start < timeoutMs) {
    state = await collectState();

    const reason = failureReason(state);
    if (reason !== null) {
      throw new Error(readinessFailureMessage(label, reason, state));
    }

    if (isReady(state)) {
      return state;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  state = await collectState();
  const reason = failureReason(state);
  if (reason !== null) {
    throw new Error(readinessFailureMessage(label, reason, state));
  }
  throw new Error(readinessFailureMessage(label, "timed out", state));
}

module.exports = {
  readinessFailureMessage,
  waitForBrowserReadiness,
};
