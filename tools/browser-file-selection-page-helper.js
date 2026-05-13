"use strict";

const BROWSER_INGEST_STATE_KEY = "__TRACY_BROWSER_INGEST__";

function emptyFileSelectionSnapshot() {
  return {
    selectedAt: null,
    selectedFile: {
      name: null,
      size: null,
    },
  };
}

function fileSelectionSnapshot(value = {}) {
  const snapshot = value ?? {};
  const selectedFile = snapshot.selectedFile ?? {};

  return {
    selectedAt: snapshot.selectedAt ?? null,
    selectedFile: {
      name: selectedFile.name ?? null,
      size: selectedFile.size ?? null,
    },
  };
}

async function installBrowserFileSelectionInstrumentation(page) {
  await page.evaluateOnNewDocument((stateKey) => {
    const state = globalThis[stateKey] ?? {};
    const fileSelection = {
      selectedAt: null,
      selectedFile: {
        name: null,
        size: null,
      },
    };

    state.fileSelection = fileSelection;
    globalThis[stateKey] = state;

    const addEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function addInstrumentedListener(
      type,
      listener,
      options,
    ) {
      if (
        this instanceof HTMLInputElement &&
        this.type === "file" &&
        type === "change" &&
        typeof listener === "function"
      ) {
        return addEventListener.call(
          this,
          type,
          function instrumentedFileSelectionChange(event) {
            fileSelection.selectedAt ??= performance.now();
            fileSelection.selectedFile = {
              name: this.files?.[0]?.name ?? null,
              size: this.files?.[0]?.size ?? null,
            };
            return listener.call(this, event);
          },
          options,
        );
      }

      return addEventListener.call(this, type, listener, options);
    };
  }, BROWSER_INGEST_STATE_KEY);
}

module.exports = {
  BROWSER_INGEST_STATE_KEY,
  emptyFileSelectionSnapshot,
  fileSelectionSnapshot,
  installBrowserFileSelectionInstrumentation,
};
